import { describe, expect, it } from 'vitest';

import type { Tone } from '../../../src/shared/audio/tonePlayer';
import { SOUNDS } from '../../../src/games/counting/logic/answerSounds';
import { CELEBRATION_MS, STAR_FLIGHT_MS } from '../../../src/games/counting/logic/countingSession';
import { markerShareAt } from '../../../src/games/counting/logic/mapAnimation';
import {
  MAP_GOAL_SHOW_MS,
  MAP_STEPS,
  serializeMapProgress,
} from '../../../src/games/counting/logic/progressMap';
import type { MapProgress } from '../../../src/games/counting/logic/progressMap';
import { STARS_PER_SET } from '../../../src/games/counting/logic/stars';
import { MAP_PROGRESS_KEY, loadMapProgress } from '../../../src/games/counting/storage/mapStorage';
import { correctAnswerOf, enterCounting, solveProblems, testDevice } from './sessionFakes';
import type { TestDevice, TestSession } from './sessionFakes';

/**
 * Testy k #135 AC2, AC3 a AC4 na úrovni sezení hry: zvuk zastávky
 * a melodie cíle zazní, až když značka na novém místě zastaví (ne při
 * ukázání mapy jako v #87), a přerušení během pohybu značky krok zachová
 * a nic dalšího už nezahraje. Kdy značka dojde, plyne z časové osy mapy
 * (`markerShareAt`, viz `mapAnimation.test.ts`). Falešné časovače, zvuky
 * a stránka jsou ze `sessionFakes.ts`.
 *
 * Navržené rozhraní: sezení přehraje `SOUNDS.mapStep` (zastávka) nebo
 * `SOUNDS.mapGoal` (cíl) ve chvíli, kdy značka dojde, tedy v čase od
 * ukázání mapy, kdy `markerShareAt` poprvé vrátí 1.
 */

/** Kdy značka dojde na nové místo, ms od ukázání mapy (po 1 ms). */
function arrivalMs(): number {
  for (let ms = 0; ms <= MAP_GOAL_SHOW_MS; ms += 1) {
    if (markerShareAt(ms) >= 1) {
      return ms;
    }
  }
  return MAP_GOAL_SHOW_MS + 1;
}

/** Dítě vyřeší 9 příkladů a ťukne správně na 10.: řada je plná. */
function fillRow(test: TestSession): void {
  solveProblems(test, STARS_PER_SET - 1);
  test.session.tapAnswer(correctAnswerOf(test.session));
}

/** Posouvá čas po 1 ms, dokud se neukáže mapa; vrátí, kolik zvuků už zaznělo. */
function waitForMap(test: TestSession, device: TestDevice): number {
  const limit = STAR_FLIGHT_MS + CELEBRATION_MS + 1000;
  for (let elapsed = 0; elapsed <= limit; elapsed += 1) {
    if (test.session.shownMap() !== null) {
      return device.sounds.played.length;
    }
    test.timers.advance(1);
  }
  throw new Error('mapa se po oslavě neukázala');
}

/** Kdy (ms od ukázání mapy) poprvé zazněl zvuk `tones`, nebo `null`. */
function soundAfterMap(
  test: TestSession,
  device: TestDevice,
  playedBefore: number,
  tones: readonly Tone[] | undefined,
  limitMs: number,
): number | null {
  for (let elapsed = 0; elapsed <= limitMs; elapsed += 1) {
    if (device.sounds.played.slice(playedBefore).some((played) => played === tones)) {
      return elapsed;
    }
    test.timers.advance(1);
  }
  return null;
}

function deviceWithMap(map: MapProgress): TestDevice {
  const device = testDevice();
  device.storage.setItem(MAP_PROGRESS_KEY, serializeMapProgress(map));
  return device;
}

/** Zvuky mapy (zastávka i cíl), které zazněly od indexu `from`. */
function mapSoundsSince(device: TestDevice, from: number): number {
  return device.sounds.played
    .slice(from)
    .filter((played) => played === SOUNDS.mapStep || played === SOUNDS.mapGoal).length;
}

describe('#135 AC2: zvuk zastávky zazní, až když na ní značka zastaví', () => {
  it('zvuk zastávky nezazní při ukázání mapy, ale ve chvíli, kdy značka dojde', () => {
    const device = testDevice();
    const test = enterCounting(device);
    fillRow(test);
    const before = waitForMap(test, device);

    const heardAt = soundAfterMap(test, device, before, SOUNDS.mapStep, MAP_GOAL_SHOW_MS);

    expect(heardAt, 'zvuk zastávky zazní').not.toBeNull();
    expect(heardAt, 'zvuk zazní přesně, když značka zastaví').toBe(arrivalMs());
  });

  it('nová zastávka na každé mapě zazní jednou, při dojití na 1. i 2. zastávku', () => {
    for (let step = 0; step < MAP_STEPS - 1; step += 1) {
      const device = deviceWithMap({ step, completedMaps: 1 });
      const test = enterCounting(device);
      fillRow(test);
      const before = waitForMap(test, device);

      const heardAt = soundAfterMap(test, device, before, SOUNDS.mapStep, MAP_GOAL_SHOW_MS);
      test.timers.runAll();

      expect(heardAt, `krok ${step} → ${step + 1}`).toBe(arrivalMs());
      expect(mapSoundsSince(device, before), `krok ${step} → ${step + 1}`).toBe(1);
    }
  });
});

describe('#135 AC3: melodie cíle zazní, až když značka dojde do cíle', () => {
  it('v cíli zazní melodie cíle ve chvíli, kdy značka zastaví, ne dřív', () => {
    const device = deviceWithMap({ step: MAP_STEPS - 1, completedMaps: 0 });
    const test = enterCounting(device);
    fillRow(test);
    const before = waitForMap(test, device);
    expect(test.session.shownMap()?.reachedGoal).toBe(true);

    const heardAt = soundAfterMap(test, device, before, SOUNDS.mapGoal, MAP_GOAL_SHOW_MS);

    expect(heardAt, 'melodie cíle zazní').not.toBeNull();
    expect(heardAt, 'melodie zazní, když značka zastaví v cíli').toBe(arrivalMs());
  });

  it('melodie cíle zazní během zobrazení mapy, mapa se pak sama zavře a hra pokračuje', () => {
    const device = deviceWithMap({ step: MAP_STEPS - 1, completedMaps: 0 });
    const test = enterCounting(device);
    fillRow(test);
    const before = waitForMap(test, device);

    test.timers.advance(MAP_GOAL_SHOW_MS + 100);

    expect(device.sounds.played.slice(before)).toContain(SOUNDS.mapGoal);
    expect(test.session.shownMap(), 'mapa se po 5 s zavřela sama').toBeNull();
    test.timers.runAll();
    expect(test.session.round().solved, 'nový příklad bez ťuknutí').toBe(false);
  });

  it('oslava za 10 hvězdiček doběhne dřív, než se ukáže mapa a cíl začne slavit', () => {
    const device = deviceWithMap({ step: MAP_STEPS - 1, completedMaps: 0 });
    const test = enterCounting(device);
    fillRow(test);
    const before = waitForMap(test, device);

    expect(test.session.celebrating(), 'první oslava už skončila').toBe(false);
    expect(device.sounds.played.slice(0, before)).toContain(SOUNDS.celebration);
    expect(device.sounds.played.slice(0, before)).not.toContain(SOUNDS.mapGoal);
  });
});

describe('#135 AC4: přerušení během pohybu značky krok zachová a nic dalšího nezahraje', () => {
  /** Polovina cesty: značka je na cestě mezi místy. */
  function midMoveMs(): number {
    return Math.floor(arrivalMs() / 2);
  }

  it('nastavení otevřené během pohybu: mapa zmizí, zvuk zastávky nezazní a krok zůstane', () => {
    const device = testDevice();
    const test = enterCounting(device);
    fillRow(test);
    const before = waitForMap(test, device);
    test.timers.advance(midMoveMs());

    device.page.holdGear();
    expect(test.session.shownMap(), 'nastavení mapu přeruší').toBeNull();
    test.timers.advance(MAP_GOAL_SHOW_MS);
    test.session.confirmSettings();
    test.timers.runAll();

    expect(mapSoundsSince(device, before), 'po přerušení už zvuk mapy nezazní').toBe(0);
    expect(test.session.shownMap(), 'po zavření nastavení se mapa neukáže').toBeNull();
    expect(test.session.mapProgress().step).toBe(1);
    expect(loadMapProgress(device.storage).step).toBe(1);
  });

  it('nastavení otevřené během pohybu do cíle: melodie nezazní a dokončená mapa se započte jednou', () => {
    const device = deviceWithMap({ step: MAP_STEPS - 1, completedMaps: 0 });
    const test = enterCounting(device);
    fillRow(test);
    const before = waitForMap(test, device);
    test.timers.advance(midMoveMs());

    device.page.holdGear();
    test.session.confirmSettings();
    test.timers.runAll();

    expect(mapSoundsSince(device, before)).toBe(0);
    expect(test.session.mapProgress()).toEqual({ step: MAP_STEPS, completedMaps: 1 });
    expect(loadMapProgress(device.storage)).toEqual({ step: MAP_STEPS, completedMaps: 1 });
  });

  it('odchod domečkem během pohybu: zvuk zastávky už nezazní a příště se mapa neukáže sama', () => {
    const device = testDevice();
    const test = enterCounting(device);
    fillRow(test);
    const before = waitForMap(test, device);
    test.timers.advance(midMoveMs());

    test.session.leave();
    test.timers.runAll();

    expect(test.session.shownMap(), 'po odchodu mapa není').toBeNull();
    expect(mapSoundsSince(device, before), 'po odchodu zvuk mapy nezazní').toBe(0);

    const next = enterCounting(device);
    expect(next.session.mapProgress().step).toBe(1);
    next.timers.advance(MAP_GOAL_SHOW_MS + CELEBRATION_MS);
    expect(next.session.shownMap(), 'mapa se po návratu sama neukáže').toBeNull();
  });

  it('zavření hry během pohybu: krok zůstane a po otevření se nepřičte znovu', () => {
    const device = testDevice();
    const closed = enterCounting(device);
    fillRow(closed);
    waitForMap(closed, device);
    closed.timers.advance(midMoveMs());
    // Hra se zavřela: časovače sezení už nikdy neproběhnou.

    const reopened = enterCounting(device);
    expect(reopened.session.mapProgress().step).toBe(1);
    reopened.timers.advance(MAP_GOAL_SHOW_MS + CELEBRATION_MS);
    expect(reopened.session.shownMap()).toBeNull();
    fillRow(reopened);
    expect(reopened.session.mapProgress().step).toBe(2);
  });
});
