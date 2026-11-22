import { describe, expect, it } from 'vitest';

import {
  EMPTY_ACTIVITY,
  MAX_ACTIVITY_RECORD_BYTES,
  MAX_SOLVED_PER_DAY,
  OVERVIEW_DAY_COUNT,
  dayKeyOf,
  parseActivity,
  recordSolvedProblem,
  serializeActivity,
  weekOverview,
} from '../../src/shared/logic/weekActivity';
import type { ActivityRecord } from '../../src/shared/logic/weekActivity';

/**
 * Testy logiky přehledu 7 dní (#183), od #192 ve sdílené části, protože ji
 * používají všechny hry s přehledem a čte ji menu. Datum „dnes“ dostane
 * každá funkce zvenku. Jak záznam zapisuje Počítání, je
 * v `tests/games/counting/weekOverview.test.ts`, Znaménka
 * v `tests/games/compare/compareOverview.test.ts`.
 */

/** Neděle 22. 11. 2026 v poledne podle kalendáře zařízení. */
const SUNDAY = new Date(2026, 10, 22, 12, 0, 0);

function daysAfter(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days, 12, 0, 0);
}

function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

describe('#183 AC2: přehled ukazuje 7 dní včetně dneška', () => {
  it('bez hraní je 7 dní od pondělí do dnešní neděle a všechny mají 0', () => {
    const overview = weekOverview(EMPTY_ACTIVITY, SUNDAY);
    expect(overview.days).toHaveLength(OVERVIEW_DAY_COUNT);
    expect(overview.days.map((day) => day.key)).toEqual([
      '2026-11-16',
      '2026-11-17',
      '2026-11-18',
      '2026-11-19',
      '2026-11-20',
      '2026-11-21',
      '2026-11-22',
    ]);
    expect(overview.days.map((day) => day.weekday)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(overview.days.every((day) => day.solved === 0 && day.firstTry === 0)).toBe(true);
    expect(overview.days.map((day) => day.isToday)).toEqual([
      false,
      false,
      false,
      false,
      false,
      false,
      true,
    ]);
  });

  it('ve středu začíná přehled ve čtvrtek minulého týdne a končí dnešní středou', () => {
    const wednesday = new Date(2026, 10, 25, 8, 0, 0);
    const overview = weekOverview(EMPTY_ACTIVITY, wednesday);
    expect(overview.days.map((day) => day.weekday)).toEqual([3, 4, 5, 6, 0, 1, 2]);
    expect(overview.days[6]?.key).toBe('2026-11-25');
  });

  it('dny přes konec měsíce a roku jdou podle kalendáře', () => {
    const newYear = new Date(2027, 0, 2, 9, 0, 0);
    expect(weekOverview(EMPTY_ACTIVITY, newYear).days.map((day) => day.key)).toEqual([
      '2026-12-27',
      '2026-12-28',
      '2026-12-29',
      '2026-12-30',
      '2026-12-31',
      '2027-01-01',
      '2027-01-02',
    ]);
  });

  it('záznam má nejvýš 1 kB, i když dítě hraje každý den nejvíc příkladů, kolik se počítá', () => {
    let record: ActivityRecord = EMPTY_ACTIVITY;
    for (let day = 0; day < 30; day += 1) {
      const date = daysAfter(SUNDAY, day);
      // Plný den: nejvíc příkladů, všechny napoprvé.
      record = {
        ...record,
        [dayKeyOf(date)]: { solved: MAX_SOLVED_PER_DAY, firstTry: MAX_SOLVED_PER_DAY },
      };
      record = recordSolvedProblem(record, date, true);
      expect(byteLength(serializeActivity(record)), `den ${day}`).toBeLessThanOrEqual(
        MAX_ACTIVITY_RECORD_BYTES,
      );
      expect(Object.keys(record).length, `den ${day}`).toBeLessThanOrEqual(OVERVIEW_DAY_COUNT);
    }
    expect(MAX_ACTIVITY_RECORD_BYTES).toBe(1024);
  });

  it('nad nejvyšší počet za den se už nepřičítá, záznam nepřeroste', () => {
    const full: ActivityRecord = {
      [dayKeyOf(SUNDAY)]: { solved: MAX_SOLVED_PER_DAY, firstTry: 5 },
    };
    const after = recordSolvedProblem(full, SUNDAY, true);
    expect(after[dayKeyOf(SUNDAY)]).toEqual({ solved: MAX_SOLVED_PER_DAY, firstTry: 5 });
  });
});

describe('#183 AC6: poškozený záznam dá prázdný přehled', () => {
  it('chybějící nebo prázdný záznam je prázdný přehled', () => {
    for (const missing of [null, undefined, '']) {
      expect(weekOverview(parseActivity(missing), SUNDAY).isEmpty).toBe(true);
    }
  });
});

describe('#183 AC6: den z budoucnosti se nezapočítá', () => {
  it('příklady uložené se zítřejším datem (hodiny se vrátily) přehled nepočítá', () => {
    const tomorrow = dayKeyOf(daysAfter(SUNDAY, 1));
    const record = parseActivity(JSON.stringify({ days: { [tomorrow]: [8, 8] } }));
    const overview = weekOverview(record, SUNDAY);
    expect(overview.isEmpty).toBe(true);
    expect(overview.totalSolved).toBe(0);
    expect(overview.days.map((day) => day.key)).not.toContain(tomorrow);
  });

  it('při zápisu se den z budoucnosti zahodí', () => {
    const future = dayKeyOf(daysAfter(SUNDAY, 2));
    const record = parseActivity(JSON.stringify({ days: { [future]: [9, 9] } }));
    const after = recordSolvedProblem(record, SUNDAY, false);
    expect(Object.keys(after)).toEqual([dayKeyOf(SUNDAY)]);
    expect(after[dayKeyOf(SUNDAY)]).toEqual({ solved: 1, firstTry: 0 });
  });
});
