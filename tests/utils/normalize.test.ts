import { describe, it, expect } from 'vitest';
import { normalizeText, collapseWhitespace } from '#utils/normalize';

describe('normalizeText', () => {
  it('默认 lowercase + collapse whitespace', () => {
    expect(normalizeText('  Hello   World  ')).toBe('hello world');
  });

  it('caseSensitive=true 时保留大小写', () => {
    expect(normalizeText('Hello World', { caseSensitive: true })).toBe('Hello World');
  });

  it('trimWhitespace=false 时保留原空白', () => {
    expect(normalizeText('a  b', { trimWhitespace: false, caseSensitive: true })).toBe('a  b');
  });

  it('两者组合', () => {
    expect(normalizeText('  A  B  ', { caseSensitive: false, trimWhitespace: true })).toBe('a b');
  });
});

describe('collapseWhitespace', () => {
  it('合并连续空白为单空格', () => {
    expect(collapseWhitespace('a   b\t\tc')).toBe('a b c');
  });

  it('首尾空白去除', () => {
    expect(collapseWhitespace('  hello  ')).toBe('hello');
  });
});
