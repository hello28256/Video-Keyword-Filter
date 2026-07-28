/**
 * Bilibili 适配器。
 * 覆盖：
 *   - 首页推荐（https://www.bilibili.com/）
 *   - 搜索结果（https://search.bilibili.com/...）
 *   - 视频详情页右侧推荐（/video/BVxxxx）
 *
 * 选择器策略：
 *   - class 用通配符 [class*="video-card"] / [class*="video-item"]，避免 A/B 测试导致的 hash 化。
 *   - 优先用 data-bvid / data-up-name 这些稳定 data 属性。
 *   - 标题从 a[title] 读取（attribute 通常是完整标题，不被 CSS 截断）。
 */
import type { SiteAdapter, VideoCard } from './types';

const CARD_SELECTOR = '[class*="video-card"], [class*="video-item"]';

function findTitleEl(card: Element): Element | null {
  // WHY: 优先用 a[title]，避免被 CSS text-overflow 截断的 innerText 漏命中。
  return (
    card.querySelector('a[title]') ??
    card.querySelector('[class*="title"]')
  );
}

function findAuthorEl(card: Element): Element | null {
  return (
    card.querySelector('[data-up-name]') ??
    card.querySelector('[class*="up-name"]') ??
    card.querySelector('[class*="author"]') ??
    card.querySelector('[data-mid]')
  );
}

function findHrefEl(card: Element): HTMLAnchorElement | null {
  return card.querySelector('a[href*="/video/"]');
}

function readAuthor(card: Element): string | null {
  const el = findAuthorEl(card);
  if (!el) return null;
  // WHY: data-up-name 是 B 站直接挂在元素上的稳定属性（无空格 / 大小写问题）。
  const fromData = card.getAttribute('data-up-name') ?? el.getAttribute('data-up-name');
  if (fromData) return fromData.trim();
  const text = (el.textContent ?? '').trim();
  return text || null;
}

function readTitle(card: Element): string {
  const titleEl = findTitleEl(card);
  if (!titleEl) return '';
  // WHY: a[title] 的 attribute 优先于 textContent（B 站常用 a.title 显示全标题）。
  const attrTitle = titleEl.getAttribute('title');
  if (attrTitle) return attrTitle.trim();
  return (titleEl.textContent ?? '').trim();
}

function readUrl(card: Element): string {
  const a = findHrefEl(card);
  return a?.getAttribute('href') ?? '';
}

export const bilibiliAdapter: SiteAdapter = {
  id: 'bilibili',

  matches(url: URL): boolean {
    const host = url.hostname.toLowerCase();
    return host === 'www.bilibili.com' || host === 'search.bilibili.com' || host === 'bilibili.com';
  },

  findCards(root: ParentNode): Element[] {
    const nodes = Array.from(root.querySelectorAll(CARD_SELECTOR));
    // WHY: 详情页里 .bili-video-card__info--tit 这种 title 元素本身也会匹配 CARD_SELECTOR，
    //      但它们是 card 内部的子节点，向上找一次最近祖先后再去重，确保每张卡只入列一次。
    const seen = new Set<Element>();
    const result: Element[] = [];
    for (const node of nodes) {
      const card = node.closest(CARD_SELECTOR) ?? node;
      if (seen.has(card)) continue;
      seen.add(card);
      // WHY: 要求卡片内部能找到 a[href*="/video/"] 或 a[title]，排除纯装饰节点。
      if (!card.querySelector('a[href*="/video/"], a[title]')) continue;
      result.push(card);
    }
    return result;
  },

  extractCard(el: Element): VideoCard | null {
    const title = readTitle(el);
    // WHY: 没抽到标题视为不可解析（可能是装饰元素）；返回 null 让 scanner 跳过。
    if (!title) return null;
    return {
      element: el,
      title,
      author: readAuthor(el),
      url: readUrl(el),
    };
  },

  applyHidden(el: Element): void {
    el.setAttribute('data-vkf-hidden', '');
  },

  removeHidden(el: Element): void {
    el.removeAttribute('data-vkf-hidden');
  },

  pierceShadow: false,
};
