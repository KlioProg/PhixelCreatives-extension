import { MAX_PALETTE_COLORS } from './constants.js';
import { rgbToHex, rgbToOklab } from './colorMath.js';

const MIN_DISTANCE = 0.065;
const MAX_SAMPLES = 65536;
const distanceSquared = (a, b) => (a.L - b.L) ** 2 + (a.a - b.a) ** 2 + (a.b - b.b) ** 2;

/** Quantized histogram + weighted OKLab clustering. No randomness or neutral filtering. */
export function extractPalette({ width, height, data }) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 0 || height < 0 || data.length !== width * height * 4) {
    throw new Error('Invalid screenshot pixel data.');
  }
  const histogram = new Map();
  const stride = Math.max(1, Math.ceil(Math.sqrt(width * height / MAX_SAMPLES)));
  for (let y = 0; y < height; y += stride) {
    for (let x = 0; x < width; x += stride) {
      const i = (y * width + x) * 4;
      if (data[i + 3] === 0) continue;
      const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
      const key = (r >> 3) * 1024 + (g >> 3) * 32 + (b >> 3);
      let bin = histogram.get(key);
      if (!bin) { bin = { r: 0, g: 0, b: 0, count: 0 }; histogram.set(key, bin); }
      bin.r += r; bin.g += g; bin.b += b; bin.count++;
    }
  }
  const bins = [...histogram.values()].map(bin => {
    const rgb = [bin.r, bin.g, bin.b].map(v => v / bin.count);
    return { rgb, count: bin.count, lab: rgbToOklab(...rgb) };
  }).sort((a, b) => b.count - a.count);
  if (!bins.length) return [];

  // Oversample candidates before diversity selection, so textured regions cannot
  // crowd every smaller accent out of the palette.
  const centers = [{ ...bins[0].lab }];
  const nearest = bins.map(() => Infinity);
  while (centers.length < Math.min(24, bins.length)) {
    let best = -1, score = 0;
    for (let i = 0; i < bins.length; i++) {
      nearest[i] = Math.min(nearest[i], distanceSquared(bins[i].lab, centers.at(-1)));
      const candidate = nearest[i] * Math.sqrt(bins[i].count);
      if (candidate > score) { score = candidate; best = i; }
    }
    if (best < 0 || nearest[best] < 0.0001) break;
    centers.push({ ...bins[best].lab });
  }
  let clusters;
  for (let iteration = 0; iteration < 8; iteration++) {
    clusters = centers.map(() => ({ L: 0, a: 0, b: 0, count: 0, rgb: [0, 0, 0] }));
    for (const bin of bins) {
      let closest = 0, distance = Infinity;
      centers.forEach((center, i) => {
        const next = distanceSquared(bin.lab, center);
        if (next < distance) { distance = next; closest = i; }
      });
      const cluster = clusters[closest];
      cluster.count += bin.count;
      for (const channel of ['L', 'a', 'b']) cluster[channel] += bin.lab[channel] * bin.count;
      bin.rgb.forEach((v, i) => { cluster.rgb[i] += v * bin.count; });
    }
    clusters.forEach((cluster, i) => {
      if (!cluster.count) return;
      for (const channel of ['L', 'a', 'b']) centers[i][channel] = cluster[channel] / cluster.count;
    });
  }
  const candidates = clusters.filter(c => c.count).map(c => {
    const rgb = c.rgb.map(v => Math.round(v / c.count));
    return { rgb, count: c.count, lab: rgbToOklab(...rgb) };
  }).sort((a, b) => b.count - a.count);

  // Merge perceptually close candidates and rank by their combined screen area.
  const merged = [];
  for (const candidate of candidates) {
    const match = merged.find(c => distanceSquared(c.lab, candidate.lab) < MIN_DISTANCE ** 2);
    if (match) {
      const count = match.count + candidate.count;
      match.rgb = match.rgb.map((v, i) => (v * match.count + candidate.rgb[i] * candidate.count) / count);
      match.count = count;
      match.lab = rgbToOklab(...match.rgb);
    } else merged.push({ ...candidate });
  }
  merged.sort((a, b) => b.count - a.count);
  const selected = [];
  for (const candidate of merged) {
    if (selected.every(c => distanceSquared(c.lab, candidate.lab) >= MIN_DISTANCE ** 2)) selected.push(candidate);
    if (selected.length === MAX_PALETTE_COLORS) break;
  }
  return selected.map(c => rgbToHex(...c.rgb));
}
