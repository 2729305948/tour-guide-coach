/**
 * vue-tour-guide · 公共入口
 * -----------------------------------------------------------------
 * 轻量级交互式漫游引导引擎（Vue 3 + Pinia + Element Plus）。
 *
 * 使用方式：
 *   import { useTourStore, TourOverlay } from 'vue-tour-guide'
 *   // 在 layout 中挂 <TourOverlay />
 *   // 业务页调用 tour.startTour(config)
 */
export { useTourStore } from './store'
export type { TargetResolver } from './store'
export { default as TourOverlay } from './TourOverlay.vue'
export type { TourConfig, TourStep, StepTrigger, PopPlacement, HighlightRect } from './types'
