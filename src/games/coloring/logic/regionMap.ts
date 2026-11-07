/**
 * Mapa oblastí omalovánky (#88): obrys se při startu vykreslí do pole
 * pixelů a odsud se rozdělí na uzavřené oblasti. Každý pixel nese číslo
 * oblasti, obrys má 0. Pozadí kolem kreseb je oblast jako ostatní.
 *
 * Oblasti jsou souvislé jen přes hrany pixelů (ne přes rohy), takže ani
 * šikmá čára tlustá 1 px nepustí barvu do vedlejší oblasti.
 * Čistý TypeScript bez Phaseru.
 */

/** Číslo „oblasti“ obrysu. Skutečné oblasti mají čísla 1 až `regionCount`. */
export const OUTLINE_REGION = 0;

/** Pixel obrázku s takovou průhledností (0 až 255) a vyšší je obrys. */
const OUTLINE_MIN_ALPHA = 128;

/** Obrys po řádcích: 1 = obrys, 0 = volné místo. */
export interface OutlineBitmap {
  readonly width: number;
  readonly height: number;
  readonly outline: Uint8Array;
}

/** RGBA snímek obrázku (tvar `ImageData` z plátna). */
export interface OutlineImage {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray;
}

export interface RegionMap {
  readonly width: number;
  readonly height: number;
  /** Kolik je oblastí (bez obrysu). */
  readonly regionCount: number;
  /** Číslo oblasti každého pixelu po řádcích, obrys má `OUTLINE_REGION`. */
  readonly regionIds: Int32Array;
}

/** Obrys ze snímku obrázku: neprůhledný pixel je obrys, průhledný volné místo. */
export function outlineFromImage(image: OutlineImage): OutlineBitmap {
  const pixelCount = image.width * image.height;
  const outline = new Uint8Array(pixelCount);
  for (let index = 0; index < pixelCount; index += 1) {
    const alpha = image.data[index * 4 + 3] ?? 0;
    outline[index] = alpha >= OUTLINE_MIN_ALPHA ? 1 : 0;
  }
  return { width: image.width, height: image.height, outline };
}

/** Pixel, kterému ještě nebyla přidělena oblast. */
const UNASSIGNED = -1;

/** Rozdělí obrys na oblasti. Každá souvislá část volného místa dostane vlastní číslo. */
export function buildRegionMap(bitmap: OutlineBitmap): RegionMap {
  const { width, height, outline } = bitmap;
  const pixelCount = width * height;
  const regionIds = new Int32Array(pixelCount).fill(UNASSIGNED);
  // Zásobník pro vyplňování; každý pixel do něj přijde nejvýš jednou.
  const pending = new Int32Array(pixelCount);
  let regionCount = 0;

  for (let start = 0; start < pixelCount; start += 1) {
    if (outline[start] === 1) {
      regionIds[start] = OUTLINE_REGION;
      continue;
    }
    if (regionIds[start] !== UNASSIGNED) {
      continue;
    }
    regionCount += 1;
    fillRegion(bitmap, regionIds, pending, start, regionCount);
  }
  return { width, height, regionCount, regionIds };
}

/** Přidělí číslo `region` všem volným pixelům spojeným s pixelem `start` přes hrany. */
function fillRegion(
  bitmap: OutlineBitmap,
  regionIds: Int32Array,
  pending: Int32Array,
  start: number,
  region: number,
): void {
  const { width, height, outline } = bitmap;
  const claim = (index: number): boolean => {
    if (outline[index] === 1 || regionIds[index] !== UNASSIGNED) {
      return false;
    }
    regionIds[index] = region;
    return true;
  };

  let pendingCount = 0;
  const visit = (index: number): void => {
    if (claim(index)) {
      pending[pendingCount] = index;
      pendingCount += 1;
    }
  };

  visit(start);
  while (pendingCount > 0) {
    pendingCount -= 1;
    const index = pending[pendingCount] ?? 0;
    const x = index % width;
    const y = (index - x) / width;
    if (x > 0) {
      visit(index - 1);
    }
    if (x < width - 1) {
      visit(index + 1);
    }
    if (y > 0) {
      visit(index - width);
    }
    if (y < height - 1) {
      visit(index + width);
    }
  }
}

/**
 * Číslo oblasti v bodě (x, y) v pixelech mapy; desetinné souřadnice patří
 * pixelu, ve kterém leží. `OUTLINE_REGION` na obrysu, `null` mimo plochu.
 */
export function regionAt(map: RegionMap, x: number, y: number): number | null {
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }
  const column = Math.floor(x);
  const row = Math.floor(y);
  if (column < 0 || row < 0 || column >= map.width || row >= map.height) {
    return null;
  }
  return map.regionIds[row * map.width + column] ?? null;
}
