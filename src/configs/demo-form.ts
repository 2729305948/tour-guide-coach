/**
 * 示例引导配置 · 表单创建流程
 * -----------------------------------------------------------------
 * 演示 trigger 类型、gate 门控、expandSelector 动态高亮的完整用法。
 * 对应 demo 页面的表单弹窗。
 */
import type { TourConfig } from '../types'

export const demoFormTour: TourConfig = {
  key: 'demo-form',
  name: '新建表单引导',
  accent: '#409eff',
  steps: [
    {
      id: 'open-btn',
      target: '#demo-create-btn',
      placement: 'bottom',
      title: '点击「新建」',
      content: '点击这个按钮打开表单弹窗。',
      trigger: 'click',
      afterClickWait: '.el-dialog__body .el-form-item:nth-child(1)',
      clickDelay: 500
    },
    {
      id: 'name-field',
      target: '.el-dialog__body .el-form-item:nth-child(1) .el-input',
      placement: 'right',
      title: '填写名称',
      content: '输入名称（必填）。',
      trigger: 'input',
      gate: (resolve) => {
        const el = resolve('.el-dialog__body .el-form-item:nth-child(1) input')
        return !!(el as HTMLInputElement | null)?.value?.trim()
      },
      gateHint: '请先输入名称',
      tip: '名称是唯一必填字段。'
    },
    {
      id: 'category-select',
      target: '.el-dialog__body .el-form-item:nth-child(2) .el-select',
      expandSelector: '.el-select-dropdown',
      placement: 'right',
      title: '选择分类',
      content: '从下拉中选择分类（必填）。\n注意下拉面板也被高亮区域包含。',
      trigger: 'change',
      gate: (resolve) => {
        // 读宿主镜像的 data-tour-value，不依赖 Element Plus 内部类名（2.8 重写过 select）
        const el = resolve('.el-dialog__body .el-form-item:nth-child(2) .el-select')
        return !!el?.dataset.tourValue
      },
      gateHint: '请选择一个分类'
    },
    {
      id: 'date-field',
      target: '.el-dialog__body .el-form-item:nth-child(3) .el-input',
      expandSelector: '.el-picker-panel',
      placement: 'right',
      title: '选择日期',
      content: '选择日期（选填）。\n日历面板同样使用动态高亮扩展。',
      trigger: 'manual'
    },
    {
      id: 'remark-field',
      target: '.el-dialog__body .el-form-item:nth-child(4) .el-textarea',
      placement: 'right',
      title: '备注',
      content: '填写备注（选填），可以直接点「下一步」跳过。',
      trigger: 'manual'
    },
    {
      id: 'submit-btn',
      target: '.el-dialog__footer .el-button--primary',
      placement: 'top',
      title: '提交表单',
      content: '点击「确定」提交，引导结束。',
      trigger: 'click',
      clickDelay: 500
    }
  ]
}
