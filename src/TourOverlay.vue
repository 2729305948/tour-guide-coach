<!--
  漫游式引导 · 全局蒙版组件
  -----------------------------------------------------------------
  挂载在 App layout 根节点（Teleport to body），z-index 高于 el-dialog。
  三层结构：
    1. 蒙版遮罩（4 块矩形围绕高亮区域，形成"挖洞"效果）
    2. 高亮边框（跟随目标元素 rect，transition 动画）
    3. 提示气泡（popover 卡片，展示步骤标题/正文/按钮）

  交互：
    - 蒙版拦截点击（outside 区域不可操作）
    - 高亮区域 pointer-events:none → 用户可点击/输入目标元素
    - gate 未通过时「下一步」disabled + 显示 gateHint
-->
<template>
  <Teleport to="body">
    <div v-if="store.active" class="tour-root">
      <!-- 4 块遮罩矩形：上、下、左、右（中间留空=高亮区域可交互） -->
      <div class="tour-mask tour-mask--top" :style="maskTop" @click="onBlockedClick" />
      <div class="tour-mask tour-mask--bottom" :style="maskBottom" @click="onBlockedClick" />
      <div class="tour-mask tour-mask--left" :style="maskLeft" @click="onBlockedClick" />
      <div class="tour-mask tour-mask--right" :style="maskRight" @click="onBlockedClick" />
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
          <el-button link size="small" @click="store.abort()">退出引导</el-button>
          <!-- trigger=click 的步骤：只显示提示文字，不显示下一步按钮 -->
          <span v-if="step.trigger === 'click'" class="tp-click-hint">
            👆 请点击高亮区域
          </span>
          <!-- 其他步骤：显示跳过/下一步按钮 -->
          <span v-else-if="store.gatePass" class="tp-btns">
            <el-button size="small" @click="store.skip()" v-if="canSkip">跳过此步</el-button>
            <el-button type="primary" size="small" :style="{ background: accentColor, borderColor: accentColor }" @click="store.next()">
              {{ isLast ? '完成' : '下一步' }}
            </el-button>
          </span>
          <span v-else class="tp-gate">
            <el-icon class="tp-gate-icon"><Lock /></el-icon>
            {{ step.gateHint || '请先完成本步操作' }}
          </span>
        </div>
      </div>
      <!-- 等待目标出现时的居中提示（含超时跳过选项） -->
      <div v-if="store.waitingTarget" class="tour-waiting">
        <el-icon v-if="!store.waitTimedOut" class="is-loading" :size="28"><Loading /></el-icon>
        <el-icon v-else :size="28" color="#e6a23c"><WarningFilled /></el-icon>
        <p>{{ store.waitTimedOut ? '未找到目标元素，可能是页面状态不符' : (step?.content ?? '等待页面加载...') }}</p>
        <el-button v-if="store.waitTimedOut" size="small" type="warning" @click="store.next()">跳过此步</el-button>
        <el-button size="small" @click="store.abort()">退出引导</el-button>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, watch, onBeforeUnmount } from 'vue'
import { Loading, Lock, WarningFilled } from '@element-plus/icons-vue'
import { useTourStore } from './store'
import type { CSSProperties } from 'vue'

const store = useTourStore()

/** ESC 退出引导（宿主页面可通过 watch store.active 感知并跳转） */
function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape' && store.active) {
    store.abort()
  }
}
watch(() => store.active, (isActive) => {
  if (isActive) {
    window.addEventListener('keydown', onKeydown)
  } else {
    window.removeEventListener('keydown', onKeydown)
  }
})
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
const step = computed(() => store.currentStep())
const rect = computed(() => store.highlightRect)
const accentColor = computed(() => step.value?.accent ?? store.config?.accent ?? '#409eff')
const isLast = computed(() => store.stepIndex >= store.totalSteps - 1)
const canSkip = computed(() => {
  const s = step.value
  if (!s) return false
  // 有 gate 的步骤不允许跳过（必须填完）
  return !s.gate && s.trigger === 'manual'
})

// ---------- 蒙版 4 块定位 ----------
const vw = '100vw'
const vh = '100vh'
function calcMasks() {
  const r = rect.value
  if (!r) return null
  return {
    top: { left: 0, top: 0, width: vw, height: `${Math.max(r.top, 0)}px` },
    bottom: { left: 0, top: `${r.top + r.height}px`, width: vw, height: `calc(${vh} - ${r.top + r.height}px)` },
    left: { left: 0, top: `${r.top}px`, width: `${Math.max(r.left, 0)}px`, height: `${r.height}px` },
    right: { left: `${r.left + r.width}px`, top: `${r.top}px`, width: `calc(${vw} - ${r.left + r.width}px)`, height: `${r.height}px` }
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
    position: 'fixed',
    top: `${r.top}px`,
    left: `${r.left}px`,
    width: `${r.width}px`,
    height: `${r.height}px`,
    borderRadius: '8px',
    border: `2px solid ${accentColor.value}`,
    boxShadow: `0 0 0 3px ${accentColor.value}33, 0 0 20px ${accentColor.value}44`,
    pointerEvents: 'none',
    transition: 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)'
  }
})

// ---------- Popover 定位 ----------
const popoverStyle = computed<CSSProperties>(() => {
  const r = rect.value
  if (!r) return { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
  const placement = step.value?.placement ?? 'bottom'
  const gap = 14
  const base: CSSProperties = { position: 'fixed', zIndex: 100002 }
  switch (placement) {
    case 'top':
      return { ...base, left: `${r.left}px`, bottom: `calc(100vh - ${r.top - gap}px)`, maxWidth: '420px' }
    case 'bottom':
      return { ...base, left: `${r.left}px`, top: `${r.top + r.height + gap}px`, maxWidth: '420px' }
    case 'left':
      return { ...base, right: `calc(100vw - ${r.left - gap}px)`, top: `${r.top}px`, maxWidth: '360px' }
    case 'right':
      return { ...base, left: `${r.left + r.width + gap}px`, top: `${r.top}px`, maxWidth: '360px' }
    case 'center':
    default:
      return { ...base, top: '50%', left: '50%', transform: 'translate(-50%, -50%)', maxWidth: '480px' }
  }
})

function onBlockedClick(): void {
  // 可选：轻震动动画 or tooltip 提示"请点击高亮区域"
  // 暂不做处理，静默拦截
}
</script>

<style scoped>
.tour-root {
  position: fixed;
  inset: 0;
  z-index: 100000;
  pointer-events: none; /* 根容器不拦截点击 */
}

.tour-mask {
  position: fixed;
  background: rgba(0, 0, 0, 0.55);
  transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: not-allowed;
  pointer-events: auto; /* 遮罩块拦截点击 */
}

.tour-highlight {
  z-index: 100001;
}

.tour-popover {
  z-index: 100002;
  background: #fff;
  border-radius: 12px;
  padding: 16px 18px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18);
  animation: tp-in 0.3s ease;
  pointer-events: auto; /* 气泡内按钮可点击 */
}

@keyframes tp-in {
  from { opacity: 0; transform: translateY(6px) scale(0.97); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

.tp-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.tp-step-no {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
}
.tp-title {
  font-size: 15px;
  font-weight: 600;
  color: #1d1d1f;
}
.tp-required {
  color: #f56c6c;
  font-size: 18px;
  font-weight: 700;
  line-height: 1;
  margin-right: -4px;
}
.tp-of {
  font-size: 12px;
  color: #999;
  margin-left: auto;
}
.tp-content {
  margin: 0 0 10px;
  font-size: 13px;
  line-height: 1.7;
  color: #555;
  white-space: pre-line;
}
.tp-tip {
  font-size: 12px;
  color: #529b2e;
  background: #f0f9eb;
  padding: 6px 10px;
  border-radius: 6px;
  margin-bottom: 8px;
}
.tp-warn {
  font-size: 12px;
  color: #b88230;
  background: #fdf6ec;
  padding: 6px 10px;
  border-radius: 6px;
  margin-bottom: 8px;
}
.tp-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 10px;
  border-top: 1px solid #f0f0f0;
}
.tp-btns {
  display: flex;
  gap: 8px;
}
.tp-gate {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #e6a23c;
}
.tp-gate-icon {
  font-size: 14px;
}
.tp-click-hint {
  font-size: 13px;
  color: var(--el-color-primary);
  font-weight: 500;
  animation: pulse-hint 1.5s ease-in-out infinite;
}
@keyframes pulse-hint {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.tour-waiting {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 100002;
  background: #fff;
  padding: 32px 40px;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
  text-align: center;
  pointer-events: auto;
}
.tour-waiting p {
  margin: 12px 0 0;
  font-size: 14px;
  color: #666;
}
</style>
