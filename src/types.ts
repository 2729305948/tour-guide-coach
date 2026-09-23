/**
 * 漫游式引导引擎 · 类型定义
 * -----------------------------------------------------------------
 * 交互式引导：蒙版 + 元素高亮 + 事件驱动推步（用户真实操作才推进）。
 *
 * StepTrigger 语义：
 *   click       — 用户点击高亮元素后自动前进
 *   input       — 高亮的输入框值满足 condition 后前进（如非空）
 *   change      — 高亮元素的值变化后前进（select / tree-select）
 *   wait-dom    — 等待 waitForElement 选择器匹配到 DOM 节点（弹窗出现、路由切换）
 *   auto        — 自动前进（延时后，用于页面跳转/加载过渡）
 *   manual      — 显示"下一步"按钮，用户手动推进（信息展示步骤）
 */

/** 弹窗提示框相对高亮区域的弹出方位 */
export type PopPlacement = 'top' | 'bottom' | 'left' | 'right' | 'center'

/** 引导步骤 */
export interface TourStep {
  /** 步骤唯一 ID（config 内不重复） */
  id: string
  /** 高亮目标 CSS 选择器（`[data-tour="xxx"]`、`#tab-tasks` 等） */
  target: string
  /** 动态扩展选择器：当该选择器匹配的元素可见时，高亮区域扩展为 target + expand 联合矩形。
   *  典型场景：el-select 展开后 popper teleport 到 body，需要把下拉面板纳入可交互区域。 */
  expandSelector?: string
  /** 弹窗提示框弹出方位 */
  placement?: PopPlacement
  /** 步骤标题 */
  title: string
  /** 步骤正文（支持 \n 换行） */
  content: string
  /** 推进触发方式 */
  trigger: StepTrigger
  /** 推进门控条件（trigger=input/change 时，引擎轮询检查；返回 true 才解锁"下一步"）。
   *  参数 resolve 是宿主提供的元素解析器，gate 内可调用 resolve('nameRef:input') 取 DOM */
  gate?: (resolve: (target: string) => HTMLElement | null) => boolean
  /** 门控未通过时"下一步"按钮下方提示文案 */
  gateHint?: string
  /** trigger=wait-dom 时，等待该选择器出现在 DOM */
  waitForElement?: string
  /** trigger=auto 时，自动前进延时（ms），默认 600 */
  autoDelay?: number
  /** trigger=click 时，前进延时（ms），等 click 引起的 DOM 变化完成，默认 350 */
  clickDelay?: number
  /** 额外等待：click 后等该选择器出现才推下一步（如"点了新建 → 等弹窗"） */
  afterClickWait?: string
  /** 小贴士（可选，绿色块） */
  tip?: string
  /** 注意事项（可选，橙色块） */
  warn?: string
  /** 本步的强调色覆盖（默认用 tour 全局色） */
  accent?: string
  /** 是否在进入本步前执行导航（如 router.push） */
  beforeEnter?: () => void | Promise<void>
}

/** 步骤触发方式 */
export type StepTrigger = 'click' | 'input' | 'change' | 'wait-dom' | 'auto' | 'manual'

/** 一个完整引导 */
export interface TourConfig {
  /** 引导唯一 key */
  key: string
  /** 引导名（如「新建任务引导」） */
  name: string
  /** 全局强调色 */
  accent: string
  /** 引导步骤列表（按序播放） */
  steps: TourStep[]
}

/** 高亮矩形（viewport 坐标系，引擎每帧更新） */
export interface HighlightRect {
  top: number
  left: number
  width: number
  height: number
}
