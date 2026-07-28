/**
 * Background service worker。
 * 单一职责：在 storage.onChanged 时把新配置广播到所有匹配的 tab，
 *          兜底应对 content 脚本被 service worker 休眠错过 storage.watch 的情况。
 *
 * WHY: MV3 SW 可能被浏览器休眠，content 脚本的 storage.watch 在 SW 唤醒瞬间可能漏掉一次变更。
 *      这里作为最后一道兜底，强制所有 tab 重读 + 重扫。
 */
import { defineBackground } from '#imports';
import { items } from '#core/storage/keys';
import { logger } from '#utils/logger';
import type { RuntimeMessage } from '#types/messages';

// WHY: 集中维护 host 模式列表，与 wxt.config.ts 的 host_permissions 保持一致。
//      复制一份而不是 import 配置，是因为 background 入口不读 wxt.config.ts。
const HOST_PATTERNS = [
  '*://www.bilibili.com/*',
  '*://search.bilibili.com/*',
  // Phase 2: 加入 douyin/youtube
  // '*://www.douyin.com/*',
  // '*://youtube.com/*',
  // '*://www.youtube.com/*',
];

export default defineBackground(() => {
  // 1) 监听 storage 变化 → 广播 CONFIG_UPDATED
  const unwatchConfig = items.config.watch((newVal) => {
    if (!newVal) return;
    void broadcastConfig(newVal);
  });

  // 2) 监听 tab 更新（URL 变化时让 content 重读一次）
  browser.tabs.onUpdated.addListener((_tabId, changeInfo) => {
    if (changeInfo.url) {
      // WHY: SPA 路由切换通常不触发 tabs.onUpdated，但硬刷新 / 跨页跳转时会。
      //      此处只发 GET_STATUS 让 content 自报家门，避免无脑重扫。
      void broadcastMessage({ type: 'GET_STATUS' });
    }
  });

  // 3) service worker 卸载时清理（理论上 MV3 会自动清理，但显式更稳）
  //    SW 短命，不需额外 teardown；保留 unwatchConfig 是 best-effort。

  logger.info('background', 'service worker initialized');

  return () => {
    unwatchConfig();
  };
});

async function broadcastConfig(config: unknown): Promise<void> {
  try {
    const message: RuntimeMessage = { type: 'CONFIG_UPDATED', config: config as never };
    const tabs = await browser.tabs.query({ url: HOST_PATTERNS });
    for (const tab of tabs) {
      if (tab.id !== undefined) {
        browser.tabs.sendMessage(tab.id, message).catch(() => {
          // WHY: 某些 tab 还没注入 content 脚本（早期 race），catch 后下次变更再发即可。
        });
      }
    }
    logger.debug('background', 'config broadcast', { tabCount: tabs.length });
  } catch (err) {
    logger.error('background.broadcastConfig', 'failed', {
      err: err instanceof Error ? err.message : String(err),
    });
  }
}

async function broadcastMessage(message: RuntimeMessage): Promise<void> {
  try {
    const tabs = await browser.tabs.query({ url: HOST_PATTERNS });
    for (const tab of tabs) {
      if (tab.id !== undefined) {
        browser.tabs.sendMessage(tab.id, message).catch(() => {
          // 同上，忽略 race。
        });
      }
    }
  } catch (err) {
    logger.error('background.broadcastMessage', 'failed', {
      err: err instanceof Error ? err.message : String(err),
    });
  }
}
