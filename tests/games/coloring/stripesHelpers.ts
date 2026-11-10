/**
 * Pomůcky pro testy proužkového fixu v Omalovánkách (#102). Stopa je
 * kulatá, široká 1,0 W, a barví jen pixely šikmých proužků (45°) pevně
 * umístěných vůči obrázku. Proužek i mezera jsou podle doporučení
 * z otevřené otázky 2 (schváleno) široké 1/3 W stř, měřeno kolmo na
 * proužek. Na obrázku 900 × 600 z `drawingToolHelpers.ts` je W stř 30 px,
 * proužek i mezera mají kolmo 10 px, v řádku obrázku tedy 10 · √2 ≈ 14,1 px.
 *
 * Testy neznají, kde přesně proužky leží (posun vůči rohu obrázku) ani
 * kterým směrem jsou šikmé („/“ nebo „\“). Proto se „pixely proužků“
 * obrázku zjistí chováním: celý prázdný obrázek se přejede tahy
 * proužkového fixu a co se zabarví, jsou proužky toho obrázku
 * (`stripePixels`). Jestli jsou opravdu šikmé 45° a správně široké, hlídá
 * `stripeGeometryProblems`. Každý další tah se pak porovná s proužky:
 * - pixel s jistotou ve stopě (viz `surelyInside` v `dotsHelpers.ts`),
 *   který je v proužku, má barvu tahu,
 * - pixel v mezeře zůstane, jak byl,
 * - pixel s jistotou mimo stopu (dál než W/2 + 1 px) zůstane, jak byl.
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

/** Proužkový fix; navržené id nástroje. */
export const STRIPES: ToolId = 'stripes';

/** Proužek i mezera jako díl W stř, měřeno kolmo na proužek (doporučení 2). */
const STRIPE_SHARE = 1 / 3;

/** W stř jako 1/30 šířky plochy (#96); schválně ne konstanta z kódu. */
function midWidth(pictureWidth: number): number {
  return pictureWidth / 30;
}

/** Šířka proužku (i mezery) kolmo na proužek na obrázku široké `pictureWidth` pixelů. */
export function stripeWidth(pictureWidth: number): number {
  return STRIPE_SHARE * midWidth(pictureWidth);
}

/**
 * Šířka proužku kolmo smí být o 1 px jiná: v řádku obrázku jsou úseky
 * celé pixely, 14,1 px proužku je v řádku 14 nebo 15 pixelů.
 */
const WIDTH_TOLERANCE = 1;

/** Kolik pixelů smí na šikmé přímce vybočit (zaokrouhlení na pixely). */
const DIAGONAL_AGREEMENT = 0.99;

/** Posuny podél šikmé přímky, na kterých se směr 45° ověří (i daleko, aby se ukázal odklon). */
const DIAGONAL_STEPS = [1, 7, 50, 150] as const;

/** Pixely proužků obrázku: `true` u pixelu, který proužkový fix barví. */
export interface StripePixels {
  readonly width: number;
  readonly height: number;
  isStripe(x: number, y: number): boolean;
  /** Kolik pixelů obrázku jsou proužky. */
  readonly count: number;
}

const stripeCache = new Map<string, StripePixels>();

/**
 * Pixely proužků obrázku `width` × `height` zjištěné chováním: prázdný
 * obrázek stejného rozměru bez obrysu se celý přejede vodorovnými tahy
 * proužkového fixu velikosti `size` (řádky po W/2, takže se stopy
 * překrývají a nic nevynechají). Výsledek je pro každý rozměr jen jednou.
 */
export function stripePixels(
  width: number,
  height: number,
  size: LineSize = 'large',
): StripePixels {
  const key = `${width}×${height}:${size}`;
  const cached = stripeCache.get(key);
  if (cached !== undefined) {
    return cached;
  }
  const regions = drawing(width, height).regions();
  const coloring = createColoring(regions);
  const strokeWidth = brushWidthFor(width, size);
  let pointerId = 1;
  for (let y = 0; y < height + strokeWidth / 2; y += strokeWidth / 2) {
    const row = Math.min(y, height - 0.5);
    coloring.pointerDown({ id: pointerId, x: 0.5, y: row, kind: 'touch' }, 0, STRIPES, strokeWidth);
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
  const stripes: StripePixels = {
    width,
    height,
    count,
    isStripe: (x, y) => layer[y * width + x] === 1,
  };
  stripeCache.set(key, stripes);
  return stripes;
}

/** Jaký díl pixelů zůstane stejný po posunu o `step` po šikmé přímce se sklonem `slope` (+1 „\“, −1 „/“). */
function diagonalAgreement(stripes: StripePixels, step: number, slope: 1 | -1): number {
  let same = 0;
  let compared = 0;
  for (let y = 0; y < stripes.height; y += 1) {
    const otherY = y + slope * step;
    if (otherY < 0 || otherY >= stripes.height) {
      continue;
    }
    for (let x = 0; x + step < stripes.width; x += 1) {
      compared += 1;
      if (stripes.isStripe(x, y) === stripes.isStripe(x + step, otherY)) {
        same += 1;
      }
    }
  }
  return compared === 0 ? 0 : same / compared;
}

/** Úseky řádku `y` stejného druhu (proužek, nebo mezera) bez prvního a posledního, které uřízne okraj. */
function innerRuns(
  stripes: StripePixels,
  y: number,
): Array<{ stripe: boolean; length: number; x: number }> {
  const runs: Array<{ stripe: boolean; length: number; x: number }> = [];
  let start = 0;
  for (let x = 1; x <= stripes.width; x += 1) {
    if (x === stripes.width || stripes.isStripe(x, y) !== stripes.isStripe(start, y)) {
      runs.push({ stripe: stripes.isStripe(start, y), length: x - start, x: start });
      start = x;
    }
  }
  return runs.slice(1, -1);
}

/**
 * Co nesedí na proužcích: proužky jsou šikmé 45° jedním směrem (pixel
 * má stejnou barvu jako pixely na téže šikmé přímce i daleko od něj)
 * a každý celý proužek i mezera v řádku má kolmo šířku 1/3 W stř ± 1 px.
 * Kolmá šířka je u 45° délka úseku v řádku děleno √2.
 */
export function stripeGeometryProblems(stripes: StripePixels): string[] {
  const problems: string[] = [];
  if (stripes.count === 0) {
    return ['žádný proužek'];
  }
  const directions = ([1, -1] as const).map((slope) => ({
    slope,
    agreement: Math.min(...DIAGONAL_STEPS.map((step) => diagonalAgreement(stripes, step, slope))),
  }));
  const best = directions.reduce((a, b) => (b.agreement > a.agreement ? b : a));
  if (best.agreement < DIAGONAL_AGREEMENT) {
    problems.push(
      `proužky nejsou šikmé 45°: na šikmé přímce sedí nejvýš ${(100 * best.agreement).toFixed(1)} % pixelů`,
    );
  }
  const expected = stripeWidth(stripes.width);
  for (let y = 0; y < stripes.height; y += 1) {
    for (const run of innerRuns(stripes, y)) {
      const across = run.length / Math.SQRT2;
      if (Math.abs(across - expected) > WIDTH_TOLERANCE) {
        const what = run.stripe ? 'proužek' : 'mezera';
        problems.push(
          `${what} v řádku ${y} od x ${run.x}: kolmo ${across.toFixed(1)} px, čeká se ${expected.toFixed(1)} px`,
        );
      }
    }
  }
  return limited(problems);
}

/** Co se čeká od tahu proužkovým fixem (viz úvod souboru). */
export interface StripeStroke {
  readonly game: ColorReader;
  readonly regions: RegionMap;
  /** Barvy všech pixelů před tahem po řádcích. */
  readonly before: ReadonlyArray<number | null>;
  readonly stripes: StripePixels;
  readonly path: readonly Point[];
  /** Polovina šířky stopy (W/2 velikosti tahu). */
  readonly radius: number;
  readonly color: number;
  /** Oblast tahu; `null` u obrázku bez obrysu, kde se oblast nehlídá. */
  readonly region: number | null;
}

/**
 * Co na tahu proužkovým fixem nesedí: pixel proužku s jistotou ve stopě
 * nemá barvu tahu, nebo se změnil pixel v mezeře, mimo stopu nebo mimo
 * oblast tahu.
 */
export function stripeStrokeProblems(stroke: StripeStroke): string[] {
  const { game, regions, before, stripes, path, radius, color, region } = stroke;
  const problems: string[] = [];
  for (let y = 0; y < regions.height; y += 1) {
    for (let x = 0; x < regions.width; x += 1) {
      const was = before[y * regions.width + x] ?? null;
      const now = game.colorAt(x, y);
      const inRegion = region === null || regionAt(regions, x, y) === region;
      const distance = distanceToPath(centerOf(x, y), path);
      const isStripe = stripes.isStripe(x, y);
      if (inRegion && isStripe && distance <= surelyInside(radius) && now !== color) {
        problems.push(`proužek (${x}, ${y}) ve stopě má ${String(now)} místo ${color}`);
        continue;
      }
      if (now === was) {
        continue;
      }
      if (!inRegion) {
        problems.push(`pixel (${x}, ${y}) mimo oblast tahu se změnil`);
      } else if (!isStripe) {
        problems.push(`mezera (${x}, ${y}) se změnila z ${String(was)} na ${String(now)}`);
      } else if (distance > radius + OUTSIDE) {
        problems.push(`pixel (${x}, ${y}) ${distance.toFixed(2)} px od čáry se změnil`);
      }
    }
  }
  return limited(problems);
}

/** Pixely proužků jako barvy po řádcích (1 u proužku, `null` v mezeře) pro `pixelDifferences`. */
export function stripesAsPixels(stripes: StripePixels): Array<number | null> {
  const pixels: Array<number | null> = [];
  for (let y = 0; y < stripes.height; y += 1) {
    for (let x = 0; x < stripes.width; x += 1) {
      pixels.push(stripes.isStripe(x, y) ? 1 : null);
    }
  }
  return pixels;
}
