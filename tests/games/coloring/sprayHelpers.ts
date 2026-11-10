/**
 * Pomůcky pro testy spreje v Omalovánkách (#104). Stopa je pás šířky 2 W
 * kolem čáry tahu (polovina pásu je W velikosti tahu) a vybranou barvou
 * barví drobné tečky, uprostřed hustěji než u okraje. Na obrázku 900 × 600
 * z `drawingToolHelpers.ts` je W stř 30 px, pás střední velikosti je
 * široký 60 px.
 *
 * Vzdálenost pixelu od čáry se měří od jeho středu jako u štětce (#88).
 * Pás se dělí na dvě pásma podle AC2:
 * - vnitřní pásmo: pixely nejvýš W/2 − 0,5 px od čáry, zabarveno 50–80 %,
 * - vnější pásmo: pixely dál než W/2 + 1 px a nejvýš W − 0,5 px od čáry,
 *   zabarveno 10–40 %,
 * - pixel dál než W + 1 px od čáry se nikdy nezmění.
 * Pixely u hranic pásem (do 1,5 px) se nepočítají, protože tečka na
 * hranici může patřit kterémukoli pásmu.
 *
 * Testy neznají, kde tečky leží, jak jsou velké ani jak hustota klesá od
 * čáry. „Vzorek spreje“ (#104 AC5) se proto zjistí chováním přesně podle
 * zadání: pixely, které zabarví tah vedený přímo přes ně (vzdálenost 0 od
 * čáry). Každý řádek pixelů se přejede vodorovným tahem středem svých
 * pixelů (`sprayPixels`). Aby se tahy navzájem neovlivnily, kreslí se do
 * jednoho obrázku jen řádky dál od sebe než celý pás a čte se jen řádek
 * tahu; ostatní řádky se kreslí do dalších obrázků.
 */

import { brushWidthFor, createColoring } from '../../../src/games/coloring/logic/coloring';
import { regionAt } from '../../../src/games/coloring/logic/regionMap';
import type { RegionMap } from '../../../src/games/coloring/logic/regionMap';
import type { LineSize, ToolId } from '../../../src/games/coloring/logic/toolPanel';
import type { ColorReader } from './dotsHelpers';
import { INSIDE, OUTSIDE, limited } from './drawingToolHelpers';
import { centerOf, distanceToPath, drawing } from './outlineFixtures';
import type { Point } from './outlineFixtures';

/** Sprej; navržené id nástroje. */
export const SPRAY: ToolId = 'spray';

/** Polovina pásu stopy v násobcích W: pás je široký 2 W (#104 AC2). */
export const SPRAY_HALF_FACTOR = 1;

/** Zabarvený díl vnitřního pásma (do W/2 od čáry, #104 AC2). */
export const INNER_SHARE_MIN = 0.5;
export const INNER_SHARE_MAX = 0.8;

/** Zabarvený díl vnějšího pásma (od W/2 do W od čáry, #104 AC2). */
export const OUTER_SHARE_MIN = 0.1;
export const OUTER_SHARE_MAX = 0.4;

/** Šířka plochy s kratší stranou 240 px v poměru 4 : 3 a nejmenší průměr tečky na ní (#104 AC6). */
const SMALLEST_AREA_WIDTH = 320;
const SMALLEST_DOT_DIAMETER = 2;

/** Nejmenší průměr tečky na obrázku široké `pictureWidth` pixelů (#104 AC6). */
export function smallestDotDiameter(pictureWidth: number): number {
  return (SMALLEST_DOT_DIAMETER / SMALLEST_AREA_WIDTH) * pictureWidth;
}

/** Pixely vnitřního a vnějšího pásma kolem `path` (viz úvod souboru). */
export interface SprayZones {
  readonly inner: Array<[number, number]>;
  readonly outer: Array<[number, number]>;
}

/**
 * Vnitřní a vnější pásmo pásu kolem `path` s W `width`, jen pixely
 * oblasti `region` (u `null` všechny pixely obrázku).
 */
export function sprayZones(
  regions: RegionMap,
  path: readonly Point[],
  width: number,
  region: number | null = null,
): SprayZones {
  return sprayZonesAround(regions, [path], width, region);
}

/**
 * Pásma kolem několika tahů: vzdálenost pixelu se měří k bližšímu z nich
 * (#104 AC3, hustota podle bližšího tahu).
 */
export function sprayZonesAround(
  regions: RegionMap,
  paths: ReadonlyArray<readonly Point[]>,
  width: number,
  region: number | null = null,
): SprayZones {
  const inner: Array<[number, number]> = [];
  const outer: Array<[number, number]> = [];
  for (let y = 0; y < regions.height; y += 1) {
    for (let x = 0; x < regions.width; x += 1) {
      if (region !== null && regionAt(regions, x, y) !== region) {
        continue;
      }
      const distance = Math.min(...paths.map((path) => distanceToPath(centerOf(x, y), path)));
      if (distance <= width / 2 - INSIDE) {
        inner.push([x, y]);
      } else if (distance > width / 2 + OUTSIDE && distance <= width - INSIDE) {
        outer.push([x, y]);
      }
    }
  }
  return { inner, outer };
}

/** Zabarvený díl vnitřního a vnějšího pásma barvou `color`. */
export function zoneShares(
  game: ColorReader,
  zones: SprayZones,
  color: number,
): { inner: number; outer: number } {
  const share = (pixels: ReadonlyArray<[number, number]>): number =>
    pixels.filter(([x, y]) => game.colorAt(x, y) === color).length / pixels.length;
  return { inner: share(zones.inner), outer: share(zones.outer) };
}

/** Co nesedí na hustotě teček v pásmech (#104 AC2); `what` je popis případu do zprávy. */
export function densityProblems(shares: { inner: number; outer: number }, what: string): string[] {
  const problems: string[] = [];
  const percent = (share: number): string => `${(100 * share).toFixed(1)} %`;
  if (shares.inner < INNER_SHARE_MIN || shares.inner > INNER_SHARE_MAX) {
    problems.push(`${what}: do W/2 od čáry zabarveno ${percent(shares.inner)}, má být 50–80 %`);
  }
  if (shares.outer < OUTER_SHARE_MIN || shares.outer > OUTER_SHARE_MAX) {
    problems.push(
      `${what}: od W/2 do W od čáry zabarveno ${percent(shares.outer)}, má být 10–40 %`,
    );
  }
  return problems;
}

/** Pixely vzorku spreje: `true` u pixelu, který zabarví tah vedený přímo přes něj. */
export interface SprayPixels {
  readonly width: number;
  readonly height: number;
  isDot(x: number, y: number): boolean;
  /** Kolik pixelů obrázku patří do vzorku. */
  readonly count: number;
}

const sprayCache = new Map<string, SprayPixels>();

/**
 * Vzorek spreje obrázku `width` × `height` bez obrysu pro velikost `size`
 * (viz úvod souboru). Výsledek je pro každý rozměr a velikost jen jednou.
 */
export function sprayPixels(width: number, height: number, size: LineSize = 'medium'): SprayPixels {
  const key = `${width}×${height}:${size}`;
  const cached = sprayCache.get(key);
  if (cached !== undefined) {
    return cached;
  }
  const regions = drawing(width, height).regions();
  const strokeWidth = brushWidthFor(width, size);
  // Řádky v jednom obrázku jsou od sebe dál než celý pás (2 W) a rezerva.
  const rowStep = Math.ceil(2 * SPRAY_HALF_FACTOR * strokeWidth) + 2;
  const layer = new Uint8Array(width * height);
  let count = 0;
  for (let firstRow = 0; firstRow < rowStep && firstRow < height; firstRow += 1) {
    const coloring = createColoring(regions);
    let pointerId = 1;
    for (let row = firstRow; row < height; row += rowStep) {
      coloring.pointerDown(
        { id: pointerId, x: 0.5, y: row + 0.5, kind: 'touch' },
        0,
        SPRAY,
        strokeWidth,
      );
      coloring.pointerMove({ id: pointerId, x: width - 0.5, y: row + 0.5, kind: 'touch' });
      coloring.pointerUp(pointerId);
      pointerId += 1;
    }
    for (let row = firstRow; row < height; row += rowStep) {
      for (let x = 0; x < width; x += 1) {
        if (coloring.colorAt(x, row) !== null) {
          layer[row * width + x] = 1;
          count += 1;
        }
      }
    }
  }
  const spray: SprayPixels = {
    width,
    height,
    count,
    isDot: (x, y) => x >= 0 && y >= 0 && x < width && y < height && layer[y * width + x] === 1,
  };
  sprayCache.set(key, spray);
  return spray;
}

/** Vzorek jako barvy po řádcích (1 u pixelu vzorku, `null` jinde) pro `pixelDifferences`. */
export function sprayAsPixels(spray: SprayPixels): Array<number | null> {
  const pixels: Array<number | null> = [];
  for (let y = 0; y < spray.height; y += 1) {
    for (let x = 0; x < spray.width; x += 1) {
      pixels.push(spray.isDot(x, y) ? 1 : null);
    }
  }
  return pixels;
}

/** Co se čeká od tahu sprejem (viz úvod souboru). */
export interface SprayStroke {
  readonly game: ColorReader;
  readonly regions: RegionMap;
  /** Barvy všech pixelů před tahem po řádcích. */
  readonly before: ReadonlyArray<number | null>;
  /** Vzorek spreje obrázku stejného rozměru. */
  readonly spray: SprayPixels;
  readonly path: readonly Point[];
  /** W velikosti tahu (polovina pásu). */
  readonly width: number;
  readonly color: number;
  /** Oblast tahu; `null` u obrázku bez obrysu, kde se oblast nehlídá. */
  readonly region: number | null;
}

/**
 * Co na tahu sprejem nesedí: změnil se pixel mimo oblast tahu, dál než
 * W + 1 px od čáry, mimo vzorek spreje, nebo dostal jinou barvu než barvu
 * tahu. Hustotu v pásmech hlídá `densityProblems`.
 */
export function sprayStrokeProblems(stroke: SprayStroke): string[] {
  const { game, regions, before, spray, path, width, color, region } = stroke;
  const problems: string[] = [];
  for (let y = 0; y < regions.height; y += 1) {
    for (let x = 0; x < regions.width; x += 1) {
      const was = before[y * regions.width + x] ?? null;
      const now = game.colorAt(x, y);
      if (now === was) {
        continue;
      }
      const distance = distanceToPath(centerOf(x, y), path);
      if (region !== null && regionAt(regions, x, y) !== region) {
        problems.push(`pixel (${x}, ${y}) mimo oblast tahu se změnil`);
      } else if (distance > width + OUTSIDE) {
        problems.push(`pixel (${x}, ${y}) ${distance.toFixed(2)} px od čáry se změnil`);
      } else if (now !== color) {
        problems.push(`pixel (${x}, ${y}) má ${String(now)} místo barvy tahu ${color}`);
      } else if (!spray.isDot(x, y)) {
        problems.push(`pixel (${x}, ${y}) mimo tečky vzorku se zabarvil`);
      }
    }
  }
  return limited(problems);
}

/**
 * Pixely vzorku, které nepatří do žádného celého kruhu průměru `diameter`
 * složeného jen z pixelů vzorku (podklad k #104 AC6: tečka má aspoň daný
 * průměr). Kruh je na pixely: pixel do něj patří podle svého středu,
 * s rezervou 0,75 px na zaokrouhlení. Okraj obrázku se nehlídá (tečka tam
 * může být useknutá).
 */
export function pixelsOutsideWholeDots(spray: SprayPixels, diameter: number): string[] {
  const { width, height } = spray;
  const radius = Math.max(diameter / 2 - 0.75, 0);
  const reach = Math.ceil(radius);
  const offsets: Array<[number, number]> = [];
  for (let dy = -reach; dy <= reach; dy += 1) {
    for (let dx = -reach; dx <= reach; dx += 1) {
      if (Math.hypot(dx, dy) <= radius) {
        offsets.push([dx, dy]);
      }
    }
  }
  // Středy kruhů, které jsou celé ve vzorku.
  const centers = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (offsets.every(([dx, dy]) => spray.isDot(x + dx, y + dy))) {
        centers[y * width + x] = 1;
      }
    }
  }
  const margin = Math.ceil(diameter) + 1;
  const problems: string[] = [];
  for (let y = margin; y < height - margin; y += 1) {
    for (let x = margin; x < width - margin; x += 1) {
      if (!spray.isDot(x, y)) {
        continue;
      }
      const covered = offsets.some(([dx, dy]) => centers[(y + dy) * width + (x + dx)] === 1);
      if (!covered) {
        problems.push(
          `pixel tečky (${x}, ${y}) není v celé tečce průměru ${diameter.toFixed(2)} px`,
        );
      }
    }
  }
  return limited(problems);
}
