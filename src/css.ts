/**
 * CSS 自动注入：组件模块加载时把样式注入到 <head>。
 * 不依赖任何构建插件，不管 Vite/Webpack/Rollup 怎么处理预构建都可靠。
 */
const STYLE_ID = 'tour-guide-coach-styles'

const CSS = `
.tour-root{--tg-primary:var(--el-color-primary,#409eff);--tg-success:var(--el-color-success,#67c23a);--tg-warning:var(--el-color-warning,#e6a23c);--tg-danger:var(--el-color-danger,#f56c6c);--tg-text-1:var(--el-text-color-primary,#303133);--tg-text-2:var(--el-text-color-regular,#606266);--tg-text-3:var(--el-text-color-secondary,#909399);--tg-border:var(--el-border-color-lighter,#ebeef5);--tg-fill-light:var(--el-fill-color-light,#f5f7fa);--tg-radius:var(--el-border-radius-base,4px);position:fixed;inset:0;z-index:100000;pointer-events:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',sans-serif}
.tour-mask-svg{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:hidden}
.tour-mask-path{fill:rgba(0,0,0,.55);pointer-events:auto;cursor:not-allowed}
.tour-highlight{z-index:100001}
.tour-autoguard{position:fixed;z-index:100001;background:transparent;border-radius:8px;cursor:not-allowed;pointer-events:auto}
.tg-btn{display:inline-flex;align-items:center;justify-content:center;border:1px solid var(--tg-border);border-radius:var(--tg-radius);background:#fff;color:var(--tg-text-2);font-size:14px;font-weight:500;line-height:1;padding:8px 15px;cursor:pointer;transition:color .2s,border-color .2s,background .2s;outline:none;white-space:nowrap;user-select:none}
.tg-btn:hover{color:var(--tg-primary);border-color:var(--tg-primary);background:#ecf5ff}
.tg-btn--sm{padding:5px 11px;font-size:12px}
.tg-btn--primary{background:var(--tg-primary);border-color:var(--tg-primary);color:#fff}
.tg-btn--primary:hover{opacity:.85;background:var(--tg-primary);color:#fff}
.tg-btn:disabled{opacity:.55;cursor:not-allowed;pointer-events:none}
.tg-btn--warning{background:var(--tg-warning);border-color:var(--tg-warning);color:#fff}
.tg-btn--warning:hover{opacity:.85;background:var(--tg-warning);color:#fff}
.tg-btn--link{border:none;background:none;padding:4px 6px;color:var(--tg-text-3)}
.tg-btn--link:hover{color:var(--tg-primary);background:none}
.tour-popover{z-index:100002;background:#fff;border-radius:12px;padding:20px 24px;box-shadow:0 8px 40px rgba(0,0,0,.12),0 2px 8px rgba(0,0,0,.06);animation:tg-tp-in .3s ease;pointer-events:auto;min-width:280px;max-width:420px}
@keyframes tg-tp-in{from{opacity:0;transform:translateY(6px) scale(.97)}to{opacity:1;transform:translateY(0) scale(1)}}
.tp-head{display:flex;align-items:center;gap:10px;margin-bottom:12px}
.tp-step-no{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;color:#fff;font-size:14px;font-weight:700;flex-shrink:0}
.tp-required{color:var(--tg-danger);font-size:20px;font-weight:700;line-height:1}
.tp-title{font-size:16px;font-weight:700;color:var(--tg-text-1)}
.tp-of{font-size:13px;color:var(--tg-text-3);margin-left:auto;font-variant-numeric:tabular-nums}
.tp-content{margin:0 0 14px;font-size:14px;line-height:1.8;color:var(--tg-text-2);white-space:pre-line}
.tp-tip{font-size:13px;color:#529b2e;background:#f0f9eb;padding:8px 12px;border-radius:6px;margin-bottom:10px;border-left:3px solid #67c23a}
.tp-warn{font-size:13px;color:#b88230;background:#fdf6ec;padding:8px 12px;border-radius:6px;margin-bottom:10px;border-left:3px solid #e6a23c}
.tp-foot{display:flex;align-items:center;justify-content:space-between;padding-top:14px;border-top:1px solid var(--tg-border)}
.tp-btns{display:flex;gap:10px}
.tp-gate{display:inline-flex;align-items:center;gap:5px;font-size:13px;color:var(--tg-warning);font-weight:500}
.tp-gate-icon{flex-shrink:0}
.tp-click-hint{font-size:14px;color:var(--tg-primary);font-weight:500;animation:tg-pulse 1.5s ease-in-out infinite}
@keyframes tg-pulse{0%,100%{opacity:1}50%{opacity:.5}}
.tour-waiting{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:100002;background:#fff;padding:32px 40px;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,.15);text-align:center;pointer-events:auto;display:flex;flex-direction:column;align-items:center;gap:8px}
.tour-waiting p{margin:4px 0 8px;font-size:14px;color:var(--tg-text-2)}
.tour-lost{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:100002;pointer-events:auto;max-width:min(620px,calc(100vw - 32px))}
.tl-main{display:flex;align-items:center;gap:12px;background:#fff;border-radius:12px;padding:14px 18px;box-shadow:0 8px 32px rgba(0,0,0,.18);border-left:3px solid var(--tg-warning);animation:tg-tp-in .3s ease}
.tl-icon{flex-shrink:0}
.tl-text{flex:1;min-width:0}
.tl-title{margin:0 0 2px;font-size:14px;font-weight:700;color:var(--tg-text-1)}
.tl-msg{margin:0;font-size:13px;line-height:1.6;color:var(--tg-text-2)}
.tl-main .tg-btn{flex-shrink:0}
.tg-spin{animation:tg-rotate 1s linear infinite}
@keyframes tg-rotate{from{transform:rotate(0)}to{transform:rotate(360deg)}}
`

let injected = false

export function injectStyles(): void {
  if (injected || typeof document === 'undefined') return
  if (document.getElementById(STYLE_ID)) { injected = true; return }
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = CSS
  document.head.appendChild(style)
  injected = true
}
