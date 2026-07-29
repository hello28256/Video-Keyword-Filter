/**
 * Content script 主入口。
 * 职责：
 *   1. 解析当前 URL 找到对应 SiteAdapter
 *   2. 注入 CSS 兜底
 *   3. 启动 scanner + MutationObserver
 *   4. 监听 storage 变化实时 rescan
 *
 * ⚠️ 调试模式 (DEBUG_VKF=true): 控制台会输出每张卡片的 title/author/decision
 *    方便诊断"为什么这张卡没被隐藏"。在 DevTools Console 里可以过滤 "VKF"。
 */
import { defineContentScript } from '#imports';
import { getAdapterForUrl } from '#core/adapter/registry';
import { createScanner } from '#core/dom/scanner';
import { createObserver } from '#core/dom/observer';
import { ensureBaseStyle } from '#core/dom/injector';
import { getConfig, watchConfig, incrementStats } from '#core/storage/accessors';
import type { FilterConfig } from '#types/config';
import type { ContentScriptContext } from '#imports';

const DEBUG = true; // ⚠️ 调试模式：输出每张卡片的扫描结果
const tag = (msg: string): string => `[VKF] ${msg}`;
const log = (msg: string, ...args: unknown[]): void => {
  if (DEBUG) console.log(tag(msg), ...args);
};
const warn = (msg: string, ...args: unknown[]): void => {
  console.warn(tag(msg), ...args);
};

export default defineContentScript({
  matches: [
    '*://www.bilibili.com/*',
    '*://search.bilibili.com/*',
    // Phase 2: 加入 douyin 与 youtube
    // '*://www.douyin.com/*',
    // '*://youtube.com/*',
    // '*://www.youtube.com/*',
  ],
  runAt: 'document_idle',
  allFrames: false,
  async main(ctx: ContentScriptContext) {
    log('=== content script main() START ===', { href: window.location.href });

    const adapter = getAdapterForUrl(window.location.href);
    if (!adapter) {
      warn('no adapter for current URL, skip', { href: window.location.href });
      return;
    }
    log('adapter matched:', adapter.id);

    ensureBaseStyle(document);
    log('CSS 兜底 style injected');

    let currentConfig = await getConfig();
    // WHY: 详细打印 config 实际值（之前用 Object 浏览器折叠了看不清）
    log('config loaded from storage:', JSON.stringify({
      enabled: currentConfig.enabled,
      keywords: currentConfig.keywords,
      blacklist: currentConfig.blacklist,
      whitelist: currentConfig.whitelist,
      siteEnabled: currentConfig.siteEnabled,
    }, null, 2));

    const scanner = createScanner({
      adapter,
      getConfig: () => currentConfig,
      onHide: (card) => {
        log('🔥 HIDDEN', { title: card.title?.slice(0, 40), author: card.author, url: card.url });
        incrementStats(adapter.id).catch(() => {
          /* 统计失败不影响屏蔽 */
        });
      },
    });

    const observer = createObserver({
      target: document.body,
      debounceMs: 200,
      onMutations: () => {
        // 每次 DOM 变化时打印当前 config（确认 popup 改动后 watch 是否触发）
        log('DOM mutation → rescan', {
          keywords: currentConfig.keywords,
          blacklist: currentConfig.blacklist,
        });
        scanner.scanAll(document);
      },
    });

    // 1) 启动时立刻全量扫一次
    log('=== 第一次全量扫描 ===');
    scanner.scanAll(document);
    observer.start();

    // 2.5) 兜底：定时全量扫描（应对 B 站虚拟列表懒加载，scroll 不会触发 MutationObserver 时漏卡）
    const intervalId = setInterval(() => {
      scanner.scanAll(document);
    }, 2000);
    log('兜底定时扫描已启动（每 2s）');

    // 2.6) 兜底：监听 window 滚动，触发扫描
    const onScroll = () => {
      // scroll 事件高频, 但 scanner 内部 WeakSet 去重, 性能可控
      scanner.scanAll(document);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    log('scroll 监听已注册');

    // 2) 监听 storage 变化
    const unwatch = watchConfig((newConfig) => {
      log('📦 storage watch 触发，config 更新', {
        keywords: newConfig.keywords,
        blacklist: newConfig.blacklist,
        whitelist: newConfig.whitelist,
      });
      currentConfig = newConfig;
      scanner.rescanAll();
    });
    log('storage.watch 已注册');

    // 3) 监听 background 兜底广播
    const onMessage = (msg: unknown) => {
      if (
        msg &&
        typeof msg === 'object' &&
        'type' in msg &&
        (msg as { type: string }).type === 'CONFIG_UPDATED' &&
        'config' in msg
      ) {
        log('📨 收到 background CONFIG_UPDATED 消息');
        currentConfig = (msg as { config: FilterConfig }).config;
        scanner.rescanAll();
      }
    };
    browser.runtime.onMessage.addListener(onMessage);

    ctx.onInvalidated(() => {
      observer.stop();
      unwatch();
      browser.runtime.onMessage.removeListener(onMessage);
      clearInterval(intervalId);
      window.removeEventListener('scroll', onScroll);
      scanner.unhideAll();
      log('content script invalidated, cleaned up');
    });

    log('=== content script main() END ===', { site: adapter.id });
  },
});
