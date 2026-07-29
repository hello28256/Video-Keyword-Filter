import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: false });
const ctx = await browser.newContext({
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
});
const page = await ctx.newPage();
await page.goto('https://search.bilibili.com/all?keyword=%E9%AA%91%E8%A1%8C', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(5000);

// 找所有"非反馈成功"的视频卡
const result = await page.evaluate(() => {
  const allLinks = document.querySelectorAll('a[href*="/video/"]');
  const seen = new Set();
  const cards = [];
  for (const a of allLinks) {
    let p = a;
    for (let i = 0; i < 8 && p && p !== document.body; i += 1) {
      if (seen.has(p)) break;
      seen.add(p);
      if (p.querySelectorAll('a[href*="/video/"]').length >= 1 && p.tagName !== 'A' && !p.textContent.includes('反馈成功')) {
        cards.push(p);
        break;
      }
      p = p.parentElement;
    }
  }
  // 输出 class 签名
  const sigs = new Map();
  for (const c of cards) {
    const sig = c.tagName + '.' + (c.className?.toString?.() ?? '').slice(0, 60);
    sigs.set(sig, (sigs.get(sig) ?? 0) + 1);
  }
  return { total: cards.length, sigs: Array.from(sigs.entries()) };
});

console.log('真实卡数:', result.total);
console.log('class 签名:');
for (const [sig, count] of result.sigs) {
  console.log(`  ${count}x ${sig}`);
}

await browser.close();
