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
  writingBoxCount,
} from '../src/logic/settings';
import type { AnswerInput, GameSettings, MaxNumber, Operation } from '../src/logic/settings';
import { loadSettings, saveSettings } from '../src/storage/settingsStorage';
import type { KeyValueStorage } from '../src/storage/settingsStorage';

import { seededRandom } from './seededRandom';

/**
 * Testy k #41 a #42 (psaní odpovědi prstem): volba v nastavení pro rodiče
 * (#41 AC1), psaní ve všech rozsazích (#42 AC1) a při psaní stejné příklady
 * jako s číselníkem (#42 AC5, dřív #41 AC6 jen 0–9). Měřítka #37 a #39 platí
 * dál, testy jsou obdobou `noRepeat.test.ts` a `fewerZeros.test.ts`.
 */

/** Kolik příkladů se v jednom měření vylosuje. */
const DRAWS = 1000;

/** #39: nejvýš 15 % příkladů s nulou. */
const MAX_ZERO_SHARE = 0.15;

/** #39: při „+ −“ tvoří každý druh 40 až 60 % příkladů. */
const MIN_OPERATION_SHARE = 0.4;
const MAX_OPERATION_SHARE = 0.6;

/** Rozsahy, ve kterých se odpovídá psaním: od #42 všechny. */
const WRITING_RANGES: MaxNumber[] = [5, 10, 20];

/** Všechny kombinace rozsahu 5, 10 a 20 s „+“, „−“ i „+ −“ se zapnutým psaním. */
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

describe('#42 AC1: psaní funguje při rozsahu 5, 10 i 20', () => {
  it('se zapnutým psaním se píše ve všech rozsazích a se všemi druhy příkladů', () => {
    expect(WRITING_SETTINGS).toHaveLength(9);
    for (const settings of WRITING_SETTINGS) {
      expect(isWritingActive(settings), label(settings)).toBe(true);
    }
  });

  it('s číselníkem se nepíše v žádném rozsahu', () => {
    for (const maxNumber of [5, 10, 20] as const) {
      for (const operations of OPERATION_OPTIONS) {
        expect(isWritingActive(withInput({ maxNumber, operations }, 'keypad'))).toBe(false);
      }
    }
  });

  it('starší uložené nastavení „psaní + rozsah 20“ teď znamená psaní', () => {
    for (const operations of OPERATION_OPTIONS) {
      const loaded = parseSettings(
        `{"maxNumber":20,"operations":"${operations}","answerInput":"writing"}`,
      );

      expect(loaded.maxNumber).toBe(20);
      expect(answerInputOf(loaded)).toBe('writing');
      expect(isWritingActive(loaded)).toBe(true);
    }
  });

  it('psaní zůstane zapnuté, i když rodič přepíná rozsah 5, 10 a 20', () => {
    const storage = memoryStorage();
    saveSettings(storage, withInput({ maxNumber: 20, operations: 'plus' }, 'writing'));

    for (const maxNumber of [20, 5, 10, 20] as const) {
      saveSettings(storage, { ...loadSettings(storage), maxNumber });
      const loaded = loadSettings(storage);

      expect(loaded.maxNumber).toBe(maxNumber);
      expect(isWritingActive(loaded)).toBe(true);
    }
  });

  it('při rozsahu 10 a 20 má dítě dvě okénka, při rozsahu 5 jedno', () => {
    expect(writingBoxCount(5)).toBe(1);
    expect(writingBoxCount(10)).toBe(2);
    expect(writingBoxCount(20)).toBe(2);
  });
});

describe('#42 AC5: při psaní dává hra stejné příklady jako s číselníkem', () => {
  it('kombinací rozsahu 5, 10 a 20 s „+“, „−“ a „+ −“ je devět', () => {
    expect(WRITING_SETTINGS).toHaveLength(9);
  });

  for (const settings of WRITING_SETTINGS) {
    it(`${label(settings)}: se stejnou náhodou přijdou stejné příklady jako s číselníkem`, () => {
      const keypad = withInput(settings, 'keypad');

      expect(playInARow(settings)).toEqual(playInARow(keypad));
    });

    it(`${label(settings)}: všech 1000 příkladů má čísla i výsledek 0 až rozsah`, () => {
      for (const problem of playInARow(settings)) {
        expectValidProblem(problem, settings.maxNumber);
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
      expect(results.size).toBeGreaterThanOrEqual(settings.maxNumber - 1);
    });
  }

  it('psaní do 10: přijde i výsledek 10', () => {
    const results = new Set(
      playInARow(withInput({ maxNumber: 10, operations: 'mixed' }, 'writing')).map(
        (problem) => problem.result,
      ),
    );

    expect(results.has(9)).toBe(true);
    expect(results.has(10)).toBe(true);
  });

  it('psaní do 20: přijdou všechny výsledky 10 až 20', () => {
    const results = new Set(
      playInARow(withInput({ maxNumber: 20, operations: 'plus' }, 'writing')).map(
        (problem) => problem.result,
      ),
    );

    for (let result = 10; result <= 20; result += 1) {
      expect(results.has(result), `výsledek ${result}`).toBe(true);
    }
  });

  it('psaní do 5: výsledky zůstávají 0–5', () => {
    for (const problem of playInARow(withInput({ maxNumber: 5, operations: 'mixed' }, 'writing'))) {
      expect(problem.result).toBeLessThanOrEqual(5);
    }
  });
});
