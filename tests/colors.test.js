import { test } from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { extractPalette } from '../src/lib/visualColors.js';
import { convertToHex, rgbToOklab, getTrueColorMath } from '../src/lib/colorMath.js';
import * as fixtures from './fixtures/images.js';

test('solid image produces its exact color without padding', () => {
  assert.deepEqual(extractPalette(fixtures.solid), ['#2563EB']);
});
test('large regions retain exact colors in area order', () => {
  assert.deepEqual(extractPalette(fixtures.regions), ['#DC1E32', '#14AA50', '#1E3CDC']);
});
test('dominant white and dark neutrals are preserved', () => {
  assert.equal(extractPalette(fixtures.light)[0], '#FFFFFF');
  assert.equal(extractPalette(fixtures.dark)[0], '#121212');
});
test('similar shades collapse instead of filling nine slots', () => {
  assert.equal(extractPalette(fixtures.similar).length, 1);
});
test('nine distinct large regions are retained, including the ninth color', () => {
  const rgb = [[255, 0, 0], [0, 255, 0], [0, 0, 255], [255, 255, 0], [0, 255, 255], [255, 0, 255], [255, 255, 255], [0, 0, 0], [128, 128, 128]];
  const colors = extractPalette(fixtures.image(90, 90, x => rgb[Math.floor(x / 10)]));
  assert.deepEqual([...colors].sort(), ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#00FFFF', '#FF00FF', '#FFFFFF', '#000000', '#808080'].sort());
});
test('gradients are diverse, bounded and deterministic', () => {
  const colors = extractPalette(fixtures.gradient);
  assert.ok(colors.length >= 3 && colors.length <= 9);
  assert.deepEqual(colors, extractPalette(fixtures.gradient));
  assert.equal(new Set(colors).size, colors.length);
  for (const color of colors) assert.match(color, /^#[0-9A-F]{6}$/);
  assert.ok(colors.some(c => parseInt(c.slice(1, 3), 16) > 190));
  assert.ok(colors.some(c => parseInt(c.slice(5, 7), 16) > 190));
});
test('textured landscape keeps sky, foliage, sand and small red subject', () => {
  const start = performance.now();
  const colors = extractPalette(fixtures.landscape).map(c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16)));
  assert.ok(colors.some(([r, g, b]) => b > g && g > r));
  assert.ok(colors.some(([r, g, b]) => g > r * 1.5 && g > b * 1.5));
  assert.ok(colors.some(([r, g, b]) => r > 170 && g > 140 && b < 150));
  assert.ok(colors.some(([r, g, b]) => r > 170 && g < 80 && b < 80));
  console.log(`Landscape fixture processing: ${(performance.now() - start).toFixed(1)} ms`);
});
test('empty and fully transparent images have no palette; malformed images fail', () => {
  assert.deepEqual(extractPalette({ width: 0, height: 0, data: [] }), []);
  assert.deepEqual(extractPalette({ width: 1, height: 1, data: [0, 0, 0, 0] }), []);
  assert.throws(() => extractPalette({ width: 2, height: 2, data: [] }));
});
test('legacy color formats normalize without discarding alpha', () => {
  assert.equal(convertToHex('#abc'), '#AABBCC');
  assert.equal(convertToHex('rgb(37, 99, 235)'), '#2563EB');
  assert.equal(convertToHex('rgba(255, 0, 0, 0.5)'), '#FF000080');
  assert.equal(convertToHex('#abcf'), '#AABBCC');
  assert.equal(convertToHex('invalid'), null);
});
test('OKLab uses linear sRGB, matching reference primaries and mid-gray', () => {
  for (const [rgb, expected] of [
    [[255, 0, 0], [0.627955, 0.224863, 0.125846]],
    [[128, 128, 128], [0.599871, 0, 0]],
    [[255, 255, 255], [1, 0, 0]],
    [[0, 0, 0], [0, 0, 0]],
  ]) {
    const actual = rgbToOklab(...rgb);
    [actual.L, actual.a, actual.b].forEach((v, i) => assert.ok(Math.abs(v - expected[i]) < 0.00001));
  }
});
test('detail conversions agree with normalized swatch channels', () => {
  const red = getTrueColorMath('#f00');
  assert.equal(red.hex, '#FF0000');
  assert.equal(red.rgb, '255, 0, 0');
  assert.equal(red.hsl, '0, 100, 50');
  assert.equal(red.hsb, '0, 100, 100');
  assert.equal(red.cmyk, '0, 100, 100, 0');
  assert.equal(getTrueColorMath('#000').cmyk, '0, 0, 0, 100');
});
