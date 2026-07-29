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

  // WHY: 调试用 —— 对每个不同的 class 组合只打一次"extractCard 失败"日志（避免 37 个相同 class 把控制台刷爆）
  const reportedFailClasses = new Set<string>();
  let failLogCount = 0;

  function processElement(el: Element, config: FilterConfig, isRescan = false): void {
    if (!isRescan && processed.has(el)) return;
    const card = opts.adapter.extractCard(el);
    if (!card) {
      const cls = el.className?.toString?.() ?? '';
      const sig = `${el.tagName}.${cls}`.slice(0, 100);
      if (!reportedFailClasses.has(sig) && failLogCount < 10) {
        reportedFailClasses.add(sig);
        failLogCount++;
        console.log('[VKF] ⚠️ extractCard 返回 null（不是真实卡片）', {
          sig,
          tag: el.tagName,
          class: cls.slice(0, 80),
          hasTitle: !!el.querySelector('a[title]'),
          hasVideoLink: !!el.querySelector('a[href*="/video/"]'),
          sampleText: el.textContent?.trim()?.slice(0, 50),
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
      console.log('[VKF] 👀 UNHIDE', `author="${card.author}"`);
      opts.adapter.removeHidden(el);
      hiddenElements.delete(el);
    } else if (card.author?.includes('徐云') || card.title.includes('徐云')) {
      console.log(
        '[VKF] ⚠️ 徐云相关但没隐藏',
        `reason=${decision.reason}`,
        `title="${card.title.slice(0, 30)}"`,
        `author="${card.author}"`,
      );
    }
  }

  return {
    scanAll(root: ParentNode = document) {
      try {
        const config = opts.getConfig();
        const cards = opts.adapter.findCards(root);
        // WHY: 调试 —— 每次扫描打印找到的卡片数
        console.log('[VKF] scanAll: 找到', cards.length, '张卡片');
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
      try {
        const config = opts.getConfig();
        const all = opts.adapter.findCards(document);
        console.log('[VKF] rescanAll: 找到', all.length, '张卡片');
        for (const el of all) {
          processElement(el, config, true);
        }
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
