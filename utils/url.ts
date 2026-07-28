/**
 * URL 工具。
 * WHY: registry 路由时用 hostname 而不是 full URL，避免参数序列化麻烦。
 * WHY: matchesHostPattern 用 '*.' 风格通配符，对齐 manifest 的 host_permissions 写法。
 */

export function extractHostname(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/**
 * 匹配 host 模式。
 * 'www.bilibili.com' 与 '*.bilibili.com' 都匹配 'www.bilibili.com'；
 * '*.bilibili.com' 也匹配 'search.bilibili.com'，但不匹配裸 'bilibili.com'。
 */
export function matchesHostPattern(hostname: string, pattern: string): boolean {
  if (pattern === hostname) return true;
  if (pattern.startsWith('*.')) {
    const suffix = pattern.slice(1); // '.bilibili.com'
    return hostname.endsWith(suffix) && hostname.length > suffix.length;
  }
  return false;
}
