<!--
  引擎状态监视 + 时间线日志
  -----------------------------------------------------------------
  极端场景的判定结果往往只体现在状态机上，光看界面容易误判，
  所以把 tourState 的每个字段和每次跃迁都摊开显示。
-->
<template>
  <div class="lp">
    <div class="lp-state">
      <span class="lp-chip" :class="{ 'is-on': st.active }">active</span>
      <span class="lp-chip" :class="{ 'is-on': st.waiting }">waitingTarget</span>
      <span class="lp-chip" :class="{ 'is-on': st.timedOut }">waitTimedOut</span>
      <span class="lp-chip" :class="{ 'is-on': st.gate }">gatePass</span>
      <span class="lp-chip" :class="{ 'is-on': st.hasRect }">highlight</span>
      <span class="lp-chip lp-chip--bad" :class="{ 'is-on': st.lost }">targetLost{{ st.lost ? `(${st.lost})` : '' }}</span>
      <span class="lp-step">第 {{ st.index + 1 }} / {{ st.total }} 步</span>
    </div>

    <div class="lp-head">
      <span>引导日志</span>
      <el-button link size="small" @click="clearTourLog">清空</el-button>
    </div>
    <div class="lp-list">
      <p v-if="!tourLogEntries.length" class="lp-empty">还没有事件，点任意场景开始。</p>
      <p v-for="(e, i) in tourLogEntries" :key="i" class="lp-item" :class="`k-${e.kind}`">
        <span class="lp-time">{{ e.time }}</span>{{ e.msg }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { tourState } from 'tour-guide-coach'
import { clearTourLog, tourLogEntries } from '../use-tour-log'

const st = computed(() => ({
  active: tourState.active,
  waiting: tourState.waitingTarget,
  timedOut: tourState.waitTimedOut,
  gate: tourState.gatePass,
  hasRect: !!tourState.highlightRect,
  lost: tourState.lostReason,
  index: tourState.stepIndex,
  total: tourState.totalSteps
}))
</script>

<style scoped>
.lp { border: 1px solid #ebeef5; border-radius: 8px; padding: 12px; background: #fafbfc; }
.lp-state { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin-bottom: 10px; }
.lp-chip { font-size: 11px; color: #a8abb2; border: 1px solid #dcdfe6; border-radius: 10px; padding: 1px 8px; background: #fff; font-variant-numeric: tabular-nums; }
.lp-chip.is-on { color: #409eff; border-color: #a0cfff; background: #ecf5ff; }
.lp-chip--bad.is-on { color: #f56c6c; border-color: #fab6b6; background: #fef0f0; }
.lp-step { margin-left: auto; font-size: 12px; color: #909399; font-variant-numeric: tabular-nums; }
.lp-head { display: flex; align-items: center; justify-content: space-between; font-size: 13px; font-weight: 600; color: #303133; margin-bottom: 6px; }
.lp-list { height: 180px; overflow-y: auto; font-size: 12px; line-height: 1.9; }
.lp-empty { color: #c0c4cc; margin: 0; }
.lp-item { margin: 0; color: #606266; word-break: break-all; }
.lp-time { color: #a8abb2; margin-right: 6px; font-variant-numeric: tabular-nums; }
.k-ok { color: #529b2e; }
.k-warn { color: #b88230; }
.k-err { color: #c45656; }
</style>
