/**
 * 场景组一：依附窗口被关闭（引擎存活检测的三种分流）
 * -----------------------------------------------------------------
 * 关键区分：同样是"目标不见了"，
 *   正常流转 → 本步 gate 已通过 / trigger=click 已触发，引擎自动推进，不打扰用户
 *   意外关闭 → 本步还没做完窗口就没了，收起遮罩 + 中断面板 + onTargetLost 回调
 */
import type { TourConfig } from 'tour-guide-coach'
import { S, hasAnyChecked, hasCategory } from './selectors'
import { tourLog } from '../use-tour-log'

/** 关窗后统一的中断回调（演示宿主侧打点 / 二次提示） */
function onTargetLost({ stepIndex, title, reason }: { stepIndex: number; title: string; reason: string }): void {
  tourLog(`宿主收到回调：第 ${stepIndex + 1} 步「${title}」目标 ${reason === 'hidden' ? '被隐藏' : '已移除'}`, 'err')
}

/** ① 意外关窗 → 中断 → 重开窗口点「重试此步」自动续上 */
export const lostThenRetryTour: TourConfig = {
  key: 'lost-retry',
  name: '意外关窗 → 中断 → 重试续上',
  accent: '#f56c6c',
  onTargetLost,
  steps: [
    {
      id: 'open',
      target: S.createBtn,
      placement: 'bottom',
      title: '打开表单弹窗',
      content: '这一步正常挂载高亮。',
      trigger: 'click',
      afterClickWait: S.categorySelect,
      clickDelay: 400
    },
    {
      id: 'must-close',
      target: S.categorySelect,
      placement: 'right',
      title: '故意把窗口关掉',
      content: '不要选分类，直接点弹窗右上角的 ×（或按 ESC、点灰色遮罩）。\n'
        + '目标依附的窗口没了 → 引擎应判定为「意外关闭」而不是卡死。',
      trigger: 'manual',
      gate: hasCategory,
      gateHint: '本步故意不让你通过：请先关窗',
      warn: '关窗后遮罩洞会收起，页面重新可操作，这是为了让你能重开弹窗。'
    },
    {
      id: 'pick',
      target: S.categorySelect,
      autoExpand: true,
      placement: 'right',
      title: '重开弹窗后继续',
      content: '能看到这一步，说明中断后已成功续上。选个分类再点下一步。',
      trigger: 'change',
      gate: hasCategory,
      gateHint: '请选择一个分类'
    },
    {
      id: 'submit',
      target: S.dialogConfirm,
      placement: 'top',
      title: '提交',
      content: '点「确定」收尾。',
      trigger: 'click',
      clickDelay: 400
    }
  ]
}

/** ② gate 已过 + 直接点确定关窗 → 正常流转，自动推进（不得误判为中断） */
export const gatePassedTour: TourConfig = {
  key: 'gate-passed',
  name: '门控已过 + 关窗 → 自动推进（不误判）',
  accent: '#67c23a',
  onTargetLost,
  steps: [
    {
      id: 'open',
      target: S.createBtn,
      placement: 'bottom',
      title: '打开表单弹窗',
      content: '点按钮开弹窗。',
      trigger: 'click',
      afterClickWait: S.categorySelect,
      clickDelay: 400
    },
    {
      id: 'pick-then-save',
      target: S.categorySelect,
      autoExpand: true,
      placement: 'right',
      title: '选完分类，直接点「确定」',
      content: '选好分类后不要点「下一步」，直接点弹窗底部的「确定」（它会关闭弹窗）。\n'
        + '本步门控已通过 → 目标消失属于正常流转，引擎应静默推进到下一步。',
      trigger: 'manual',
      gate: hasCategory,
      gateHint: '先选一个分类',
      tip: '日志里应出现「✓ 门控通过」，且不会出现「判定意外关闭」。'
    },
    {
      id: 'back-on-page',
      target: S.createBtn,
      placement: 'bottom',
      title: '回到页面，引导没断',
      content: '弹窗已关闭，高亮自动落回页面按钮上——没有被误判为中断。',
      trigger: 'manual'
    }
  ]
}

/** ③ 点一下关掉当前弹窗、打开另一个弹窗 → 高亮跨窗口迁移 */
export const swapDialogTour: TourConfig = {
  key: 'swap-dialog',
  name: '点 A 开 B（跨弹窗迁移）',
  accent: '#409eff',
  onTargetLost,
  steps: [
    {
      id: 'open',
      target: S.createBtn,
      placement: 'bottom',
      title: '打开表单弹窗',
      content: '点按钮开弹窗 A。',
      trigger: 'click',
      afterClickWait: S.openClassBtn,
      clickDelay: 400
    },
    {
      id: 'to-b',
      target: S.openClassBtn,
      placement: 'top',
      title: '点它会关 A 开 B',
      content: '点击「选择目标班级」：弹窗 A 关闭、弹窗 B 打开，高亮要跟着迁移到 B 内的多选组。\n'
        + '这类"自己关自己"的消失是正常流转，不该弹中断。',
      trigger: 'click',
      afterClickWait: S.classGroup,
      clickDelay: 400
    },
    {
      id: 'pick-class',
      target: S.classGroup,
      placement: 'left',
      title: '勾选班级',
      content: '至少勾一个。',
      trigger: 'change',
      gate: (resolve) => hasAnyChecked(resolve, S.classGroup),
      gateHint: '请至少勾选一个班级'
    },
    {
      id: 'confirm',
      target: S.classConfirm,
      placement: 'top',
      title: '确认',
      content: '点「确认选择」收尾（B 关闭，A 仍在）。',
      trigger: 'click',
      clickDelay: 400
    }
  ]
}
