# Video Keyword Filter

一个 WXT (Manifest V3) 浏览器插件，根据用户配置的关键词列表，**自动隐藏** B 站、抖音、YouTube 上标题含这些关键词的视频卡片。支持白名单 UP 主豁免、站点独立开关、关键词实时生效。

## 功能

- 🎯 **关键词屏蔽**：标题包含任一关键词 → 卡片立即隐藏
- ✅ **白名单豁免**：白名单 UP 主的视频即使命中关键词也保留
- 🔄 **实时同步**：popup 改词 → 当前所有匹配页面立即刷新
- 🎛️ **站点独立开关**：可单独关掉 B 站 / 抖音 / YouTube
- 📦 **跨浏览器**：一份代码同时支持 Chrome / Edge / Firefox

## 当前状态

| 阶段 | 站点支持 | 状态 |
|------|---------|------|
| Phase 1（当前） | B 站（首页 + 详情页推荐） | ✅ MVP |
| Phase 2 | 抖音 / YouTube + 白名单 | ⏳ 计划中 |
| Phase 3 | 每日隐藏统计 / 繁简归一化 | ⏳ 计划中 |

## 开发

### 环境要求
- Node.js 22+（推荐 24）
- npm 11+

### 安装与启动

```bash
npm install      # 自动跑 wxt prepare 生成 .wxt 类型
npm run dev      # 启动开发模式（带 HMR）
```

`npm run dev` 启动后，WXT 会提示加载路径（默认 `.output/chrome-mv3`）到 Chrome 扩展。

### 加载到 Chrome

1. 打开 `chrome://extensions`
2. 开启右上角"开发者模式"
3. 点"加载已解压的扩展程序"，选择 `.output/chrome-mv3/`
4. 打开 https://www.bilibili.com/ → 点击工具栏插件图标 → 添加关键词 → 刷新页面

### 测试与类型检查

```bash
npm test            # 跑全部 vitest 单测
npm run test:watch  # 监听模式
npm run typecheck   # tsc --noEmit
```

### 打包发布

```bash
npm run build           # Chrome / Edge 版本到 .output/chrome-mv3/
npm run build:firefox   # Firefox 版本
npm run zip             # 打 zip 包用于商店上传
```

## 架构

```
entrypoints/         # 浏览器入口（content / background / popup）
  ├── content.ts          # 主入口：URL 路由 → adapter → scanner + observer
  ├── background.ts       # service worker：storage 变化兜底广播
  └── popup/              # Vue 3 弹窗

core/                # 框架无关纯逻辑（单测主战场）
  ├── matcher/            # 关键词匹配、决策单点
  ├── adapter/            # SiteAdapter 接口 + bilibili 实现
  ├── dom/                # observer / scanner / injector
  └── storage/            # schema + keys + accessors

utils/               # 防抖、归一、URL、logger
types/               # FilterConfig / WhitelistEntry / RuntimeMessage
tests/               # vitest + jsdom
```

### 关键设计

1. **SiteAdapter 模式**：每站一个适配器（`core/adapter/{site}.ts`），封装该站 DOM 选择器；content 脚本调统一接口。
2. **decide() 单点入口**：所有屏蔽决策走 `core/matcher/decision.ts` 的纯函数，输入 `{title, author, site}` + config，输出 `{hide, reason}`，易测。
3. **storage.watch 实时同步**：用 WXT 内置 `wxt/storage`，popup → content 走 `storage.onChanged`。
4. **CSS 兜底**：`[data-vkf-hidden] { display: none !important; }` 一条规则，挡掉所有 SPA 样式覆盖。

## 添加新站点

1. 在 `core/adapter/` 新建 `{site}.ts`，实现 `SiteAdapter` 接口
2. 在 `core/adapter/registry.ts` 的 `adapters` 数组里注册
3. 在 `wxt.config.ts` 的 `host_permissions` 和 `entrypoints/content.ts` 的 `matches` 里加 URL 模式
4. 在 `entrypoints/background.ts` 的 `HOST_PATTERNS` 里同步
5. 写一份 HTML fixture 到 `tests/fixtures/dom-snippets/`，写 `tests/adapter/{site}.test.ts`

## 风险与对策

| 风险 | 对策 |
|------|------|
| 抖音 DOM 经常 hash 化 / A/B 测试 | 多选择器 fallback；`data-e2e` 优先；observer 监听 `document.body` |
| 抖音详情页跨域 iframe | `all_frames: true` + `match_about_blank: true`（已在 content.ts 注释） |
| YouTube Shadow DOM | adapter `pierceShadow` 标记 + 递归 `shadowRoot` |
| MV3 service worker 休眠 | 所有状态走 storage；background 兜底广播 |
| 误伤（关键词太短） | UI 提示；Phase 2 加"最低长度"校验 |
