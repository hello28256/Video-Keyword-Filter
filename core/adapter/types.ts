/**
 * 站点适配器接口：每个视频网站一个实现，content 脚本只调统一 API。
 * WHY: 把网站特定的 DOM 选择器封装在适配器里，新增站点只加一个 adapter 文件。
 */
import type { SiteId } from '#types/config';

export interface VideoCard {
  element: Element;
  title: string;
  author: string | null;
  url: string;
}

export interface SiteAdapter {
  readonly id: SiteId;
  /** 当前 URL 是否归该适配器管（hostname + path 路由） */
  matches(url: URL): boolean;
  /** 在 root 下找出所有视频卡片节点（不解析内容） */
  findCards(root: ParentNode): Element[];
  /** 从卡片 DOM 抽取数据；无法抽取时返回 null，调用方跳过 */
  extractCard(el: Element): VideoCard | null;
  /** 隐藏：加 data-vkf-hidden + display:none；CSS 兜底由 injector 注入 */
  applyHidden(el: Element): void;
  /** 解除隐藏 */
  removeHidden(el: Element): void;
  /** 是否需要递归 shadowRoot（YouTube 详情页部分结构在 shadow DOM） */
  pierceShadow: boolean;
}
