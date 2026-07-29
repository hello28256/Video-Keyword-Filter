/**
 * 全局配置类型。MVP 仅 bilibili，后续 Phase 加 douyin/youtube 维度。
 * WHY: 集中放类型，避免在多个文件重复定义 SiteId / WhitelistEntry。
 */
export type SiteId = 'bilibili' | 'douyin' | 'youtube';

export const ALL_SITES: readonly SiteId[] = ['bilibili', 'douyin', 'youtube'] as const;

export interface WhitelistEntry {
  value: string;
  scope: 'all' | SiteId;
  note?: string;
}

export interface MatcherOptions {
  caseSensitive: boolean;
  trimWhitespace: boolean;
}

export interface FilterConfig {
  enabled: boolean;
  keywords: string[];
  whitelist: WhitelistEntry[];
  /**
   * 黑名单：按 UP 主名精确匹配，命中即隐藏（独立判断，不依赖关键词）。
   * 与 whitelist 共用 WhitelistEntry 类型，匹配逻辑在 core/matcher/whitelist.ts 统一。
   */
  blacklist: WhitelistEntry[];
  matcherOptions: MatcherOptions;
  siteEnabled: Record<SiteId, boolean>;
}
