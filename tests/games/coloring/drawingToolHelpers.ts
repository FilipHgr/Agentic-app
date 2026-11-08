/**
 * Pomůcky pro testy fixu a pastelky v Omalovánkách (#93). Stopy se měří na
 * větším zkušebním obrázku 900 × 600 px, aby úzká stopa pastelky měla
 * dost řádků na měření zrna: W = 900 / 30 = 30 px, fix je široký
 * 0,6 W = 18 px, pastelka 0,5 W = 15 px. Svislá čára x 450 a 451 dělí
 * obrázek na oblast A vlevo a B vpravo.
 *
 * Vzdálenost pixelu od čáry tahu se měří od jeho středu jako u štětce
 * (#88): pixel je „s jistotou ve stopě“, když je jeho střed nejvýš
 * polovina šířky − 0,5 px od čáry, a „s jistotou mimo stopu“, když je dál
 * než polovina šířky + 1 px.
 */

import { brushWidthFor } from '../../../src/games/coloring/logic/coloring';
import { regionAt } from '../../../src/games/coloring/logic/regionMap';
import type { RegionMap } from '../../../src/games/coloring/logic/regionMap';
import type { SavedColoring } from '../../../src/games/coloring/logic/savedPicture';
import { PANEL_TOOLS, usesSelectedColor } from '../../../src/games/coloring/logic/toolPanel';
import type { ToolId } from '../../../src/games/coloring/logic/toolPanel';
import type { Tone } from '../../../src/shared/audio/tonePlayer';
import { centerOf, distanceToPath, drawing } from './outlineFixtures';
import type { Point } from './outlineFixtures';
import { paint } from './savedPictureHelpers';

export const BIG_WIDTH = 900;
export const BIG_HEIGHT = 600;

/** Svislá čára obrysu (x 450 a 451). */
export const BIG_LINE_X = 450;

/** Šířka stopy štětce W na větším zkušebním obrázku (30 px). */
export const BIG_W = brushWidthFor(BIG_WIDTH);

/** Polovina šířky fixu (0,6 W / 2 = 9 px). */
export const MARKER_HALF = (0.6 * BIG_W) / 2;

/** Poloměr pastelky (0,5 W / 2 = 7,5 px). */
export const CRAYON_RADIUS = (0.5 * BIG_W) / 2;

/** Rezerva na pixely uvnitř stopy a vně stopy (jako u štětce, #88). */
export const INSIDE = 0.5;
export const OUTSIDE = 1;

/** Kolik pixelů stopy pastelky smí a musí zůstat nezabarvených (AC2). */
export const CRAYON_GAP_MIN = 0.2;
export const CRAYON_GAP_MAX = 0.4;

/** Nejvýš tolik problémů se vypíše, aby zpráva zůstala čitelná. */
const MAX_PROBLEMS = 5;

/** Větší zkušební obrázek: oblast A vlevo, B vpravo od svislé čáry. */
export function bigHalves(): RegionMap {
  return drawing(BIG_WIDTH, BIG_HEIGHT).verticalLine(BIG_LINE_X).regions();
}

/** Oblast A vlevo a B vpravo od čáry. */
export function bigRegions(regions: RegionMap): { regionA: number; regionB: number } {
  return {
    regionA: regionAt(regions, 10, 10) as number,
    regionB: regionAt(regions, BIG_WIDTH - 10, 10) as number,
  };
}

export function slotOf(tool: ToolId): number {
  return PANEL_TOOLS.indexOf(tool);
}

/** Dítě ťukne v panelu na nástroj `tool`. */
export function choose(game: SavedColoring, tool: ToolId): readonly Tone[] {
  return game.tapTool(slotOf(tool));
}

/**
 * Tah nástrojem `tool` barvou `color`: výběr nástroje, výběr barvy v jeho
 * kroku barev, tah. Od #110 má každý nástroj svou barvu, barva se proto
 * vybírá až k vybranému nástroji (u gumy a duhy by výběr barvy přepnul
 * nástroj, tam se barva nevybírá).
 */
export function drawWith(
  game: SavedColoring,
  tool: ToolId,
  color: number,
  path: readonly Point[],
): void {
  choose(game, tool);
  if (usesSelectedColor(tool)) {
    game.tapColor(color);
  }
  paint(game, path);
}

/** Kdy dozní poslední tón, v sekundách od ťuknutí. */
export function endOf(tones: readonly Tone[]): number {
  return Math.max(...tones.map((tone) => tone.startSeconds + tone.durationSeconds));
}

export function limited(problems: string[]): string[] {
  return problems.length > MAX_PROBLEMS
    ? [...problems.slice(0, MAX_PROBLEMS), `… a dalších ${problems.length - MAX_PROBLEMS}`]
    : problems;
}

/** Pixely oblasti `region`, jejichž střed splní `inside`, jako dvojice [x, y]. */
export function pixelsWhere(
  regions: RegionMap,
  region: number | null,
  inside: (center: Point) => boolean,
): Array<[number, number]> {
  const found: Array<[number, number]> = [];
  for (let y = 0; y < regions.height; y += 1) {
    for (let x = 0; x < regions.width; x += 1) {
      if (region !== null && regionAt(regions, x, y) !== region) {
        continue;
      }
      if (inside(centerOf(x, y))) {
        found.push([x, y]);
      }
    }
  }
  return found;
}

/** Pixely oblasti `region` s jistotou ve stopě pastelky podél `path`. */
export function crayonCore(
  regions: RegionMap,
  region: number,
  path: readonly Point[],
): Array<[number, number]> {
  return pixelsWhere(
    regions,
    region,
    (center) => distanceToPath(center, path) <= CRAYON_RADIUS - INSIDE,
  );
}

/** Jaký díl pixelů `pixels` nemá barvu `color`. */
export function shareWithout(
  game: SavedColoring,
  pixels: ReadonlyArray<[number, number]>,
  color: number,
): number {
  const without = pixels.filter(([x, y]) => game.colorAt(x, y) !== color).length;
  return without / pixels.length;
}

/** Zabarvené pixely dál než `limit` od čáry `path`. */
export function paintedBeyond(
  game: SavedColoring,
  regions: RegionMap,
  path: readonly Point[],
  limit: number,
): string[] {
  const problems: string[] = [];
  for (let y = 0; y < regions.height; y += 1) {
    for (let x = 0; x < regions.width; x += 1) {
      if (game.colorAt(x, y) === null) {
        continue;
      }
      const distance = distanceToPath(centerOf(x, y), path);
      if (distance > limit) {
        problems.push(`pixel (${x}, ${y}) ${distance.toFixed(2)} px od čáry je zabarvený`);
      }
    }
  }
  return limited(problems);
}

/** Pixely oblasti `region`, které se proti `before` změnily. */
export function changedInRegion(
  game: SavedColoring,
  regions: RegionMap,
  before: ReadonlyArray<number | null>,
  region: number,
): string[] {
  const problems: string[] = [];
  for (let y = 0; y < regions.height; y += 1) {
    for (let x = 0; x < regions.width; x += 1) {
      if (regionAt(regions, x, y) !== region) {
        continue;
      }
      const was = before[y * regions.width + x] ?? null;
      if (game.colorAt(x, y) !== was) {
        problems.push(`pixel (${x}, ${y}) byl ${String(was)}, je ${String(game.colorAt(x, y))}`);
      }
    }
  }
  return limited(problems);
}
