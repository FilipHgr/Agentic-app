import { describe, expect, it } from 'vitest';

import {
  CELEBRATION_MS,
  NEXT_PROBLEM_MS,
  createCompareSession,
} from '../../../src/games/compare/logic/compareSession';
import { correctSign } from '../../../src/games/compare/logic/compareProblems';
import type { CompareProblem } from '../../../src/games/compare/logic/compareProblems';
import {
  DEFAULT_COMPARE_SETTINGS,
  MAX_NUMBER_OPTIONS,
} from '../../../src/games/compare/logic/compareSettings';
import type { CompareSettings } from '../../../src/games/compare/logic/compareSettings';
import { COMPARE_META } from '../../../src/games/compare/meta';
import { COMPARE_SETTINGS_KEY } from '../../../src/games/compare/storage/settingsStorage';
import { PROFILE_COLORS } from '../../../src/shared/logic/profiles';
import { isHoldLongEnough } from '../../../src/shared/logic/settingsGear';
import { openProfiles } from '../../../src/shared/storage/profileStorage';
import { startGameSession } from '../../../src/shared/ui/gameSession';
import { DeviceStorage } from '../../shared/profileFixtures';
import {
  FakeSounds,
  FakeTimers,
  MemoryStorage,
  openCompare,
  seededRandom,
  solveProblems,
  wrongSign,
} from './compareFakes';
import type { TestCompare } from './compareFakes';

/**
 * Testy k #179 a #187 AC3: nastavení Porovnávání pro rodiče za kolečkem
 * (podržení 1 s). Rozsah („Do kolika“ 10 nebo 20, výchozí 10), uložení
 * podle profilu, starší uložené volby (5, „Ukázat“, „Otázka“) bez chyby,
 * ✓ beze změny nechá rozehraný příklad a zavření bez ✓ nic nezmění.
 * Rozložení panelu je v `compareSettingsLayout.test.ts`.
 */

/** Rodič podrží kolečko, zvolí `change` a ťukne na ✓. */
function confirmChoice(test: TestCompare, change: Partial<CompareSettings>): void {
  test.gear.hold();
  test.session.chooseSetting(change);
  test.session.confirmSettings();
}

/** Všechna čísla v příkladu. */
function numbersOf(problem: CompareProblem): number[] {
  return [problem.a, problem.b, problem.result];
}

describe('#179 AC1, #187 AC3: nastavení se otevře až po podržení kolečka 1 s', () => {
  it('krátké ťuknutí na kolečko nastavení neotevře, podržení 1 s ano', () => {
    expect(isHoldLongEnough(150), 'ťuknutí').toBe(false);
    expect(isHoldLongEnough(999), 'skoro 1 s').toBe(false);
    expect(isHoldLongEnough(1000), 'podržení 1 s').toBe(true);
  });

  it('ve hře je kolečko vidět a jeho podržení otevře nastavení Porovnávání', () => {
    const settingsButton = { hidden: true };
    let compare: ReturnType<typeof createCompareSession> | null = null;
    const page = startGameSession({
      homeButton: { hidden: true },
      settingsButton,
      startScenes: (running) => {
        compare = createCompareSession({
          random: seededRandom(),
          sounds: new FakeSounds(),
          timers: new FakeTimers(),
          attachSettingsGear: (open) => running.host.attachSettingsGear(open),
        });
        return () => undefined;
      },
      onLeft: () => undefined,
    });
    expect(settingsButton.hidden, 'kolečko ve hře').toBe(false);
    expect(compare!.settingsOpen(), 'před podržením').toBe(false);
    page.openSettings();
    expect(compare!.settingsOpen(), 'po podržení').toBe(true);
  });

  it('bez podržení kolečka je nastavení zavřené a dítě hraje', () => {
    const test = openCompare();
    expect(test.session.settingsOpen()).toBe(false);
    expect(test.session.settingsChoice()).toBeNull();
    expect(test.session.homeAvailable()).toBe(true);
  });

  it('při otevřeném nastavení ťuknutí na + a − nic nedělá a domeček nejde použít', () => {
    const test = openCompare();
    test.gear.hold();
    expect(test.session.settingsOpen()).toBe(true);
    expect(test.session.tap(correctSign(test.session.problem()))).toBe('ignored');
    expect(test.session.tap(wrongSign(test))).toBe('ignored');
    expect(test.session.starCount()).toBe(0);
    expect(test.session.homeAvailable()).toBe(false);
  });

  it('nastavení otevřené kolečkem ukazuje uložené volby', () => {
    const storage = new MemoryStorage();
    confirmChoice(openCompare(storage), { maxNumber: 20 });
    const again = openCompare(storage);
    again.gear.hold();
    expect(again.session.settingsChoice()).toEqual({ maxNumber: 20, answerInput: 'tap' });
  });

  it('po odchodu z hry se hra od kolečka odpojí', () => {
    const test = openCompare();
    expect(test.gear.attached).toBe(true);
    test.session.leave();
    expect(test.gear.attached).toBe(false);
  });
});

describe('#187 AC3: „Do kolika“ 10 nebo 20, výchozí 10', () => {
  it('rodič vybírá z rozsahů 10 a 20, výchozí je 10', () => {
    expect([...MAX_NUMBER_OPTIONS]).toEqual([10, 20]);
    expect(DEFAULT_COMPARE_SETTINGS).toEqual({ maxNumber: 10, answerInput: 'tap' });
    expect(openCompare().session.settings()).toEqual({ maxNumber: 10, answerInput: 'tap' });
  });

  it('po zvolení rozsahu 20 dává hra příklady do 20 a objeví se i čísla nad 10', () => {
    const test = openCompare(undefined, 20);
    confirmChoice(test, { maxNumber: 20 });
    let overTen = false;
    for (let index = 0; index < 300; index += 1) {
      const numbers = numbersOf(test.session.problem());
      expect(Math.max(...numbers)).toBeLessThanOrEqual(20);
      overTen ||= Math.max(...numbers) > 10;
      solveProblems(test, 1);
    }
    expect(overTen).toBe(true);
  });

  it('po návratu na rozsah 10 už žádné číslo nepřekročí 10', () => {
    const test = openCompare(undefined, 10);
    confirmChoice(test, { maxNumber: 20 });
    confirmChoice(test, { maxNumber: 10 });
    for (let index = 0; index < 300; index += 1) {
      expect(Math.max(...numbersOf(test.session.problem()))).toBeLessThanOrEqual(10);
      solveProblems(test, 1);
    }
  });

  it('dokud je nastavení otevřené, rozehraný příklad se nemění', () => {
    const test = openCompare();
    const problem = test.session.problem();
    test.gear.hold();
    test.session.chooseSetting({ maxNumber: 20 });
    expect(test.session.problem()).toEqual(problem);
    expect(test.session.settings()).toEqual(DEFAULT_COMPARE_SETTINGS);
  });

  it('po ✓ se změnou rozsahu přijde hned další příklad', () => {
    const test = openCompare();
    const problem = test.session.problem();
    confirmChoice(test, { maxNumber: 20 });
    expect(test.session.settingsOpen()).toBe(false);
    expect(test.session.problem()).not.toEqual(problem);
    expect(test.changes.at(-1)).toEqual({ kind: 'problemStarted' });
  });

  it('po ✓ beze změny zůstane rozehraný příklad a dítě ho dořeší', () => {
    for (const change of [{}, { maxNumber: 20 as const }]) {
      const test = openCompare();
      const problem = test.session.problem();
      test.gear.hold();
      test.session.chooseSetting(change);
      // Rodič volbu zase vrátí: nastavení je stejné jako před otevřením.
      test.session.chooseSetting(DEFAULT_COMPARE_SETTINGS);
      test.session.confirmSettings();
      expect(test.session.settingsOpen()).toBe(false);
      expect(test.session.problem()).toBe(problem);
      expect(test.changes).not.toContainEqual({ kind: 'problemStarted' });
      expect(test.session.tap(correctSign(problem))).toBe('correct');
    }
  });

  it('po ✓ beze změny zůstane i okénko, které dítě po chybě vyprázdnilo, a příklad jde dořešit', () => {
    const test = openCompare();
    const problem = test.session.problem();
    test.session.tap(wrongSign(test));
    confirmChoice(test, {});
    expect(test.session.problem()).toBe(problem);
    expect(test.session.filledSign()).toBeNull();
    expect(test.session.tap(correctSign(problem))).toBe('correct');
  });
});

describe('#179 AC5, #187 AC3: nastavení podle profilu, starší a poškozené hodnoty bez chyby', () => {
  it('po zavření a novém otevření hry platí zvolený rozsah', () => {
    const storage = new MemoryStorage();
    confirmChoice(openCompare(storage), { maxNumber: 20 });
    expect(openCompare(storage).session.settings()).toEqual({ maxNumber: 20, answerInput: 'tap' });
  });

  it('každý profil má vlastní rozsah', () => {
    const device = new DeviceStorage();
    const store = openProfiles(device);
    const first = store.activeProfile();
    const second = store.createProfile({ nickname: 'EMA', color: PROFILE_COLORS[1] });

    confirmChoice(openCompare(store.gameStorage(COMPARE_META.id)), { maxNumber: 20 });
    store.selectProfile(second.id);
    expect(openCompare(store.gameStorage(COMPARE_META.id)).session.settings()).toEqual(
      DEFAULT_COMPARE_SETTINGS,
    );

    const reloaded = openProfiles(device);
    reloaded.selectProfile(first.id);
    expect(openCompare(reloaded.gameStorage(COMPARE_META.id)).session.settings()).toEqual({
      maxNumber: 20,
      answerInput: 'tap',
    });
    reloaded.selectProfile(second.id);
    expect(openCompare(reloaded.gameStorage(COMPARE_META.id)).session.settings()).toEqual({
      maxNumber: 10,
      answerInput: 'tap',
    });
  });

  it('nastavení uložené starší hrou s tečkami (rozsah 5, „Ukázat“, „Otázka“) dá rozsah do 10 a hra jde dál', () => {
    const older = [
      '{"maxNumber":5,"show":"dots","question":"more"}',
      '{"maxNumber":5,"show":"numbers","question":"less"}',
      '{"maxNumber":10,"show":"both","question":"alternate"}',
    ];
    for (const saved of older) {
      const storage = new MemoryStorage();
      storage.data.set(COMPARE_SETTINGS_KEY, saved);
      const test = openCompare(storage);
      expect(test.session.settings(), saved).toEqual({ maxNumber: 10, answerInput: 'tap' });
      expect(Math.max(...numbersOf(test.session.problem())), saved).toBeLessThanOrEqual(10);
      expect(test.session.tap(correctSign(test.session.problem())), saved).toBe('correct');
    }
  });

  it('rozsah 20 uložený starší hrou zůstane 20, ostatní staré volby se zahodí', () => {
    const storage = new MemoryStorage();
    storage.data.set(COMPARE_SETTINGS_KEY, '{"maxNumber":20,"show":"both","question":"less"}');
    const test = openCompare(storage);
    expect(test.session.settings()).toEqual({ maxNumber: 20, answerInput: 'tap' });
    confirmChoice(test, {});
    expect(JSON.parse(storage.data.get(COMPARE_SETTINGS_KEY) ?? '')).toEqual({
      maxNumber: 20,
      answerInput: 'tap',
    });
  });

  it('poškozený nebo neznámý záznam dá výchozí rozsah do 10 a hra jde dál', () => {
    const broken = [
      '{',
      'null',
      '[]',
      '"20"',
      '{"maxNumber":7}',
      '{"maxNumber":"20"}',
      '{"maxNumber":20.5}',
      '{"show":"stars"}',
    ];
    for (const saved of broken) {
      const storage = new MemoryStorage();
      storage.data.set(COMPARE_SETTINGS_KEY, saved);
      const test = openCompare(storage);
      expect(test.session.settings(), saved).toEqual({ maxNumber: 10, answerInput: 'tap' });
      expect(test.session.tap(correctSign(test.session.problem())), saved).toBe('correct');
    }
  });

  it('když úložiště nejde číst ani zapsat, platí výchozí a zvolené nastavení aspoň do zavření hry', () => {
    const storage = new MemoryStorage();
    storage.failReads = true;
    storage.failWrites = true;
    const test = openCompare(storage);
    expect(test.session.settings()).toEqual(DEFAULT_COMPARE_SETTINGS);
    confirmChoice(test, { maxNumber: 20 });
    expect(test.session.settings()).toEqual({ maxNumber: 20, answerInput: 'tap' });
  });
});

describe('#179 AC6, #187 AC3: zavření bez ✓ nic nezmění, hvězdičky zůstanou', () => {
  it('odchod z hry s otevřeným nastavením bez ✓ nic neuloží a hvězdičky zůstanou', () => {
    const storage = new MemoryStorage();
    const first = openCompare(storage);
    solveProblems(first, 3);
    first.gear.hold();
    first.session.chooseSetting({ maxNumber: 20 });
    first.session.leave();

    const again = openCompare(storage);
    expect(again.session.settings()).toEqual(DEFAULT_COMPARE_SETTINGS);
    expect(again.session.starCount()).toBe(3);
  });

  it('volby bez ✓ neplatí ani ve hře, která běží dál', () => {
    const test = openCompare();
    test.gear.hold();
    test.session.chooseSetting({ maxNumber: 20 });
    expect(test.session.settings().maxNumber).toBe(10);
    expect(test.session.settingsChoice()?.maxNumber).toBe(20);
  });

  it('změna rozsahu hvězdičky nenuluje', () => {
    const storage = new MemoryStorage();
    const test = openCompare(storage);
    solveProblems(test, 4);
    confirmChoice(test, { maxNumber: 20 });
    expect(test.session.starCount()).toBe(4);
    confirmChoice(test, { maxNumber: 10 });
    expect(test.session.starCount()).toBe(4);
    solveProblems(test, 1);
    expect(test.session.starCount()).toBe(5);
    expect(openCompare(storage).session.starCount()).toBe(5);
  });

  it('nastavení otevřené hned po správné odpovědi hvězdičku nechá a po ✓ jde dítě dál', () => {
    const test = openCompare();
    test.session.tap(correctSign(test.session.problem()));
    test.gear.hold();
    test.timers.runAll();
    expect(test.session.settingsOpen()).toBe(true);
    expect(test.session.starCount()).toBe(1);
    test.session.confirmSettings();
    expect(test.session.starCount()).toBe(1);
    expect(test.session.filledSign()).toBeNull();
    expect(test.session.tap(correctSign(test.session.problem()))).toBe('correct');
  });

  it('oslava za 10 hvězdiček přijde vždy, i když rodič otevře nastavení při 10. hvězdičce', () => {
    for (const change of [{}, { maxNumber: 20 as const }]) {
      const name = JSON.stringify(change);
      const test = openCompare();
      solveProblems(test, 9);
      test.session.tap(correctSign(test.session.problem()));
      test.gear.hold();
      test.timers.runAll();
      expect(test.changes, name).not.toContainEqual({ kind: 'celebrationStarted' });
      expect(test.session.starCount(), name).toBe(10);
      test.session.chooseSetting(change);
      test.session.confirmSettings();
      expect(test.session.isCelebrating(), name).toBe(true);
      expect(test.changes, name).toContainEqual({ kind: 'celebrationStarted' });
      test.timers.advance(CELEBRATION_MS);
      expect(test.session.starCount(), name).toBe(0);
      expect(test.session.settings(), name).toEqual({ ...DEFAULT_COMPARE_SETTINGS, ...change });
      expect(test.session.tap(correctSign(test.session.problem())), name).toBe('correct');
    }
  });

  it('oslava přerušená nastavením se po ✓ přehraje znovu od začátku a pak je řada prázdná', () => {
    const test = openCompare();
    solveProblems(test, 9);
    test.session.tap(correctSign(test.session.problem()));
    test.timers.advance(NEXT_PROBLEM_MS + 500);
    expect(test.session.isCelebrating()).toBe(true);
    test.gear.hold();
    expect(test.session.isCelebrating()).toBe(false);
    test.timers.runAll();
    expect(test.session.starCount()).toBe(10);

    const before = test.changes.filter((change) => change.kind === 'celebrationStarted').length;
    test.session.confirmSettings();
    expect(test.session.isCelebrating()).toBe(true);
    expect(test.changes.filter((change) => change.kind === 'celebrationStarted')).toHaveLength(
      before + 1,
    );
    expect(test.sounds.played.at(-1)).toBe('celebration');
    test.timers.advance(CELEBRATION_MS - 1);
    expect(test.session.starCount()).toBe(10);
    test.timers.advance(1);
    expect(test.session.starCount()).toBe(0);
    expect(test.session.isCelebrating()).toBe(false);
    expect(test.session.tap(correctSign(test.session.problem()))).toBe('correct');
  });

  it('druhé podržení kolečka při otevřeném nastavení volby nezahodí', () => {
    const test = openCompare();
    test.gear.hold();
    test.session.chooseSetting({ maxNumber: 20 });
    test.gear.hold();
    expect(test.session.settingsChoice()?.maxNumber).toBe(20);
  });
});
