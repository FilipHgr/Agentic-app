import { describe, expect, it } from 'vitest';

import {
  drawProblem,
  startProblemRotation,
} from '../../../src/games/counting/logic/problemRotation';
import type { ProblemRotation } from '../../../src/games/counting/logic/problemRotation';
import type { Problem } from '../../../src/games/counting/logic/problems';
import type { GameSettings, Operation } from '../../../src/games/counting/logic/settings';

import {
  ALL_SETTINGS,
  GROUPS,
  expectNoEarlyRepeat,
  expectRotation,
  expectValidProblem,
  fullRotations,
  groupOf,
  hasZero,
  settingsLabel,
} from './rotationChecks';
import { seededRandom } from './seededRandom';

/**
 * Testy k #94 (příklady v Počítání se vystřídají, než se některý zopakuje)
 * na úrovni losování: AC1 (aspoň 4 jiné mezi stejnými), AC2 (vystřídání
 * po skupinách bez nuly a s nulou), AC3 (nula a druhy jako v #39), AC5
 * (změna nastavení) a AC6 (stálé losování). Testy nespoléhají na to, jak
 * hra čísla z generátoru používá, jen na řadu příkladů, která z něj vyjde.
 *
 * Navržené rozhraní `src/games/counting/logic/problemRotation.ts`:
 * - `ProblemRotation` stav vystřídání (co už ve skupinách přišlo a poslední
 *   příklady), testy do něj nenahlížejí,
 * - `startProblemRotation(): ProblemRotation` nové vystřídání (start hry),
 * - `drawProblem(rotation, settings, random): DrawnProblem` další příklad
 *   a nový stav `{ problem, rotation }`; původní stav se nemění. Když se
 *   `settings` liší od nastavení předchozího losování, začne nové
 *   vystřídání, poslední příklady se ale dál hlídají (AC5).
 */

/** Kolik příkladů za sebou se vylosuje (AC1, AC2 bez nuly, AC3, AC6). */
const DRAWS = 1000;

/** U skupiny s nulou víc, aby přišla aspoň 2 celá vystřídání i do 20 při „+ −“. */
const ZERO_GROUP_DRAWS = 10000;

const MAX_ZERO_SHARE = 0.15;
const MIN_OPERATION_SHARE = 0.4;
const MAX_OPERATION_SHARE = 0.6;

/** Stálé losování z AC6. */
const CONSTANT_DRAWS = [0, 0.5, 0.999];

interface DrawnRow {
  readonly problems: Problem[];
  readonly rotation: ProblemRotation;
}

/** Jak hra dává příklady za sebou: každé losování dostane stav po předchozím. */
function drawInARow(
  settings: GameSettings,
  random: () => number,
  count: number,
  rotation: ProblemRotation = startProblemRotation(),
): DrawnRow {
  const problems: Problem[] = [];
  let state = rotation;
  for (let draw = 0; draw < count; draw += 1) {
    const drawn = drawProblem(state, settings, random);
    problems.push(drawn.problem);
    state = drawn.rotation;
  }
  return { problems, rotation: state };
}

function share(part: number, whole: number): number {
  return whole === 0 ? 0 : part / whole;
}

function ofOperation(problems: readonly Problem[], operation: Operation): Problem[] {
  return problems.filter((problem) => problem.operation === operation);
}

describe('AC1: mezi dvěma stejnými příklady jsou vždy aspoň 4 jiné', () => {
  for (const settings of ALL_SETTINGS) {
    it(`${settingsLabel(settings)}: v 1000 příkladech za sebou se žádný nevrátí dřív než po 4 jiných`, () => {
      const { problems } = drawInARow(settings, seededRandom(), DRAWS);

      expectNoEarlyRepeat(problems, settingsLabel(settings));
    });
  }

  it('do 5 se sčítáním nepřijde stejný příklad hned po sobě ani ob jeden až tři', () => {
    // Nejmenší skupina (10 příkladů bez nuly), kde dřív skoro každá řada měla opakování.
    const settings: GameSettings = { maxNumber: 5, operations: 'plus' };
    for (let seed = 1; seed <= 50; seed += 1) {
      const { problems } = drawInARow(settings, seededRandom(seed), 40);

      expectNoEarlyRepeat(problems, `seed ${seed}`);
    }
  });
});

describe('AC2: všechny příklady ze skupiny přijdou jednou, než se kterýkoli zopakuje', () => {
  for (const settings of ALL_SETTINGS) {
    const label = settingsLabel(settings);

    it(`${label}: příklady bez nuly se v 1000 příkladech střídají po celých vystřídáních`, () => {
      const { problems } = drawInARow(settings, seededRandom(), DRAWS);

      expect(fullRotations(problems, settings, 'withoutZero')).toBeGreaterThanOrEqual(1);
      expectRotation(problems, settings, 'withoutZero', `${label}, bez nuly`);
    });

    it(`${label}: příklady s nulou se v 10 000 příkladech střídají po celých vystřídáních`, () => {
      const { problems } = drawInARow(settings, seededRandom(), ZERO_GROUP_DRAWS);

      expect(fullRotations(problems, settings, 'withZero')).toBeGreaterThanOrEqual(2);
      expectRotation(problems, settings, 'withZero', `${label}, s nulou`);
    });
  }
});

describe('AC3: nula a druhy příkladů chodí jako dřív, všechna čísla jsou platná', () => {
  for (const settings of ALL_SETTINGS) {
    const label = settingsLabel(settings);

    it(`${label}: nula nejvýš v 15 % příkladů, ale aspoň jednou`, () => {
      const { problems } = drawInARow(settings, seededRandom(), DRAWS);
      const parts =
        settings.operations === 'mixed'
          ? [ofOperation(problems, 'plus'), ofOperation(problems, 'minus')]
          : [problems];

      for (const part of parts) {
        const zeros = part.filter(hasZero).length;
        expect(share(zeros, part.length), `${label}: podíl nuly`).toBeLessThanOrEqual(
          MAX_ZERO_SHARE,
        );
      }
      expect(problems.some(hasZero), `${label}: aspoň jeden příklad s nulou`).toBe(true);
    });

    it(`${label}: všechny příklady jsou platné a odpovídají nastavení`, () => {
      const { problems } = drawInARow(settings, seededRandom(), DRAWS);

      for (const problem of problems) {
        expectValidProblem(problem, settings);
      }
    });

    if (settings.operations === 'mixed') {
      it(`${label}: sčítání i odčítání tvoří každé 40–60 % příkladů`, () => {
        const { problems } = drawInARow(settings, seededRandom(), DRAWS);

        for (const operation of ['plus', 'minus'] as const) {
          const operationShare = share(ofOperation(problems, operation).length, problems.length);
          expect(operationShare, `${label}: ${operation}`).toBeGreaterThanOrEqual(
            MIN_OPERATION_SHARE,
          );
          expect(operationShare, `${label}: ${operation}`).toBeLessThanOrEqual(MAX_OPERATION_SHARE);
        }
      });
    }
  }

  it('prvním příkladem nového vystřídání může být kterýkoli příklad, i „0 + 0“', () => {
    const settings: GameSettings = { maxNumber: 10, operations: 'plus' };
    const firstProblems = new Set<string>();
    for (let seed = 1; seed <= 20000; seed += 1) {
      const { problem } = drawProblem(startProblemRotation(), settings, seededRandom(seed));
      firstProblems.add(`${problem.first}+${problem.second}`);
    }

    expect(firstProblems.has('0+0')).toBe(true);
    expect(firstProblems.has('3+4')).toBe(true);
  });
});

describe('AC5: po změně nastavení začne nové vystřídání', () => {
  it('do 10 s „+“ a potom do 20 s „+“: poslední 4 příklady nepřijdou dřív než po 4 jiných', () => {
    const before: GameSettings = { maxNumber: 10, operations: 'plus' };
    const after: GameSettings = { maxNumber: 20, operations: 'plus' };
    for (let seed = 1; seed <= 200; seed += 1) {
      const random = seededRandom(seed);
      const played = drawInARow(before, random, 12);
      const continued = drawInARow(after, random, 12, played.rotation);

      expectNoEarlyRepeat([...played.problems, ...continued.problems], `seed ${seed}`);
    }
  });

  it('do 5 s „+“ a potom do 10 s „+“: od změny se příklady střídají po vystřídáních nového nastavení', () => {
    const before: GameSettings = { maxNumber: 5, operations: 'plus' };
    const after: GameSettings = { maxNumber: 10, operations: 'plus' };
    const random = seededRandom();
    // Uprostřed vystřídání do 5 (10 příkladů bez nuly).
    const played = drawInARow(before, random, 6);
    const continued = drawInARow(after, random, 200, played.rotation);

    expect(fullRotations(continued.problems, after, 'withoutZero')).toBeGreaterThanOrEqual(2);
    for (const group of GROUPS) {
      expectRotation(continued.problems, after, group, `po změně, skupina ${group}`);
    }
    expectNoEarlyRepeat([...played.problems, ...continued.problems], 'přes změnu');
  });

  it('nastavení beze změny (i jako nový objekt) vystřídání nepřeruší', () => {
    const settings: GameSettings = { maxNumber: 5, operations: 'plus' };
    const random = seededRandom();
    const problems: Problem[] = [];
    let rotation = startProblemRotation();
    for (let draw = 0; draw < 300; draw += 1) {
      // Rodič potvrdil totéž nastavení: hra dostane stejné hodnoty v novém objektu.
      const confirmedAgain: GameSettings = { ...settings };
      const drawn = drawProblem(rotation, confirmedAgain, random);
      problems.push(drawn.problem);
      rotation = drawn.rotation;
    }

    expectNoEarlyRepeat(problems, 'beze změny');
    for (const group of GROUPS) {
      expectRotation(problems, settings, group, `beze změny, skupina ${group}`);
    }
  });

  it('předchozí stav vystřídání se losováním nezmění', () => {
    const settings: GameSettings = { maxNumber: 10, operations: 'mixed' };
    const played = drawInARow(settings, seededRandom(), 15);

    const once = drawInARow(settings, seededRandom(7), 30, played.rotation);
    const again = drawInARow(settings, seededRandom(7), 30, played.rotation);

    expect(again.problems).toEqual(once.problems);
  });
});

describe('AC6: hra se nezasekne, ani když losování vrací pořád stejné číslo', () => {
  for (const settings of ALL_SETTINGS) {
    const label = settingsLabel(settings);

    for (const constant of CONSTANT_DRAWS) {
      it(`${label}, losování stále ${constant}: 1000 platných příkladů bez brzkého opakování`, () => {
        let row: DrawnRow | undefined;
        expect(() => {
          row = drawInARow(settings, () => constant, DRAWS);
        }).not.toThrow();
        const problems = row?.problems ?? [];

        expect(problems).toHaveLength(DRAWS);
        for (const problem of problems) {
          expectValidProblem(problem, settings);
        }
        expectNoEarlyRepeat(problems, `${label}, stále ${constant}`);

        // AC2 jen pro skupinu, která se při stálém losování opravdu losuje.
        const drawnGroup = GROUPS.reduce((most, group) =>
          problems.filter((problem) => groupOf(problem) === group).length >
          problems.filter((problem) => groupOf(problem) === most).length
            ? group
            : most,
        );
        expectRotation(problems, settings, drawnGroup, `${label}, stále ${constant}`);
      });
    }
  }
});
