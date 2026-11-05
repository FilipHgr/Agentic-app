/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';

import { LANGUAGES, currentLanguage } from '../../src/shared/texts/languages';
import { sharedTexts } from '../../src/shared/texts/sharedTexts';
import indexHtml from '../../index.html?raw';
import { stringsInSource } from './sourceStrings';
import { languageOfFile } from './textChecks';

/**
 * Testy k #65 AC1: texty jsou jen v souborech jazyků, ve sdílené části
 * (`src/shared/texts/<jazyk>.ts`) a u každé hry (`src/games/<hra>/texts/<jazyk>.ts`).
 * Test projde řetězce v kódu `src/` (v uvozovkách i v šablonách, bez
 * komentářů) a selže, když se některý celý řetězec přesně shoduje s textem
 * ze souborů jazyků. Soubory ve složkách `texts/` se nekontrolují.
 *
 * Texty ze souborů jazyků se tu čtou jako zdroják (ne importem), aby sdílený
 * test nemusel importovat kód her.
 */

/** Zdrojové texty všech `.ts` souborů v `src/` podle cesty od kořene repa. */
const SOURCES: Record<string, string> = Object.fromEntries(
  Object.entries(
    import.meta.glob<string>('../../src/**/*.ts', {
      query: '?raw',
      import: 'default',
      eager: true,
    }),
  ).map(([path, text]) => [path.replace('../../', ''), text]),
);

/** Soubory ve složce textů: sdílené texty a texty her se nekontrolují. */
function isInTextsFolder(path: string): boolean {
  return /^src\/shared\/texts\//.test(path) || /^src\/games\/[^/]+\/texts\//.test(path);
}

/** Soubor jazyka ve sdílené části nebo u hry (`…/texts/cs.ts`). */
function isLanguageFile(path: string): boolean {
  return isInTextsFolder(path) && languageOfFile(path) !== null;
}

/** Všechny texty ze souborů jazyků (řetězce v nich mimo cesty importů). */
function languageTexts(sources: Record<string, string>): Set<string> {
  const texts = new Set<string>();
  for (const [path, code] of Object.entries(sources)) {
    if (isLanguageFile(path)) {
      for (const found of stringsInSource(code)) {
        texts.add(found.value);
      }
    }
  }
  return texts;
}

/** Řetězce v kódu mimo složky textů, které jsou přesně textem jazyka. */
function hardcodedTexts(sources: Record<string, string>): string[] {
  const texts = languageTexts(sources);
  const found: string[] = [];
  for (const [path, code] of Object.entries(sources)) {
    if (isInTextsFolder(path)) {
      continue;
    }
    for (const literal of stringsInSource(code)) {
      if (texts.has(literal.value)) {
        found.push(`${path}:${literal.line} „${literal.value}“`);
      }
    }
  }
  return found;
}

describe('#65 AC1: texty jsou na jednom místě, po jazycích', () => {
  it('v kódu src/ není natvrdo žádný text ze souborů jazyků', () => {
    expect(hardcodedTexts(SOURCES)).toEqual([]);
  });

  it('kontrola opravdu vidí texty ze souborů jazyků (sdílené i Počítání)', () => {
    const texts = languageTexts(SOURCES);
    for (const text of ['Počítání do 10', 'Nastavení pro rodiče', 'Počítání', 'Do kolika']) {
      expect(texts.has(text), text).toBe(true);
    }
  });

  it('ve sdílené části je seznam jazyků, zatím jen čeština', () => {
    expect(LANGUAGES).toEqual(['cs']);
  });

  it('sdílená část má soubor českých textů src/shared/texts/cs.ts', () => {
    expect(SOURCES['src/shared/texts/cs.ts']).toBeDefined();
  });

  it('Počítání má texty ve vlastní složce, jeden soubor na jazyk', () => {
    for (const language of LANGUAGES) {
      expect(SOURCES[`src/games/counting/texts/${language}.ts`], language).toBeDefined();
    }
  });

  it('každá hra má soubor textů pro každý jazyk ze seznamu', () => {
    const games = new Set(
      Object.keys(SOURCES)
        .map((path) => /^src\/games\/([^/]+)\//.exec(path)?.[1])
        .filter((game): game is string => game !== undefined),
    );
    expect(games.size).toBeGreaterThan(0);
    for (const game of games) {
      for (const language of LANGUAGES) {
        expect(
          SOURCES[`src/games/${game}/texts/${language}.ts`],
          `${game}/${language}`,
        ).toBeDefined();
      }
    }
  });
});

describe('#65 AC1: jak kontrola „žádný text natvrdo“ funguje', () => {
  const texts = "export default { label: 'Do kolika', title: `Počítání` };";

  function check(code: string): string[] {
    return hardcodedTexts({
      'src/games/counting/texts/cs.ts': texts,
      'src/games/counting/logic/example.ts': code,
    });
  }

  it('text v jednoduchých uvozovkách najde', () => {
    expect(check("const a = 'Do kolika';")).toHaveLength(1);
  });

  it('text ve dvojitých uvozovkách najde', () => {
    expect(check('const a = "Do kolika";')).toHaveLength(1);
  });

  it('text v šabloně najde, i jako pevný kus šablony s výrazem', () => {
    expect(check('const a = `Do kolika`;')).toHaveLength(1);
    expect(check('const a = `${x}Počítání${y}`;')).toHaveLength(1);
  });

  it('zpráva ukáže soubor, řádek a text', () => {
    expect(check("\n\nconst a = 'Počítání';")).toEqual([
      'src/games/counting/logic/example.ts:3 „Počítání“',
    ]);
  });

  it('řetězec, který text jen obsahuje, ale není s ním shodný, nevadí', () => {
    expect(check("const a = 'Počítání do 10 a dál'; const b = 'do kolika';")).toEqual([]);
  });

  it('text v komentáři se nekontroluje', () => {
    expect(check('// \'Do kolika\'\n/* "Počítání" */\nconst a = 1;')).toEqual([]);
  });

  it('cesta v importu se nepočítá jako text', () => {
    const withImport = "export default { label: 'Do kolika' };\nimport x from './shared';";
    expect(
      hardcodedTexts({
        'src/shared/texts/cs.ts': withImport,
        'src/games/counting/logic/example.ts': "import y from './shared';",
      }),
    ).toEqual([]);
  });

  it('uvozovka v regulárním výrazu kontrolu nezmate', () => {
    expect(check("const r = /'/g; const a = 'Do kolika';")).toHaveLength(1);
  });

  it('soubory ve složkách texts/ ve sdílené části i u her se nekontrolují', () => {
    expect(
      hardcodedTexts({
        'src/games/counting/texts/cs.ts': texts,
        'src/games/counting/texts/countingTexts.ts': "const a = 'Do kolika';",
        'src/shared/texts/sharedTexts.ts': "const b = 'Počítání';",
      }),
    ).toEqual([]);
  });
});

describe('#65 AC1 a AC3: stránka index.html odpovídá českým textům', () => {
  const texts = sharedTexts('cs');

  it('stránka má výchozí jazyk lang="cs"', () => {
    expect(/<html[^>]*\slang="([^"]*)"/.exec(indexHtml)?.[1]).toBe('cs');
  });

  it('jazyk stránky odpovídá aktuálnímu jazyku hry', () => {
    expect(/<html[^>]*\slang="([^"]*)"/.exec(indexHtml)?.[1]).toBe(currentLanguage());
  });

  it('název stránky je přesně „Počítání do 10“ ze sdílených textů', () => {
    expect(texts.pageTitle).toBe('Počítání do 10');
    expect(/<title>([^<]*)<\/title>/.exec(indexHtml)?.[1]).toBe(texts.pageTitle);
  });

  it('čtečka obrazovky přečte u kolečka „Nastavení pro rodiče“ ze sdílených textů', () => {
    expect(texts.settingsButtonLabel).toBe('Nastavení pro rodiče');
    expect(/id="settings-button"[^>]*aria-label="([^"]*)"/.exec(indexHtml)?.[1]).toBe(
      texts.settingsButtonLabel,
    );
  });

  it('české pravidlo předložek je ve sdílených textech: k, s, v, z, o, u', () => {
    expect([...texts.oneLetterPrepositions].sort()).toEqual(['k', 'o', 's', 'u', 'v', 'z']);
  });
});
