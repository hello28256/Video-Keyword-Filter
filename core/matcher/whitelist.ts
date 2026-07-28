/**
 * 白名单匹配：按 (UP主名, 站点) 判断是否放行。
 * WHY: 大小写不敏感 + 空白折叠（视频站 UP 主名常带空格/中点不一致）。
 */
import { normalizeText } from '#utils/normalize';
import type { WhitelistEntry, SiteId } from '#types/config';

export function isInScope(entry: WhitelistEntry, site: SiteId): boolean {
  return entry.scope === 'all' || entry.scope === site;
}

export function isWhitelisted(
  author: string | null,
  entries: readonly WhitelistEntry[],
  site: SiteId,
): boolean {
  if (!author || entries.length === 0) return false;
  const normalizedAuthor = normalizeText(author);
  for (const entry of entries) {
    if (!isInScope(entry, site)) continue;
    const normalizedEntry = normalizeText(entry.value);
    if (normalizedAuthor === normalizedEntry) return true;
  }
  return false;
}
