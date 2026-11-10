/**
 * Pomůcky pro testy nejtenčí tloušťky čáry v Omalovánkách (#118).
 *
 * Šířky jsou schválně opsané ze zadání, ne konstanty z kódu, aby je nešlo
 * potichu změnit: W nejtenčí je 1/100 šířky plochy (polovina malé 1/50).
 * Puntíkový a proužkový fix a třpytky malují u nejtenčí stejně široce jako
 * u malé (#118 AC2 a schválení obrázků vlastníkem 2026-11-10).
 *
 * Tečky po krátkém ťuknutí se měří na obrázku 1024 px širokém jako vrstva
 * barev hry (`TAP_WIDTH`), aby čísla seděla se zadáním: W nejtenčí je
 * 10,24 px, štětec 10,2 px, guma 15,4 px, fix 6,1 px a pastelka 5,1 px.
 */

import { createColoring } from '../../../src/games/coloring/logic/coloring';
import type { RegionMap } from '../../../src/games/coloring/logic/regionMap';
import type { ToolId } from '../../../src/games/coloring/logic/toolPanel';
import { drawing } from './outlineFixtures';
import type { Point } from './outlineFixtures';

/** Šířka obrázku pro měření teček (jako vrstva barev hry, #92). */
export const TAP_WIDTH = 1024;
export const TAP_HEIGHT = 400;

/** W nejtenčí jako díl šířky plochy (#118 AC2). */
export const TINY_SHARE = 1 / 100;

/** W malé jako díl šířky plochy (#91 AC2, beze změny). */
export const SMALL_SHARE = 1 / 50;

/** Nástroje, které u nejtenčí malují stejně široce jako u malé (#118 AC2, schválení obrázků). */
export const LIKE_SMALL_AT_TINY: readonly ToolId[] = ['dots', 'stripes', 'glitter'];

/** Tolerance šířky tečky ze zadání (#118 AC2). */
export const DOT_TOLERANCE = 1;

/** Kde se ťuká: střed pixelu daleko od okrajů obrázku. */
export const TAP_POINT: Point = { x: 300.5, y: 200.5 };

/** Prázdný obrázek 1024 × 400 bez obrysu. */
export function tapPicture(): RegionMap {
  return drawing(TAP_WIDTH, TAP_HEIGHT).regions();
}

/** Šířka W, kterou nástroj `tool` maluje u nejtenčí tloušťky na ploše široké `pictureWidth`. */
export function tinyStrokeWidth(tool: ToolId, pictureWidth: number): number {
  return pictureWidth * (LIKE_SMALL_AT_TINY.includes(tool) ? SMALL_SHARE : TINY_SHARE);
}

/** Čte barvy pixelů (hra i samotné malování). */
export interface ColorReader {
  colorAt(x: number, y: number): number | null;
}

/** Šířka a výška obdélníku, který zabírají pixely splňující `matches`, v pixelech. */
export interface PixelExtent {
  readonly count: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Vnější okraj pixelů, jejichž barva splní `matches`, v okolí `reach` px
 * kolem bodu `center`: kolik jich je a jak široký a vysoký obdélník zabírají
 * (počítáno po celých pixelech, jako se tečka měří na obrazovce).
 */
export function extentAround(
  reader: ColorReader,
  center: Point,
  reach: number,
  matches: (color: number | null) => boolean,
): PixelExtent {
  let count = 0;
  let left = Infinity;
  let right = -Infinity;
  let top = Infinity;
  let bottom = -Infinity;
  const fromX = Math.floor(center.x - reach);
  const toX = Math.ceil(center.x + reach);
  const fromY = Math.floor(center.y - reach);
  const toY = Math.ceil(center.y + reach);
  for (let y = fromY; y <= toY; y += 1) {
    for (let x = fromX; x <= toX; x += 1) {
      if (!matches(reader.colorAt(x, y))) {
        continue;
      }
      count += 1;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  }
  return count === 0
    ? { count, width: 0, height: 0 }
    : { count, width: right - left + 1, height: bottom - top + 1 };
}

/** Nejvzdálenější zabarvený pixel (od jeho středu) od bodu `center` v okolí `reach` px. */
export function farthestPainted(reader: ColorReader, center: Point, reach: number): number {
  let farthest = 0;
  for (let y = Math.floor(center.y - reach); y <= Math.ceil(center.y + reach); y += 1) {
    for (let x = Math.floor(center.x - reach); x <= Math.ceil(center.x + reach); x += 1) {
      if (reader.colorAt(x, y) !== null) {
        farthest = Math.max(farthest, Math.hypot(x + 0.5 - center.x, y + 0.5 - center.y));
      }
    }
  }
  return farthest;
}

/** Zabarvené pixely v okolí `reach` px kolem `center` jako „x,y“. */
export function paintedAround(reader: ColorReader, center: Point, reach: number): Set<string> {
  const painted = new Set<string>();
  for (let y = Math.floor(center.y - reach); y <= Math.ceil(center.y + reach); y += 1) {
    for (let x = Math.floor(center.x - reach); x <= Math.ceil(center.x + reach); x += 1) {
      if (reader.colorAt(x, y) !== null) {
        painted.add(`${x},${y}`);
      }
    }
  }
  return painted;
}

/**
 * Rozměr hvězdičky razítkového fixu se špičkou nahoru vepsané do kruhu
 * průměru `diameter` (#98 AC2): šířka mezi dvěma bočními cípy a výška od
 * horní špičky po spodní cípy. Pěticípá hvězdička má cípy po 72°.
 */
export function starExtent(diameter: number): { width: number; height: number } {
  const radius = diameter / 2;
  const tipAngle = (2 * Math.PI) / 5;
  return {
    width: 2 * radius * Math.sin(tipAngle),
    height: radius * (1 + Math.cos(tipAngle / 2)),
  };
}

const sprayCache = new Map<string, Uint8Array>();

/**
 * Vzorek spreje nejtenčí tloušťkou (#104, #118 AC6): pixely, které zabarví
 * tah sprejem šířky W nejtenčí vedený přímo přes ně (vzdálenost 0 od
 * čáry). Prázdný obrázek se přejede vodorovnými tahy po řádcích tak daleko
 * od sebe, aby se pásy tahů v jednom obrázku nedotkly, a měří se jen
 * pixely na řádcích tahů. Jako `sprayPixels` ze `sprayHelpers.ts`, jen
 * s šířkou W nejtenčí ze zadání.
 */
export function tinySprayPixels(width: number, height: number): (x: number, y: number) => boolean {
  const key = `${width}×${height}`;
  let layer = sprayCache.get(key);
  if (layer === undefined) {
    const regions = drawing(width, height).regions();
    const strokeWidth = tinyStrokeWidth('spray', width);
    // Pás spreje je široký 2 W (#104 AC2), řádky v jednom obrázku jsou dál.
    const rowStep = Math.ceil(2 * strokeWidth) + 2;
    const found = new Uint8Array(width * height);
    for (let firstRow = 0; firstRow < rowStep && firstRow < height; firstRow += 1) {
      const coloring = createColoring(regions);
      let pointerId = 1;
      for (let row = firstRow; row < height; row += rowStep) {
        coloring.pointerDown(
          { id: pointerId, x: 0.5, y: row + 0.5, kind: 'touch' },
          0,
          'spray',
          strokeWidth,
        );
        coloring.pointerMove({ id: pointerId, x: width - 0.5, y: row + 0.5, kind: 'touch' });
        coloring.pointerUp(pointerId);
        pointerId += 1;
      }
      for (let row = firstRow; row < height; row += rowStep) {
        for (let x = 0; x < width; x += 1) {
          if (coloring.colorAt(x, row) !== null) {
            found[row * width + x] = 1;
          }
        }
      }
    }
    sprayCache.set(key, found);
    layer = found;
  }
  const pixels = layer;
  return (x, y) => x >= 0 && y >= 0 && x < width && y < height && pixels[y * width + x] === 1;
}
