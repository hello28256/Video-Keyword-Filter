import { describe, it, expect, vi } from 'vitest';
import { createScanner } from '#core/dom/scanner';
import type { SiteAdapter, VideoCard } from '#core/adapter/types';
import type { FilterConfig, SiteId } from '#types/config';

const site: SiteId = 'bilibili';
const baseConfig: FilterConfig = {
  enabled: true,
  keywords: ['剧透'],
  whitelist: [],
  blacklist: [],
  matcherOptions: { caseSensitive: false, trimWhitespace: true },
  siteEnabled: { bilibili: true, douyin: true, youtube: true },
};

function makeAdapter(overrides: Partial<SiteAdapter> = {}): SiteAdapter {
  return {
    id: site,
    matches: () => true,
    findCards: () => [],
    extractCard: () => null,
    applyHidden: vi.fn(),
    removeHidden: vi.fn(),
    pierceShadow: false,
    ...overrides,
  };
}

function makeCard(title: string, author = 'UP主'): { el: HTMLElement; card: VideoCard } {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return {
    el,
    card: { element: el, title, author, url: 'https://example.com' },
  };
}

describe('createScanner', () => {
  it('找到的卡片用 decide 决定显隐', () => {
    const { el, card } = makeCard('这是一个剧透视频');
    const applyHidden = vi.fn();
    const removeHidden = vi.fn();
    const adapter = makeAdapter({
      findCards: () => [el],
      extractCard: (e) => (e === el ? card : null),
      applyHidden,
      removeHidden,
    });
    const scanner = createScanner({ adapter, getConfig: () => baseConfig });
    scanner.scanAll(document);
    expect(applyHidden).toHaveBeenCalledWith(el);
    expect(removeHidden).not.toHaveBeenCalled();
  });

  it('不命中时不隐藏', () => {
    const { el, card } = makeCard('正常视频');
    const applyHidden = vi.fn();
    const adapter = makeAdapter({
      findCards: () => [el],
      extractCard: (e) => (e === el ? card : null),
      applyHidden,
    });
    const scanner = createScanner({ adapter, getConfig: () => baseConfig });
    scanner.scanAll(document);
    expect(applyHidden).not.toHaveBeenCalled();
  });

  it('同一卡片处理两次不会重复调用 applyHidden', () => {
    const { el, card } = makeCard('剧透');
    const applyHidden = vi.fn();
    const adapter = makeAdapter({
      findCards: () => [el],
      extractCard: (e) => (e === el ? card : null),
      applyHidden,
    });
    const scanner = createScanner({ adapter, getConfig: () => baseConfig });
    scanner.scanAll(document);
    scanner.scanAll(document);
    expect(applyHidden).toHaveBeenCalledTimes(1);
  });

  it('配置从 enabled 变 disabled 后，原隐藏卡片恢复显示', () => {
    const { el, card } = makeCard('剧透');
    const applyHidden = vi.fn();
    const removeHidden = vi.fn();
    const adapter = makeAdapter({
      findCards: () => [el],
      extractCard: (e) => (e === el ? card : null),
      applyHidden,
      removeHidden,
    });
    let current = baseConfig;
    const scanner = createScanner({ adapter, getConfig: () => current });
    scanner.scanAll(document);
    expect(applyHidden).toHaveBeenCalledTimes(1);

    current = { ...baseConfig, enabled: false };
    scanner.rescanAll();
    expect(removeHidden).toHaveBeenCalledWith(el);
  });

  it('extractCard 返回 null 时跳过该卡片', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    const applyHidden = vi.fn();
    const adapter = makeAdapter({
      findCards: () => [el],
      extractCard: () => null,
      applyHidden,
    });
    const scanner = createScanner({ adapter, getConfig: () => baseConfig });
    scanner.scanAll(document);
    expect(applyHidden).not.toHaveBeenCalled();
  });
});
