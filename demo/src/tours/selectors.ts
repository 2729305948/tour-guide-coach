/**
 * demo 里所有引导目标选择器的单一来源
 * -----------------------------------------------------------------
 * 集中管理避免配置与页面结构走偏；改 Playground.vue 的 DOM 时同步这里。
 */
export const S = {
  /** 打开表单弹窗（弹窗 A）的入口按钮 */
  createBtn: '#demo-create-btn',
  /** 弹窗 A 表单项：名称 / 分类 / 日期 / 备注 */
  nameInput: '.el-dialog__body .el-form-item:nth-child(1) .el-input',
  nameField: '.el-dialog__body .el-form-item:nth-child(1) input',
  categorySelect: '.el-dialog__body .el-form-item:nth-child(2) .el-select',
  dateItem: '.el-dialog__body .el-form-item:nth-child(3) .el-input',
  remarkItem: '.el-dialog__body .el-form-item:nth-child(4) .el-textarea',
  /** 弹窗 A 底部：打开二级弹窗的按钮 + 主按钮 */
  openClassBtn: '#demo-open-class',
  dialogConfirm: '.el-dialog__footer .el-button--primary',
  /** 二级弹窗（班级选择）：多选组 + 确认 */
  classGroup: '#demo-class-group',
  classConfirm: '#demo-class-confirm',
  /** 滚动容器内需要滚进视口才看得见的目标 */
  deepTarget: '#demo-deep-target',
  /** 由按钮动态生成的目标（演示等待态自动挂载） */
  lazyTarget: '#demo-lazy-target',
  lazyBtn: '#demo-lazy-btn',
  /** 视口贴边目标（演示气泡翻转 / 钳制） */
  edgeTop: '#demo-edge-top',
  edgeRight: '#demo-edge-right',
  edgeBottom: '#demo-edge-bottom',
  edgeLeft: '#demo-edge-left',
  /** 多 popper 共存：先后打开过两个下拉。
   *  用 data-tour 而非 id —— id 在 el-select 上是组件 prop，会被挂到内部 <input>，
   *  只框住窄输入框；data-tour 是 fall-through，落在 .el-select 根节点上才能框住整个选择框。 */
  selA: '[data-tour="multi-a"]',
  selB: '[data-tour="multi-b"]',
  /** 永远不存在的目标（演示超时兜底） */
  ghost: '#demo-i-will-never-exist',
  /** el-select / el-date-picker 的 teleport 面板 */
  selectDropdown: '.el-select-dropdown',
  pickerPanel: '.el-picker-panel'
} as const

/**
 * 分类是否已选中。
 * 不读 Element Plus 内部类名（2.8 重写过 select，is-transparent 之类在不同版本表现不一致），
 * 而是由宿主用 data-tour-value 把状态镜像到 DOM —— 判定依据来自数据本身。
 */
export function hasCategory(resolve: (t: string) => HTMLElement | null): boolean {
  const el = resolve(S.categorySelect)
  if (!el) return false
  return !!(el as HTMLElement).dataset.tourValue
}

/** 名称是否已填写（注意 data-tour / el-input 根节点陷阱，取真正的 input） */
export function hasName(resolve: (t: string) => HTMLElement | null): boolean {
  const el = resolve(S.nameField)
  return !!(el as HTMLInputElement | null)?.value?.trim()
}

/** 容器内是否至少勾选了一项（用原生 input:checked，不依赖组件库类名） */
export function hasAnyChecked(resolve: (t: string) => HTMLElement | null, container: string): boolean {
  const el = resolve(container)
  if (!el) return false
  return el.querySelectorAll('input:checked').length > 0
}
