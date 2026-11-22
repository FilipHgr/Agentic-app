import { describe, expect, it } from 'vitest';

import { COMPARE_META, COMPARE_OVERVIEW } from '../../../src/games/compare/meta';
import { allProblems, allRelationProblems } from '../../../src/games/compare/logic/compareProblems';
import type { CompareProblem } from '../../../src/games/compare/logic/compareProblems';
import {
  MAX_NUMBER_OPTIONS,
  serializeCompareSettings,
} from '../../../src/games/compare/logic/compareSettings';
import type { CompareSettings } from '../../../src/games/compare/logic/compareSettings';
import { COMPARE_SETTINGS_KEY } from '../../../src/games/compare/storage/settingsStorage';
import {
  MAX_MISTAKE_RECORD_BYTES,
  MAX_MISTAKEN_PROBLEMS_PER_DAY,
  MAX_MISTAKES_PER_PROBLEM,
  EMPTY_MISTAKES,
  parseMistakes,
  recordMistake,
  serializeMistakes,
} from '../../../src/shared/logic/mistakeActivity';
import {
  comparisonKey,
  formatOverviewProblem,
  isProblemOf,
  missingSignKey,
} from '../../../src/shared/logic/overviewProblems';
import { MAX_ACTIVITY_RECORD_BYTES, dayKeyOf } from '../../../src/shared/logic/weekActivity';
import { PROFILE_COLORS } from '../../../src/shared/logic/profiles';
import {
  ACTIVITY_KEY,
  MISTAKES_KEY,
  readGameOverview,
} from '../../../src/shared/storage/activityStorage';
import type { GameOverview } from '../../../src/shared/storage/activityStorage';
import { openProfiles } from '../../../src/shared/storage/profileStorage';
import { DeviceStorage, profileDataKeys } from '../../shared/profileFixtures';
import { MemoryStorage, openCompare, rightSign, solveProblem, wrongSign } from './compareFakes';
import type { TestCompare } from './compareFakes';

/**
 * Testy k #192 AC4: Znaménka zapisují do přehledu pro rodiče stejně jako
 * Počítání vyřešené příklady, kolik z nich napoprvé a chyby (limity 1 kB
 * a 4 kB, 7 dní, poškozený záznam = prázdný přehled). Co rodič uvidí, čte
 * menu z úložiště hry přes sdílenou logiku (`readGameOverview`) s popisem
 * přehledu z `meta.ts`; tak to čtou i testy. Chyba je každé ťuknutí nebo
 * potvrzené napsané znaménko, které do okénka nepatří; ťuknutí na prázdné
 * okénko a nerozpoznaný zápis chyba nejsou. Napoprvé = bez chyby (Znaménka
 * nápovědu nemají).
 */

/** Neděle 22. 11. 2026 v poledne podle kalendáře zařízení. */
const SUNDAY = new Date(2026, 10, 22, 12, 0, 0);

function daysAfter(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days, 12, 0, 0);
}

/** Úložiště s nastavením Znamének: rozsah do 20 a obě řady znamének. */
function storageWith(settings: Partial<CompareSettings> = {}): MemoryStorage {
  const storage = new MemoryStorage();
  storage.data.set(
    COMPARE_SETTINGS_KEY,
    serializeCompareSettings({
      maxNumber: 20,
      answerInput: 'tap',
      signKind: 'all',
      ...settings,
    }),
  );
  return storage;
}

/** Hra a co z ní rodič uvidí v přehledu v menu. */
interface OverviewCompare extends TestCompare {
  shown(): GameOverview;
}

function play(storage: MemoryStorage | undefined, clock: { today: Date }, seed?: number) {
  const test = openCompare(storage, seed, undefined, () => clock.today);
  const result: OverviewCompare = {
    ...test,
    shown: () => readGameOverview(storage, COMPARE_OVERVIEW, clock.today),
  };
  return result;
}

/** Příklad v záznamu chyb, jak ho rodič uvidí: „7 ☐ 5 = 2“ nebo „7 ☐ 5“. */
function keyOf(problem: CompareProblem): string {
  return problem.kind === 'relation'
    ? comparisonKey(problem.a, problem.b)
    : missingSignKey(problem.a, problem.b, problem.result);
}

function todayOf(test: OverviewCompare): { solved: number; firstTry: number } {
  const today = test.shown().week.days.at(-1);
  return { solved: today?.solved ?? -1, firstTry: today?.firstTry ?? -1 };
}

function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

describe('#192 AC4: Znaménka zapisují vyřešené příklady a napoprvé', () => {
  it('po třech příkladech napoprvé ukáže přehled u dneška 3 a z toho 3 napoprvé', () => {
    const test = play(storageWith(), { today: SUNDAY });
    solveProblem(test);
    solveProblem(test);
    solveProblem(test);
    expect(todayOf(test)).toEqual({ solved: 3, firstTry: 3 });
  });

  it('příklad vyřešený po špatném znaménku se přičte, ale ne mezi napoprvé', () => {
    const test = play(storageWith(), { today: SUNDAY });
    expect(test.session.tap(wrongSign(test))).toBe('wrong');
    expect(test.session.tap(rightSign(test))).toBe('correct');
    test.timers.runAll();
    expect(todayOf(test)).toEqual({ solved: 1, firstTry: 0 });
  });

  it('špatné znaménko samo o sobě nic nepřičte, další příklad je zase napoprvé', () => {
    const test = play(storageWith(), { today: SUNDAY });
    test.session.tap(wrongSign(test));
    expect(todayOf(test)).toEqual({ solved: 0, firstTry: 0 });
    solveProblem(test);
    solveProblem(test);
    expect(todayOf(test)).toEqual({ solved: 2, firstTry: 1 });
  });

  it('ťuknutí na prázdné okénko ani nerozpoznaný zápis chyba nejsou', () => {
    const test = play(storageWith(), { today: SUNDAY });
    const problem = test.session.problem();
    test.session.tapBox();
    test.session.writingRejected();
    test.session.tapBox();
    solveProblem(test);
    expect(todayOf(test)).toEqual({ solved: 1, firstTry: 1 });
    expect(test.shown().mistakes.frequent.map((item) => item.problem)).not.toContain(
      keyOf(problem),
    );
  });

  it('ťuknutí během přechodu na další příklad se nezapíše', () => {
    const test = play(storageWith(), { today: SUNDAY });
    test.session.tap(rightSign(test));
    test.session.tap(wrongSign(test));
    test.session.tap(rightSign(test));
    test.timers.runAll();
    expect(todayOf(test)).toEqual({ solved: 1, firstTry: 1 });
  });

  it('vyřešené příklady zůstanou po zavření a novém otevření hry', () => {
    const storage = storageWith();
    const clock = { today: SUNDAY };
    solveProblem(play(storage, clock));
    const again = play(storage, clock);
    solveProblem(again);
    expect(todayOf(again)).toEqual({ solved: 2, firstTry: 2 });
  });

  it('přehled ukazuje 7 dní včetně dneška, starší dny se nepočítají', () => {
    const storage = storageWith();
    const clock = { today: daysAfter(SUNDAY, -7) };
    solveProblem(play(storage, clock));
    clock.today = daysAfter(SUNDAY, -6);
    solveProblem(play(storage, clock));
    clock.today = SUNDAY;
    const test = play(storage, clock);
    expect(test.shown().week.days).toHaveLength(7);
    expect(test.shown().week.days[0]?.solved).toBe(1);
    expect(test.shown().week.totalSolved).toBe(1);
  });
});

describe('#192 AC4: Znaménka zapisují chyby u příkladů', () => {
  it('po dvou špatných znaménkách u „a ☐ b = c“ rodič vidí příklad se 2 chybami', () => {
    const test = play(storageWith({ signKind: 'plusMinus' }), { today: SUNDAY });
    const problem = test.session.problem();
    test.session.tap(wrongSign(test));
    test.session.tap(wrongSign(test));
    solveProblem(test);
    expect(test.shown().mistakes.frequent).toEqual([{ problem: keyOf(problem), mistakes: 2 }]);
    expect(formatOverviewProblem(keyOf(problem))).toMatch(/^\d+ ☐ \d+ = \d+$/);
  });

  it('u „a ☐ b“ se chyba zapíše jako „7 ☐ 5“', () => {
    const test = play(storageWith({ signKind: 'comparison' }), { today: SUNDAY });
    const problem = test.session.problem();
    expect(problem.kind).toBe('relation');
    test.session.tap(wrongSign(test));
    test.session.tap(wrongSign(test));
    expect(test.shown().mistakes.frequent).toEqual([{ problem: keyOf(problem), mistakes: 2 }]);
    expect(formatOverviewProblem(keyOf(problem))).toBe(`${problem.a} ☐ ${problem.b}`);
  });

  it('chyby z různých dnů se sečtou a starší než 7 dní se nepočítají', () => {
    const storage = storageWith({ signKind: 'comparison' });
    const clock = { today: daysAfter(SUNDAY, -8) };
    const old = play(storage, clock, 5);
    const problem = old.session.problem();
    old.session.tap(wrongSign(old));
    old.session.tap(wrongSign(old));
    clock.today = SUNDAY;
    const test = play(storage, clock, 5);
    expect(test.shown().mistakes.frequent).toEqual([]);
    expect(keyOf(test.session.problem())).toBe(keyOf(problem));
    test.session.tap(wrongSign(test));
    clock.today = daysAfter(SUNDAY, 1);
    const tomorrow = play(storage, clock, 5);
    tomorrow.session.tap(wrongSign(tomorrow));
    expect(tomorrow.shown().mistakes.frequent).toEqual([{ problem: keyOf(problem), mistakes: 2 }]);
  });

  it('Znaménka nemají nápovědu ani druhy příkladů, stránka Chyby je jen o chybách', () => {
    const test = play(storageWith(), { today: SUNDAY });
    for (let index = 0; index < 10; index += 1) {
      test.session.tap(wrongSign(test));
      solveProblem(test);
    }
    const shown = test.shown().mistakes;
    expect(shown.operations).toEqual([]);
    expect(shown.hintsUsed).toBe(0);
    expect(COMPARE_OVERVIEW.hints).toBe(false);
  });
});

describe('#192 AC4: limity záznamu Znamének jsou stejné jako v Počítání', () => {
  it('popis přehledu v meta.ts pokrývá nejvyšší rozsah a každý příklad, který hra může dát', () => {
    expect(COMPARE_META.overview).toBe(COMPARE_OVERVIEW);
    expect(COMPARE_OVERVIEW.maxNumber).toBe(Math.max(...MAX_NUMBER_OPTIONS));
    const problems = [...allProblems(20), ...allRelationProblems(20)];
    const refused = problems.map(keyOf).filter((key) => !isProblemOf(key, COMPARE_OVERVIEW));
    expect(refused).toEqual([]);
  });

  it('7 dní po 30 příkladech s nejdelším zápisem a nejvíc chybami se vejde do 4 kB', () => {
    const longest = allProblems(20)
      .map(keyOf)
      .sort((a, b) => b.length - a.length)
      .slice(0, MAX_MISTAKEN_PROBLEMS_PER_DAY);
    let record = EMPTY_MISTAKES;
    for (let offset = -6; offset <= 0; offset += 1) {
      for (const problem of longest) {
        for (let mistake = 0; mistake < MAX_MISTAKES_PER_PROBLEM; mistake += 1) {
          record = recordMistake(record, daysAfter(SUNDAY, offset), problem, COMPARE_OVERVIEW);
        }
      }
    }
    const saved = serializeMistakes(record);
    expect(byteLength(saved)).toBeLessThanOrEqual(MAX_MISTAKE_RECORD_BYTES);
    expect(parseMistakes(saved, COMPARE_OVERVIEW)).toEqual(record);
  });

  it('uložené záznamy ze hry mají nejvýš 1 kB a 4 kB i po týdnech hraní s chybami', () => {
    const storage = storageWith();
    const clock = { today: SUNDAY };
    for (let day = 0; day < 20; day += 1) {
      clock.today = daysAfter(SUNDAY, day);
      const test = play(storage, clock, day);
      for (let index = 0; index < 40; index += 1) {
        for (let mistake = 0; mistake < index % 3; mistake += 1) {
          test.session.tap(wrongSign(test));
        }
        solveProblem(test);
      }
      test.session.leave();
    }
    expect(byteLength(storage.data.get(ACTIVITY_KEY) ?? '')).toBeLessThanOrEqual(
      MAX_ACTIVITY_RECORD_BYTES,
    );
    const mistakes = storage.data.get(MISTAKES_KEY) ?? '';
    expect(mistakes).not.toBe('');
    expect(byteLength(mistakes)).toBeLessThanOrEqual(MAX_MISTAKE_RECORD_BYTES);
    expect(Object.keys(parseMistakes(mistakes, COMPARE_OVERVIEW)).length).toBeLessThanOrEqual(7);
  });
});

describe('#192 AC4: poškozený záznam Znamének dá prázdný přehled', () => {
  const day = dayKeyOf(SUNDAY);
  const valid = { h: 0, w: [['7?5=2', 2]] };
  const corruptDays: readonly unknown[] = [
    { ...valid, w: [['7?5=3', 2]] },
    { ...valid, w: [['7?0=7', 2]] },
    { ...valid, w: [['21?1', 2]] },
    { ...valid, w: [['7+5', 2]] },
    { ...valid, w: [['7?5=', 2]] },
    { ...valid, w: [['7<5', 2]] },
    { ...valid, h: -1 },
    { w: valid.w },
  ];

  it('platný záznam se přečte', () => {
    const record = parseMistakes(JSON.stringify({ days: { [day]: valid } }), COMPARE_OVERVIEW);
    expect(record[day]?.problems).toEqual([{ problem: '7?5=2', mistakes: 2 }]);
  });

  it('každý poškozený den nebo příklad, který hra nemůže dát, dá prázdný přehled', () => {
    for (const corrupt of corruptDays) {
      const saved = JSON.stringify({ days: { [day]: corrupt } });
      expect(parseMistakes(saved, COMPARE_OVERVIEW), saved).toEqual(EMPTY_MISTAKES);
    }
  });

  it('s poškozenými záznamy hra běží, přehled je prázdný a první příklad začne nový záznam', () => {
    for (const corrupt of ['{', 'null', '{"days":{"2026-11-22":[3,4]}}']) {
      const storage = storageWith();
      storage.data.set(ACTIVITY_KEY, corrupt);
      storage.data.set(MISTAKES_KEY, corrupt);
      const test = play(storage, { today: SUNDAY });
      expect(test.shown().week.isEmpty, corrupt).toBe(true);
      expect(test.shown().mistakes.frequent, corrupt).toEqual([]);
      test.session.tap(wrongSign(test));
      test.session.tap(wrongSign(test));
      solveProblem(test);
      expect(todayOf(test), corrupt).toEqual({ solved: 1, firstTry: 0 });
      expect(test.shown().mistakes.frequent.length, corrupt).toBe(1);
    }
  });

  it('s plným nebo zakázaným úložištěm hra běží bez chyby', () => {
    for (const fail of ['reads', 'writes'] as const) {
      const storage = storageWith();
      storage.failReads = fail === 'reads';
      storage.failWrites = true;
      const test = play(storage, { today: SUNDAY });
      expect(() => {
        test.session.tap(wrongSign(test));
        solveProblem(test);
      }, fail).not.toThrow();
      expect(test.session.starCount(), fail).toBe(1);
    }
  });
});

describe('#192 AC3: záznamy Znamének jsou jen v zařízení podle profilu', () => {
  it('ukládají se pod vnitřním označením profilu, nikdy s přezdívkou, a se smazáním profilu zmizí', () => {
    const device = new DeviceStorage();
    const store = openProfiles(device);
    const keeper = store.activeProfile();
    const child = store.createProfile({ nickname: 'ZUZANA', color: PROFILE_COLORS[2] });
    store.selectProfile(child.id);
    const test = openCompare(
      store.gameStorage(COMPARE_META.id),
      undefined,
      undefined,
      () => SUNDAY,
    );
    test.session.tap(wrongSign(test));
    solveProblem(test);

    const keys = [...device.data.keys()].filter(
      (key) => key.endsWith(ACTIVITY_KEY) || key.endsWith(MISTAKES_KEY),
    );
    expect(keys).toHaveLength(2);
    for (const key of keys) {
      expect(profileDataKeys(device, child.id)).toContain(key);
      expect(key).not.toContain('ZUZANA');
      expect(device.data.get(key)).not.toContain('ZUZANA');
    }

    store.selectProfile(keeper.id);
    const other = readGameOverview(store.gameStorage(COMPARE_META.id), COMPARE_OVERVIEW, SUNDAY);
    expect(other.week.isEmpty).toBe(true);
    expect(store.deleteProfile(child.id)).toBe(true);
    expect(
      [...device.data.keys()].some(
        (key) => key.endsWith(ACTIVITY_KEY) || key.endsWith(MISTAKES_KEY),
      ),
    ).toBe(false);
  });
});
