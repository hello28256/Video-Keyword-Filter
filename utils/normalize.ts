/**
 * 文本规范化：用于关键词匹配前归一标题。
 * WHY: 视频标题常有全角空格、连续空格、大小写差异，先归一再 substring 匹配更准。
 */
export interface NormalizeOptions {
  caseSensitive: boolean;
  trimWhitespace: boolean;
}

const DEFAULTS: NormalizeOptions = {
  caseSensitive: false,
  trimWhitespace: true,
};

export function normalizeText(input: string, options: Partial<NormalizeOptions> = {}): string {
  const opts: NormalizeOptions = { ...DEFAULTS, ...options };
  let result = input;
  if (opts.trimWhitespace) {
    result = collapseWhitespace(result);
  }
  if (!opts.caseSensitive) {
    result = result.toLowerCase();
  }
  return result;
}

export function collapseWhitespace(input: string): string {
  return input.replace(/\s+/g, ' ').trim();
}
