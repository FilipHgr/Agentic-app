/**
 * Pomůcky pro testy třpytek v Omalovánkách (#103). Stopa je kulatá,
 * široká 1,5 W, a vybranou barvou barví jen pixely drobných čtyřcípých
 * jisker, které leží podle vzoru pevně umístěného vůči obrázku. Na obrázku
 * 900 × 600 z `drawingToolHelpers.ts` je W stř 30 px, stopa střední
 * velikosti je široká 45 px.
 *
 * Testy neznají, kde přesně jiskry leží (mřížka, nebo nepravidelný vzor),
 * jak jsou velké ani jak jsou natočené. Proto se „pixely jisker“ obrázku
 * zjistí chováním: celý prázdný obrázek se přejede tahy třpytek a co se
 * zabarví, jsou jiskry toho obrázku (`glitterPixels`). Jestli jsou to
 * opravdu drobné čtyřcípé jiskry, hlídá `sparkleShapeProblems`. Každý další
 * tah se pak porovná s jiskrami:
 * - pixel s jistotou ve stopě (viz `surelyInside` v `dotsHelpers.ts`),
 *   který je v jiskře, má barvu tahu,
 * - pixel mimo jiskry zůstane, jak byl,
 * - pixel s jistotou mimo stopu (dál než 0,75 W + 1 px) zůstane, jak byl.
 *
 * Co je „drobná čtyřcípá jiskra“, zadání neurčuje přesně. Testy hlídají jen
 * to, co z AC plyne pro každou rozumnou jiskru tvaru ✦ v libovolném natočení:
 * - rozpětí (delší strana obdélníku kolem jiskry) je nejvýš 1 W stř
 *   („drobná“) a aspoň 5/320 šířky obrázku (#103 AC6: na ploše 4 : 3
 *   s kratší stranou 240 px je šířka 320 px a jiskra má mít aspoň 5 px),
 * - má čtyři cípy po 90°: paprsek ze středu ve směru cípu je dlouhý,
 *   paprsek mezi dvěma cípy (zářez) nejvýš 0,7 nejkratšího cípu,
 * - zabírá nejvýš 45 % obdélníku kolem sebe (kruh 79 %, čtverec 100 %,
 *   kosočtverec 50 %, hvězda ✦ se zářezy méně).
 */

import { brushWidthFor, createColoring } from '../../../src/games/coloring/logic/coloring';
import { regionAt } from '../../../src/games/coloring/logic/regionMap';
import type { RegionMap } from '../../../src/games/coloring/logic/regionMap';
import type { LineSize, ToolId } from '../../../src/games/coloring/logic/toolPanel';
import { surelyInside } from './dotsHelpers';
import type { ColorReader } from './dotsHelpers';
import { OUTSIDE, limited } from './drawingToolHelpers';
import { centerOf, distanceToPath, drawing } from './outlineFixtures';
import type { Point } from './outlineFixtures';

/** Třpytky; navržené id nástroje. */
export const GLITTER: ToolId = 'glitter';

/** Stopa třpytek je široká 1,5 W (#103 AC2). */
export const GLITTER_WIDTH_FACTOR = 1.5;

/** Kolik pixelů stopy ve vodorovném tahu přes prázdnou oblast je zabarveno (#103 AC2). */
export const GLITTER_SHARE_MIN = 0.08;
export const GLITTER_SHARE_MAX = 0.2;

/** Šířka plochy s kratší stranou 240 px v poměru 4 : 3 a nejmenší rozpětí jiskry na ní (#103 AC6). */
const SMALLEST_AREA_WIDTH = 320;
const SMALLEST_SPARKLE_SPAN = 5;

/** Paprsek zářezu smí být nejvýš tento díl nejkratšího cípu. */
const NOTCH_REACH_SHARE = 0.7;

/** Každý cíp má aspoň tento díl nejdelšího cípu (jiskra smí být protáhlá jako ✦). */
const TIP_REACH_SHARE = 0.6;

/** Jiskra zabírá nejvýš tento díl obdélníku kolem sebe. */
const MAX_BOX_FILL = 0.45;

/** Krok úhlu v stupních, po kterém se hledá směr nejdelšího cípu. */
const ANGLE_STEP = 5;

/** Jak daleko od paprsku smí ležet střed pixelu, aby se počítal do jeho délky. */
const RAY_TOLERANCE = 0.75;

/**
 * Pixely jedné jiskry jsou od sebe nejvýš 2 px. Ostrý cíp se na pixely
 * může rozpadnout na kousky (pixel patří jiskře podle svého středu), proto
 * se kousky do 2 px počítají k jedné jiskře.
 */
const SPARKLE_GAP = 2;

/** W stř jako 1/30 šířky plochy (#96); schválně ne konstanta z kódu. */
export function midWidth(pictureWidth: number): number {
  return pictureWidth / 30;
}

/** Nejmenší rozpětí jiskry na obrázku široké `pictureWidth` pixelů (#103 AC6). */
export function smallestSparkleSpan(pictureWidth: number): number {
  return (SMALLEST_SPARKLE_SPAN / SMALLEST_AREA_WIDTH) * pictureWidth;
}

/** Pixely jisker obrázku: `true` u pixelu, který třpytky barví. */
export interface GlitterPixels {
  readonly width: number;
  readonly height: number;
  isSparkle(x: number, y: number): boolean;
  /** Kolik pixelů obrázku jsou jiskry. */
  readonly count: number;
}

const glitterCache = new Map<string, GlitterPixels>();

/**
 * Pixely jisker obrázku `width` × `height` zjištěné chováním: prázdný
 * obrázek stejného rozměru bez obrysu se celý přejede vodorovnými tahy
 * třpytek velikosti `size` (řádky po W/2, stopa je široká 1,5 W, takže se
 * stopy překrývají a nic nevynechají). Výsledek je pro každý rozměr jen jednou.
 */
export function glitterPixels(
  width: number,
  height: number,
  size: LineSize = 'large',
): GlitterPixels {
  const key = `${width}×${height}:${size}`;
  const cached = glitterCache.get(key);
  if (cached !== undefined) {
    return cached;
  }
  const regions = drawing(width, height).regions();
  const coloring = createColoring(regions);
  const strokeWidth = brushWidthFor(width, size);
  let pointerId = 1;
  for (let y = 0; y < height + strokeWidth / 2; y += strokeWidth / 2) {
    const row = Math.min(y, height - 0.5);
    coloring.pointerDown({ id: pointerId, x: 0.5, y: row, kind: 'touch' }, 0, GLITTER, strokeWidth);
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
  const glitter: GlitterPixels = {
    width,
    height,
    count,
    isSparkle: (x, y) => x >= 0 && y >= 0 && x < width && y < height && layer[y * width + x] === 1,
  };
  glitterCache.set(key, glitter);
  return glitter;
}

/** Jedna jiskra: skupina pixelů jisker, které jsou od sebe nejvýš `SPARKLE_GAP` px. */
export interface Sparkle {
  readonly pixels: ReadonlyArray<[number, number]>;
  readonly left: number;
  readonly top: number;
  /** Poslední sloupec a řádek (včetně). */
  readonly right: number;
  readonly bottom: number;
  readonly center: Point;
  /** Dotýká se okraje obrázku (může být useknutá)? */
  readonly atEdge: boolean;
}

/** Jiskry obrázku jako skupiny pixelů. */
export function sparklesOf(glitter: GlitterPixels): Sparkle[] {
  const { width, height } = glitter;
  const seen = new Uint8Array(width * height);
  const sparkles: Sparkle[] = [];
  for (let start = 0; start < width * height; start += 1) {
    const startX = start % width;
    const startY = Math.floor(start / width);
    if (seen[start] === 1 || !glitter.isSparkle(startX, startY)) {
      continue;
    }
    seen[start] = 1;
    const queue = [start];
    const pixels: Array<[number, number]> = [];
    while (queue.length > 0) {
      const index = queue.pop() as number;
      const x = index % width;
      const y = Math.floor(index / width);
      pixels.push([x, y]);
      for (let dy = -SPARKLE_GAP; dy <= SPARKLE_GAP; dy += 1) {
        for (let dx = -SPARKLE_GAP; dx <= SPARKLE_GAP; dx += 1) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
            continue;
          }
          const neighbour = ny * width + nx;
          if (seen[neighbour] !== 1 && glitter.isSparkle(nx, ny)) {
            seen[neighbour] = 1;
            queue.push(neighbour);
          }
        }
      }
    }
    const xs = pixels.map(([x]) => x);
    const ys = pixels.map(([, y]) => y);
    const left = Math.min(...xs);
    const right = Math.max(...xs);
    const top = Math.min(...ys);
    const bottom = Math.max(...ys);
    sparkles.push({
      pixels,
      left,
      top,
      right,
      bottom,
      // Střed obdélníku, ne těžiště: u protáhlé jiskry leží těžiště stejně.
      center: { x: (left + right + 1) / 2, y: (top + bottom + 1) / 2 },
      atEdge: left === 0 || top === 0 || right === width - 1 || bottom === height - 1,
    });
  }
  return sparkles;
}

/** Rozpětí jiskry: delší strana obdélníku kolem ní v pixelech. */
export function spanOf(sparkle: Sparkle): number {
  return Math.max(sparkle.right - sparkle.left + 1, sparkle.bottom - sparkle.top + 1);
}

/** Jak daleko ze středu jiskry sahají její pixely ve směru `degrees` (do `RAY_TOLERANCE` od paprsku). */
function reachAlong(sparkle: Sparkle, degrees: number): number {
  const angle = (degrees * Math.PI) / 180;
  const dirX = Math.cos(angle);
  const dirY = Math.sin(angle);
  let reach = 0;
  for (const [x, y] of sparkle.pixels) {
    const dx = x + 0.5 - sparkle.center.x;
    const dy = y + 0.5 - sparkle.center.y;
    const along = dx * dirX + dy * dirY;
    const across = Math.abs(-dx * dirY + dy * dirX);
    if (along > 0 && across <= RAY_TOLERANCE) {
      reach = Math.max(reach, along);
    }
  }
  return reach;
}

/** Co nesedí na tvaru jedné jiskry (viz úvod souboru); `pictureWidth` je šířka obrázku. */
function oneSparkleProblems(sparkle: Sparkle, pictureWidth: number): string[] {
  const where = `jiskra (${sparkle.center.x.toFixed(1)}, ${sparkle.center.y.toFixed(1)})`;
  const problems: string[] = [];
  const span = spanOf(sparkle);
  if (span > midWidth(pictureWidth)) {
    problems.push(`${where}: rozpětí ${span} px, drobná má nejvýš ${midWidth(pictureWidth)} px`);
  }
  const boxArea = (sparkle.right - sparkle.left + 1) * (sparkle.bottom - sparkle.top + 1);
  const fill = sparkle.pixels.length / boxArea;
  if (fill > MAX_BOX_FILL) {
    problems.push(
      `${where}: zabírá ${(100 * fill).toFixed(0)} % obdélníku, čtyřcípá jiskra nejvýš ${100 * MAX_BOX_FILL} %`,
    );
  }
  // Směr nejdelšího cípu, ostatní cípy po 90°, zářezy mezi nimi po 45°.
  let tipAngle = 0;
  let longest = 0;
  for (let degrees = 0; degrees < 90; degrees += ANGLE_STEP) {
    const shortestTip = Math.min(
      ...[0, 90, 180, 270].map((turn) => reachAlong(sparkle, degrees + turn)),
    );
    if (shortestTip > longest) {
      longest = shortestTip;
      tipAngle = degrees;
    }
  }
  const tips = [0, 90, 180, 270].map((turn) => reachAlong(sparkle, tipAngle + turn));
  const notches = [45, 135, 225, 315].map((turn) => reachAlong(sparkle, tipAngle + turn));
  const shortestTip = Math.min(...tips);
  const longestTip = Math.max(...tips);
  if (shortestTip < TIP_REACH_SHARE * longestTip) {
    problems.push(
      `${where}: cípy ${tips.map((tip) => tip.toFixed(1)).join(', ')} px, nemá čtyři cípy po 90°`,
    );
  }
  const deepest = Math.max(...notches);
  if (deepest > NOTCH_REACH_SHARE * shortestTip) {
    problems.push(
      `${where}: mezi cípy sahá ${deepest.toFixed(1)} px, nejkratší cíp ${shortestTip.toFixed(1)} px (zářezy chybí)`,
    );
  }
  return problems;
}

/**
 * Co nesedí na jiskrách obrázku: aspoň nějaké jsou a každá jiskra, která
 * není useknutá okrajem, je drobná čtyřcípá jiskra (viz úvod souboru).
 */
export function sparkleShapeProblems(glitter: GlitterPixels): string[] {
  const inner = sparklesOf(glitter).filter((sparkle) => !sparkle.atEdge);
  if (inner.length === 0) {
    return ['žádná celá jiskra'];
  }
  return limited(inner.flatMap((sparkle) => oneSparkleProblems(sparkle, glitter.width)));
}

/** Co se čeká od tahu třpytkami (viz úvod souboru). */
export interface GlitterStroke {
  readonly game: ColorReader;
  readonly regions: RegionMap;
  /** Barvy všech pixelů před tahem po řádcích. */
  readonly before: ReadonlyArray<number | null>;
  readonly glitter: GlitterPixels;
  readonly path: readonly Point[];
  /** Polovina šířky stopy (0,75 W velikosti tahu). */
  readonly radius: number;
  readonly color: number;
  /** Oblast tahu; `null` u obrázku bez obrysu, kde se oblast nehlídá. */
  readonly region: number | null;
}

/**
 * Co na tahu třpytkami nesedí: pixel jiskry s jistotou ve stopě nemá
 * barvu tahu, nebo se změnil pixel mimo jiskry, mimo stopu nebo mimo
 * oblast tahu.
 */
export function glitterStrokeProblems(stroke: GlitterStroke): string[] {
  const { game, regions, before, glitter, path, radius, color, region } = stroke;
  const problems: string[] = [];
  for (let y = 0; y < regions.height; y += 1) {
    for (let x = 0; x < regions.width; x += 1) {
      const was = before[y * regions.width + x] ?? null;
      const now = game.colorAt(x, y);
      const inRegion = region === null || regionAt(regions, x, y) === region;
      const distance = distanceToPath(centerOf(x, y), path);
      const isSparkle = glitter.isSparkle(x, y);
      if (inRegion && isSparkle && distance <= surelyInside(radius) && now !== color) {
        problems.push(`jiskra (${x}, ${y}) ve stopě má ${String(now)} místo ${color}`);
        continue;
      }
      if (now === was) {
        continue;
      }
      if (!inRegion) {
        problems.push(`pixel (${x}, ${y}) mimo oblast tahu se změnil`);
      } else if (!isSparkle) {
        problems.push(
          `pixel mimo jiskry (${x}, ${y}) se změnil z ${String(was)} na ${String(now)}`,
        );
      } else if (distance > radius + OUTSIDE) {
        problems.push(`pixel (${x}, ${y}) ${distance.toFixed(2)} px od čáry se změnil`);
      }
    }
  }
  return limited(problems);
}

/** Pixely jisker jako barvy po řádcích (1 u jiskry, `null` jinde) pro `pixelDifferences`. */
export function glitterAsPixels(glitter: GlitterPixels): Array<number | null> {
  const pixels: Array<number | null> = [];
  for (let y = 0; y < glitter.height; y += 1) {
    for (let x = 0; x < glitter.width; x += 1) {
      pixels.push(glitter.isSparkle(x, y) ? 1 : null);
    }
  }
  return pixels;
}

/**
 * Jiskry, které kruh kolem `center` s polovinou šířky stopy `radius`
 * protíná: část jejich pixelů je s jistotou uvnitř, část s jistotou venku.
 */
export function cutSparkles(glitter: GlitterPixels, center: Point, radius: number): Sparkle[] {
  return sparklesOf(glitter).filter((sparkle) => {
    let inside = false;
    let outside = false;
    for (const [x, y] of sparkle.pixels) {
      const distance = distanceToPath(centerOf(x, y), [center]);
      inside ||= distance <= surelyInside(radius);
      outside ||= distance > radius + OUTSIDE;
    }
    return inside && outside;
  });
}
