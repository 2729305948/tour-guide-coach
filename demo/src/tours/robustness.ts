/**
 * 场景组三：鲁棒性 + 综合长流程
 * -----------------------------------------------------------------
 * 滚动跟随、destroy-on-close 重建 DOM、多 popper 共存、异步 beforeEnter。
 */
import type { TourConfig } from 'tour-guide-coach'
import { S, hasAnyChecked, hasCategory, hasName } from './selectors'
import { tourLog } from '../use-tour-log'

/** ⑧ 滚动容器内目标 → 高亮实时跟随；跨 destroy-on-close 重建 */
export const scrollRebuildTour: TourConfig = {
  key: 'scroll-rebuild',
  name: '滚动跟随 + 弹窗重建 DOM',
  accent: '#0ea5e9',
  steps: [
    {
      id: 'deep',
      target: S.deepTarget,
      placement: 'left',
      title: '滚动容器里的目标',
      content: '进入这一步时它在滚动容器底部、视口之外——引擎会自动把它滚进视野中央。\n'
        + '滚完之后你再手动上下滚动，观察高亮框和洞口实时跟随（scroll 捕获阶段 + ResizeObserver）。\n'
        + '关掉右上角「自动滚动到高亮」再跑一次，就能看到不滚动的原始表现。',
      trigger: 'manual',
      tip: '只在目标就绪那一刻滚一次，之后不抢方向盘。'
    },
    {
      id: 'open',
      target: S.createBtn,
      placement: 'bottom',
      title: '打开弹窗（destroy-on-close）',
      content: '这个弹窗是 destroy-on-close 的：每次打开都是全新 DOM 节点。\n关闭再打开也不影响引导挂到新节点上。',
      trigger: 'click',
      afterClickWait: S.categorySelect,
      clickDelay: 400
    },
    {
      id: 'fill',
      target: S.nameInput,
      placement: 'right',
      title: '填写名称',
      content: '随便输入点东西。',
      trigger: 'input',
      gate: hasName,
      gateHint: '请先输入名称'
    },
    {
      id: 'pick',
      target: S.categorySelect,
      expandSelector: S.selectDropdown,
      placement: 'right',
      title: '选择分类',
      content: '下拉面板 teleport 在 body 末尾，expandSelector 已把它并入高亮区。',
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

/** ⑨ 多个 popper 共存时取第一个可见面板 */
export const multiPopperTour: TourConfig = {
  key: 'multi-popper',
  name: '多 popper 共存',
  accent: '#f472b6',
  steps: [
    {
      id: 'a',
      target: S.selA,
      expandSelector: S.selectDropdown,
      placement: 'top',
      title: '先打开第一个下拉',
      content: '打开后不用选值，直接让它收起（再点一下即可）。',
      trigger: 'manual'
    },
    {
      id: 'b',
      target: S.selB,
      expandSelector: S.selectDropdown,
      placement: 'top',
      title: '再打开第二个下拉',
      content: '此时 body 末尾同时存在两个 .el-select-dropdown（第一个是 display:none 的残留）。\n引擎取第一个可见面板，所以洞口只包住正在用的这个。',
      trigger: 'manual',
      warn: '若引擎只按 querySelector 取第一个匹配，就会被隐藏面板坑到——这正是踩过的坑 #8。'
    }
  ]
}

/** ⑩ 综合长流程：异步 beforeEnter + 页面/弹窗/二级弹窗串联 */
export const fullFlowTour: TourConfig = {
  key: 'full-flow',
  name: '综合长流程（9 步）',
  accent: '#111827',
  steps: [
    {
      id: 'intro',
      target: S.createBtn,
      placement: 'center',
      title: '开始之前',
      content: '这是一条串联「页面 → 弹窗 A → 弹窗 B → 回填 → 提交」的长流程，\n用于回归引擎在真实业务链路里的推步与存活判定。',
      trigger: 'manual',
      tip: '按 ESC 可随时退出引导。'
    },
    {
      id: 'async',
      target: S.createBtn,
      placement: 'bottom',
      title: '异步 beforeEnter',
      content: '进入本步前引擎会 await 一个 800ms 的"数据加载"。',
      trigger: 'auto',
      autoDelay: 400,
      beforeEnter: async () => {
        tourLog('beforeEnter：模拟拉取字典数据 800ms…', 'info')
        await new Promise((r) => setTimeout(r, 800))
        tourLog('beforeEnter 完成，开始解析目标', 'ok')
      }
    },
    {
      id: 'open',
      target: S.createBtn,
      placement: 'bottom',
      title: '打开表单',
      content: '点「新建项目」。',
      trigger: 'click',
      afterClickWait: S.nameInput,
      clickDelay: 400
    },
    {
      id: 'name',
      target: S.nameInput,
      placement: 'right',
      title: '名称',
      content: '必填。',
      trigger: 'input',
      gate: hasName,
      gateHint: '请先输入名称'
    },
    {
      id: 'category',
      target: S.categorySelect,
      expandSelector: S.selectDropdown,
      placement: 'right',
      title: '分类',
      content: '必选，下拉面板已并入高亮区。',
      trigger: 'change',
      gate: hasCategory,
      gateHint: '请选择一个分类'
    },
    {
      id: 'remark',
      target: S.remarkItem,
      placement: 'right',
      title: '备注（可跳过）',
      content: '选填步骤，可以直接点「跳过此步」。',
      trigger: 'manual'
    },
    {
      id: 'to-class',
      target: S.openClassBtn,
      placement: 'top',
      title: '去选班级',
      content: '点它会关掉弹窗 A、打开弹窗 B。',
      trigger: 'click',
      afterClickWait: S.classGroup,
      clickDelay: 400
    },
    {
      id: 'class',
      target: S.classGroup,
      placement: 'left',
      title: '勾选班级',
      content: '至少一个，否则「下一步」锁住。',
      trigger: 'change',
      gate: (resolve) => hasAnyChecked(resolve, S.classGroup),
      gateHint: '请至少勾选一个班级'
    },
    {
      id: 'done',
      target: S.classConfirm,
      placement: 'top',
      title: '确认并发布',
      content: '点「确认选择」，引导完成。',
      trigger: 'click',
      clickDelay: 400
    }
  ]
}
