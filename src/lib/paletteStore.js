import { MAX_PALETTE_COLORS } from './constants.js';
import { convertToHex } from './colorMath.js';

function normalizePalettes(value) {
  if (!Array.isArray(value)) throw new Error('Saved palettes have an unsupported format.');
  return value.map(palette => {
    if (!palette || !['string', 'number'].includes(typeof palette.id) || !Array.isArray(palette.colors)) {
      throw new Error('A saved palette has an unsupported format.');
    }
    const colors = palette.colors.map(convertToHex);
    if (colors.some(c => !c)) throw new Error('A saved palette contains an unsupported color.');
    return { ...palette, colors: colors.slice(0, MAX_PALETTE_COLORS) };
  });
}

// A single queue keeps rapid actions from racing and overwriting one another.
// No write happens until loading succeeds; failed writes never advance the deck.
export function createPaletteStore(storage) {
  let deck = [];
  let loading;
  let queue = Promise.resolve();
  const load = () => {
    loading ??= Promise.resolve().then(async () => {
      if (!storage) throw new Error('Palette storage is unavailable.');
      const result = await storage.get(['savedPalettes']);
      deck = normalizePalettes(result.savedPalettes ?? []);
      return structuredClone(deck);
    });
    return loading;
  };
  return {
    load,
    update(transform) {
      const operation = queue.then(async () => {
        await load();
        const next = normalizePalettes(transform(structuredClone(deck)));
        await storage.set({ savedPalettes: next });
        deck = next;
        return structuredClone(deck);
      });
      queue = operation.catch(() => {});
      return operation;
    },
  };
}
