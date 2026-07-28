/**
 * 跨入口消息联合类型。
 * WHY: content 脚本可能被 service worker 休眠漏掉 storage.watch，
 *      background 在 storage.onChanged 时主动广播 CONFIG_UPDATED 兜底。
 */
import type { FilterConfig, SiteId } from './config';

export type RuntimeMessage =
  | { type: 'CONFIG_UPDATED'; config: FilterConfig }
  | { type: 'STATS_INCREMENT'; site: SiteId }
  | { type: 'GET_STATUS' }
  | { type: 'STATUS_RESPONSE'; enabled: boolean; site: SiteId | null; hiddenCount: number };
