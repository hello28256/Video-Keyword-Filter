/**
 * Bilibili 适配器。
 * 覆盖：
 *   - 首页推荐（https://www.bilibili.com/）
 *   - 搜索结果（https://search.bilibili.com/...）
 *   - 视频详情页右侧推荐（/video/BVxxxx）
 *
 * 选择器策略：
 *   - 卡片用「不带 -- 子修饰的 video-card/video-item」做最外层容器。
 *   - 标题/作者用 BEM 子元素（`--title` / `--author` / `--owner`）。
 *   - 优先用 data-bvid / data-up-name 这些稳定 data 属性。
 *   - 标题从 a[title] 读取（attribute 通常是完整标题，不被 CSS 截断）。
 */
import type { SiteAdapter, VideoCard } from './types';

// 匹配"最外层卡片"的 selector。
// WHY: 排除 `bili-video-card__info` / `bili-video-card__info--owner` 等 BEM 子元素 ——
//      它们都含 "video-card" 字符串，但只是卡片内部子节点。
//      用 class 完整词匹配 + 必须含 a[href*="/video/"] 双重过滤。
// B 站搜索结果可能用多种容器: div.video-card (BEM 无 __), li.video-item, div.video-item, div.b-img...
const CARD_CONTAINER_SELECTOR = [
  'div[class*="bili-video-card"]:not([class*="__"])',
  'li[class*="video-item"]',
  'div[class*="video-item"]',
  'div[class*="b_img"]',
].join(', ');

function findTitleEl(card: Element): Element | null {
  // WHY: 优先用 a[title]，避免被 CSS text-overflow 截断的 innerText 漏命中。
  return (
    card.querySelector('a[title]') ??
    card.querySelector('[class*="title"]')
  );
}

function findAuthorEl(card: Element): Element | null {
  // 优先级：B 站 BEM 子元素 > data 属性 > user-name 类（搜索页用）
  return (
    card.querySelector('[class*="__info--author"]') ??
    card.querySelector('[class*="__info--owner"]') ??
    card.querySelector('[data-up-name]') ??
    card.querySelector('[class*="up-name"]') ??
    card.querySelector('[class*="user-name"]') ??
    card.querySelector('[class*="author"]') ??
    card.querySelector('[data-mid]')
  );
}

function findHrefEl(card: Element): HTMLAnchorElement | null {
  return card.querySelector('a[href*="/video/"]');
}

function readAuthor(card: Element): string | null {
  // WHY: 优先取 data-up-name（最稳定）；其次取 a 元素的精确文本；
  //      最后取 textContent 并去除 "· 07-24" 等后缀。
  const dataUp = card.getAttribute('data-up-name');
  if (dataUp) return dataUp.trim();

  const el = findAuthorEl(card);
  if (!el) return null;
  const fromData = el.getAttribute('data-up-name');
  if (fromData) return fromData.trim();

  // 优先用 a 元素的 textContent（不含日期后缀），其次用 span
  const text = (el.textContent ?? '').trim();
  if (!text) return null;
  // WHY: B 站 BEM 元素 textContent 常含 "徐云流浪中国 · 07-24"，
  //      取 · 之前的部分作为 UP 主名。
  const authorOnly = text.split('·')[0]?.trim() ?? text;
  // DEBUG: 把 author 字符串的 charCode dump 出来，方便定位字符不匹配
  if (authorOnly.includes('徐云') || authorOnly.includes('流浪')) {
    console.log('[VKF] author char dump:', Array.from(authorOnly).map((c) => `${c}(${c.charCodeAt(0)})`).join(' '));
  }
  return authorOnly || null;
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
    // WHY: 搜索页和首页的卡片根都是 div.video-card (BEM 不带 __ 子元素) 或 li.video-item。
    //      直接用容器 selector 抓，不会误抓卡片内部子节点。
    const cards = Array.from(root.querySelectorAll(CARD_CONTAINER_SELECTOR));
    // 去重 + 校验必须是真正的卡片（内部有 video 链接）
    const seen = new Set<Element>();
    const result: Element[] = [];
    for (const card of cards) {
      if (seen.has(card)) continue;
      seen.add(card);
      if (!card.querySelector('a[href*="/video/"]')) continue;
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
