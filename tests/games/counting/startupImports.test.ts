/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';

import { recognizeDigit } from '../../../src/games/counting/logic/digitRecognition';
import { loadDigitRecognizer } from '../../../src/games/counting/logic/recognizerLoading';

/**
 * Testy k #58 (AC2): vzory číslic nejsou v souborech při startu. Do startovních
 * souborů Vite zabalí vše, na co z `src/main.ts` vede řetěz statických importů
 * (bez `import type` a bez dynamického `import()`). Test ten řetěz projde nad
 * zdrojovými texty, bez buildu, aby `npm test` zůstal rychlý. Skutečné
 * velikosti a obsah `dist/` se kontrolují z výstupu `npm run build`.
 *
 * #67 AC4: řetěz se prochází ze startu stránky i ze vstupu každé hry,
 * protože hra se od #67 stahuje zvlášť až po ťuknutí v menu.
 */

const SOURCES: Record<string, string> = Object.fromEntries(
  Object.entries(
    import.meta.glob<string>('../../../src/**/*.ts', {
      query: '?raw',
      import: 'default',
      eager: true,
    }),
  ).map(([path, text]) => [path.replace('../../../', ''), text]),
);

const ENTRY = 'src/main.ts';
/**
 * Vstupy her (#67 AC4): hra se stahuje až z menu, ale ani při jejím
 * spuštění se rozpoznávání nesmí stáhnout. Proto se řetěz prochází ze
 * startu stránky i ze vstupu každé hry.
 */
const GAME_ENTRIES = Object.keys(SOURCES).filter((path) =>
  /^src\/games\/[^/]+\/index\.ts$/.test(path),
);
const TEMPLATES = 'src/games/counting/logic/digitTemplates.ts';
const RECOGNITION = 'src/games/counting/logic/digitRecognition.ts';

/** Zdroják bez komentářů, aby se nepočítaly importy zmíněné v dokumentaci. */
function withoutComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

/** Import jen s typy (`import type`, nebo všechny jména s `type`) se do buildu nedostane. */
function isTypeOnly(clause: string): boolean {
  const trimmed = clause.trim();
  if (trimmed.startsWith('type ')) {
    return true;
  }
  const named = /^\{([\s\S]*)\}$/.exec(trimmed);
  if (named === null || named[1] === undefined) {
    return false;
  }
  const names = named[1]
    .split(',')
    .map((name) => name.trim())
    .filter((name) => name.length > 0);
  return names.length > 0 && names.every((name) => name.startsWith('type '));
}

/** Relativní cesty ze statických importů a re-exportů, které se dostanou do buildu. */
function staticImports(text: string): string[] {
  const code = withoutComments(text);
  const found: string[] = [];
  const fromPattern = /^\s*(?:import|export)\s+([\s\S]*?)\s+from\s+['"]([^'"]+)['"]/gm;
  for (const match of code.matchAll(fromPattern)) {
    const clause = match[1] ?? '';
    const specifier = match[2] ?? '';
    if (!isTypeOnly(clause)) {
      found.push(specifier);
    }
  }
  const sideEffectPattern = /^\s*import\s+['"]([^'"]+)['"]/gm;
  for (const match of code.matchAll(sideEffectPattern)) {
    found.push(match[1] ?? '');
  }
  return found.filter((specifier) => specifier.startsWith('.'));
}

function resolve(fromFile: string, specifier: string): string | null {
  const parts = fromFile.split('/').slice(0, -1);
  for (const part of specifier.split('/')) {
    if (part === '..') {
      parts.pop();
    } else if (part !== '.') {
      parts.push(part);
    }
  }
  const base = parts.join('/');
  for (const candidate of [base, `${base}.ts`, `${base}/index.ts`]) {
    if (SOURCES[candidate] !== undefined) {
      return candidate;
    }
  }
  return null;
}

/** Všechny soubory, které Vite zabalí do startovních souborů stránky a her. */
function startupFiles(): Set<string> {
  const reached = new Set<string>();
  const queue = [ENTRY, ...GAME_ENTRIES];
  while (queue.length > 0) {
    const file = queue.pop();
    if (file === undefined || reached.has(file)) {
      continue;
    }
    reached.add(file);
    for (const specifier of staticImports(SOURCES[file] ?? '')) {
      const target = resolve(file, specifier);
      if (target !== null) {
        queue.push(target);
      }
    }
  }
  return reached;
}

describe('hra s číselníkem se spustí bez vzorů číslic (AC2)', () => {
  it('kontrola importů najde hru i scénu, tedy opravdu prochází startovní soubory', () => {
    const files = startupFiles();

    expect(GAME_ENTRIES).toContain('src/games/counting/index.ts');
    expect(files.has(ENTRY)).toBe(true);
    expect(files.has('src/games/counting/scenes/GameScene.ts')).toBe(true);
    expect(files.has('src/games/counting/logic/answerRound.ts')).toBe(true);
  });

  it('vzory číslic se při startu nestahují', () => {
    expect(SOURCES[TEMPLATES]).toContain('0027023e0b053f00642b596324640039');
    expect(startupFiles().has(TEMPLATES)).toBe(false);
  });

  it('rozpoznávání psaní se při startu nestahuje', () => {
    expect(startupFiles().has(RECOGNITION)).toBe(false);
  });

  it('rozpoznávání se dá stáhnout dodatečně a je to totéž rozpoznávání jako dnes', async () => {
    await expect(loadDigitRecognizer()).resolves.toBe(recognizeDigit);
  });
});
