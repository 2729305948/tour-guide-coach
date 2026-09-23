<!--
  漫游式引导 · 全局蒙版组件（零 UI 库依赖）
  -----------------------------------------------------------------
  样式沿用 Element Plus 设计语言（色彩、圆角、字号），但不依赖任何组件库。
  原生 <button> + 内联 SVG + CSS 变量（--tg-* 前缀，自动 fallback --el-*）。
-->
<template>
  <Teleport to="body">
    <div v-if="store.active" class="tour-root">
      <!-- 4 块遮罩矩形 -->
      <div class="tour-mask" :style="maskTop" @click="onBlockedClick" />
      <div class="tour-mask" :style="maskBottom" @click="onBlockedClick" />
      <div class="tour-mask" :style="maskLeft" @click="onBlockedClick" />
      <div class="tour-mask" :style="maskRight" @click="onBlockedClick" />
      <!-- 高亮边框 -->
      <div v-if="rect" class="tour-highlight" :style="highlightStyle" />
      <!-- 提示气泡 -->
      <div v-if="step && !store.waitingTarget" class="tour-popover" :style="popoverStyle">
        <div class="tp-head">
          <span class="tp-step-no" :style="{ background: accentColor }">{{ store.stepIndex + 1 }}</span>
          <span v-if="step.gate" class="tp-required">*</span>
          <span class="tp-title">{{ step.title }}</span>
          <span class="tp-of">/ {{ store.totalSteps }}</span>
        </div>
        <p class="tp-content">{{ step.content }}</p>
        <div v-if="step.tip" class="tp-tip">💡 {{ step.tip }}</div>
        <div v-if="step.warn" class="tp-warn">⚠️ {{ step.warn }}</div>
        <div class="tp-foot">
          <button class="tg-btn tg-btn--link tg-btn--sm" @click="abort()">退出引导</button>
          <!-- trigger=click：只显示提示文字 -->
          <span v-if="step.trigger === 'click'" class="tp-click-hint">
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
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, watch, onBeforeUnmount } from 'vue'
import { tourState, abort, next, skip } from './store'
import type { CSSProperties } from 'vue'

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

const step = computed(() => store.currentStep())
const rect = computed(() => store.highlightRect)
const accentColor = computed(() => step.value?.accent ?? store.config?.accent ?? '#409eff')
const isLast = computed(() => store.stepIndex >= store.totalSteps - 1)
const canSkip = computed(() => {
  const s = step.value
  if (!s) return false
  return !s.gate && s.trigger === 'manual'
})

// ---------- 蒙版 4 块定位 ----------
function calcMasks() {
  const r = rect.value
  if (!r) return null
  return {
    top: { left: 0, top: 0, width: '100vw', height: `${Math.max(r.top, 0)}px` },
    bottom: { left: 0, top: `${r.top + r.height}px`, width: '100vw', height: `calc(100vh - ${r.top + r.height}px)` },
    left: { left: 0, top: `${r.top}px`, width: `${Math.max(r.left, 0)}px`, height: `${r.height}px` },
    right: { left: `${r.left + r.width}px`, top: `${r.top}px`, width: `calc(100vw - ${r.left + r.width}px)`, height: `${r.height}px` }
  }
}
const masks = computed(calcMasks)
const maskTop = computed<CSSProperties>(() => masks.value?.top ?? { display: 'none' })
const maskBottom = computed<CSSProperties>(() => masks.value?.bottom ?? { display: 'none' })
const maskLeft = computed<CSSProperties>(() => masks.value?.left ?? { display: 'none' })
const maskRight = computed<CSSProperties>(() => masks.value?.right ?? { display: 'none' })

// ---------- 高亮框 ----------
const highlightStyle = computed<CSSProperties>(() => {
  const r = rect.value
  if (!r) return { display: 'none' }
  return {
    position: 'fixed', top: `${r.top}px`, left: `${r.left}px`,
    width: `${r.width}px`, height: `${r.height}px`,
    borderRadius: '8px', border: `2px solid ${accentColor.value}`,
    boxShadow: `0 0 0 3px ${accentColor.value}33, 0 0 20px ${accentColor.value}44`,
    pointerEvents: 'none', transition: 'all 0.35s cubic-bezier(0.4,0,0.2,1)'
  }
})

// ---------- Popover 定位 ----------
const popoverStyle = computed<CSSProperties>(() => {
  const r = rect.value
  if (!r) return { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }
  const placement = step.value?.placement ?? 'bottom'
  const gap = 14
  const base: CSSProperties = { position: 'fixed', zIndex: 100002 }
  switch (placement) {
    case 'top': return { ...base, left: `${r.left}px`, bottom: `calc(100vh - ${r.top - gap}px)`, maxWidth: '420px' }
    case 'bottom': return { ...base, left: `${r.left}px`, top: `${r.top + r.height + gap}px`, maxWidth: '420px' }
    case 'left': return { ...base, right: `calc(100vw - ${r.left - gap}px)`, top: `${r.top}px`, maxWidth: '360px' }
    case 'right': return { ...base, left: `${r.left + r.width + gap}px`, top: `${r.top}px`, maxWidth: '360px' }
    default: return { ...base, top: '50%', left: '50%', transform: 'translate(-50%,-50%)', maxWidth: '480px' }
  }
})

function onBlockedClick(): void { /* 静默拦截 */ }
</script>

<style scoped>
/* ---------- CSS 变量：自动 fallback 到 --el-*（兼容 EP 项目） ---------- */
.tour-root {
  --tg-primary: var(--el-color-primary, #409eff);
  --tg-success: var(--el-color-success, #67c23a);
  --tg-warning: var(--el-color-warning, #e6a23c);
  --tg-danger: var(--el-color-danger, #f56c6c);
  --tg-text-1: var(--el-text-color-primary, #303133);
  --tg-text-2: var(--el-text-color-regular, #606266);
  --tg-text-3: var(--el-text-color-secondary, #909399);
  --tg-border: var(--el-border-color-lighter, #ebeef5);
  --tg-fill-light: var(--el-fill-color-light, #f5f7fa);
  --tg-radius: var(--el-border-radius-base, 4px);

  position: fixed; inset: 0; z-index: 100000;
  pointer-events: none;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
}

/* ---------- 遮罩 ---------- */
.tour-mask {
  position: fixed; background: rgba(0,0,0,0.55);
  transition: all 0.35s cubic-bezier(0.4,0,0.2,1);
  cursor: not-allowed; pointer-events: auto;
}

/* ---------- 高亮框 ---------- */
.tour-highlight { z-index: 100001; }

/* ---------- 按钮（EP 风格） ---------- */
.tg-btn {
  display: inline-flex; align-items: center; justify-content: center;
  border: 1px solid var(--tg-border); border-radius: var(--tg-radius);
  background: #fff; color: var(--tg-text-2);
  font-size: 14px; font-weight: 500; line-height: 1;
  padding: 8px 15px; cursor: pointer;
  transition: color .2s, border-color .2s, background .2s;
  outline: none; white-space: nowrap; user-select: none;
}
.tg-btn:hover { color: var(--tg-primary); border-color: var(--tg-primary); background: #ecf5ff; }
.tg-btn--sm { padding: 5px 11px; font-size: 12px; }
.tg-btn--primary {
  background: var(--tg-primary); border-color: var(--tg-primary); color: #fff;
}
.tg-btn--primary:hover { opacity: .85; background: var(--tg-primary); color: #fff; }
.tg-btn--warning {
  background: var(--tg-warning); border-color: var(--tg-warning); color: #fff;
}
.tg-btn--warning:hover { opacity: .85; background: var(--tg-warning); color: #fff; }
.tg-btn--link {
  border: none; background: none; padding: 4px 6px;
  color: var(--tg-text-3);
}
.tg-btn--link:hover { color: var(--tg-primary); background: none; }

/* ---------- 气泡 ---------- */
.tour-popover {
  z-index: 100002; background: #fff; border-radius: 12px;
  padding: 16px 18px; box-shadow: 0 8px 32px rgba(0,0,0,0.18);
  animation: tp-in 0.3s ease; pointer-events: auto;
}
@keyframes tp-in {
  from { opacity: 0; transform: translateY(6px) scale(0.97); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
.tp-head { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.tp-step-no {
  display: inline-flex; align-items: center; justify-content: center;
  width: 22px; height: 22px; border-radius: 50%;
  color: #fff; font-size: 12px; font-weight: 700; flex-shrink: 0;
}
.tp-required { color: var(--tg-danger); font-size: 18px; font-weight: 700; line-height: 1; margin-right: -4px; }
.tp-title { font-size: 15px; font-weight: 600; color: var(--tg-text-1); }
.tp-of { font-size: 12px; color: var(--tg-text-3); margin-left: auto; }
.tp-content { margin: 0 0 10px; font-size: 13px; line-height: 1.7; color: var(--tg-text-2); white-space: pre-line; }
.tp-tip { font-size: 12px; color: #529b2e; background: #f0f9eb; padding: 6px 10px; border-radius: 6px; margin-bottom: 8px; }
.tp-warn { font-size: 12px; color: #b88230; background: #fdf6ec; padding: 6px 10px; border-radius: 6px; margin-bottom: 8px; }
.tp-foot { display: flex; align-items: center; justify-content: space-between; padding-top: 10px; border-top: 1px solid #f0f0f0; }
.tp-btns { display: flex; gap: 8px; }
.tp-gate { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; color: var(--tg-warning); }
.tp-gate-icon { flex-shrink: 0; }
.tp-click-hint { font-size: 13px; color: var(--tg-primary); font-weight: 500; animation: pulse-hint 1.5s ease-in-out infinite; }
@keyframes pulse-hint { 0%,100%{opacity:1} 50%{opacity:.5} }

/* ---------- 等待态 ---------- */
.tour-waiting {
  position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%);
  z-index: 100002; background: #fff; padding: 32px 40px;
  border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.15);
  text-align: center; pointer-events: auto;
  display: flex; flex-direction: column; align-items: center; gap: 8px;
}
.tour-waiting p { margin: 4px 0 8px; font-size: 14px; color: var(--tg-text-2); }
.tg-spin { animation: tg-rotate 1s linear infinite; }
@keyframes tg-rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
</style>
