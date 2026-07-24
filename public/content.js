/* global chrome */

const MAX_PALETTE_COLORS = 9;

const parseCssColor = (cssColor) => {
  if (!cssColor || cssColor === 'transparent') return null;

  const rgbaMatch = cssColor.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/);
  if (rgbaMatch) {
    return {
      r: Number(rgbaMatch[1]),
      g: Number(rgbaMatch[2]),
      b: Number(rgbaMatch[3]),
      a: rgbaMatch[4] !== undefined ? Number(rgbaMatch[4]) : 1
    };
  }

  const hexMatch = cssColor.match(/^#([A-Fa-f0-9]{3,4}|[A-Fa-f0-9]{6}|[A-Fa-f0-9]{8})$/);
  if (hexMatch) {
    let hex = hexMatch[1];
    if (hex.length === 3 || hex.length === 4) {
      hex = hex.split('').map((ch) => ch + ch).join('');
    }
    const hasAlpha = hex.length === 8;
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
      a: hasAlpha ? parseInt(hex.slice(6, 8), 16) / 255 : 1
    };
  }

  return null;
};

const rgbToHex = ({ r, g, b }) => {
  const component = (value) => value.toString(16).padStart(2, '0').toUpperCase();
  return `#${component(r)}${component(g)}${component(b)}`;
};

const srgbToLinear = (value) => {
  const v = value / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
};

const rgbToLab = ({ r, g, b }) => {
  const linear = [r, g, b].map(srgbToLinear);
  const x = (linear[0] * 0.4124564 + linear[1] * 0.3575761 + linear[2] * 0.1804375) / 0.95047;
  const y = (linear[0] * 0.2126729 + linear[1] * 0.7151522 + linear[2] * 0.0721750) / 1.0;
  const z = (linear[0] * 0.0193339 + linear[1] * 0.1191920 + linear[2] * 0.9503041) / 1.08883;

  const f = (v) => (v > 0.008856 ? Math.cbrt(v) : (7.787 * v) + 16 / 116);
  const fx = f(x);
  const fy = f(y);
  const fz = f(z);

  return {
    L: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz)
  };
};

const colorDistance = (labA, labB) => {
  const dL = labA.L - labB.L;
  const da = labA.a - labB.a;
  const db = labA.b - labB.b;
  return Math.sqrt(dL * dL + da * da + db * db);
};

const isVisibleElement = (element) => {
  const style = window.getComputedStyle(element);
  if (!style || style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) === 0) {
    return false;
  }

  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
};

const buildPalette = (entries, maxColors) => {
  if (!entries.length) return [];

  const palette = [...entries];

  while (palette.length > maxColors) {
    let bestPair = [0, 1];
    let smallestDistance = Infinity;

    for (let i = 0; i < palette.length; i += 1) {
      for (let j = i + 1; j < palette.length; j += 1) {
        const distance = colorDistance(palette[i].lab, palette[j].lab);
        if (distance < smallestDistance) {
          smallestDistance = distance;
          bestPair = [i, j];
        }
      }
    }

    const [i, j] = bestPair;
    const mergedCount = palette[i].count + palette[j].count;
    const mergedRgb = {
      r: Math.round((palette[i].rgb.r * palette[i].count + palette[j].rgb.r * palette[j].count) / mergedCount),
      g: Math.round((palette[i].rgb.g * palette[i].count + palette[j].rgb.g * palette[j].count) / mergedCount),
      b: Math.round((palette[i].rgb.b * palette[i].count + palette[j].rgb.b * palette[j].count) / mergedCount)
    };

    palette.splice(j, 1);
    palette.splice(i, 1, {
      rgb: mergedRgb,
      hex: rgbToHex(mergedRgb),
      count: mergedCount,
      lab: rgbToLab(mergedRgb)
    });
  }

  return palette.sort((a, b) => b.count - a.count).map((entry) => entry.hex);
};

const findClosestTextElement = (startElement) => {
  let element = startElement;
  while (element && element !== document.documentElement) {
    if (element instanceof HTMLElement) {
      const style = window.getComputedStyle(element);
      const text = element.innerText?.trim();
      if (
        text &&
        text.length > 0 &&
        style.visibility !== 'hidden' &&
        style.display !== 'none' &&
        style.opacity !== '0' &&
        style.fontSize !== '0px'
      ) {
        return element;
      }
    }
    element = element.parentElement;
  }
  return null;
};

let activeFontPicker = null;
let fontPickerOverlay = null;
let fontPickerHighlight = null;

const cleanupFontPicker = () => {
  if (!activeFontPicker) return;
  document.removeEventListener('click', activeFontPicker.clickHandler, true);
  document.removeEventListener('keydown', activeFontPicker.keydownHandler, true);
  document.removeEventListener('mousemove', activeFontPicker.mousemoveHandler, true);
  if (fontPickerOverlay && fontPickerOverlay.parentElement) {
    fontPickerOverlay.parentElement.removeChild(fontPickerOverlay);
  }
  if (fontPickerHighlight && fontPickerHighlight.parentElement) {
    fontPickerHighlight.parentElement.removeChild(fontPickerHighlight);
  }
  fontPickerOverlay = null;
  fontPickerHighlight = null;
  document.documentElement.style.cursor = '';
  activeFontPicker = null;
};

const createFontPickerOverlay = () => {
  if (fontPickerOverlay) return;
  fontPickerOverlay = document.createElement('div');
  fontPickerOverlay.style.position = 'fixed';
  fontPickerOverlay.style.inset = '0';
  fontPickerOverlay.style.pointerEvents = 'none';
  fontPickerOverlay.style.zIndex = '2147483647';
  fontPickerOverlay.style.background = 'rgba(0, 0, 0, 0.12)';
  fontPickerOverlay.style.backdropFilter = 'blur(1px)';
  fontPickerOverlay.style.display = 'flex';
  fontPickerOverlay.style.alignItems = 'center';
  fontPickerOverlay.style.justifyContent = 'center';
  fontPickerOverlay.style.color = '#ffffff';
  fontPickerOverlay.style.fontFamily = 'Arial, sans-serif';
  fontPickerOverlay.style.fontSize = '14px';
  fontPickerOverlay.style.textAlign = 'center';
  fontPickerOverlay.style.userSelect = 'none';
  fontPickerOverlay.textContent = 'Click any visible text element to capture its font. Press Esc to cancel.';
  document.documentElement.appendChild(fontPickerOverlay);
  document.documentElement.style.cursor = 'crosshair';
};

const createFontPickerHighlight = () => {
  if (fontPickerHighlight) return;
  fontPickerHighlight = document.createElement('div');
  fontPickerHighlight.style.position = 'fixed';
  fontPickerHighlight.style.pointerEvents = 'none';
  fontPickerHighlight.style.zIndex = '2147483648';
  fontPickerHighlight.style.border = '2px solid rgba(255, 255, 255, 0.9)';
  fontPickerHighlight.style.borderRadius = '8px';
  fontPickerHighlight.style.boxShadow = '0 0 0 4px rgba(255,255,255,0.12)';
  fontPickerHighlight.style.transition = 'all 0.1s ease';
  fontPickerHighlight.style.opacity = '0';
  fontPickerHighlight.style.pointerEvents = 'none';
  document.documentElement.appendChild(fontPickerHighlight);
};

const updateFontPickerHighlight = (target) => {
  if (!fontPickerHighlight) return;
  if (!target || target === document.documentElement || target === document.body) {
    fontPickerHighlight.style.opacity = '0';
    return;
  }
  const rect = target.getBoundingClientRect();
  fontPickerHighlight.style.width = `${rect.width}px`;
  fontPickerHighlight.style.height = `${rect.height}px`;
  fontPickerHighlight.style.left = `${rect.left}px`;
  fontPickerHighlight.style.top = `${rect.top}px`;
  fontPickerHighlight.style.opacity = '1';
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractColors') {
    const colorMap = new Map();
    const allElements = Array.from(document.querySelectorAll('*'));

    allElements.forEach((element) => {
      if (!isVisibleElement(element)) return;

      const styles = window.getComputedStyle(element);
      const candidateColors = [styles.backgroundColor, styles.color];

      candidateColors.forEach((candidate) => {
        const parsed = parseCssColor(candidate);
        if (!parsed || parsed.a === 0) return;

        const hex = rgbToHex(parsed);
        if (!hex) return;

        if (colorMap.has(hex)) {
          colorMap.get(hex).count += 1;
        } else {
          colorMap.set(hex, {
            rgb: { r: parsed.r, g: parsed.g, b: parsed.b },
            hex,
            count: 1,
            lab: rgbToLab(parsed)
          });
        }
      });
    });

    const palette = buildPalette(Array.from(colorMap.values()), MAX_PALETTE_COLORS);
    sendResponse({ colors: palette });
    return true;
  }

  if (request.action === 'extractFonts') {
    const fontMap = new Map();
    const allTextElements = Array.from(document.querySelectorAll('body *'));

    allTextElements.forEach((element) => {
      if (!isVisibleElement(element)) return;
      const style = window.getComputedStyle(element);
      const text = element.innerText?.trim();
      if (!text) return;

      const fontFamily = style.fontFamily || 'Unknown';
      const fontSize = style.fontSize || 'inherit';
      const fontWeight = style.fontWeight || 'normal';
      const fontStyle = style.fontStyle || 'normal';
      const key = `${fontFamily}||${fontWeight}||${fontStyle}||${fontSize}`;

      if (!fontMap.has(key)) {
        fontMap.set(key, {
          id: Date.now() + fontMap.size,
          fontFamily,
          fontSize,
          fontWeight,
          fontStyle,
          sampleText: text.split('\n').map((line) => line.trim()).filter(Boolean).slice(0, 2).join(' ') || 'Sample text'
        });
      }
    });

    const fonts = Array.from(fontMap.values()).slice(0, 20);
    sendResponse({ fonts });
    return true;
  }

  if (request.action === 'pickFont') {
    if (activeFontPicker) {
      sendResponse({ canceled: true, error: 'Font picker already active' });
      return true;
    }

    const mousemoveHandler = (event) => {
      const candidate = event.target;
      const pickedElement = findClosestTextElement(candidate);
      updateFontPickerHighlight(pickedElement);
    };

    const clickHandler = (event) => {
      event.preventDefault();
      event.stopPropagation();
      cleanupFontPicker();

      const pickedElement = findClosestTextElement(event.target);
      const payload = pickedElement ? {
        fontFamily: window.getComputedStyle(pickedElement).fontFamily,
        fontSize: window.getComputedStyle(pickedElement).fontSize,
        fontWeight: window.getComputedStyle(pickedElement).fontWeight,
        fontStyle: window.getComputedStyle(pickedElement).fontStyle,
        sampleText: pickedElement.innerText.trim() || 'The quick brown fox jumps over the lazy dog'
      } : { canceled: true, error: 'No text element selected' };

      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.set({ latestFontCapture: payload });
      }
    };

    const keydownHandler = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        cleanupFontPicker();
        if (typeof chrome !== 'undefined' && chrome.storage) {
          chrome.storage.local.set({ latestFontCapture: { canceled: true } });
        }
      }
    };

    activeFontPicker = {
      clickHandler,
      mousemoveHandler,
      keydownHandler
    };

    createFontPickerOverlay();
    createFontPickerHighlight();
    document.addEventListener('mousemove', mousemoveHandler, true);
    document.addEventListener('click', clickHandler, true);
    document.addEventListener('keydown', keydownHandler, true);

    sendResponse({ started: true });
    return true;
  }
});
