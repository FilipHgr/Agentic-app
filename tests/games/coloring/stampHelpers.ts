/**
 * Pomůcky pro testy razítkového fixu v Omalovánkách (#98). Stopy se měří na
 * obrázku 900 × 600 z `drawingToolHelpers.ts`: W je 900 / 50 = 18 px (malá),
 * 30 px (střední) a 60 px (velká). Hvězdička je vepsaná do kruhu průměru
 * 1,5 W (poloměr R = 0,75 W), středy jsou od sebe 2 W po dráze prstu.
 *
 * Zadání neurčuje vnitřní poloměr hvězdičky (jak hluboké jsou zářezy mezi
 * cípy). Testy proto hlídají jen to, co z AC plyne pro každou rozumnou
 * pěticípou hvězdičku:
 * - cípy míří na úhly −90°, −18°, 54°, 126° a 198° (špička nahoru,
 *   y roste dolů) a každý je plný od středu do 0,7 R,
 * - mezi cípy (zářezy na úhlech −54°, 18°, 90°, 162° a 234°) je v 0,9 R
 *   prázdno, tedy i přímo pod středem,
 * - kolem středu je plný kruh 0,25 R (hvězdička je plná),
 * - nic není dál než R + 1 px od středu,
 * - obdélník kolem hvězdičky má šířku 2 R cos 18° ≈ 1,90 R, výšku
 *   R (1 + sin 54°) ≈ 1,81 R a horní okraj R nad středem (s rezervou na
 *   zkrácení ostrých cípů na pixely).
 */

import type { RegionMap } from '../../../src/games/coloring/logic/regionMap';
import { regionAt } from '../../../src/games/coloring/logic/regionMap';
import type { LineSize } from '../../../src/games/coloring/logic/toolPanel';
import { BIG_HEIGHT, BIG_WIDTH, limited } from './drawingToolHelpers';
import { WIDTH_SHARE } from './lineSizeHelpers';
import { centerOf, drawing } from './outlineFixtures';
import type { Point } from './outlineFixtures';

/** Odkud se čte barva pixelu (hra i samotné malování). */
export interface ColorReader {
  colorAt(x: number, y: number): number | null;
}

/** Poloměr kruhu hvězdičky jako násobek W (průměr 1,5 W, AC2). */
const STAR_RADIUS_SHARE = 0.75;

/** Rozestup středů jako násobek W (AC2). */
const STAR_SPACING_SHARE = 2;

/** Rezerva na okraji hvězdičky v pixelech, jako u ostatních nástrojů. */
export const STAR_OUTSIDE = 1;

/**
 * Rezerva rozměrů obdélníku kolem hvězdičky v pixelech. Ostrý cíp se
 * na pixely zkrátí (pixel se počítá podle svého středu), proto smí být
 * obdélník o 3 px menší, ale nejvýš o 1 px větší.
 */
const BOX_SMALLER = 3;
const BOX_LARGER = 1;

/** Horní okraj smí kvůli zkrácení cípu ležet nejvýš 2 px pod R nad středem. */
const TOP_LOWER = 2;

/** Úhly cípů ve stupních: první míří nahoru. */
const TIP_ANGLES = [-90, -18, 54, 126, 198];

/** Úhly zářezů mezi cípy, první přímo pod středem. */
const NOTCH_ANGLES = [90, 162, 234, -54, 18];

/** Do jakého dílu R musí být cíp plný a v jakém dílu R musí být zářez prázdný. */
const TIP_REACH = 0.7;
const NOTCH_REACH = 0.9;

/** Plný kruh kolem středu jako díl R. */
const CORE_SHARE = 0.25;

/** W velikosti `size` na obrázku 900 px; schválně ne konstanty z kódu. */
export function widthOf(size: LineSize): number {
  return WIDTH_SHARE[size] * BIG_WIDTH;
}

/** Poloměr kruhu hvězdičky velikosti `size` (0,75 W). */
export function starRadius(size: LineSize): number {
  return STAR_RADIUS_SHARE * widthOf(size);
}

/** Rozestup středů hvězdiček velikosti `size` (2 W). */
export function starSpacing(size: LineSize): number {
  return STAR_SPACING_SHARE * widthOf(size);
}

/** Obrázek 900 × 600 bez obrysu: jedna velká oblast. */
export function bigBlank(): RegionMap {
  return drawing(BIG_WIDTH, BIG_HEIGHT).regions();
}

/**
 * Středy hvězdiček podél dráhy `path`: první na začátku, další vždy po
 * `spacing` pixelech dráhy prstu, poslední nejdál na konci dráhy.
 */
export function starCenters(path: readonly Point[], spacing: number): Point[] {
  const [first] = path;
  if (first === undefined) {
    return [];
  }
  const centers: Point[] = [first];
  let travelled = 0;
  let next = spacing;
  for (let index = 1; index < path.length; index += 1) {
    const a = path[index - 1] as Point;
    const b = path[index] as Point;
    const segment = Math.hypot(b.x - a.x, b.y - a.y);
    while (segment > 0 && next <= travelled + segment + 1e-6) {
      const share = (next - travelled) / segment;
      centers.push({ x: a.x + (b.x - a.x) * share, y: a.y + (b.y - a.y) * share });
      next += spacing;
    }
    travelled += segment;
  }
  return centers;
}

function pointAt(center: Point, angleDegrees: number, distance: number): Point {
  const angle = (angleDegrees * Math.PI) / 180;
  return { x: center.x + Math.cos(angle) * distance, y: center.y + Math.sin(angle) * distance };
}

function colorUnder(game: ColorReader, point: Point): number | null {
  return game.colorAt(Math.floor(point.x), Math.floor(point.y));
}

/**
 * Co na hvězdičce barvy `color` se středem `center` a poloměrem `radius`
 * nesedí: plný střed, plné cípy, prázdné zářezy (viz úvod souboru).
 */
export function starProblems(
  game: ColorReader,
  center: Point,
  radius: number,
  color: number,
): string[] {
  const where = `hvězdička (${center.x.toFixed(1)}, ${center.y.toFixed(1)})`;
  const problems: string[] = [];
  const left = Math.floor(center.x - radius);
  const top = Math.floor(center.y - radius);
  for (let y = top; y <= Math.ceil(center.y + radius); y += 1) {
    for (let x = left; x <= Math.ceil(center.x + radius); x += 1) {
      const pixel = centerOf(x, y);
      const near = Math.hypot(pixel.x - center.x, pixel.y - center.y) <= CORE_SHARE * radius;
      if (near && game.colorAt(x, y) !== color) {
        problems.push(`${where}: pixel (${x}, ${y}) u středu nemá barvu`);
      }
    }
  }
  TIP_ANGLES.forEach((angle, tip) => {
    for (let distance = 0; distance <= TIP_REACH * radius; distance += 1) {
      if (colorUnder(game, pointAt(center, angle, distance)) !== color) {
        problems.push(`${where}: cíp ${tip + 1} (${angle}°) má mezeru ${distance} px od středu`);
        break;
      }
    }
  });
  NOTCH_ANGLES.forEach((angle) => {
    if (colorUnder(game, pointAt(center, angle, NOTCH_REACH * radius)) === color) {
      problems.push(`${where}: zářez ${angle}° je zabarvený`);
    }
  });
  return limited(problems);
}

/** Zabarvené pixely dál než `radius` + 1 px od všech středů `centers`. */
export function paintedAwayFromStars(
  game: ColorReader,
  regions: RegionMap,
  centers: readonly Point[],
  radius: number,
): string[] {
  const problems: string[] = [];
  for (let y = 0; y < regions.height; y += 1) {
    for (let x = 0; x < regions.width; x += 1) {
      if (game.colorAt(x, y) === null) {
        continue;
      }
      const pixel = centerOf(x, y);
      const nearest = Math.min(
        ...centers.map((center) => Math.hypot(pixel.x - center.x, pixel.y - center.y)),
      );
      if (nearest > radius + STAR_OUTSIDE) {
        problems.push(`pixel (${x}, ${y}) ${nearest.toFixed(2)} px od hvězdičky je zabarvený`);
      }
    }
  }
  return limited(problems);
}

/** Souvislá skupina zabarvených pixelů (jedna hvězdička) a obdélník kolem ní. */
export interface PaintedPatch {
  readonly pixels: number;
  readonly left: number;
  readonly top: number;
  /** Poslední sloupec a řádek skupiny (včetně). */
  readonly right: number;
  readonly bottom: number;
}

/**
 * Souvislé skupiny zabarvených pixelů (sousedé i šikmo), seřazené zleva
 * a shora podle levého horního rohu.
 */
export function paintedPatches(game: ColorReader, regions: RegionMap): PaintedPatch[] {
  const { width, height } = regions;
  const seen = new Uint8Array(width * height);
  const patches: PaintedPatch[] = [];
  for (let start = 0; start < width * height; start += 1) {
    const startX = start % width;
    const startY = Math.floor(start / width);
    if (seen[start] === 1 || game.colorAt(startX, startY) === null) {
      continue;
    }
    seen[start] = 1;
    const queue = [start];
    let pixels = 0;
    let left = startX;
    let right = startX;
    let top = startY;
    let bottom = startY;
    while (queue.length > 0) {
      const index = queue.pop() as number;
      const x = index % width;
      const y = Math.floor(index / width);
      pixels += 1;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
            continue;
          }
          const neighbour = ny * width + nx;
          if (seen[neighbour] !== 1 && game.colorAt(nx, ny) !== null) {
            seen[neighbour] = 1;
            queue.push(neighbour);
          }
        }
      }
    }
    patches.push({ pixels, left, top, right, bottom });
  }
  return patches.sort((a, b) => a.left - b.left || a.top - b.top);
}

/**
 * Co nesedí na obdélníku kolem hvězdičky se středem `center`: šířka
 * 1,90 R, výška 1,81 R, horní okraj R nad středem a vodorovně uprostřed.
 */
export function boxProblems(patch: PaintedPatch, center: Point, radius: number): string[] {
  const where = `hvězdička (${center.x.toFixed(1)}, ${center.y.toFixed(1)})`;
  const checks: Array<{ name: string; actual: number; min: number; max: number }> = [];
  const width = 2 * radius * Math.cos(Math.PI / 10);
  const height = radius * (1 + Math.sin((3 * Math.PI) / 10));
  const top = center.y - radius;
  checks.push(
    {
      name: 'šířka',
      actual: patch.right - patch.left + 1,
      min: width - BOX_SMALLER,
      max: width + BOX_LARGER,
    },
    {
      name: 'výška',
      actual: patch.bottom - patch.top + 1,
      min: height - BOX_SMALLER,
      max: height + BOX_LARGER,
    },
    { name: 'horní okraj', actual: patch.top, min: top - BOX_LARGER, max: top + TOP_LOWER },
    {
      name: 'střed vodorovně',
      actual: (patch.left + patch.right + 1) / 2,
      min: center.x - BOX_LARGER,
      max: center.x + BOX_LARGER,
    },
  );
  return checks
    .filter((check) => check.actual < check.min || check.actual > check.max)
    .map(
      (check) =>
        `${where}: ${check.name} ${check.actual.toFixed(1)}, čeká se ${check.min.toFixed(1)} až ${check.max.toFixed(1)}`,
    );
}

/** Jsou všechny zabarvené pixely v oblasti `region`? Vrátí ty mimo. */
export function paintedOutside(game: ColorReader, regions: RegionMap, region: number): string[] {
  const problems: string[] = [];
  for (let y = 0; y < regions.height; y += 1) {
    for (let x = 0; x < regions.width; x += 1) {
      if (game.colorAt(x, y) !== null && regionAt(regions, x, y) !== region) {
        problems.push(`pixel (${x}, ${y}) mimo oblast tahu je zabarvený`);
      }
    }
  }
  return limited(problems);
}
