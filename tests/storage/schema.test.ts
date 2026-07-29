import { describe, it, expect } from 'vitest';
import { DEFAULT_CONFIG, SCHEMA_VERSION, migrateConfig } from '#core/storage/schema';

describe('DEFAULT_CONFIG', () => {
  it('插件默认开启', () => {
    expect(DEFAULT_CONFIG.enabled).toBe(true);
  });

  it('关键词/白名单/黑名单默认空', () => {
    expect(DEFAULT_CONFIG.keywords).toEqual([]);
    expect(DEFAULT_CONFIG.whitelist).toEqual([]);
    expect(DEFAULT_CONFIG.blacklist).toEqual([]);
  });

  it('matcherOptions 默认大小写不敏感、trim 空白', () => {
    expect(DEFAULT_CONFIG.matcherOptions).toEqual({
      caseSensitive: false,
      trimWhitespace: true,
    });
  });

  it('三站默认全部启用', () => {
    expect(DEFAULT_CONFIG.siteEnabled).toEqual({
      bilibili: true,
      douyin: true,
      youtube: true,
    });
  });
});

describe('migrateConfig', () => {
  it('空对象走默认值', () => {
    expect(migrateConfig({})).toEqual(DEFAULT_CONFIG);
  });

  it('null/undefined 走默认值', () => {
    expect(migrateConfig(null)).toEqual(DEFAULT_CONFIG);
    expect(migrateConfig(undefined)).toEqual(DEFAULT_CONFIG);
  });

  it('未知站点被丢弃，只保留三站', () => {
    const result = migrateConfig({
      enabled: false,
      keywords: ['x'],
      siteEnabled: { bilibili: false, unknown: true } as never,
    });
    expect(result.siteEnabled).toEqual({
      bilibili: false,
      douyin: true,
      youtube: true,
    });
  });

  it('保留合法字段', () => {
    const result = migrateConfig({
      enabled: false,
      keywords: ['剧透'],
      whitelist: [{ value: 'up主', scope: 'all' }],
    });
    expect(result.enabled).toBe(false);
    expect(result.keywords).toEqual(['剧透']);
    expect(result.whitelist).toEqual([{ value: 'up主', scope: 'all' }]);
  });

  it('老版本数据（无 blacklist 字段）自动补空数组', () => {
    const result = migrateConfig({
      enabled: true,
      keywords: ['剧透'],
    });
    expect(result.blacklist).toEqual([]);
  });

  it('已含 blacklist 字段时保留其值', () => {
    const result = migrateConfig({
      enabled: true,
      blacklist: [{ value: '某UP', scope: 'all' }],
    });
    expect(result.blacklist).toEqual([{ value: '某UP', scope: 'all' }]);
  });

  it('blacklist 非法元素被过滤', () => {
    const result = migrateConfig({
      blacklist: [
        { value: 'good', scope: 'all' },
        null,
        { value: 123, scope: 'all' } as never,
        { scope: 'all' } as never,
      ],
    });
    expect(result.blacklist).toEqual([{ value: 'good', scope: 'all' }]);
  });
});

describe('SCHEMA_VERSION', () => {
  it('当前版本号为正整数', () => {
    expect(SCHEMA_VERSION).toBeGreaterThan(0);
    expect(Number.isInteger(SCHEMA_VERSION)).toBe(true);
  });
});
