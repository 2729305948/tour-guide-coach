/**
 * 漫游式引导引擎 · 状态机 (Pinia Store)
 * -----------------------------------------------------------------
 * 核心设计变更：target 不再是 CSS selector，而是通过宿主页面注册的
 * resolver 函数解析为 HTMLElement。宿主页面持有业务组件 ref，
 * 引导引擎通过 resolver('nameRef') 拿到 DOM 元素。
 *
 * 生命周期：
 *   startTour(config, resolver) → 逐步 enterStep → resolveTarget
 *   → 绑定 trigger 监听 → 用户操作满足条件 → next() → complete/abort
 */
import { ref, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import type { TourConfig, TourStep, HighlightRect } from './types'

/** 元素解析器：宿主页面提供，把 target 名解析为 DOM 元素 */
export type TargetResolver = (target: string) => HTMLElement | null

const GATE_POLL_INTERVAL = 150
const ELEMENT_WAIT_TIMEOUT = 12000

export const useTourStore = defineStore('tour', () => {
  // ---------- 状态 ----------
  const active = ref(false)
  const config = shallowRef<TourConfig | null>(null)
  const stepIndex = ref(0)
  const totalSteps = ref(0)
  const highlightRect = shallowRef<HighlightRect | null>(null)
  const targetEl = shallowRef<HTMLElement | null>(null)
  const gatePass = ref(true)
  const waitingTarget = ref(false)
  const waitTimedOut = ref(false)
  let onComplete: (() => void) | null = null
  let _resolver: TargetResolver | null = null

  // ---------- 内部计时器 ----------
  let _gateTimer: ReturnType<typeof setInterval> | null = null
  let _waitObserver: MutationObserver | null = null
  let _waitTimer: ReturnType<typeof setTimeout> | null = null
  let _clickDelayTimer: ReturnType<typeof setTimeout> | null = null
  let _resizeObs: ResizeObserver | null = null
  let _scrollHandler: (() => void) | null = null

  function currentStep(): TourStep | null {
    return config.value?.steps[stepIndex.value] ?? null
  }

  // ---------- 启动引导 ----------
  /**
   * @param tour 引导配置
   * @param resolver 宿主页面提供的元素解析器（target 名 → HTMLElement）
   * @param done 引导完成回调
   */
  function startTour(tour: TourConfig, resolver?: TargetResolver, done?: () => void): void {
    if (active.value) abort()
    config.value = tour
    stepIndex.value = 0
    totalSteps.value = tour.steps.length
    gatePass.value = true
    onComplete = done ?? null
    _resolver = resolver ?? null
    active.value = true
    _enterStep()
  }

  function abort(): void {
    _cleanup()
    active.value = false
    config.value = null
    highlightRect.value = null
    targetEl.value = null
    _resolver = null
    onComplete = null
  }

  function complete(): void {
    _cleanup()
    active.value = false
    highlightRect.value = null
    targetEl.value = null
    const cb = onComplete
    _resolver = null
    onComplete = null
    cb?.()
  }

  // ---------- 步骤推进 ----------
  function next(): void {
    _cleanup()
    const cfg = config.value
    if (!cfg) return
    if (stepIndex.value >= cfg.steps.length - 1) { complete(); return }
    stepIndex.value += 1
    _enterStep()
  }

  function skip(): void { next() }

  // ---------- 进入当前步 ----------
  function _enterStep(): void {
    const step = currentStep()
    if (!step) { complete(); return }
    _currentStep = step
    gatePass.value = step.gate ? false : true
    waitingTarget.value = true
    waitTimedOut.value = false
    highlightRect.value = null
    targetEl.value = null

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
      waitingTarget.value = false
      _autoAdvance(step)
      return
    }
    if (step.trigger === 'wait-dom') {
      _waitForDom(step)
      return
    }
    const el = _findTarget(step.target)
    if (el) { _onTargetReady(el, step); return }
    // 目标不在 → 轮询等
    _startWaitForElement(step.target, () => {
      const el2 = _findTarget(step.target)
      _onTargetReady(el2, step)
    })
  }

  /** 通过 resolver 或兜底 querySelector 找元素 */
  function _findTarget(target: string): HTMLElement | null {
    // 优先用宿主 resolver
    if (_resolver) {
      const el = _resolver(target)
      if (el) return el
    }
    // 兜底：当作 CSS selector 尝试（用于全局元素如 body、自定义锚点）
    try { return document.querySelector(target) } catch { return null }
  }

  function _onTargetReady(el: HTMLElement | null, step: TourStep): void {
    if (!el) { waitTimedOut.value = true; return }
    waitingTarget.value = false
    waitTimedOut.value = false
    targetEl.value = el
    _updateRect(el)
    _bindTrigger(el, step)
    _startGate(step)
    _startTrackingRect(el)
  }

  // ---------- 高亮矩形跟踪 ----------
  let _expandObs: MutationObserver | null = null
  let _currentStep: TourStep | null = null

  function _updateRect(el: HTMLElement): void {
    const r = el.getBoundingClientRect()
    const pad = 6
    let rect: HighlightRect = {
      top: r.top - pad, left: r.left - pad,
      width: r.width + pad * 2, height: r.height + pad * 2
    }
    // 动态扩展：如果当前步有 expandSelector 且匹配元素可见，取联合矩形
    const expandSel = _currentStep?.expandSelector
    if (expandSel) {
      // 多个 popper 共存时取第一个可见的（display:none 的跳过）
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
    highlightRect.value = rect
  }

  function _startTrackingRect(el: HTMLElement): void {
    _stopTrackingRect()
    _scrollHandler = () => _updateRect(el)
    window.addEventListener('scroll', _scrollHandler, true)
    window.addEventListener('resize', _scrollHandler)
    _resizeObs = new ResizeObserver(() => _updateRect(el))
    _resizeObs.observe(el)
    // 监听 expand 元素出现/消失（select 展开/收起）
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
    if (!step.gate) { gatePass.value = true; return }
    const resolve = (t: string) => _findTarget(t)
    gatePass.value = step.gate(resolve)
    if (gatePass.value) return
    _gateTimer = setInterval(() => {
      if (step.gate!(resolve)) {
        gatePass.value = true
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

  return {
    active, config, stepIndex, totalSteps, highlightRect, targetEl,
    gatePass, waitingTarget, waitTimedOut,
    startTour, abort, next, skip, complete, currentStep
  }
})
