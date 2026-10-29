/**
 * Builds the web icon font: Material Symbols cut down to the icons the app uses.
 * The full font is ~1 MB and loads on every web visit; the subset is a few KB.
 *
 * Every string literal in src/ that names a Material Symbol is kept, so icons chosen by a
 * ternary or stored in a list are included too. Run `npm run icons` after adding icons;
 * until then, `icon.web.tsx` falls back to the full font for any icon missing here.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import subsetFont from 'subset-font';

const root = new URL('..', import.meta.url).pathname;
const symbols = JSON.parse(readFileSync(join(root, 'node_modules/expo-symbols/build/android/symbols.json'), 'utf8'));
const font = readFileSync(
  join(root, 'node_modules/@expo-google-fonts/material-symbols/400Regular/MaterialSymbols_400Regular.ttf')
);

function sources(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

const names = new Set();
for (const file of sources(join(root, 'src'))) {
  for (const [, name] of readFileSync(file, 'utf8').matchAll(/['"]([a-z0-9_]+)['"]/g)) {
    if (name in symbols) names.add(name);
  }
}

const sorted = [...names].sort();
const text = sorted.map((name) => String.fromCharCode(symbols[name])).join('');
const subset = await subsetFont(font, text, { targetFormat: 'woff2' });

writeFileSync(join(root, 'assets/fonts/material-symbols.woff2'), subset);
// Name → codepoint, for the icons the subset contains.
const map = Object.fromEntries(sorted.map((name) => [name, symbols[name]]));
writeFileSync(join(root, 'src/constants/web-icons.json'), `${JSON.stringify(map, null, 2)}\n`);
console.log(`${sorted.length} icons, ${(subset.length / 1024).toFixed(1)} KB (full font ${(font.length / 1024).toFixed(0)} KB)`);
