<!--
  漫游式引导 · 全局蒙版组件（零 UI 库依赖）
  -----------------------------------------------------------------
  样式沿用 Element Plus 设计语言（色彩、圆角、字号），但不依赖任何组件库。
  原生 <button> + 内联 SVG + CSS 变量（--tg-* 前缀，自动 fallback --el-*）。
-->
<template>
  <Teleport to="body">
    <div v-if="store.active" class="tour-root">
      <!-- SVG 遮罩：整屏压暗，有目标时用 evenodd 挖出与高亮同尺寸同圆角的透明区 -->
      <svg v-if="showMask" class="tour-mask-svg" aria-hidden="true">
        <path class="tour-mask-path" :d="maskPath" fill-rule="evenodd" @click="onBlockedClick" />
      </svg>
      <!-- 高亮边框 -->
      <div v-if="rect" class="tour-highlight" :style="highlightStyle" />
      <!-- auto 托管：盖在聚光灯洞上的透明点击护栏，吞掉用户真实点击（引擎合成点击不受影响） -->
      <div v-if="isAuto && rect" class="tour-autoguard" :style="autoGuardStyle"
           @pointerdown.stop.prevent @mousedown.stop.prevent @click.stop.prevent @touchstart.stop.prevent />
      <!-- 提示气泡 -->
      <div v-if="step && !store.waitingTarget && !store.targetLost" ref="popoverRef" class="tour-popover" :style="popoverStyle">
        <div class="tp-head">
          <span class="tp-step-no" :style="{ background: accentColor }">{{ store.stepIndex + 1 }}</span>
          <span v-if="step.gate" class="tp-required">*</span>
          <span class="tp-title">{{ step.title }}</span>
          <span class="tp-of">第 {{ store.stepIndex + 1 }} / {{ store.totalSteps }} 步</span>
        </div>
        <p class="tp-content">{{ step.content }}</p>
        <div v-if="step.tip" class="tp-tip">💡 {{ step.tip }}</div>
        <div v-if="step.warn" class="tp-warn">⚠️ {{ step.warn }}</div>
        <div class="tp-foot">
          <button class="tg-btn tg-btn--link tg-btn--sm" @click="abort()">退出引导</button>
          <!-- auto 托管模式：只有「下一步/完成」，执行 action 期间禁用防连点 -->
          <span v-if="isAuto" class="tp-btns">
            <button class="tg-btn tg-btn--primary tg-btn--sm" :style="{ background: accentColor, borderColor: accentColor }" :disabled="store.autoBusy" @click="next()">
              {{ store.autoBusy ? '执行中…' : (isLast ? '完成' : '下一步') }}
            </button>
          </span>
          <!-- trigger=click：只显示提示文字 -->
          <span v-else-if="step.trigger === 'click'" class="tp-click-hint">
            👆 请点击高亮区域
          </span>
          <!-- 其他步骤：跳过/下一步 -->
          <span v-else-if="store.gatePass" class="tp-btns">
            <button v-if="canSkip" class="tg-btn tg-btn--sm" @click="skip()">跳过此步</button>
            <button class="tg-btn tg-btn--primary tg-btn--sm" :style="{ background: accentColor, borderColor: accentColor }" @click="next()">
              {{ isLast ? '完成' : '下一步' }}
            </button>
          </span>
          <span v-else class="tp-gate">
            <svg class="tp-gate-icon" viewBox="0 0 1024 1024" width="14" height="14" fill="currentColor"><path d="M512 160a96 96 0 0 1 96 96v64H416v-64a96 96 0 0 1 96-96zm0-64a160 160 0 0 0-160 160v64h-32a64 64 0 0 0-64 64v384a64 64 0 0 0 64 64h384a64 64 0 0 0 64-64V384a64 64 0 0 0-64-64h-32v-64A160 160 0 0 0 512 96zM320 448h384v320H320V448z"/></svg>
            {{ step.gateHint || '请先完成本步操作' }}
          </span>
        </div>
      </div>
      <!-- 等待目标 -->
      <div v-if="store.waitingTarget" class="tour-waiting">
        <svg v-if="!store.waitTimedOut" class="tg-spin" viewBox="0 0 1024 1024" width="28" height="28" fill="currentColor"><path d="M512 64a448 448 0 1 1 0 896 448 448 0 0 1 0-896zm0 64a384 384 0 1 0 0 768 384 384 0 0 0 0-768z" opacity=".25"/><path d="M512 64a448 448 0 0 1 448 448h-64A384 384 0 0 0 512 128V64z"/></svg>
        <svg v-else viewBox="0 0 1024 1024" width="28" height="28" fill="#e6a23c"><path d="M512 64L64 896h896L512 64zm0 192l288 576H224l288-576zm-32 224v128h64V480h-64zm0 160v64h64v-64h-64z"/></svg>
        <p>{{ store.waitTimedOut ? '未找到目标元素，可能是页面状态不符' : (step?.content ?? '等待页面加载...') }}</p>
        <button v-if="store.waitTimedOut" class="tg-btn tg-btn--warning tg-btn--sm" @click="next()">跳过此步</button>
        <button class="tg-btn tg-btn--sm" @click="abort()">退出引导</button>
      </div>
      <!-- 依附的目标窗口被意外关闭 → 中断提示。刻意贴在底部且遮罩已收起，用户可直接操作页面重开窗口 -->
      <div v-if="store.targetLost" class="tour-lost">
        <div class="tl-main">
          <svg class="tl-icon" viewBox="0 0 1024 1024" width="22" height="22" fill="var(--tg-warning)"><path d="M512 64L64 896h896L512 64zm0 192l288 576H224l288-576zm-32 224v128h64V480h-64zm0 160v64h64v-64h-64z"/></svg>
          <div class="tl-text">
            <p class="tl-title">引导已中断</p>
            <p class="tl-msg">{{ lostMessage }}</p>
          </div>
          <button class="tg-btn tg-btn--primary tg-btn--sm" :style="{ background: accentColor, borderColor: accentColor }" @click="retryLost()">重试此步</button>
          <button class="tg-btn tg-btn--sm" @click="abort()">退出引导</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from 'vue'
import { tourState, abort, next, skip, retryLost, currentStep } from './store'
import { injectStyles } from './css'
import type { CSSProperties } from 'vue'

injectStyles()

const store = tourState

/** ESC 退出引导 */
function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape' && store.active) abort()
}
watch(() => store.active, (isActive) => {
  if (isActive) window.addEventListener('keydown', onKeydown)
  else window.removeEventListener('keydown', onKeydown)
})
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))

const step = computed(() => currentStep())
const rect = computed(() => store.highlightRect)
const accentColor = computed(() => step.value?.accent ?? store.config?.accent ?? '#409eff')
const isLast = computed(() => store.stepIndex >= store.totalSteps - 1)
/** auto 托管模式：用户只能点「下一步」，页面禁点、引擎代操作 */
const isAuto = computed(() => store.config?.mode === 'auto')
const canSkip = computed(() => {
  const s = step.value
  if (!s) return false
  return !s.gate && s.trigger === 'manual'
})

/** 中断提示文案：区分"窗口已关闭"与"元素被隐藏"两种消失形态 */
const lostMessage = computed(() => {
  const s = step.value
  const where = s ? `第 ${store.stepIndex + 1} 步「${s.title}」` : '当前步骤'
  const cause = store.lostReason === 'hidden' ? '依附的窗口已被隐藏' : '依附的窗口已关闭'
  return `${where}${cause}，请重新打开该窗口后点「重试此步」继续。`
})

// ---------- SVG 遮罩：整屏大矩形 + 圆角洞（evenodd 挖透明区） ----------
const MASK_HOLE_RADIUS = 8
/** 远超视口的巨矩形，靠 SVG overflow:hidden 裁到屏幕 */
const MASK_OUTER = 'M-10000,-10000 h100000 v100000 h-100000 z'

/**
 * 有目标时挖洞；等待目标期间也压整屏遮罩，避免用户点别处把页面状态搞乱。
 * 逃生口：步骤标 `maskWhileWaiting: false`（需要用户点页面元素才能唤醒目标的场景）。
 * 目标意外消失（targetLost）时 waitingTarget 为 false 且无 rect → 自动放行，用户能重开窗口。
 */
const showMask = computed(
  () => !!rect.value || (store.waitingTarget && step.value?.maskWhileWaiting !== false)
)

/** 生成圆角矩形子路径（用于 evenodd 挖洞） */
function roundedRectPath(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2))
  return [
    `M${x + rr},${y}`,
    `h${w - 2 * rr}`,
    `a${rr},${rr} 0 0 1 ${rr},${rr}`,
    `v${h - 2 * rr}`,
    `a${rr},${rr} 0 0 1 -${rr},${rr}`,
    `h${-(w - 2 * rr)}`,
    `a${rr},${rr} 0 0 1 -${rr},${-rr}`,
    `v${-(h - 2 * rr)}`,
    `a${rr},${rr} 0 0 1 ${rr},${-rr}`,
    'z'
  ].join('')
}

const maskPath = computed<string>(() => {
  const r = rect.value
  // 等待态没有目标 → 整屏压暗不挖洞。auto 模式同样挖洞（聚光灯亮出被代操作的控件），
  // 只是禁用户点击改由 .tour-autoguard 透明护栏承担。
  if (!r) return MASK_OUTER
  // evenodd：内层圆角矩形成为透明洞
  const hole = roundedRectPath(r.left, r.top, r.width, r.height, MASK_HOLE_RADIUS)
  return `${MASK_OUTER} ${hole}`
})

// ---------- 高亮框 ----------
const highlightStyle = computed<CSSProperties>(() => {
  const r = rect.value
  if (!r) return { display: 'none' }
  return {
    position: 'fixed', top: `${r.top}px`, left: `${r.left}px`,
    width: `${r.width}px`, height: `${r.height}px`,
    borderRadius: '8px', border: `2px solid ${accentColor.value}`,
    boxShadow: `0 0 0 3px ${accentColor.value}33, 0 0 20px ${accentColor.value}44`,
    // auto 托管模式：聚光灯仍亮，但描边比正常淡一档
    opacity: isAuto.value ? '0.62' : '1',
    pointerEvents: 'none'
  }
})

/** auto 模式：盖在聚光灯洞上的透明点击护栏，吞掉用户真实点击（引擎合成点击不受影响） */
const autoGuardStyle = computed<CSSProperties>(() => {
  const r = rect.value
  if (!r) return { display: 'none' }
  return { position: 'fixed', top: `${r.top}px`, left: `${r.left}px`, width: `${r.width}px`, height: `${r.height}px` }
})

// ---------- Popover 定位（视口感知：实测尺寸 → 放不下翻转对侧 → 仍越界则钳制） ----------
const popoverRef = ref<HTMLElement | null>(null)
/** 气泡实测尺寸；跨步骤保留，避免新步骤首帧定位跳动 */
const popSize = ref({ width: 360, height: 160 })
let popResizeObs: ResizeObserver | null = null

watch(popoverRef, (el) => {
  popResizeObs?.disconnect()
  popResizeObs = null
  if (!el) return
  const measure = () => { popSize.value = { width: el.offsetWidth, height: el.offsetHeight } }
  measure()
  popResizeObs = new ResizeObserver(measure)
  popResizeObs.observe(el)
})
onBeforeUnmount(() => popResizeObs?.disconnect())

/** 气泡与视口边缘的安全距离 */
const POPOVER_EDGE = 8

const popoverStyle = computed<CSSProperties>(() => {
  const r = rect.value
  const placement = step.value?.placement ?? 'bottom'
  const maxW = placement === 'left' || placement === 'right' ? '360px' : '420px'
  if (!r || placement === 'center') {
    return { position: 'fixed', zIndex: 100002, top: '50%', left: '50%', transform: 'translate(-50%,-50%)', maxWidth: '480px' }
  }
  const gap = 14
  const { width: pw, height: ph } = popSize.value
  const vw = window.innerWidth
  const vh = window.innerHeight
  // 各方位的气泡左上角锚点
  const anchors: Record<string, [number, number]> = {
    top: [r.left, r.top - gap - ph],
    bottom: [r.left, r.top + r.height + gap],
    left: [r.left - gap - pw, r.top],
    right: [r.left + r.width + gap, r.top]
  }
  const opposites: Record<string, string> = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' }
  const fits = (l: number, t: number) =>
    l >= POPOVER_EDGE && t >= POPOVER_EDGE && l + pw <= vw - POPOVER_EDGE && t + ph <= vh - POPOVER_EDGE
  let [left, top] = anchors[placement]
  if (!fits(left, top)) {
    // 首选方位越界 → 翻转到对侧（对侧放得下才翻）
    const [fl, ft] = anchors[opposites[placement]]
    if (fits(fl, ft)) { left = fl; top = ft }
  }
  // 兜底：钳制进视口（两侧都放不下时至少保证气泡可见）
  left = Math.min(Math.max(left, POPOVER_EDGE), Math.max(vw - pw - POPOVER_EDGE, POPOVER_EDGE))
  top = Math.min(Math.max(top, POPOVER_EDGE), Math.max(vh - ph - POPOVER_EDGE, POPOVER_EDGE))
  return {
    position: 'fixed', zIndex: 100002,
    top: `${top}px`, left: `${left}px`,
    maxWidth: maxW,
    maxHeight: `calc(100vh - ${POPOVER_EDGE * 2}px)`, overflowY: 'auto'
  }
})

function onBlockedClick(): void { /* 静默拦截 */ }
</script>

