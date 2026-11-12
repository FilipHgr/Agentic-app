/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';

import { LANGUAGES } from '../../../src/shared/texts/languages';
import { dictionariesByLanguage, findTextProblems } from '../../shared/textChecks';

/**
 * Testy k #137 AC1 pro Počítání: anglické texty přesně podle tabulky
 * v zadání (britská angličtina, „Sums“, „Let's play“ podle doporučení).
 *
 * Navržené rozhraní: nový soubor `src/games/counting/texts/en.ts`, který
 * jako `export default { … } satisfies CountingTexts` vrací anglické texty
 * Počítání. Do `COUNTING_TEXTS` v `countingTexts.ts` se zatím nepřidává
 * (angličtina není v `LANGUAGES`), proto se tu čte jen ze souboru.
 * Vejití do rozložení hlídá `textsFit.test.ts` pro každý jazyk se
 * souborem (AC2), písmena vět průvodce `guideLineLetters.test.ts` (AC3).
 */

const COUNTING_FILES = dictionariesByLanguage(
  import.meta.glob('../../../src/games/counting/texts/*.ts', { eager: true }),
);

/** Řádek věty průvodce se na iPadu vejde při 58 znacích, zadání chce nejvýš 56. */
const MAX_LINE_CHARACTERS = 56;

/** Tabulka z #137: hry, řady, průvodce a věty 1–4 (věta 1 = „Do kolika“ … věta 4 = shrnutí). */
const ENGLISH_COUNTING = {
  title: 'Counting',
  rowLabels: {
    maxNumber: 'Up to',
    operations: 'Sums',
    answerInput: 'Answer',
  },
  guideButtons: {
    back: 'Back',
    next: 'Next',
    startPlaying: "Let's play",
  },
  guideLines: {
    maxNumber: [
      'The biggest number that will appear in the sums.',
      'Start small and go higher once your child finds it easy.',
    ],
    operations: [
      'Adding, subtracting, or both mixed together.',
      'Start with adding. Mix in subtracting once that is easy.',
    ],
    answerInput: [
      'Your child taps the keypad or writes with the pencil.',
      'Choose the pencil once your child can write every digit.',
    ],
    summary: [
      'All done. You can still change any choice with a tap.',
      'Later, change them by holding the gear in the top right.',
    ],
  },
};

function englishFile(): Record<string, unknown> {
  return COUNTING_FILES['en'] ?? {};
}

describe('#137 AC1: anglické texty Počítání', () => {
  it('Počítání má soubor anglických textů src/games/counting/texts/en.ts', () => {
    expect(Object.keys(COUNTING_FILES)).toContain('en');
  });

  it('hra se anglicky jmenuje „Counting“', () => {
    expect(englishFile()['title']).toBe('Counting');
  });

  it('řady nastavení jsou „Up to“, „Sums“ a „Answer“', () => {
    expect(englishFile()['rowLabels']).toEqual(ENGLISH_COUNTING.rowLabels);
  });

  it("tlačítka průvodce jsou „Back“, „Next“ a „Let's play“", () => {
    expect(englishFile()['guideButtons']).toEqual(ENGLISH_COUNTING.guideButtons);
  });

  for (const [id, lines] of Object.entries(ENGLISH_COUNTING.guideLines)) {
    it(`věta průvodce „${id}“ má oba řádky přesně podle tabulky`, () => {
      const guideLines = (englishFile()['guideLines'] ?? {}) as Record<string, unknown>;
      expect(guideLines[id]).toEqual(lines);
    });
  }

  it('soubor neobsahuje nic jiného než texty z tabulky', () => {
    expect(englishFile()).toEqual(ENGLISH_COUNTING);
  });

  it('angličtina má stejné texty jako čeština a žádný není prázdný', () => {
    expect(COUNTING_FILES['en'], 'soubor en.ts chybí').toBeDefined();
    expect(
      findTextProblems({
        language: 'en',
        part: 'Počítání',
        reference: COUNTING_FILES['cs'] ?? {},
        texts: englishFile(),
        isTwoLineKey: (key) => key.startsWith('guideLines.'),
      }),
    ).toEqual([]);
  });

  it('angličtina je jen soubor textů, do seznamu jazyků hry zatím nepatří', () => {
    expect(LANGUAGES).not.toContain('en');
  });
});

describe('#137 AC1: řádky vět průvodce mají v každém jazyce nejvýš 56 znaků', () => {
  for (const language of Object.keys(COUNTING_FILES)) {
    it(`jazyk ${language}: žádný řádek věty průvodce nemá víc než 56 znaků`, () => {
      const guideLines = (COUNTING_FILES[language]?.['guideLines'] ?? {}) as Record<
        string,
        readonly string[]
      >;
      const tooLong = Object.entries(guideLines).flatMap(([id, lines]) =>
        lines
          .filter((line) => [...line].length > MAX_LINE_CHARACTERS)
          .map((line) => `jazyk ${language}, věta ${id}: „${line}“ má ${[...line].length} znaků`),
      );
      expect(tooLong).toEqual([]);
    });
  }
});
