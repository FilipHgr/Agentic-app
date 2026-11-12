import { describe, expect, it } from 'vitest';

import { SOUNDS, soundLengthSeconds } from '../../../src/games/counting/logic/answerSounds';
import {
  MAP_GOAL_CELEBRATION_SCALE,
  goalCelebrationAt,
  isPlaceLitAt,
  markerPointAt,
  markerShareAt,
} from '../../../src/games/counting/logic/mapAnimation';
import {
  MAP_GOAL_SHOW_MS,
  MAP_SHOW_MS,
  MAP_STEPS,
  mapShowMs,
} from '../../../src/games/counting/logic/progressMap';
import type { MapMove } from '../../../src/games/counting/logic/progressMap';
import { layoutProgressMap } from '../../../src/games/counting/logic/progressMapLayout';
import type { ProgressMapLayout } from '../../../src/games/counting/logic/progressMapLayout';
import { gameAreaFor } from '../../../src/shared/logic/viewportLayout';
import { viewportOf } from '../../shared/viewportFixtures';
import type { TestWindow } from '../../shared/viewportFixtures';
import {
  LATEST_ARRIVAL_MS,
  allMoves,
  distanceAlongPath,
  samePoint,
  sampleTimes,
  shareOfStep,
} from './mapAnimationHelpers';
import type { MoveCase } from './mapAnimationHelpers';
import { MAP_WINDOWS } from './mapLayoutScenes';

/**
 * Testy k #135 AC1–AC4: značka jde po cestě mapy, místa se rozsvítí, až
 * na ně značka dojde, a cíl slaví. Testuje se čistá časová osa ukázání
 * mapy (`src/games/counting/logic/mapAnimation.ts`): kde je značka, co
 * svítí a jak cíl slaví v čase od ukázání mapy. Scéna ji jen kreslí.
 * Každé pravidlo má jeden test, který v cyklu projde všechna okna mapy
 * (`MAP_WINDOWS`), 5 map a všechny kroky včetně kroku nové mapy ze startu;
 * popis případu je ve zprávě `expect`.
 *
 * Navržené rozhraní (`mapAnimation.ts`, čistý TypeScript bez Phaseru):
 * - `markerShareAt(elapsedMs: number): number` jaký díl cesty z minulého
 *   na nové místo má značka za sebou v čase od ukázání mapy (0 až 1),
 * - `markerPointAt(layout, move, elapsedMs): MapPoint` kde značka je,
 * - `isPlaceLitAt(move, step, elapsedMs): boolean` svítí místo `step`?
 * - `goalCelebrationAt(move, elapsedMs): GoalCelebrationMoment` jak cíl
 *   slaví: `scale` (zvětšení symbolu cíle), `glowing` (září)
 *   a `confetti` (konfety v cíli už letí),
 * - `MAP_GOAL_CELEBRATION_SCALE` (1,3, upřesnění vzhledu z 2026-11-12).
 * Zvuky: `SOUNDS.mapStep` (zastávka, dnešní) a nová melodie `SOUNDS.mapGoal`
 * v `answerSounds.ts`.
 *
 * Ručně se kontroluje (AC3, AC5): jak pohyb, zlatá stopa, svatozář, záře
 * a konfety vypadají a že běží v 60 fps ve WebKitu na iPadu a iPhonu.
 */

interface LayoutCase extends MoveCase {
  readonly window: TestWindow;
  readonly layout: ProgressMapLayout;
}

/** Každý krok na každé mapě v každém okně mapy. */
function layoutCases(windows: readonly TestWindow[] = MAP_WINDOWS): LayoutCase[] {
  return windows.flatMap((window) => {
    const area = gameAreaFor(viewportOf(window));
    return allMoves().map(({ label, move }) => ({
      label: `${window.name}, ${label}`,
      move,
      window,
      layout: layoutProgressMap(area, move.theme),
    }));
  });
}

/** Kdy značka poprvé stojí na novém místě (ms od ukázání), nebo `null`. */
function arrivalMsIn(layout: ProgressMapLayout, move: MapMove): number | null {
  const target = layout.places[move.to];
  if (!target) {
    return null;
  }
  const time = sampleTimes(mapShowMs(move)).find((ms) =>
    samePoint(markerPointAt(layout, move, ms), target),
  );
  return time ?? null;
}

/**
 * Kdy značka poprvé dojde (podle podílu cesty), ms od ukázání mapy. Když
 * nedojde vůbec, vrátí čas po zavření mapy, aby testy času selhaly.
 */
function arrivalMs(move: MapMove): number {
  const showMs = mapShowMs(move);
  return sampleTimes(showMs).find((ms) => markerShareAt(ms) >= 1) ?? showMs + 1;
}

/** Krok, který dojde do cíle (z 2. zastávky). */
function goalMoves(): MoveCase[] {
  return allMoves().filter(({ move }) => move.reachedGoal);
}

function stopMoves(): MoveCase[] {
  return allMoves().filter(({ move }) => !move.reachedGoal);
}

describe('#135 AC1: značka jde po cestě z minulého místa na nové', () => {
  it('značka leží od ukázání mapy v každém okamžiku na cestě', () => {
    for (const { label, layout, move } of layoutCases()) {
      for (const ms of sampleTimes(mapShowMs(move))) {
        const point = markerPointAt(layout, move, ms);
        expect(distanceAlongPath(layout.places, point), `${label}, ${ms} ms`).not.toBeNull();
      }
    }
  });

  it('vzdálenost značky od startu měřená po cestě s časem nikdy neklesá', () => {
    for (const { label, layout, move } of layoutCases()) {
      let before = -Infinity;
      for (const ms of sampleTimes(mapShowMs(move))) {
        const walked = distanceAlongPath(layout.places, markerPointAt(layout, move, ms)) ?? -1;
        expect(walked, `${label}, ${ms} ms`).toBeGreaterThanOrEqual(before - 0.01);
        before = walked;
      }
    }
  });

  it('v čase 0 stojí značka na minulém místě, u nové mapy na startu', () => {
    for (const { label, layout, move } of layoutCases()) {
      const previous = layout.places[move.from];
      expect(previous, label).toBeDefined();
      if (previous) {
        expect(samePoint(markerPointAt(layout, move, 0), previous), label).toBe(true);
      }
    }
  });

  it('nová mapa po cíli začíná se značkou na startu, ne v cíli', () => {
    const afterGoal = allMoves().filter(({ label }) => label.startsWith('nová mapa'));
    expect(afterGoal.length).toBeGreaterThan(0);
    for (const { label, move } of afterGoal) {
      expect(move.from, label).toBe(0);
      expect(markerShareAt(0), label).toBe(0);
    }
  });

  it('nejpozději za 1,5 s stojí značka na novém místě a do zavření mapy se už nehýbe', () => {
    for (const { label, layout, move } of layoutCases()) {
      const target = layout.places[move.to];
      expect(target, label).toBeDefined();
      if (!target) {
        continue;
      }
      for (const ms of sampleTimes(mapShowMs(move), LATEST_ARRIVAL_MS)) {
        expect(samePoint(markerPointAt(layout, move, ms), target), `${label}, ${ms} ms`).toBe(true);
      }
    }
  });

  it('značka opravdu jde: mezi začátkem a dojitím je vidět i cestou mezi místy', () => {
    for (const { label, layout, move } of layoutCases()) {
      const arrived = arrivalMsIn(layout, move);
      expect(arrived, label).not.toBeNull();
      const halfway = sampleTimes(arrived ?? 0).some((ms) => {
        const share = shareOfStep(layout.places, move, markerPointAt(layout, move, ms));
        return share !== null && share > 0.25 && share < 0.75;
      });
      expect(halfway, `${label}: značka nepřeskočí, ale jde po cestě`).toBe(true);
    }
  });

  it('díl prošlé cesty je od 0 do 1, v čase 0 je 0 a nejpozději v 1,5 s je 1', () => {
    expect(markerShareAt(0)).toBe(0);
    expect(markerShareAt(LATEST_ARRIVAL_MS)).toBe(1);
    let before = 0;
    for (const ms of sampleTimes(MAP_GOAL_SHOW_MS)) {
      const share = markerShareAt(ms);
      expect(share, `${ms} ms`).toBeGreaterThanOrEqual(before);
      expect(share, `${ms} ms`).toBeLessThanOrEqual(1);
      before = share;
    }
  });
});

describe('#135 AC2: prošlá místa svítí a nové se rozsvítí, až na něm značka zastaví', () => {
  it('místa, kterými značka už prošla, svítí po celou dobu mapy', () => {
    for (const { label, move } of allMoves()) {
      for (const ms of sampleTimes(mapShowMs(move))) {
        for (let step = 0; step <= move.from; step += 1) {
          expect(isPlaceLitAt(move, step, ms), `${label}, místo ${step}, ${ms} ms`).toBe(true);
        }
      }
    }
  });

  it('místa za novým místem jsou celou dobu zhasnutá', () => {
    for (const { label, move } of allMoves()) {
      for (const ms of sampleTimes(mapShowMs(move))) {
        for (let step = move.to + 1; step <= MAP_STEPS; step += 1) {
          expect(isPlaceLitAt(move, step, ms), `${label}, místo ${step}, ${ms} ms`).toBe(false);
        }
      }
    }
  });

  it('nové místo je zhasnuté, dokud na něm značka nezastaví, a od té chvíle svítí', () => {
    for (const { label, layout, move } of layoutCases()) {
      const target = layout.places[move.to];
      if (!target) {
        continue;
      }
      for (const ms of sampleTimes(mapShowMs(move))) {
        const markerThere = samePoint(markerPointAt(layout, move, ms), target);
        expect(isPlaceLitAt(move, move.to, ms), `${label}, ${ms} ms`).toBe(markerThere);
      }
    }
  });

  it('zvuk zastávky je krátký, kratší než 1 s', () => {
    expect(soundLengthSeconds(SOUNDS.mapStep)).toBeGreaterThan(0);
    expect(soundLengthSeconds(SOUNDS.mapStep)).toBeLessThan(1);
  });

  it('značka dojde na zastávku a zvuk dohraje dřív, než se mapa po 3 s zavře', () => {
    for (const { label, move } of stopMoves()) {
      const end = arrivalMs(move) + soundLengthSeconds(SOUNDS.mapStep) * 1000;
      expect(end, label).toBeLessThanOrEqual(MAP_SHOW_MS);
    }
  });
});

describe('#135 AC3: v cíli se symbol cíle zvětší a zazáří, zazní melodie a přijdou konfety', () => {
  it('symbol cíle začne slavit až po zastavení značky v cíli, ne dřív', () => {
    for (const { label, move } of goalMoves()) {
      const arrived = arrivalMs(move);
      for (const ms of sampleTimes(arrived).filter((time) => time < arrived)) {
        const moment = goalCelebrationAt(move, ms);
        expect(moment, `${label}, ${ms} ms před dojitím`).toEqual({
          scale: 1,
          glowing: false,
          confetti: false,
        });
      }
    }
  });

  it('po dojití do cíle se symbol zvětší na 1,3× a zazáří', () => {
    expect(MAP_GOAL_CELEBRATION_SCALE).toBe(1.3);
    for (const { label, move } of goalMoves()) {
      const moments = sampleTimes(MAP_GOAL_SHOW_MS, arrivalMs(move)).map((ms) =>
        goalCelebrationAt(move, ms),
      );
      const biggest = Math.max(...moments.map((moment) => moment.scale));
      expect(biggest, label).toBeCloseTo(MAP_GOAL_CELEBRATION_SCALE, 6);
      expect(
        moments.some((moment) => moment.glowing),
        `${label}: cíl zazáří`,
      ).toBe(true);
    }
  });

  it('symbol cíle se nikdy nezmenší pod svou velikost ani nepřeroste 1,3×', () => {
    for (const { label, move } of goalMoves()) {
      for (const ms of sampleTimes(MAP_GOAL_SHOW_MS)) {
        const { scale } = goalCelebrationAt(move, ms);
        expect(scale, `${label}, ${ms} ms`).toBeGreaterThanOrEqual(1);
        expect(scale, `${label}, ${ms} ms`).toBeLessThanOrEqual(MAP_GOAL_CELEBRATION_SCALE + 1e-9);
      }
    }
  });

  it('konfety v cíli přijdou až po dojití značky a ještě během zobrazení mapy', () => {
    for (const { label, move } of goalMoves()) {
      const arrived = arrivalMs(move);
      const confettiFrom = sampleTimes(MAP_GOAL_SHOW_MS).find(
        (ms) => goalCelebrationAt(move, ms).confetti,
      );
      expect(confettiFrom, `${label}: konfety v cíli přijdou`).toBeDefined();
      expect(confettiFrom ?? -1, label).toBeGreaterThanOrEqual(arrived);
      expect(confettiFrom ?? Infinity, label).toBeLessThan(MAP_GOAL_SHOW_MS);
    }
  });

  it('na zastávce cíl neslaví: nezvětší se, nezáří a konfety v cíli nepřijdou', () => {
    for (const { label, move } of stopMoves()) {
      for (const ms of sampleTimes(mapShowMs(move))) {
        expect(goalCelebrationAt(move, ms), `${label}, ${ms} ms`).toEqual({
          scale: 1,
          glowing: false,
          confetti: false,
        });
      }
    }
  });

  it('melodie v cíli je krátká, kratší než 2 s, a jiná než zvuk zastávky', () => {
    expect(SOUNDS.mapGoal).toBeDefined();
    const length = soundLengthSeconds(SOUNDS.mapGoal);
    expect(length).toBeGreaterThan(0);
    expect(length).toBeLessThan(2);
    expect(SOUNDS.mapGoal).not.toEqual(SOUNDS.mapStep);
  });

  it('pohyb (nejvýš 1,5 s) i melodie se vejdou do 5 s zobrazení mapy v cíli', () => {
    expect(MAP_GOAL_SHOW_MS).toBeLessThanOrEqual(5000);
    for (const { label, move } of goalMoves()) {
      expect(mapShowMs(move), label).toBe(MAP_GOAL_SHOW_MS);
      const arrived = arrivalMs(move);
      expect(arrived, label).toBeLessThanOrEqual(LATEST_ARRIVAL_MS);
      const melodyEnd = arrived + soundLengthSeconds(SOUNDS.mapGoal) * 1000;
      expect(melodyEnd, label).toBeLessThanOrEqual(MAP_GOAL_SHOW_MS);
    }
  });

  it('cíl doslaví (plná velikost 1,3×) dřív, než se mapa sama zavře', () => {
    for (const { label, move } of goalMoves()) {
      const fullFrom = sampleTimes(MAP_GOAL_SHOW_MS).find(
        (ms) => goalCelebrationAt(move, ms).scale >= MAP_GOAL_CELEBRATION_SCALE - 1e-6,
      );
      expect(fullFrom, label).toBeDefined();
      expect(fullFrom ?? Infinity, label).toBeLessThan(MAP_GOAL_SHOW_MS);
    }
  });
});

/** Okno po otočení zařízení: stejné okno s prohozenou šířkou a výškou. */
function rotatedPairs(): Array<[TestWindow, TestWindow]> {
  const pairs: Array<[TestWindow, TestWindow]> = [];
  for (const before of MAP_WINDOWS) {
    for (const after of MAP_WINDOWS) {
      if (before.width === after.height && before.height === after.width) {
        pairs.push([before, after]);
      }
    }
  }
  // Každé okno se otočí aspoň do jednoho okna druhé orientace.
  const landscape = MAP_WINDOWS.filter((window) => window.width > window.height);
  const portrait = MAP_WINDOWS.filter((window) => window.width <= window.height);
  const [firstPortrait] = portrait;
  const [firstLandscape] = landscape;
  if (firstPortrait && firstLandscape) {
    for (const window of landscape) {
      pairs.push([window, firstPortrait]);
    }
    for (const window of portrait) {
      pairs.push([window, firstLandscape]);
    }
  }
  return pairs;
}

/** Okamžiky otočení během pohybu značky v ms od ukázání mapy. */
const ROTATION_TIMES_MS = [0, 200, 500, 800, 1100, 1400];

describe('#135 AC4: po otočení zařízení značka pokračuje ze stejného podílu cesty', () => {
  it('po otočení stojí značka v novém rozložení na stejném dílu cesty jako před ním', () => {
    const pairs = rotatedPairs();
    expect(pairs.length).toBeGreaterThan(0);
    for (const [before, after] of pairs) {
      const areaBefore = gameAreaFor(viewportOf(before));
      const areaAfter = gameAreaFor(viewportOf(after));
      for (const { label, move } of allMoves()) {
        const layoutBefore = layoutProgressMap(areaBefore, move.theme);
        const layoutAfter = layoutProgressMap(areaAfter, move.theme);
        for (const ms of ROTATION_TIMES_MS) {
          const shareBefore = shareOfStep(
            layoutBefore.places,
            move,
            markerPointAt(layoutBefore, move, ms),
          );
          const shareAfter = shareOfStep(
            layoutAfter.places,
            move,
            markerPointAt(layoutAfter, move, ms),
          );
          const where = `${before.name} → ${after.name}, ${label}, otočení v ${ms} ms`;
          expect(shareBefore, where).not.toBeNull();
          expect(shareAfter, where).not.toBeNull();
          expect(shareAfter ?? -1, where).toBeCloseTo(shareBefore ?? -2, 3);
        }
      }
    }
  });

  it('po otočení dojde značka na nové místo ve stejném čase jako bez otočení', () => {
    for (const [before, after] of rotatedPairs()) {
      const areaBefore = gameAreaFor(viewportOf(before));
      const areaAfter = gameAreaFor(viewportOf(after));
      for (const { label, move } of allMoves()) {
        const withoutRotation = arrivalMsIn(layoutProgressMap(areaBefore, move.theme), move);
        const afterRotation = arrivalMsIn(layoutProgressMap(areaAfter, move.theme), move);
        const where = `${before.name} → ${after.name}, ${label}`;
        expect(withoutRotation, where).not.toBeNull();
        expect(afterRotation, where).toBe(withoutRotation);
      }
    }
  });

  it('po otočení se značka dál jen přibližuje k novému místu, nikdy necouvne', () => {
    for (const [before, after] of rotatedPairs()) {
      const areaBefore = gameAreaFor(viewportOf(before));
      const areaAfter = gameAreaFor(viewportOf(after));
      for (const { label, move } of allMoves()) {
        const layoutBefore = layoutProgressMap(areaBefore, move.theme);
        const layoutAfter = layoutProgressMap(areaAfter, move.theme);
        for (const rotatedAt of ROTATION_TIMES_MS) {
          const where = `${before.name} → ${after.name}, ${label}, otočení v ${rotatedAt} ms`;
          let last =
            shareOfStep(layoutBefore.places, move, markerPointAt(layoutBefore, move, rotatedAt)) ??
            0;
          for (const ms of sampleTimes(LATEST_ARRIVAL_MS, rotatedAt)) {
            const share =
              shareOfStep(layoutAfter.places, move, markerPointAt(layoutAfter, move, ms)) ?? -1;
            expect(share, `${where}, ${ms} ms`).toBeGreaterThanOrEqual(last - 1e-3);
            last = share;
          }
        }
      }
    }
  });
});
