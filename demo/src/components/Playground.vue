<!--
  demo 的业务 UI：所有引导目标元素都住在这里
  -----------------------------------------------------------------
  刻意复刻真实后台的形态：主按钮 → 一级弹窗（destroy-on-close）→ 二级弹窗、
  滚动容器、视口贴边按钮、动态生成的元素、多个下拉共存。
-->
<template>
  <div class="pg">
    <!-- 主入口 -->
    <div class="pg-toolbar">
      <el-button id="demo-create-btn" type="primary" :icon="Plus" @click="openA">新建项目</el-button>
      <el-button id="demo-lazy-btn" @click="lazyVisible = !lazyVisible">
        {{ lazyVisible ? '移除' : '生成' }}目标元素
      </el-button>
      <el-tag v-if="lazyVisible" id="demo-lazy-target" type="success" size="large" effect="dark">
        我是动态生成的目标
      </el-tag>
    </div>

    <div class="pg-grid">
      <!-- 滚动容器内的深层目标 -->
      <el-card shadow="never" header="滚动容器（内含深层目标）">
        <div class="pg-scroll">
          <p v-for="i in 8" :key="i" class="pg-row">占位行 {{ i }} —— 往下滚</p>
          <div id="demo-deep-target" class="pg-deep">深层目标元素（需要滚动才看得见）</div>
          <p v-for="i in 4" :key="`t${i}`" class="pg-row">占位行 尾{{ i }}</p>
        </div>
      </el-card>

      <!-- 多个 popper 共存 -->
      <el-card shadow="never" header="多 popper 共存（两个下拉）">
        <div class="pg-popper">
          <!-- 注意：id 在 el-select 上是组件 prop，会被 EP 挂到内部 <input>；
               要框住整个 select 根节点，用 fall-through 的 data-tour -->
          <el-select data-tour="multi-a" v-model="multiA" placeholder="下拉 A" style="width:150px">
            <el-option v-for="o in opts" :key="`a${o}`" :label="o" :value="o" />
          </el-select>
          <el-select data-tour="multi-b" v-model="multiB" placeholder="下拉 B" style="width:150px">
            <el-option v-for="o in opts" :key="`b${o}`" :label="o" :value="o" />
          </el-select>
        </div>
        <p class="pg-note">先打开 A 再关闭，然后打开 B：body 末尾会同时存在两个面板，其中一个 display:none。</p>
      </el-card>
    </div>

    <!-- 视口贴边目标：制造「首选方位必然越界」的条件 -->
    <button id="demo-edge-top" class="pg-edge pg-edge--top">贴顶</button>
    <button id="demo-edge-bottom" class="pg-edge pg-edge--bottom">贴底</button>
    <button id="demo-edge-left" class="pg-edge pg-edge--left">贴左</button>
    <button id="demo-edge-right" class="pg-edge pg-edge--right">贴右</button>

    <!-- 弹窗 A：一级表单弹窗 -->
    <el-dialog v-model="visibleA" title="新建项目" width="520px" destroy-on-close>
      <el-form :model="form" label-width="80px">
        <el-form-item label="名称" required>
          <el-input v-model="form.name" placeholder="输入项目名称" />
        </el-form-item>
        <el-form-item label="分类">
          <!-- data-tour-value：宿主自己把组件状态镜像到 DOM，gate 不必依赖 Element Plus 内部类名 -->
          <el-select v-model="form.category" :data-tour-value="form.category" placeholder="选择分类" style="width:100%">
            <el-option v-for="o in opts" :key="o" :label="o" :value="o" />
          </el-select>
        </el-form-item>
        <el-form-item label="日期">
          <el-date-picker v-model="form.date" type="date" placeholder="选择日期" style="width:100%" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="2" placeholder="选填" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="visibleA = false">取消</el-button>
        <el-button id="demo-open-class" @click="visibleB = true">选择目标班级</el-button>
        <el-button type="primary" @click="submitA">确定</el-button>
      </template>
    </el-dialog>

    <!-- 弹窗 B：二级选择弹窗，叠在 A 之上 -->
    <el-dialog v-model="visibleB" title="选择目标班级" width="420px" append-to-body>
      <p class="pg-note">学生端按所属班级筛选可见的任务（至少一个）。</p>
      <el-checkbox-group id="demo-class-group" v-model="classes">
        <el-checkbox v-for="c in classOptions" :key="c" :value="c" :label="c" />
      </el-checkbox-group>
      <template #footer>
        <el-button @click="visibleB = false">取消</el-button>
        <el-button id="demo-class-confirm" type="primary" @click="visibleB = false">确认选择</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { Plus } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

const opts = ['前端', '后端', 'AI', '工具']
const classOptions = ['计科 2101', '计科 2102', '软工 2101', '人工智能 2101']

const visibleA = ref(false)
const visibleB = ref(false)
const lazyVisible = ref(false)
const multiA = ref('')
const multiB = ref('')
const classes = ref<string[]>([])
const form = reactive({ name: '', category: '', date: '', remark: '' })

function openA(): void {
  visibleA.value = true
}

function submitA(): void {
  ElMessage.success(`已提交：${form.name || '未命名'}（demo 不真写数据）`)
  visibleA.value = false
}

/** 启动新场景前把 UI 恢复干净，避免上一步残留干扰判断 */
function reset(): void {
  visibleA.value = false
  visibleB.value = false
  lazyVisible.value = false
  multiA.value = ''
  multiB.value = ''
  classes.value = []
  form.name = ''
  form.category = ''
  form.date = ''
  form.remark = ''
}

defineExpose({ reset })
</script>

<style scoped>
.pg { margin-bottom: 24px; }
.pg-toolbar { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
.pg-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.pg-scroll { height: 220px; overflow-y: auto; border: 1px solid #ebeef5; border-radius: 6px; padding: 8px 12px; }
.pg-row { color: #c0c4cc; font-size: 13px; margin: 6px 0; }
.pg-deep { background: #ecf5ff; border: 1px dashed #409eff; color: #409eff; padding: 14px; border-radius: 6px; font-size: 14px; }
.pg-popper { display: flex; gap: 12px; }
.pg-note { color: #909399; font-size: 12px; line-height: 1.7; margin: 8px 0 0; }
.pg-edge { position: fixed; z-index: 1; border: 1px solid #dcdfe6; background: #fff; color: #909399; font-size: 12px; padding: 6px 10px; border-radius: 4px; cursor: default; }
.pg-edge--top { top: 0; left: 50%; transform: translateX(-50%); border-radius: 0 0 4px 4px; }
.pg-edge--bottom { bottom: 0; left: 50%; transform: translateX(-50%); border-radius: 4px 4px 0 0; }
.pg-edge--left { left: 0; top: 50%; transform: translateY(-50%); border-radius: 0 4px 4px 0; }
.pg-edge--right { right: 0; top: 50%; transform: translateY(-50%); border-radius: 4px 0 0 4px; }
</style>
