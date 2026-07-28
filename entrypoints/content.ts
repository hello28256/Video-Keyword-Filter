/**
 * Content script 主入口。
 * 职责：
 *   1. 解析当前 URL 找到对应 SiteAdapter
 *   2. 注入 CSS 兜底
 *   3. 启动 scanner + MutationObserver
 *   4. 监听 storage 变化实时 rescan
 */
import { defineContentScript } from '#imports';
import { getAdapterForUrl } from '#core/adapter/registry';
import { createScanner } from '#core/dom/scanner';
import { createObserver } from '#core/dom/observer';
import { ensureBaseStyle } from '#core/dom/injector';
import { getConfig, watchConfig, incrementStats } from '#core/storage/accessors';
import type { FilterConfig } from '#types/config';
import type { ContentScriptContext } from '#imports';
import { logger } from '#utils/logger';

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
  // WHY: 抖音详情页的播放器在跨域 iframe 中；先打开这个开关为后续 Phase 2 做准备。
  //      MVP 阶段仅 bilibili，不影响行为（bilibili 没有跨域 iframe）。
  allFrames: false,
  async main(ctx: ContentScriptContext) {
    const adapter = getAdapterForUrl(window.location.href);
    if (!adapter) {
      logger.debug('content', 'no adapter for current URL, skip', { href: window.location.href });
      return;
    }

    ensureBaseStyle(document);

    // WHY: 缓存当前 config，scanner 每次按需取；getConfig 是 async，这里闭包捕获引用即可。
    let currentConfig = await getConfig();

    const scanner = createScanner({
      adapter,
      getConfig: () => currentConfig,
      onHide: () => {
        // 命中时异步通知 background 累加统计；不 await 避免阻塞 scanner。
        incrementStats(adapter.id).catch((err) =>
          logger.error('content.incrementStats', 'failed', {
            err: err instanceof Error ? err.message : String(err),
          }),
        );
      },
    });

    const observer = createObserver({
      target: document.body,
      debounceMs: 200,
      onMutations: () => {
        // WHY: DOM 增量变化时只对新增子树做扫描，避免每次全量。
        //      scanner.scanAll 默认扫全 document，对绝大多数视频站足够；性能瓶颈可后续优化。
        scanner.scanAll(document);
      },
    });

    // 1) 启动时立刻全量扫一次
    scanner.scanAll(document);
    observer.start();

    // 2) 监听 storage 变化 → 更新本地 config + rescan
    const unwatch = watchConfig((newConfig) => {
      currentConfig = newConfig;
      scanner.rescanAll();
    });

    // 3) 监听 background 兜底广播（应对 MV3 service worker 唤醒时漏 watch）
    const onMessage = (msg: unknown) => {
      if (
        msg &&
        typeof msg === 'object' &&
        'type' in msg &&
        (msg as { type: string }).type === 'CONFIG_UPDATED' &&
        'config' in msg
      ) {
        currentConfig = (msg as { config: FilterConfig }).config;
        scanner.rescanAll();
      }
    };
    browser.runtime.onMessage.addListener(onMessage);

    // WHY: ctx.onInvalidated 在 content 脚本被卸载时触发（HMR、tab 关闭、扩展更新）。
    //      必须在此清理 observer / 取消 watch，否则会内存泄漏 + 触发已死上下文。
    ctx.onInvalidated(() => {
      observer.stop();
      unwatch();
      browser.runtime.onMessage.removeListener(onMessage);
      scanner.unhideAll();
      logger.debug('content', 'invalidated, cleaned up');
    });

    logger.info('content', 'content script initialized', { site: adapter.id });
  },
});
