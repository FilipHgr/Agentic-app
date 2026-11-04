import { describe, expect, it } from 'vitest';

import { createProblem } from '../src/logic/problems';
import type { Problem } from '../src/logic/problems';
import {
  ANSWER_INPUT_OPTIONS,
  DEFAULT_SETTINGS,
  OPERATION_OPTIONS,
  answerInputOf,
  isWritingActive,
  parseSettings,
  serializeSettings,
} from '../src/logic/settings';
import type { AnswerInput, GameSettings, MaxNumber, Operation } from '../src/logic/settings';
import { loadSettings, saveSettings } from '../src/storage/settingsStorage';
import type { KeyValueStorage } from '../src/storage/settingsStorage';

import { seededRandom } from './seededRandom';

/**
 * Testy k #41 (psaní odpovědi prstem): volba v nastavení pro rodiče (AC1)
 * a příklady s výsledkem 0–9 při psaní (AC6). Měřítka #37 a #39 platí dál,
 * testy jsou obdobou `noRepeat.test.ts` a `fewerZeros.test.ts`.
 */

/** Kolik příkladů se v jednom měření vylosuje. */
const DRAWS = 1000;

/** #39: nejvýš 15 % příkladů s nulou. */
const MAX_ZERO_SHARE = 0.15;

/** #39: při „+ −“ tvoří každý druh 40 až 60 % příkladů. */
const MIN_OPERATION_SHARE = 0.4;
const MAX_OPERATION_SHARE = 0.6;

/** Nejvyšší výsledek, který jde napsat jednou číslicí. */
const MAX_WRITTEN_RESULT = 9;

/** Rozsahy, ve kterých se odpovídá psaním. */
const WRITING_RANGES: MaxNumber[] = [5, 10];

/** Všechny kombinace rozsahu 5 a 10 s „+“, „−“ i „+ −“ se zapnutým psaním. */
const WRITING_SETTINGS: GameSettings[] = WRITING_RANGES.flatMap((maxNumber) =>
  OPERATION_OPTIONS.map((operations) => withInput({ maxNumber, operations }, 'writing')),
);

function withInput(
  settings: Pick<GameSettings, 'maxNumber' | 'operations'>,
  answerInput: AnswerInput,
): GameSettings {
  return { ...settings, answerInput };
}

function label(settings: GameSettings): string {
  return `psaní do ${settings.maxNumber}, druh „${settings.operations}“`;
}

/** Úložiště v paměti, jako localStorage v prohlížeči. */
function memoryStorage(): KeyValueStorage {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
}

function hasZero(problem: Problem): boolean {
  return problem.first === 0 || problem.second === 0 || problem.result === 0;
}

function isSameProblem(a: Problem, b: Problem): boolean {
  return a.first === b.first && a.operation === b.operation && a.second === b.second;
}

/** Jak by hrálo dítě: každý nový příklad dostane předchozí jako `previous`. */
function playInARow(settings: GameSettings, seed?: number): Problem[] {
  const random = seededRandom(seed);
  const problems: Problem[] = [];
  let previous: Problem | undefined;
  for (let draw = 0; draw < DRAWS; draw += 1) {
    const problem = createProblem(settings, random, previous);
    problems.push(problem);
    previous = problem;
  }
  return problems;
}

function ofOperation(problems: readonly Problem[], operation: Operation): Problem[] {
  return problems.filter((problem) => problem.operation === operation);
}

function zeroShare(problems: readonly Problem[]): number {
  return problems.length === 0 ? 0 : problems.filter(hasZero).length / problems.length;
}

function expectValidProblem(problem: Problem, maxNumber: number): void {
  for (const value of [problem.first, problem.second, problem.result]) {
    expect(Number.isInteger(value)).toBe(true);
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThanOrEqual(maxNumber);
  }
  const expectedResult =
    problem.operation === 'plus' ? problem.first + problem.second : problem.first - problem.second;
  expect(problem.result).toBe(expectedResult);
}

describe('AC1: rodič přepíná mezi číselníkem a psaním a volba se pamatuje', () => {
  it('nastavení nabízí „číselník“ a „psaní“', () => {
    expect([...ANSWER_INPUT_OPTIONS].sort()).toEqual(['keypad', 'writing']);
  });

  it('bez zásahu rodiče hra odpovídá číselníkem', () => {
    expect(answerInputOf(DEFAULT_SETTINGS)).toBe('keypad');
    expect(isWritingActive(DEFAULT_SETTINGS)).toBe(false);
  });

  it('zvolené psaní zůstane uložené i po zavření a novém otevření hry', () => {
    const storage = memoryStorage();
    const chosen = withInput({ maxNumber: 5, operations: 'minus' }, 'writing');

    expect(saveSettings(storage, chosen)).toBe(true);
    const loaded = loadSettings(storage);

    expect(answerInputOf(loaded)).toBe('writing');
    expect(loaded.maxNumber).toBe(5);
    expect(loaded.operations).toBe('minus');
  });

  it('přepnutí zpět na číselník se taky uloží', () => {
    const storage = memoryStorage();
    saveSettings(storage, withInput({ maxNumber: 10, operations: 'plus' }, 'writing'));
    saveSettings(storage, withInput({ maxNumber: 10, operations: 'plus' }, 'keypad'));

    expect(answerInputOf(loadSettings(storage))).toBe('keypad');
  });

  it('uložení a načtení vrátí stejnou volbu pro všechny kombinace', () => {
    for (const answerInput of ANSWER_INPUT_OPTIONS) {
      for (const maxNumber of [5, 10, 20] as const) {
        for (const operations of OPERATION_OPTIONS) {
          const settings = withInput({ maxNumber, operations }, answerInput);
          const loaded = parseSettings(serializeSettings(settings));

          expect(answerInputOf(loaded)).toBe(answerInput);
          expect(loaded.maxNumber).toBe(maxNumber);
          expect(loaded.operations).toBe(operations);
        }
      }
    }
  });

  it('starší uložené nastavení bez volby odpovědi použije číselník a zbytek zachová', () => {
    const loaded = parseSettings('{"maxNumber":5,"operations":"minus"}');

    expect(answerInputOf(loaded)).toBe('keypad');
    expect(loaded.maxNumber).toBe(5);
    expect(loaded.operations).toBe('minus');
  });

  it('poškozená volba odpovědi se nahradí číselníkem a hra nespadne', () => {
    for (const value of ['"kresleni"', '42', 'null', 'true', '["writing"]', '{}', '""']) {
      const loaded = parseSettings(`{"maxNumber":5,"operations":"minus","answerInput":${value}}`);

      expect(answerInputOf(loaded)).toBe('keypad');
      expect(loaded.maxNumber).toBe(5);
      expect(loaded.operations).toBe('minus');
    }
  });

  it('úplně poškozený nebo chybějící záznam znamená číselník', () => {
    for (const saved of [null, undefined, '', 'nesmysl', '{', 'null', '[]']) {
      expect(answerInputOf(parseSettings(saved))).toBe('keypad');
    }
  });

  it('zakázané úložiště prohlížeče znamená číselník a hra nespadne', () => {
    const broken: KeyValueStorage = {
      getItem: () => {
        throw new Error('úložiště zakázáno');
      },
      setItem: () => {
        throw new Error('úložiště plné');
      },
    };

    expect(answerInputOf(loadSettings(broken))).toBe('keypad');
  });
});

describe('AC6: při psaní dává hra jen příklady s výsledkem 0–9', () => {
  it('kombinací rozsahu 5 a 10 s „+“, „−“ a „+ −“ je šest', () => {
    expect(WRITING_SETTINGS).toHaveLength(6);
  });

  for (const settings of WRITING_SETTINGS) {
    it(`${label(settings)}: všech 1000 příkladů má výsledek 0–9 a čísla z rozsahu`, () => {
      for (const problem of playInARow(settings)) {
        expectValidProblem(problem, settings.maxNumber);
        expect(problem.result).toBeLessThanOrEqual(MAX_WRITTEN_RESULT);
      }
    });

    it(`${label(settings)}: druh příkladů odpovídá nastavení`, () => {
      const problems = playInARow(settings);

      if (settings.operations === 'mixed') {
        const plusShare = ofOperation(problems, 'plus').length / problems.length;
        expect(plusShare).toBeGreaterThanOrEqual(MIN_OPERATION_SHARE);
        expect(plusShare).toBeLessThanOrEqual(MAX_OPERATION_SHARE);
      } else {
        expect(problems.every((problem) => problem.operation === settings.operations)).toBe(true);
      }
    });

    it(`${label(settings)}: stejný příklad nikdy nepřijde dvakrát za sebou (#37)`, () => {
      const problems = playInARow(settings);

      problems.forEach((problem, index) => {
        const next = problems[index + 1];
        if (next) {
          expect(isSameProblem(problem, next)).toBe(false);
        }
      });
    });

    it(`${label(settings)}: nula je nejvýš v 15 % příkladů (#39)`, () => {
      const problems = playInARow(settings);

      if (settings.operations === 'mixed') {
        expect(zeroShare(ofOperation(problems, 'plus'))).toBeLessThanOrEqual(MAX_ZERO_SHARE);
        expect(zeroShare(ofOperation(problems, 'minus'))).toBeLessThanOrEqual(MAX_ZERO_SHARE);
      } else {
        expect(zeroShare(problems)).toBeLessThanOrEqual(MAX_ZERO_SHARE);
      }
    });

    it(`${label(settings)}: nula úplně nezmizí a přijdou různé výsledky`, () => {
      const problems = playInARow(settings);
      const results = new Set(problems.map((problem) => problem.result));

      expect(problems.some(hasZero)).toBe(true);
      expect(results.size).toBeGreaterThanOrEqual(Math.min(settings.maxNumber, 9) - 1);
    });
  }

  it('psaní do 10: přijdou i výsledky 8 a 9, jen 10 ne', () => {
    const results = new Set(
      playInARow(withInput({ maxNumber: 10, operations: 'mixed' }, 'writing')).map(
        (problem) => problem.result,
      ),
    );

    expect(results.has(8)).toBe(true);
    expect(results.has(9)).toBe(true);
    expect(results.has(10)).toBe(false);
  });

  it('s číselníkem do 10 zůstává i výsledek 10', () => {
    const results = playInARow(withInput({ maxNumber: 10, operations: 'plus' }, 'keypad')).map(
      (problem) => problem.result,
    );

    expect(results).toContain(10);
  });

  it('psaní je zapnuté při rozsahu 5 a 10', () => {
    for (const settings of WRITING_SETTINGS) {
      expect(isWritingActive(settings)).toBe(true);
    }
  });

  it('s číselníkem se nepíše v žádném rozsahu', () => {
    for (const maxNumber of [5, 10, 20] as const) {
      for (const operations of OPERATION_OPTIONS) {
        expect(isWritingActive(withInput({ maxNumber, operations }, 'keypad'))).toBe(false);
      }
    }
  });

  it('při rozsahu 20 se odpovídá číselníkem i se zapnutým psaním', () => {
    for (const operations of OPERATION_OPTIONS) {
      expect(isWritingActive(withInput({ maxNumber: 20, operations }, 'writing'))).toBe(false);
    }
  });

  it('při rozsahu 20 se zapnutým psaním přijdou i výsledky nad 9 jako s číselníkem', () => {
    const problems = playInARow(withInput({ maxNumber: 20, operations: 'plus' }, 'writing'));

    expect(problems.some((problem) => problem.result > MAX_WRITTEN_RESULT)).toBe(true);
    for (const problem of problems) {
      expectValidProblem(problem, 20);
    }
  });

  it('po přepnutí z rozsahu 20 zpět na 5 nebo 10 se psaní vrátí', () => {
    const storage = memoryStorage();
    saveSettings(storage, withInput({ maxNumber: 20, operations: 'plus' }, 'writing'));
    const at20 = loadSettings(storage);

    expect(isWritingActive(at20)).toBe(false);
    expect(answerInputOf(at20)).toBe('writing');

    for (const maxNumber of WRITING_RANGES) {
      const back: GameSettings = { ...at20, maxNumber };
      saveSettings(storage, back);

      expect(isWritingActive(loadSettings(storage))).toBe(true);
    }
  });
});
