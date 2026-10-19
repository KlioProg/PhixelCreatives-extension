import { extractPalette } from './visualColors.js';

// Keep the previous restriction on local files and browser-owned pages. Capturing
// them can be technically possible with activeTab, but is outside this tool's scope.
export function isRestrictedUrl(url) {
  return typeof url !== 'string' || !/^https?:\/\//i.test(url);
}

export async function screenshotPixels(dataUrl) {
  const image = new Image();
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = () => reject(new Error('Could not decode the screenshot.'));
    image.src = dataUrl;
  });
  const canvas = document.createElement('canvas');
  // Limit Canvas readback and clustering work regardless of device pixel ratio.
  const scale = Math.min(1, 256 / Math.max(image.naturalWidth, image.naturalHeight));
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  try {
    const context = canvas.getContext('2d', { willReadFrequently: true, colorSpace: 'srgb' });
    if (!context) throw new Error('Canvas is unavailable.');
    // Nearest-neighbor sampling avoids introducing blended colors along sharp edges.
    context.imageSmoothingEnabled = false;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return context.getImageData(0, 0, canvas.width, canvas.height);
  } finally {
    canvas.width = 0;
    canvas.height = 0;
    image.src = '';
  }
}

export async function capturePalette(tabs, decode = screenshotPixels) {
  const [tab] = await tabs.query({ active: true, currentWindow: true });
  if (!tab || typeof tab.id !== 'number') throw new Error('No active tab found.');
  if (isRestrictedUrl(tab.url)) throw new Error('Please open a supported webpage to capture colors.');
  const screenshot = await tabs.captureVisibleTab(tab.windowId, { format: 'png' });
  // captureVisibleTab targets a window, not a tab ID. Reject a changed tab rather
  // than silently attaching a palette to the wrong site.
  const [current] = await tabs.query({ active: true, windowId: tab.windowId });
  if (current?.id !== tab.id || current.url !== tab.url) throw new Error('The active page changed. Please try again.');
  const colors = extractPalette(await decode(screenshot));
  return { title: tab.title || 'Untitled', colors };
}
