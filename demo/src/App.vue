<template>
  <div class="demo-page">
    <header class="dp-head">
      <div>
        <h1>tour-guide-coach · Demo</h1>
        <p class="dp-desc">交互式漫游引导引擎 — 每个场景都标注了「要观察什么」，配合右下角状态日志判断行为是否正确。</p>
      </div>
      <div class="dp-head-actions">
        <el-tooltip content="目标不在视口内时自动滚到高亮位置（TourConfig.autoScroll）" placement="bottom">
          <span class="dp-switch">
            <span>自动滚动到高亮</span>
            <el-switch v-model="autoScroll" size="small" />
          </span>
        </el-tooltip>
        <el-tag v-if="running" type="warning" effect="dark">引导进行中</el-tag>
        <el-button v-if="running" @click="abort()">停止当前引导</el-button>
      </div>
    </header>

    <main class="dp-main">
      <!-- 业务区放最前：让多数高亮目标默认就在视口内（滚动跟随另有专门场景） -->
      <Playground ref="playground" />

      <section v-for="g in groups" :key="g.name" class="dp-group">
        <h2>{{ g.name }}</h2>
        <div class="dp-cards">
          <article v-for="s in g.items" :key="s.config.key" class="dp-card" :class="{ 'is-active': runningKey === s.config.key }">
            <h3>{{ s.config.name }}</h3>
            <p class="dp-focus">{{ s.focus }}</p>
            <p class="dp-expect"><strong>观察：</strong>{{ s.expect }}</p>
            <p v-if="s.pre" class="dp-pre"><strong>前置：</strong>{{ s.pre }}</p>
            <el-button size="small" type="primary" plain :disabled="running && runningKey !== s.config.key" @click="launch(s)">
              {{ runningKey === s.config.key && running ? '进行中…' : '开始引导' }}
            </el-button>
          </article>
        </div>
      </section>
    </main>

    <aside class="dp-side">
      <LogPanel />
      <el-card shadow="never" header="操作提示" class="dp-tips">
        <p>· ESC 随时退出引导</p>
        <p>· 灰色遮罩区点击被静默拦截，只有洞口内可操作</p>
        <p>· 「意外关窗」类场景请按提示真的去关窗口</p>
        <p>· 窗口缩到 1024×700 以下再看边界翻转更明显</p>
      </el-card>
    </aside>

    <!-- 全局蒙版：内部 Teleport to body，挂哪都行 -->
    <TourOverlay />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { TourOverlay, abort, startTour, tourState } from 'tour-guide-coach'
import Playground from './components/Playground.vue'
import LogPanel from './components/LogPanel.vue'
import { scenarios, type Scenario } from './tours'
import { clearTourLog, tourLog, watchTourState } from './use-tour-log'

const playground = ref<InstanceType<typeof Playground> | null>(null)
const running = ref(false)
const runningKey = ref('')
/** 演示 TourConfig.autoScroll 开关（默认开） */
const autoScroll = ref(true)

/** 引擎是唯一事实来源：active 掉了就收工，不靠探测 DOM 存在与否 */
watch(() => tourState.active, (isActive) => {
  if (!isActive) { running.value = false; runningKey.value = '' }
})

const groups = computed(() => {
  const order: string[] = []
  const map = new Map<string, Scenario[]>()
  for (const s of scenarios) {
    if (!map.has(s.group)) { map.set(s.group, []); order.push(s.group) }
    map.get(s.group)!.push(s)
  }
  return order.map((name) => ({ name, items: map.get(name)! }))
})

function launch(s: Scenario): void {
  if (running.value) abort()
  clearTourLog()
  playground.value?.reset()
  running.value = true
  runningKey.value = s.config.key
  tourLog(`场景「${s.config.name}」启动`, 'info')
  // 不污染导出的配置对象，按需覆盖 autoScroll
  startTour({ ...s.config, autoScroll: autoScroll.value }, undefined, () => {
    ElMessage.success('引导完成')
    tourLog('✓ 全部步骤完成，触发 onComplete', 'ok')
  })
}

onMounted(watchTourState)
</script>

<style>
body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif; background: #f5f7fa; }
.demo-page { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 20px; max-width: 1280px; margin: 0 auto; padding: 28px 20px 80px; }
.dp-head { grid-column: 1 / -1; display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.dp-head h1 { font-size: 24px; margin: 0 0 6px; }
.dp-desc { color: #606266; font-size: 13px; margin: 0; line-height: 1.7; }
.dp-head-actions { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
.dp-switch { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: #606266; cursor: help; }
.dp-main { min-width: 0; }
.dp-group { margin-bottom: 22px; }
.dp-group h2 { font-size: 14px; color: #303133; margin: 0 0 10px; padding-left: 8px; border-left: 3px solid #409eff; }
.dp-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; }
.dp-card { background: #fff; border: 1px solid #ebeef5; border-radius: 8px; padding: 14px; display: flex; flex-direction: column; gap: 6px; }
.dp-card.is-active { border-color: #409eff; box-shadow: 0 0 0 2px #ecf5ff; }
.dp-card h3 { font-size: 14px; margin: 0; }
.dp-focus { font-size: 12px; color: #909399; margin: 0; line-height: 1.6; }
.dp-expect, .dp-pre { font-size: 12px; color: #606266; margin: 0; line-height: 1.6; }
.dp-pre { color: #b88230; }
.dp-side { display: flex; flex-direction: column; gap: 12px; }
.dp-tips :deep(p) { margin: 0 0 6px; font-size: 12px; color: #606266; line-height: 1.7; }
</style>
