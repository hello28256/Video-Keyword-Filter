/**
 * storage schema：集中管理 FilterConfig 默认值与版本迁移。
 * WHY: 把 schema 升级逻辑集中在一处，未来加字段时只动这里。
 */
import type { FilterConfig, SiteId, MatcherOptions, WhitelistEntry } from '#types/config';
import { ALL_SITES } from '#types/config';

export const SCHEMA_VERSION = 2;

export const DEFAULT_MATCHER_OPTIONS: MatcherOptions = {
  caseSensitive: false,
  trimWhitespace: true,
};

export const DEFAULT_SITE_ENABLED: Record<SiteId, boolean> = {
  bilibili: true,
  douyin: true,
  youtube: true,
};

export const DEFAULT_CONFIG: FilterConfig = {
  enabled: true,
  keywords: [],
  whitelist: [],
  blacklist: [],
  matcherOptions: { ...DEFAULT_MATCHER_OPTIONS },
  siteEnabled: { ...DEFAULT_SITE_ENABLED },
};

type RawConfig = Partial<FilterConfig> & {
  siteEnabled?: Partial<Record<SiteId, boolean>>;
  whitelist?: WhitelistEntry[];
  blacklist?: WhitelistEntry[];
};

const isWhitelistEntry = (w: unknown): w is WhitelistEntry =>
  !!w &&
  typeof w === 'object' &&
  typeof (w as WhitelistEntry).value === 'string' &&
  typeof (w as WhitelistEntry).scope === 'string';

const filterEntries = (arr: unknown): WhitelistEntry[] =>
  Array.isArray(arr) ? arr.filter(isWhitelistEntry) : [];

/**
 * 从任意入参（可能是旧版本/损坏数据）恢复到合法 FilterConfig。
 * WHY: storage 里的值用户可能从老版本带过来，读取时必须能容忍缺失字段。
 */
export function migrateConfig(raw: unknown): FilterConfig {
  if (!raw || typeof raw !== 'object') return cloneDefault();
  const r = raw as RawConfig;
  const siteEnabled = { ...DEFAULT_SITE_ENABLED };
  if (r.siteEnabled && typeof r.siteEnabled === 'object') {
    for (const site of ALL_SITES) {
      const v = r.siteEnabled[site];
      if (typeof v === 'boolean') siteEnabled[site] = v;
    }
  }
  return {
    enabled: typeof r.enabled === 'boolean' ? r.enabled : DEFAULT_CONFIG.enabled,
    keywords: Array.isArray(r.keywords)
      ? r.keywords.filter((k): k is string => typeof k === 'string')
      : [...DEFAULT_CONFIG.keywords],
    whitelist: filterEntries(r.whitelist),
    // WHY: 老版本数据没有 blacklist 字段时（migrate v1）必须返回空数组而不是 undefined，
    //      否则 accessors 写入时会丢失类型保证。
    blacklist: filterEntries(r.blacklist),
    matcherOptions: {
      caseSensitive:
        typeof r.matcherOptions?.caseSensitive === 'boolean'
          ? r.matcherOptions.caseSensitive
          : DEFAULT_CONFIG.matcherOptions.caseSensitive,
      trimWhitespace:
        typeof r.matcherOptions?.trimWhitespace === 'boolean'
          ? r.matcherOptions.trimWhitespace
          : DEFAULT_CONFIG.matcherOptions.trimWhitespace,
    },
    siteEnabled,
  };
}

function cloneDefault(): FilterConfig {
  return {
    enabled: DEFAULT_CONFIG.enabled,
    keywords: [...DEFAULT_CONFIG.keywords],
    whitelist: [...DEFAULT_CONFIG.whitelist],
    blacklist: [...DEFAULT_CONFIG.blacklist],
    matcherOptions: { ...DEFAULT_CONFIG.matcherOptions },
    siteEnabled: { ...DEFAULT_CONFIG.siteEnabled },
  };
}

export interface DailyStats {
  date: string; // YYYY-MM-DD（用户本地时区）
  perSite: Record<SiteId, number>;
}

export const DEFAULT_STATS: DailyStats = {
  date: '',
  perSite: { bilibili: 0, douyin: 0, youtube: 0 },
};
