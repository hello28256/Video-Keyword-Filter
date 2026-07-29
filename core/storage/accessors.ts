/**
 * storage 访问层：上层（content/popup）只调这里，不直接接触 wxt/storage。
 * WHY: 隔离浏览器 API 依赖，让上层逻辑可测试；同时把 watch 收成单一入口。
 */
import { items } from './keys';
import { DEFAULT_CONFIG, migrateConfig } from './schema';
import type { FilterConfig, SiteId } from '#types/config';

/**
 * 读主配置。
 * WHY: 老版本 storage 缺字段（如 v1 没 blacklist）时，migrateConfig 自动补默认值；
 *      不在 wxt 层做 migration（wxt 0.20 的 migration runner 在某些版本会触发
 *      "must be loaded in a web extension environment" 错误）。
 */
export async function getConfig(): Promise<FilterConfig> {
  try {
    const raw = await items.config.getValue();
    // WHY: 即使 storage 里有数据，也走 migrateConfig 兜底（兼容老数据缺字段）。
    return migrateConfig(raw);
  } catch {
    // WHY: storage 损坏/读失败时返回默认值而不是抛错，避免 content 脚本崩溃。
    return DEFAULT_CONFIG;
  }
}

/**
 * 部分更新主配置（浅 merge）。WHY: popup 通常只改 keywords，不重写整个 config。
 */
export async function updateConfig(patch: Partial<FilterConfig>): Promise<FilterConfig> {
  const current = await getConfig();
  const next: FilterConfig = { ...current, ...patch };
  if (patch.siteEnabled) {
    next.siteEnabled = { ...current.siteEnabled, ...patch.siteEnabled };
  }
  if (patch.matcherOptions) {
    next.matcherOptions = { ...current.matcherOptions, ...patch.matcherOptions };
  }
  await items.config.setValue(next);
  return next;
}

/**
 * 监听主配置变化。
 * WHY: storage.watch 在 MV3 下跨 tab 实时生效；content 脚本用它感知 popup 改动。
 * 返回的 unwatch 用于 ctx.onInvalidated 时清理，避免内存泄漏。
 */
export function watchConfig(cb: (newConfig: FilterConfig) => void): () => void {
  return items.config.watch((newVal: FilterConfig | null | undefined) => {
    if (newVal) cb(newVal);
  });
}

/**
 * 隐藏统计自增（content 脚本检测到命中时调用）。
 */
export async function incrementStats(site: SiteId): Promise<void> {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const current = await items.stats.getValue();
    if (!current || current.date !== today) {
      // WHY: 跨天或首次写入时重置统计，避免历史堆积。
      await items.stats.setValue({
        date: today,
        perSite: { bilibili: 0, douyin: 0, youtube: 0, [site]: 1 },
      });
      return;
    }
    await items.stats.setValue({
      date: current.date,
      perSite: { ...current.perSite, [site]: (current.perSite[site] ?? 0) + 1 },
    });
  } catch {
    // WHY: 统计写入失败不影响屏蔽主流程。
  }
}
