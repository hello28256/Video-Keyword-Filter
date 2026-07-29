// 端到端 v2：不依赖 service worker。
// 直接在 bilibili 搜索页里注入完整 logic（storage mock + adapter + scanner + observer），
// 验证真实 DOM 上黑名单能否正确命中并隐藏徐云卡片。
import { chromium } from 'playwright';

const SEARCH_URL = 'https://search.bilibili.com/all?keyword=%E9%AA%91%E8%A1%8C';

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext({
  userAgent:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
});
const page = await context.newPage();

// 在 page 加载前注入（per-page init script）
await page.addInitScript(() => {
  const config = {
    enabled: true,
    keywords: [],
    whitelist: [],
    blacklist: [{ value: '徐云流浪中国', scope: 'all' }],
    matcherOptions: { caseSensitive: false, trimWhitespace: true },
    siteEnabled: { bilibili: true, douyin: true, youtube: true },
  };
  // 模拟 chrome.storage.local
  const store = { 'local:config': config };
  globalThis.chrome = {
    storage: {
      local: {
        get: (k, cb) => {
          const key = typeof k === 'string' ? k : Object.keys(k)[0];
          cb({ [key]: store[key] });
        },
        set: (obj, cb) => {
          Object.assign(store, obj);
          cb?.();
        },
      },
    },
  };

  // ---- normalize ----
  const collapseWhitespace = (s) => s.replace(/\s+/g, ' ').trim();
  const stripAllWhitespace = (s) => s.replace(/\s+/g, '');
  const normalizeText = (input, options = {}) => {
    const opts = { caseSensitive: false, trimWhitespace: true, ...options };
    let r = input;
    if (opts.trimWhitespace) r = collapseWhitespace(r);
    if (!opts.caseSensitive) r = r.toLowerCase();
    return r;
  };
  // ---- matcher ----
  const matchesKeyword = (title, keyword, options) => {
    if (!keyword || !title) return false;
    const opts = { caseSensitive: false, trimWhitespace: true, ...options };
    const norm = (s) => {
      const folded = opts.trimWhitespace ? collapseWhitespace(normalizeText(s, opts)) : s;
      return opts.trimWhitespace ? stripAllWhitespace(folded) : folded;
    };
    const nt = norm(title);
    const nk = norm(keyword);
    if (!nk) return false;
    return nt.includes(nk);
  };
  const matchesAnyKeyword = (title, keywords, options) => {
    for (const raw of keywords) {
      if (!raw || !raw.trim()) continue;
      if (matchesKeyword(title, raw, options)) return true;
    }
    return false;
  };
  const matchesAnyEntry = (author, entries, site) => {
    if (!author || entries.length === 0) return false;
    const nAuthor = normalizeText(author);
    for (const e of entries) {
      if (e.scope !== 'all' && e.scope !== site) continue;
      if (normalizeText(e.value) === nAuthor) return true;
    }
    return false;
  };
  const decide = (input, config) => {
    if (!config.enabled) return { hide: false, reason: 'disabled' };
    if (!config.siteEnabled[input.site]) return { hide: false, reason: 'site-disabled' };
    if (matchesAnyEntry(input.author, config.blacklist, input.site)) return { hide: true, reason: 'blacklist' };
    if (matchesAnyEntry(input.author, config.whitelist, input.site)) return { hide: false, reason: 'whitelist' };
    if (matchesAnyKeyword(input.title, config.keywords, config.matcherOptions)) return { hide: true, reason: 'keyword' };
    return { hide: false, reason: 'no-match' };
  };
  // ---- bilibili adapter (最新版) ----
  const CARD_SELECTOR = 'div[class*="bili-video-card"]:not([class*="__"]), li[class*="video-item"]';
  const findCards = (root) => {
    const cards = Array.from(root.querySelectorAll(CARD_SELECTOR));
    const seen = new Set();
    const result = [];
    for (const card of cards) {
      if (seen.has(card)) continue;
      seen.add(card);
      if (!card.querySelector('a[href*="/video/"]')) continue;
      result.push(card);
    }
    return result;
  };
  const extractCard = (el) => {
    const titleEl = el.querySelector('a[title]') ?? el.querySelector('[class*="title"]');
    if (!titleEl) return null;
    const title = titleEl.getAttribute('title')?.trim() || titleEl.textContent?.trim() || '';
    if (!title) return null;
    const authorEl =
      el.querySelector('[class*="__info--author"]') ??
      el.querySelector('[class*="__info--owner"]') ??
      el.querySelector('[data-up-name]') ??
      el.querySelector('[class*="up-name"]') ??
      el.querySelector('[class*="user-name"]') ??
      el.querySelector('[class*="author"]') ??
      el.querySelector('[data-mid]');
    let author = null;
    if (authorEl) {
      const dataUp = el.getAttribute('data-up-name') ?? authorEl.getAttribute('data-up-name');
      if (dataUp) author = dataUp.trim();
      else {
        const text = (authorEl.textContent ?? '').trim();
        author = text.split('·')[0]?.trim() || text || null;
      }
    }
    return { element: el, title, author, url: el.querySelector('a[href*="/video/"]')?.getAttribute('href') ?? '' };
  };

  // 注入 CSS 兜底
  const style = document.createElement('style');
  style.id = 'vkf-base-style';
  style.textContent = '[data-vkf-hidden] { display: none !important; }';
  document.documentElement.prepend(style);

  // 暴露给外部 eval 调用
  globalThis.__VKF__ = { findCards, extractCard, decide };
});

page.on('console', (msg) => {
  const t = msg.text();
  if (t.includes('Content Security Policy') || t.includes('bili-fe-mirror') || t.includes('白屏检测')) return;
  if (msg.type() === 'error') console.log('[page ERROR]', t);
});

console.log('🌐 打开搜索页...');
await page.goto(SEARCH_URL, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4000);

// 直接在 page 上下文里跑（不依赖 globalThis，因为 addInitScript 没生效）
const result = await page.evaluate(() => {
  // ---- 完整复制 storage + matcher + adapter + scanner 逻辑 ----
  const collapseWhitespace = (s) => s.replace(/\s+/g, ' ').trim();
  const stripAllWhitespace = (s) => s.replace(/\s+/g, '');
  const normalizeText = (input, options = {}) => {
    const opts = { caseSensitive: false, trimWhitespace: true, ...options };
    let r = input;
    if (opts.trimWhitespace) r = collapseWhitespace(r);
    if (!opts.caseSensitive) r = r.toLowerCase();
    return r;
  };
  const matchesKeyword = (title, keyword, options) => {
    if (!keyword || !title) return false;
    const opts = { caseSensitive: false, trimWhitespace: true, ...options };
    const norm = (s) => {
      const folded = opts.trimWhitespace ? collapseWhitespace(normalizeText(s, opts)) : s;
      return opts.trimWhitespace ? stripAllWhitespace(folded) : folded;
    };
    const nt = norm(title);
    const nk = norm(keyword);
    if (!nk) return false;
    return nt.includes(nk);
  };
  const matchesAnyKeyword = (title, keywords, options) => {
    for (const raw of keywords) {
      if (!raw || !raw.trim()) continue;
      if (matchesKeyword(title, raw, options)) return true;
    }
    return false;
  };
  const matchesAnyEntry = (author, entries, site) => {
    if (!author || entries.length === 0) return false;
    const nAuthor = normalizeText(author);
    for (const e of entries) {
      if (e.scope !== 'all' && e.scope !== site) continue;
      if (normalizeText(e.value) === nAuthor) return true;
    }
    return false;
  };
  const decide = (input, config) => {
    if (!config.enabled) return { hide: false, reason: 'disabled' };
    if (!config.siteEnabled[input.site]) return { hide: false, reason: 'site-disabled' };
    if (matchesAnyEntry(input.author, config.blacklist, input.site)) return { hide: true, reason: 'blacklist' };
    if (matchesAnyEntry(input.author, config.whitelist, input.site)) return { hide: false, reason: 'whitelist' };
    if (matchesAnyKeyword(input.title, config.keywords, config.matcherOptions)) return { hide: true, reason: 'keyword' };
    return { hide: false, reason: 'no-match' };
  };
  const CARD_SELECTOR = 'div[class*="bili-video-card"]:not([class*="__"]), li[class*="video-item"]';
  const findCards = (root) => {
    const cards = Array.from(root.querySelectorAll(CARD_SELECTOR));
    const seen = new Set();
    const result = [];
    for (const card of cards) {
      if (seen.has(card)) continue;
      seen.add(card);
      if (!card.querySelector('a[href*="/video/"]')) continue;
      result.push(card);
    }
    return result;
  };
  const extractCard = (el) => {
    const titleEl = el.querySelector('a[title]') ?? el.querySelector('[class*="title"]');
    if (!titleEl) return null;
    const title = titleEl.getAttribute('title')?.trim() || titleEl.textContent?.trim() || '';
    if (!title) return null;
    const authorEl =
      el.querySelector('[class*="__info--author"]') ??
      el.querySelector('[class*="__info--owner"]') ??
      el.querySelector('[data-up-name]') ??
      el.querySelector('[class*="up-name"]') ??
      el.querySelector('[class*="user-name"]') ??
      el.querySelector('[class*="author"]') ??
      el.querySelector('[data-mid]');
    let author = null;
    if (authorEl) {
      const dataUp = el.getAttribute('data-up-name') ?? authorEl.getAttribute('data-up-name');
      if (dataUp) author = dataUp.trim();
      else {
        const text = (authorEl.textContent ?? '').trim();
        author = text.split('·')[0]?.trim() || text || null;
      }
    }
    return { element: el, title, author, url: el.querySelector('a[href*="/video/"]')?.getAttribute('href') ?? '' };
  };

  // 注入 CSS 兜底
  if (!document.getElementById('vkf-base-style')) {
    const style = document.createElement('style');
    style.id = 'vkf-base-style';
    style.textContent = '[data-vkf-hidden] { display: none !important; }';
    document.documentElement.prepend(style);
  }

  const cfg = { enabled: true, keywords: [], whitelist: [], blacklist: [{ value: '徐云流浪中国', scope: 'all' }], matcherOptions: { caseSensitive: false, trimWhitespace: true }, siteEnabled: { bilibili: true, douyin: true, youtube: true } };

  const cards = findCards(document);
  const samples = [];
  let hidden = 0;
  let xuyunFound = 0;
  let xuyunHidden = 0;

  for (const c of cards) {
    const card = extractCard(c);
    if (!card) continue;
    const d = decide({ title: card.title, author: card.author, site: 'bilibili' }, cfg);
    if (d.hide) {
      c.setAttribute('data-vkf-hidden', '');
      hidden++;
    }
    if ((card.author ?? '').includes('徐云流浪中国')) {
      xuyunFound++;
      if (d.hide) xuyunHidden++;
      if (samples.length < 5) samples.push({ title: card.title?.slice(0, 30), author: card.author, decision: d.reason });
    }
  }
  return { totalCards: cards.length, hidden, xuyunFound, xuyunHidden, samples, first5: cards.slice(0, 5).map(c => ({ cls: c.className?.toString?.()?.slice(0, 60), text: c.textContent?.trim()?.slice(0, 80) })) };
});

console.log('\n=== 验证结果 ===');
console.log('总卡片数:', result.totalCards);
console.log('已隐藏:', result.hidden);
console.log('徐云流浪中国 卡片数:', result.xuyunFound);
console.log('徐云流浪中国 已隐藏:', result.xuyunHidden);
console.log('前 5 个抓到的卡片:');
for (const s of result.first5 || []) console.log('  ', JSON.stringify(s));
console.log('前 3 个徐云样本:');
for (const s of result.samples) console.log('  ', JSON.stringify(s));

const passed = result.xuyunFound > 0 && result.xuyunHidden === result.xuyunFound;
console.log('\n' + (passed ? '✅ 黑名单逻辑在真实 DOM 上生效' : '❌ 仍有徐云卡片没被隐藏'));

await page.screenshot({ path: '/tmp/vkf-e2e-v2.png' });
console.log('📸 /tmp/vkf-e2e-v2.png');

await browser.close();
