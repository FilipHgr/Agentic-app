/**
 * Pomůcky pro testy animace mapy postupu (#135): kroky, které mapa může
 * ukázat, kde na cestě značka stojí (vzdálenost od startu měřená po cestě)
 * a časy, ve kterých se značka a místa kontrolují.
 *
 * Cesta vede od #146 oblouky od místa k místu po řadě (dřív rovnými
 * úseky, #133 AC7), takže „na cestě“ znamená ležet na některém z oblouků.
 */

import { MAP_STEPS, MAP_THEMES, stepOnMap } from '../../../src/games/counting/logic/progressMap';
import type { MapMove, MapThemeId } from '../../../src/games/counting/logic/progressMap';
import type {
  MapPoint,
  ProgressMapLayout,
} from '../../../src/games/counting/logic/progressMapLayout';
import { denseArcOf, projectOntoArc } from './mapPathHelpers';

/** Tolerance polohy v herních jednotkách (zaokrouhlení). */
export const POINT_TOLERANCE = 0.01;

/**
 * Nejpozději tehdy značka dojde na nové místo, v ms od ukázání mapy.
 * #135 AC1 dával 1,5 s; podle #154 AC3 značka vyrazí až po letu hvězdiček
 * do mapy (nejvýš 0,6 s), takže hranice je 1,5 s + 0,6 s. Že značka dojde
 * nejvýš 1,5 s po doletu, hlídá `starFlight.test.ts`.
 */
export const LATEST_ARRIVAL_MS = 1500 + 600;

/** Po kolika ms se značka a místa kontrolují. */
export const SAMPLE_STEP_MS = 10;

/** Krok mapy s popisem případu. */
export interface MoveCase {
  readonly label: string;
  readonly move: MapMove;
}

/**
 * Všechny kroky, které mapa může ukázat, na každé z 5 map: ze startu na
 * 1. zastávku, z 1. na 2., z 2. do cíle a z cíle předchozí mapy na
 * 1. zastávku nové mapy (minulým místem je start).
 */
export function allMoves(): MoveCase[] {
  return MAP_THEMES.flatMap((theme, index) => movesOn(theme, index));
}

function movesOn(theme: MapThemeId, completedMaps: number): MoveCase[] {
  const fromSteps = Array.from({ length: MAP_STEPS }, (_, step) => step);
  const ordinary = fromSteps.map((step) => {
    const { move } = stepOnMap({ step, completedMaps });
    return { label: `mapa ${theme}, krok ${move.from} → ${move.to}`, move };
  });
  // Ze cíle předchozí mapy začíná nová mapa: hráč s `completedMaps` mapami stojí v cíli.
  const afterGoal = stepOnMap({ step: MAP_STEPS, completedMaps }).move;
  return [
    ...ordinary,
    {
      label: `nová mapa ${afterGoal.theme} po cíli, krok ${afterGoal.from} → ${afterGoal.to}`,
      move: afterGoal,
    },
  ];
}

/** Časy 0, 10, 20 … až `untilMs` včetně (a vždy i přesně `untilMs`). */
export function sampleTimes(untilMs: number, fromMs = 0): number[] {
  const times: number[] = [];
  for (let time = fromMs; time < untilMs; time += SAMPLE_STEP_MS) {
    times.push(time);
  }
  times.push(untilMs);
  return times;
}

export function distance(a: MapPoint, b: MapPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function samePoint(a: MapPoint, b: MapPoint): boolean {
  return distance(a, b) <= POINT_TOLERANCE;
}

/**
 * Jak daleko od startu je `point`, měřeno po oblouku cesty (#146), nebo
 * `null`, když bod na oblouku neleží (dál než `POINT_TOLERANCE`).
 * #146: dřív se cesta měřila po rovných úsecích mezi `places`; teď po
 * hustém oblouku z `mapPathHelpers.ts` se stejnou tolerancí.
 */
export function distanceAlongPath(layout: ProgressMapLayout, point: MapPoint): number | null {
  // Testy se ptají na stejné body mnohokrát (otočení v různých chvílích), výsledek se pamatuje.
  const remembered = alongCache.get(layout) ?? new Map<string, number | null>();
  alongCache.set(layout, remembered);
  const key = `${point.x},${point.y}`;
  const known = remembered.get(key);
  if (known !== undefined) {
    return known;
  }
  const projection = projectOntoArc(denseArcOf(layout), point);
  const along = projection.distance <= POINT_TOLERANCE ? projection.along : null;
  remembered.set(key, along);
  return along;
}

const alongCache = new WeakMap<ProgressMapLayout, Map<string, number | null>>();

/**
 * Jaký díl cesty z místa `move.from` na místo `move.to` má značka v bodě
 * `point` za sebou (0 na minulém místě, 1 na novém), měřeno po oblouku
 * (#146), nebo `null` mimo cestu.
 */
export function shareOfStep(
  layout: ProgressMapLayout,
  move: MapMove,
  point: MapPoint,
): number | null {
  const walked = distanceAlongPath(layout, point);
  const { placeAlong } = denseArcOf(layout);
  const start = placeAlong[move.from];
  const end = placeAlong[move.to];
  if (start === undefined || end === undefined || walked === null) {
    return null;
  }
  return (walked - start) / (end - start);
}
