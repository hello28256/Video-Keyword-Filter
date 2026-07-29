/**
 * Scanner：编排 findCards → extractCard → decide → applyHidden/removeHidden。
 * WHY: content 脚本的"屏蔽一个卡片"逻辑集中在一处，便于单测覆盖。
 *      跟踪 hidden 集合，保证配置翻转时能恢复；用 WeakSet 避免内存泄漏。
 */
import { decide } from '#core/matcher/decision';
import type { SiteAdapter, VideoCard } from '#core/adapter/types';
import type { FilterConfig } from '#types/config';
import { logger } from '#utils/logger';

export interface ScannerOptions {
  adapter: SiteAdapter;
  getConfig: () => FilterConfig;
  onHide?: (card: VideoCard) => void;
}

export interface Scanner {
  scanAll(root?: ParentNode): void;
  rescanAll(): void;
  /** 解除所有已隐藏卡片的标记 */
  unhideAll(): void;
}

export function createScanner(opts: ScannerOptions): Scanner {
  // WHY: 用 WeakSet 跟踪已处理过的 Element，O(1) 去重且不阻止 GC。
  // WHY: hidden Set 用普通 Set（不是 Weak），因为我们需要遍历恢复。
  const processed = new WeakSet<Element>();
  const hiddenElements = new Set<Element>();

  function processElement(el: Element, config: FilterConfig, isRescan = false): void {
    // WHY: 首次扫描时用 WeakSet 去重；rescan 时已隐藏的元素要走"翻转"路径，不能提前 return。
    if (!isRescan && processed.has(el)) return;
    const card = opts.adapter.extractCard(el);
    if (!card) {
      // WHY: 调试 —— extractCard 返回 null 说明 selector 抓到了非卡片元素。
      // 打印前 3 个失败原因（避免控制台被刷爆）
      const failCount = (el as Element & { __vkfFailCount?: number }).__vkfFailCount ?? 0;
      if (failCount < 3) {
        (el as Element & { __vkfFailCount?: number }).__vkfFailCount = failCount + 1;
        console.log('[VKF] ⚠️ extractCard 返回 null（不是真实卡片）', {
          tag: el.tagName,
          class: el.className?.toString?.()?.slice(0, 80) ?? '',
          hasTitle: !!el.querySelector('a[title]'),
          hasVideoLink: !!el.querySelector('a[href*="/video/"]'),
        });
      }
      return;
    }
    processed.add(el);

    const decision = decide({ title: card.title, author: card.author, site: opts.adapter.id }, config);
    el.setAttribute('data-vkf-reason', decision.reason);
    el.setAttribute('data-vkf-author', card.author ?? '');
    el.setAttribute('data-vkf-title', card.title.slice(0, 100));

    if (decision.hide) {
      console.log(
        '[VKF] 🔥 HIDE',
        `reason=${decision.reason}`,
        `title="${card.title.slice(0, 30)}"`,
        `author="${card.author}"`,
      );
      opts.adapter.applyHidden(el);
      hiddenElements.add(el);
      opts.onHide?.(card);
    } else if (hiddenElements.has(el)) {
      console.log('[VKF] 👀 UNHIDE (was hidden, now allowed)', `author="${card.author}"`);
      opts.adapter.removeHidden(el);
      hiddenElements.delete(el);
    } else if (card.author?.includes('徐云') || card.title.includes('徐云')) {
      console.log(
        '[VKF] ⚠️ 徐云相关但没隐藏',
        `reason=${decision.reason}`,
        `title="${card.title.slice(0, 30)}"`,
        `author="${card.author}"`,
        `expected=blacklist`,
      );
    }
  }

  return {
    scanAll(root: ParentNode = document) {
      try {
        const config = opts.getConfig();
        const cards = opts.adapter.findCards(root);
        for (const el of cards) {
          processElement(el, config);
        }
      } catch (err) {
        logger.error('scanner.scanAll', 'scan failed', {
          err: err instanceof Error ? err.message : String(err),
        });
      }
    },

    rescanAll() {
      // WHY: 重新走全量扫描，让"配置变更 → 卡片显隐翻转"在一次调用里完成。
      // processed 用 WeakSet，无需重置；hiddenElements 在 processElement 中按需更新。
      // isRescan=true 让已隐藏元素也能重新评估 → 触发"恢复显示"分支。
      try {
        const config = opts.getConfig();
        const all = opts.adapter.findCards(document);
        for (const el of all) {
          processElement(el, config, true);
        }
        // 处理已被 DOM 移除的 hidden 元素（不再遍历，但 hidden 集合里的引用留着无意义）
        // 弱引用 GC 会自动清理，无需手动 delete。
      } catch (err) {
        logger.error('scanner.rescanAll', 'rescan failed', {
          err: err instanceof Error ? err.message : String(err),
        });
      }
    },

    unhideAll() {
      for (const el of hiddenElements) {
        try {
          opts.adapter.removeHidden(el);
        } catch (err) {
          logger.error('scanner.unhideAll', 'removeHidden failed', {
            err: err instanceof Error ? err.message : String(err),
          });
        }
      }
      hiddenElements.clear();
    },
  };
}
