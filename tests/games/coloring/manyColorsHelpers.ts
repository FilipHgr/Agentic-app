/**
 * Pomůcky pro testy úspornějšího ukládání obrázku pro víc barev (#115).
 *
 * Zkušební paleta má 64 barev (AC1). Dnešní paleta má 12 barev, proto se
 * velikost zkušební palety hře předává volbou `paletteSize` (navržené
 * rozhraní v `manyColorsRecord.test.ts`). Počty jsou schválně opsané ze
 * zadání, ne konstanty z kódu, aby je nešlo potichu změnit.
 *
 * Vzory pro limit (AC2) se staví ve dvou krocích:
 * 1. „Pořadí v řadě“: každý pixel dostane číslo pruhu nebo tahu dokola
 *    přes 64 míst (0, 1, 2, …, 63, 0, …), u vzorků nástrojů přes V má
 *    pixel vzorku místo o jedno dál, jako ve stávajících testech limitu.
 * 2. Pořadí barev: místo v řadě se převede na barvu, buď vzestupně
 *    (0, 1, 2, … jako dnes), nebo střídáním vzdálených barev
 *    (0, 63, 1, 62, …).
 * Obrázek jednoho vzoru se tak nakreslí jen jednou a obě pořadí barev
 * mají přesně stejný tvar.
 */

import {
  decodePicture,
  encodePicture,
  openColoring,
} from '../../../src/games/coloring/logic/savedPicture';
import type {
  DecodedPicture,
  PictureColors,
  PictureIdentity,
  SavedColoring,
} from '../../../src/games/coloring/logic/savedPicture';
import { brushWidthFor, createColoring } from '../../../src/games/coloring/logic/coloring';
import { OUTLINE_REGION, regionAt } from '../../../src/games/coloring/logic/regionMap';
import type { RegionMap } from '../../../src/games/coloring/logic/regionMap';
import type { ToolId } from '../../../src/games/coloring/logic/toolPanel';
import { COLORING_META } from '../../../src/games/coloring/meta';
import type { KeyValueStorage } from '../../../src/shared/storage/keyValueStorage';
import type { ProfileStore } from '../../../src/shared/storage/profileStorage';
import { MID_W } from './extendedPaletteHelpers';
import { LEGACY_P3_RECORD, LEGACY_P3_STORAGE } from './legacyP3RecordFixture';
import { PICTURE } from './savedPictureHelpers';

/** Velikost zkušební palety z AC1. */
export const TEST_PALETTE_SIZE = 64;

/** Cíl z AC2: 50 000 znaků s rezervou 10 % (otázka 1 schválená podle doporučení). */
export const RESERVED_RECORD_LIMIT = 45_000;

/** Limit z #92 AC6, který se podle AC2 nemění. */
export const RECORD_LIMIT = 50_000;

/** Barva podle místa v řadě. */
export interface ColorOrder {
  readonly name: string;
  colorOf(place: number): number;
}

/** Vzestupné pořadí jako dnes: 0, 1, 2, … dokola. */
export const ASCENDING_ORDER: ColorOrder = {
  name: 'pořadí 0, 1, 2, …',
  colorOf: (place) => place % TEST_PALETTE_SIZE,
};

/** Vzdálené barvy: 0, 63, 1, 62, 2, 61, … dokola. */
const FAR_SEQUENCE: readonly number[] = Array.from({ length: TEST_PALETTE_SIZE }, (_, place) =>
  place % 2 === 0 ? place / 2 : TEST_PALETTE_SIZE - 1 - (place - 1) / 2,
);

export const FAR_ORDER: ColorOrder = {
  name: 'pořadí 0, 63, 1, 62, …',
  colorOf: (place) => FAR_SEQUENCE[place % TEST_PALETTE_SIZE] ?? 0,
};

export const COLOR_ORDERS: readonly ColorOrder[] = [ASCENDING_ORDER, FAR_ORDER];

/** Pixely míst v řadě (po řádcích, `null` bez barvy a na obrysu) převedené na barvy. */
export function inOrder(
  places: ReadonlyArray<number | null>,
  order: ColorOrder,
): Array<number | null> {
  return places.map((place) => (place === null ? null : order.colorOf(place)));
}

function isFree(regions: RegionMap, x: number, y: number): boolean {
  const region = regionAt(regions, x, y);
  return region !== null && region !== OUTLINE_REGION;
}

/** Barvy (nebo místa v řadě) všech pixelů po řádcích. */
export function pixelsFrom(
  source: { colorAt(x: number, y: number): number | null },
  regions: RegionMap,
): Array<number | null> {
  const pixels: Array<number | null> = [];
  for (let y = 0; y < regions.height; y += 1) {
    for (let x = 0; x < regions.width; x += 1) {
      pixels.push(source.colorAt(x, y));
    }
  }
  return pixels;
}

/** Pixely jako `PictureColors` pro `encodePicture`. */
export function colorsOf(pixels: ReadonlyArray<number | null>, regions: RegionMap): PictureColors {
  return {
    colorAt: (x, y) => pixels[y * regions.width + x] ?? null,
  };
}

/**
 * Vzor V z #96 v místech řady: svislé pruhy šířky W stř zleva bez mezer,
 * pruh `n` má místo `n` (dokola přes 64 míst), obrys je prázdný. Pruh
 * pixelu se určí podle jeho středu.
 */
export function stripePlaces(regions: RegionMap): Array<number | null> {
  const stripeWidth = brushWidthFor(regions.width);
  return pixelsFrom(
    {
      colorAt(x, y) {
        if (!isFree(regions, x, y)) {
          return null;
        }
        return Math.floor((x + 0.5) / stripeWidth) % TEST_PALETTE_SIZE;
      },
    },
    regions,
  );
}

/**
 * Vzorek nástroje přes V v místech řady: pixel vzorku (`isPatternPixel`)
 * má místo o jedno dál než jeho pruh, jako ve stávajících testech limitu
 * (#101–#104).
 */
export function patternOverStripes(
  regions: RegionMap,
  isPatternPixel: (x: number, y: number) => boolean,
): Array<number | null> {
  const stripes = stripePlaces(regions);
  return stripes.map((place, index) => {
    if (place === null) {
      return null;
    }
    const x = index % regions.width;
    const y = Math.floor(index / regions.width);
    return isPatternPixel(x, y) ? (place + 1) % TEST_PALETTE_SIZE : place;
  });
}

/** Souvislé úseky sloupce `x` mimo obrys jako [první řádek, poslední řádek]. */
function freeRuns(regions: RegionMap, x: number): Array<[number, number]> {
  const runs: Array<[number, number]> = [];
  let start: number | null = null;
  for (let y = 0; y < regions.height; y += 1) {
    if (isFree(regions, x, y)) {
      start ??= y;
    } else if (start !== null) {
      runs.push([start, y - 1]);
      start = null;
    }
  }
  if (start !== null) {
    runs.push([start, regions.height - 1]);
  }
  return runs;
}

/**
 * Vzor V nakreslený pastelkou (#93) v místech řady: v každém pruhu dva
 * svislé tahy místem pruhu v každém souvislém úseku sloupce mimo obrys.
 */
export function crayonPlaces(regions: RegionMap): Array<number | null> {
  const coloring = createColoring(regions);
  const stripeWidth = brushWidthFor(regions.width);
  let pointerId = 1;
  for (let stripe = 0; stripe * stripeWidth < regions.width; stripe += 1) {
    const place = stripe % TEST_PALETTE_SIZE;
    for (const share of [0.25, 0.75]) {
      const x = (stripe + share) * stripeWidth;
      if (x >= regions.width) {
        continue;
      }
      for (const [top, bottom] of freeRuns(regions, Math.floor(x))) {
        coloring.pointerDown({ id: pointerId, x, y: top + 0.5, kind: 'touch' }, place, 'crayon');
        coloring.pointerMove({ id: pointerId, x, y: bottom + 0.5, kind: 'touch' });
        coloring.pointerUp(pointerId);
        pointerId += 1;
      }
    }
  }
  return pixelsFrom(coloring, regions);
}

/**
 * Svislé tahy přes celou plochu podle #96 nástrojem `tool` v místech řady:
 * tahy shora dolů vedle sebe po W stř, tah `n` má místo `n`. Duha místo
 * nepoužije a maluje svých 6 barev; u ní se jako místo v řadě bere barva
 * duhy, takže ji pořadí barev také přemapuje.
 */
export function verticalStrokePlaces(regions: RegionMap, tool: ToolId): Array<number | null> {
  const coloring = createColoring(regions);
  let pointerId = 1;
  for (let stripe = 0; stripe * MID_W < regions.width; stripe += 1) {
    const x = (stripe + 0.5) * MID_W;
    coloring.pointerDown(
      { id: pointerId, x, y: 0, kind: 'touch' },
      stripe % TEST_PALETTE_SIZE,
      tool,
    );
    for (let y = 16; y <= regions.height; y += 16) {
      coloring.pointerMove({ id: pointerId, x, y, kind: 'touch' });
    }
    coloring.pointerUp(pointerId);
    pointerId += 1;
  }
  return pixelsFrom(coloring, regions);
}

/** Zakóduje pixely se zkušební paletou 64 barev. */
export function encodeWithTestPalette(
  regions: RegionMap,
  pixels: ReadonlyArray<number | null>,
  selectedColor: number,
  picture: PictureIdentity = PICTURE,
): string {
  return encodePicture({
    picture,
    regions,
    colors: colorsOf(pixels, regions),
    selectedColor,
    paletteSize: TEST_PALETTE_SIZE,
  });
}

/** Přečte záznam se zkušební paletou 64 barev. */
export function decodeWithTestPalette(record: string, regions: RegionMap): DecodedPicture | null {
  return decodePicture(record, PICTURE, regions, TEST_PALETTE_SIZE);
}

/** Dítě otevře Omalovánky se zkušební paletou 64 barev nad úložištěm `storage`. */
export function openWithTestPalette(
  storage: KeyValueStorage | undefined,
  regions: RegionMap,
): SavedColoring {
  return openColoring({
    regions,
    picture: PICTURE,
    storage,
    paletteSize: TEST_PALETTE_SIZE,
  });
}

/** Dítě ťukne v menu na Omalovánky za aktivní profil (zkušební paleta 64 barev). */
export function enterWithTestPalette(store: ProfileStore, regions: RegionMap): SavedColoring {
  return openWithTestPalette(store.gameStorage(COLORING_META.id), regions);
}

/**
 * Klíč záznamu obrázku v úložišti hry, převzatý z pevného úložiště
 * `LEGACY_P3_STORAGE` (tam, kam ho hra sama zapsala), aby ho testy
 * nemusely znát.
 */
export const PICTURE_KEY: string =
  LEGACY_P3_STORAGE.find(([, value]) => value === LEGACY_P3_RECORD)?.[0] ?? '';

/** Kontrolní součet FNV-1a záznamu podle popisu záznamu v `savedPicture.ts`. */
function checksumOf(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Pole záznamu podle popisu v `savedPicture.ts`: formát, id, verze, šířka,
 * výška, vybraná barva, data, kontrolní součet. Testy z nich znají jen
 * pořadí polí a kontrolní součet (hlavičku záznamu), ne kódování vrstvy.
 */
export const SELECTED_FIELD = 5;
export const DATA_FIELD = 6;
const FIELD_COUNT = 8;

/**
 * Záznam se změněnými poli a znovu spočítaným kontrolním součtem, aby
 * změnu nezachytil už součet a dostala se až ke čtení formátu. `null`,
 * když záznam nemá popsaný tvar (pak se pomůcka musí upravit).
 */
export function rewrittenRecord(record: string, change: (fields: string[]) => void): string | null {
  const fields = record.split('|');
  if (fields.length !== FIELD_COUNT) {
    return null;
  }
  const body = fields.slice(0, -1);
  change(body);
  const joined = body.join('|');
  return `${joined}|${checksumOf(joined)}`;
}
