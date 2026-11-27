import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const source = readFileSync(new URL('../analytics-consent.js', import.meta.url), 'utf8');

function loadHook({ path = '/', choice = 'accepted' } = {}) {
  const window = {
    location: { hostname: 'bologna-students.github.io', pathname: path },
    localStorage: { getItem: () => choice },
    addEventListener() {},
    doNotTrack: '0'
  };
  const document = {
    readyState: 'loading',
    title: 'Bologna Students',
    referrer: 'https://example.org/story?private=1',
    addEventListener() {}
  };
  vm.runInNewContext(source, { window, document, navigator: { language: 'zh-CN' }, URL });
  return window.bolognaUmamiBeforeSend;
}

function loadPage({ path = '/', choice = 'accepted', dnt = '0', msdnt = '0', windowDnt = '0' } = {}) {
  const listeners = {};
  const elements = new Map();
  const makeElement = (selector = '') => ({
    selector,
    hidden: false,
    textContent: '',
    attrs: {},
    classList: { add() {} },
    addEventListener() {},
    appendChild() {},
    setAttribute(key, value) { this.attrs[key] = value; },
    focus() {},
    querySelector(key) {
      if (!elements.has(`${selector}:${key}`)) elements.set(`${selector}:${key}`, makeElement(`${selector}:${key}`));
      return elements.get(`${selector}:${key}`);
    }
  });
  let injectedScript = null;
  const document = {
    readyState: 'loading',
    title: 'Bologna Students',
    referrer: '',
    addEventListener(name, callback) { listeners[name] = callback; },
    createElement: () => makeElement('created'),
    querySelector: () => makeElement('footer'),
    body: { appendChild() {} },
    head: { appendChild(script) { injectedScript = script; } }
  };
  const window = {
    location: { hostname: 'bologna-students.github.io', pathname: path },
    localStorage: { getItem: () => choice },
    addEventListener() {},
    doNotTrack: windowDnt
  };
  const navigator = { language: 'zh-CN', doNotTrack: dnt, msDoNotTrack: msdnt };
  vm.runInNewContext(source, { window, document, navigator, URL });
  listeners.DOMContentLoaded();
  return { window, get script() { return injectedScript; } };
}

test('manual Umami track(callback) pageview passes the hook and only sends sanitized page data', () => {
  const hook = loadHook({ path: '/' });
  const result = hook('event', {
    website: 'unexpected',
    url: '/?q=private',
    name: undefined,
    data: { query: 'private' },
    id: 'unexpected'
  });

  assert.deepEqual(JSON.parse(JSON.stringify(result)), {
    website: '3c681631-af24-4ecd-98a8-5d1fa8cb861e',
    hostname: 'bologna-students.github.io',
    url: '/',
    title: 'Bologna Students',
    language: 'zh-CN',
    referrer: 'https://example.org'
  });
});

test('manual pageview is accepted for an allowlisted article path without query or fragment data', () => {
  const hook = loadHook({ path: '/november-2026.html' });
  const result = hook('event', { url: '/november-2026.html?secret=1#private' });
  assert.equal(result.url, '/november-2026.html');
  assert.equal('name' in result, false);
  assert.equal('data' in result, false);
});

test('December student page is allowlisted without forwarding query or fragment data', () => {
  const hook = loadHook({ path: '/december-2026.html' });
  const result = hook('event', { url: '/december-2026.html?private=1#section' });
  assert.equal(result.url, '/december-2026.html');
  assert.equal('name' in result, false);
  assert.equal('data' in result, false);
});

test('only named allowlisted events pass; arbitrary events and disallowed paths fail closed', () => {
  const hook = loadHook();
  assert.equal(hook('event', { name: 'home_shortcut_dates_click' }).name, 'home_shortcut_dates_click');
  assert.equal(hook('event', { name: 'home_shortcut_forum_click' }), false);
  assert.equal(hook('event', { name: 'user-search-query' }), false);
  assert.equal(loadHook({ path: '/unlisted.html' })('event', {}), false);
  assert.equal(loadHook({ choice: 'rejected' })('event', {}), false);
});

test('manual pageview remains disabled for auto tracking and is triggered after tracker load only once per page', () => {
  assert.match(source, /data-auto-track", "false"/);
  assert.match(source, /script\.onload = trackPageview/);
  assert.match(source, /if \(pageviewSent \|\| readChoice\(\) !== "accepted"/);
  assert.match(source, /pageviewSent = true;\s*window\.umami\.track\(function/);
});

test('opt-in homepage load sends one sanitized manual pageview; rejection and DNT inject no tracker', () => {
  const page = loadPage();
  assert.equal(page.script.attrs['data-auto-track'], 'false');
  let calls = 0;
  let sent = null;
  page.window.umami = {
    track(callback) {
      calls += 1;
      sent = page.window.bolognaUmamiBeforeSend('event', callback({ website: 'tracker-default' }));
      return Promise.resolve();
    }
  };
  page.script.onload();
  page.script.onload();
  assert.equal(calls, 1);
  assert.equal(sent.url, '/');
  assert.equal('name' in sent, false);

  assert.equal(loadPage({ choice: 'rejected' }).script, null);
  assert.equal(loadPage({ dnt: '1' }).script, null);
  assert.equal(loadPage({ dnt: 1 }).script, null);
  assert.equal(loadPage({ dnt: 'yes' }).script, null);
  assert.equal(loadPage({ msdnt: '1' }).script, null);
  assert.equal(loadPage({ windowDnt: 1 }).script, null);
});
