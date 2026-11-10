import { afterEach, describe, expect, it, vi } from 'vitest';

import { createGlitterShine } from '../../../src/games/coloring/logic/glitterShine';
import type { GlitterShine, ShineSpark } from '../../../src/games/coloring/logic/glitterShine';
import type { Point } from './outlineFixtures';
import { seededRandom } from './recentColorsHelpers';
import { at } from './strokeHelpers';

/**
 * Testy k #103 AC3 (lesk během tahu), první část: lesklé jiskry, které
 * během tahu odlétají od prstu. Jsou jen animace pro scénu, do obrázku se
 * nezapíšou a do 1 s po zvednutí prstu zmizí. Že se nezapíšou do obrázku,
 * uloženého záznamu ani do Zpět, hlídá `glitterRecord.test.ts` (AC3, druhá
 * část) a `glitterStrokes.test.ts` (jiskry v obrázku nezávisí na náhodě).
 *
 * Lesk losuje (kam jiskra odletí), proto dostane vlastní generátor
 * náhodných čísel; testy mu předají generátor s pevným seedem. Čas je
 * v milisekundách od libovolného začátku, jak ho scéna dostane od Phaseru.
 * Že je lesk bílý (otevřená otázka 2) a běží v 60 fps, je ruční kontrola.
 *
 * Navržené rozhraní (`src/games/coloring/logic/glitterShine.ts`, čistý
 * TypeScript bez Phaseru):
 * - `createGlitterShine({ random, brushWidth })`: `random` vrací čísla
 *   z [0, 1), `brushWidth` je W tahu v pixelech vrstvy barev (podle něj
 *   lesk odměří, jak daleko jiskry odletí),
 * - `fingerAt(point, timeMs)`: prst s třpytkami je během tahu v bodě
 *   `point` (pixely vrstvy barev),
 * - `fingerLifted(timeMs)`: tah skončil (zvednutí, přerušení, schování
 *   stránky); nové jiskry už nepřibývají,
 * - `sparksAt(timeMs)`: lesklé jiskry k vykreslení v čase `timeMs`
 *   (`ShineSpark`: `x`, `y` v pixelech vrstvy barev, `size` a `opacity`
 *   z (0, 1]); prázdný seznam, když není co kreslit.
 */

/** W stř obrázku 900 px. */
const BRUSH_WIDTH = 30;

/** Jeden snímek při 60 fps v milisekundách. */
const FRAME_MS = 1000 / 60;

/** Do kolika milisekund po zvednutí prstu lesk zmizí (#103 AC3). */
const FADE_LIMIT_MS = 1000;

function shine(seed = 103): GlitterShine {
  return createGlitterShine({ random: seededRandom(seed), brushWidth: BRUSH_WIDTH });
}

/**
 * Tah prstem po bodech `path` od času `startMs`, jeden bod na snímek.
 * Vrátí čas posledního bodu.
 */
function moveAlong(target: GlitterShine, path: readonly Point[], startMs = 0): number {
  let time = startMs;
  path.forEach((point, index) => {
    time = startMs + index * FRAME_MS;
    target.fingerAt(point, time);
  });
  return time;
}

/** Vodorovný tah 300 px dlouhý za 0,5 s (po 10 px na snímek). */
const SWIPE: readonly Point[] = Array.from({ length: 31 }, (_, step) => at(100 + 10 * step, 300));

/** Prst se 0,5 s nehne z místa. */
const HOLD: readonly Point[] = Array.from({ length: 31 }, () => at(450, 300));

function distance(spark: ShineSpark, point: Point): number {
  return Math.hypot(spark.x - point.x, spark.y - point.y);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('#103 AC3: během tahu odlétají od prstu lesklé jiskry', () => {
  it('během tahu třpytkami jsou u prstu vidět lesklé jiskry', () => {
    const target = shine();
    let time = 0;
    SWIPE.forEach((point, index) => {
      time = index * FRAME_MS;
      target.fingerAt(point, time);
      if (index >= 3) {
        const sparks = target.sparksAt(time);
        expect(sparks.length, `snímek ${index}: jiskry lesku`).toBeGreaterThan(0);
        for (const spark of sparks) {
          expect(spark.opacity, `snímek ${index}: jiskra je vidět`).toBeGreaterThan(0);
          expect(spark.opacity, `snímek ${index}: neprůhlednost`).toBeLessThanOrEqual(1);
          expect(spark.size, `snímek ${index}: velikost`).toBeGreaterThan(0);
        }
      }
    });
  });

  it('jiskry od prstu odlétají: i když se prst nehýbe, jsou jiskry i dál od něj', () => {
    const target = shine();
    const finger = at(450, 300);

    const time = moveAlong(target, HOLD);

    const sparks = target.sparksAt(time);
    expect(sparks.length, 'jiskry lesku').toBeGreaterThan(0);
    const farthest = Math.max(...sparks.map((spark) => distance(spark, finger)));
    expect(farthest, 'nejvzdálenější jiskra od prstu').toBeGreaterThan(BRUSH_WIDTH / 2);
  });

  it('při dlouhém tahu se jiskry nehromadí: po 30 s jich není o moc víc než po 1 s', () => {
    const target = shine();
    const finger = (step: number): Point => at(450 + 200 * Math.sin(step / 20), 300);
    let afterOneSecond = 0;
    let time = 0;
    for (let step = 0; step * FRAME_MS <= 30_000; step += 1) {
      time = step * FRAME_MS;
      target.fingerAt(finger(step), time);
      if (afterOneSecond === 0 && time >= 1000) {
        afterOneSecond = target.sparksAt(time).length;
      }
    }

    expect(afterOneSecond, 'po 1 s jsou jiskry').toBeGreaterThan(0);
    expect(target.sparksAt(time).length, 'po 30 s').toBeLessThanOrEqual(2 * afterOneSecond);
  });
});

describe('#103 AC3: do 1 s po zvednutí prstu lesk zmizí', () => {
  it('do 1 s po zvednutí prstu zmizí všechny lesklé jiskry a už se neobjeví', () => {
    for (const [name, path] of [
      ['tah', SWIPE],
      ['prst na místě', HOLD],
    ] as const) {
      const target = shine();
      const lifted = moveAlong(target, path);
      expect(target.sparksAt(lifted).length, `${name}: při zvednutí jsou jiskry`).toBeGreaterThan(
        0,
      );

      target.fingerLifted(lifted);

      for (const after of [FADE_LIMIT_MS, FADE_LIMIT_MS + 1, 1500, 5000, 60_000]) {
        expect(target.sparksAt(lifted + after), `${name}: ${after} ms po zvednutí`).toEqual([]);
      }
    }
  });

  it('po zvednutí prstu jisker jen ubývá, nové nepřibývají', () => {
    const target = shine();
    const lifted = moveAlong(target, SWIPE);
    target.fingerLifted(lifted);

    let previous = target.sparksAt(lifted).length;
    for (let after = FRAME_MS; after <= FADE_LIMIT_MS; after += FRAME_MS) {
      const count = target.sparksAt(lifted + after).length;
      expect(count, `${after.toFixed(0)} ms po zvednutí`).toBeLessThanOrEqual(previous);
      previous = count;
    }
  });

  it('další tah po zvednutí prstu zase jiskří a i jeho lesk do 1 s po zvednutí zmizí', () => {
    const target = shine();
    const firstLift = moveAlong(target, SWIPE);
    target.fingerLifted(firstLift);

    const secondStart = firstLift + 2000;
    const secondLift = moveAlong(target, [...SWIPE].reverse(), secondStart);

    expect(target.sparksAt(secondLift).length, 'druhý tah jiskří').toBeGreaterThan(0);
    target.fingerLifted(secondLift);
    expect(target.sparksAt(secondLift + FADE_LIMIT_MS), 'po druhém zvednutí').toEqual([]);
  });

  it('zvednutí bez tahu ani lesk bez tahu nic nenakreslí a hru nezastaví', () => {
    const target = shine();

    expect(() => target.fingerLifted(0)).not.toThrow();
    expect(target.sparksAt(0)).toEqual([]);
    expect(target.sparksAt(500)).toEqual([]);
  });
});

describe('#103 AC3: lesk dopadne pokaždé stejně a nesahá na Math.random', () => {
  it('se stejnou řadou náhodných čísel je lesk stejný', () => {
    const first = shine(7);
    const second = shine(7);
    const lifted = moveAlong(first, SWIPE);
    moveAlong(second, SWIPE);
    first.fingerLifted(lifted);
    second.fingerLifted(lifted);

    for (const after of [0, 100, 400, 900]) {
      expect(second.sparksAt(lifted + after), `${after} ms po zvednutí`).toEqual(
        first.sparksAt(lifted + after),
      );
    }
  });

  it('lesk losuje jen z předaného generátoru, Math.random nepoužije', () => {
    const mathRandom = vi.spyOn(Math, 'random');
    const target = shine();

    const lifted = moveAlong(target, SWIPE);
    target.sparksAt(lifted);
    target.fingerLifted(lifted);
    target.sparksAt(lifted + 300);

    expect(mathRandom).not.toHaveBeenCalled();
  });
});
