import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      // demo 直接跑库源码，改引擎代码即时生效（无需先 build dist）
      'tour-guide-coach': resolve(__dirname, '../src/index.ts'),
      'vue-tour-guide': resolve(__dirname, '../src/index.ts'),
      '@': resolve(__dirname, '../src')
    }
  }
})
