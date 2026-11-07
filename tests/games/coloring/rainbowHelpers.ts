/**
 * Pomůcky pro testy duhového štětce v Omalovánkách (#97). Stopy se měří na
 * větším zkušebním obrázku 900 × 600 z `drawingToolHelpers.ts`: W stř je
 * 900 / 30 = 30 px, úsek jedné barvy duhy je 2 W stř = 60 px při každé
 * velikosti a celá duha (6 barev) 360 px dráhy.
 *
 * Očekávaná barva pixelu podle AC2: pixel dostane barvu bodu dráhy, který
 * je mu nejblíž (při stejné vzdálenosti pozdější bod), a barva bodu je
 * podle délky dráhy od začátku tahu: červená, oranžová, žlutá, zelená,
 * modrá, fialová a znovu dokola, každá na úseku 2 W stř. Pixely, kde
 * rozhoduje zaokrouhlení (do 1 px od hranice úseku nebo skoro stejně
 * daleko od dvou míst dráhy s jinou barvou), se nehodnotí.
 */

import { PALETTE } from '../../../src/games/coloring/logic/palette';
import type { PaletteColorId } from '../../../src/games/coloring/logic/palette';
import type { RegionMap } from '../../../src/games/coloring/logic/regionMap';
import { regionAt } from '../../../src/games/coloring/logic/regionMap';
import type { SavedColoring } from '../../../src/games/coloring/logic/savedPicture';
import { BIG_WIDTH, limited } from './drawingToolHelpers';
import { centerOf } from './outlineFixtures';
import type { Point } from './outlineFixtures';

/** Barvy duhy v pořadí z AC2 (podle doporučení k otázce 2 jen těchto 6). */
const RAINBOW_IDS = [
  'red',
  'orange',
  'yellow',
  'green',
  'blue',
  'purple',
] as const satisfies readonly PaletteColorId[];

/** Indexy barev duhy v paletě, v pořadí duhy. */
export const RAINBOW: readonly number[] = RAINBOW_IDS.map((id) =>
  PALETTE.findIndex((color) => color.id === id),
);

export const RAINBOW_NAMES: readonly string[] = [
  'červená',
  'oranžová',
  'žlutá',
  'zelená',
  'modrá',
  'fialová',
];

/** W stř na obrázku 900 px; schválně ne konstanta z kódu. */
export const MID_W = BIG_WIDTH / 30;

/** Délka úseku jedné barvy duhy (2 W stř = 60 px). */
export const BAND = 2 * MID_W;

/** Tolerance délky úseku a hranice úseku z AC2. */
export const BAND_TOLERANCE = 1;

/** Barva duhy (index palety) bodu dráhy ve vzdálenosti `length` od začátku tahu. */
export function rainbowColorAt(length: number): number {
  const band = Math.floor(length / BAND) % RAINBOW.length;
  return RAINBOW[band] as number;
}

/** Je barva jednou z barev duhy? */
export function isRainbowColor(color: number | null): boolean {
  return color !== null && RAINBOW.includes(color);
}

interface Candidate {
  readonly distance: number;
  readonly length: number;
}

/** Nejbližší bod úsečky a–b k bodu `p` a jeho délka dráhy (`start` je délka v bodě a). */
function nearestOnSegment(p: Point, a: Point, b: Point, start: number): Candidate {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const segment = Math.hypot(dx, dy);
  const t =
    segment === 0
      ? 0
      : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (segment * segment)));
  return {
    distance: Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy)),
    length: start + t * segment,
  };
}

/** Pro každou úsečku dráhy nejbližší bod k `p` (u ťuknutí jen bod ťuknutí). */
function candidatesFor(p: Point, path: readonly Point[]): Candidate[] {
  const [first] = path;
  if (first === undefined) {
    return [];
  }
  if (path.length === 1) {
    return [nearestOnSegment(p, first, first, 0)];
  }
  const candidates: Candidate[] = [];
  let start = 0;
  for (let index = 1; index < path.length; index += 1) {
    const a = path[index - 1] as Point;
    const b = path[index] as Point;
    candidates.push(nearestOnSegment(p, a, b, start));
    start += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return candidates;
}

/** Je délka dráhy do 1 px od hranice dvou úseků? */
function nearBandEdge(length: number): boolean {
  const inBand = length % BAND;
  return length > BAND_TOLERANCE && (inBand < BAND_TOLERANCE || inBand > BAND - BAND_TOLERANCE);
}

/** Vzdálenosti se berou jako stejné do zaokrouhlovací chyby. */
const SAME_DISTANCE = 1e-9;

/** Kdy jsou dvě místa dráhy „skoro stejně daleko“ a pixel se nehodnotí. */
const NEAR_TIE = 0.75;

/**
 * Očekávaná barva pixelu se středem `p` podle AC2, nebo `null`, když o ní
 * rozhoduje zaokrouhlení.
 */
export function expectedRainbowColor(p: Point, path: readonly Point[]): number | null {
  const candidates = candidatesFor(p, path);
  let best: Candidate | null = null;
  for (const candidate of candidates) {
    // Při stejné vzdálenosti vyhrává pozdější bod dráhy (pozdější úsečka).
    if (best === null || candidate.distance <= best.distance + SAME_DISTANCE) {
      best = candidate;
    }
  }
  if (best === null || nearBandEdge(best.length)) {
    return null;
  }
  const color = rainbowColorAt(best.length);
  const bestDistance = best.distance;
  const unclear = candidates.some(
    (other) =>
      rainbowColorAt(other.length) !== color &&
      Math.abs(other.distance - bestDistance) > SAME_DISTANCE &&
      Math.abs(other.distance - bestDistance) < NEAR_TIE,
  );
  return unclear ? null : color;
}

/**
 * Pixely oblasti `region` nejvýš `reach` od dráhy `path`, které nemají
 * barvu podle AC2 (pixely, o kterých rozhoduje zaokrouhlení, se vynechají).
 */
export function rainbowMismatches(
  game: SavedColoring,
  regions: RegionMap,
  region: number,
  path: readonly Point[],
  reach: number,
): string[] {
  const xs = path.map((point) => point.x);
  const ys = path.map((point) => point.y);
  const left = Math.max(0, Math.floor(Math.min(...xs) - reach - 1));
  const right = Math.min(regions.width - 1, Math.ceil(Math.max(...xs) + reach + 1));
  const top = Math.max(0, Math.floor(Math.min(...ys) - reach - 1));
  const bottom = Math.min(regions.height - 1, Math.ceil(Math.max(...ys) + reach + 1));
  const problems: string[] = [];
  for (let y = top; y <= bottom; y += 1) {
    for (let x = left; x <= right; x += 1) {
      if (regionAt(regions, x, y) !== region) {
        continue;
      }
      const center = centerOf(x, y);
      const nearest = Math.min(...candidatesFor(center, path).map((each) => each.distance));
      if (nearest > reach) {
        continue;
      }
      const expected = expectedRainbowColor(center, path);
      if (expected !== null && game.colorAt(x, y) !== expected) {
        problems.push(`pixel (${x}, ${y}) má ${String(game.colorAt(x, y))}, čeká se ${expected}`);
      }
    }
  }
  return limited(problems);
}

/** Souvislé úseky jedné barvy v řádku `y` mezi sloupci `fromX` a `toX` (bez `toX`). */
export function colorRunsInRow(
  game: SavedColoring,
  y: number,
  fromX: number,
  toX: number,
): Array<{ color: number | null; length: number }> {
  const runs: Array<{ color: number | null; length: number }> = [];
  for (let x = fromX; x < toX; x += 1) {
    const color = game.colorAt(x, y);
    const last = runs[runs.length - 1];
    if (last !== undefined && last.color === color) {
      last.length += 1;
    } else {
      runs.push({ color, length: 1 });
    }
  }
  return runs;
}
