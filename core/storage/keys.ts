/**
 * storage key 定义：直接用 chrome.storage.local 原生 API。
 * WHY: WXT 0.20 的 storage.defineItem 在模块加载时（content script 上下文）抛
 *      "'wxt/storage' must be loaded in a web extension environment" 错误
 *      （github.com/wxt-dev/wxt/issues/371），即使在扩展环境里也复现。
 *      改用 chrome.storage.local 绕过 wxt storage 抽象层，零依赖、最稳。
 */
import { browser, type Browser } from 'wxt/browser';
import { DEFAULT_CONFIG, SCHEMA_VERSION, DEFAULT_STATS, type DailyStats } from './schema';
import type { FilterConfig } from '#types/config';

/**
 * 类型安全的 storage item 抽象。
 * WHY: 自定义小包装替代 wxt/storage，规避 wxt #371 bug 同时保留 watch 能力。
 */
export interface StorageItem<T> {
  getValue(): Promise<T | null>;
  setValue(value: T): Promise<void>;
  watch(cb: (newValue: T | null, oldValue: T | null) => void): () => void;
}

function defineItem<T>(key: string, fallback: T): StorageItem<T> {
  return {
    async getValue() {
      try {
        const result = await browser.storage.local.get(key);
        // WHY: browser.storage 在 key 不存在时返回 {}，需要 fallback。
        return (result[key] as T | undefined) ?? fallback;
      } catch {
        return fallback;
      }
    },
    async setValue(value: T) {
      await browser.storage.local.set({ [key]: value });
    },
    watch(cb) {
      const listener = (
        changes: Record<string, Browser.storage.StorageChange>,
        area: string,
      ) => {
        if (area !== 'local' || !(key in changes)) return;
        const change = changes[key];
        if (change) cb((change.newValue as T | undefined) ?? null, (change.oldValue as T | undefined) ?? null);
      };
      browser.storage.onChanged.addListener(listener);
      return () => browser.storage.onChanged.removeListener(listener);
    },
  };
}

export const configItem = defineItem<FilterConfig>('local:config', DEFAULT_CONFIG);
export const statsItem = defineItem<DailyStats>('local:stats:daily', DEFAULT_STATS);
export const versionItem = defineItem<number>('local:version', SCHEMA_VERSION);

export const items = {
  config: configItem,
  stats: statsItem,
  version: versionItem,
} as const;
