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
import type { TourConfig, TourStep, HighlightRect } from './types'

/** 元素解析器：宿主页面提供，把 target 名解析为 DOM 元素 */
export type TargetResolver = (target: string) => HTMLElement | null

const GATE_POLL_INTERVAL = 150
const ELEMENT_WAIT_TIMEOUT = 12000

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
  waitTimedOut: false
})

// ---------- 内部状态（非响应式） ----------
let onComplete: (() => void) | null = null
let _resolver: TargetResolver | null = null
let _gateTimer: ReturnType<typeof setInterval> | null = null
let _waitObserver: MutationObserver | null = null
let _waitTimer: ReturnType<typeof setTimeout> | null = null
let _clickDelayTimer: ReturnType<typeof setTimeout> | null = null
let _resizeObs: ResizeObserver | null = null
let _scrollHandler: (() => void) | null = null
let _expandObs: MutationObserver | null = null
let _currentStep: TourStep | null = null

function _currentStepFn(): TourStep | null {
  return tourState.config?.steps[tourState.stepIndex] ?? null
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
  _cleanup()
  tourState.active = false
  tourState.config = null
  tourState.highlightRect = null
  tourState.targetEl = null
  _resolver = null
  onComplete = null
}

export function complete(): void {
  _cleanup()
  tourState.active = false
  tourState.highlightRect = null
  tourState.targetEl = null
  const cb = onComplete
  _resolver = null
  onComplete = null
  cb?.()
}

// ---------- 步骤推进 ----------
export function next(): void {
  _cleanup()
  const cfg = tourState.config
  if (!cfg) return
  if (tourState.stepIndex >= cfg.steps.length - 1) { complete(); return }
  tourState.stepIndex += 1
  _enterStep()
}

export function skip(): void { next() }

// ---------- 进入当前步 ----------
function _enterStep(): void {
  const step = _currentStepFn()
  if (!step) { complete(); return }
  _currentStep = step
  tourState.gatePass = step.gate ? false : true
  tourState.waitingTarget = true
  tourState.waitTimedOut = false
  tourState.highlightRect = null
  tourState.targetEl = null

  const enterResult = step.beforeEnter?.()
  if (enterResult instanceof Promise) {
    enterResult.then(() => _resolveTarget(step))
  } else {
    requestAnimationFrame(() => _resolveTarget(step))
  }
}

// ---------- 解析目标元素 ----------
function _resolveTarget(step: TourStep): void {
  if (step.trigger === 'auto') {
    tourState.waitingTarget = false
    _autoAdvance(step)
    return
  }
  if (step.trigger === 'wait-dom') {
    _waitForDom(step)
    return
  }
  const el = _findTarget(step.target)
  if (el) { _onTargetReady(el, step); return }
  _startWaitForElement(step.target, () => {
    const el2 = _findTarget(step.target)
    _onTargetReady(el2, step)
  })
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
  tourState.targetEl = el
  _updateRect(el)
  _bindTrigger(el, step)
  _startGate(step)
  _startTrackingRect(el)
}

// ---------- 高亮矩形跟踪 ----------
function _updateRect(el: HTMLElement): void {
  const r = el.getBoundingClientRect()
  const pad = 6
  let rect: HighlightRect = {
    top: r.top - pad, left: r.left - pad,
    width: r.width + pad * 2, height: r.height + pad * 2
  }
  const expandSel = _currentStep?.expandSelector
  if (expandSel) {
    const candidates = document.querySelectorAll(expandSel)
    let expandEl: HTMLElement | null = null
    for (const c of candidates) {
      if ((c as HTMLElement).offsetHeight > 0) { expandEl = c as HTMLElement; break }
    }
    if (expandEl) {
      const er = expandEl.getBoundingClientRect()
      const top = Math.min(rect.top, er.top - pad)
      const left = Math.min(rect.left, er.left - pad)
      const right = Math.max(rect.left + rect.width, er.right + pad)
      const bottom = Math.max(rect.top + rect.height, er.bottom + pad)
      rect = { top, left, width: right - left, height: bottom - top }
    }
  }
  tourState.highlightRect = rect
}

function _startTrackingRect(el: HTMLElement): void {
  _stopTrackingRect()
  _scrollHandler = () => _updateRect(el)
  window.addEventListener('scroll', _scrollHandler, true)
  window.addEventListener('resize', _scrollHandler)
  _resizeObs = new ResizeObserver(() => _updateRect(el))
  _resizeObs.observe(el)
  const expandSel = _currentStep?.expandSelector
  if (expandSel) {
    _expandObs = new MutationObserver(() => _updateRect(el))
    _expandObs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] })
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
}

// ---------- 事件绑定 ----------
function _bindTrigger(el: HTMLElement, step: TourStep): void {
  if (step.trigger === 'click') {
    const handler = () => {
      el.removeEventListener('click', handler)
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
function _waitForDom(step: TourStep): void {
  const sel = step.waitForElement
  if (!sel) { next(); return }
  if (_findTarget(sel)) {
    _clickDelayTimer = setTimeout(() => next(), step.clickDelay ?? 300)
    return
  }
  _startWaitForElement(sel, () => {
    _clickDelayTimer = setTimeout(() => next(), step.clickDelay ?? 300)
  })
}

function _startWaitForElement(target: string, cb: () => void): void {
  let resolved = false
  const finish = () => { if (!resolved) { resolved = true; _waitObserver?.disconnect(); _waitObserver = null; cb() } }
  _waitObserver = new MutationObserver(() => { if (_findTarget(target)) finish() })
  _waitObserver.observe(document.body, { childList: true, subtree: true })
  _waitTimer = setTimeout(finish, ELEMENT_WAIT_TIMEOUT)
}

function _autoAdvance(step: TourStep): void {
  _clickDelayTimer = setTimeout(() => next(), step.autoDelay ?? 600)
}

// ---------- 清理 ----------
function _cleanup(): void {
  _stopTrackingRect()
  if (_gateTimer) { clearInterval(_gateTimer); _gateTimer = null }
  if (_waitObserver) { _waitObserver.disconnect(); _waitObserver = null }
  if (_waitTimer) { clearTimeout(_waitTimer); _waitTimer = null }
  if (_clickDelayTimer) { clearTimeout(_clickDelayTimer); _clickDelayTimer = null }
}
