import { describe, it, expect } from 'vitest';
import { decide } from '#core/matcher/decision';
import type { FilterConfig } from '#types/config';

const baseConfig: FilterConfig = {
  enabled: true,
  keywords: ['测评', '广告'],
  whitelist: [],
  blacklist: [],
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

describe('decide - 黑名单', () => {
  const baseWithBlacklist: FilterConfig = {
    ...baseConfig,
    blacklist: [{ value: '某搬运号', scope: 'all' }],
  };

  it('黑名单命中 UP 主 → 独立判断，无视标题是否命中关键词', () => {
    const result = decide(
      { title: '一期普通的视频', author: '某搬运号', site: 'bilibili' },
      baseWithBlacklist,
    );
    expect(result).toEqual({ hide: true, reason: 'blacklist' });
  });

  it('黑名单命中时也无视 enabled/siteEnabled 之外的所有规则', () => {
    // 即便标题也命中关键词，仍返回 'blacklist' reason（黑名单优先于关键词）
    const result = decide(
      { title: '【剧透】结局分析', author: '某搬运号', site: 'bilibili' },
      baseWithBlacklist,
    );
    expect(result).toEqual({ hide: true, reason: 'blacklist' });
  });

  it('黑名单优先于白名单（同一 UP 同时在两名单 → 仍隐藏）', () => {
    const result = decide(
      { title: '一期普通视频', author: '某搬运号', site: 'bilibili' },
      {
        ...baseWithBlacklist,
        whitelist: [{ value: '某搬运号', scope: 'all' }],
      },
    );
    expect(result).toEqual({ hide: true, reason: 'blacklist' });
  });

  it('白名单命中但不在黑名单 → 放行', () => {
    const result = decide(
      { title: '【剧透】深度解析', author: '我的最爱', site: 'bilibili' },
      {
        ...baseWithBlacklist,
        whitelist: [{ value: '我的最爱', scope: 'all' }],
      },
    );
    expect(result).toEqual({ hide: false, reason: 'whitelist' });
  });

  it('黑名单 scope 限定：scope=bilibili 时 youtube 站点不命中', () => {
    const result = decide(
      { title: '一期普通视频', author: '某UP', site: 'youtube' },
      {
        ...baseConfig,
        blacklist: [{ value: '某UP', scope: 'bilibili' }],
      },
    );
    expect(result).toEqual({ hide: false, reason: 'no-match' });
  });

  it('空黑名单不改变原有行为（仅白名单生效）', () => {
    const result = decide(
      { title: '一期普通视频', author: '某UP', site: 'bilibili' },
      {
        ...baseConfig,
        blacklist: [],
        whitelist: [{ value: '某UP', scope: 'all' }],
      },
    );
    expect(result).toEqual({ hide: false, reason: 'whitelist' });
  });
});
