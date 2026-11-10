/// <reference types="vite/client" />
/**
 * Pomůcky pro testy k #128 (pět skutečných omalovánek místo kruhů a hvězdy).
 *
 * Obrysy jsou soubory `src/games/coloring/pictures/<id>.png` (doporučení
 * k otázce 1: PNG s paletou a 16 úrovněmi průhlednosti). Testy je čtou přes
 * `import.meta.glob` s `?inline` jako dlaždice v #122 a rozloží je na
 * oblasti stejně jako hra: hra obrys vykreslí do plátna 1024 × 768 a z jeho
 * RGBA snímku spočítá `buildRegionMap(outlineFromImage(snímek))`. Snímek
 * tady vznikne přímo ze souboru (`decodePng` z `pngReader.mjs`, jen
 * vestavěný `zlib`), obrys má přesně rozměr plátna, takže se nic nezmenšuje.
 */

import { NO_COLOR, createColoring } from '../../../src/games/coloring/logic/coloring';
import { buildRegionMap, outlineFromImage } from '../../../src/games/coloring/logic/regionMap';
import type { RegionMap } from '../../../src/games/coloring/logic/regionMap';
import type { PictureIdentity } from '../../../src/games/coloring/logic/savedPicture';
import { decodePng } from './pngReader.mjs';
import type { DecodedPng } from './pngReader.mjs';
import { at, stroke } from './strokeHelpers';

/** Pět nových omalovánek v pořadí sady (AC1), schválně opsané, ne konstanta z kódu. */
export const NEW_PICTURE_IDS = ['cat', 'dog', 'car', 'butterfly', 'fish'] as const;

/** Celá sada ve hře v pořadí náhledů (AC1): domek a pět nových, všechny verze 1. */
export const EXPECTED_SET: readonly PictureIdentity[] = [
  { id: 'house', version: 1 },
  ...NEW_PICTURE_IDS.map((id) => ({ id, version: 1 })),
];

/** Rozměr obrysu a vrstvy barev v malování (AC2). */
export const OUTLINE_WIDTH = 1024;
export const OUTLINE_HEIGHT = 768;

/** Barva čáry obrysu (AC2) jako RGB. */
export const LINE_RGB: readonly [number, number, number] = [0x1d, 0x1d, 0x1f];

/** Soubory ve složce obrázků omalovánek: jméno souboru → obsah jako adresa `data:`. */
export const PICTURE_FILES: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(
    import.meta.glob<string>('../../../src/games/coloring/pictures/*', {
      query: '?inline',
      import: 'default',
      eager: true,
    }),
  ).map(([path, dataUrl]) => [path.replace('../../../src/games/coloring/pictures/', ''), dataUrl]),
);

/** Bajty souboru z adresy `data:` v base64. */
export function bytesOfDataUrl(dataUrl: string): Uint8Array {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}

/** Jméno souboru obrysu nové omalovánky. */
export function outlineFileName(id: string): string {
  return `${id}.png`;
}

/** Bajty obrysu nové omalovánky, nebo `null`, když soubor není. */
export function outlineBytes(id: string): Uint8Array | null {
  const dataUrl = PICTURE_FILES[outlineFileName(id)];
  return dataUrl === undefined ? null : bytesOfDataUrl(dataUrl);
}

/** Přečtený obrys a jeho mapa oblastí, jak ji spočítá hra. */
export interface ReadOutline {
  readonly png: DecodedPng;
  readonly regions: RegionMap;
}

/** Obrys a mapa oblastí z bajtů PNG. */
export function readOutline(bytes: Uint8Array): ReadOutline {
  const png = decodePng(bytes);
  const regions = buildRegionMap(outlineFromImage(png));
  return { png, regions };
}

const readCache = new Map<string, ReadOutline | null>();

/** Obrys nové omalovánky (načte se jednou), `null`, když soubor není. */
export function outlineOf(id: string): ReadOutline | null {
  if (!readCache.has(id)) {
    const bytes = outlineBytes(id);
    readCache.set(id, bytes === null ? null : readOutline(bytes));
  }
  return readCache.get(id) ?? null;
}

/** Velikost každé oblasti v pixelech; index je číslo oblasti, 0 (obrys) se nepočítá. */
export function regionSizes(regions: RegionMap): number[] {
  const sizes = new Array<number>(regions.regionCount + 1).fill(0);
  for (const region of regions.regionIds) {
    sizes[region] = (sizes[region] ?? 0) + 1;
  }
  return sizes;
}

/** Pixel uprostřed oblasti `region` v pořadí po řádcích (prostřední z jejích pixelů). */
export function pixelInRegion(regions: RegionMap, region: number): { x: number; y: number } {
  const pixels: number[] = [];
  regions.regionIds.forEach((value, index) => {
    if (value === region) {
      pixels.push(index);
    }
  });
  const index = pixels[Math.floor(pixels.length / 2)] ?? 0;
  return { x: index % regions.width, y: Math.floor(index / regions.width) };
}

/** Výsledek tahu: kolik pixelů se zabarvilo a kolik z nich mimo oblast, kde tah začal. */
export interface StrokeSpill {
  readonly painted: number;
  readonly outside: number;
}

/**
 * Dítě začne tah štětcem uprostřed oblasti `region` a táhne prst přes celý
 * obrázek do nejvzdálenějšího rohu a zpátky. Vrátí, kolik pixelů se
 * zabarvilo a kolik z nich leží mimo oblast tahu.
 */
export function strokeAcrossPicture(regions: RegionMap, region: number): StrokeSpill {
  const coloring = createColoring(regions);
  const start = pixelInRegion(regions, region);
  const corner = at(
    start.x < regions.width / 2 ? regions.width - 1 : 0,
    start.y < regions.height / 2 ? regions.height - 1 : 0,
  );
  const begin = at(start.x + 0.5, start.y + 0.5);
  stroke(coloring, [begin, corner, begin], 0);
  let painted = 0;
  let outside = 0;
  coloring.colorLayer().forEach((value, index) => {
    if (value === NO_COLOR) {
      return;
    }
    painted += 1;
    if (regions.regionIds[index] !== region) {
      outside += 1;
    }
  });
  return { painted, outside };
}
