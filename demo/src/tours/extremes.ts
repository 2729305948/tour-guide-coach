/**
 * 场景组二：目标不存在 / 视口边界
 * -----------------------------------------------------------------
 * 覆盖等待态、超时兜底、气泡翻转与钳制、超长内容、center 布局。
 */
import type { TourConfig } from 'tour-guide-coach'
import { S } from './selectors'

const LONG_TEXT = [
  '这是一段刻意拉长的说明文字，用来验证气泡的滚动兜底。',
  '引擎给气泡设了 maxHeight = 100vh - 16px 与 overflowY: auto，',
  '因此内容再长也不会把「下一步」按钮顶出屏幕，而是在气泡内部滚动。',
  'Element Plus 的 el-select / el-date-picker / el-cascader 面板通过 Teleport',
  '渲染到 body 末尾，不在原组件 DOM 树内，需要 expandSelector 把它们并入高亮区。',
  '同一时刻若页面里存在多个弹层，querySelector 只会返回第一个匹配节点，',
  '所以引擎取「第一个 offsetHeight > 0 的可见元素」作为扩展目标。',
  '继续往下滚还能看到：贴边目标会让首选方位越界，引擎会翻转到对侧；',
  '两侧都放不下时，退化为把气泡钳制进视口，保证按钮永远点得到。',
  '这就是为什么引导在小屏（1366×768）和竖屏上也不会跑偏。'
].join('')

/** ⑤ 目标延迟出现 → 等待态，元素一冒头自动挂载 */
export const lazyTargetTour: TourConfig = {
  key: 'lazy-target',
  name: '目标延迟出现 → 等待后自动挂载',
  accent: '#e6a23c',
  steps: [
    {
      id: 'wait-me',
      target: S.lazyTarget,
      placement: 'center',
      title: '目标还没渲染出来',
      content: '这一步的高亮目标默认不存在。\n点页面顶部的「生成目标元素」按钮，它出现的瞬间引擎会自动挂载。',
      trigger: 'manual',
      // 逃生口：要点页面元素才能唤醒目标，压住遮罩就永远等不到
      maskWhileWaiting: false,
      tip: '默认情况下等待期是压全屏遮罩的，本步特意用 maskWhileWaiting: false 放行。'
    },
    {
      id: 'after',
      target: S.createBtn,
      placement: 'bottom',
      title: '续上了',
      content: '说明等待态 → 就绪态的切换是自动的，不需要重启引导。',
      trigger: 'manual'
    }
  ]
}

/** ⑥ 目标永远不存在 → 12s 超时兜底（不自动跳步） */
export const ghostTargetTour: TourConfig = {
  key: 'ghost-target',
  name: '目标永不存在 → 超时兜底',
  accent: '#909399',
  steps: [
    {
      id: 'ghost',
      target: S.ghost,
      placement: 'center',
      title: '这个目标永远不会出现',
      content: '等 12 秒看兜底行为：期间整屏压暗（默认遮罩策略），超时后不自动跳步，而是给出「跳过此步 / 退出引导」让用户决定。',
      trigger: 'manual'
    },
    {
      id: 'after',
      target: S.createBtn,
      placement: 'bottom',
      title: '被跳过后的世界',
      content: '如果你点了「跳过此步」，会正常推进到这里。',
      trigger: 'manual'
    }
  ]
}

/** ⑦ 视口边界：贴边目标 + 超长内容 + center */
export const viewportEdgeTour: TourConfig = {
  key: 'viewport-edge',
  name: '贴边翻转 / 钳制 / 超长内容',
  accent: '#7c3aed',
  steps: [
    {
      id: 'top',
      target: S.edgeTop,
      placement: 'top',
      title: '贴顶 + 要求气泡在上方',
      content: '首选方位必然越界 → 引擎翻转到下方（bottom）。',
      trigger: 'manual'
    },
    {
      id: 'right',
      target: S.edgeRight,
      placement: 'right',
      title: '贴右 + 要求气泡在右侧',
      content: '右侧放不下 → 翻转到左侧。',
      trigger: 'manual'
    },
    {
      id: 'bottom',
      target: S.edgeBottom,
      placement: 'bottom',
      title: '贴底 + 要求气泡在下方',
      content: '下方放不下 → 翻转到上方。',
      trigger: 'manual'
    },
    {
      id: 'left',
      target: S.edgeLeft,
      placement: 'left',
      title: '贴左 + 要求气泡在左侧',
      content: '左侧放不下 → 翻转到右侧。',
      trigger: 'manual'
    },
    {
      id: 'long',
      target: S.edgeLeft,
      placement: 'right',
      title: '超长内容',
      content: LONG_TEXT,
      trigger: 'manual',
      tip: '气泡内部滚动，底部按钮始终可见。'
    },
    {
      id: 'center',
      target: S.createBtn,
      placement: 'center',
      title: 'center 布局',
      content: '不锚定目标，气泡居中——适合纯阅读型步骤。',
      trigger: 'manual'
    }
  ]
}
