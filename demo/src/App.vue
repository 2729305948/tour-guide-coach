<template>
  <div class="demo-page">
    <h1>Vue Tour Guide · Demo</h1>
    <p class="desc">轻量级交互式漫游引导引擎 — 点击「开始引导」体验完整流程</p>

    <!-- 触发按钮（引导第一步高亮目标） -->
    <el-button id="demo-create-btn" type="primary" :icon="Plus" @click="dialogVisible = true">
      新建项目
    </el-button>

    <!-- 表单弹窗（引导的被引导组件） -->
    <el-dialog v-model="dialogVisible" title="新建项目" width="520px" destroy-on-close>
      <el-form :model="form" label-width="80px">
        <el-form-item label="名称" required>
          <el-input v-model="form.name" placeholder="输入项目名称" />
        </el-form-item>
        <el-form-item label="分类">
          <el-select v-model="form.category" placeholder="选择分类" style="width:100%">
            <el-option label="前端" value="fe" />
            <el-option label="后端" value="be" />
            <el-option label="AI" value="ai" />
            <el-option label="工具" value="tool" />
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
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="onSubmit">确定</el-button>
      </template>
    </el-dialog>

    <!-- 引导蒙版组件（挂在页面任意位置，内部 Teleport to body） -->
    <TourOverlay />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Plus } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { useTourStore, TourOverlay } from 'vue-tour-guide'
import { demoFormTour } from '../../src/configs/demo-form'

const tour = useTourStore()
const dialogVisible = ref(false)
const form = ref({ name: '', category: '', date: '', remark: '' })

function startTour(): void {
  tour.startTour(demoFormTour, undefined, () => {
    ElMessage.success('引导完成！')
  })
}

function onSubmit(): void {
  ElMessage.success('已提交（demo 不真写数据）')
  dialogVisible.value = false
}

// 页面加载后自动启动引导（演示用，实际项目里由用户触发）
setTimeout(startTour, 800)
</script>

<style>
body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
.demo-page {
  max-width: 800px;
  margin: 60px auto;
  padding: 0 20px;
}
.demo-page h1 {
  font-size: 28px;
  margin-bottom: 8px;
}
.demo-page .desc {
  color: #666;
  margin-bottom: 32px;
}
</style>
