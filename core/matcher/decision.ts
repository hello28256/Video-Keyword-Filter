/**
 * 屏蔽决策：单点入口，所有 content 脚本调用此函数决定显隐。
 * WHY: 把"是否隐藏"集中在一个纯函数，方便单测覆盖所有组合。
 *
 * 判定顺序（黑名单优先于白名单）：
 *   1. enabled=false → 不隐藏（插件关）
 *   2. siteEnabled[site]=false → 不隐藏（站点关）
 *   3. blacklist 命中 → 隐藏（独立判断，无视关键词/白名单）
 *   4. whitelist 命中 → 不隐藏（避免误伤）
 *   5. keywords 命中 → 隐藏
 *   6. 都不命中 → 不隐藏
 */
import { matchesAnyKeyword } from './keyword-matcher';
import { matchesAnyEntry, isWhitelisted } from './whitelist';
import type { FilterConfig, SiteId } from '#types/config';

export type Decision =
  | { hide: true; reason: 'keyword' | 'blacklist' }
  | { hide: false; reason: 'whitelist' | 'no-match' | 'site-disabled' | 'disabled' };

export interface DecisionInput {
  title: string;
  author: string | null;
  site: SiteId;
}

export function decide(input: DecisionInput, config: FilterConfig): Decision {
  if (!config.enabled) {
    return { hide: false, reason: 'disabled' };
  }
  if (!config.siteEnabled[input.site]) {
    return { hide: false, reason: 'site-disabled' };
  }
  // WHY: 黑名单先于白名单判断——用户主动屏蔽的优先级高于主动保留的。
  //      白名单的作用是"避免误伤"（关键词误命中时放行），黑名单是明确意图。
  if (matchesAnyEntry(input.author, config.blacklist, input.site)) {
    return { hide: true, reason: 'blacklist' };
  }
  if (isWhitelisted(input.author, config.whitelist, input.site)) {
    return { hide: false, reason: 'whitelist' };
  }
  if (matchesAnyKeyword(input.title, config.keywords, config.matcherOptions)) {
    return { hide: true, reason: 'keyword' };
  }
  return { hide: false, reason: 'no-match' };
}
