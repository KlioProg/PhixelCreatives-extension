# Phase 1: visible color extraction

GET COLORS now captures the active tab's visible viewport with
`chrome.tabs.captureVisibleTab(windowId, { format: 'png' })`. The popup decodes
the PNG locally in an sRGB Canvas, samples a bounded image and extracts a palette.
There are no new permissions, runtime dependencies, network services, screenshot
uploads, or screenshot storage. `public/manifest.json` remains unchanged.

The pixel engine uses a five-bit RGB histogram, deterministic weighted OKLab
clustering, perceptual merging and screen-area ranking. Dominant neutrals are
retained. Similar colors are merged; the engine returns fewer colors when
appropriate. `src/lib/constants.js` supplies the common palette-size limit to
extraction, storage and editing. OKLab calculations now linearize sRGB before
applying the conversion matrices.

Palettes retain the `savedPalettes` storage key and existing record shape:
`{ id, title, colors }`. Numeric legacy IDs, RGB/RGBA strings, short HEX colors,
alpha and extra record metadata remain supported. Loading does not rewrite data.
Malformed records block saving and report an error instead of overwriting data.
Queued mutations update React only after storage confirms success. A failed read
requires reopening the popup to retry. Failed writes can be retried directly.
Empty legacy palettes can be viewed; editing requires a color before saving.
Clipboard controls report errors instead of premature success.

## Files

- `src/App.jsx`: capture integration, shared utilities, safe palette mutations,
  copy feedback and empty-palette handling.
- `public/content.js`: remove obsolete CSS color extraction; retain font scanning
  and the font picker.
- `src/lib/{capturePalette,visualColors,colorMath,paletteStore,clipboard,constants}.js`:
  modular capture, quantization, conversion, persistence and clipboard logic.
- `tests/*.test.js`, `tests/fixtures/images.js`: focused Node tests and deterministic
  raster fixtures, including a textured landscape.
- `tests/browser-check.mjs`: optional browser integration check.
- `package.json`: dependency-free `npm test` command.
- `.gitignore`: ignore local verification artifacts.

## Automated verification

Run `npm ci`, `npm test`, `npm run lint` and `npm run build`.
The Node tests cover solid colors, area ranking, nine regions, gradients, light
and dark interfaces, similar shades, textured imagery, conversion references,
capture restrictions, errors, clipboard failures and legacy palette persistence.

For the optional browser check, make Playwright available locally without adding
it to the product dependencies, start `npm run dev`, then run
`node tests/browser-check.mjs`. It uses installed Chrome through Playwright.
Chrome API doubles supply a real in-memory PNG screenshot to the popup; Canvas,
React, palette controls and the content-script font scanner execute in Chrome.
The offscreen region is checked for exclusion. The script also verifies rename,
duplicate, color edits, add/remove, copying, failure feedback, reload persistence,
delete and detail values. It writes only popup review artifacts to `.verification/`.
It does not establish installed-extension permission behavior.

Verification on this checkout:

- `npm test`: 21 passed, 0 failed.
- `npm run build`: passed.
- `npm run lint`: no errors; an existing unused-disable warning remains in the
  user-provided `scripts/axe_audit.mjs`.
- Optional Chrome integration: passed. Popup and detail screenshots inspected.
- Design-kit gates on the rendered popup snapshot with `DS_REQUIRE_BROWSER=1`:
  state contrast failed with 5 findings (Clear and GET COLORS); responsive failed
  at 280/320/414 with enlarged text; mobile-first failed because the existing
  popup is fixed at 480 CSS pixels. Keyboard, target size and strict slop-tells
  gates printed OK. Intent printed OK but measured no intent-bearing controls.
  These snapshot checks do not establish every interactive state or accessibility.
- Axe printed SKIPPED because axe-core could not load. This is not a pass.
- Python token, contrast, hardcode and emoji gates could not start because the
  installed Windows Python launcher was unavailable. The supplied token JSON
  files are not connected to the existing popup CSS, so token checks would not
  establish popup contrast in any event. No design-kit self-test score is claimed.

The popup's existing CSS was preserved as requested; the design-gate findings
need a separately scoped UI/accessibility fix.

## Installed-extension manual checks still required

1. Load `dist/` unpacked in `chrome://extensions`. Invoke Phixel from the toolbar
   on an HTTP(S) page, click GET COLORS and compare the palette to the viewport.
2. Use image-heavy and gradient pages. Scroll to a different section and capture
   again; verify only the new viewport is represented. Check zoom and high-DPI
   displays, embedded frames, video, animated content and browser color profiles.
3. Reopen the popup after saving, renaming, editing, adding/removing colors,
   duplicating and deleting. Confirm saved data and copied values match swatches.
4. Check a profile containing old saved palettes. Test restricted browser and
   local-file pages; errors must leave existing palettes intact. Try fast repeated
   captures and disabled capture policies; loading must clear after failures.
5. Check Font Scanner extraction and page-text picking, Escape cancellation,
   font details and copying CSS in the installed extension.

## Limits and follow-ups

Extraction approximates visual prominence, not semantic importance. Bounded
sampling can miss tiny accents or thin text; close shades may intentionally
collapse. Screenshot conversion targets sRGB rather than retaining HDR or
wide-gamut source values. Browser policies, protected video and activeTab grants
can prevent capture; failures are reported. Capture is viewport-only and occurs
once per click, without stitching or screenshot persistence.

Useful follow-ups are real installed-extension automation, broader photographic
fixtures, cross-device timing checks, and the existing popup accessibility
findings. Multi-popup concurrent writes remain last-writer-wins; the mutation
queue protects operations within one popup.
