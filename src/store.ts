/**
 * 漫游式引导引擎 · 状态机（模块级单例，零外部依赖）
 * -----------------------------------------------------------------
 * 用 Vue 3 的 reactive + ref 替代 Pinia。
 * 全局单例——同一时间只允许一个 tour 播放。
 *
 * 生命周期：
 *   startTour(config, resolver) → 逐步 enterStep → resolveTarget
 *   → 绑定 trigger 监听 → 用户操作满足条件 → next() → complete/abort
 */
import { ref, shallowReactive } from 'vue'
import type { TourConfig, TourStep, HighlightRect, TargetLostReason, TourActionContext } from './types'

/** 元素解析器：宿主页面提供，把 target 名解析为 DOM 元素 */
export type TargetResolver = (target: string) => HTMLElement | null

const GATE_POLL_INTERVAL = 150
const ELEMENT_WAIT_TIMEOUT = 12000
/** 目标存活检测轮询间隔（ms） */
const LOST_CHECK_INTERVAL = 200
/** 连续判定失败次数阈值：避开弹窗关闭动画的中间帧，约 400ms 才确认消失 */
const LOST_CONFIRM_TICKS = 2
/** auto 模式：action 执行完到推步之间的默认停留（ms），让用户看清"引擎在替我操作" */
const AUTO_ACTION_DWELL = 600

// ---------- 响应式状态（模块级单例） ----------
export const tourState = shallowReactive({
  active: false,
  config: null as TourConfig | null,
  stepIndex: 0,
  totalSteps: 0,
  highlightRect: null as HighlightRect | null,
  targetEl: null as HTMLElement | null,
  gatePass: true,
  waitingTarget: false,
  waitTimedOut: false,
  /** 依附的目标窗口被意外关闭（元素移除/隐藏），引导已中断 */
  targetLost: false,
  lostReason: '' as '' | TargetLostReason,
  /** auto 模式：正在执行本步 action / 停留中，禁用「下一步」防连点 */
  autoBusy: false
})

// ---------- 内部状态（非响应式） ----------
let onComplete: (() => void) | null = null
let _resolver: TargetResolver | null = null
let _gateTimer: ReturnType<typeof setInterval> | null = null
let _waitObserver: MutationObserver | null = null
let _waitTimer: ReturnType<typeof setTimeout> | null = null
let _clickDelayTimer: ReturnType<typeof setTimeout> | null = null
/** _nextFrame 的兜底定时器：必须被 _cleanup 跟踪，否则 abort/换步后仍会解析旧目标 */
let _frameTimer: ReturnType<typeof setTimeout> | null = null
/** 进入步骤的代数：任何异步回调都带上自己那一代，过期即丢弃 */
let _enterGen = 0
let _resizeObs: ResizeObserver | null = null
let _scrollHandler: (() => void) | null = null
let _expandObs: MutationObserver | null = null
let _lostTimer: ReturnType<typeof setInterval> | null = null
let _lostMiss = 0
let _lostArmed = false
let _currentStep: TourStep | null = null
/** 实际用于测量高亮的元素（promoteControl 时可能是 target 的祖先控件根） */
let _hlEl: HTMLElement | null = null
/** autoExpand 因果绑定：点击 target 后第一个冒出来的浮层，认定为它的面板 */
let _boundPanel: HTMLElement | null = null
let _panelArmedUntil = 0
let _armPanelHandler: ((e: Event) => void) | null = null

function _currentStepFn(): TourStep | null {
  return tourState.config?.steps[tourState.stepIndex] ?? null
}

/** 获取当前步骤（供组件使用） */
export function currentStep(): TourStep | null {
  return _currentStepFn()
}

// ---------- 启动引导 ----------
export function startTour(tour: TourConfig, resolver?: TargetResolver, done?: () => void): void {
  if (tourState.active) abort()
  tourState.config = tour
  tourState.stepIndex = 0
  tourState.totalSteps = tour.steps.length
  tourState.gatePass = true
  onComplete = done ?? null
  _resolver = resolver ?? null
  tourState.active = true
  _enterStep()
}

export function abort(): void {
  _enterGen += 1 // 作废 _nextFrame / beforeEnter 里尚未触发的回调
  _cleanup()
  tourState.active = false
  tourState.config = null
  tourState.highlightRect = null
  tourState.targetEl = null
  tourState.targetLost = false
  tourState.lostReason = ''
  tourState.autoBusy = false
  // 等待态/门控属于本轮会话的痕迹，终止后一并归位，避免脏值被下一次引导读到
  tourState.waitingTarget = false
  tourState.waitTimedOut = false
  tourState.gatePass = true
  _resolver = null
  onComplete = null
}

export function complete(): void {
  _enterGen += 1 // 同 abort：清掉在途回调的生效资格（gate 保留最后值，避免收尾瞬间闪回锁定态）
  _cleanup()
  tourState.active = false
  tourState.highlightRect = null
  tourState.targetEl = null
  tourState.targetLost = false
  tourState.lostReason = ''
  tourState.autoBusy = false
  const cb = onComplete
  _resolver = null
  onComplete = null
  cb?.()
}

// ---------- 步骤推进 ----------
export function next(): void {
  const cfg = tourState.config
  const step = _currentStepFn()
  // auto 模式：点「下一步」先代用户执行本步 action，停留后再推进
  if (cfg?.mode === 'auto' && step?.action && !tourState.autoBusy) {
    _runAutoAction(step)
    return
  }
  _advance()
}

export function skip(): void { _advance() }

/** 真正推进到下一步（或收尾） */
function _advance(): void {
  _cleanup()
  const cfg = tourState.config
  if (!cfg) return
  if (tourState.stepIndex >= cfg.steps.length - 1) { complete(); return }
  tourState.stepIndex += 1
  _enterStep()
}

/** auto 模式：执行本步 action（可 async）→ 停留 → 推进；期间置 autoBusy 防连点 */
function _runAutoAction(step: TourStep): void {
  tourState.autoBusy = true
  const dwell = step.actionDwell ?? AUTO_ACTION_DWELL
  const settle = (): void => {
    window.setTimeout(() => { tourState.autoBusy = false; _advance() }, dwell)
  }
  try {
    const r = step.action?.(_buildActionCtx())
    if (r instanceof Promise) r.then(settle).catch(settle)
    else settle()
  } catch { settle() }
}

// ---------- 进入当前步 ----------
function _enterStep(): void {
  const step = _currentStepFn()
  if (!step) { complete(); return }
  _enterGen += 1 // 作废上一步残留的异步回调
  _currentStep = step
  // auto 模式：用户不操作控件，gate 无意义，恒放行让「下一步」可点
  tourState.gatePass = tourState.config?.mode === 'auto' ? true : (step.gate ? false : true)
  tourState.waitingTarget = true
  tourState.waitTimedOut = false
  tourState.targetLost = false
  tourState.lostReason = ''
  tourState.highlightRect = null
  tourState.targetEl = null
  _hlEl = null
  _boundPanel = null
  _panelArmedUntil = 0

  const gen = _enterGen
  const enterResult = step.beforeEnter?.()
  if (enterResult instanceof Promise) {
    enterResult.then(() => _resolveTarget(step, gen))
  } else {
    _nextFrame(() => _resolveTarget(step, gen), gen)
  }
}

/**
 * 等一帧再解析目标（给 beforeEnter 引发的 DOM 变化留出提交时间）。
 * 后台标签页里 requestAnimationFrame 不触发，所以并用 setTimeout 兜底，
 * 否则引导会在不可见标签页里永久卡在等待态。
 *
 * 定时器必须登记到 _frameTimer（_cleanup 里清），且回调执行前必须核对
 * 「引导还活着 + 仍是我那一代」——否则 abort/complete/换步之后这个迟到一帧的
 * 回调会把已终止的引导复活：重新写 highlightRect/targetEl，还给废弃步骤
 * 绑上 trigger/gate 轮询/存活检测与一堆窗口级监听器（实测可跨引导污染状态）。
 * rAF 那一路无法取消，所以只清定时器不够，代数守卫是必需的。
 */
function _nextFrame(cb: () => void, gen: number): void {
  let done = false
  const run = () => {
    if (done) return
    done = true
    _frameTimer = null
    if (!tourState.active || gen !== _enterGen) return
    cb()
  }
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(run)
  _frameTimer = setTimeout(run, 64)
}

// ---------- 解析目标元素 ----------
function _resolveTarget(step: TourStep, gen: number = _enterGen): void {
  if (!tourState.active || gen !== _enterGen) return
  if (step.trigger === 'auto') {
    tourState.waitingTarget = false
    _autoAdvance(step)
    return
  }
  if (step.trigger === 'wait-dom') {
    _waitForDom(step, gen)
    return
  }
  const el = _findTarget(step.target)
  if (el && !_probeTarget(el)) { _onTargetReady(el, step); return }
  _startWaitForElement(step.target, () => {
    if (!tourState.active || gen !== _enterGen) return
    const el2 = _findTarget(step.target)
    // 超时仍不可见（如弹窗还开着但 display:none）→ 按未找到处理，交给超时 UI
    if (el2 && !_probeTarget(el2)) _onTargetReady(el2, step)
    else tourState.waitTimedOut = true
  }, true)
}

function _findTarget(target: string): HTMLElement | null {
  if (_resolver) {
    const el = _resolver(target)
    if (el) return el
  }
  try { return document.querySelector(target) } catch { return null }
}

function _onTargetReady(el: HTMLElement | null, step: TourStep): void {
  if (!el) { tourState.waitTimedOut = true; return }
  tourState.waitingTarget = false
  tourState.waitTimedOut = false
  tourState.targetLost = false
  tourState.lostReason = ''
  tourState.targetEl = el
  _hlEl = _resolveHighlightEl(el) // promoteControl：把 input 叶子提升到画了可见盒子的控件根
  _startTrackingRect(el)          // 先绑滚动/尺寸监听
  _scrollIntoViewIfNeeded(el)     // 再滚动，滚动事件会持续把 rect 刷新到位
  _updateRect(el)
  // auto 模式：用户不操作、页面变化只由引擎 action 引发（属预期），不绑 trigger/gate，也不做意外关窗检测
  if (tourState.config?.mode !== 'auto') {
    _bindTrigger(el, step)
    _startGate(step)
    _armLostWatch()
  }
}

/** 自动滚动时给目标留的安全边距（px） */
const SCROLL_EDGE = 24

/**
 * 目标不在视口内（或被边缘压住）时滚到视野中央。
 * 只在目标就绪那一刻滚一次，之后用户自己滚动不抢方向盘。
 * 关掉：`TourConfig.autoScroll = false`。
 */
function _scrollIntoViewIfNeeded(el: HTMLElement): void {
  if (tourState.config?.autoScroll === false) return
  if (!_needsScroll(el)) return
  const reduce = typeof matchMedia === 'function' &&
    matchMedia('(prefers-reduced-motion: reduce)').matches
  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center', inline: 'center' })
}

/**
 * 目标是否需要滚动：超出视口安全边距，或被某个滚动容器裁切。
 * 后者光看视口矩形会漏判——被 overflow 容器裁掉的元素，
 * getBoundingClientRect 的数值仍然落在视口内，但用户看不见它。
 */
function _needsScroll(el: HTMLElement): boolean {
  const b = _boxOf(el)
  const r = { top: b.top, left: b.left, right: b.left + b.width, bottom: b.top + b.height }
  const vw = window.innerWidth
  const vh = window.innerHeight
  if (r.top < SCROLL_EDGE || r.bottom > vh - SCROLL_EDGE ||
      r.left < SCROLL_EDGE || r.right > vw - SCROLL_EDGE) return true
  if (typeof getComputedStyle !== 'function') return false
  let p = el.parentElement
  while (p) {
    const s = getComputedStyle(p)
    if (s.overflowY !== 'visible' || s.overflowX !== 'visible') {
      const pr = p.getBoundingClientRect()
      if (r.top < pr.top || r.bottom > pr.bottom || r.left < pr.left || r.right > pr.right) return true
    }
    p = p.parentElement
  }
  return false
}

// ---------- 高亮矩形跟踪 ----------
/**
 * 取元素的"布局盒"（不受自身 transform 缩放影响），定位到其视觉中心。
 * 组件的出现过渡常是 scaleX/scaleY(0→1)：那一刻 getBoundingClientRect 的宽高被压成 0，
 * 但 offsetWidth/Height 是稳定的布局尺寸。用布局盒尺寸 + 变换后的中心，挂载首帧就能拿到
 * 正确的最终框，无需等过渡结束再量，也不依赖轮询。inline 元素 offsetWidth 为 0，回退用 rect。
 */
function _boxOf(el: HTMLElement): HighlightRect {
  const r = el.getBoundingClientRect()
  const w = el.offsetWidth || r.width
  const h = el.offsetHeight || r.height
  const cx = r.left + r.width / 2
  const cy = r.top + r.height / 2
  return { top: cy - h / 2, left: cx - w / 2, width: w, height: h }
}

/**
 * 面板专用：取原始（变换后）rect。teleport 面板的开合多是顶部原点 scaleY——
 * 用 _boxOf 反推中心会让高亮整体偏上、动画结束再跳回（抖动）。原始 rect 的 top 固定、
 * 高度随动画长起，与面板自身的揭示动画同步，无跳动。目标元素仍走 _boxOf（治 el-tag 压扁）。
 */
function _rawBox(el: HTMLElement): HighlightRect {
  const r = el.getBoundingClientRect()
  return { top: r.top, left: r.left, width: r.width, height: r.height }
}

function _updateRect(el: HTMLElement): void {
  const hl = _hlEl ?? el
  const b = _boxOf(hl)
  const pad = 6
  let rect: HighlightRect = {
    top: b.top - pad, left: b.left - pad,
    width: b.width + pad * 2, height: b.height + pad * 2
  }
  const expandSel = _currentStep?.expandSelector
  if (expandSel) {
    const candidates = document.querySelectorAll(expandSel)
    let expandEl: HTMLElement | null = null
    for (const c of candidates) {
      if ((c as HTMLElement).offsetHeight > 0) { expandEl = c as HTMLElement; break }
    }
    if (expandEl) {
      const eb = _rawBox(expandEl)
      const top = Math.min(rect.top, eb.top - pad)
      const left = Math.min(rect.left, eb.left - pad)
      const right = Math.max(rect.left + rect.width, eb.left + eb.width + pad)
      const bottom = Math.max(rect.top + rect.height, eb.top + eb.height + pad)
      rect = { top, left, width: right - left, height: bottom - top }
    }
  } else if (_currentStep?.autoExpand) {
    rect = _expandToPanels(hl, rect, pad)
  }
  tourState.highlightRect = rect
}

// ---------- promoteControl：把 form 叶子提升到"画了可见盒子"的控件根 ----------
/**
 * 组件常把 id/焦点挂在内部 <input> 上（EP 的 el-select 就是），直接高亮 input
 * 只框到窄输入框。此函数把 target 上提到最近的、真正画出边框/背景/圆角的祖先
 * ——也就是用户眼里"那个控件"。判据纯计算样式，不绑任何组件库。
 */
function _resolveHighlightEl(el: HTMLElement): HTMLElement {
  if (!_currentStep?.promoteControl) return el
  const tag = el.tagName
  if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') return el
  let p = el.parentElement
  while (p && p !== document.body) {
    if (_paintsBox(p)) return p
    p = p.parentElement
  }
  return el
}

/** 元素是否"画了可见盒子"：任一 border / box-shadow / 不透明背景 / 圆角 非空 */
function _paintsBox(n: HTMLElement): boolean {
  const cs = getComputedStyle(n)
  if (cs.borderTopWidth !== '0px' || cs.borderRightWidth !== '0px' ||
      cs.borderBottomWidth !== '0px' || cs.borderLeftWidth !== '0px') return true
  if (cs.boxShadow && cs.boxShadow !== 'none') return true
  if (_hasOpaqueBackground(cs.backgroundColor)) return true
  if (parseFloat(cs.borderTopLeftRadius) > 0 || parseFloat(cs.borderBottomRightRadius) > 0) return true
  return false
}

/** 背景色是否不透明（排除 transparent / rgba(...,0)） */
function _hasOpaqueBackground(bg: string): boolean {
  if (!bg || bg === 'transparent') return false
  const m = bg.match(/rgba?\(([^)]+)\)/)
  if (!m) return true // #fff / rgb() / 具名色
  const parts = m[1].split(/[,\s/]+/).filter(Boolean)
  const alpha = parts.length >= 4 ? parseFloat(parts[3]) : 1
  return alpha > 0.05
}

// ---------- autoExpand：三层并入面板 ----------
/** 面板与目标矩形允许的最大间隙（px） */
const PANEL_GAP = 16
/** 因果绑定窗口：点击 target 后这段时间内冒出来的浮层认定为它的面板（ms） */
const CAPTURE_WINDOW_MS = 500

/**
 * 谁命中用谁、可叠加：
 *  ① 因果绑定：_boundPanel 若仍可见则无条件并入——兜住翻转到远处/有间隙的面板。
 *  ② 跨库约定：全局 [data-popper-placement]（Popper.js / Floating-UI 通用），抗任意嵌套深度。
 *  ③ 几何兜底：扫 body 浮层，取"贴着目标 + 可见 + 定位"者——覆盖不用 popper 约定的库。
 */
function _expandToPanels(hl: HTMLElement, base: HighlightRect, pad: number): HighlightRect {
  const tr = _boxOf(hl)
  let top = base.top, left = base.left
  let right = base.left + base.width, bottom = base.top + base.height
  let any = false
  const include = (node: HTMLElement): void => {
    const eb = _rawBox(node)
    top = Math.min(top, eb.top - pad); left = Math.min(left, eb.left - pad)
    right = Math.max(right, eb.left + eb.width + pad); bottom = Math.max(bottom, eb.top + eb.height + pad)
    any = true
  }

  // ① 因果绑定优先
  if (_boundPanel && _boundPanel.isConnected && _panelVisible(_boundPanel)) include(_boundPanel)

  const armed = performance.now() < _panelArmedUntil
  for (const c of _panelCandidates(hl)) {
    if (c === _boundPanel) continue
    if (_rectAdjacent(_rawBox(c), tr)) {
      include(c)
    } else if (armed) {
      // 因果窗口内冒出来、却没贴着目标（翻转/有间隙）→ 绑定为它的面板
      _boundPanel = c
      _panelArmedUntil = 0
      include(c)
    }
  }
  if (_boundPanel && _boundPanel.isConnected && _panelVisible(_boundPanel)) _panelArmedUntil = 0
  return any ? { top, left, width: right - left, height: bottom - top } : base
}

/** 收集候选面板（去重）：popper 约定 + body 浮层扫描 */
function _panelCandidates(hl: HTMLElement): HTMLElement[] {
  const seen = new Set<HTMLElement>()
  const out: HTMLElement[] = []
  const push = (n: Element | null | undefined): void => {
    const el = n as HTMLElement | null
    if (!el || seen.has(el) || !_isPanelOf(el, hl)) return
    seen.add(el); out.push(el)
  }
  // ② 跨库约定信号（含任意深度）
  document.querySelectorAll('[data-popper-placement]').forEach(push)
  // ③ 通用 body 浮层：直系子节点 + 下探一层（teleport 容器不定位时）
  const tourRoot = document.querySelector('.tour-root')
  const kids = document.body.children
  for (let i = 0; i < kids.length; i++) {
    const c = kids[i] as HTMLElement
    if (c === tourRoot || (tourRoot && tourRoot.contains(c))) continue
    if (getComputedStyle(c).position === 'static') {
      const inner = c.children
      for (let j = 0; j < inner.length; j++) push(inner[j])
    } else push(c)
  }
  return out
}

/** 节点是否为"可见的浮层面板"：定位、非引导自身、非目标祖先、非全屏遮罩 */
function _isPanelOf(node: HTMLElement, hl: HTMLElement): boolean {
  if (node === hl || node.contains(hl)) return false
  const tourRoot = document.querySelector('.tour-root')
  if (tourRoot && (node === tourRoot || tourRoot.contains(node) || node.contains(tourRoot))) return false
  const cs = getComputedStyle(node)
  if (cs.position !== 'fixed' && cs.position !== 'absolute') return false
  if (cs.display === 'none' || cs.visibility === 'hidden') return false
  // 尺寸判据用布局值：面板自身的开合过渡(scale/fade)不该让它被误判为"太小"
  const w = node.offsetWidth, h = node.offsetHeight
  if (w < 2 || h < 2) return false
  if (w >= window.innerWidth * 0.9 && h >= window.innerHeight * 0.9) return false
  return true
}

function _panelVisible(node: HTMLElement): boolean {
  const cs = getComputedStyle(node)
  if (cs.display === 'none' || cs.visibility === 'hidden') return false
  return node.offsetWidth >= 2 && node.offsetHeight >= 2
}

function _rectAdjacent(a: HighlightRect, b: HighlightRect): boolean {
  const aR = a.left + a.width, aB = a.top + a.height
  const bR = b.left + b.width, bB = b.top + b.height
  return !(aR < b.left - PANEL_GAP || a.left > bR + PANEL_GAP ||
           aB < b.top - PANEL_GAP || a.top > bB + PANEL_GAP)
}

function _startTrackingRect(el: HTMLElement): void {
  _stopTrackingRect()
  const hl = _hlEl ?? el
  _scrollHandler = () => _updateRect(el)
  window.addEventListener('scroll', _scrollHandler, true)
  window.addEventListener('resize', _scrollHandler)
  _resizeObs = new ResizeObserver(() => _updateRect(el))
  _resizeObs.observe(hl)
  const step = _currentStep
  if (step?.expandSelector || step?.autoExpand) {
    _expandObs = new MutationObserver(() => _updateRect(el))
    _expandObs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] })
  }
  // autoExpand 因果绑定：在 target 控件上按下/聚焦 → 开一个捕获窗口
  if (step?.autoExpand) {
    _armPanelHandler = (e: Event) => {
      const t = e.target as Node | null
      if (t && (hl === t || hl.contains(t) || (t instanceof Element && t.contains(hl)))) {
        _panelArmedUntil = performance.now() + CAPTURE_WINDOW_MS
      }
    }
    document.addEventListener('pointerdown', _armPanelHandler, true)
    document.addEventListener('focusin', _armPanelHandler, true)
  }
}

function _stopTrackingRect(): void {
  if (_scrollHandler) {
    window.removeEventListener('scroll', _scrollHandler, true)
    window.removeEventListener('resize', _scrollHandler)
  }
  _scrollHandler = null
  _resizeObs?.disconnect(); _resizeObs = null
  _expandObs?.disconnect(); _expandObs = null
  if (_armPanelHandler) {
    document.removeEventListener('pointerdown', _armPanelHandler, true)
    document.removeEventListener('focusin', _armPanelHandler, true)
    _armPanelHandler = null
  }
  _boundPanel = null
  _panelArmedUntil = 0
}

// ---------- 目标存活检测（依附窗口被意外关闭） ----------
/** 开始检测目标元素是否还在页面上且可见 */
function _armLostWatch(): void {
  _disarmLostWatch()
  _lostArmed = true
  _lostMiss = 0
  _lostTimer = setInterval(_checkTargetLost, LOST_CHECK_INTERVAL)
}

function _disarmLostWatch(): void {
  if (_lostTimer) { clearInterval(_lostTimer); _lostTimer = null }
  _lostArmed = false
  _lostMiss = 0
}

/** 目标当前状态：还在且可见返回 ''，否则返回消失原因 */
function _probeTarget(el: HTMLElement): '' | TargetLostReason {
  if (!el.isConnected) return 'removed'
  // display:none（含祖先隐藏，如 v-show 关掉整个 dialog）时 getClientRects 为空
  if (el.getClientRects().length === 0) return 'hidden'
  return ''
}

function _checkTargetLost(): void {
  if (!_lostArmed) return
  const el = tourState.targetEl
  if (!el) return
  const reason = _probeTarget(el)
  if (!reason) { _lostMiss = 0; return }
  if (++_lostMiss < LOST_CONFIRM_TICKS) return
  _onTargetLost(reason)
}

function _onTargetLost(reason: TargetLostReason): void {
  const step = _currentStepFn()
  // 本步操作已完成（gate 通过）→ 目标消失属于正常流转（如"选完班级直接点保存关闭弹窗"），自动推进
  if (step?.gate && tourState.gatePass) { next(); return }
  _disarmLostWatch()
  _cleanup()
  tourState.targetLost = true
  tourState.lostReason = reason
  tourState.highlightRect = null   // 收起遮罩洞，让页面可操作，用户才能重开窗口
  tourState.targetEl = null
  tourState.config?.onTargetLost?.({
    stepId: step?.id ?? '',
    stepIndex: tourState.stepIndex,
    title: step?.title ?? '',
    target: step?.target ?? '',
    reason
  })
}

/** 中断后重试：重新等待本步目标出现（用户重开窗口即自动续上） */
export function retryLost(): void {
  const step = _currentStepFn()
  if (!step) return
  tourState.targetLost = false
  tourState.lostReason = ''
  tourState.waitingTarget = true
  tourState.waitTimedOut = false
  tourState.highlightRect = null
  _resolveTarget(step)
}

// ---------- 事件绑定 ----------
function _bindTrigger(el: HTMLElement, step: TourStep): void {
  if (step.trigger === 'click') {
    const handler = () => {
      el.removeEventListener('click', handler)
      // 本步点击引发的窗口关闭/替换属于正常流转，不参与意外消失判定
      _disarmLostWatch()
      const delay = step.clickDelay ?? 350
      if (step.afterClickWait) {
        _waitForDom({ waitForElement: step.afterClickWait, clickDelay: delay } as TourStep)
      } else {
        _clickDelayTimer = setTimeout(() => next(), delay)
      }
    }
    el.addEventListener('click', handler)
  }
}

// ---------- Gate 轮询 ----------
function _startGate(step: TourStep): void {
  if (!step.gate) { tourState.gatePass = true; return }
  const resolve = (t: string) => _findTarget(t)
  tourState.gatePass = step.gate(resolve)
  if (tourState.gatePass) return
  _gateTimer = setInterval(() => {
    if (step.gate!(resolve)) {
      tourState.gatePass = true
      if (_gateTimer) { clearInterval(_gateTimer); _gateTimer = null }
    }
  }, GATE_POLL_INTERVAL)
}

// ---------- 等待 DOM ----------
function _waitForDom(step: TourStep, gen: number = _enterGen): void {
  const sel = step.waitForElement
  if (!sel) { next(); return }
  if (_findTarget(sel)) {
    _clickDelayTimer = setTimeout(() => next(), step.clickDelay ?? 300)
    return
  }
  _startWaitForElement(sel, () => {
    if (!tourState.active || gen !== _enterGen) return
    _clickDelayTimer = setTimeout(() => next(), step.clickDelay ?? 300)
  })
}

/**
 * 等待目标出现在 DOM。
 * @param requireVisible 额外要求元素可见（display 非 none）——高亮目标用，
 *                       避免把 v-show 关着的弹窗里的元素当成已就绪、挂出 0×0 高亮
 */
function _startWaitForElement(target: string, cb: () => void, requireVisible = false): void {
  let resolved = false
  const settle = () => {
    if (resolved) return
    resolved = true
    _waitObserver?.disconnect(); _waitObserver = null
    if (_waitTimer) { clearTimeout(_waitTimer); _waitTimer = null }
    cb()
  }
  const probe = () => {
    const el = _findTarget(target)
    if (el && (!requireVisible || !_probeTarget(el))) settle()
  }
  // attributes：v-show 弹窗只切 display，不产生 childList 变更
  _waitObserver = new MutationObserver(probe)
  _waitObserver.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] })
  _waitTimer = setTimeout(settle, ELEMENT_WAIT_TIMEOUT)
}

function _autoAdvance(step: TourStep): void {
  _clickDelayTimer = setTimeout(() => next(), step.autoDelay ?? 600)
}

// ---------- auto 模式：代客操作的动作原语 ----------
/** 把选择器或元素解析成 DOM；省略则用当前步目标 */
function _actEl(t?: string | HTMLElement): HTMLElement | null {
  if (!t) return tourState.targetEl
  if (typeof t !== 'string') return t
  return _findTarget(t)
}

function _fireMouse(el: HTMLElement, type: string): void {
  el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }))
}

/** 通用点击：pointerdown/mousedown/mouseup + click，覆盖 EP 等"按下才触发"的组件 */
function _actClick(el: HTMLElement): void {
  _fireMouse(el, 'pointerdown')
  _fireMouse(el, 'mousedown')
  _fireMouse(el, 'mouseup')
  el.click()
}

/** 填充：走原生 value setter + input/change，让 v-model 收到 */
function _actFill(el: HTMLElement, value: string): void {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
  setter?.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
}

/** 勾选/取消：取容器内第一个 checkbox/radio，状态不符才点（避免来回切） */
function _actCheck(el: HTMLElement, checked = true): void {
  const input = el instanceof HTMLInputElement
    ? el
    : el.querySelector('input[type="checkbox"], input[type="radio"]') as HTMLInputElement | null
  if (!(input instanceof HTMLInputElement) || input.checked === checked) return
  _actClick(input)
}

/** 尽力而为的下拉选择：点开 → 等面板 → 按 ARIA role=option 文本/序号点 */
async function _actSelect(el: HTMLElement, label: string | number): Promise<void> {
  // 触发点在内部（EP 的下拉监听在 wrapper，对根节点派发不会向下冒泡）；点 input 会冒泡到 wrapper 打开
  const trigger = (el.querySelector('[aria-haspopup],[role="combobox"],input') || el) as HTMLElement
  _actClick(trigger)
  await new Promise((r) => window.setTimeout(r, 350))
  const opts = [...document.querySelectorAll('[role="option"]')] as HTMLElement[]
  const visible = opts.filter((o) => o.offsetHeight > 0)
  const hit = typeof label === 'number'
    ? visible[label]
    : visible.find((o) => (o.textContent || '').trim().includes(String(label)))
  if (hit) _actClick(hit)
}

/** 组装传给 step.action 的上下文（通用原语 + resolve/el 逃生舱） */
function _buildActionCtx(): TourActionContext {
  return {
    resolve: (t) => _findTarget(t),
    get el() { return tourState.targetEl },
    click: (t) => { const e = _actEl(t); if (e) _actClick(e) },
    fill: (v, t) => { const e = _actEl(t); if (e) _actFill(e, v) },
    check: (c, t) => { const e = _actEl(t); if (e) _actCheck(e, c) },
    select: async (l, t) => { const e = _actEl(t); if (e) await _actSelect(e, l) },
    wait: (ms) => new Promise((r) => window.setTimeout(r, ms))
  }
}

// ---------- 清理 ----------
function _cleanup(): void {
  _stopTrackingRect()
  _disarmLostWatch()
  if (_gateTimer) { clearInterval(_gateTimer); _gateTimer = null }
  if (_waitObserver) { _waitObserver.disconnect(); _waitObserver = null }
  if (_waitTimer) { clearTimeout(_waitTimer); _waitTimer = null }
  if (_clickDelayTimer) { clearTimeout(_clickDelayTimer); _clickDelayTimer = null }
  // _nextFrame 的兜底定时器：rAF 那一路取消不了，靠 _enterGen / active 守卫兜住
  if (_frameTimer) { clearTimeout(_frameTimer); _frameTimer = null }
}
