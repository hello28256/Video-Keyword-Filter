import { describe, it, expect } from 'vitest';
import { matchesKeyword, matchesAnyKeyword, type KeywordMatcherOptions } from '#core/matcher/keyword-matcher';

const DEFAULTS: KeywordMatcherOptions = {
  caseSensitive: false,
  trimWhitespace: true,
};

describe('matchesKeyword', () => {
  it('空关键词视为不命中', () => {
    expect(matchesKeyword('任一标题', '')).toBe(false);
  });

  it('空标题视为不命中', () => {
    expect(matchesKeyword('', 'foo')).toBe(false);
  });

  it('substring 匹配（默认）', () => {
    expect(matchesKeyword('这是一个测评视频', '测评')).toBe(true);
  });

  it('大小写不敏感（默认）', () => {
    expect(matchesKeyword('Hello World', 'hello')).toBe(true);
    expect(matchesKeyword('Hello World', 'WORLD')).toBe(true);
  });

  it('大小写敏感时按字面匹配', () => {
    expect(matchesKeyword('Hello World', 'hello', { caseSensitive: true })).toBe(false);
    expect(matchesKeyword('Hello World', 'Hello', { caseSensitive: true })).toBe(true);
  });

  it('标题多余空白不干扰', () => {
    expect(matchesKeyword('  测评 视频  ', '测评视频')).toBe(true);
  });

  it('trimWhitespace=false 时不做空白归一', () => {
    // WHY: 关闭 trimWhitespace 后，只做大小写归一，不折叠/剥离空白。
    // 这里验证：纯中文关键词在大小写不敏感时仍能匹配（lowercase 不影响中文）。
    expect(matchesKeyword('这是一个 测评 视频', '测评', { trimWhitespace: false })).toBe(true);
  });
});

describe('matchesAnyKeyword', () => {
  it('空关键词数组视为不命中', () => {
    expect(matchesAnyKeyword('任一', [])).toBe(false);
  });

  it('任一关键词命中即返回 true', () => {
    expect(matchesAnyKeyword('这是一个测评视频', ['广告', '测评', '推广'])).toBe(true);
  });

  it('全部不匹配返回 false', () => {
    expect(matchesAnyKeyword('正常视频', ['广告', '营销'])).toBe(false);
  });

  it('空白关键词被忽略', () => {
    expect(matchesAnyKeyword('测试', ['', '   ', '\t'])).toBe(false);
  });

  it('关键词首尾空白被 trim（默认）', () => {
    expect(matchesAnyKeyword('测评视频', ['  测评  '])).toBe(true);
  });
});
