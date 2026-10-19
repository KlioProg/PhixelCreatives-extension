// Optional integration check: start `npm run dev` and install Playwright locally.
// Chrome APIs are doubled here; pixels, Canvas, React and content.js run in Chrome.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

const browser = await chromium.launch({ channel: 'chrome' });
const context = await browser.newContext({ viewport: { width: 480, height: 600 } });
try {
  const fixture = await context.newPage();
  await fixture.setContent('<body style="margin:0;background:rgb(37,99,235)"><img id="art" width="240" height="600"><div style="position:absolute;top:600px;background:red;width:480px;height:600px">Offscreen</div></body>');
  await fixture.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 240; canvas.height = 600;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#14AA50'; ctx.fillRect(0, 0, 240, 600);
    document.querySelector('img').src = canvas.toDataURL();
  });
  await fixture.locator('img').evaluate(img => img.decode());
  // Screenshot remains in memory; only the popup's review artifacts are written.
  const screenshot = 'data:image/png;base64,' + (await fixture.screenshot()).toString('base64');
  const popup = await context.newPage();
  const errors = [];
  popup.on('pageerror', error => errors.push(error.message));
  await popup.addInitScript(({ screenshot }) => {
    window.failWrite = false;
    window.captureCalls = 0;
    window.chrome = {
      tabs: {
        async query() { return [{ id: 5, windowId: 1, url: 'https://example.com', title: 'Visual Fixture' }]; },
        async captureVisibleTab() { window.captureCalls++; return screenshot; },
        sendMessage(id, message, cb) { cb({ fonts: [{ id: 1, fontFamily: 'Arial', fontSize: '16px', fontWeight: '400', fontStyle: 'normal', sampleText: 'Example' }] }); },
      },
      storage: {
        local: {
          get(keys, cb) {
            const result = { savedPalettes: JSON.parse(localStorage.getItem('savedPalettes') || '[{"id":1,"title":"Legacy","colors":["rgb(255, 0, 0)","#abc"]},{"id":2,"title":"Empty","colors":[]}]') };
            if (cb) cb(result);
            return Promise.resolve(result);
          },
          async set(value) {
            if (window.failWrite) throw new Error('Quota exceeded');
            localStorage.setItem('savedPalettes', JSON.stringify(value.savedPalettes));
          },
          async remove() {},
        },
        onChanged: { addListener() {}, removeListener() {} },
      },
      runtime: {},
    };
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
      async writeText(value) {
        if (window.failCopy) throw new Error('Clipboard denied');
        window.copied = value;
      },
    } });
    // Prevent an OS picker from blocking an automated edit; input events still run.
    const click = HTMLInputElement.prototype.click;
    HTMLInputElement.prototype.click = function () { if (this.type !== 'color') click.call(this); };
  }, { screenshot });
  await popup.goto('http://127.0.0.1:5173');
  const card = title => popup.locator('.palette-card').filter({ has: popup.locator('.meta-site-name', { hasText: new RegExp(`^${title}$`) }) });
  const menu = async (title, item) => {
    await card(title).locator('.options-btn').click();
    await card(title).locator('.dropdown-item').filter({ hasText: new RegExp(`^${item}$`) }).click();
  };
  await card('Empty').locator('[title="View Detail"]').click();
  await popup.getByText('This palette has no colors.').waitFor();
  await popup.locator('.eye-close-btn').click();
  await popup.getByRole('button', { name: 'GET COLORS!' }).click();
  await card('Visual Fixture').waitFor();
  assert.deepEqual(await card('Visual Fixture').locator('.slice-hex-label').allTextContents(), ['#14AA50', '#2563EB']);
  assert.equal(await popup.evaluate(() => window.captureCalls), 1);
  await mkdir('.verification', { recursive: true });
  await popup.screenshot({ path: '.verification/popup.png' });
  // Static snapshots contain the actual rendered UI and CSS, for the kit gates.
  const snapshot = await popup.evaluate(() => {
    const styles = [...document.styleSheets].flatMap(s => {
      try { return [...s.cssRules].map(r => r.cssText); }
      catch { return []; } // Cross-origin font CSS cannot be read through CSSOM.
    }).join('\n');
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Phixel popup</title><style>${styles}</style></head><body>${document.querySelector('#root').outerHTML}</body></html>`;
  });
  await writeFile('.verification/popup.html', snapshot);
  await menu('Visual Fixture', 'Rename');
  await popup.locator('.rename-input').fill('Renamed');
  await popup.locator('.rename-card .confirm-btn').last().click();
  await card('Renamed').waitFor();
  await menu('Renamed', 'Duplicate');
  await card('Renamed \\(Copy\\)').waitFor();
  await menu('Renamed', 'Edit Palette');
  await popup.locator('input[type="color"]').first().fill('#123456');
  await popup.locator('.add-color-wrapper').click();
  assert.equal(await popup.locator('input[type="color"]').count(), 3);
  await popup.locator('.remove-color-btn').last().click();
  await popup.getByRole('button', { name: 'Save Changes' }).click();
  await popup.getByText('Palette updated', { exact: true }).waitFor();
  assert.equal(await card('Renamed').locator('.slice-hex-label').first().textContent(), '#123456');
  await menu('Renamed', 'Copy All Hex');
  await popup.getByText('Copied all HEX values', { exact: true }).waitFor();
  assert.match(await popup.evaluate(() => window.copied), /#123456/);
  await popup.evaluate(() => { window.failCopy = true; });
  await card('Renamed').locator('.color-bar-slice').first().click();
  await popup.getByText('Could not copy: Clipboard denied', { exact: true }).waitFor();
  await popup.evaluate(() => { window.failWrite = true; });
  await menu('Renamed', 'Duplicate');
  await popup.getByText('Could not save palettes: Quota exceeded', { exact: true }).waitFor();
  assert.equal(await popup.locator('.palette-card').count(), 4);
  await popup.evaluate(() => { window.failWrite = false; });
  await popup.reload();
  await card('Renamed').waitFor();
  await card('Renamed').locator('[title="View Detail"]').click();
  assert.equal(await popup.locator('.data-row').first().locator('.data-value').textContent(), '#123456');
  await popup.screenshot({ path: '.verification/detail.png' });
  await popup.locator('.eye-close-btn').click();
  await menu('Renamed', 'Delete');
  await popup.locator('.confirm-card .confirm-btn.delete').click();
  await popup.getByText('Palette deleted', { exact: true }).waitFor();
  assert.equal(await card('Renamed').count(), 0);
  await popup.getByRole('button', { name: 'Fonts', exact: true }).click();
  await popup.getByRole('button', { name: 'GET FONT!' }).click();
  await popup.locator('.font-card-name').filter({ hasText: 'Arial' }).waitFor();
  assert.deepEqual(errors, []);

  // Exercise unchanged content-script font extraction and picker messages too.
  await fixture.evaluate(() => {
    window.chrome = { runtime: { onMessage: { addListener(fn) { window.messageHandler = fn; } } }, storage: { local: { set(value) { window.fontCapture = value; } } } };
    const text = document.createElement('p');
    text.textContent = 'Font fixture'; text.style.cssText = 'position:absolute;top:20px;left:20px;font-family:Arial';
    document.body.append(text);
  });
  await fixture.addScriptTag({ path: 'public/content.js' });
  const fonts = await fixture.evaluate(() => new Promise(resolve => window.messageHandler({ action: 'extractFonts' }, {}, resolve)));
  assert.ok(fonts.fonts.some(f => f.fontFamily.includes('Arial')));
  await fixture.evaluate(() => window.messageHandler({ action: 'pickFont' }, {}, () => {}));
  await fixture.getByText('Font fixture', { exact: true }).click();
  assert.match(await fixture.evaluate(() => window.fontCapture.latestFontCapture.fontFamily), /Arial/);
  console.log('Browser integration passed: real PNG/Canvas extraction, viewport exclusion, legacy load, rename, duplicate, edit/add/remove, copy/failure, storage failure/reload, delete, detail and Font Scanner.');
} finally {
  await browser.close();
}
