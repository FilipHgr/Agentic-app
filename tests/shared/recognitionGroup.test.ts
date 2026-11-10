import { afterEach, describe, expect, it } from 'vitest';

import {
  createScriptsFixture,
  removeScriptsFixture,
  scriptTestFiles,
  scriptTestNames,
  testFilesInRepo,
} from './testScriptsListing.mjs';

/**
 * Testy k #80: pomalé testy rozpoznávání psaní jsou ve vlastní skupině.
 * Pomalý soubor se pozná koncovkou `*.slow.test.ts`. Skupinu pouští skript
 * `test:recognition`, `test:counting` ji vynechává a `npm test` (a tím CI)
 * pouští všechno. Co skript pouští, se zjistí výpisem `vitest list` se
 * stejnými argumenty jako ve skriptu, takže test kontroluje skutečné
 * nastavení, ne jeho zápis. Výběr skupiny podle změněných souborů
 * (`test:changed`) ověřuje `changedTests.test.ts`.
 *
 * #119: pomalé testy Omalovánek (matice těsných tahů) jsou další skupina
 * se skriptem `test:coloring:slow`. `test:coloring` je vynechává
 * a `test:recognition` pouští už jen pomalé soubory Počítání.
 *
 * Každé pravidlo je jeden test, který projde případy v cyklu. Popis případu
 * je v `expect`, aby selhání ukázalo, který případ selhal.
 */

const COUNTING_SCRIPT = 'test:counting';
const RECOGNITION_SCRIPT = 'test:recognition';
const ALL_SCRIPT = 'test';
const COLORING_SCRIPT = 'test:coloring';
const COLORING_SLOW_SCRIPT = 'test:coloring:slow';

const SLOW_SUFFIX = '.slow.test.ts';
const COUNTING_TESTS = 'tests/games/counting/';
const COLORING_TESTS = 'tests/games/coloring/';
const BOUNDARIES_TEST = 'tests/shared/boundaries.test.ts';

/** Dnešní pomalé soubory Omalovánek z #119. */
const COLORING_SLOW_FILES: readonly string[] = [
  'tests/games/coloring/tightStrokesHorizontal.slow.test.ts',
  'tests/games/coloring/tightStrokesVertical.slow.test.ts',
];

/** Dnešní pomalé soubory rozpoznávání po přejmenování (AC2). */
const RECOGNITION_FILES: readonly string[] = [
  'tests/games/counting/digitRecognition.slow.test.ts',
  'tests/games/counting/phonePortraitRecognition.slow.test.ts',
  'tests/games/counting/twoDigitRecognition.slow.test.ts',
];

/** Dnešní názvy pomalých souborů bez koncovky, nesmějí běžet v `test:counting`. */
const RECOGNITION_FILE_NAMES: readonly string[] = [
  'digitRecognition',
  'phonePortraitRecognition',
  'twoDigitRecognition',
];

/** Rychlé testy chování hry přesunuté z pomalých souborů (AC1), „skupina > název“. */
const MOVED_TESTS: readonly string[] = [
  'AC6: prázdné okénko, ✓ a špatná odpověď ve vysokém okénku jako dnes > ✓ u prázdného okénka nic neudělá a nepočítá se jako chyba',
  'AC6: prázdné okénko, ✓ a špatná odpověď ve vysokém okénku jako dnes > po špatné odpovědi se okénko vyprázdní a hvězdička se nevezme',
  'testovací data pro dvouciferná čísla odpovídají zadání > okénko ve hře má aspoň 280 × 280 px',
];

/** Výpis testů pouští Vitest, test proto potřebuje víc času než běžný. */
const SLOW = 60_000;

function isSlow(path: string): boolean {
  return path.endsWith(SLOW_SUFFIX);
}

function isCountingSlow(path: string): boolean {
  return path.startsWith(COUNTING_TESTS) && isSlow(path);
}

function countOf(names: readonly string[], name: string): number {
  return names.filter((item) => item === name).length;
}

const fixtures: string[] = [];

function newFixture(testFiles: readonly string[]): string {
  const dir = createScriptsFixture(testFiles);
  fixtures.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of fixtures.splice(0)) {
    removeScriptsFixture(dir);
  }
});

describe('#80 AC1: testy Počítání pro práci na hře běží bez pomalých testů rozpoznávání', () => {
  it(
    'test:counting pustí všechny testy Počítání kromě pomalých a test hranic',
    () => {
      const counting = scriptTestFiles(COUNTING_SCRIPT);
      const expected = [
        ...testFilesInRepo().filter((path) => path.startsWith(COUNTING_TESTS) && !isSlow(path)),
        BOUNDARIES_TEST,
      ].sort();

      expect(counting, 'soubory test:counting').toEqual(expected);
      for (const path of counting) {
        expect(isSlow(path), `pomalý soubor ${path} v test:counting`).toBe(false);
      }
      for (const name of RECOGNITION_FILE_NAMES) {
        const found = counting.filter((path) => path.startsWith(`${COUNTING_TESTS}${name}.`));
        expect(found, `soubor ${name} v test:counting`).toEqual([]);
      }
    },
    SLOW,
  );

  it(
    'rychlé testy chování hry z pomalých souborů běží v test:counting jednou se stejnou skupinou a názvem',
    () => {
      const counting = scriptTestNames(COUNTING_SCRIPT);
      const recognition = scriptTestNames(RECOGNITION_SCRIPT);
      for (const name of MOVED_TESTS) {
        expect(countOf(counting, name), `v test:counting: ${name}`).toBe(1);
        expect(countOf(recognition, name), `v test:recognition: ${name}`).toBe(0);
      }
    },
    SLOW,
  );
});

describe('#80 AC2: příkaz skupiny rozpoznávání pustí jen pomalé soubory', () => {
  it(
    'test:recognition pustí právě pomalé soubory Počítání, dnes soubory rozpoznávání',
    () => {
      const recognition = scriptTestFiles(RECOGNITION_SCRIPT);

      // Upraveno k #119: pomalé soubory Omalovánek mají vlastní skupinu, test:recognition
      // pouští jen pomalé soubory Počítání (dřív všechny pomalé soubory v repozitáři).
      expect(recognition, 'soubory test:recognition').toEqual(
        testFilesInRepo().filter(isCountingSlow),
      );
      for (const path of RECOGNITION_FILES) {
        expect(recognition, `dnešní pomalý soubor ${path}`).toContain(path);
      }
      for (const path of COLORING_SLOW_FILES) {
        expect(recognition, `pomalý soubor Omalovánek ${path}`).not.toContain(path);
      }
    },
    SLOW,
  );
});

describe('#80 AC3: npm test pustí dál všechny testy včetně skupiny', () => {
  it(
    'npm test pustí každý soubor testů právě jednou, i pomalé',
    () => {
      const all = scriptTestFiles(ALL_SCRIPT);

      expect(all, 'soubory npm test').toEqual(testFilesInRepo());
      expect(new Set(all).size, 'žádný soubor dvakrát').toBe(all.length);
      // Upraveno k #119: npm test pouští i pomalé soubory Omalovánek.
      for (const path of [...RECOGNITION_FILES, ...COLORING_SLOW_FILES]) {
        expect(all, `pomalý soubor ${path}`).toContain(path);
      }
    },
    SLOW,
  );

  it(
    'přesunuté rychlé testy běží v npm test právě jednou',
    () => {
      const all = scriptTestNames(ALL_SCRIPT);
      for (const name of MOVED_TESTS) {
        expect(countOf(all, name), name).toBe(1);
      }
    },
    SLOW,
  );
});

describe('#119: pomalé testy Omalovánek jsou ve vlastní skupině', () => {
  it(
    'test:coloring pustí všechny testy Omalovánek kromě pomalých a test hranic',
    () => {
      const coloring = scriptTestFiles(COLORING_SCRIPT);
      const expected = [
        ...testFilesInRepo().filter((path) => path.startsWith(COLORING_TESTS) && !isSlow(path)),
        BOUNDARIES_TEST,
      ].sort();

      expect(coloring, 'soubory test:coloring').toEqual(expected);
      for (const path of COLORING_SLOW_FILES) {
        expect(coloring, `pomalý soubor ${path} v test:coloring`).not.toContain(path);
      }
    },
    SLOW,
  );

  it(
    'test:coloring:slow pustí právě pomalé soubory Omalovánek, dnes matici těsných tahů',
    () => {
      const coloringSlow = scriptTestFiles(COLORING_SLOW_SCRIPT);

      expect(coloringSlow, 'soubory test:coloring:slow').toEqual(
        testFilesInRepo().filter((path) => path.startsWith(COLORING_TESTS) && isSlow(path)),
      );
      for (const path of COLORING_SLOW_FILES) {
        expect(coloringSlow, `dnešní pomalý soubor ${path}`).toContain(path);
      }
    },
    SLOW,
  );

  it(
    'každý pomalý soubor patří právě do jedné skupiny',
    () => {
      const recognition = scriptTestFiles(RECOGNITION_SCRIPT);
      const coloringSlow = scriptTestFiles(COLORING_SLOW_SCRIPT);
      for (const path of testFilesInRepo().filter(isSlow)) {
        expect(
          countOf(recognition, path) + countOf(coloringSlow, path),
          `pomalý soubor ${path}`,
        ).toBe(1);
      }
    },
    SLOW,
  );
});

describe('#80 AC6: okrajové případy příkazů', () => {
  /** Kopie nastavení testů s vymyšlenými soubory místo skutečných. */
  const FIXTURE_FILES: readonly string[] = [
    'tests/games/counting/fast.test.ts',
    'tests/games/counting/existing.slow.test.ts',
    'tests/games/counting/brandNew.slow.test.ts',
    'tests/games/counting/logic/nested.slow.test.ts',
    // Upraveno k #119: soubory Omalovánek, rychlé i pomalé, nesmí se dostat do skupiny rozpoznávání.
    'tests/games/coloring/fast.test.ts',
    'tests/games/coloring/existing.slow.test.ts',
    'tests/games/coloring/brandNew.slow.test.ts',
    'tests/games/coloring/logic/nested.slow.test.ts',
    'tests/menu/menu.test.ts',
    'tests/shared/boundaries.test.ts',
    'tests/shared/hardcodedTexts.test.ts',
    'tests/shared/other.test.ts',
  ];

  it(
    'nový soubor označený jako pomalý se bez dalšího zápisu dostane do skupiny a vypadne z test:counting',
    () => {
      const dir = newFixture(FIXTURE_FILES);
      const cases: readonly { label: string; script: string; expected: readonly string[] }[] = [
        {
          // Upraveno k #119: jen pomalé soubory Počítání, ne Omalovánek.
          label: 'test:recognition pustí všechny pomalé soubory Počítání, i nové',
          script: RECOGNITION_SCRIPT,
          expected: [
            'tests/games/counting/brandNew.slow.test.ts',
            'tests/games/counting/existing.slow.test.ts',
            'tests/games/counting/logic/nested.slow.test.ts',
          ],
        },
        {
          label: 'test:counting pustí jen rychlé testy Počítání a test hranic',
          script: COUNTING_SCRIPT,
          expected: ['tests/games/counting/fast.test.ts', BOUNDARIES_TEST],
        },
        {
          label: 'test:coloring:slow pustí všechny pomalé soubory Omalovánek, i nové',
          script: COLORING_SLOW_SCRIPT,
          expected: [
            'tests/games/coloring/brandNew.slow.test.ts',
            'tests/games/coloring/existing.slow.test.ts',
            'tests/games/coloring/logic/nested.slow.test.ts',
          ],
        },
        {
          label: 'test:coloring pustí jen rychlé testy Omalovánek a test hranic',
          script: COLORING_SCRIPT,
          expected: ['tests/games/coloring/fast.test.ts', BOUNDARIES_TEST],
        },
        {
          label: 'npm test pustí všechno',
          script: ALL_SCRIPT,
          expected: [...FIXTURE_FILES].sort(),
        },
      ];
      for (const { label, script, expected } of cases) {
        expect(scriptTestFiles(script, dir), label).toEqual(expected);
      }
    },
    SLOW,
  );

  it(
    'příkaz skupiny proběhne celý i bez změněných souborů',
    () => {
      // Kopie je čerstvě commitnutý repozitář, pracovní kopie je bez změn.
      const dir = newFixture(FIXTURE_FILES);
      // Upraveno k #119: každá skupina jen své pomalé soubory.
      expect(scriptTestFiles(RECOGNITION_SCRIPT, dir), 'čistá pracovní kopie').toEqual(
        FIXTURE_FILES.filter(isCountingSlow).sort(),
      );
      expect(
        scriptTestFiles(COLORING_SLOW_SCRIPT, dir),
        'čistá pracovní kopie, pomalé testy Omalovánek',
      ).toEqual(
        FIXTURE_FILES.filter((path) => path.startsWith(COLORING_TESTS) && isSlow(path)).sort(),
      );
    },
    SLOW,
  );
});
