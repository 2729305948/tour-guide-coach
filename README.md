# tour-guide-coach

轻量级交互式漫游引导引擎，基于 **Vue 3**，**零外部依赖**。

样式沿用 Element Plus 设计语言（色彩、圆角、字号），但不需要安装任何组件库。如果项目已有 Element Plus，CSS 变量自动 fallback 到 `--el-*` 保持一致；独立使用时走内置默认值。

与 driver.js / intro.js 等传统引导库的核心区别：**引导跟随用户真实操作推进**，而非"下一步"按钮翻页。用户必须点击高亮按钮、输入必填字段、选择下拉项后，引导才会进入下一步。

## 特性

- **蒙版 + 元素高亮**：4 块遮罩围绕目标区域，中间可交互（点击/输入/选择）
- **事件驱动推步**：`trigger: 'click'` 用户必须点目标元素才推进，不给"下一步"按钮
- **表单门控**：`gate(resolve)` 轮询检测输入值/选中状态，未满足条件时"下一步"锁住
- **动态高亮扩展**：`expandSelector` 自动把 teleport 到 body 的 el-select 下拉面板、el-date-picker 日历面板纳入可交互区域
- **零业务代码侵入**：纯 CSS selector 定位现有 DOM，不需要给业务组件加 `data-tour` 属性或 `defineExpose`
- **等待目标 + 超时跳过**：目标元素不存在时用 MutationObserver 轮询等待，超时显示"跳过此步"而非自动跳（避免级联跳过）

## 安装

```bash
npm install tour-guide-coach
# 或从 GitHub
npm install github:2729305948/tour-guide-coach
```

Peer dependencies：`vue@^3.4`。**零外部依赖，不需要 UI 组件库，不需要 Pinia。**

## 快速开始

### 1. 挂载全局蒙版组件

在应用 layout 根节点（或 `App.vue`）挂一次 `<TourOverlay />`，内部 `Teleport to="body"`，只在引导激活时渲染：

```vue
<script setup>
import { TourOverlay } from 'tour-guide-coach'
</script>

<template>
  <el-container>
    <el-main>...</el-main>
    <TourOverlay />
  </el-container>
</template>
```

### 2. 定义引导配置

```ts
// tours/create-project.ts
import type { TourConfig } from 'tour-guide-coach'

export const tourCreateProject: TourConfig = {
  key: 'create-project',
  name: '新建项目引导',
  accent: '#409eff',
  autoScroll: true,                   // 目标不在视口内时自动滚过去（默认 true）
  steps: [
    {
      id: 'open-btn',
      target: '#create-btn',              // CSS selector
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
      gateHint: '请先输入名称'
    },
    {
      id: 'submit-btn',
      target: '.el-dialog__footer .el-button--primary',
      placement: 'top',
      title: '提交',
      content: '点击「确定」完成引导。',
      trigger: 'click',
      clickDelay: 500
    }
  ]
}
```

### 3. 触发引导

```ts
import { startTour } from 'tour-guide-coach'
import { tourCreateProject } from './tours/create-project'

startTour(tourCreateProject, undefined, () => {
  console.log('引导完成')
})
```

### 4. 运行 Demo

```bash
npm install     # 根目录装依赖，demo 复用同一份 node_modules
npm run dev     # 起 demo（Vite，默认 http://localhost:5173）
```

demo 直接 alias 到 `src/`，改引擎代码即时生效，不需要先 build。页面按 10 个场景组织，每条卡片都写了「观察点」，右侧「引导日志」把 `tourState` 的每次状态跃迁摊开显示，控制台里还能用 `__tour` 直接读引擎单例。

| 分组 | 场景 | 验证什么 |
|---|---|---|
| 表单流程 | 新建表单引导 | `click` + `afterClickWait`、input/change 门控、`expandSelector` 并入下拉与日历面板 |
| 表单流程 | 综合长流程（9 步） | 异步 `beforeEnter` → 页面 → 弹窗 A → 弹窗 B → 提交的连续链路 |
| 关窗判定 | 意外关窗 → 中断 → 重试续上 | 本步未完成就关窗：收起遮罩 + 中断面板 + `onTargetLost`，重开后「重试此步」自动续上 |
| 关窗判定 | 门控已过 + 关窗 → 自动推进 | 选完值直接点保存：判为正常流转，静默推进，不弹中断 |
| 关窗判定 | 点 A 开 B（跨弹窗迁移） | 点击导致当前弹窗关闭、另一个打开：高亮迁移，不误判 |
| 边界兜底 | 目标延迟出现 | 等待态 → 元素冒头瞬间自动挂载 |
| 边界兜底 | 目标永不存在 | 12s 超时只给「跳过此步 / 退出引导」，不自动跳步 |
| 边界兜底 | 贴边翻转 / 钳制 / 超长内容 | 四个视口贴边目标触发方位翻转；长内容气泡内滚动 |
| 鲁棒性 | 滚动跟随 + 弹窗重建 DOM | 滚动容器内高亮实时跟随；`destroy-on-close` 重建后仍挂到新节点 |
| 鲁棒性 | 多 popper 共存 | 两个下拉面板同时存在时取第一个可见的 |

> 提示：把浏览器窗口缩到 1024×700 以下再看「贴边翻转」更明显；按 ESC 可随时退出引导。

## 引导规则

### Step 结构

```ts
interface TourStep {
  id: string                          // 步骤唯一 ID
  target: string                      // 高亮目标 CSS selector
  expandSelector?: string             // 动态扩展区域（teleport 弹层）
  placement?: 'top'|'bottom'|'left'|'right'|'center'
  title: string
  content: string
  trigger: StepTrigger                // 推进方式
  gate?: (resolve) => boolean         // 门控条件
  gateHint?: string                   // 门控未通过时的提示
  waitForElement?: string             // trigger=wait-dom 时等待的元素
  maskWhileWaiting?: boolean          // 等待目标期是否压全屏遮罩（默认 true）
  autoDelay?: number                  // trigger=auto 时延时
  clickDelay?: number                 // trigger=click 时点击后延时
  afterClickWait?: string             // 点击后等待的元素（如弹窗出现）
  tip?: string                        // 绿色提示块
  warn?: string                       // 橙色警示块
  accent?: string                     // 覆盖全局强调色
  beforeEnter?: () => void | Promise<void>  // 进入前钩子（如路由跳转）
}
```

### Trigger 类型语义

| trigger | 推进方式 | UI 表现 |
|---|---|---|
| `click` | 用户点击高亮元素 | **不显示"下一步"按钮**，只显示"👆 请点击高亮区域"呼吸提示 |
| `input` | 输入框满足 gate 后手动点下一步 | gate 未通过时"下一步"锁住显示 gateHint |
| `change` | 值变化后（配合 gate） | 同上 |
| `manual` | 用户手动点"下一步" | 显示"跳过此步" + "下一步" |
| `wait-dom` | 等待 `waitForElement` 出现 | 居中 loading 提示 |
| `auto` | 延时自动推进 | 无 UI，静默跳 |

### Gate 门控

`gate(resolve)` 每 150ms 轮询一次，返回 `true` 才解锁"下一步"按钮。`resolve` 参数是元素解析器（宿主页面可传入自定义 resolver，默认为 `document.querySelector`）。

```ts
gate: (resolve) => {
  const input = resolve('.my-form input[name="title"]')
  return !!(input as HTMLInputElement)?.value?.trim()
}
```

### 等待期遮罩策略

目标还没就绪（进入步骤的首帧、`wait-dom` 等待中、12s 超时）时，默认**压整屏遮罩且不挖洞**——避免用户在等待期点别处把页面状态搞乱，导致目标永远等不到。

两个例外：

```ts
// ① 需要用户点页面元素才能唤醒目标 → 放行
{ id: 'lazy', target: '#later-rendered', maskWhileWaiting: false, ... }

// ② 目标意外消失（依附窗口被关）→ 始终放行，用户要能重开窗口
```

## 动态高亮（expandSelector）

**核心场景**：Element Plus 的 `el-select`、`el-date-picker`、`el-cascader` 等组件的下拉面板/日历面板通过 `Teleport` 渲染到 `<body>` 末尾，不在原组件 DOM 树内。蒙版会挡住这些弹层，导致用户无法选择。

**解决方案**：给 step 加 `expandSelector`，引擎检测到该选择器匹配的元素可见时，自动把高亮区域扩展为 **target + expand 元素的联合矩形**。

```ts
{
  id: 'category-select',
  target: '.el-dialog__body .el-form-item:nth-child(2) .el-select',
  expandSelector: '.el-select-dropdown',   // ← el-select 展开的下拉面板
  ...
}
```

**常用 expandSelector 值**：

| 组件 | 弹层选择器 |
|---|---|
| `el-select` | `.el-select-dropdown` |
| `el-date-picker` / `el-time-picker` | `.el-picker-panel` |
| `el-cascader` | `.el-cascader__dropdown` |
| `el-tree-select` | `.el-select-dropdown`（内部是 tree） |
| `el-popover` / `el-tooltip` | `.el-popper` |

**原理**：引擎用 `MutationObserver` 监听 `document.body` 的 `childList + subtree + attributes(style/class)`，弹层出现/消失瞬间触发 `_updateRect` 重算。多个弹层共存时（如同时有多个 select 打开过），取**第一个 `offsetHeight > 0` 的可见元素**。

## 踩过的坑

### 1. `.tour-root` 必须 `pointer-events: none`

**症状**：高亮区域看起来正确，但点击没反应，被"隐形"拦截。

**根因**：根容器 `.tour-root` 是 `position: fixed; inset: 0` 的全屏 div，默认 `pointer-events: auto` 会拦截所有点击（包括高亮区域）。

**修复**：根容器 `pointer-events: none`，只让 `.tour-mask-path`（SVG 遮罩的填充路径）、`.tour-popover` 气泡、`.tour-waiting` 等待框单独 `pointer-events: auto`。

### 2. `el-dialog` 选择器别用 `:has()` 复杂前缀

**症状**：`.el-dialog:has(.el-dialog__title) [data-tour="xxx"]` 找不到元素。

**根因**：`querySelector` 对 `:has()` 兼容性差（Safari 旧版不支持），且同一时刻只有一个 dialog，前缀完全多余。

**修复**：直接用 `[data-tour="xxx"]` 或 `.el-dialog__body .el-form-item:nth-child(N)`。

### 3. `el-input` 的 `data-tour` 落在根 div 不是 `<input>`

**症状**：`gate` 里 `el.value` 永远是 `undefined`。

**根因**：Vue 3 的 attribute fallthrough 把 `data-tour` 加到组件根元素 `<div class="el-input">` 上，不是内部的 `<input>`。

**修复**：gate 里用 `resolve('.target input')` 或 `el.querySelector('input')` 取真正的 input 元素。

### 4. `trigger: 'click'` 步骤不能显示"下一步"按钮

**症状**：用户不点高亮按钮，直接点"下一步"跳过了交互。

**根因**：气泡默认渲染"下一步"按钮，与 `trigger: 'click'` 的语义冲突。

**修复**：`trigger === 'click'` 时只渲染"👆 请点击高亮区域"呼吸提示，不给按钮。

### 5. 超时不能自动跳步骤

**症状**：Step 1 找不到元素 → 8s 超时 → 自动 `next()` → Step 2 也找不到 → 级联跳过 → 引导"跑完"但用户什么都没做。

**修复**：超时后设 `waitTimedOut = true`，UI 显示"未找到目标元素" + 手动"跳过此步"按钮。超时时间放宽到 15s。

### 6. 首步不要设"点击 Tab"

**症状**：用户已经在目标 Tab 上，引导要求"点击 Tab"→ 用户不知道要点什么 → 卡住或超时。

**修复**：如果目标状态已经达成（如已在 tasks tab），首步直接从"点击新建按钮"开始。Tab id 用 Element Plus 自动生成的 `#tab-{name}` 定位。

### 7. `destroy-on-close` 的 el-dialog 每次重建 DOM

**症状**：弹窗关闭后 `MutationObserver` 观察的旧节点失效。

**修复**：`_startWaitForElement` 观察 `document.body` 的 `childList + subtree`，弹窗重新挂载时能捕获到新节点。

### 8. 多个 popper 共存时 `querySelector` 只返回第一个

**症状**：`expandSelector: '.el-select-dropdown'` 匹配到的是之前打开过、现在 `display:none` 的旧面板。

**修复**：用 `querySelectorAll` + 遍历找第一个 `offsetHeight > 0` 的可见元素。

### 9. 引导激活时路由跳转要留渲染时间

**症状**：`router.push('/t/home')` 后立即 `startTour()` → 页面还在异步加载数据，按钮未渲染 → 卡等待。

**修复**：`setTimeout(() => startTour(config), 1200)` 给页面渲染 + 数据加载留时间；引擎的 MutationObserver 兜底等元素出现。

### 10. Element Plus tab id 命名规则

**症状**：`target: '.el-tabs__item'` 匹配到多个。

**修复**：用 `#tab-{name}` 精确定位（Element Plus 自动生成的 id）。

### 11. 依附的弹窗被用户自己关掉 → 引导卡死

**症状**：高亮目标在 `el-dialog` 内，用户点了弹窗的 × / 遮罩 / ESC 关掉窗口，气泡和遮罩的洞仍冻结在原位，gate 永远不可能通过，引导死在那一步。

**修复**：引擎在目标挂载后开启存活检测（200ms 轮询 `isConnected` + `getClientRects()`，连续 2 次失败才确认，避开关闭动画中间帧），并严格区分**正常流转**与**意外关闭**：

| 消失时机 | 判定 | 行为 |
|---|---|---|
| `trigger: 'click'` 已触发（点完就换弹窗） | 正常流转 | 立即解除存活检测，按 `clickDelay` / `afterClickWait` 推进 |
| 本步 `gate` 已通过（选完值直接点保存关掉弹窗） | 正常流转 | 自动 `next()`，不弹中断 |
| 本步 `gate` 未通过时目标消失 | 意外关闭 | 收起遮罩洞（页面可操作）+ 底部中断提示 + 回调 `onTargetLost` |

中断提示带「重试此步」：重新进入等待态，用户重开窗口后 MutationObserver 自动续上（无需重启引导）。「退出引导」走 `abort()`。

**注意**：目标"在 DOM 里但 `display:none`"（v-show 关着的弹窗）同样算消失，原因标记 `hidden`；引擎不会把它当就绪元素挂出 0×0 的错位高亮。

### 12. 被滚动容器裁切的目标，视口矩形会"骗人"

**症状**：目标在 `overflow:auto` 的容器里被裁掉、肉眼看不见，但按"是否超出视口"判断却得出"在视口内"，于是自动滚动不触发。

**根因**：`getBoundingClientRect()` 返回的是布局位置，被祖先裁掉的元素数值上依然落在视口范围内。

**修复**：`_needsScroll()` 除了比对视口边距，还沿 `parentElement` 链找出非 `visible` 的 overflow 祖先，逐个比对元素矩形是否越出该祖先的矩形。

## API

### 导出函数

模块级单例，无需 `useStore()`：

```ts
import { startTour, abort, next, skip, complete, retryLost, currentStep, tourState, TourOverlay } from 'tour-guide-coach'

startTour(config, resolver?, onComplete?)
abort()        // 退出并清理
next() / skip()
complete()     // 手动收尾（触发 onComplete）
retryLost()    // 中断后重试：重新等待本步目标出现
```

### 行为开关

| 位置 | 字段 | 默认 | 作用 |
|---|---|---|---|
| `TourConfig` | `autoScroll` | `true` | 目标在视口外或被滚动容器裁切时，就绪那一刻自动滚到视野中央 |
| `TourConfig` | `onTargetLost` | 无 | 依附窗口被意外关闭时回调宿主（stepId / stepIndex / target / reason） |
| `TourStep` | `maskWhileWaiting` | `true` | 等待目标期间是否压全屏遮罩；需要用户点页面元素唤醒目标时置 `false` |

### 响应式状态（`tourState`，shallowReactive）

| 字段 | 类型 | 说明 |
|---|---|---|
| `active` | `boolean` | 是否有引导正在播放 |
| `stepIndex` | `number` | 当前步索引 |
| `totalSteps` | `number` | 总步数 |
| `highlightRect` | `HighlightRect \| null` | 当前高亮矩形 |
| `gatePass` | `boolean` | 当前步 gate 是否通过 |
| `waitingTarget` | `boolean` | 是否等待目标元素 |
| `waitTimedOut` | `boolean` | 等待是否超时 |
| `targetLost` | `boolean` | 依附窗口被意外关闭，引导已中断 |
| `lostReason` | `'' \| 'removed' \| 'hidden'` | 目标消失形态 |

### `onTargetLost` 回调（可选）

宿主可借此打点、弹自己的提示，或自动帮用户重开窗口：

```ts
const tourCreateTask: TourConfig = {
  key: 'create-task',
  name: '新建任务引导',
  accent: '#409eff',
  steps: [/* ... */],
  onTargetLost: ({ stepId, stepIndex, title, target, reason }) => {
    ElMessage.warning(`引导在第 ${stepIndex + 1} 步「${title}」中断（${reason}）`)
  }
}
```

### `resolver` 参数（可选）

宿主页面可提供自定义元素解析器，把 `target` 字符串映射为 `HTMLElement`。默认走 `document.querySelector`。用于组件 ref 模式（不通过 CSS 定位）。

```ts
const resolver: TargetResolver = (target) => {
  const [refName, childSel] = target.split(':')
  const el = (dialogRef.value as any)[refName]?.$el
  return childSel ? el?.querySelector(childSel) : el
}
startTour(config, resolver)
```

## 许可

MIT
