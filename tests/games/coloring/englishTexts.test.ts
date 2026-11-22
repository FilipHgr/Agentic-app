/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';

import { dictionariesByLanguage, findTextProblems } from '../../shared/textChecks';

/**
 * Testy k #137 AC1 pro Omalovánky: anglický název hry přesně podle tabulky
 * v zadání („Colouring“, britská angličtina) a stejné klíče jako čeština
 * pro každý jazyk se souborem textů Omalovánek.
 *
 * Navržené rozhraní: nový soubor `src/games/coloring/texts/en.ts`, který
 * jako `export default { … } satisfies ColoringTexts` vrací `{ title }`.
 * Do `COLORING_TEXTS` ani do `titles` v `meta.ts` se zatím nepřidává
 * (angličtina není v seznamu jazyků, vědomá odchylka podle zadání).
 */

const COLORING_FILES = dictionariesByLanguage(
  import.meta.glob('../../../src/games/coloring/texts/*.ts', { eager: true }),
);

function checkColoring(language: string, texts: Record<string, unknown>): string[] {
  return findTextProblems({
    language,
    part: 'Omalovánky',
    reference: COLORING_FILES['cs'] ?? {},
    texts,
  });
}

describe('#137 AC1: anglické texty Omalovánek', () => {
  it('Omalovánky mají soubor anglických textů src/games/coloring/texts/en.ts', () => {
    expect(Object.keys(COLORING_FILES)).toContain('en');
  });

  it('hra se anglicky jmenuje „Colouring“ a jiný text nemá', () => {
    expect(COLORING_FILES['en']).toEqual({ title: 'Colouring' });
  });

  it('angličtina má stejné texty jako čeština a žádný není prázdný', () => {
    expect(COLORING_FILES['en'], 'soubor en.ts chybí').toBeDefined();
    expect(checkColoring('en', COLORING_FILES['en'] ?? {})).toEqual([]);
  });

  for (const language of Object.keys(COLORING_FILES)) {
    it(`jazyk ${language}: texty Omalovánek mají stejné klíče jako čeština a žádný není prázdný`, () => {
      expect(checkColoring(language, COLORING_FILES[language] ?? {})).toEqual([]);
    });
  }
});

describe('#137 AC1: kontrola textů Omalovánek opravdu najde chybu (umělý jazyk jen v testu)', () => {
  it('chybějící název hry najde a řekne jazyk, část a klíč', () => {
    const problems = checkColoring('xx', {});
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('xx');
    expect(problems[0]).toContain('Omalovánky');
    expect(problems[0]).toContain('title');
  });

  it('prázdný název hry najde', () => {
    expect(checkColoring('xx', { title: ' ' })).toHaveLength(1);
  });

  it('text navíc najde', () => {
    expect(checkColoring('xx', { title: 'Colouring', subtitle: 'Paint' })).toHaveLength(1);
  });
});
