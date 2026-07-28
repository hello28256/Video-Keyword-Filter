/**
 * MutationObserver 工厂：带 debounce，避免 SPA 滚动时高频回调。
 * WHY: 三家视频网站都用无限滚动 / SPA 路由，DOM 变化每秒可达数十次。
 *      集中一个工厂，让所有 SiteAdapter 复用同一份防抖 + 清理逻辑。
 */
import { debounce } from '#utils/debounce';
import { logger } from '#utils/logger';

export interface ObserverOptions {
  target: Node;
  onMutations: (mutations: MutationRecord[]) => void;
  debounceMs?: number;
}

export interface DOMObserver {
  start(): void;
  stop(): void;
}

export function createObserver(opts: ObserverOptions): DOMObserver {
  const debounceMs = opts.debounceMs ?? 200;
  let mo: MutationObserver | null = null;
  // WHY: 用 trailing-edge 收集 mutations 后再触发；保留 mutations 数组给上层做增量分析。
  const debouncedFire = debounce((muts: MutationRecord[]) => {
    try {
      opts.onMutations(muts);
    } catch (err) {
      logger.error('createObserver.onMutations', 'callback threw', {
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }, debounceMs);

  return {
    start() {
      if (mo) return;
      mo = new MutationObserver((muts) => debouncedFire(muts));
      mo.observe(opts.target, { childList: true, subtree: true });
      logger.debug('createObserver', 'observer started', { debounceMs });
    },
    stop() {
      if (!mo) return;
      mo.disconnect();
      mo = null;
      debouncedFire.cancel();
      logger.debug('createObserver', 'observer stopped');
    },
  };
}
