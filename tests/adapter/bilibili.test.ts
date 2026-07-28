import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { bilibiliAdapter } from '#core/adapter/bilibili';

function loadFixture(name: string): Document {
  const path = resolve(__dirname, `../fixtures/dom-snippets/${name}`);
  const html = readFileSync(path, 'utf-8');
  // jsdom 在 vitest 里默认全局可用。
  const dom = new DOMParser().parseFromString(html, 'text/html');
  return dom;
}

describe('bilibiliAdapter.matches', () => {
  it('匹配 www.bilibili.com', () => {
    expect(bilibiliAdapter.matches(new URL('https://www.bilibili.com/'))).toBe(true);
  });

  it('匹配 search.bilibili.com', () => {
    expect(bilibiliAdapter.matches(new URL('https://search.bilibili.com/all?keyword=test'))).toBe(true);
  });

  it('匹配详情页', () => {
    expect(bilibiliAdapter.matches(new URL('https://www.bilibili.com/video/BV1xx'))).toBe(true);
  });

  it('不匹配其他域名', () => {
    expect(bilibiliAdapter.matches(new URL('https://example.com/'))).toBe(false);
  });
});

describe('bilibiliAdapter.findCards + extractCard (首页 fixture)', () => {
  let doc: Document;

  beforeEach(() => {
    doc = loadFixture('bilibili-home.html');
  });

  it('找到 3 张卡片', () => {
    const cards = bilibiliAdapter.findCards(doc);
    expect(cards).toHaveLength(3);
  });

  it('抽取出标题、作者、URL', () => {
    const cards = bilibiliAdapter.findCards(doc);
    const first = bilibiliAdapter.extractCard(cards[0]!);
    expect(first).not.toBeNull();
    expect(first?.title).toBe('一期普通的视频');
    expect(first?.author).toBe('测试UP主A');
    expect(first?.url).toContain('BV1xx1');
  });

  it('白名单 UP 主卡片也能正常抽取', () => {
    const cards = bilibiliAdapter.findCards(doc);
    const third = bilibiliAdapter.extractCard(cards[2]!);
    expect(third?.author).toBe('我的最爱');
    expect(third?.title).toBe('深度剧透解析');
  });

  it('footer 里的孤立链接不会被识别为卡片', () => {
    const cards = bilibiliAdapter.findCards(doc);
    // 已在首页 findCards 测试中验证总数为 3
    expect(cards.every((el) => el.closest('.bili-video-card, .video-card, [class*="video-card"]'))).toBe(true);
  });
});

describe('bilibiliAdapter.findCards (详情页 fixture)', () => {
  it('找到详情页推荐卡片', () => {
    const doc = loadFixture('bilibili-detail.html');
    const cards = bilibiliAdapter.findCards(doc);
    expect(cards.length).toBeGreaterThanOrEqual(2);
  });
});

describe('bilibiliAdapter.applyHidden / removeHidden', () => {
  it('applyHidden 设置 data-vkf-hidden 属性', () => {
    const doc = loadFixture('bilibili-home.html');
    const cards = bilibiliAdapter.findCards(doc);
    const el = cards[0]!;
    bilibiliAdapter.applyHidden(el);
    expect(el.hasAttribute('data-vkf-hidden')).toBe(true);
  });

  it('removeHidden 移除属性', () => {
    const doc = loadFixture('bilibili-home.html');
    const cards = bilibiliAdapter.findCards(doc);
    const el = cards[0]!;
    bilibiliAdapter.applyHidden(el);
    bilibiliAdapter.removeHidden(el);
    expect(el.hasAttribute('data-vkf-hidden')).toBe(false);
  });
});
