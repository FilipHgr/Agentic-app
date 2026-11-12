/**
 * Pomůcky pro testy animace mapy postupu (#135): kroky, které mapa může
 * ukázat, kde na cestě značka stojí (vzdálenost od startu měřená po cestě)
 * a časy, ve kterých se značka a místa kontrolují.
 *
 * Cesta vede rovnými úseky od místa k místu po řadě (#133 AC7), takže
 * „na cestě“ znamená ležet na některém z těchto úseků.
 */

import { MAP_STEPS, MAP_THEMES, stepOnMap } from '../../../src/games/counting/logic/progressMap';
import type { MapMove, MapThemeId } from '../../../src/games/counting/logic/progressMap';
import type { MapPoint } from '../../../src/games/counting/logic/progressMapLayout';

/** Tolerance polohy v herních jednotkách (zaokrouhlení). */
export const POINT_TOLERANCE = 0.01;

/** Nejpozději tehdy značka dojde na nové místo (AC1), v ms. */
export const LATEST_ARRIVAL_MS = 1500;

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

/** Vzdálenost bodu `point` od úseku `a`–`b`. */
function distanceToSegment(point: MapPoint, a: MapPoint, b: MapPoint): number {
  const length = distance(a, b);
  if (length === 0) {
    return distance(point, a);
  }
  const along = ((point.x - a.x) * (b.x - a.x) + (point.y - a.y) * (b.y - a.y)) / length ** 2;
  const clamped = Math.min(Math.max(along, 0), 1);
  return distance(point, { x: a.x + (b.x - a.x) * clamped, y: a.y + (b.y - a.y) * clamped });
}

/**
 * Jak daleko od startu je `point`, měřeno po cestě přes `places`, nebo
 * `null`, když bod na cestě neleží.
 */
export function distanceAlongPath(places: readonly MapPoint[], point: MapPoint): number | null {
  let walked = 0;
  for (let index = 0; index + 1 < places.length; index += 1) {
    const a = places[index];
    const b = places[index + 1];
    if (!a || !b) {
      continue;
    }
    if (distanceToSegment(point, a, b) <= POINT_TOLERANCE) {
      return walked + distance(a, point);
    }
    walked += distance(a, b);
  }
  return null;
}

/**
 * Jaký díl cesty z místa `move.from` na místo `move.to` má značka v bodě
 * `point` za sebou (0 na minulém místě, 1 na novém), nebo `null` mimo cestu.
 */
export function shareOfStep(
  places: readonly MapPoint[],
  move: MapMove,
  point: MapPoint,
): number | null {
  const from = places[move.from];
  const to = places[move.to];
  const walked = distanceAlongPath(places, point);
  if (!from || !to || walked === null) {
    return null;
  }
  const start = distanceAlongPath(places, from) ?? 0;
  const end = distanceAlongPath(places, to) ?? 0;
  return (walked - start) / (end - start);
}
