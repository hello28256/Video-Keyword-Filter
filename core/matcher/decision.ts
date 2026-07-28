/**
 * 屏蔽决策：单点入口，所有 content 脚本调用此函数决定显隐。
 * WHY: 把"是否隐藏"集中在一个纯函数，方便单测覆盖所有组合。
 */
import { matchesAnyKeyword } from './keyword-matcher';
import { isWhitelisted } from './whitelist';
import type { FilterConfig, SiteId } from '#types/config';

export type Decision =
  | { hide: true; reason: 'keyword' }
  | { hide: false; reason: 'whitelist' | 'no-match' | 'site-disabled' | 'disabled' };

export interface DecisionInput {
  title: string;
  author: string | null;
  site: SiteId;
}

export function decide(input: DecisionInput, config: FilterConfig): Decision {
  // WHY: enabled=false 表示插件整体关掉，所有卡片都"不屏蔽"（不是强制隐藏）。
  // 这样 rescanAll 时已隐藏的卡片会走到 removeHidden 分支，UI 状态正确。
  if (!config.enabled) {
    return { hide: false, reason: 'disabled' };
  }
  if (!config.siteEnabled[input.site]) {
    return { hide: false, reason: 'site-disabled' };
  }
  // 白名单先于关键词判定：避免白名单 UP 主的新视频被误伤。
  if (isWhitelisted(input.author, config.whitelist, input.site)) {
    return { hide: false, reason: 'whitelist' };
  }
  if (matchesAnyKeyword(input.title, config.keywords, config.matcherOptions)) {
    return { hide: true, reason: 'keyword' };
  }
  return { hide: false, reason: 'no-match' };
}
