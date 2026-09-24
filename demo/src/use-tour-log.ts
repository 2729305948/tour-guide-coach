/**
 * demo 的引导日志：把引擎状态机的每一次跃迁变成可读的时间线
 * -----------------------------------------------------------------
 * 极端场景光看界面很难判断"到底是判对了还是没触发"，所以：
 *   1. watch tourState 关键字段 → 自动记录状态跃迁
 *   2. 场景配置里的 onTargetLost / beforeEnter 等钩子也能主动写日志
 */
import { ref, watch } from 'vue'
import { tourState } from 'tour-guide-coach'

export type LogKind = 'info' | 'ok' | 'warn' | 'err'

export interface LogEntry {
  /** 时间 HH:mm:ss */
  time: string
  msg: string
  kind: LogKind
}

export const tourLogEntries = ref<LogEntry[]>([])

export function tourLog(msg: string, kind: LogKind = 'info'): void {
  const time = new Date().toLocaleTimeString('zh-CN', { hour12: false })
  tourLogEntries.value.unshift({ time, msg, kind })
  if (tourLogEntries.value.length > 60) tourLogEntries.value.pop()
}

export function clearTourLog(): void {
  tourLogEntries.value = []
}

/** 启动状态机监听（App 挂载时调用一次） */
export function watchTourState(): void {
  let prev = snapshot()
  watch(
    () => snapshot(),
    (cur) => {
      if (cur.active && !prev.active) tourLog('▶ 引导启动', 'ok')
      if (!cur.active && prev.active) tourLog('■ 引导已卸载', 'info')
      if (cur.stepIndex !== prev.stepIndex && cur.active) {
        tourLog(`进入第 ${cur.stepIndex + 1}/${cur.total} 步${cur.lost ? '（从中断恢复）' : ''}`, 'info')
      }
      if (cur.waiting && !prev.waiting) tourLog('目标未就绪 → 进入等待态', 'warn')
      if (!cur.waiting && prev.waiting && cur.active) tourLog('目标已挂载，高亮就位', 'ok')
      if (cur.timedOut && !prev.timedOut) tourLog('⏱ 等待超时（12s），不自动跳步', 'err')
      if (cur.gate && !prev.gate) tourLog('✓ 门控通过，「下一步」解锁', 'ok')
      if (cur.lost && !prev.lost) tourLog(`⚠ 判定意外关闭 → 中断（reason=${cur.lost}）`, 'err')
      if (!cur.lost && prev.lost) tourLog('中断已解除', 'info')
      prev = cur
    },
    { deep: false }
  )
}

function snapshot() {
  return {
    active: tourState.active,
    stepIndex: tourState.stepIndex,
    total: tourState.totalSteps,
    waiting: tourState.waitingTarget,
    timedOut: tourState.waitTimedOut,
    gate: tourState.gatePass,
    lost: tourState.lostReason
  }
}
