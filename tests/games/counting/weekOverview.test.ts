import { describe, expect, it } from 'vitest';

import { createCountingSession } from '../../../src/games/counting/logic/countingSession';
import {
  MAX_ACTIVITY_RECORD_BYTES,
  dayKeyOf,
  parseActivity,
  weekOverview,
} from '../../../src/shared/logic/weekActivity';
import type { WeekOverview } from '../../../src/shared/logic/weekActivity';
import { ACTIVITY_KEY, readGameOverview } from '../../../src/shared/storage/activityStorage';
import { COUNTING_META, COUNTING_OVERVIEW } from '../../../src/games/counting/meta';
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
  wrongAnswerOf,
} from './sessionFakes';
import type { TestSession } from './sessionFakes';
import { brokenStorage, memoryStorage, readOnlyStorage } from './storageFakes';

/**
 * Testy k #183: přehled pro rodiče, kolik dítě v Počítání vyřešilo za
 * posledních 7 dní. Datum „dnes“ dostane hra zvenku (`today`), aby šly
 * vyzkoušet přechody dnů, týdnů i den z budoucnosti bez skutečných hodin.
 *
 * Od #192 je přehled v hlavním menu: co rodič uvidí, čte menu z úložiště
 * hry přes sdílenou logiku (`readGameOverview`), stejně to čtou i tyto
 * testy. Tvar záznamu a jeho čtení jsou ve sdílené části, testy logiky
 * jsou tady dál, protože je zapisuje Počítání. Obrazovka přehledu v menu
 * je v `tests/menu/parentOverview*.test.ts`.
 */

/** Neděle 22. 11. 2026 v poledne podle kalendáře zařízení. */
const SUNDAY = new Date(2026, 10, 22, 12, 0, 0);

function daysAfter(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days, 12, 0, 0);
}

/** Vstup do hry, ve kterém se dá podívat, co rodič v přehledu v menu uvidí. */
type OverviewTest = TestSession & {
  readonly page: FakePage;
  /** Přehled 7 dní, jak ho menu přečte z úložiště hry (#192). */
  overview(): WeekOverview;
};

/** Co přehled v menu ukáže z úložiště hry `storage` (#192). */
function shownWeek(storage: KeyValueStorage | undefined, today: Date): WeekOverview {
  return readGameOverview(storage, COUNTING_OVERVIEW, today).week;
}

/** Jeden vstup do Počítání nad úložištěm `storage` s dnešním dnem podle `clock`. */
function enterOn(
  storage: KeyValueStorage | undefined,
  clock: { today: Date },
  page = new FakePage(),
): OverviewTest {
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
  return {
    session,
    timers,
    recognizer,
    page,
    changes: () => 0,
    overview: () => shownWeek(storage, clock.today),
  };
}

/** Kolik přehled ukazuje u dneška (poslední sloupeček). */
function todayColumn(test: OverviewTest): { solved: number; firstTry: number } {
  const days = test.overview().days;
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
    expect(todayColumn(test)).toEqual({ solved: 3, firstTry: 3 });
  });

  it('příklad vyřešený po chybě se přičte, ale ne mezi vyřešené napoprvé', () => {
    const test = enterOn(memoryStorage(), { today: SUNDAY });
    solveAfterMistake(test);
    expect(todayColumn(test)).toEqual({ solved: 1, firstTry: 0 });
  });

  it('příklad vyřešený s nápovědou se přičte, ale ne mezi vyřešené napoprvé', () => {
    const test = enterOn(memoryStorage(), { today: SUNDAY });
    solveWithHint(test);
    const { solved, firstTry } = todayColumn(test);
    expect(solved - firstTry).toBe(1);
  });

  it('po dvou chybách (nápověda se ukáže sama) se příklad přičte, ale ne napoprvé', () => {
    const test = enterOn(memoryStorage(), { today: SUNDAY });
    test.session.tapAnswer(wrongAnswerOf(test.session));
    test.session.tapAnswer(wrongAnswerOf(test.session));
    expect(test.session.hintVisible()).toBe(true);
    test.session.tapAnswer(correctAnswerOf(test.session));
    test.timers.runAll();
    expect(todayColumn(test)).toEqual({ solved: 1, firstTry: 0 });
  });

  it('špatná odpověď sama o sobě nic nepřičte', () => {
    const test = enterOn(memoryStorage(), { today: SUNDAY });
    test.session.tapAnswer(wrongAnswerOf(test.session));
    expect(todayColumn(test)).toEqual({ solved: 0, firstTry: 0 });
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
    expect(todayColumn(third)).toEqual({ solved: 3, firstTry: 2 });
  });

  it('příklad vyřešený těsně před půlnocí patří ke svému dni, další k novému dni', () => {
    const clock = { today: new Date(2026, 10, 21, 23, 59, 30) };
    const test = enterOn(memoryStorage(), clock);
    solveProblems(test, 1);
    clock.today = new Date(2026, 10, 22, 0, 0, 30);
    solveProblems(test, 2);
    const days = test.overview().days;
    expect(days.slice(-2).map((day) => day.solved)).toEqual([1, 2]);
  });
});

// ---------------------------------------------------------------------------
// AC2: 7 dní a velikost záznamu
// ---------------------------------------------------------------------------

describe('#183 AC2: přehled ukazuje 7 dní včetně dneška', () => {
  it('den bez hraní mezi dny s hraním má 0 a součet je za celý týden', () => {
    const clock = { today: SUNDAY };
    const storage = memoryStorage();
    solveProblems(enterOn(storage, clock), 4);
    clock.today = daysAfter(SUNDAY, 2);
    const test = enterOn(storage, clock);
    solveProblems(test, 1);
    solveAfterMistake(test);
    const overview = test.overview();
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
    expect(test.overview().totalSolved).toBe(0);

    solveProblems(test, 1);
    const saved = parseActivity(storage.data.get(ACTIVITY_KEY));
    expect(Object.keys(saved)).toEqual([dayKeyOf(daysAfter(SUNDAY, 7))]);
  });

  it('den přesně před 6 dny se ještě počítá jako první sloupeček', () => {
    const clock = { today: SUNDAY };
    const storage = memoryStorage();
    solveProblems(enterOn(storage, clock), 2);
    clock.today = daysAfter(SUNDAY, 6);
    const overview = enterOn(storage, clock).overview();
    expect(overview.days[0]?.solved).toBe(2);
    expect(overview.totalSolved).toBe(2);
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
});

// ---------------------------------------------------------------------------
// AC3 (od #192 v menu): podívat se do přehledu nic nemění
// ---------------------------------------------------------------------------

describe('#183 AC3, #192: přehled jen čte, co hra zapsala', () => {
  it('podívat se do přehledu nic nepřičte ani neuloží', () => {
    const storage = memoryStorage();
    const test = enterOn(storage, { today: SUNDAY });
    solveProblems(test, 2);
    const before = new Map(storage.data);
    test.overview();
    test.overview();
    expect(storage.data).toEqual(before);
    expect(todayColumn(test)).toEqual({ solved: 2, firstTry: 2 });
  });
});

// ---------------------------------------------------------------------------
// AC4: bez dat
// ---------------------------------------------------------------------------

describe('#183 AC4: bez dat přehled ukáže „Zatím žádné příklady“', () => {
  it('nové zařízení má prázdný přehled', () => {
    const test = enterOn(memoryStorage(), { today: SUNDAY });
    const overview = test.overview();
    expect(overview.isEmpty).toBe(true);
    expect(overview.totalSolved).toBe(0);
  });

  it('po prvním vyřešeném příkladu už přehled prázdný není', () => {
    const test = enterOn(memoryStorage(), { today: SUNDAY });
    solveProblems(test, 1);
    expect(test.overview().isEmpty).toBe(false);
  });

  it('jen špatné odpovědi přehled nechají prázdný', () => {
    const test = enterOn(memoryStorage(), { today: SUNDAY });
    test.session.tapAnswer(wrongAnswerOf(test.session));
    expect(test.overview().isEmpty).toBe(true);
  });

  it('hraní starší než 7 dní dá prázdný přehled', () => {
    const clock = { today: SUNDAY };
    const storage = memoryStorage();
    solveProblems(enterOn(storage, clock), 5);
    clock.today = daysAfter(SUNDAY, 10);
    expect(enterOn(storage, clock).overview().isEmpty).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AC5: každý profil má vlastní přehled
// ---------------------------------------------------------------------------

function enterProfile(store: ProfileStore): OverviewTest {
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
    expect(enterProfile(store).overview().isEmpty).toBe(true);
    solveProblems(enterProfile(store), 1);

    const reloaded = openProfiles(storage);
    reloaded.selectProfile(first.id);
    expect(enterProfile(reloaded).overview().totalSolved).toBe(4);
    reloaded.selectProfile(second.id);
    expect(enterProfile(reloaded).overview().totalSolved).toBe(1);
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
    expect(enterProfile(store).overview().isEmpty).toBe(true);
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
      expect(test.overview().isEmpty, corrupt).toBe(true);
      solveProblems(test, 1);
      expect(todayColumn(test), corrupt).toEqual({ solved: 1, firstTry: 1 });
      expect(
        weekOverview(parseActivity(storage.data.get(ACTIVITY_KEY)), SUNDAY).totalSolved,
        corrupt,
      ).toBe(1);
    }
  });
});

describe('#183 AC6: plné nebo zakázané úložiště hru nezastaví', () => {
  it('s plným úložištěm dítě hraje dál, hvězdičky přibývají a přehled platí do zavření stránky', () => {
    const device = new DeviceStorage();
    const store = openProfiles(device);
    device.failWrite = () => true;
    const test = enterProfile(store);
    expect(() => solveProblems(test, 3)).not.toThrow();
    expect(test.session.starCount()).toBe(3);
    // Menu čte stejné úložiště profilu, které neuložené hodnoty drží do zavření stránky.
    expect(todayColumn(test)).toEqual({ solved: 3, firstTry: 3 });
    expect(() => enterOn(readOnlyStorage(), { today: SUNDAY })).not.toThrow();
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
      expect(test.session.starCount()).toBe(2);
    }
    // Zakázané úložiště zařízení: profil je dočasný v paměti a přehled v menu z něj čte.
    const device = new DeviceStorage();
    device.failReads = true;
    device.failWrite = () => true;
    const test = enterProfile(openProfiles(device));
    expect(() => solveProblems(test, 2)).not.toThrow();
    expect(todayColumn(test)).toEqual({ solved: 2, firstTry: 2 });
  });
});

describe('#183 AC6: den z budoucnosti se nezapočítá', () => {
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
    const overview = test.overview();
    expect(overview.days.slice(-2).map((day) => day.solved)).toEqual([2, 1]);
    expect(overview.totalSolved).toBe(3);
    expect(overview.totalFirstTry).toBe(2);
  });
});
