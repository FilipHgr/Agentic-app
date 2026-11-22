import { describe, expect, it } from 'vitest';

import {
  EMPTY_MISTAKES,
  mistakeOverview,
  parseMistakes,
  recordMistake,
  recordSolvedOperation,
  serializeMistakes,
} from '../../src/shared/logic/mistakeActivity';
import {
  comparisonKey,
  equationKey,
  formatOverviewProblem,
  isProblemOf,
  missingSignKey,
} from '../../src/shared/logic/overviewProblems';
import type { GameOverviewSpec } from '../../src/shared/logic/overviewProblems';
import { dayKeyOf } from '../../src/shared/logic/weekActivity';
import {
  ACTIVITY_KEY,
  MISTAKES_KEY,
  createActivityLog,
  readGameOverview,
} from '../../src/shared/storage/activityStorage';
import type { KeyValueStorage } from '../../src/shared/storage/keyValueStorage';

/**
 * Testy k #192 AC3: společný tvar a čtení záznamů přehledu pro rodiče ve
 * sdílené části. Hra popíše svůj přehled (`GameOverviewSpec`) jako data
 * a příklady zapisuje jako krátký text; menu záznamy čte stejnou logikou
 * bez kódu her. Klíče a tvar jsou stejné jako v Počítání před #192, takže
 * dřívější záznamy zůstanou čitelné.
 */

const SUNDAY = new Date(2026, 10, 22, 12, 0, 0);

const EQUATIONS: GameOverviewSpec = {
  maxNumber: 20,
  problemForms: ['equation'],
  operations: ['plus', 'minus'],
  hints: true,
};

const SIGNS: GameOverviewSpec = {
  maxNumber: 20,
  problemForms: ['missingSign', 'comparison'],
  operations: [],
  hints: false,
};

function memory(initial: Record<string, string> = {}): KeyValueStorage & {
  readonly data: Map<string, string>;
} {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
}

describe('#192 AC3: příklady v záznamu mají společný krátký tvar', () => {
  it('příklad s výsledkem je „8+5“ a „9-3“, doplň znaménko „7?5=2“ a „7?5“', () => {
    expect(equationKey(8, 'plus', 5)).toBe('8+5');
    expect(equationKey(9, 'minus', 3)).toBe('9-3');
    expect(missingSignKey(7, 5, 2)).toBe('7?5=2');
    expect(comparisonKey(7, 5)).toBe('7?5');
  });

  it('rodič vidí příklad tak, jak ho vidělo dítě: „8 + 5“, „9 − 3“, „7 ☐ 5 = 2“, „7 ☐ 5“', () => {
    expect(formatOverviewProblem('8+5')).toBe('8 + 5');
    expect(formatOverviewProblem('9-3')).toBe('9 − 3');
    expect(formatOverviewProblem('7?5=2')).toBe('7 ☐ 5 = 2');
    expect(formatOverviewProblem('7?5')).toBe('7 ☐ 5');
  });

  it('do záznamu hry patří jen příklady, které hra podle svého popisu může dát', () => {
    const cases: ReadonlyArray<[string, GameOverviewSpec, boolean]> = [
      ['8+5', EQUATIONS, true],
      ['10+10', EQUATIONS, true],
      ['15+9', EQUATIONS, false],
      ['3-5', EQUATIONS, false],
      ['21-1', EQUATIONS, false],
      ['08+5', EQUATIONS, false],
      ['7?5=2', EQUATIONS, false],
      ['7?5=2', SIGNS, true],
      ['7?5=12', SIGNS, true],
      ['7?5=3', SIGNS, false],
      ['7?0=7', SIGNS, false],
      ['7?5', SIGNS, true],
      ['20?20', SIGNS, true],
      ['21?1', SIGNS, false],
      ['8+5', SIGNS, false],
      ['7+5=12', SIGNS, false],
      ['', SIGNS, false],
    ];
    for (const [key, spec, allowed] of cases) {
      expect(isProblemOf(key, spec), key).toBe(allowed);
    }
  });

  it('příklad, který do záznamu hry nepatří, se nezapíše', () => {
    expect(recordMistake(EMPTY_MISTAKES, SUNDAY, '7?5=2', EQUATIONS)).toBe(EMPTY_MISTAKES);
    expect(recordSolvedOperation(EMPTY_MISTAKES, SUNDAY, 'plus', true, SIGNS)).toBe(EMPTY_MISTAKES);
  });

  it('hra bez druhů příkladů ukládá jen nápovědu a chyby: „{"h":0,"w":[["7?5",1]]}“', () => {
    const record = recordMistake(EMPTY_MISTAKES, SUNDAY, '7?5', SIGNS);
    const saved = serializeMistakes(record);
    expect(saved).toBe(`{"days":{"${dayKeyOf(SUNDAY)}":{"h":0,"w":[["7?5",1]]}}}`);
    expect(parseMistakes(saved, SIGNS)).toEqual(record);
  });
});

describe('#192 AC3: dnešní záznamy Počítání zůstanou čitelné', () => {
  it('záznam uložený Počítáním před #192 menu přečte beze změny klíčů i tvaru', () => {
    const day = dayKeyOf(SUNDAY);
    const storage = memory({
      [ACTIVITY_KEY]: JSON.stringify({ days: { [day]: [12, 8] } }),
      [MISTAKES_KEY]: JSON.stringify({
        days: {
          [day]: {
            p: [9, 6],
            m: [3, 2],
            h: 2,
            w: [
              ['8+5', 3],
              ['9-3', 2],
            ],
          },
        },
      }),
    });
    const shown = readGameOverview(storage, EQUATIONS, SUNDAY);
    expect(shown.week.totalSolved).toBe(12);
    expect(shown.week.totalFirstTry).toBe(8);
    expect(shown.mistakes).toEqual({
      operations: [
        { operation: 'plus', solved: 9, firstTry: 6, percent: 66 },
        { operation: 'minus', solved: 3, firstTry: 2, percent: 66 },
      ],
      frequent: [
        { problem: '8+5', mistakes: 3 },
        { problem: '9-3', mistakes: 2 },
      ],
      hintsUsed: 2,
    });
  });

  it('zápis po #192 má stejný tvar jako před ním', () => {
    const storage = memory();
    const log = createActivityLog({ storage, spec: EQUATIONS, today: () => SUNDAY });
    log.solved(true, 'plus');
    log.mistake('8+5');
    log.hintUsed();
    const day = dayKeyOf(SUNDAY);
    expect(storage.data.get(ACTIVITY_KEY)).toBe(`{"days":{"${day}":[1,1]}}`);
    expect(storage.data.get(MISTAKES_KEY)).toBe(
      `{"days":{"${day}":{"p":[1,1],"m":[0,0],"h":1,"w":[["8+5",1]]}}}`,
    );
  });

  it('čtení přehledu nic nezapíše', () => {
    const storage = memory();
    const writes: string[] = [];
    const watched: KeyValueStorage = {
      getItem: (key) => storage.getItem(key),
      setItem: (key, value) => {
        writes.push(key);
        storage.setItem(key, value);
      },
    };
    readGameOverview(watched, EQUATIONS, SUNDAY);
    readGameOverview(undefined, SIGNS, SUNDAY);
    expect(writes).toEqual([]);
  });

  it('nečitelné úložiště nebo žádné dá prázdný přehled bez chyby', () => {
    const broken: KeyValueStorage = {
      getItem: () => {
        throw new Error('úložiště zakázáno');
      },
      setItem: () => {
        throw new Error('úložiště zakázáno');
      },
    };
    for (const storage of [broken, undefined]) {
      const shown = readGameOverview(storage, EQUATIONS, SUNDAY);
      expect(shown.week.isEmpty).toBe(true);
      expect(shown.mistakes).toEqual(mistakeOverview(EMPTY_MISTAKES, SUNDAY, EQUATIONS));
      const log = createActivityLog({ storage, spec: EQUATIONS, today: () => SUNDAY });
      expect(() => {
        log.solved(false, 'minus');
        log.mistake('9-3');
        log.hintUsed();
      }).not.toThrow();
    }
  });
});
