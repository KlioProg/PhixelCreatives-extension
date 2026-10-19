// Small deterministic raster fixtures. Every entry is an RGBA image, not CSS.
export function image(width, height, pixel) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) data.set([...pixel(x, y), 255], (y * width + x) * 4);
  }
  return { width, height, data };
}

export const solid = image(64, 64, () => [37, 99, 235]);
export const regions = image(100, 100, (x) => x < 60 ? [220, 30, 50] : x < 90 ? [20, 170, 80] : [30, 60, 220]);
export const similar = image(64, 64, (x) => [100 + x % 4, 120 + x % 4, 140 + x % 4]);
export const gradient = image(256, 64, (x) => [x, 0, 255 - x]);
export const light = image(100, 100, (x) => x < 85 ? [255, 255, 255] : x < 95 ? [25, 25, 25] : [30, 80, 220]);
export const dark = image(100, 100, (x) => x < 85 ? [18, 18, 18] : x < 95 ? [240, 240, 240] : [30, 180, 80]);
// Photo-like landscape: textured sky, foliage, sand and a small red subject.
// Deterministic noise exercises thousands of shades rather than flat regions.
export const landscape = image(160, 100, (x, y) => {
  const noise = (x * 13 + y * 17) % 25 - 12;
  const base = x > 110 && x < 135 && y > 55 && y < 80 ? [210, 45, 35]
    : y < 45 ? [90, 160, 220] : y < 80 ? [40, 110, 50] : [210, 180, 120];
  return base.map(v => v + noise);
});
