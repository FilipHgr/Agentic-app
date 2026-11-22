import { describe, expect, it } from 'vitest';

import {
  EMPTY_MISTAKES,
  MAX_MISTAKEN_PROBLEMS_PER_DAY,
  MAX_MISTAKES_PER_PROBLEM,
  MAX_MISTAKE_RECORD_BYTES,
  mistakeOverview as sharedMistakeOverview,
  parseMistakes as sharedParseMistakes,
  recordHintUsed as sharedRecordHintUsed,
  recordMistake as sharedRecordMistake,
  recordSolvedOperation as sharedRecordSolvedOperation,
  serializeMistakes,
} from '../../src/shared/logic/mistakeActivity';
import type {
  MistakeOverview,
  MistakeRecord,
  MistakenProblem,
} from '../../src/shared/logic/mistakeActivity';
import { equationKey, formatOverviewProblem } from '../../src/shared/logic/overviewProblems';
import type { GameOverviewSpec, OverviewOperation } from '../../src/shared/logic/overviewProblems';
import { dayKeyOf } from '../../src/shared/logic/weekActivity';

/**
 * Testy logiky přehledu chyb (#184), od #192 ve sdílené části, protože ji
 * používají všechny hry s přehledem a čte ji menu. Zkouší se na příkladech
 * se sčítáním a odčítáním do 20, jak je zapisuje Počítání (popis přehledu
 * jako v jeho `meta.ts`). Jak záznam zapisuje Počítání, je
 * v `tests/games/counting/mistakeOverview.test.ts`, Znaménka
 * v `tests/games/compare/compareOverview.test.ts`.
 */

/** Neděle 22. 11. 2026 v poledne podle kalendáře zařízení. */
const SUNDAY = new Date(2026, 10, 22, 12, 0, 0);

/** Popis přehledu se sčítáním a odčítáním do 20 a nápovědou (jako Počítání). */
const EQUATIONS: GameOverviewSpec = {
  maxNumber: 20,
  problemForms: ['equation'],
  operations: ['plus', 'minus'],
  hints: true,
};

interface Problem {
  readonly first: number;
  readonly second: number;
  readonly operation: OverviewOperation;
}

function daysAfter(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days, 12, 0, 0);
}

function plus(first: number, second: number): Problem {
  return { first, second, operation: 'plus' };
}

function minus(first: number, second: number): Problem {
  return { first, second, operation: 'minus' };
}

function recordMistake(record: MistakeRecord, date: Date, problem: Problem): MistakeRecord {
  return sharedRecordMistake(
    record,
    date,
    equationKey(problem.first, problem.operation, problem.second),
    EQUATIONS,
  );
}

function recordSolvedOperation(
  record: MistakeRecord,
  date: Date,
  operation: OverviewOperation,
  firstTry: boolean,
): MistakeRecord {
  return sharedRecordSolvedOperation(record, date, operation, firstTry, EQUATIONS);
}

function recordHintUsed(record: MistakeRecord, date: Date): MistakeRecord {
  return sharedRecordHintUsed(record, date, EQUATIONS);
}

function mistakeOverview(record: MistakeRecord, date: Date): MistakeOverview {
  return sharedMistakeOverview(record, date, EQUATIONS);
}

function parseMistakes(saved: string | null | undefined): MistakeRecord {
  return sharedParseMistakes(saved, EQUATIONS);
}

/** Příklad s `mistakes` chybami, jak ho přehled vrátí. */
function mistaken(
  first: number,
  second: number,
  operation: OverviewOperation,
  mistakes: number,
): MistakenProblem {
  return { problem: equationKey(first, operation, second), mistakes };
}

/** Řádek časté chyby jako v menu česky: „8 + 5 (4×)“. */
function csLine(mistake: MistakenProblem): string {
  return `${formatOverviewProblem(mistake.problem)} (${mistake.mistakes}×)`;
}

/** Záznam, kde dítě v den `date` udělalo u příkladů chyby v daném pořadí. */
function mistakesOn(
  date: Date,
  problems: readonly Problem[],
  start = EMPTY_MISTAKES,
): MistakeRecord {
  return problems.reduce((record, problem) => recordMistake(record, date, problem), start);
}

/** Přehled bez čehokoli: žádný druh příkladů, žádné časté chyby ani nápověda. */
const NOTHING = { operations: [], frequent: [], hintsUsed: 0 };

function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

/**
 * Příklady s nejdelším zápisem („20 − 10“ má v záznamu 5 znaků), kolik
 * se jich za den do záznamu vejde.
 */
function longestProblems(): Problem[] {
  const problems: Problem[] = [];
  for (let first = 20; first >= 10; first -= 1) {
    for (let second = 10; second <= first; second += 1) {
      problems.push(minus(first, second));
    }
  }
  return problems.slice(0, MAX_MISTAKEN_PROBLEMS_PER_DAY);
}

describe('#184 AC2: podíl příkladů napoprvé zvlášť pro sčítání a odčítání', () => {
  it('podíl je zaokrouhlený dolů, 199 z 200 není 100 %', () => {
    let record = EMPTY_MISTAKES;
    for (let index = 0; index < 200; index += 1) {
      record = recordSolvedOperation(record, SUNDAY, 'minus', index !== 0);
    }
    expect(mistakeOverview(record, SUNDAY).operations).toEqual([
      { operation: 'minus', solved: 200, firstTry: 199, percent: 99 },
    ]);
  });

  it('druh hraný naposledy před víc než 7 dny se neukáže', () => {
    const old = recordSolvedOperation(EMPTY_MISTAKES, daysAfter(SUNDAY, -7), 'minus', true);
    const record = recordSolvedOperation(old, daysAfter(SUNDAY, -6), 'plus', false);
    expect(mistakeOverview(record, SUNDAY).operations).toEqual([
      { operation: 'plus', solved: 1, firstTry: 0, percent: 0 },
    ]);
  });
});

describe('#184 AC3: nejvýš 3 příklady s nejvíc chybami za 7 dní', () => {
  it('rodič vidí příklady seřazené od nejvíc chyb, nejvýš 3', () => {
    const record = mistakesOn(SUNDAY, [
      plus(8, 5),
      minus(9, 3),
      plus(8, 5),
      plus(2, 2),
      minus(9, 3),
      plus(8, 5),
      plus(6, 7),
      plus(6, 7),
      plus(2, 2),
      plus(8, 5),
    ]);
    const lines = mistakeOverview(record, SUNDAY).frequent.map(csLine);
    expect(lines).toEqual(['8 + 5 (4×)', '2 + 2 (2×)', '6 + 7 (2×)']);
  });

  it('příklad s jedinou chybou mezi častými není', () => {
    const record = mistakesOn(SUNDAY, [plus(3, 4), minus(7, 2), minus(7, 2)]);
    expect(mistakeOverview(record, SUNDAY).frequent).toEqual([mistaken(7, 2, 'minus', 2)]);
    expect(csLine(mistaken(7, 2, 'minus', 2))).toBe('7 − 2 (2×)');
  });

  it('chyby u stejného příkladu z různých dnů se sečtou', () => {
    const monday = mistakesOn(daysAfter(SUNDAY, -6), [plus(4, 4)]);
    const record = mistakesOn(daysAfter(SUNDAY, -2), [plus(4, 4)], monday);
    expect(mistakeOverview(record, SUNDAY).frequent).toEqual([mistaken(4, 4, 'plus', 2)]);
  });

  it('chyby starší než 7 dní se nepočítají', () => {
    const old = mistakesOn(daysAfter(SUNDAY, -7), [plus(4, 4), plus(4, 4)]);
    const record = mistakesOn(SUNDAY, [plus(4, 4)], old);
    expect(mistakeOverview(record, SUNDAY).frequent).toEqual([]);
  });

  it('při stejném počtu chyb je výš příklad, ve kterém se dítě spletlo naposledy', () => {
    const record = mistakesOn(SUNDAY, [plus(1, 2), plus(3, 3), plus(1, 2), plus(3, 3)]);
    expect(mistakeOverview(record, SUNDAY).frequent.map(csLine)).toEqual([
      '3 + 3 (2×)',
      '1 + 2 (2×)',
    ]);
    const later = recordMistake(record, SUNDAY, plus(3, 3));
    const evened = recordMistake(later, SUNDAY, plus(1, 2));
    expect(mistakeOverview(evened, SUNDAY).frequent.map(csLine)).toEqual([
      '1 + 2 (3×)',
      '3 + 3 (3×)',
    ]);
  });

  it('při shodě rozhodne poslední chyba i přes víc dní: dnešní chyba je novější než včerejší', () => {
    const saturday = mistakesOn(daysAfter(SUNDAY, -1), [plus(5, 5), plus(5, 5), plus(2, 3)]);
    const record = mistakesOn(SUNDAY, [plus(2, 3)], saturday);
    expect(mistakeOverview(record, SUNDAY).frequent.map(csLine)).toEqual([
      '2 + 3 (2×)',
      '5 + 5 (2×)',
    ]);
  });

  it('při shodě o 4. místo zůstane mezi třemi ten s novější chybou', () => {
    const record = mistakesOn(SUNDAY, [
      plus(1, 1),
      plus(1, 1),
      plus(2, 2),
      plus(2, 2),
      plus(3, 3),
      plus(3, 3),
      plus(4, 4),
      plus(4, 4),
    ]);
    expect(mistakeOverview(record, SUNDAY).frequent.map(csLine)).toEqual([
      '4 + 4 (2×)',
      '3 + 3 (2×)',
      '2 + 2 (2×)',
    ]);
  });

  it('sčítání a odčítání se stejnými čísly jsou různé příklady', () => {
    const record = mistakesOn(SUNDAY, [plus(6, 3), minus(6, 3), plus(6, 3), minus(6, 3)]);
    expect(mistakeOverview(record, SUNDAY).frequent.map(csLine)).toEqual([
      '6 − 3 (2×)',
      '6 + 3 (2×)',
    ]);
  });
});

describe('#184 AC4: bez častých chyb rodič vidí „Bez častých chyb“', () => {
  it('bez chyb nebo jen s jednou chybou na příklad nejsou žádné časté chyby', () => {
    expect(mistakeOverview(EMPTY_MISTAKES, SUNDAY).frequent).toEqual([]);
    const record = mistakesOn(SUNDAY, [plus(1, 1), plus(2, 1), minus(3, 1)]);
    expect(mistakeOverview(record, SUNDAY).frequent).toEqual([]);
    // Chyby se zapsaly: druhá chyba u stejného příkladu z něj udělá častou.
    const again = recordMistake(record, SUNDAY, minus(3, 1));
    expect(mistakeOverview(again, SUNDAY).frequent).toEqual([mistaken(3, 1, 'minus', 2)]);
  });
});

describe('#184 AC5: kolikrát dítě za týden použilo nápovědu', () => {
  it('nápověda se sečte za 7 dní, starší se nepočítá', () => {
    let record = EMPTY_MISTAKES;
    for (const offset of [-8, -7, -6, -3, -3, 0]) {
      record = recordHintUsed(record, daysAfter(SUNDAY, offset));
    }
    expect(mistakeOverview(record, SUNDAY).hintsUsed).toBe(4);
  });
});

describe('#184 AC6: u každého dne nejvýš 30 příkladů s chybou', () => {
  it('31. příklad s chybou za den vytlačí ten s nejméně chybami, při shodě nejstarší', () => {
    let record = EMPTY_MISTAKES;
    // 30 různých příkladů po jedné chybě, 1 + 0 (nejstarší) nakonec ještě jednou.
    record = mistakesOn(SUNDAY, [plus(1, 0)], record);
    for (let index = 0; index < MAX_MISTAKEN_PROBLEMS_PER_DAY - 1; index += 1) {
      record = recordMistake(record, SUNDAY, plus(2 + Math.floor(index / 5), index % 5));
    }
    record = recordMistake(record, SUNDAY, plus(1, 0));
    const day = record[dayKeyOf(SUNDAY)];
    expect(day?.problems).toHaveLength(MAX_MISTAKEN_PROBLEMS_PER_DAY);

    record = recordMistake(record, SUNDAY, minus(9, 9));
    const after = record[dayKeyOf(SUNDAY)]?.problems ?? [];
    expect(after).toHaveLength(MAX_MISTAKEN_PROBLEMS_PER_DAY);
    const kept = after.map((problem) => problem.problem);
    // Vypadl 2 + 0 (jedna chyba, nejstarší), 1 + 0 se dvěma chybami zůstal.
    expect(kept).not.toContain('2+0');
    expect(kept).toContain('1+0');
    expect(kept).toContain('9-9');
    expect(kept).toContain('2+1');
  });

  it('počet chyb u jednoho příkladu za den se zastaví na nejvyšší hodnotě', () => {
    let record = EMPTY_MISTAKES;
    for (let mistake = 0; mistake < MAX_MISTAKES_PER_PROBLEM + 5; mistake += 1) {
      record = recordMistake(record, SUNDAY, plus(8, 5));
    }
    expect(mistakeOverview(record, SUNDAY).frequent[0]?.mistakes).toBe(MAX_MISTAKES_PER_PROBLEM);
  });
});

describe('#184 AC6: záznam má nejvýš 4 kB', () => {
  it('7 dní po 30 příkladech s nejvíc chybami, nejdelšími čísly a nejvyššími počty se vejde do 4 kB', () => {
    let record = EMPTY_MISTAKES;
    for (let offset = -6; offset <= 0; offset += 1) {
      const date = daysAfter(SUNDAY, offset);
      for (const problem of longestProblems()) {
        for (let mistake = 0; mistake < MAX_MISTAKES_PER_PROBLEM; mistake += 1) {
          record = recordMistake(record, date, problem);
        }
      }
      for (let solved = 0; solved < 9999; solved += 1) {
        record = recordSolvedOperation(record, date, 'plus', true);
        record = recordSolvedOperation(record, date, 'minus', true);
        record = recordHintUsed(record, date);
      }
    }
    const saved = serializeMistakes(record);
    expect(byteLength(saved)).toBeLessThanOrEqual(MAX_MISTAKE_RECORD_BYTES);
    expect(Object.keys(record)).toHaveLength(7);
    // Uložený záznam jde přečíst zpátky beze ztráty.
    expect(parseMistakes(saved)).toEqual(record);
  });

  it('starší dny se při zápisu zahodí', () => {
    const old = mistakesOn(daysAfter(SUNDAY, -9), [plus(2, 2)]);
    const record = recordMistake(old, SUNDAY, plus(3, 3));
    expect(Object.keys(record)).toEqual([dayKeyOf(SUNDAY)]);
  });
});

describe('#184 AC6: poškozený záznam dá prázdný přehled chyb', () => {
  it('chybějící nebo prázdný záznam je prázdný přehled', () => {
    for (const missing of [null, undefined, '']) {
      expect(mistakeOverview(parseMistakes(missing), SUNDAY)).toEqual(NOTHING);
    }
  });
});

describe('#184 AC6: den z budoucnosti se nezapočítá', () => {
  it('chyby uložené se zítřejším datem (hodiny se vrátily) přehled nepočítá', () => {
    const tomorrow = mistakesOn(daysAfter(SUNDAY, 1), [plus(8, 5), plus(8, 5)]);
    const withHint = recordHintUsed(tomorrow, daysAfter(SUNDAY, 1));
    expect(mistakeOverview(withHint, SUNDAY)).toEqual(NOTHING);
  });

  it('den z budoucnosti nepokazí dnešek a při zápisu se zahodí', () => {
    const future = daysAfter(SUNDAY, 3);
    const saved = serializeMistakes(mistakesOn(future, [plus(8, 5), plus(8, 5)]));
    const record = recordMistake(parseMistakes(saved), SUNDAY, plus(2, 2));
    expect(Object.keys(record)).toEqual([dayKeyOf(SUNDAY)]);
    expect(record[dayKeyOf(SUNDAY)]?.problems).toEqual([mistaken(2, 2, 'plus', 1)]);
    expect(mistakeOverview(record, SUNDAY).frequent).toEqual([]);
  });
});
