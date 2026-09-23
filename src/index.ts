/**
 * vue-tour-guide · 公共入口
 * -----------------------------------------------------------------
 * 零外部依赖（仅需 Vue 3），全局单例模式。
 *
 * 使用方式：
 *   import { startTour, TourOverlay } from 'tour-guide-coach'
 *   // 在 layout 中挂 <TourOverlay />
 *   // 业务页调用 startTour(config)
 *   // CSS 已内联到 JS，无需手动引入样式文件
 */
export { tourState, startTour, abort, next, skip, complete, currentStep } from './store'
export type { TargetResolver } from './store'
export { default as TourOverlay } from './TourOverlay.vue'
export type { TourConfig, TourStep, StepTrigger, PopPlacement, HighlightRect } from './types'
