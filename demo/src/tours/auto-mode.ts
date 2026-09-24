/**
 * 场景组：auto 托管模式（用户只点「下一步」，引擎代操作）
 * -----------------------------------------------------------------
 * 演示 mode:'auto' + step.action：点一次「下一步」，引擎用内置原语替用户
 * 点击按钮 / 填充输入框 / 选择下拉项，页面被全屏遮罩禁点，只能沿引导走。
 * 复合控件（日期、自定义选择器）可在 action 里用 ctx.resolve 自行派发事件。
 */
import type { TourConfig } from 'tour-guide-coach'
import { S } from './selectors'

export const autoModeTour: TourConfig = {
  key: 'auto-mode',
  name: '托管演示（auto 模式）',
  mode: 'auto',
  accent: '#9254de',
  steps: [
    {
      id: 'open',
      target: S.createBtn,
      placement: 'bottom',
      title: '引擎帮你点「新建」',
      content: '这一步不用你动手——点「下一步」，引擎替你点击高亮处的按钮，打开弹窗。',
      trigger: 'manual',
      action: (ctx) => ctx.click()
    },
    {
      id: 'name',
      target: S.nameInput,
      placement: 'right',
      title: '引擎帮你填名称',
      content: '点「下一步」，引擎向输入框写入内容（走原生 value setter + input 事件，v-model 会收到）。',
      trigger: 'manual',
      action: (ctx) => ctx.fill('自动创建的项目', S.nameField)
    },
    {
      id: 'category',
      target: S.categorySelect,
      autoExpand: true,
      placement: 'right',
      title: '引擎帮你选分类',
      content: '点「下一步」，引擎展开下拉并按选项文本选中「前端」。',
      trigger: 'manual',
      action: async (ctx) => { await ctx.select('前端') }
    },
    {
      id: 'submit',
      target: S.dialogConfirm,
      placement: 'top',
      title: '引擎帮你提交',
      content: '点「完成」，引擎点击「确定」提交，弹窗关闭、引导结束。',
      trigger: 'manual',
      action: (ctx) => ctx.click()
    }
  ]
}
