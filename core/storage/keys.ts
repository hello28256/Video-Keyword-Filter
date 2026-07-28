/**
 * storage key 定义：用 WXT 内置 storage.defineItem 拿到类型安全 + watch 能力。
 * WHY: 集中定义 key，避免字符串字面量散落各处；fallback 用 schema 默认值保证读取永远合法。
 */
import { storage } from '#imports';
import { DEFAULT_CONFIG, SCHEMA_VERSION, DEFAULT_STATS, type DailyStats } from './schema';
import { migrateConfig } from './schema';
import type { FilterConfig } from '#types/config';

/**
 * 主配置。读时走 migrateConfig 兜底（兼容老版本/损坏数据）。
 */
export const configItem = storage.defineItem<FilterConfig>('local:config', {
  fallback: DEFAULT_CONFIG,
  // WHY: 旧版本/手动改 storage 写入的脏数据可能在 read 时拿到非法值；
  //      onMigration 钩子在每次读取时跑一次，把入参归一到合法 schema。
  init: () => DEFAULT_CONFIG,
  migrations: {
    // 单版本号 entry；后续 schema 变化时新增 entries。
    1: (raw: unknown) => migrateConfig(raw),
  },
  version: SCHEMA_VERSION,
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
