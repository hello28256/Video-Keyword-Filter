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
  matcherOptions: MatcherOptions;
  siteEnabled: Record<SiteId, boolean>;
}
