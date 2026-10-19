import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPaletteStore } from '../src/lib/paletteStore.js';

function storage(initial) {
  let data = structuredClone(initial);
  return {
    failWrite: false,
    async get() { return structuredClone(data); },
    async set(next) {
      if (this.failWrite) throw new Error('Quota exceeded');
      data = structuredClone(next);
    },
    snapshot() { return structuredClone(data); },
  };
}
test('loads legacy palettes with metadata, rgb strings and empty color arrays', async () => {
  const api = storage({ savedPalettes: [
    { id: 12, title: 'Old', colors: ['rgb(255, 0, 0)', '#abc'], custom: true },
    { id: 'empty', title: 'Empty', colors: [] },
  ] });
  const store = createPaletteStore(api);
  const loaded = await store.load();
  assert.deepEqual(loaded, [
    { id: 12, title: 'Old', colors: ['#FF0000', '#AABBCC'], custom: true },
    { id: 'empty', title: 'Empty', colors: [] },
  ]);
  assert.equal(api.snapshot().savedPalettes[0].colors[0], 'rgb(255, 0, 0)');
});
test('serializes mutations and persists rename, edit, duplicate and delete', async () => {
  const api = storage({ savedPalettes: [{ id: 1, title: 'Original', colors: ['#123456'] }] });
  const store = createPaletteStore(api);
  const rename = store.update(deck => deck.map(p => ({ ...p, title: 'Renamed' })));
  const edit = store.update(deck => deck.map(p => ({ ...p, colors: ['#abcdef', '#123'] })));
  await Promise.all([rename, edit]);
  await store.update(deck => [{ ...deck[0], id: 2 }, ...deck]);
  await store.update(deck => deck.filter(p => p.id !== 1));
  assert.deepEqual(api.snapshot(), { savedPalettes: [{ id: 2, title: 'Renamed', colors: ['#ABCDEF', '#112233'] }] });
  assert.deepEqual(await createPaletteStore(api).load(), api.snapshot().savedPalettes);
});
test('failed writes preserve saved state and subsequent operations can retry', async () => {
  const api = storage({ savedPalettes: [{ id: 1, title: 'Safe', colors: ['#123456'] }] });
  const store = createPaletteStore(api);
  await store.load();
  api.failWrite = true;
  await assert.rejects(store.update(() => []), /Quota/);
  api.failWrite = false;
  const result = await store.update(deck => [...deck, { id: 2, title: 'New', colors: ['#fff'] }]);
  assert.equal(result.length, 2);
});
test('failed reads block writes so existing palettes cannot be overwritten', async () => {
  let writes = 0;
  const store = createPaletteStore({ async get() { throw new Error('Read failed'); }, async set() { writes++; } });
  await assert.rejects(store.load(), /Read failed/);
  await assert.rejects(store.update(() => []), /Read failed/);
  assert.equal(writes, 0);
});
test('new saves normalize colors and enforce the shared nine-color limit', async () => {
  const store = createPaletteStore(storage({}));
  const result = await store.update(() => [{ id: 1, title: 'Large', colors: Array.from({ length: 12 }, (_, i) => `rgb(${i * 20}, 0, 0)`) }]);
  assert.equal(result[0].colors.length, 9);
  assert.match(result[0].colors[8], /^#[0-9A-F]{6}$/);
});
