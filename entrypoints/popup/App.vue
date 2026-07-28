<script setup lang="ts">
/**
 * Popup 根组件：
 *   - 加载 config 到本地响应式状态
 *   - 编辑关键词（textarea，每行一个；自动 trim / 去重空行）
 *   - 编辑白名单（每行一个 UP 主名）
 *   - 站点独立开关
 *   - 总开关
 */
import { ref, computed, onMounted, watch } from 'vue';
import { getConfig, updateConfig } from '#core/storage/accessors';
import type { FilterConfig, SiteId } from '#types/config';
import { ALL_SITES } from '#types/config';

const SITE_LABELS: Record<SiteId, string> = {
  bilibili: 'B 站',
  douyin: '抖音',
  youtube: 'YouTube',
};

const config = ref<FilterConfig | null>(null);
const keywordsText = ref('');
const whitelistText = ref('');

const keywordCount = computed(() => {
  if (!keywordsText.value) return 0;
  return keywordsText.value
    .split('\n')
    .map((k) => k.trim())
    .filter(Boolean).length;
});

const whitelistCount = computed(() => {
  if (!whitelistText.value) return 0;
  return whitelistText.value
    .split('\n')
    .map((k) => k.trim())
    .filter(Boolean).length;
});

const siteToggles = computed(() => config.value?.siteEnabled ?? null);

onMounted(async () => {
  config.value = await getConfig();
  keywordsText.value = (config.value?.keywords ?? []).join('\n');
  whitelistText.value = (config.value?.whitelist ?? [])
    .filter((w) => w.scope === 'all')
    .map((w) => w.value)
    .join('\n');
});

// 任意输入变更都写回 storage（debounce 由浏览器 IO 自然合并）。
async function flushKeywords() {
  const list = keywordsText.value
    .split('\n')
    .map((k) => k.trim())
    .filter(Boolean);
  // WHY: 去重，避免用户不小心复制粘贴产生重复行。
  const unique = Array.from(new Set(list));
  config.value = await updateConfig({ keywords: unique });
  keywordsText.value = unique.join('\n');
}

async function flushWhitelist() {
  const list = whitelistText.value
    .split('\n')
    .map((v) => v.trim())
    .filter(Boolean);
  const unique = Array.from(new Set(list));
  config.value = await updateConfig({
    whitelist: unique.map((value) => ({ value, scope: 'all' as const })),
  });
  whitelistText.value = unique.join('\n');
}

async function toggleEnabled() {
  if (!config.value) return;
  config.value = await updateConfig({ enabled: !config.value.enabled });
}

async function toggleSite(site: SiteId) {
  if (!config.value) return;
  const current = config.value.siteEnabled[site];
  config.value = await updateConfig({
    siteEnabled: { ...config.value.siteEnabled, [site]: !current },
  });
}

watch(keywordsText, () => {
  void flushKeywords();
});
watch(whitelistText, () => {
  void flushWhitelist();
});
</script>

<template>
  <div v-if="config" class="app">
    <h1 class="app__title">视频关键词过滤</h1>

    <div class="row">
      <span>启用插件</span>
      <div
        class="toggle"
        :class="{ 'is-on': config.enabled }"
        role="switch"
        :aria-checked="config.enabled"
        @click="toggleEnabled"
      ></div>
    </div>

    <div>
      <p class="app__section-title">屏蔽关键词（{{ keywordCount }}）</p>
      <textarea
        v-model="keywordsText"
        placeholder="一行一个词。例如：&#10;剧透&#10;测评&#10;营销号"
        spellcheck="false"
      ></textarea>
      <p class="hint">命中任一关键词的标题会被隐藏。</p>
    </div>

    <div>
      <p class="app__section-title">白名单 UP 主（{{ whitelistCount }}）</p>
      <textarea
        v-model="whitelistText"
        placeholder="一行一个 UP 主名，不区分大小写。例如：&#10;我的最爱"
        spellcheck="false"
      ></textarea>
      <p class="hint">白名单 UP 主的视频不会被屏蔽（即使标题命中关键词）。</p>
    </div>

    <div>
      <p class="app__section-title">站点开关</p>
      <div v-if="siteToggles" class="site-row" v-for="site in ALL_SITES" :key="site">
        <span class="site-row__name">{{ SITE_LABELS[site] }}</span>
        <div
          class="toggle"
          :class="{ 'is-on': siteToggles[site] }"
          role="switch"
          :aria-checked="siteToggles[site]"
          @click="toggleSite(site)"
        ></div>
      </div>
    </div>

    <div class="status">
      当前状态：<strong>{{ config.enabled ? '运行中' : '已停用' }}</strong>
    </div>
  </div>
  <div v-else class="status">加载中…</div>
</template>
