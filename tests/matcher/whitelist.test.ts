import { describe, it, expect } from 'vitest';
import { isWhitelisted, isInScope } from '#core/matcher/whitelist';
import type { WhitelistEntry } from '#types/config';

describe('isInScope', () => {
  it('scope=all 总是返回 true', () => {
    expect(isInScope({ value: 'x', scope: 'all' }, 'bilibili')).toBe(true);
    expect(isInScope({ value: 'x', scope: 'all' }, 'youtube')).toBe(true);
  });

  it('scope=具体站点：匹配站点才返回 true', () => {
    expect(isInScope({ value: 'x', scope: 'bilibili' }, 'bilibili')).toBe(true);
    expect(isInScope({ value: 'x', scope: 'bilibili' }, 'youtube')).toBe(false);
  });
});

describe('isWhitelisted', () => {
  const entries: WhitelistEntry[] = [
    { value: '我的最爱', scope: 'all' },
    { value: 'B站特供', scope: 'bilibili' },
  ];

  it('author 在白名单（all）→ true', () => {
    expect(isWhitelisted('我的最爱', entries, 'youtube')).toBe(true);
  });

  it('author 在白名单（限定站点）且站点匹配 → true', () => {
    expect(isWhitelisted('B站特供', entries, 'bilibili')).toBe(true);
  });

  it('author 在白名单（限定站点）但站点不匹配 → false', () => {
    expect(isWhitelisted('B站特供', entries, 'youtube')).toBe(false);
  });

  it('author 不在白名单 → false', () => {
    expect(isWhitelisted('路人甲', entries, 'bilibili')).toBe(false);
  });

  it('author 为 null → false', () => {
    expect(isWhitelisted(null, entries, 'bilibili')).toBe(false);
  });

  it('大小写不敏感（默认）', () => {
    expect(isWhitelisted('我的最爱', entries, 'bilibili')).toBe(true);
  });
});
