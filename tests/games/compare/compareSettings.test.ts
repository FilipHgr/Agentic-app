import { describe, expect, it } from 'vitest';

import {
  CELEBRATION_MS,
  NEXT_PROBLEM_MS,
  createCompareSession,
} from '../../../src/games/compare/logic/compareSession';
import { correctChoice, nextProblem } from '../../../src/games/compare/logic/compareProblems';
import type { CompareProblem } from '../../../src/games/compare/logic/compareProblems';
import {
  DEFAULT_COMPARE_SETTINGS,
  MAX_NUMBER_OPTIONS,
  SHOW_OPTIONS,
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
  wrongChoice,
} from './compareFakes';
import type { TestCompare } from './compareFakes';

/**
 * Testy k #179: nastavení Porovnávání pro rodiče za kolečkem. Rozsah
 * („Do kolika“ 5, 10, 20), co dítě vidí („Ukázat“ tečky, čísla, nebo tečky
 * s číslem), uložení podle profilu a zavření bez ✓. Rozložení panelu
 * a karet je v `compareSettingsLayout.test.ts`.
 */

/** Rodič podrží kolečko, zvolí `change` a ťukne na ✓. */
function confirmChoice(test: TestCompare, change: Partial<CompareSettings>): void {
  test.gear.hold();
  test.session.chooseSetting(change);
  test.session.confirmSettings();
}

/** Počty teček nebo čísla v příkladu. */
function countsOf(problem: CompareProblem): number[] {
  return [problem.left, problem.right];
}

describe('#179 AC1: nastavení se otevře až po podržení kolečka 1 s', () => {
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

  it('při otevřeném nastavení ťuknutí na karty nic nedělá a domeček nejde použít', () => {
    const test = openCompare();
    test.gear.hold();
    expect(test.session.settingsOpen()).toBe(true);
    expect(test.session.tap(correctChoice(test.session.problem()))).toBe('ignored');
    expect(test.session.tap(wrongChoice(test))).toBe('ignored');
    expect(test.session.starCount()).toBe(0);
    expect(test.session.homeAvailable()).toBe(false);
  });

  it('nastavení otevřené kolečkem ukazuje uložené volby', () => {
    const storage = new MemoryStorage();
    confirmChoice(openCompare(storage), { maxNumber: 20, show: 'both' });
    const again = openCompare(storage);
    again.gear.hold();
    expect(again.session.settingsChoice()).toEqual({
      maxNumber: 20,
      show: 'both',
      question: 'more',
    });
  });

  it('po odchodu z hry se hra od kolečka odpojí', () => {
    const test = openCompare();
    expect(test.gear.attached).toBe(true);
    test.session.leave();
    expect(test.gear.attached).toBe(false);
  });
});

describe('#179 AC2: „Do kolika“ 5, 10, 20 a žádný příklad rozsah nepřekročí', () => {
  it('rodič vybírá z rozsahů 5, 10 a 20, výchozí je 10', () => {
    expect([...MAX_NUMBER_OPTIONS]).toEqual([5, 10, 20]);
    expect(DEFAULT_COMPARE_SETTINGS.maxNumber).toBe(10);
  });

  it('v každém rozsahu přijdou všechny dvojice od 1 do rozsahu a žádná ho nepřekročí', () => {
    for (const maxNumber of MAX_NUMBER_OPTIONS) {
      const random = seededRandom(maxNumber);
      const seen = new Set<string>();
      let previous: CompareProblem | null = null;
      for (let index = 0; index < 20000; index += 1) {
        const problem = nextProblem(previous, random, maxNumber);
        for (const count of countsOf(problem)) {
          expect(Number.isInteger(count), `do ${maxNumber}`).toBe(true);
          expect(count, `do ${maxNumber}`).toBeGreaterThanOrEqual(1);
          expect(count, `do ${maxNumber}`).toBeLessThanOrEqual(maxNumber);
        }
        seen.add(`${Math.min(...countsOf(problem))}:${Math.max(...countsOf(problem))}`);
        previous = problem;
      }
      for (let low = 1; low <= maxNumber; low += 1) {
        for (let high = low; high <= maxNumber; high += 1) {
          expect(seen.has(`${low}:${high}`), `do ${maxNumber}: ${low} : ${high}`).toBe(true);
        }
      }
    }
  });

  it('po zvolení rozsahu 5 i 20 dává hra jen příklady v tomto rozsahu', () => {
    for (const maxNumber of [5, 20] as const) {
      const test = openCompare(undefined, maxNumber);
      confirmChoice(test, { maxNumber });
      let reachesTop = false;
      for (let index = 0; index < 300; index += 1) {
        const counts = countsOf(test.session.problem());
        expect(Math.max(...counts), `do ${maxNumber}`).toBeLessThanOrEqual(maxNumber);
        reachesTop ||= counts.includes(maxNumber);
        solveProblems(test, 1);
      }
      expect(reachesTop, `do ${maxNumber}: objeví se i ${maxNumber}`).toBe(true);
    }
  });
});

describe('#179 AC3: „Ukázat“ tečky, čísla, nebo tečky s číslem, od dalšího příkladu', () => {
  it('rodič vybírá tečky, čísla, nebo tečky s číslem pod nimi, výchozí jsou tečky', () => {
    expect([...SHOW_OPTIONS]).toEqual(['dots', 'numbers', 'both']);
    expect(DEFAULT_COMPARE_SETTINGS.show).toBe('dots');
    expect(openCompare().session.problemLook().show).toBe('dots');
  });

  it('dokud je nastavení otevřené, rozehraný příklad se nemění', () => {
    const test = openCompare();
    const problem = test.session.problem();
    test.gear.hold();
    test.session.chooseSetting({ show: 'numbers', maxNumber: 20 });
    expect(test.session.problem()).toEqual(problem);
    expect(test.session.problemLook()).toEqual(DEFAULT_COMPARE_SETTINGS);
    expect(test.session.settings()).toEqual(DEFAULT_COMPARE_SETTINGS);
  });

  it('po ✓ se změnou přijde další příklad a ten už je ukázaný zvoleným způsobem', () => {
    const changes: Partial<CompareSettings>[] = [
      { show: 'numbers' },
      { show: 'both' },
      { maxNumber: 5 },
      { maxNumber: 20 },
    ];
    for (const change of changes) {
      const name = JSON.stringify(change);
      const test = openCompare();
      const problem = test.session.problem();
      confirmChoice(test, change);
      expect(test.session.settingsOpen(), name).toBe(false);
      expect(test.session.problem(), name).not.toEqual(problem);
      expect(test.session.problemLook(), name).toEqual({ ...DEFAULT_COMPARE_SETTINGS, ...change });
      expect(test.changes.at(-1), name).toEqual({ kind: 'problemStarted' });
    }
  });

  it('po ✓ beze změny zůstane rozehraný příklad a dítě ho dořeší', () => {
    for (const change of [{}, { show: 'numbers' as const, maxNumber: 10 as const }]) {
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
      expect(test.session.tap(correctChoice(problem))).toBe('correct');
    }
  });

  it('zvolený způsob platí i pro všechny další příklady', () => {
    const test = openCompare();
    confirmChoice(test, { show: 'both' });
    solveProblems(test, 12);
    expect(test.session.problemLook().show).toBe('both');
  });
});

describe('#179 AC5: nastavení podle profilu, poškozené hodnoty dají výchozí', () => {
  it('po zavření a novém otevření hry platí zvolené nastavení', () => {
    const storage = new MemoryStorage();
    confirmChoice(openCompare(storage), { maxNumber: 5, show: 'numbers' });
    const again = openCompare(storage);
    expect(again.session.settings()).toEqual({ maxNumber: 5, show: 'numbers', question: 'more' });
    expect(again.session.problemLook()).toEqual({
      maxNumber: 5,
      show: 'numbers',
      question: 'more',
    });
    expect(Math.max(...countsOf(again.session.problem()))).toBeLessThanOrEqual(5);
  });

  it('každý profil má vlastní nastavení', () => {
    const device = new DeviceStorage();
    const store = openProfiles(device);
    const first = store.activeProfile();
    const second = store.createProfile({ nickname: 'EMA', color: PROFILE_COLORS[1] });

    confirmChoice(openCompare(store.gameStorage(COMPARE_META.id)), { maxNumber: 20 });
    store.selectProfile(second.id);
    const other = openCompare(store.gameStorage(COMPARE_META.id));
    expect(other.session.settings()).toEqual(DEFAULT_COMPARE_SETTINGS);
    confirmChoice(other, { show: 'numbers' });

    const reloaded = openProfiles(device);
    reloaded.selectProfile(first.id);
    expect(openCompare(reloaded.gameStorage(COMPARE_META.id)).session.settings()).toEqual({
      maxNumber: 20,
      show: 'dots',
      question: 'more',
    });
    reloaded.selectProfile(second.id);
    expect(openCompare(reloaded.gameStorage(COMPARE_META.id)).session.settings()).toEqual({
      maxNumber: 10,
      show: 'numbers',
      question: 'more',
    });
  });

  it('poškozený nebo neznámý záznam dá výchozí do 10 s tečkami a hra jde dál', () => {
    const broken = [
      '{',
      'null',
      '[]',
      '"20"',
      '{"maxNumber":7,"show":"stars"}',
      '{"maxNumber":"20","show":1}',
      '{"maxNumber":20.5}',
    ];
    for (const saved of broken) {
      const storage = new MemoryStorage();
      storage.data.set(COMPARE_SETTINGS_KEY, saved);
      const test = openCompare(storage);
      expect(test.session.settings(), saved).toEqual({
        maxNumber: 10,
        show: 'dots',
        question: 'more',
      });
      expect(test.session.tap(correctChoice(test.session.problem())), saved).toBe('correct');
    }
  });

  it('platná hodnota zůstane, i když je druhá neznámá', () => {
    const storage = new MemoryStorage();
    storage.data.set(COMPARE_SETTINGS_KEY, '{"maxNumber":20,"show":"stars"}');
    expect(openCompare(storage).session.settings()).toEqual({
      maxNumber: 20,
      show: 'dots',
      question: 'more',
    });
    storage.data.set(COMPARE_SETTINGS_KEY, '{"maxNumber":3,"show":"both"}');
    expect(openCompare(storage).session.settings()).toEqual({
      maxNumber: 10,
      show: 'both',
      question: 'more',
    });
  });

  it('když úložiště nejde číst ani zapsat, platí výchozí a zvolené nastavení aspoň do zavření hry', () => {
    const storage = new MemoryStorage();
    storage.failReads = true;
    storage.failWrites = true;
    const test = openCompare(storage);
    expect(test.session.settings()).toEqual(DEFAULT_COMPARE_SETTINGS);
    confirmChoice(test, { maxNumber: 20, show: 'both' });
    expect(test.session.settings()).toEqual({ maxNumber: 20, show: 'both', question: 'more' });
    expect(test.session.problemLook()).toEqual({ maxNumber: 20, show: 'both', question: 'more' });
  });
});

describe('#179 AC6: zavření bez ✓ nic nezmění, hvězdičky zůstanou', () => {
  it('odchod z hry s otevřeným nastavením bez ✓ nic neuloží a hvězdičky zůstanou', () => {
    const storage = new MemoryStorage();
    const first = openCompare(storage);
    solveProblems(first, 3);
    first.gear.hold();
    first.session.chooseSetting({ maxNumber: 20, show: 'numbers' });
    first.session.leave();

    const again = openCompare(storage);
    expect(again.session.settings()).toEqual(DEFAULT_COMPARE_SETTINGS);
    expect(again.session.starCount()).toBe(3);
  });

  it('volby bez ✓ neplatí ani ve hře, která běží dál', () => {
    const test = openCompare();
    test.gear.hold();
    test.session.chooseSetting({ maxNumber: 5 });
    expect(test.session.settings().maxNumber).toBe(10);
    expect(test.session.settingsChoice()?.maxNumber).toBe(5);
  });

  it('změna rozsahu i způsobu ukázání hvězdičky nenuluje', () => {
    const storage = new MemoryStorage();
    const test = openCompare(storage);
    solveProblems(test, 4);
    confirmChoice(test, { maxNumber: 20 });
    expect(test.session.starCount()).toBe(4);
    confirmChoice(test, { maxNumber: 5, show: 'both' });
    expect(test.session.starCount()).toBe(4);
    solveProblems(test, 1);
    expect(test.session.starCount()).toBe(5);
    expect(openCompare(storage).session.starCount()).toBe(5);
  });

  it('nastavení otevřené hned po správné odpovědi hvězdičku nechá a po ✓ jde dítě dál', () => {
    const test = openCompare();
    test.session.tap(correctChoice(test.session.problem()));
    test.gear.hold();
    test.timers.runAll();
    expect(test.session.settingsOpen()).toBe(true);
    expect(test.session.starCount()).toBe(1);
    test.session.confirmSettings();
    expect(test.session.starCount()).toBe(1);
    expect(test.session.shownSign()).toBeNull();
    expect(test.session.tap(correctChoice(test.session.problem()))).toBe('correct');
  });

  it('oslava za 10 hvězdiček přijde vždy, i když rodič otevře nastavení při 10. hvězdičce', () => {
    for (const change of [{}, { maxNumber: 20 as const }]) {
      const name = JSON.stringify(change);
      const test = openCompare();
      solveProblems(test, 9);
      test.session.tap(correctChoice(test.session.problem()));
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
      expect(test.session.problemLook(), name).toEqual({ ...DEFAULT_COMPARE_SETTINGS, ...change });
      expect(test.session.tap(correctChoice(test.session.problem())), name).toBe('correct');
    }
  });

  it('oslava přerušená nastavením se po ✓ přehraje znovu od začátku a pak je řada prázdná', () => {
    const test = openCompare();
    solveProblems(test, 9);
    test.session.tap(correctChoice(test.session.problem()));
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
    expect(test.session.tap(correctChoice(test.session.problem()))).toBe('correct');
  });

  it('druhé podržení kolečka při otevřeném nastavení volby nezahodí', () => {
    const test = openCompare();
    test.gear.hold();
    test.session.chooseSetting({ show: 'numbers' });
    test.gear.hold();
    expect(test.session.settingsChoice()?.show).toBe('numbers');
  });
});
