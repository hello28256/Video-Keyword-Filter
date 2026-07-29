/**
 * 白名单/黑名单共用匹配：按 (UP主名, 站点) 判断 entries 中任一是否命中。
 * WHY: 白名单和黑名单的精确匹配 + scope 逻辑完全一致；抽出共用函数避免复制粘贴。
 *      大小写不敏感 + 空白折叠（视频站 UP 主名常带空格/中点不一致）。
 */
import { normalizeText } from '#utils/normalize';
import type { WhitelistEntry, SiteId } from '#types/config';

export function isInScope(entry: WhitelistEntry, site: SiteId): boolean {
  return entry.scope === 'all' || entry.scope === site;
}

export function matchesAnyEntry(
  author: string | null,
  entries: readonly WhitelistEntry[],
  site: SiteId,
): boolean {
  if (!author || entries.length === 0) return false;
  const normalizedAuthor = normalizeText(author);
  for (const entry of entries) {
    if (!isInScope(entry, site)) continue;
    if (normalizeText(entry.value) === normalizedAuthor) return true;
  }
  return false;
}

/**
 * 语义包装：白名单 = 命中即放行。
 * WHY: 保留 `isWhitelisted` 名以维持上层调用方（decision.ts / 现有测试）的可读性。
 */
export function isWhitelisted(
  author: string | null,
  entries: readonly WhitelistEntry[],
  site: SiteId,
): boolean {
  return matchesAnyEntry(author, entries, site);
}
