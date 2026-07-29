/**
 * storage key 定义：用 WXT 内置 storage.defineItem 拿到类型安全 + watch 能力。
 * WHY: 集中定义 key，避免字符串字面量散落各处；fallback 用 schema 默认值保证读取永远合法。
 *
 * ⚠️ 注意：不用 `migrations` 选项。
 * wxt 的 migration runner 在某些版本下会触发"wxt/storage must be loaded in a web extension
 * environment" 错误（GitHub issue #371）。改用 `init` 钩子 + schema 默认值兼容老数据：
 * 老 storage 缺字段时，read 拿到 undefined 字段，accessor 用默认值补。
 */
import { storage } from '#imports';
import { DEFAULT_CONFIG, SCHEMA_VERSION, DEFAULT_STATS, type DailyStats } from './schema';
import type { FilterConfig } from '#types/config';

/**
 * 主配置。读时由 accessors 用 migrateConfig 兜底（不在 wxt 层做 migration）。
 */
export const configItem = storage.defineItem<FilterConfig>('local:config', {
  fallback: DEFAULT_CONFIG,
});

/**
 * 每日隐藏统计。
 */
export const statsItem = storage.defineItem<DailyStats>('local:stats:daily', {
  fallback: DEFAULT_STATS,
});

/**
 * schema 版本号（独立存储，便于将来检测不兼容升级）。
 */
export const versionItem = storage.defineItem<number>('local:version', {
  fallback: SCHEMA_VERSION,
});

/**
 * 跨入口可访问的所有 storage item 集合。
 * WHY: 让 accessors 不直接 import 每个 item，扩展时只动 keys.ts。
 */
export const items = {
  config: configItem,
  stats: statsItem,
  version: versionItem,
} as const;
