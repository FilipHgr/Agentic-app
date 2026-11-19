/**
 * Pomůcky pro testy oblouků cesty na mapě postupu (#146): body oblouku
 * vzorkované po dílu délky, hustý oblouk celé cesty, nejbližší bod oblouku
 * k bodu (vzdálenost a ušlá délka od startu) a mapy v kartě (#145) ve
 * všech oknech mapy z #133 AC7.
 *
 * Navržené rozhraní `src/games/counting/logic/progressMapLayout.ts` (čistý
 * TypeScript bez Phaseru, v herních jednotkách jako rozložení mapy):
 * - `pathPointAt(layout: ProgressMapLayout, segment: number, share: number): MapPoint`
 *   bod na oblouku úseku z místa `segment` na místo `segment + 1`; `share`
 *   je díl délky oblouku (0 na minulém místě, 1 na dalším, 0,5 v půli
 *   délky oblouku, ne v půli parametru křivky),
 * - `pathLinePoints(layout: ProgressMapLayout, segment: number): readonly MapPoint[]`
 *   lomená čára, kterou scéna kreslí čáru cesty úseku (od místa `segment`
 *   po místo `segment + 1`), dost hustá, aby byla od oblouku nejvýš 1 CSS px.
 * Navržené rozhraní `src/games/counting/logic/mapAnimation.ts`:
 * - `markerPointAt(layout, move, elapsedMs): MapPoint` zůstává, jen značka
 *   jde po oblouku a díl ušlé délky oblouku odpovídá `markerShareAt`,
 * - `interface MarkerTrail { points: readonly MapPoint[]; sparkles: readonly MapPoint[] }`:
 *   `points` lomená čára zlaté stopy od jejího konce ke značce, `sparkles`
 *   středy jiskřiček na stopě,
 * - `markerTrailAt(layout, move, elapsedMs): MarkerTrail | null` stopa
 *   v čase od ukázání mapy, `null`, když značka nejde (stojí před
 *   vyražením nebo už došla).
 */

import { MAP_STEPS, MAP_THEMES } from '../../../src/games/counting/logic/progressMap';
import type { MapThemeId } from '../../../src/games/counting/logic/progressMap';
import {
  layoutProgressMap,
  pathPointAt,
} from '../../../src/games/counting/logic/progressMapLayout';
import type {
  MapArea,
  MapPoint,
  ProgressMapLayout,
} from '../../../src/games/counting/logic/progressMapLayout';
import type { TestWindow } from '../../shared/viewportFixtures';
import { cardWindowCase } from './mapCardScenes';
import type { CardWindowCase } from './mapCardScenes';
import { MAP_WINDOWS } from './mapLayoutScenes';

export { MAP_WINDOWS };

/** Počet úseků cesty: start → 1. zastávka → 2. zastávka → cíl. */
export const SEGMENT_COUNT = MAP_STEPS;

/** Po kolika dílech délky úseku se oblouk vzorkuje pro plynulost (AC1: 1 %). */
export const SMOOTHNESS_SAMPLES = 100;

/** Kolik bodů na úsek má hustý oblouk, od kterého se měří vzdálenosti. */
const DENSE_SAMPLES = 400;

/** Mapa v kartě jednoho okna. */
export interface ArcCase {
  readonly label: string;
  readonly window: TestWindow;
  readonly theme: MapThemeId;
  readonly card: CardWindowCase['card'];
  readonly area: MapArea;
  readonly layout: ProgressMapLayout;
}

export function arcCase(window: TestWindow, theme: MapThemeId): ArcCase {
  const { card } = cardWindowCase(window);
  return {
    label: `${window.name}, karta, mapa ${theme}`,
    window,
    theme,
    card,
    area: card.area,
    layout: layoutProgressMap(card.area, theme),
  };
}

let cachedArcCases: ArcCase[] | undefined;

/** Každé okno mapy × 5 map, mapa v kartě (#145). */
export function arcCases(): ArcCase[] {
  cachedArcCases ??= MAP_WINDOWS.flatMap((window) =>
    MAP_THEMES.map((theme) => arcCase(window, theme)),
  );
  return cachedArcCases;
}

export function segmentName(segment: number): string {
  return `úsek ${segment} → ${segment + 1}`;
}

export function distance(a: MapPoint, b: MapPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Body oblouku úseku po `1 / count` délky: `count + 1` bodů od minulého místa po další. */
export function arcSamples(layout: ProgressMapLayout, segment: number, count: number): MapPoint[] {
  return Array.from({ length: count + 1 }, (_, index) =>
    pathPointAt(layout, segment, index / count),
  );
}

/** Délka lomené čáry. */
export function polylineLength(points: readonly MapPoint[]): number {
  let length = 0;
  for (let index = 1; index < points.length; index += 1) {
    const before = points[index - 1];
    const point = points[index];
    if (before && point) {
      length += distance(before, point);
    }
  }
  return length;
}

/** Hustý oblouk celé cesty: body, ušlá délka od startu a úsek každého bodu. */
export interface DenseArc {
  readonly points: readonly MapPoint[];
  readonly along: readonly number[];
  /** Ušlá délka od startu na každém místě (index = krok 0 až 3). */
  readonly placeAlong: readonly number[];
}

const denseCache = new WeakMap<ProgressMapLayout, DenseArc>();

export function denseArcOf(layout: ProgressMapLayout): DenseArc {
  const cached = denseCache.get(layout);
  if (cached) {
    return cached;
  }
  const points: MapPoint[] = [];
  const along: number[] = [];
  const placeAlong: number[] = [0];
  let walked = 0;
  for (let segment = 0; segment < SEGMENT_COUNT; segment += 1) {
    const samples = arcSamples(layout, segment, DENSE_SAMPLES);
    samples.forEach((point, index) => {
      if (segment > 0 && index === 0) {
        return;
      }
      const before = points[points.length - 1];
      walked += before ? distance(before, point) : 0;
      points.push(point);
      along.push(walked);
    });
    placeAlong.push(walked);
  }
  const dense = { points, along, placeAlong };
  denseCache.set(layout, dense);
  return dense;
}

/** Nejbližší bod oblouku k bodu: vzdálenost od oblouku a ušlá délka od startu. */
export interface ArcProjection {
  readonly distance: number;
  readonly along: number;
}

export function projectOntoArc(dense: DenseArc, point: MapPoint): ArcProjection {
  // Nejdřív hrubě po každém `COARSE_STRIDE`. bodu, pak jemně kolem nejbližšího hrubého dílku.
  const last = dense.points.length - 1;
  let coarseBest = 0;
  let coarseGap = Number.POSITIVE_INFINITY;
  for (let index = COARSE_STRIDE; index <= last + COARSE_STRIDE - 1; index += COARSE_STRIDE) {
    const end = Math.min(index, last);
    const gap = projectOntoEdge(dense, end - COARSE_STRIDE, end, point).distance;
    if (gap < coarseGap) {
      coarseGap = gap;
      coarseBest = end;
    }
  }
  const from = Math.max(1, coarseBest - 2 * COARSE_STRIDE);
  const to = Math.min(last, coarseBest + 2 * COARSE_STRIDE);
  let best: ArcProjection = { distance: Number.POSITIVE_INFINITY, along: 0 };
  for (let index = from; index <= to; index += 1) {
    const candidate = projectOntoEdge(dense, index - 1, index, point);
    if (candidate.distance < best.distance) {
      best = candidate;
    }
  }
  return best;
}

/** Po kolika bodech hustého oblouku se hledá nejbližší místo nahrubo. */
const COARSE_STRIDE = 10;

/** Nejbližší bod dílku hustého oblouku mezi body `first` a `second`. */
function projectOntoEdge(
  dense: DenseArc,
  first: number,
  second: number,
  point: MapPoint,
): ArcProjection {
  const a = dense.points[Math.max(first, 0)] ?? point;
  const b = dense.points[second] ?? a;
  const alongA = dense.along[Math.max(first, 0)] ?? 0;
  const alongB = dense.along[second] ?? alongA;
  const length = distance(a, b);
  const share =
    length === 0
      ? 0
      : Math.min(
          Math.max(
            ((point.x - a.x) * (b.x - a.x) + (point.y - a.y) * (b.y - a.y)) / length ** 2,
            0,
          ),
          1,
        );
  const nearest = { x: a.x + (b.x - a.x) * share, y: a.y + (b.y - a.y) * share };
  return { distance: distance(point, nearest), along: alongA + (alongB - alongA) * share };
}

/** Vzdálenost bodu od lomené čáry. */
export function distanceToPolyline(points: readonly MapPoint[], point: MapPoint): number {
  if (points.length === 1 && points[0]) {
    return distance(points[0], point);
  }
  let best = Number.POSITIVE_INFINITY;
  for (let index = 1; index < points.length; index += 1) {
    const a = points[index - 1];
    const b = points[index];
    if (!a || !b) {
      continue;
    }
    const length = distance(a, b);
    const share =
      length === 0
        ? 0
        : Math.min(
            Math.max(
              ((point.x - a.x) * (b.x - a.x) + (point.y - a.y) * (b.y - a.y)) / length ** 2,
              0,
            ),
            1,
          );
    best = Math.min(
      best,
      distance(point, { x: a.x + (b.x - a.x) * share, y: a.y + (b.y - a.y) * share }),
    );
  }
  return best;
}

/** Vrcholy lomené čáry a středy jejích dílků (tam je čára od oblouku nejdál). */
export function polylineCheckPoints(points: readonly MapPoint[]): MapPoint[] {
  const checks: MapPoint[] = [...points];
  for (let index = 1; index < points.length; index += 1) {
    const a = points[index - 1];
    const b = points[index];
    if (a && b) {
      checks.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    }
  }
  return checks;
}

/**
 * Jaký díl délky oblouku z místa `from` na místo `to` má bod `point` za
 * sebou (0 na minulém místě, 1 na novém), měřeno po oblouku.
 */
export function arcShareOfStep(
  layout: ProgressMapLayout,
  from: number,
  to: number,
  point: MapPoint,
): number {
  const dense = denseArcOf(layout);
  const start = dense.placeAlong[from] ?? 0;
  const end = dense.placeAlong[to] ?? 0;
  return (projectOntoArc(dense, point).along - start) / (end - start);
}

/** Kolmá vzdálenost bodu od přímky přes `a` a `b`, se znaménkem podle strany. */
export function signedOffset(a: MapPoint, b: MapPoint, point: MapPoint): number {
  const length = distance(a, b);
  return ((b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x)) / length;
}

/** Kříží se úsečky `a`–`b` a `c`–`d` (dotyk se nepočítá)? */
export function segmentsCross(a: MapPoint, b: MapPoint, c: MapPoint, d: MapPoint): boolean {
  const side = (p: MapPoint, q: MapPoint, r: MapPoint): number =>
    (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  return side(c, d, a) * side(c, d, b) < 0 && side(a, b, c) * side(a, b, d) < 0;
}
