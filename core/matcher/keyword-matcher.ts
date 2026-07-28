/**
 * 关键词匹配：纯文本 substring 匹配，支持大小写与空白归一。
 * WHY: 用闭包工厂让上层一次性配置 options，调用处只关心 (title, keyword)。
 */
import { normalizeText, collapseWhitespace } from '#utils/normalize';
import type { MatcherOptions } from '#types/config';

export type KeywordMatcherOptions = MatcherOptions;

const DEFAULTS: KeywordMatcherOptions = { caseSensitive: false, trimWhitespace: true };

/**
 * 把字符串里所有空白（含中间）剥除。
 * WHY: 用户写"测评视频"应能命中标题里的"测评 视频"/"测评  视频"——视频站常有不规则空白。
 *      仅在 trimWhitespace=true 时调用，保留"严格字面匹配"模式下的原空白。
 */
function stripAllWhitespace(s: string): string {
  return s.replace(/\s+/g, '');
}

/**
 * 单关键词匹配。空关键词/空标题均视为不命中。
 */
export function matchesKeyword(
  title: string,
  keyword: string,
  options: Partial<KeywordMatcherOptions> = {},
): boolean {
  if (!keyword || !title) return false;
  const opts: KeywordMatcherOptions = { ...DEFAULTS, ...options };
  // WHY: 归一策略组合 — collapseWhitespace 处理首尾/连续空白，stripAllWhitespace 处理中间空白。
  // 两道只在 trimWhitespace=true 时跑，false 时严格字面 includes。
  const norm = (s: string): string => {
    const folded = opts.trimWhitespace ? collapseWhitespace(normalizeText(s, opts)) : s;
    return opts.trimWhitespace ? stripAllWhitespace(folded) : folded;
  };
  const normalizedTitle = norm(title);
  const normalizedKeyword = norm(keyword);
  if (!normalizedKeyword) return false;
  return normalizedTitle.includes(normalizedKeyword);
}

/**
 * 多关键词匹配：任一命中即返回 true。
 * WHY: 把空白/空关键词过滤掉，让"空关键词"在 UI 上不会导致误命中。
 */
export function matchesAnyKeyword(
  title: string,
  keywords: readonly string[],
  options: Partial<KeywordMatcherOptions> = {},
): boolean {
  for (const raw of keywords) {
    if (!raw || !raw.trim()) continue;
    if (matchesKeyword(title, raw, options)) return true;
  }
  return false;
}
