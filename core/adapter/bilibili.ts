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
// WHY: B 站搜索结果卡片用 `class="bili-video-card__info--right"` (BEM 子类) 之类, 不用
//      `:not([class*="__"])` 排他 (会漏搜索页所有真实卡), 改用校验卡片"必须含 a[title]
//      且 a[href*="/video/"]" 双重过滤。BEM 子元素如 __info--author 通常不含 a[title],
//      自然被过滤。
const CARD_CONTAINER_SELECTOR = [
  'div[class*="bili-video-card"]',
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
    // WHY: B 站搜索页真实卡片用 BEM 子类 (如 bili-video-card__info--right).
    //      策略: 抓所有"含 a[title] 的元素", 向上找最近的"卡片容器".
    //      排除 body (页面级容器, 不是卡片) + html/document (更外层).
    const allWithTitle = Array.from(root.querySelectorAll('a[title]'));
    const seen = new Set<Element>();
    const result: Element[] = [];
    for (const a of allWithTitle) {
      let cardEl: Element | null = a.parentElement;
      let foundContainer: Element | null = null;
      while (cardEl && cardEl !== root && cardEl.tagName !== 'BODY') {
        if (cardEl.querySelector('a[href*="/video/"]') && cardEl.querySelector('a[title]')) {
          foundContainer = cardEl;
          break;
        }
        cardEl = cardEl.parentElement;
      }
      if (!foundContainer) continue;
      if (seen.has(foundContainer)) continue;
      seen.add(foundContainer);
      result.push(foundContainer);
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
