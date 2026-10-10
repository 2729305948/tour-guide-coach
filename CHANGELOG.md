# 更新日志

本项目所有值得注意的改动都会记录在此文件。

格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [1.2.0] - 2026-10-10

### 新增

- **可视区过渡动画 `rectTransition`**：遮罩洞 / 高亮边框由引擎侧逐帧插值平滑过渡——步骤切换滑移、面板并入 / 缩回都按此动画走；滚动 / 缩放始终即时吸附不滞后。默认 200ms，置 `0` 关闭。
- **完成收尾动画 `completeTransition`**：引导完成时先把可视区扩到铺满整屏（洞撑满 → 暗罩淡出）再触发 `onComplete`。默认 300ms，置 `0` 立即触发。
- **宿主可关窗 `hostDismissable`**（步骤级）：遮罩只作视觉压暗、不再拦截点击，ESC 交还宿主处理（如 el-dialog 的 close-on-press-escape）——用于「请用户主动关窗」类步骤；窗口消失照常触发意外关窗判定或 gate 已过时的自动推进。
- **入场过渡逐帧跟随**：目标随组件 `*-enter-*` 过渡滑入（如 EP 弹窗的 translateY(-20px)→0）时，高亮逐帧重测跟随到落位（上限 1200ms），入场偏移不再需要 `clickDelay` 盲等兜住。
- **`TourConfig.actionDwell`**：auto 模式下 action 执行完到推步之间的全局停留（ms），默认 350；单步 `actionDwell` 优先。只影响「看清」节奏，等 DOM 渲染交给引擎。
- **`TourConfig.selectShowMs`**：auto 模式下 `ctx.select` 展开下拉后选项的最短可见时长（ms），默认 350、从面板「出现」起算；置 `0` 发现即点。

### 变更

- auto 托管等待改事件驱动：新增 MutationObserver 驱动的节点等待（命中即走、不受后台标签页定时器节流），`ctx.select` 不再盲等固定时长；`actionDwell` 默认 600 → 350。

### 修复

- 目标消失（`removed` / `hidden`）时冻结高亮矩形、放弃本次提交：`display:none` 量出的 0 尺寸矩形不再让高亮「飞左上角」、结束动画从小点中心炸开；恢复可见后自动续跟。
- 面板测量改用布局 `offsetWidth` / `offsetHeight`（不受开合过渡 scale 影响，首帧即最终大小）；收起经 `*-leave-*` 过渡类提前判消失，治「收起停顿」。
- 浮层判定剔除完全落在视口外的第三方浮层（扩展注入的隐藏菜单等不再把高亮撑到整屏）。
- 换步首帧 glide 不再被 ResizeObserver 初始回调打断；MutationObserver 忽略引导自身浮层的逐帧变更，避免动画自反馈抖动。
- 气泡按下不再抢走宿主控件焦点，治高亮 `el-select` 时点不到「完成 / 下一步」。

### 演示

- demo 各引导去掉 `clickDelay` 盲等：入场偏移由逐帧跟随兜住、目标等待由 `afterClickWait` 覆盖；lost-target / gate-passed 示例启用 `hostDismissable`。

## [1.1.0] - 2026-09-24

### 新增

- **托管演示模式（`mode: 'auto'`）**：`TourConfig` 支持 `interactive`（默认）与 `auto` 两种模式。auto 模式下用户只能点「下一步」，页面被全屏遮罩禁点，引擎按每步的 `action` 代用户完成点击 / 填充 / 选择等操作后再推进，适合无人值守的功能演示。
- **操作原语上下文 `TourActionContext`**：auto 模式下 `step.action(ctx)` 拿到一组通用原语 —— `click` / `fill` / `check` / `select` / `wait`，以及 `resolve` / `el` 供复合控件（日期、自定义选择器等）自行派发事件。`fill` 走原生 value setter + input/change 驱动 Vue `v-model`；`select` 尽力适配 EP / ARIA listbox。
- **步骤停留时长 `actionDwell`**：auto 模式下 `action` 执行完到高亮下一步之间的停留（默认 600ms），便于看清操作结果。
- **自动扩展高亮 `autoExpand`**：无需手写 `expandSelector`，引擎在 UI 库无关的前提下，自动并入贴着目标、当前可见、脱离文档流的浮层（teleport 到 body 的下拉 / 日期 / 级联面板），随面板开合实时跟随。实现分因果绑定、跨库约定 `[data-popper-placement]`、几何兜底三层。
- **目标提升 `promoteControl`**：当 `target` 命中的是 `<input>` / `<textarea>` / `<select>` 等表单叶子时，自动上提到最近一个「画了可见盒子」的祖先控件根再高亮，治「只框到窄输入框」的坑（如 el-select）。判据纯计算样式，默认关闭。
- **等待期遮罩开关 `maskWhileWaiting`**：控制等待本步目标期间是否压全屏遮罩（默认 true）。置 false 用于「需用户点击页面元素才能唤醒目标」的步骤。
- **目标丢失检测与恢复**：`TourConfig.onTargetLost(ctx)` 回调在依附的目标窗口被意外关闭时触发（`TargetLostContext` 携带 `stepId` / `stepIndex` / `title` / `target` / `reason`，`reason` 为 `removed` | `hidden`）；引擎同时弹出中断提示，新增导出 `retryLost()` 供宿主在窗口重开后继续引导。
- **自动滚动 `autoScroll`**：目标不在视口内时自动滚动到高亮位置（默认 true），仅在目标刚就绪时滚一次，不抢用户后续的手动滚动。

### 变更

- `src/index.ts` 额外导出 `retryLost` 及类型 `TargetLostReason` / `TargetLostContext` / `TourActionContext`。

### 演示

- demo 新增可交互 Playground（`demo/src/components/`）与多组示例引导（`demo/src/tours/`）：auto 托管模式、目标丢失恢复、健壮性、极端场景、选择器演示，并附带操作日志面板。

## [1.0.3] - 更早

### 变更

- CSS 内联到 JS（`vite-plugin-css-injected-by-js`），消费方零配置，无需手动引入样式文件。

## [1.0.0] - 更早

### 新增

- 轻量级交互式漫游引导引擎首个版本：Vue 3、零外部依赖、Element Plus 风格；支持 click / input / change / wait-dom / manual 多种步骤触发方式、动态扩展高亮、导航前置钩子与 ESM+CJS+d.ts 构建产物。
