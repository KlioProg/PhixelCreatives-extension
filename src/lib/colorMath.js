export function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();
}

// Preserve legacy alpha values; newly captured screenshot palettes are opaque.
export function convertToHex(value) {
  if (typeof value !== 'string') return null;
  const input = value.trim();
  const hex = input.match(/^#([\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i);
  if (hex) {
    let digits = hex[1].toUpperCase();
    if (digits.length < 5) digits = [...digits].map(c => c + c).join('');
    if (digits.length === 8 && digits.endsWith('FF')) digits = digits.slice(0, 6);
    return '#' + digits;
  }
  const rgb = input.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)$/i);
  if (!rgb) return null;
  const channels = rgb.slice(1, 4).map(Number);
  const alpha = rgb[4] === undefined ? 1 : Number(rgb[4]);
  if (channels.some(v => v > 255) || !Number.isFinite(alpha) || alpha < 0 || alpha > 1) return null;
  return rgbToHex(...channels) + (alpha < 1 ? Math.round(alpha * 255).toString(16).padStart(2, '0').toUpperCase() : '');
}

export function rgbToOklab(r, g, b) {
  // OKLab's matrix expects linear-light sRGB, not gamma-encoded byte values.
  const linear = [r, g, b].map(v => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const [R, G, B] = linear;
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return {
    L: 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
  };
}

export function getTrueColorMath(value) {
  const hex = convertToHex(value);
  if (!hex) return null;
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  const [R, G, B] = [r, g, b].map(v => v / 255);
  const max = Math.max(R, G, B), min = Math.min(R, G, B);
  const d = max - min, l = (max + min) / 2;
  let h = 0;
  if (d) {
    if (max === R) h = ((G - B) / d + (G < B ? 6 : 0)) * 60;
    else if (max === G) h = ((B - R) / d + 2) * 60;
    else h = ((R - G) / d + 4) * 60;
  }
  const percent = v => Math.round(v * 100);
  const k = 1 - max;
  const cmyk = max === 0 ? [0, 0, 0, 100]
    : [(1 - R - k) / max, (1 - G - k) / max, (1 - B - k) / max, k].map(percent);
  const lab = rgbToOklab(r, g, b);
  return {
    hex,
    rgb: `${r}, ${g}, ${b}`,
    hsl: `${Math.round(h) % 360}, ${percent(d ? d / (1 - Math.abs(2 * l - 1)) : 0)}, ${percent(l)}`,
    hsb: `${Math.round(h) % 360}, ${percent(max ? d / max : 0)}, ${percent(max)}`,
    cmyk: cmyk.join(', '),
    oklab: [lab.L, lab.a, lab.b].map(v => v.toFixed(3)).join(', '),
    isLight: r * 0.299 + g * 0.587 + b * 0.114 > 150,
  };
}
