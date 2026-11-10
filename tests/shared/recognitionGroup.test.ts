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
 * Každé pravidlo je jeden test, který projde případy v cyklu. Popis případu
 * je v `expect`, aby selhání ukázalo, který případ selhal.
 */

const COUNTING_SCRIPT = 'test:counting';
const RECOGNITION_SCRIPT = 'test:recognition';
const ALL_SCRIPT = 'test';

const SLOW_SUFFIX = '.slow.test.ts';
const COUNTING_TESTS = 'tests/games/counting/';
const BOUNDARIES_TEST = 'tests/shared/boundaries.test.ts';

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
    'test:recognition pustí právě soubory označené jako pomalé, dnes tři soubory rozpoznávání',
    () => {
      const recognition = scriptTestFiles(RECOGNITION_SCRIPT);

      expect(recognition, 'soubory test:recognition').toEqual(testFilesInRepo().filter(isSlow));
      for (const path of RECOGNITION_FILES) {
        expect(recognition, `dnešní pomalý soubor ${path}`).toContain(path);
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
      for (const path of RECOGNITION_FILES) {
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

describe('#80 AC6: okrajové případy příkazů', () => {
  /** Kopie nastavení testů s vymyšlenými soubory místo skutečných. */
  const FIXTURE_FILES: readonly string[] = [
    'tests/games/counting/fast.test.ts',
    'tests/games/counting/existing.slow.test.ts',
    'tests/games/counting/brandNew.slow.test.ts',
    'tests/games/counting/logic/nested.slow.test.ts',
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
          label: 'test:recognition pustí všechny pomalé soubory, i nové',
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
      expect(scriptTestFiles(RECOGNITION_SCRIPT, dir), 'čistá pracovní kopie').toEqual(
        FIXTURE_FILES.filter(isSlow).sort(),
      );
    },
    SLOW,
  );
});
