import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const home = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const mobileCss = readFileSync(new URL('../mobile-home.css', import.meta.url), 'utf8');
const consentJs = readFileSync(new URL('../analytics-consent.js', import.meta.url), 'utf8');
const baseline = execFileSync('git', ['show', '219565f:index.html'], { cwd: root, encoding: 'utf8' });

function placeCards(html) {
  return [...html.matchAll(/<article[^>]*class="[^"]*\bplace-card\b[^"]*"[^>]*>[\s\S]*?<\/article>/g)].map((match) => match[0]);
}

test('mobile shortcuts use current, real destinations and omit staging or paused projects', () => {
  const nav = home.match(/<nav class="mobile-shortcuts"[\s\S]*?<\/nav>/)?.[0] || '';
  const hrefs = [...nav.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(hrefs, ['december-2026.html', 'student-services.html', '#category-1', '#search']);
  assert.doesNotMatch(nav, /workers\.dev|hok-campus|halloween/i);
  assert.match(home, /UniBo 匿名论坛目前处于内部测试，开放时间待确认/);
  assert.doesNotMatch(home, /匿名论坛 · 公开 Beta/);
});

test('Christmas entry and current December notice stay available on mobile', () => {
  assert.match(home, /href="december-2026\.html"[^>]*>[\s\S]*?12 月重要事项/);
  assert.match(home, /href="christmas-2026\.html"[^>]*>[\s\S]*?Christmas 2026/);
  assert.match(home, /data-season="christmas-2026"/);
  assert.match(home, /hero-about/);
});

test('all 53 place cards and existing map destinations are unchanged from the release base', () => {
  const current = placeCards(home);
  const original = placeCards(baseline);
  assert.equal(current.length, 53);
  assert.deepEqual(current, original);
  assert.equal((home.match(/class="map-link"/g) || []).length, (baseline.match(/class="map-link"/g) || []).length);
  assert.match(home, /id="search" type="search"/);
  assert.match(home, /id="category-1"/);
});

test('mobile styles provide two-column shortcuts without hiding the Christmas card or disabling reduced motion', () => {
  assert.match(home, /href="mobile-home\.css"/);
  assert.match(mobileCss, /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(mobileCss, /\.hero \.november-entry:not\(\.christmas-entry\)/);
  assert.doesNotMatch(mobileCss, /body\s*\{[^}]*overflow-x\s*:\s*hidden/);
  assert.match(mobileCss, /prefers-reduced-motion:\s*reduce/);
});

test('Umami shortcut events are fixed-name and opt-in; no Staging forum destination is tracked', () => {
  assert.match(consentJs, /"shortcut-dates":\s*EVENT_NAMES\.shortcutDates/);
  assert.match(consentJs, /readChoice\(\) !== "accepted"/);
  assert.doesNotMatch(consentJs, /shortcutForum|shortcutHalloween/);
  assert.doesNotMatch(navSource(), /workers\.dev/);
});

function navSource() {
  return home.match(/<nav class="mobile-shortcuts"[\s\S]*?<\/nav>/)?.[0] || '';
}
