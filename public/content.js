/* global chrome */

const isVisibleElement = (element) => {
  const style = window.getComputedStyle(element);
  if (!style || style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) === 0) {
    return false;
  }

  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
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
