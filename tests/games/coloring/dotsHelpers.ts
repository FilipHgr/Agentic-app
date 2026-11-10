/**
 * Pomůcky pro testy puntíkového fixu v Omalovánkách (#101). Stopa je
 * kulatá, široká 1,0 W, a barví jen pixely pravidelné mřížky kulatých
 * puntíků pevně umístěné vůči obrázku. Puntíky jsou podle doporučení
 * z otevřené otázky 1 (schváleno): průměr 1/3 W stř a rozestup středů
 * 1/2 W stř. Na obrázku 900 × 600 z `drawingToolHelpers.ts` je W stř 30 px,
 * puntík má průměr 10 px a středy jsou po 15 px.
 *
 * Testy neznají, kde přesně mřížka leží (posun vůči rohu obrázku) ani jestli
 * je čtvercová nebo šestiúhelníková. Proto se „pixely puntíků“ obrázku
 * zjistí chováním: celý prázdný obrázek se přejede tahy puntíkového fixu
 * a co se zabarví, je mřížka puntíků toho obrázku (`dotPixels`). Jestli je
 * to opravdu pravidelná mřížka kulatých puntíků správné velikosti, hlídá
 * `dotGridProblems`. Každý další tah se pak porovná s mřížkou:
 * - pixel s jistotou ve stopě (střed nejvýš W/2 − 0,5 px od čáry tahu,
 *   bez 4 % W/2 na zvlněný okraj, viz `INSIDE_SHARE`), který je puntíkem,
 *   má barvu tahu,
 * - pixel, který puntíkem není, zůstane, jak byl,
 * - pixel s jistotou mimo stopu (dál než W/2 + 1 px) zůstane, jak byl.
 */

import { brushWidthFor, createColoring } from '../../../src/games/coloring/logic/coloring';
import { regionAt } from '../../../src/games/coloring/logic/regionMap';
import type { RegionMap } from '../../../src/games/coloring/logic/regionMap';
import type { LineSize, ToolId } from '../../../src/games/coloring/logic/toolPanel';
import { INSIDE, OUTSIDE, limited } from './drawingToolHelpers';
import { centerOf, distanceToPath, drawing } from './outlineFixtures';
import type { Point } from './outlineFixtures';

/** Puntíkový fix; navržené id nástroje. */
export const DOTS: ToolId = 'dots';

/** Odkud se čte barva pixelu (hra i samotné malování). */
export interface ColorReader {
  colorAt(x: number, y: number): number | null;
}

/** Průměr puntíku jako díl W stř a rozestup středů jako díl W stř (doporučení 1). */
const DOT_DIAMETER_SHARE = 1 / 3;
const DOT_SPACING_SHARE = 1 / 2;

/** W stř jako 1/30 šířky plochy (#96); schválně ne konstanta z kódu. */
function midWidth(pictureWidth: number): number {
  return pictureWidth / 30;
}

/** Průměr puntíku na obrázku široké `pictureWidth` pixelů. */
export function dotDiameter(pictureWidth: number): number {
  return DOT_DIAMETER_SHARE * midWidth(pictureWidth);
}

/** Rozestup středů puntíků na obrázku široké `pictureWidth` pixelů. */
export function dotSpacing(pictureWidth: number): number {
  return DOT_SPACING_SHARE * midWidth(pictureWidth);
}

/** Rozměr puntíku na pixely smí být o 1 px menší i větší. */
const DOT_SIZE_TOLERANCE = 1;

/** Plocha puntíku na pixely smí být o 15 % jiná než plocha kruhu (čtverec má o 27 % víc). */
const DOT_AREA_TOLERANCE = 0.15;

/** Rozestup středů smí být o 1 px jiný. */
const SPACING_TOLERANCE = 1;

/** Pravidelná mřížka má kolem každého puntíku aspoň 4 sousedy (čtvercová 4, šestiúhelníková 6). */
const MIN_NEIGHBOURS = 4;

/**
 * Okraj stopy smí být zvlněný jako u štětce (#88): razítka štětce leží po
 * čtvrtině šířky stopy, takže mezi nimi stopa sahá o 3,2 % W/2 méně. Pixel
 * je s jistotou ve stopě, když je nejvýš 96 % W/2 − 0,5 px od čáry.
 */
const INSIDE_SHARE = 0.96;

/** Do jaké vzdálenosti od čáry tahu s polovinou šířky `radius` je pixel s jistotou ve stopě. */
export function surelyInside(radius: number): number {
  return INSIDE_SHARE * radius - INSIDE;
}

/** Pixely puntíků obrázku: `true` u pixelu, který puntíkový fix barví. */
export interface DotPixels {
  readonly width: number;
  readonly height: number;
  isDot(x: number, y: number): boolean;
  /** Kolik pixelů obrázku jsou puntíky. */
  readonly count: number;
}

const dotCache = new Map<string, DotPixels>();

/**
 * Pixely puntíků obrázku `width` × `height` zjištěné chováním: prázdný
 * obrázek stejného rozměru bez obrysu se celý přejede vodorovnými tahy
 * puntíkového fixu velké velikosti (řádky po W/2, takže se stopy
 * překrývají a nic nevynechají). Výsledek je pro každý rozměr jen jednou.
 * `size` dovolí zjistit mřížku i tahy jiné velikosti.
 */
export function dotPixels(width: number, height: number, size: LineSize = 'large'): DotPixels {
  const key = `${width}×${height}:${size}`;
  const cached = dotCache.get(key);
  if (cached !== undefined) {
    return cached;
  }
  const regions = drawing(width, height).regions();
  const coloring = createColoring(regions);
  const strokeWidth = brushWidthFor(width, size);
  let pointerId = 1;
  for (let y = 0; y < height + strokeWidth / 2; y += strokeWidth / 2) {
    const row = Math.min(y, height - 0.5);
    coloring.pointerDown({ id: pointerId, x: 0.5, y: row, kind: 'touch' }, 0, DOTS, strokeWidth);
    coloring.pointerMove({ id: pointerId, x: width - 0.5, y: row, kind: 'touch' });
    coloring.pointerUp(pointerId);
    pointerId += 1;
  }
  const layer = new Uint8Array(width * height);
  let count = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (coloring.colorAt(x, y) !== null) {
        layer[y * width + x] = 1;
        count += 1;
      }
    }
  }
  const dots: DotPixels = {
    width,
    height,
    count,
    isDot: (x, y) => layer[y * width + x] === 1,
  };
  dotCache.set(key, dots);
  return dots;
}

/** Jeden puntík: souvislá skupina pixelů mřížky. */
export interface DotSpot {
  readonly pixels: number;
  readonly left: number;
  readonly top: number;
  /** Poslední sloupec a řádek (včetně). */
  readonly right: number;
  readonly bottom: number;
  readonly center: Point;
  /** Dotýká se okraje obrázku (může být useknutý)? */
  readonly atEdge: boolean;
}

/** Souvislé skupiny pixelů mřížky (sousedé i šikmo). */
export function dotSpots(dots: DotPixels): DotSpot[] {
  const { width, height } = dots;
  const seen = new Uint8Array(width * height);
  const spots: DotSpot[] = [];
  for (let start = 0; start < width * height; start += 1) {
    const startX = start % width;
    const startY = Math.floor(start / width);
    if (seen[start] === 1 || !dots.isDot(startX, startY)) {
      continue;
    }
    seen[start] = 1;
    const queue = [start];
    let pixels = 0;
    let sumX = 0;
    let sumY = 0;
    let left = startX;
    let right = startX;
    let top = startY;
    let bottom = startY;
    while (queue.length > 0) {
      const index = queue.pop() as number;
      const x = index % width;
      const y = Math.floor(index / width);
      pixels += 1;
      sumX += x + 0.5;
      sumY += y + 0.5;
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
          if (seen[neighbour] !== 1 && dots.isDot(nx, ny)) {
            seen[neighbour] = 1;
            queue.push(neighbour);
          }
        }
      }
    }
    spots.push({
      pixels,
      left,
      top,
      right,
      bottom,
      center: { x: sumX / pixels, y: sumY / pixels },
      atEdge: left === 0 || top === 0 || right === width - 1 || bottom === height - 1,
    });
  }
  return spots;
}

/**
 * Co nesedí na mřížce puntíků: každý puntík, který není useknutý okrajem,
 * je kulatý (šířka i výška průměr ± 1 px, plocha jako kruh ± 15 %),
 * nejbližší puntík je od něj rozestup ± 1 px a v rozestupu + 1 px má
 * aspoň 4 sousedy (pravidelná mřížka bez děr).
 */
export function dotGridProblems(dots: DotPixels): string[] {
  const diameter = dotDiameter(dots.width);
  const spacing = dotSpacing(dots.width);
  const area = Math.PI * (diameter / 2) ** 2;
  const spots = dotSpots(dots);
  const inner = spots.filter((spot) => !spot.atEdge);
  const problems: string[] = [];
  if (inner.length === 0) {
    return ['žádný celý puntík'];
  }
  for (const spot of inner) {
    const where = `puntík (${spot.center.x.toFixed(1)}, ${spot.center.y.toFixed(1)})`;
    const spotWidth = spot.right - spot.left + 1;
    const spotHeight = spot.bottom - spot.top + 1;
    for (const [name, value] of [
      ['šířka', spotWidth],
      ['výška', spotHeight],
    ] as const) {
      if (Math.abs(value - diameter) > DOT_SIZE_TOLERANCE) {
        problems.push(`${where}: ${name} ${value} px, čeká se ${diameter.toFixed(1)} px`);
      }
    }
    if (Math.abs(spot.pixels - area) > DOT_AREA_TOLERANCE * area) {
      problems.push(`${where}: ${spot.pixels} pixelů, kruh má ${area.toFixed(1)}`);
    }
  }
  // Sousedy stačí hledat mezi puntíky, které nejsou u okraje o víc než rozestup.
  const farFromEdge = inner.filter(
    (spot) =>
      spot.center.x > 2 * spacing &&
      spot.center.y > 2 * spacing &&
      spot.center.x < dots.width - 2 * spacing &&
      spot.center.y < dots.height - 2 * spacing,
  );
  for (const spot of farFromEdge) {
    const where = `puntík (${spot.center.x.toFixed(1)}, ${spot.center.y.toFixed(1)})`;
    const distances = spots
      .filter((other) => other !== spot)
      .map((other) => Math.hypot(other.center.x - spot.center.x, other.center.y - spot.center.y));
    const nearest = Math.min(...distances);
    if (Math.abs(nearest - spacing) > SPACING_TOLERANCE) {
      problems.push(
        `${where}: nejbližší puntík ${nearest.toFixed(1)} px, čeká se ${spacing.toFixed(1)} px`,
      );
    }
    const neighbours = distances.filter((distance) => distance <= spacing + SPACING_TOLERANCE);
    if (neighbours.length < MIN_NEIGHBOURS) {
      problems.push(`${where}: jen ${neighbours.length} sousedů v rozestupu`);
    }
  }
  return limited(problems);
}

/** Co se čeká od tahu puntíkovým fixem (viz úvod souboru). */
export interface DotStroke {
  readonly game: ColorReader;
  readonly regions: RegionMap;
  /** Barvy všech pixelů před tahem po řádcích. */
  readonly before: ReadonlyArray<number | null>;
  readonly dots: DotPixels;
  readonly path: readonly Point[];
  /** Polovina šířky stopy (W/2 velikosti tahu). */
  readonly radius: number;
  readonly color: number;
  /** Oblast tahu; `null` u obrázku bez obrysu, kde se oblast nehlídá. */
  readonly region: number | null;
}

/**
 * Co na tahu puntíkovým fixem nesedí: puntík s jistotou ve stopě nemá
 * barvu tahu, nebo se změnil pixel mimo puntíky, mimo stopu nebo mimo
 * oblast tahu.
 */
export function dotStrokeProblems(stroke: DotStroke): string[] {
  const { game, regions, before, dots, path, radius, color, region } = stroke;
  const problems: string[] = [];
  for (let y = 0; y < regions.height; y += 1) {
    for (let x = 0; x < regions.width; x += 1) {
      const was = before[y * regions.width + x] ?? null;
      const now = game.colorAt(x, y);
      const inRegion = region === null || regionAt(regions, x, y) === region;
      const distance = distanceToPath(centerOf(x, y), path);
      const isDot = dots.isDot(x, y);
      if (inRegion && isDot && distance <= surelyInside(radius) && now !== color) {
        problems.push(`puntík (${x}, ${y}) ve stopě má ${String(now)} místo ${color}`);
        continue;
      }
      if (now === was) {
        continue;
      }
      if (!inRegion) {
        problems.push(`pixel (${x}, ${y}) mimo oblast tahu se změnil`);
      } else if (!isDot) {
        problems.push(`mezera (${x}, ${y}) se změnila z ${String(was)} na ${String(now)}`);
      } else if (distance > radius + OUTSIDE) {
        problems.push(`pixel (${x}, ${y}) ${distance.toFixed(2)} px od čáry se změnil`);
      }
    }
  }
  return limited(problems);
}

/** Pixely (s jistotou) ve stopě kolem `path` s polovinou šířky `radius`. */
export function strokeCore(
  regions: RegionMap,
  path: readonly Point[],
  radius: number,
): Array<[number, number]> {
  const found: Array<[number, number]> = [];
  for (let y = 0; y < regions.height; y += 1) {
    for (let x = 0; x < regions.width; x += 1) {
      if (distanceToPath(centerOf(x, y), path) <= surelyInside(radius)) {
        found.push([x, y]);
      }
    }
  }
  return found;
}

/** Jaký díl pixelů `pixels` má barvu `color`. */
export function shareWith(
  game: ColorReader,
  pixels: ReadonlyArray<[number, number]>,
  color: number,
): number {
  return pixels.filter(([x, y]) => game.colorAt(x, y) === color).length / pixels.length;
}

/**
 * Puntíky, které kruh kolem `center` s polovinou šířky stopy `radius`
 * protíná: část jejich pixelů je s jistotou uvnitř, část s jistotou venku.
 */
export function cutSpots(dots: DotPixels, center: Point, radius: number): DotSpot[] {
  return dotSpots(dots).filter((spot) => {
    let inside = false;
    let outside = false;
    for (let y = spot.top; y <= spot.bottom; y += 1) {
      for (let x = spot.left; x <= spot.right; x += 1) {
        if (!dots.isDot(x, y)) {
          continue;
        }
        const distance = distanceToPath(centerOf(x, y), [center]);
        inside ||= distance <= surelyInside(radius);
        outside ||= distance > radius + OUTSIDE;
      }
    }
    return inside && outside;
  });
}
