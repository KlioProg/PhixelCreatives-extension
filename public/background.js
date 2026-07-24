/* global chrome */

chrome.runtime.onInstalled.addListener(() => {
  console.log('Phixel background worker installed');
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'fontPickResult') {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.set({ latestFontCapture: message.payload });
      sendResponse({ stored: true });
    }
  }
});
