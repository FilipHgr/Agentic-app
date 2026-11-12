/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';

import { voiceSentences } from '../../../src/games/counting/logic/guideScript';
import type { CountingTexts } from '../../../src/games/counting/texts/countingTexts';
import { dictionariesByLanguage } from '../../shared/textChecks';

/**
 * Testy k #137 AC3: věty průvodce jdou rovnou do nahrávek, proto každý
 * řádek obsahuje jen písmena abecedy svého jazyka, mezery a znaky . , '
 * (žádné číslice, &, /, závorky ani zkratky s tečkou uvnitř slova).
 * Skript na nahrávky dostane oba řádky za sebou oddělené jednou mezerou.
 * Obojí platí pro každý jazyk, který má soubor textů Počítání, i mimo
 * seznam jazyků hry.
 *
 * Abeceda každého jazyka je vypsaná výčtem tady v testu. Kdo zakládá nový
 * jazyk, doplní sem jeho abecedu; bez ní test jazyka selže.
 */

const COUNTING_FILES = dictionariesByLanguage(
  import.meta.glob('../../../src/games/counting/texts/*.ts', { eager: true }),
);

const ENGLISH_LETTERS = 'abcdefghijklmnopqrstuvwxyz';
const CZECH_LETTERS = 'aábcčdďeéěfghiíjklmnňoópqrřsštťuúůvwxyýzž';

/** Písmena abecedy jazyka, malá i velká (výčtem, ne podle Unicode). */
const ALPHABETS: Readonly<Record<string, string>> = {
  cs: CZECH_LETTERS + CZECH_LETTERS.toUpperCase(),
  en: ENGLISH_LETTERS + ENGLISH_LETTERS.toUpperCase(),
};

/** Znaky, které smí být v řádku vedle písmen. */
const ALLOWED_MARKS = " .,'";

/** Zkratka s tečkou uvnitř slova, třeba „e.g.“ nebo „tj.d“. */
function hasDotInsideWord(line: string, letters: string): boolean {
  const chars = [...line];
  return chars.some(
    (char, index) =>
      char === '.' &&
      letters.includes(chars[index - 1] ?? ' ') &&
      letters.includes(chars[index + 1] ?? ' '),
  );
}

/** Problémy jednoho řádku věty v jazyce; prázdný seznam = řádek je v pořádku. */
function lineProblems(language: string, id: string, line: string): string[] {
  const letters = ALPHABETS[language];
  const where = `jazyk ${language}, věta ${id}, řádek „${line}“`;
  if (letters === undefined) {
    return [`${where}: test nezná abecedu jazyka, doplň ji do ALPHABETS`];
  }
  const problems: string[] = [];
  const foreign = [
    ...new Set([...line].filter((char) => !(letters + ALLOWED_MARKS).includes(char))),
  ];
  if (foreign.length > 0) {
    problems.push(`${where}: nepovolené znaky ${foreign.map((char) => `„${char}“`).join(' ')}`);
  }
  if (hasDotInsideWord(line, letters)) {
    problems.push(`${where}: zkratka s tečkou uvnitř slova`);
  }
  return problems;
}

function guideLinesOf(texts: Record<string, unknown>): Record<string, readonly string[]> {
  return (texts['guideLines'] ?? {}) as Record<string, readonly string[]>;
}

function languageProblems(language: string, texts: Record<string, unknown>): string[] {
  return Object.entries(guideLinesOf(texts)).flatMap(([id, lines]) =>
    lines.flatMap((line) => lineProblems(language, id, line)),
  );
}

describe("#137 AC3: řádky vět průvodce mají jen písmena svého jazyka, mezery a . , '", () => {
  it('kontrola má co měřit: soubor textů má čeština i angličtina', () => {
    expect(Object.keys(COUNTING_FILES)).toEqual(expect.arrayContaining(['cs', 'en']));
  });

  for (const language of Object.keys(COUNTING_FILES)) {
    it(`jazyk ${language}: test zná abecedu jazyka (doplní ji ten, kdo jazyk zakládá)`, () => {
      expect(ALPHABETS[language], language).toBeDefined();
    });

    it(`jazyk ${language}: každý řádek věty průvodce projde kontrolou písmen`, () => {
      expect(languageProblems(language, COUNTING_FILES[language] ?? {})).toEqual([]);
    });

    it(`jazyk ${language}: skript na nahrávky dostane oba řádky věty za sebou s jednou mezerou`, () => {
      const texts = COUNTING_FILES[language] as unknown as CountingTexts;
      for (const sentence of voiceSentences(texts)) {
        const [first, second] = texts.guideLines[sentence.id];
        expect(sentence.text, `${language}, ${sentence.id}`).toBe(`${first} ${second}`);
        expect(sentence.text, `${language}, ${sentence.id}`).not.toMatch(/\s{2}|^\s|\s$/);
      }
    });
  }
});

describe('#137 AC3: kontrola písmen opravdu najde chybu (umělé řádky jen v testu)', () => {
  const cases: ReadonlyArray<{ name: string; language: string; line: string }> = [
    { name: 'číslice', language: 'en', line: 'Numbers up to 10.' },
    { name: 'znak &', language: 'en', line: 'Adding & subtracting.' },
    { name: 'lomítko', language: 'cs', line: 'Sčítání/odčítání.' },
    { name: 'závorky', language: 'en', line: 'Adding (or subtracting).' },
    { name: 'zkratka s tečkou uvnitř slova', language: 'en', line: 'Choose a sum, e.g. adding.' },
    { name: 'české písmeno v angličtině', language: 'en', line: 'Číslo is a number.' },
    { name: 'písmeno cizí abecedy v češtině', language: 'cs', line: 'Größe čísla.' },
    { name: 'znaménko plus', language: 'cs', line: 'Jedna + dva.' },
    { name: 'typografický apostrof', language: 'en', line: 'Let’s play.' },
  ];

  for (const { name, language, line } of cases) {
    it(`${name} (${language}): kontrola řádek najde a řekne jazyk a řádek`, () => {
      const problems = lineProblems(language, 'maxNumber', line);
      expect(problems).toHaveLength(1);
      expect(problems[0]).toContain(`jazyk ${language}`);
      expect(problems[0]).toContain(line);
    });
  }

  it("řádek z písmen, mezer a . , ' projde v angličtině i češtině", () => {
    expect(lineProblems('en', 'summary', "All done. Let's play, child.")).toEqual([]);
    expect(lineProblems('cs', 'summary', 'Hotovo. Volby můžete ještě změnit ťuknutím.')).toEqual(
      [],
    );
  });

  it('jazyk bez abecedy v testu kontrola zachytí', () => {
    const problems = lineProblems('xx', 'summary', 'Done.');
    expect(problems.join('\n')).toContain('abecedu');
  });
});
