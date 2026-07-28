import { describe, it, expect } from 'vitest';
import { extractHostname, matchesHostPattern } from '#utils/url';

describe('extractHostname', () => {
  it('提取标准 URL 的 hostname', () => {
    expect(extractHostname('https://www.bilibili.com/video/BV1xx')).toBe('www.bilibili.com');
  });

  it('端口会被剥离', () => {
    expect(extractHostname('http://localhost:3000/path')).toBe('localhost');
  });

  it('非法 URL 返回 null', () => {
    expect(extractHostname('not a url')).toBeNull();
  });
});

describe('matchesHostPattern', () => {
  it('精确匹配', () => {
    expect(matchesHostPattern('www.bilibili.com', 'www.bilibili.com')).toBe(true);
  });

  it('通配符子域', () => {
    expect(matchesHostPattern('search.bilibili.com', '*.bilibili.com')).toBe(true);
    expect(matchesHostPattern('bilibili.com', '*.bilibili.com')).toBe(false);
  });

  it('不匹配返回 false', () => {
    expect(matchesHostPattern('evil.com', '*.bilibili.com')).toBe(false);
  });
});
