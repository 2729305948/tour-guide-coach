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

/**
 * auto 模式下传给步骤 action 的上下文。
 * 引擎内置通用原语（click/fill/check/select），覆盖简单场景；
 * 复合控件（日期、自定义选择器等）用 resolve/el 让宿主自行派发事件。
 */
export interface TourActionContext {
  /** 解析选择器 → DOM 元素（与 gate 的 resolve 同源） */
  resolve: (target: string) => HTMLElement | null
  /** 当前步骤的目标元素（未提升的原始 target） */
  el: HTMLElement | null
  /** 通用点击：派发 pointerdown/mousedown/mouseup + click，覆盖多数组件的触发方式 */
  click: (targetOrEl?: string | HTMLElement) => void
  /** 填充输入框/文本域：走原生 value setter + input/change，驱动 Vue v-model */
  fill: (value: string, targetOrEl?: string | HTMLElement) => void
  /** 勾选/取消 checkbox 或选中 radio（默认勾上）；已是目标态则不重复点 */
  check: (checked?: boolean, targetOrEl?: string | HTMLElement) => void
  /** 尽力而为地选择下拉项：点开触发器 → 等面板 → 按 ARIA role=option 文本或序号点击。
   *  适配 EP/ARIA listbox；原生 <select> 或自定义结构请用 resolve 自行处理。 */
  select: (labelOrIndex: string | number, targetOrEl?: string | HTMLElement) => Promise<void>
  /** 等待若干毫秒（配合 async action 在两步操作间留时间） */
  wait: (ms: number) => Promise<void>
}

/** 引导步骤 */
export interface TourStep {
  /** 步骤唯一 ID（config 内不重复） */
  id: string
  /** 高亮目标 CSS 选择器（`[data-tour="xxx"]`、`#tab-tasks` 等） */
  target: string
  /** 动态扩展选择器：当该选择器匹配的元素可见时，高亮区域扩展为 target + expand 联合矩形。
   *  典型场景：el-select 展开后 popper teleport 到 body，需要把下拉面板纳入可交互区域。 */
  expandSelector?: string
  /** 自动扩展高亮：无需手写 expandSelector，引擎在 UI 库无关的前提下，
   *  自动并入「贴着目标、当前可见、脱离文档流(fixed/absolute)」的浮层
   *  （teleport 到 body 的下拉/日期/级联面板等）。进入本步后随面板开合实时跟随。
   *  实现分三层：① 因果绑定（点击 target 后冒出来的浮层）② 跨库约定 [data-popper-placement]
   *  ③ 几何兜底（贴着目标的可见定位层）。可叠加，能兜住 teleport 面板、任意嵌套深度、
   *  以及翻转到远处/带间隙的面板。邻接 + 可见 + 排除全屏遮罩与引导自身，避开 tooltip / 残留 display:none 面板。
   *  与 expandSelector 同时给出时，expandSelector 优先。 */
  autoExpand?: boolean
  /** 目标提升：当 target 命中的是 <input>/<textarea>/<select> 这类"表单叶子"时，
   *  自动上提到最近一个"画了可见盒子"（边框 / box-shadow / 背景 / 圆角）的祖先控件根再高亮。
   *  治的是「组件把 id/焦点挂在内部 input 上，结果只框到窄输入框」这类坑（如 el-select）。
   *  判据纯计算样式、不绑组件库。默认关，避免误伤「你就是想框那个 input」的场景。 */
  promoteControl?: boolean
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
  /** 等待本步目标期间是否压全屏遮罩（默认 true）。
   *  置 false 用于「需要用户点击页面元素才能唤醒目标」的步骤，否则点不到那个按钮。
   *  注意：目标意外消失（targetLost）时始终不压遮罩，用户要能重开窗口。 */
  maskWhileWaiting?: boolean
  /** 本步允许用户用宿主自身的方式关掉依附的窗口（点 ×、点遮罩、按 ESC，或点弹窗底部按钮）。
   *  置 true 时引擎做两件事：① 遮罩只作视觉压暗、不再拦截点击（pointer-events 放行，洞外元素可点）；
   *  ② ESC 不再被引导劫持去 abort，交还宿主处理（如 el-dialog 的 close-on-press-escape）。
   *  窗口随之消失 → 照常触发「意外关窗」判定（targetLost）或 gate 已过时的自动推进。
   *  治的是「请用户主动关窗」类步骤：否则聚光灯洞外的 × / 遮罩 / footer 按钮点不到、ESC 会直接退出引导。
   *  默认关——保持「只有高亮区可点」的引导约束。 */
  hostDismissable?: boolean
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
  /** auto 模式下点「下一步」时代引擎代为执行的操作（点击/填充/选择等）。
   *  返回 Promise 则等其完成后再推步；不写则本步「下一步」只推进不操作。 */
  action?: (ctx: TourActionContext) => void | Promise<void>
  /** auto 模式下 action 执行完到高亮进入下一步之间的停留（ms），默认取 TourConfig.actionDwell（350），便于看清结果 */
  actionDwell?: number
}

/** 步骤触发方式 */
export type StepTrigger = 'click' | 'input' | 'change' | 'wait-dom' | 'auto' | 'manual'

/** 目标消失原因：removed = 已从 DOM 移除；hidden = 仍在 DOM 但不可见（祖先 display:none） */
export type TargetLostReason = 'removed' | 'hidden'

/** 目标意外消失时传给宿主的信息 */
export interface TargetLostContext {
  /** 丢失目标时所在步骤 id */
  stepId: string
  /** 丢失目标时所在步骤序号（从 0 开始） */
  stepIndex: number
  /** 该步标题（供宿主拼提示文案） */
  title: string
  /** 该步的目标选择器 */
  target: string
  /** 消失原因 */
  reason: TargetLostReason
}

/** 一个完整引导 */
export interface TourConfig {
  /** 引导唯一 key */
  key: string
  /** 引导名（如「新建任务引导」） */
  name: string
  /** 交互模式：
   *  - 'interactive'（默认）：用户真实操作页面控件，事件/gate 驱动推步。
   *  - 'auto'：托管/演示模式——用户只能点「下一步」，页面被全屏遮罩禁点，
   *    每点一次「下一步」引擎按步骤 action 代用户操作（点击/填充/选择…）再推进。 */
  mode?: 'interactive' | 'auto'
  /** auto 模式下 action 执行完到推步之间的全局停留（ms），默认 350，用于让人看清引擎刚替你做了什么。
   *  单步的 actionDwell 优先于它。只影响节奏，不承担"等 DOM 渲染"——渲染到位由引擎自己盯。 */
  actionDwell?: number
  /** auto 模式下 ctx.select 展开下拉后，选项的最短可见时长（ms），默认 350；置 0 则一发现选项就点。
   *  托管演示是演给人看的——面板刚冒头就被点掉等于没展示。同样只影响"看"的节奏：
   *  面板是否渲染到位由引擎盯（上限 1s 兜底），这里只保证露脸时间。 */
  selectShowMs?: number
  /** 全局强调色 */
  accent: string
  /** 目标不在视口内时自动滚动到高亮位置（默认 true）。
   *  只在目标刚就绪的那一刻滚一次，之后用户手动滚动不会被抢方向盘。 */
  autoScroll?: boolean
  /** 可视区（遮罩洞 / 高亮边框）尺寸或位置变化时的过渡动画时长（ms），默认 200。
   *  作为逐帧插值的平滑时间常数：扩展并入面板的形变、步骤切换时高亮迁移都按此时长平滑过渡。
   *  滚动 / 缩放不在此列，始终即时吸附贴合、不做滞后。置 0 关闭动画（瞬时跳变）。
   *  实现为引擎侧逐帧插值，遮罩洞与边框读同一动画值，跨浏览器一致（不依赖 CSS `d` 过渡）。 */
  rectTransition?: number
  /** 引导完成时，先把可视区扩大到铺满整屏（洞撑满 → 暗罩淡出）再触发 onComplete 的动画时长（ms），默认 300。
   *  置 0 关闭该收尾动画，完成时立即触发 onComplete。 */
  completeTransition?: number
  /** 引导步骤列表（按序播放） */
  steps: TourStep[]
  /** 依附的目标窗口被意外关闭时的回调（引擎同时弹出中断提示，见 TourOverlay）。
   *  仅在本步尚未完成时触发；本步 gate 已通过或 trigger=click 已触发的消失视为正常流转。 */
  onTargetLost?: (ctx: TargetLostContext) => void
}

/** 高亮矩形（viewport 坐标系，引擎每帧更新） */
export interface HighlightRect {
  top: number
  left: number
  width: number
  height: number
}
