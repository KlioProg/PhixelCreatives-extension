export async function copyText(value, clipboard = globalThis.navigator?.clipboard) {
  if (!clipboard?.writeText) throw new Error('Clipboard is unavailable.');
  await clipboard.writeText(value);
}
