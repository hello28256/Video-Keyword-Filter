/**
 * Popup 入口：挂载 Vue 应用。
 * WHY: 单独入口文件让 Vue 只在 popup 上下文跑（不进 content / background）。
 */
import { createApp } from 'vue';
import App from './App.vue';
import './style.css';

createApp(App).mount('#app');
