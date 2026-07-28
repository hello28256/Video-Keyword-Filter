/**
 * 适配器注册表：URL → SiteAdapter。
 * WHY: 让 content 脚本只需一行 getAdapterForUrl(url) 就能拿到正确适配器。
 */
import { bilibiliAdapter } from './bilibili';
import type { SiteAdapter } from './types';

export const adapters: readonly SiteAdapter[] = [bilibiliAdapter];

export function getAdapterForUrl(url: string | URL): SiteAdapter | null {
  try {
    const u = typeof url === 'string' ? new URL(url) : url;
    for (const adapter of adapters) {
      if (adapter.matches(u)) return adapter;
    }
  } catch {
    // WHY: 非法 URL 时返回 null，让上层优雅降级（不屏蔽任何内容）。
  }
  return null;
}
