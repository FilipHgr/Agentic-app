/**
 * Pomůcky pro testy Omalovánek (#88): malé syntetické obrysy, ze kterých
 * logika (`src/games/coloring/logic/regionMap.ts`) udělá mapu oblastí,
 * a měření, které pixely tah zabarvil.
 *
 * Souřadnice jsou v pixelech mapy oblastí (vrstvy barev). Pixel (x, y)
 * zabírá čtverec [x, x + 1) × [y, y + 1) a jeho střed je (x + 0,5; y + 0,5).
 * Vzdálenost pixelu od čáry tahu se měří od jeho středu.
 */

import { buildRegionMap, regionAt } from '../../../src/games/coloring/logic/regionMap';
import type { OutlineBitmap, RegionMap } from '../../../src/games/coloring/logic/regionMap';
import type { Coloring } from '../../../src/games/coloring/logic/coloring';

/** Šířka zkušební mapy: W = 300 / 30 = 10 px, poloměr stopy 5 px. */
export const TEST_WIDTH = 300;
export const TEST_HEIGHT = 200;

/** Pixel s jistotou uvnitř stopy: střed nejvýš W/2 − 0,5 px od čáry (zaokrouhlení na pixely). */
export const INSIDE_TOLERANCE = 0.5;

/** Pixel s jistotou mimo stopu: střed víc než W/2 + 1 px od čáry. */
export const OUTSIDE_TOLERANCE = 1;

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** Obrys, do kterého se kreslí čáry: 1 = obrys, 0 = volné místo, po řádcích. */
export class OutlineDrawing {
  readonly outline: Uint8Array;

  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    this.outline = new Uint8Array(width * height);
  }

  /** Jeden pixel obrysu; mimo obrázek se nic nestane. */
  dot(x: number, y: number): this {
    if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
      this.outline[y * this.width + x] = 1;
    }
    return this;
  }

  /** Plný obdélník obrysu včetně okrajových pixelů. */
  fill(left: number, top: number, right: number, bottom: number): this {
    for (let y = top; y <= bottom; y += 1) {
      for (let x = left; x <= right; x += 1) {
        this.dot(x, y);
      }
    }
    return this;
  }

  /** Rámeček (obvod obdélníku) o tloušťce `thickness` px. */
  frame(left: number, top: number, right: number, bottom: number, thickness = 2): this {
    this.fill(left, top, right, top + thickness - 1);
    this.fill(left, bottom - thickness + 1, right, bottom);
    this.fill(left, top, left + thickness - 1, bottom);
    this.fill(right - thickness + 1, top, right, bottom);
    return this;
  }

  /** Svislá čára přes celou výšku obrázku. */
  verticalLine(x: number, thickness = 2): this {
    return this.fill(x, 0, x + thickness - 1, this.height - 1);
  }

  /** Vodorovná čára přes celou šířku obrázku. */
  horizontalLine(y: number, thickness = 2): this {
    return this.fill(0, y, this.width - 1, y + thickness - 1);
  }

  bitmap(): OutlineBitmap {
    return { width: this.width, height: this.height, outline: this.outline };
  }

  regions(): RegionMap {
    return buildRegionMap(this.bitmap());
  }
}

export function drawing(width = TEST_WIDTH, height = TEST_HEIGHT): OutlineDrawing {
  return new OutlineDrawing(width, height);
}

/** Vzdálenost bodu `p` od úsečky a–b (u jednoho bodu vzdálenost od něj). */
export function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  const t =
    lengthSquared === 0
      ? 0
      : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSquared));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Vzdálenost bodu od lomené čáry tahu. */
export function distanceToPath(p: Point, path: readonly Point[]): number {
  const [first] = path;
  if (first === undefined) {
    return Infinity;
  }
  if (path.length === 1) {
    return distanceToSegment(p, first, first);
  }
  let best = Infinity;
  for (let index = 1; index < path.length; index += 1) {
    const a = path[index - 1] as Point;
    const b = path[index] as Point;
    best = Math.min(best, distanceToSegment(p, a, b));
  }
  return best;
}

export function centerOf(x: number, y: number): Point {
  return { x: x + 0.5, y: y + 0.5 };
}

/** Všechny pixely mapy jako dvojice [x, y]. */
export function* pixelsOf(regions: RegionMap): Generator<[number, number]> {
  for (let y = 0; y < regions.height; y += 1) {
    for (let x = 0; x < regions.width; x += 1) {
      yield [x, y];
    }
  }
}

/** Nejvýš tolik problémů se vypíše, aby zpráva zůstala čitelná. */
const MAX_PROBLEMS = 5;

function limited(problems: string[]): string[] {
  return problems.length > MAX_PROBLEMS
    ? [...problems.slice(0, MAX_PROBLEMS), `… a dalších ${problems.length - MAX_PROBLEMS}`]
    : problems;
}

/**
 * Pixely oblasti `region` u čáry `path`, které nemají barvu `color`, ač
 * jsou blíž než W/2 (AC3: barva dosáhne až k obrysu, čára bez mezer).
 */
export function missingPixels(
  coloring: Coloring,
  regions: RegionMap,
  path: readonly Point[],
  region: number,
  color: number,
): string[] {
  const reach = coloring.brushWidth / 2 - INSIDE_TOLERANCE;
  const problems: string[] = [];
  for (const [x, y] of pixelsOf(regions)) {
    if (regionAt(regions, x, y) !== region) {
      continue;
    }
    const distance = distanceToPath(centerOf(x, y), path);
    if (distance <= reach && coloring.colorAt(x, y) !== color) {
      problems.push(
        `pixel (${x}, ${y}) ${distance.toFixed(2)} px od čáry má ${String(coloring.colorAt(x, y))}, čeká se ${color}`,
      );
    }
  }
  return limited(problems);
}

/** Zabarvené pixely dál než W/2 + 1 px od čáry `path` (stopa je široká jen W). */
export function pixelsBeyondBrush(
  coloring: Coloring,
  regions: RegionMap,
  path: readonly Point[],
): string[] {
  const limit = coloring.brushWidth / 2 + OUTSIDE_TOLERANCE;
  const problems: string[] = [];
  for (const [x, y] of pixelsOf(regions)) {
    if (coloring.colorAt(x, y) === null) {
      continue;
    }
    const distance = distanceToPath(centerOf(x, y), path);
    if (distance > limit) {
      problems.push(`pixel (${x}, ${y}) ${distance.toFixed(2)} px od čáry je zabarvený`);
    }
  }
  return limited(problems);
}

/** Zabarvené pixely mimo oblast `region` (jiná oblast nebo obrys). */
export function pixelsOutsideRegion(
  coloring: Coloring,
  regions: RegionMap,
  region: number,
): string[] {
  const problems: string[] = [];
  for (const [x, y] of pixelsOf(regions)) {
    const own = regionAt(regions, x, y);
    if (own !== region && coloring.colorAt(x, y) !== null) {
      problems.push(`pixel (${x}, ${y}) v oblasti ${String(own)} je zabarvený`);
    }
  }
  return limited(problems);
}

/** Kolik pixelů je zabarvených. */
export function paintedCount(coloring: Coloring, regions: RegionMap): number {
  let count = 0;
  for (const [x, y] of pixelsOf(regions)) {
    if (coloring.colorAt(x, y) !== null) {
      count += 1;
    }
  }
  return count;
}

/** Barvy všech pixelů v pořadí po řádcích (pro porovnání dvou obrázků). */
export function snapshotOf(coloring: Coloring, regions: RegionMap): Array<number | null> {
  return [...pixelsOf(regions)].map(([x, y]) => coloring.colorAt(x, y));
}
