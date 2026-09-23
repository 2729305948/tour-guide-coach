/**
 * vue-tour-guide · 公共入口
 * -----------------------------------------------------------------
 * 零外部依赖（仅需 Vue 3），全局单例模式。
 *
 * 使用方式：
 *   import { tourState, startTour, abort, TourOverlay } from 'vue-tour-guide'
 *   // 在 layout 中挂 <TourOverlay />
 *   // 业务页调用 startTour(config)
 */
export { tourState, startTour, abort, next, skip, complete } from './store'
export type { TargetResolver } from './store'
export { default as TourOverlay } from './TourOverlay.vue'
export type { TourConfig, TourStep, StepTrigger, PopPlacement, HighlightRect } from './types'
