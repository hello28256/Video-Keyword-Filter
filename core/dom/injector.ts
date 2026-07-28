/**
 * 注入 CSS 兜底：用 !important 规则确保 SPA 卸载/重渲染时隐藏状态不丢。
 * WHY: 仅靠 element.style.display = 'none' 容易被视频站 JS 覆盖；
 *      [data-vkf-hidden] + !important 是最后一层保险。
 */
const STYLE_ID = 'vkf-base-style';
const HIDDEN_ATTR = 'data-vkf-hidden';

const CSS_RULE = `[${HIDDEN_ATTR}] { display: none !important; }`;

export function ensureBaseStyle(doc: Document = document): void {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS_RULE;
  // WHY: 插到 head 最前面，避免被网站自有样式覆盖 cascade 顺序。
  (doc.head ?? doc.documentElement).prepend(style);
}

export function markHidden(el: Element): void {
  el.setAttribute(HIDDEN_ATTR, '');
}

export function unmarkHidden(el: Element): void {
  el.removeAttribute(HIDDEN_ATTR);
}
