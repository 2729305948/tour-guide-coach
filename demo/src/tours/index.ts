/**
 * demo 场景清单
 * -----------------------------------------------------------------
 * 每条都标注「要观察什么」，方便肉眼判断引擎行为是否正确。
 */
import type { TourConfig } from 'tour-guide-coach'
import { demoFormTour } from '../../../src/configs/demo-form'
import { gatePassedTour, lostThenRetryTour, swapDialogTour } from './lost-target'
import { ghostTargetTour, lazyTargetTour, viewportEdgeTour } from './extremes'
import { fullFlowTour, multiPopperTour, scrollRebuildTour } from './robustness'
import { autoModeTour } from './auto-mode'

export interface Scenario {
  /** 分组：表单流程 / 关窗判定 / 边界兜底 / 鲁棒性 */
  group: string
  config: TourConfig
  /** 演示要点 */
  focus: string
  /** 预期观察点（判断对错的依据） */
  expect: string
  /** 需要预先满足的前置条件提示 */
  pre?: string
}

export const scenarios: Scenario[] = [
  {
    group: '表单流程',
    config: demoFormTour,
    focus: 'click + afterClickWait / input gate / change gate / expandSelector',
    expect: '下拉与日历面板被并入洞口；gate 未过时「下一步」锁住并显示 gateHint。'
  },
  {
    group: '表单流程',
    config: fullFlowTour,
    focus: '9 步长流程：异步 beforeEnter → 页面 → 弹窗 A → 弹窗 B → 提交',
    expect: '跨两个弹窗连续推步不断链；完成回调触发提示。'
  },
  {
    group: '关窗判定',
    config: lostThenRetryTour,
    focus: '本步未完成就关掉依附窗口',
    expect: '收起遮罩洞 + 底部中断面板 + 宿主回调；重开弹窗点「重试此步」自动续上。',
    pre: '按提示故意点弹窗右上角 × 关闭'
  },
  {
    group: '关窗判定',
    config: gatePassedTour,
    focus: '门控已通过后关窗（用户直接点保存）',
    expect: '判为正常流转：静默自动推进，不弹中断、不触发回调。'
  },
  {
    group: '关窗判定',
    config: swapDialogTour,
    focus: '点一下关掉当前弹窗并打开另一个弹窗',
    expect: '高亮跨弹窗迁移到 B 内目标，全程无中断提示。'
  },
  {
    group: '边界兜底',
    config: lazyTargetTour,
    focus: '目标延迟出现 + 等待期放行页面',
    expect: '等待态 spinner → 点「生成目标元素」后瞬间自动挂载；本步用 maskWhileWaiting:false 才点得到按钮。',
    pre: '需要手动点页面上的「生成目标元素」'
  },
  {
    group: '边界兜底',
    config: ghostTargetTour,
    focus: '目标永远不存在（等待期整屏压暗）',
    expect: '等待时全屏遮罩挡住误操作；12s 后超时只给「跳过此步 / 退出引导」，不自动跳步（坑 #5）。',
    pre: '这一条需要等 12 秒'
  },
  {
    group: '边界兜底',
    config: viewportEdgeTour,
    focus: '四个贴边目标 + 超长内容 + center',
    expect: '首选方位越界时自动翻转到对侧；长内容气泡内滚动，按钮不被顶出屏幕。'
  },
  {
    group: '鲁棒性',
    config: scrollRebuildTour,
    focus: '自动滚动到高亮 + 滚动跟随 + destroy-on-close 重建 DOM',
    expect: '视口外目标被自动滚进视野中央；随后手动滚动时洞口与高亮实时跟随；弹窗关闭重开后仍能挂到全新节点。',
    pre: '右上角可关掉「自动滚动到高亮」做对照'
  },
  {
    group: '鲁棒性',
    config: multiPopperTour,
    focus: 'body 末尾同时存在多个下拉面板',
    expect: 'expandSelector 取第一个可见面板，不会被 display:none 的残留面板带偏。'
  },
  {
    group: '托管模式',
    config: autoModeTour,
    focus: 'mode:auto —— 用户只点「下一步」，引擎代点/代填/代选',
    expect: '页面被全屏遮罩禁点，只能点引导按钮；每点一次「下一步」引擎自动完成该步操作（点按钮/填名称/选分类/提交），执行期间按钮显示「执行中…」并禁用。'
  }
]
