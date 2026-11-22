import { describe, expect, it } from 'vitest';

import { createCountingSession } from '../../../src/games/counting/logic/countingSession';
import type { CountingSession } from '../../../src/games/counting/logic/countingSession';
import {
  backToSettings,
  canConfirmSettings,
  openParentPanel,
  showOverview,
} from '../../../src/games/counting/logic/overviewPanel';
import { chooseOption, openSettings } from '../../../src/games/counting/logic/settingsSession';
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
} from '../../../src/games/counting/logic/weekActivity';
import type { ActivityRecord } from '../../../src/games/counting/logic/weekActivity';
import { ACTIVITY_KEY } from '../../../src/games/counting/storage/activityStorage';
import { COUNTING_META } from '../../../src/games/counting/meta';
import { PROFILE_COLORS } from '../../../src/shared/logic/profiles';
import { openProfiles } from '../../../src/shared/storage/profileStorage';
import type { ProfileStore } from '../../../src/shared/storage/profileStorage';
import type { KeyValueStorage } from '../../../src/shared/storage/keyValueStorage';
import { DeviceStorage, profileDataKeys } from '../../shared/profileFixtures';
import { seededRandom } from './seededRandom';
import {
  FakePage,
  FakeRecognizerLoader,
  FakeSounds,
  FakeTimers,
  FakeVoice,
  KEYPAD_SETTINGS,
  correctAnswerOf,
  solveProblems,
  testDevice,
  wrongAnswerOf,
} from './sessionFakes';
import type { TestSession } from './sessionFakes';
import { brokenStorage, memoryStorage, readOnlyStorage } from './storageFakes';

/**
 * Testy k #183: přehled pro rodiče, kolik dítě v Počítání vyřešilo za
 * posledních 7 dní. Datum „dnes“ dostane hra zvenku (`today`), aby šly
 * vyzkoušet přechody dnů, týdnů i den z budoucnosti bez skutečných hodin.
 * Rozložení a texty přehledu jsou v `overviewLayout.test.ts`.
 */

/** Neděle 22. 11. 2026 v poledne podle kalendáře zařízení. */
const SUNDAY = new Date(2026, 10, 22, 12, 0, 0);

function daysAfter(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days, 12, 0, 0);
}

/** Jeden vstup do Počítání nad úložištěm `storage` s dnešním dnem podle `clock`. */
function enterOn(
  storage: KeyValueStorage | undefined,
  clock: { today: Date },
  page = new FakePage(),
): TestSession & { readonly page: FakePage } {
  const timers = new FakeTimers();
  const recognizer = new FakeRecognizerLoader();
  const session = createCountingSession({
    storage,
    random: seededRandom(),
    sounds: new FakeSounds(),
    voice: new FakeVoice(),
    timers,
    page,
    loadRecognizer: recognizer.load,
    today: () => clock.today,
    onChange: () => undefined,
  });
  if (session.guideOpen()) {
    session.finishGuide(KEYPAD_SETTINGS);
  }
  return { session, timers, recognizer, page, changes: () => 0 };
}

/** Kolik přehled ukazuje u dneška (poslední sloupeček). */
function todayColumn(session: CountingSession): { solved: number; firstTry: number } {
  const days = session.weekOverview().days;
  const today = days[days.length - 1];
  if (today === undefined) {
    throw new Error('přehled nemá dnešní den');
  }
  return { solved: today.solved, firstTry: today.firstTry };
}

/** Dítě odpoví nejdřív špatně, pak správně. */
function solveAfterMistake(test: TestSession): void {
  test.session.tapAnswer(wrongAnswerOf(test.session));
  test.session.tapAnswer(correctAnswerOf(test.session));
  test.timers.runAll();
}

/** Dítě si ťukne o nápovědu a pak odpoví správně. */
function solveWithHint(test: TestSession): void {
  // Příklad bez teček (0 + 0) tlačítko nápovědy nemá: vyřeší se a zkusí se další.
  while (!test.session.tapHintButton()) {
    solveProblems(test, 1);
  }
  test.session.tapAnswer(correctAnswerOf(test.session));
  test.timers.runAll();
}

function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

// ---------------------------------------------------------------------------
// AC1: co se počítá
// ---------------------------------------------------------------------------

describe('#183 AC1: po vyřešení příkladu se u dneška přičte 1', () => {
  it('po třech vyřešených příkladech napoprvé ukáže přehled u dneška 3 a z toho 3 napoprvé', () => {
    const test = enterOn(memoryStorage(), { today: SUNDAY });
    solveProblems(test, 3);
    expect(todayColumn(test.session)).toEqual({ solved: 3, firstTry: 3 });
  });

  it('příklad vyřešený po chybě se přičte, ale ne mezi vyřešené napoprvé', () => {
    const test = enterOn(memoryStorage(), { today: SUNDAY });
    solveAfterMistake(test);
    expect(todayColumn(test.session)).toEqual({ solved: 1, firstTry: 0 });
  });

  it('příklad vyřešený s nápovědou se přičte, ale ne mezi vyřešené napoprvé', () => {
    const test = enterOn(memoryStorage(), { today: SUNDAY });
    solveWithHint(test);
    const { solved, firstTry } = todayColumn(test.session);
    expect(solved - firstTry).toBe(1);
  });

  it('po dvou chybách (nápověda se ukáže sama) se příklad přičte, ale ne napoprvé', () => {
    const test = enterOn(memoryStorage(), { today: SUNDAY });
    test.session.tapAnswer(wrongAnswerOf(test.session));
    test.session.tapAnswer(wrongAnswerOf(test.session));
    expect(test.session.hintVisible()).toBe(true);
    test.session.tapAnswer(correctAnswerOf(test.session));
    test.timers.runAll();
    expect(todayColumn(test.session)).toEqual({ solved: 1, firstTry: 0 });
  });

  it('špatná odpověď sama o sobě nic nepřičte', () => {
    const test = enterOn(memoryStorage(), { today: SUNDAY });
    test.session.tapAnswer(wrongAnswerOf(test.session));
    expect(todayColumn(test.session)).toEqual({ solved: 0, firstTry: 0 });
  });

  it('vyřešené příklady zůstanou po odchodu domečkem i po zavření hry', () => {
    const storage = memoryStorage();
    const first = enterOn(storage, { today: SUNDAY });
    solveProblems(first, 2);
    first.session.leave();
    const second = enterOn(storage, { today: SUNDAY });
    solveAfterMistake(second);
    // Hra se zavřela bez odchodu domečkem.
    const third = enterOn(storage, { today: SUNDAY });
    expect(todayColumn(third.session)).toEqual({ solved: 3, firstTry: 2 });
  });

  it('příklad vyřešený těsně před půlnocí patří ke svému dni, další k novému dni', () => {
    const clock = { today: new Date(2026, 10, 21, 23, 59, 30) };
    const test = enterOn(memoryStorage(), clock);
    solveProblems(test, 1);
    clock.today = new Date(2026, 10, 22, 0, 0, 30);
    solveProblems(test, 2);
    const days = test.session.weekOverview().days;
    expect(days.slice(-2).map((day) => day.solved)).toEqual([1, 2]);
  });
});

// ---------------------------------------------------------------------------
// AC2: 7 dní a velikost záznamu
// ---------------------------------------------------------------------------

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

  it('den bez hraní mezi dny s hraním má 0 a součet je za celý týden', () => {
    const clock = { today: SUNDAY };
    const storage = memoryStorage();
    solveProblems(enterOn(storage, clock), 4);
    clock.today = daysAfter(SUNDAY, 2);
    const test = enterOn(storage, clock);
    solveProblems(test, 1);
    solveAfterMistake(test);
    const overview = test.session.weekOverview();
    expect(overview.days.slice(-3).map((day) => day.solved)).toEqual([4, 0, 2]);
    expect(overview.totalSolved).toBe(6);
    expect(overview.totalFirstTry).toBe(5);
  });

  it('den starší než 7 dní se do přehledu nepočítá a při dalším zápisu se zahodí', () => {
    const clock = { today: SUNDAY };
    const storage = memoryStorage();
    solveProblems(enterOn(storage, clock), 3);
    clock.today = daysAfter(SUNDAY, 7);
    const test = enterOn(storage, clock);
    expect(test.session.weekOverview().totalSolved).toBe(0);

    solveProblems(test, 1);
    const saved = parseActivity(storage.data.get(ACTIVITY_KEY));
    expect(Object.keys(saved)).toEqual([dayKeyOf(daysAfter(SUNDAY, 7))]);
  });

  it('den přesně před 6 dny se ještě počítá jako první sloupeček', () => {
    const clock = { today: SUNDAY };
    const storage = memoryStorage();
    solveProblems(enterOn(storage, clock), 2);
    clock.today = daysAfter(SUNDAY, 6);
    const overview = enterOn(storage, clock).session.weekOverview();
    expect(overview.days[0]?.solved).toBe(2);
    expect(overview.totalSolved).toBe(2);
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

  it('uložený záznam ze hry má nejvýš 1 kB i po týdnech hraní', () => {
    const clock = { today: SUNDAY };
    const storage = memoryStorage();
    for (let day = 0; day < 20; day += 1) {
      clock.today = daysAfter(SUNDAY, day);
      solveProblems(enterOn(storage, clock), 3);
      expect(byteLength(storage.data.get(ACTIVITY_KEY) ?? ''), `den ${day}`).toBeLessThanOrEqual(
        MAX_ACTIVITY_RECORD_BYTES,
      );
    }
  });

  it('nad nejvyšší počet za den se už nepřičítá, záznam nepřeroste', () => {
    const full: ActivityRecord = {
      [dayKeyOf(SUNDAY)]: { solved: MAX_SOLVED_PER_DAY, firstTry: 5 },
    };
    const after = recordSolvedProblem(full, SUNDAY, true);
    expect(after[dayKeyOf(SUNDAY)]).toEqual({ solved: MAX_SOLVED_PER_DAY, firstTry: 5 });
  });
});

// ---------------------------------------------------------------------------
// AC3: přehled za kolečkem, hra mezitím stojí
// ---------------------------------------------------------------------------

describe('#183 AC3: přehled je v nastavení za kolečkem', () => {
  const saved = KEYPAD_SETTINGS;

  it('z nastavení se tlačítkem Přehled otevře přehled a Zpět vrátí nastavení s rozehranými volbami', () => {
    const chosen = chooseOption(openSettings({ open: false }, saved), { maxNumber: 20 });
    const panel = openParentPanel(chosen);
    expect(panel.view).toBe('settings');

    const overview = showOverview(panel);
    expect(overview.view).toBe('overview');

    const back = backToSettings(overview);
    expect(back.view).toBe('settings');
    expect(back.session).toEqual(chosen);
  });

  it('v přehledu nejde nastavení potvrdit, v nastavení ano', () => {
    const panel = openParentPanel(openSettings({ open: false }, saved));
    expect(canConfirmSettings(panel)).toBe(true);
    expect(canConfirmSettings(showOverview(panel))).toBe(false);
  });

  it('bez otevřeného nastavení se přehled neotevře', () => {
    const closed = openParentPanel({ open: false });
    expect(showOverview(closed).view).toBe('settings');
  });

  it('s otevřeným nastavením (a přehledem v něm) hra stojí a hvězdičky se nemění', () => {
    const device = testDevice();
    const test = enterOn(device.storage, { today: SUNDAY }, device.page);
    solveProblems(test, 2);
    const starsBefore = test.session.starCount();
    const problemBefore = test.session.problem();

    test.page.holdGear();
    expect(test.session.settingsOpen()).toBe(true);
    const overview = test.session.weekOverview();
    expect(test.session.tapAnswer(correctAnswerOf(test.session))).toBe('ignored');
    test.timers.runAll();

    expect(test.session.starCount()).toBe(starsBefore);
    expect(test.session.problem()).toEqual(problemBefore);
    expect(test.session.weekOverview()).toEqual(overview);
  });

  it('podívat se do přehledu nic nepřičte ani neuloží', () => {
    const storage = memoryStorage();
    const test = enterOn(storage, { today: SUNDAY });
    solveProblems(test, 2);
    const before = storage.data.get(ACTIVITY_KEY);
    test.session.weekOverview();
    test.session.weekOverview();
    expect(storage.data.get(ACTIVITY_KEY)).toBe(before);
    expect(todayColumn(test.session)).toEqual({ solved: 2, firstTry: 2 });
  });
});

// ---------------------------------------------------------------------------
// AC4: bez dat
// ---------------------------------------------------------------------------

describe('#183 AC4: bez dat přehled ukáže „Zatím žádné příklady“', () => {
  it('nové zařízení má prázdný přehled', () => {
    const test = enterOn(memoryStorage(), { today: SUNDAY });
    const overview = test.session.weekOverview();
    expect(overview.isEmpty).toBe(true);
    expect(overview.totalSolved).toBe(0);
  });

  it('po prvním vyřešeném příkladu už přehled prázdný není', () => {
    const test = enterOn(memoryStorage(), { today: SUNDAY });
    solveProblems(test, 1);
    expect(test.session.weekOverview().isEmpty).toBe(false);
  });

  it('jen špatné odpovědi přehled nechají prázdný', () => {
    const test = enterOn(memoryStorage(), { today: SUNDAY });
    test.session.tapAnswer(wrongAnswerOf(test.session));
    expect(test.session.weekOverview().isEmpty).toBe(true);
  });

  it('hraní starší než 7 dní dá prázdný přehled', () => {
    const clock = { today: SUNDAY };
    const storage = memoryStorage();
    solveProblems(enterOn(storage, clock), 5);
    clock.today = daysAfter(SUNDAY, 10);
    expect(enterOn(storage, clock).session.weekOverview().isEmpty).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AC5: každý profil má vlastní přehled
// ---------------------------------------------------------------------------

function enterProfile(store: ProfileStore): TestSession {
  return enterOn(store.gameStorage(COUNTING_META.id), { today: SUNDAY });
}

describe('#183 AC5: každý profil má vlastní přehled', () => {
  it('příklady jednoho dítěte se neukážou v přehledu druhého dítěte', () => {
    const storage = new DeviceStorage();
    const store = openProfiles(storage);
    const first = store.activeProfile();
    const second = store.createProfile({ nickname: 'BETA', color: PROFILE_COLORS[1] });

    solveProblems(enterProfile(store), 4);
    store.selectProfile(second.id);
    expect(enterProfile(store).session.weekOverview().isEmpty).toBe(true);
    solveProblems(enterProfile(store), 1);

    const reloaded = openProfiles(storage);
    reloaded.selectProfile(first.id);
    expect(enterProfile(reloaded).session.weekOverview().totalSolved).toBe(4);
    reloaded.selectProfile(second.id);
    expect(enterProfile(reloaded).session.weekOverview().totalSolved).toBe(1);
  });

  it('přehled se ukládá pod vnitřním označením profilu, nikdy s přezdívkou', () => {
    const storage = new DeviceStorage();
    const store = openProfiles(storage);
    const child = store.createProfile({ nickname: 'ZUZANA', color: PROFILE_COLORS[2] });
    store.selectProfile(child.id);
    solveProblems(enterProfile(store), 2);

    const activityKeys = [...storage.data.keys()].filter((key) => key.endsWith(ACTIVITY_KEY));
    expect(activityKeys).toHaveLength(1);
    expect(profileDataKeys(storage, child.id)).toContain(activityKeys[0]);
    for (const [key, value] of storage.data) {
      if (key.endsWith(ACTIVITY_KEY)) {
        expect(key).not.toContain('ZUZANA');
        expect(value).not.toContain('ZUZANA');
      }
    }
  });

  it('po smazání profilu jeho přehled zmizí a nový profil se stejnou přezdívkou začíná prázdný', () => {
    const storage = new DeviceStorage();
    const store = openProfiles(storage);
    const keeper = store.activeProfile();
    const child = store.createProfile({ nickname: 'ALFA', color: PROFILE_COLORS[3] });
    store.selectProfile(child.id);
    solveProblems(enterProfile(store), 3);

    store.selectProfile(keeper.id);
    expect(store.deleteProfile(child.id)).toBe(true);
    expect(profileDataKeys(storage, child.id)).toEqual([]);
    expect([...storage.data.keys()].some((key) => key.endsWith(ACTIVITY_KEY))).toBe(false);

    const again = store.createProfile({ nickname: 'ALFA', color: PROFILE_COLORS[3] });
    store.selectProfile(again.id);
    expect(enterProfile(store).session.weekOverview().isEmpty).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AC6: poškozený záznam, plné úložiště, den z budoucnosti
// ---------------------------------------------------------------------------

describe('#183 AC6: poškozený záznam dá prázdný přehled', () => {
  const CORRUPT_RECORDS: readonly string[] = [
    '{',
    'nesmysl',
    'null',
    '42',
    '"text"',
    '[]',
    '{"days":[]}',
    '{"days":{"2026-11-22":"5"}}',
    '{"days":{"2026-11-22":[5]}}',
    '{"days":{"2026-11-22":[-1,0]}}',
    '{"days":{"2026-11-22":[2.5,1]}}',
    '{"days":{"2026-11-22":[3,4]}}',
    '{"days":{"2026-11-22":[100000,0]}}',
    '{"days":{"nesmysl":[3,1]}}',
    '{"days":{"2026-13-45":[3,1]}}',
    '{"days":{"2026-02-30":[3,1]}}',
  ];

  it('každý poškozený záznam dá prázdný přehled bez chyby', () => {
    for (const corrupt of CORRUPT_RECORDS) {
      expect(weekOverview(parseActivity(corrupt), SUNDAY).isEmpty, corrupt).toBe(true);
    }
  });

  it('s poškozeným záznamem hra běží a první vyřešený příklad začne nový záznam', () => {
    for (const corrupt of CORRUPT_RECORDS) {
      const storage = memoryStorage();
      storage.data.set(ACTIVITY_KEY, corrupt);
      const test = enterOn(storage, { today: SUNDAY });
      expect(test.session.weekOverview().isEmpty, corrupt).toBe(true);
      solveProblems(test, 1);
      expect(todayColumn(test.session), corrupt).toEqual({ solved: 1, firstTry: 1 });
      expect(
        weekOverview(parseActivity(storage.data.get(ACTIVITY_KEY)), SUNDAY).totalSolved,
        corrupt,
      ).toBe(1);
    }
  });

  it('chybějící nebo prázdný záznam je prázdný přehled', () => {
    for (const missing of [null, undefined, '']) {
      expect(weekOverview(parseActivity(missing), SUNDAY).isEmpty).toBe(true);
    }
  });
});

describe('#183 AC6: plné nebo zakázané úložiště hru nezastaví', () => {
  it('s plným úložištěm dítě hraje dál, hvězdičky přibývají a přehled platí do zavření stránky', () => {
    const test = enterOn(readOnlyStorage(), { today: SUNDAY });
    expect(() => solveProblems(test, 3)).not.toThrow();
    expect(test.session.starCount()).toBe(3);
    expect(todayColumn(test.session)).toEqual({ solved: 3, firstTry: 3 });
  });

  it('když selže jen zápis přehledu, hvězdičky se uloží dál', () => {
    const storage = memoryStorage();
    const failing: KeyValueStorage = {
      getItem: (key) => storage.getItem(key),
      setItem: (key, value) => {
        if (key === ACTIVITY_KEY) {
          throw new Error('úložiště je plné');
        }
        storage.setItem(key, value);
      },
    };
    const test = enterOn(failing, { today: SUNDAY });
    solveProblems(test, 2);
    expect(enterOn(storage, { today: SUNDAY }).session.starCount()).toBe(2);
    expect(storage.data.has(ACTIVITY_KEY)).toBe(false);
  });

  it('se zakázaným úložištěm nebo bez něj hra běží bez chyby', () => {
    for (const storage of [brokenStorage(), undefined]) {
      const test = enterOn(storage, { today: SUNDAY });
      expect(() => solveProblems(test, 2)).not.toThrow();
      expect(todayColumn(test.session)).toEqual({ solved: 2, firstTry: 2 });
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

  it('den z budoucnosti nepokazí dnešní a dřívější dny', () => {
    const storage = memoryStorage();
    storage.data.set(
      ACTIVITY_KEY,
      JSON.stringify({
        days: {
          [dayKeyOf(daysAfter(SUNDAY, -1))]: [2, 1],
          [dayKeyOf(daysAfter(SUNDAY, 3))]: [50, 50],
        },
      }),
    );
    const test = enterOn(storage, { today: SUNDAY });
    solveProblems(test, 1);
    const overview = test.session.weekOverview();
    expect(overview.days.slice(-2).map((day) => day.solved)).toEqual([2, 1]);
    expect(overview.totalSolved).toBe(3);
    expect(overview.totalFirstTry).toBe(2);
  });

  it('při zápisu se den z budoucnosti zahodí', () => {
    const future = dayKeyOf(daysAfter(SUNDAY, 2));
    const record = parseActivity(JSON.stringify({ days: { [future]: [9, 9] } }));
    const after = recordSolvedProblem(record, SUNDAY, false);
    expect(Object.keys(after)).toEqual([dayKeyOf(SUNDAY)]);
    expect(after[dayKeyOf(SUNDAY)]).toEqual({ solved: 1, firstTry: 0 });
  });
});
