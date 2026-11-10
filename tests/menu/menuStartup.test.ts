/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';

import { GAMES } from '../../src/gameList';

/**
 * Testy k #67 AC4: po otevření stránky se stáhne jen menu, hra až po
 * ťuknutí na dlaždici. Do startovního souboru Vite zabalí vše, na co
 * z `src/main.ts` vede řetěz statických importů (bez `import type` a bez
 * dynamického `import()`). Test ten řetěz projde nad zdrojovými texty, bez
 * buildu. Velikosti souborů a samostatný soubor každé hry se kontrolují
 * z výstupu `npm run build` (AC7). Rozpoznávání psaní hlídá
 * `tests/games/counting/startupImports.test.ts`.
 *
 * #122 AC6: řetěz sleduje kromě `.ts` i obrázky `.webp` (obrázek dlaždice
 * hry z jejího `meta.ts`), aby bylo vidět, které obrázky menu stáhne hned.
 */

const SOURCES: Record<string, string> = Object.fromEntries(
  Object.entries(
    import.meta.glob<string>('../../src/**/*.ts', {
      query: '?raw',
      import: 'default',
      eager: true,
    }),
  ).map(([path, text]) => [path.replace('../../', ''), text]),
);

/** Obrázky WebP v `src/` (jen cesty, obsah test nepotřebuje). */
const WEBP_FILES: ReadonlySet<string> = new Set(
  Object.keys(import.meta.glob('../../src/**/*.webp')).map((path) => path.replace('../../', '')),
);

const ENTRY = 'src/main.ts';
const GAME_LIST = 'src/gameList.ts';

function withoutComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

/** Import jen s typy se do buildu nedostane. */
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

/** Relativní cesty ze statických importů a re-exportů. */
function staticImports(text: string): string[] {
  const code = withoutComments(text);
  const found: string[] = [];
  for (const match of code.matchAll(
    /^\s*(?:import|export)\s+([\s\S]*?)\s+from\s+['"]([^'"]+)['"]/gm,
  )) {
    if (!isTypeOnly(match[1] ?? '')) {
      found.push(match[2] ?? '');
    }
  }
  for (const match of code.matchAll(/^\s*import\s+['"]([^'"]+)['"]/gm)) {
    found.push(match[1] ?? '');
  }
  return found.filter((specifier) => specifier.startsWith('.'));
}

/** Relativní cesty z dynamických `import()`. */
function dynamicImports(text: string): string[] {
  const code = withoutComments(text);
  return [...code.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g)].map(
    (match) => match[1] ?? '',
  );
}

function resolve(fromFile: string, specifier: string): string | null {
  const parts = fromFile.split('/').slice(0, -1);
  for (const part of specifier.split('/')) {
    if (part === '..') {
      parts.pop();
    } else if (part !== '.' && part !== '') {
      parts.push(part);
    }
  }
  const base = parts.join('/');
  if (WEBP_FILES.has(base)) {
    return base;
  }
  for (const candidate of [base, `${base}.ts`, `${base}/index.ts`]) {
    if (SOURCES[candidate] !== undefined) {
      return candidate;
    }
  }
  return null;
}

/** Všechny soubory ve startovním souboru stránky. */
function startupFiles(): Set<string> {
  const reached = new Set<string>();
  const queue = [ENTRY];
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

/** Vstupy her, které jde ze startovních souborů stáhnout dynamickým `import()`. */
function lazyGameEntries(): Set<string> {
  const entries = new Set<string>();
  for (const file of startupFiles()) {
    for (const specifier of dynamicImports(SOURCES[file] ?? '')) {
      const target = resolve(file, specifier);
      if (target !== null) {
        entries.add(target);
      }
    }
  }
  return entries;
}

describe('#67 AC4: po otevření stránky se stáhne jen menu', () => {
  it('startovní soubor obsahuje menu, seznam her a sdílenou část', () => {
    const files = [...startupFiles()];
    expect(files).toContain(ENTRY);
    expect(files).toContain(GAME_LIST);
    expect(files).toContain('src/shared/logic/gameRegistry.ts');
    expect(files.some((file) => file.startsWith('src/menu/'))).toBe(true);
  });

  // Rozhodnutí o meta.ts (#67): menu potřebuje název, kategorii a symbol hry
  // dřív, než se hra stáhne, proto je z hry ve startovním souboru jen její
  // meta.ts a texty jazyků, ze kterých se bere název. #122 AC6: a obrázek
  // dlaždice tile.webp.
  it('ve startovním souboru není z žádné hry nic kromě meta.ts, textů s názvem a obrázku dlaždice', () => {
    const gameFiles = [...startupFiles()].filter((file) => file.startsWith('src/games/'));
    const allowed =
      /^src\/games\/[^/]+\/(?:meta\.ts|tile\.webp|texts\/[a-z]{2,3}(?:-[A-Z]{2})?\.ts)$/;
    expect(gameFiles.filter((file) => !allowed.test(file))).toEqual([]);
    for (const game of GAMES) {
      expect(gameFiles, game.id).toContain(`src/games/${game.id}/meta.ts`);
    }
  });

  it('#122 AC6: menu zná obrázek dlaždice každé hry hned po otevření stránky, bez stažení hry', () => {
    const files = [...startupFiles()];
    for (const game of GAMES) {
      expect(files, game.id).toContain(`src/games/${game.id}/tile.webp`);
    }
  });

  it('#122 AC6: z obrázků ve startovním souboru jsou jen obrázky dlaždic her', () => {
    const images = [...startupFiles()].filter((file) => file.endsWith('.webp'));
    expect(images.filter((file) => !/^src\/games\/[^/]+\/tile\.webp$/.test(file))).toEqual([]);
  });

  it('každá hra ze seznamu se dá stáhnout až později přes vstup své složky', () => {
    const lazy = lazyGameEntries();
    for (const game of GAMES) {
      expect(lazy, game.id).toContain(`src/games/${game.id}/index.ts`);
    }
  });

  it('dynamicky se stahují jen vstupy her, ne jejich vnitřní soubory', () => {
    for (const entry of lazyGameEntries()) {
      if (entry.startsWith('src/games/')) {
        expect(entry).toMatch(/^src\/games\/[^/]+\/index\.ts$/);
      }
    }
  });
});
