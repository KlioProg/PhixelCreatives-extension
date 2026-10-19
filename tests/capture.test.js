import { test } from 'node:test';
import assert from 'node:assert/strict';
import { capturePalette, screenshotPixels } from '../src/lib/capturePalette.js';
import { copyText } from '../src/lib/clipboard.js';
import { solid } from './fixtures/images.js';

function tabs(url = 'https://example.com') {
  return {
    async query(options) {
      assert.equal(options.active, true);
      return [{ id: 4, windowId: 2, url, title: 'Example' }];
    },
    async captureVisibleTab(windowId, options) {
      assert.equal(windowId, 2);
      assert.deepEqual(options, { format: 'png' });
      return 'data:image/png;base64,local';
    },
  };
}
test('captures the active window and passes only colors and title to the caller', async () => {
  const result = await capturePalette(tabs(), async url => {
    assert.equal(url, 'data:image/png;base64,local');
    return solid;
  });
  assert.deepEqual(result, { title: 'Example', colors: ['#2563EB'] });
});
test('restricted schemes are rejected before capture', async () => {
  for (const url of ['chrome://extensions', 'edge://settings', 'file:///private.txt', 'about:blank', 'chrome-extension://other/page.html', 'data:text/html,hi']) {
    const api = tabs(url);
    api.captureVisibleTab = () => assert.fail('Restricted page was captured');
    await assert.rejects(capturePalette(api), /supported webpage/);
  }
});
test('capture, tab query, decoding failures and tab switches reject', async () => {
  await assert.rejects(capturePalette({ async query() { return []; } }), /active tab/);
  const api = tabs();
  api.captureVisibleTab = async () => { throw new Error('Capture quota exceeded'); };
  await assert.rejects(capturePalette(api), /quota/);
  await assert.rejects(capturePalette(tabs(), async () => { throw new Error('Decode failed'); }), /Decode/);
  const switched = tabs();
  let queries = 0;
  switched.query = async () => [{ id: ++queries === 1 ? 4 : 5, windowId: 2, url: 'https://example.com' }];
  await assert.rejects(capturePalette(switched, async () => solid), /changed/);
});
test('screenshot decode errors are reported', async () => {
  const previous = globalThis.Image;
  globalThis.Image = class { set src(value) { assert.equal(value, 'bad'); this.onerror(); } };
  try { await assert.rejects(screenshotPixels('bad'), /decode/); }
  finally { if (previous) globalThis.Image = previous; else delete globalThis.Image; }
});
test('clipboard failures reject rather than reporting success', async () => {
  await assert.rejects(copyText('hello', undefined), /unavailable/);
  await assert.rejects(copyText('hello', { async writeText() { throw new Error('Denied'); } }), /Denied/);
  let copied;
  await copyText('#ABCDEF', { async writeText(value) { copied = value; } });
  assert.equal(copied, '#ABCDEF');
});
