import { describe, expect, it } from 'vitest';

import { CELEBRATION_MS, STAR_FLIGHT_MS } from '../../../src/games/counting/logic/countingSession';
import {
  MAP_GOAL_SHOW_MS,
  MAP_SHOW_MS,
  MAP_STEPS,
  START_MAP,
  serializeMapProgress,
} from '../../../src/games/counting/logic/progressMap';
import type { MapMove, MapProgress } from '../../../src/games/counting/logic/progressMap';
import { STARS_PER_SET } from '../../../src/games/counting/logic/stars';
import { MAP_PROGRESS_KEY, loadMapProgress } from '../../../src/games/counting/storage/mapStorage';
import { LEGACY_PROGRESS_KEY } from '../../shared/profileFixtures';
import {
  correctAnswerOf,
  enterCounting,
  solveProblems,
  testDevice,
  wrongAnswerOf,
} from './sessionFakes';
import type { TestDevice, TestSession } from './sessionFakes';
import { brokenStorage } from './storageFakes';

/**
 * Testy k #87 (mapa postupu v Počítání) na úrovni sezení hry: mapa po
 * oslavě (AC1), jen dopředu a jeden krok za řadu (AC2), přerušení
 * nastavením, domečkem a zavřením hry (AC4, #45), 8 kroků a nová mapa
 * v jednom sezení (AC5) a poškozená uložená mapa (AC6). Falešné časovače,
 * zvuky a stránka jsou ze `sessionFakes.ts`.
 *
 * Navržené rozhraní `CountingSession` (navíc k dnešnímu):
 * - `mapProgress(): MapProgress` krok a počet dokončených map,
 * - `shownMap(): MapMove | null` co mapa právě ukazuje (`from`, `to`,
 *   `reachedGoal`), `null`, když mapa není vidět.
 * Uložení `src/games/counting/storage/mapStorage.ts`: `MAP_PROGRESS_KEY`
 * (klíč v úložišti hry profilu), `loadMapProgress(storage)`
 * a `saveMapProgress(storage, progress)`, chyby úložiště hra nevidí.
 */

/** Dítě vyřeší 9 příkladů a ťukne správně na 10.: řada je plná, čas dál neběží. */
function fillRow(test: TestSession): void {
  solveProblems(test, STARS_PER_SET - 1);
  test.session.tapAnswer(correctAnswerOf(test.session));
}

/**
 * Posouvá čas po 1 ms, dokud neplatí `condition`, nejvýš `limitMs`.
 * Vrátí, kolik ms uběhlo, nebo `null`, když podmínka nenastala.
 */
function advanceUntil(test: TestSession, condition: () => boolean, limitMs: number): number | null {
  for (let elapsed = 0; elapsed <= limitMs; elapsed += 1) {
    if (condition()) {
      return elapsed;
    }
    test.timers.advance(1);
  }
  return null;
}

/** Ukázala se mapa někdy během `ms`? (posouvá čas po 10 ms) */
function mapAppearsWithin(test: TestSession, ms: number): boolean {
  for (let elapsed = 0; elapsed <= ms; elapsed += 10) {
    if (test.session.shownMap() !== null) {
      return true;
    }
    test.timers.advance(10);
  }
  return false;
}

/** Po oslavě se ukáže mapa: počká na ni a vrátí, co ukazuje. */
function waitForMap(test: TestSession): MapMove {
  const waited = advanceUntil(
    test,
    () => test.session.shownMap() !== null,
    STAR_FLIGHT_MS + CELEBRATION_MS + 1000,
  );
  const shown = test.session.shownMap();
  if (waited === null || shown === null) {
    throw new Error('mapa se po oslavě neukázala');
  }
  return shown;
}

/** Zařízení, na kterém hráč už má uloženou mapu. */
function deviceWithMap(map: MapProgress, earned?: number): TestDevice {
  const device = testDevice();
  device.storage.setItem(MAP_PROGRESS_KEY, serializeMapProgress(map));
  if (earned !== undefined) {
    device.storage.setItem(LEGACY_PROGRESS_KEY, JSON.stringify({ earned }));
  }
  return device;
}

/** Krok uložený v zařízení. */
function savedStep(device: TestDevice): number {
  return loadMapProgress(device.storage).step;
}

describe('#87 AC1: po oslavě se na chvíli ukáže mapa a hra pokračuje sama', () => {
  it('na začátku hry mapa není vidět a hráč stojí na startu', () => {
    const test = enterCounting(testDevice());
    expect(test.session.shownMap()).toBeNull();
    expect(test.session.mapProgress()).toEqual(START_MAP);
  });

  it('po oslavě za 10 hvězdiček se ukáže mapa a značka na ní postoupí ze startu na 1. krok', () => {
    const test = enterCounting(testDevice());
    fillRow(test);
    expect(test.session.shownMap(), 'během oslavy mapa ještě není').toBeNull();

    const shown = waitForMap(test);

    expect(shown).toEqual({ from: 0, to: 1, reachedGoal: false });
    expect(test.session.celebrating(), 'mapa přijde až po oslavě').toBe(false);
  });

  it('mapa se ukáže až po doběhnutí oslavy, ne dřív', () => {
    const test = enterCounting(testDevice());
    fillRow(test);
    const waited = advanceUntil(
      test,
      () => test.session.shownMap() !== null,
      STAR_FLIGHT_MS + CELEBRATION_MS + 1000,
    );
    expect(waited).not.toBeNull();
    expect(waited ?? 0).toBeGreaterThanOrEqual(STAR_FLIGHT_MS + CELEBRATION_MS);
  });

  it('mapa je vidět 3 s, pak se sama zavře a přijde další příklad s prázdnou řadou', () => {
    const test = enterCounting(testDevice());
    fillRow(test);
    waitForMap(test);

    test.timers.advance(MAP_SHOW_MS - 10);
    expect(test.session.shownMap(), 'těsně před 3 s je mapa vidět').not.toBeNull();

    const closedAfter = advanceUntil(test, () => test.session.shownMap() === null, 100);
    expect(closedAfter, 'mapa se zavře nejpozději kolem 3 s').not.toBeNull();
    test.timers.runAll();
    expect(test.session.round().solved, 'nový příklad').toBe(false);
    expect(test.session.starCount(), 'prázdná řada').toBe(0);
  });

  it('dítě nemusí nic ťukat: bez jediného ťuknutí po 10. odpovědi přijde nový příklad', () => {
    const test = enterCounting(testDevice());
    fillRow(test);
    const solvedProblem = test.session.problem();

    test.timers.runAll();

    expect(test.session.shownMap()).toBeNull();
    expect(test.session.round().solved).toBe(false);
    expect(test.session.problem()).not.toEqual(solvedProblem);
    expect(test.session.starCount()).toBe(0);
  });

  it('při dojití do cíle je mapa vidět 5 s místo 3 s', () => {
    const device = deviceWithMap({ step: MAP_STEPS - 1, completedMaps: 0 });
    const test = enterCounting(device);
    fillRow(test);
    const shown = waitForMap(test);
    expect(shown).toEqual({ from: MAP_STEPS - 1, to: MAP_STEPS, reachedGoal: true });

    test.timers.advance(MAP_SHOW_MS + 100);
    expect(test.session.shownMap(), 'po 3 s je mapa v cíli pořád vidět').not.toBeNull();
    test.timers.advance(MAP_GOAL_SHOW_MS - MAP_SHOW_MS - 200);
    expect(test.session.shownMap(), 'těsně před 5 s je mapa vidět').not.toBeNull();

    const closedAfter = advanceUntil(test, () => test.session.shownMap() === null, 200);
    expect(closedAfter, 'mapa v cíli se zavře kolem 5 s').not.toBeNull();
    test.timers.runAll();
    expect(test.session.round().solved).toBe(false);
    expect(test.session.starCount()).toBe(0);
  });

  it('mapa se ukáže po každé oslavě v sezení, pokaždé o krok dál', () => {
    const test = enterCounting(testDevice());
    for (let row = 1; row <= 3; row += 1) {
      fillRow(test);
      expect(waitForMap(test), `řada ${row}`).toEqual({
        from: row - 1,
        to: row,
        reachedGoal: false,
      });
      test.timers.runAll();
    }
  });
});

describe('#87 AC2: mapa jde jen dopředu, jedna plná řada je přesně jeden krok', () => {
  it('správné odpovědi před plnou řadou žádný krok nepřidají', () => {
    const test = enterCounting(testDevice());
    solveProblems(test, STARS_PER_SET - 1);
    expect(test.session.mapProgress()).toEqual(START_MAP);
  });

  it('špatné odpovědi krok neberou ani nepřidávají', () => {
    const device = deviceWithMap({ step: 3, completedMaps: 1 });
    const test = enterCounting(device);
    for (let tap = 0; tap < 25; tap += 1) {
      test.session.tapAnswer(wrongAnswerOf(test.session));
    }
    test.timers.runAll();
    expect(test.session.mapProgress()).toEqual({ step: 3, completedMaps: 1 });
    expect(loadMapProgress(device.storage)).toEqual({ step: 3, completedMaps: 1 });
  });

  it('řada vyřešená s chybami a nápovědou dá přesně jeden krok', () => {
    const test = enterCounting(testDevice());
    for (let solved = 0; solved < STARS_PER_SET; solved += 1) {
      test.session.tapAnswer(wrongAnswerOf(test.session));
      test.session.tapAnswer(wrongAnswerOf(test.session));
      test.session.tapHintButton();
      test.session.tapAnswer(correctAnswerOf(test.session));
      test.timers.runAll();
    }
    expect(test.session.mapProgress()).toEqual({ step: 1, completedMaps: 0 });
  });

  it('nápověda tlačítkem krok nepřidá ani nevezme', () => {
    const device = deviceWithMap({ step: 2, completedMaps: 0 });
    const test = enterCounting(device);
    test.session.tapHintButton();
    test.timers.runAll();
    expect(test.session.mapProgress()).toEqual({ step: 2, completedMaps: 0 });
  });

  it('změna rozsahu nebo druhu příkladů v nastavení krok nevezme ani nepřidá', () => {
    const device = deviceWithMap({ step: 5, completedMaps: 2 });
    const test = enterCounting(device);
    solveProblems(test, 4);
    const changes = [
      { maxNumber: 20, operations: 'plus', answerInput: 'keypad' },
      { maxNumber: 5, operations: 'minus', answerInput: 'keypad' },
      { maxNumber: 10, operations: 'mixed', answerInput: 'keypad' },
    ] as const;
    for (const chosen of changes) {
      device.page.holdGear();
      test.session.confirmSettings(chosen);
      test.timers.runAll();
      expect(test.session.mapProgress(), JSON.stringify(chosen)).toEqual({
        step: 5,
        completedMaps: 2,
      });
    }
    expect(loadMapProgress(device.storage)).toEqual({ step: 5, completedMaps: 2 });
  });

  it('po změně nastavení uprostřed řady dá zaplnění řady zase přesně jeden krok', () => {
    const device = testDevice();
    const test = enterCounting(device);
    solveProblems(test, 4);
    device.page.holdGear();
    test.session.confirmSettings({ maxNumber: 20, operations: 'minus', answerInput: 'keypad' });
    test.timers.runAll();
    solveProblems(test, STARS_PER_SET - 4);
    expect(test.session.mapProgress()).toEqual({ step: 1, completedMaps: 0 });
  });
});

describe('#87 AC4: krok se započte při zaplnění řady a přerušení ho nepromarní ani nezdvojí', () => {
  it('krok je uložený hned po 10. odpovědi, ještě před oslavou', () => {
    const device = testDevice();
    const test = enterCounting(device);
    fillRow(test);
    expect(test.session.mapProgress().step).toBe(1);
    expect(savedStep(device)).toBe(1);
  });

  it('nastavení otevřené během oslavy: mapa se po zavření neukáže a příští mapa jde z 1. na 2. krok', () => {
    const device = testDevice();
    const test = enterCounting(device);
    fillRow(test);
    test.timers.advance(STAR_FLIGHT_MS + 500);
    expect(test.session.celebrating()).toBe(true);

    device.page.holdGear();
    test.session.confirmSettings();

    expect(mapAppearsWithin(test, MAP_GOAL_SHOW_MS + CELEBRATION_MS)).toBe(false);
    expect(test.session.mapProgress().step).toBe(1);
    expect(test.session.starCount()).toBe(0);
    expect(test.session.round().solved).toBe(false);

    fillRow(test);
    expect(waitForMap(test)).toEqual({ from: 1, to: 2, reachedGoal: false });
  });

  it('nastavení otevřené během mapy: mapa zmizí, po zavření se neukáže a krok se nepřičte znovu', () => {
    const device = testDevice();
    const test = enterCounting(device);
    fillRow(test);
    waitForMap(test);

    device.page.holdGear();
    expect(test.session.shownMap(), 'nastavení mapu přeruší').toBeNull();
    test.session.confirmSettings();

    expect(mapAppearsWithin(test, MAP_GOAL_SHOW_MS + CELEBRATION_MS)).toBe(false);
    expect(test.session.mapProgress().step).toBe(1);
    expect(savedStep(device)).toBe(1);
    expect(test.session.round().solved).toBe(false);

    fillRow(test);
    expect(waitForMap(test)).toEqual({ from: 1, to: 2, reachedGoal: false });
  });

  it('nastavení otevřené už před začátkem oslavy (#45): oslava ani mapa nepřijdou a krok platí', () => {
    const device = testDevice();
    const test = enterCounting(device);
    fillRow(test);
    // Hvězdička ještě letí do řady, oslava nezačala.
    device.page.holdGear();
    test.timers.advance(STAR_FLIGHT_MS + CELEBRATION_MS + MAP_GOAL_SHOW_MS);
    expect(test.session.shownMap(), 'pod nastavením se mapa neukáže').toBeNull();

    test.session.confirmSettings();

    expect(mapAppearsWithin(test, MAP_GOAL_SHOW_MS + CELEBRATION_MS)).toBe(false);
    expect(test.session.mapProgress().step).toBe(1);
    expect(test.session.starCount()).toBe(0);

    fillRow(test);
    expect(waitForMap(test)).toEqual({ from: 1, to: 2, reachedGoal: false });
  });

  it('nastavení otevřené během mapy v cíli: dokončená mapa se započte jednou a další řada začne novou mapu', () => {
    const device = deviceWithMap({ step: MAP_STEPS - 1, completedMaps: 0 });
    const test = enterCounting(device);
    fillRow(test);
    waitForMap(test);

    device.page.holdGear();
    test.session.confirmSettings();
    test.timers.runAll();

    expect(test.session.mapProgress()).toEqual({ step: MAP_STEPS, completedMaps: 1 });
    fillRow(test);
    expect(waitForMap(test)).toEqual({ from: 0, to: 1, reachedGoal: false });
    expect(test.session.mapProgress()).toEqual({ step: 1, completedMaps: 1 });
  });

  it('odchod domečkem během oslavy: příště se mapa neukáže sama a další řada jde z 1. na 2. krok', () => {
    const device = testDevice();
    const test = enterCounting(device);
    fillRow(test);
    test.timers.advance(STAR_FLIGHT_MS + 500);
    test.session.leave();

    const next = enterCounting(device);
    expect(next.session.mapProgress().step).toBe(1);
    expect(mapAppearsWithin(next, MAP_GOAL_SHOW_MS + CELEBRATION_MS)).toBe(false);

    fillRow(next);
    expect(waitForMap(next)).toEqual({ from: 1, to: 2, reachedGoal: false });
  });

  it('odchod domečkem během mapy: příště se mapa neukáže sama a krok se nepřičte znovu', () => {
    const device = testDevice();
    const test = enterCounting(device);
    fillRow(test);
    waitForMap(test);
    test.session.leave();
    expect(test.session.shownMap(), 'po odchodu mapa není').toBeNull();

    const next = enterCounting(device);
    expect(next.session.mapProgress().step).toBe(1);
    expect(next.session.starCount()).toBe(0);
    expect(mapAppearsWithin(next, MAP_GOAL_SHOW_MS + CELEBRATION_MS)).toBe(false);

    fillRow(next);
    expect(waitForMap(next)).toEqual({ from: 1, to: 2, reachedGoal: false });
  });

  it('zavření hry hned po 10. odpovědi: krok zůstane a po otevření se nepřičte znovu', () => {
    const device = testDevice();
    const closed = enterCounting(device);
    fillRow(closed);
    // Hra se zavřela: sezení skončilo bez odchodu, jeho časovače už nikdy neproběhnou.

    const reopened = enterCounting(device);
    expect(reopened.session.mapProgress().step).toBe(1);
    expect(reopened.session.starCount()).toBe(0);
    expect(mapAppearsWithin(reopened, MAP_GOAL_SHOW_MS + CELEBRATION_MS)).toBe(false);

    fillRow(reopened);
    expect(waitForMap(reopened)).toEqual({ from: 1, to: 2, reachedGoal: false });
  });

  it('zavření hry během mapy: krok zůstane a po otevření se nepřičte znovu', () => {
    const device = testDevice();
    const closed = enterCounting(device);
    fillRow(closed);
    waitForMap(closed);

    const reopened = enterCounting(device);
    expect(reopened.session.mapProgress().step).toBe(1);
    fillRow(reopened);
    expect(waitForMap(reopened)).toEqual({ from: 1, to: 2, reachedGoal: false });
  });
});

describe('#87 AC5: 8 kroků do cíle a pak nová mapa, i v jednom sezení', () => {
  it('po 8. plné řadě v jednom sezení značka dojde do cíle a mapa je hotová', () => {
    const test = enterCounting(testDevice());
    for (let row = 1; row < MAP_STEPS; row += 1) {
      fillRow(test);
      expect(waitForMap(test).reachedGoal, `řada ${row}`).toBe(false);
      test.timers.runAll();
    }
    fillRow(test);
    expect(waitForMap(test)).toEqual({ from: MAP_STEPS - 1, to: MAP_STEPS, reachedGoal: true });
    expect(test.session.mapProgress()).toEqual({ step: MAP_STEPS, completedMaps: 1 });
  });

  it('9. plná řada ukáže novou mapu a značka udělá 1. krok ze startu', () => {
    const test = enterCounting(testDevice());
    solveProblems(test, MAP_STEPS * STARS_PER_SET);
    fillRow(test);
    expect(waitForMap(test)).toEqual({ from: 0, to: 1, reachedGoal: false });
    expect(test.session.mapProgress()).toEqual({ step: 1, completedMaps: 1 });
  });

  it('počet dokončených map za 17 řad nikdy neklesne a je 2', () => {
    const device = testDevice();
    const test = enterCounting(device);
    let completedBefore = 0;
    for (let row = 1; row <= 2 * MAP_STEPS + 1; row += 1) {
      solveProblems(test, STARS_PER_SET);
      const { completedMaps } = test.session.mapProgress();
      expect(completedMaps, `řada ${row}`).toBeGreaterThanOrEqual(completedBefore);
      completedBefore = completedMaps;
    }
    expect(test.session.mapProgress()).toEqual({ step: 1, completedMaps: 2 });
    expect(loadMapProgress(device.storage)).toEqual({ step: 1, completedMaps: 2 });
  });

  it('hráč uložený v cíli pokračuje po otevření hry novou mapou od 1. kroku', () => {
    const device = deviceWithMap({ step: MAP_STEPS, completedMaps: 3 });
    const test = enterCounting(device);
    expect(test.session.mapProgress()).toEqual({ step: MAP_STEPS, completedMaps: 3 });
    fillRow(test);
    expect(waitForMap(test)).toEqual({ from: 0, to: 1, reachedGoal: false });
    expect(test.session.mapProgress()).toEqual({ step: 1, completedMaps: 3 });
  });
});

describe('#87 AC6: poškozená uložená mapa hru nezastaví a hvězdičky v řadě zůstanou', () => {
  const corruptRecords = [
    '{',
    'nesmysl',
    'null',
    '42',
    '[]',
    '{"step":-3,"completedMaps":2}',
    '{"step":9,"completedMaps":2}',
    '{"step":2.5,"completedMaps":2}',
    '{"step":"4","completedMaps":2}',
    '{"step":4,"completedMaps":-1}',
    '{"step":4,"completedMaps":"x"}',
  ];

  it('s poškozenou mapou hra začne bez chyby a dnešních 7 hvězdiček zůstane', () => {
    for (const corrupt of corruptRecords) {
      const device = testDevice();
      device.storage.setItem(LEGACY_PROGRESS_KEY, JSON.stringify({ earned: 7 }));
      device.storage.setItem(MAP_PROGRESS_KEY, corrupt);

      expect(() => enterCounting(device), corrupt).not.toThrow();
      const test = enterCounting(device);
      expect(test.session.starCount(), corrupt).toBe(7);
    }
  });

  it('s poškozenou mapou dá plná řada krok a mapa se ukáže', () => {
    for (const corrupt of corruptRecords) {
      const device = testDevice();
      device.storage.setItem(MAP_PROGRESS_KEY, corrupt);
      const test = enterCounting(device);
      const before = test.session.mapProgress();

      fillRow(test);
      const shown = waitForMap(test);

      expect(shown.to, corrupt).toBe(before.step + 1);
      expect(test.session.mapProgress().step, corrupt).toBe(before.step + 1);
    }
  });

  it('krok za cílem dá start a dokončená mapa se za to nepřičte', () => {
    const device = testDevice();
    device.storage.setItem(MAP_PROGRESS_KEY, '{"step":12,"completedMaps":2}');
    const test = enterCounting(device);
    expect(test.session.mapProgress()).toEqual({ step: 0, completedMaps: 2 });
  });

  it('chybějící mapa po aktualizaci hry dá start a 0 map, hvězdičky zůstanou', () => {
    const device = testDevice();
    device.storage.setItem(LEGACY_PROGRESS_KEY, JSON.stringify({ earned: 4 }));
    const test = enterCounting(device);
    expect(test.session.mapProgress()).toEqual(START_MAP);
    expect(test.session.starCount()).toBe(4);
  });

  it('zakázané nebo chybějící úložiště dá start a hra s mapou jede dál v paměti', () => {
    expect(loadMapProgress(brokenStorage())).toEqual(START_MAP);
    expect(loadMapProgress(undefined)).toEqual(START_MAP);
  });
});
