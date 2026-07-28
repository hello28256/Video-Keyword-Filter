import { describe, it, expect } from 'vitest';
import { decide } from '#core/matcher/decision';
import type { FilterConfig } from '#types/config';

const baseConfig: FilterConfig = {
  enabled: true,
  keywords: ['测评', '广告'],
  whitelist: [],
  matcherOptions: { caseSensitive: false, trimWhitespace: true },
  siteEnabled: { bilibili: true, douyin: true, youtube: true },
};

describe('decide', () => {
  it('总开关关闭 → 一律不隐藏（disabled），让 rescan 能恢复', () => {
    const result = decide(
      { title: '正常视频', author: '某UP', site: 'bilibili' },
      { ...baseConfig, enabled: false },
    );
    expect(result).toEqual({ hide: false, reason: 'disabled' });
  });

  it('站点关闭 → 不隐藏（site-disabled）', () => {
    const result = decide(
      { title: '测评视频', author: '某UP', site: 'bilibili' },
      { ...baseConfig, siteEnabled: { ...baseConfig.siteEnabled, bilibili: false } },
    );
    expect(result).toEqual({ hide: false, reason: 'site-disabled' });
  });

  it('关键词命中 → 隐藏', () => {
    const result = decide(
      { title: '本期测评：iPhone 15', author: '某UP', site: 'bilibili' },
      baseConfig,
    );
    expect(result).toEqual({ hide: true, reason: 'keyword' });
  });

  it('关键词不命中 → 不隐藏', () => {
    const result = decide(
      { title: '一期普通视频', author: '某UP', site: 'bilibili' },
      baseConfig,
    );
    expect(result).toEqual({ hide: false, reason: 'no-match' });
  });

  it('白名单命中 → 即使关键词命中也不隐藏', () => {
    const result = decide(
      { title: '深度测评对比', author: '我的最爱UP', site: 'bilibili' },
      {
        ...baseConfig,
        whitelist: [{ value: '我的最爱UP', scope: 'all' }],
      },
    );
    expect(result).toEqual({ hide: false, reason: 'whitelist' });
  });

  it('白名单 scope 限定站点：只对该站点生效', () => {
    const result = decide(
      { title: '测评视频', author: '我', site: 'youtube' },
      {
        ...baseConfig,
        whitelist: [{ value: '我', scope: 'bilibili' }],
      },
    );
    // 关键词命中、且白名单不适用 → 仍应隐藏
    expect(result).toEqual({ hide: true, reason: 'keyword' });
  });

  it('author 为 null 时不触发白名单', () => {
    const result = decide(
      { title: '测评', author: null, site: 'bilibili' },
      { ...baseConfig, whitelist: [{ value: '我', scope: 'all' }] },
    );
    expect(result).toEqual({ hide: true, reason: 'keyword' });
  });

  it('大小写敏感开启时不命中大写', () => {
    const result = decide(
      { title: 'iPhone 15 REVIEW', author: '某UP', site: 'youtube' },
      { ...baseConfig, keywords: ['review'], matcherOptions: { caseSensitive: true, trimWhitespace: true } },
    );
    expect(result).toEqual({ hide: false, reason: 'no-match' });
  });
});
