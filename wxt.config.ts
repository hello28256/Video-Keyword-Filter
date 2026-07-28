import { defineConfig } from 'wxt';
import { resolve } from 'node:path';

// WHY: 用 manifest_version 3（默认），content script 早期挂载以避免错过 SPA 首屏渲染。
// WHY: all_frames + match_about_blank 是抖音详情页跨域 iframe 的必要配置。
// WHY: host_permissions 集中管理，便于 WXT 在 build 时把 host_permissions 注入 manifest。
export default defineConfig({
  modules: ['@wxt-dev/module-vue'],
  // WHY: Vite/Rolldown 不读 tsconfig paths，必须在 vite.config 层再声明一次 alias，
  //      否则 build 时 `#core/...` 解析失败。
  vite: () => ({
    resolve: {
      alias: {
        '#core': resolve(__dirname, './core'),
        '#utils': resolve(__dirname, './utils'),
        '#types': resolve(__dirname, './types'),
      },
    },
  }),
  manifest: {
    name: 'Video Keyword Filter',
    description: '按关键词隐藏 B 站 / 抖音 / YouTube 视频卡片',
    permissions: ['storage', 'activeTab', 'scripting'],
    host_permissions: [
      'https://www.bilibili.com/*',
      'https://search.bilibili.com/*',
      'https://www.douyin.com/*',
      'https://youtube.com/*',
      'https://www.youtube.com/*',
      'https://m.youtube.com/*',
    ],
  },
  imports: {
    // devtools: true, // 调试自动 import 时开启
  },
});
