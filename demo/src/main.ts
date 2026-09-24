import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import * as ElementPlusIcons from '@element-plus/icons-vue'
import 'element-plus/dist/index.css'
import { tourState } from 'tour-guide-coach'
import App from './App.vue'

const app = createApp(App)
app.use(ElementPlus, { locale: zhCn })
for (const [name, component] of Object.entries(ElementPlusIcons)) {
  app.component(name, component)
}
app.mount('#app')

// demo 专用把手：控制台里 `__tour.active / __tour.targetLost` 直接观察状态机
;(window as unknown as { __tour: typeof tourState }).__tour = tourState
