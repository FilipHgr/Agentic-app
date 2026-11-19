/**
 * Pomůcky pro testy ikon tlačítek alba a malování (#153): fotoaparát,
 * album, malovat dál, koš a koště mají nové ikony z ElevenLabs (WebP ve
 * složce ikon hry) a barevné podklady podle toho, jestli obrázek uchovají,
 * nebo odstraní.
 *
 * Soubory se čtou přes `import.meta.glob` (`?inline` jako `data:` adresa
 * v base64), stejně jako klíč v `toolIconAssets.test.ts` (#140). Obrázky
 * WebP Node nepřečte, porovnávají se změřené mřížky z
 * `actionIconMeasures.ts`; ikony nástrojů (SVG Noto) se rasterizují
 * v testu (`maskOfSvg`).
 *
 * Rozdíl obrázků (AC1, „jako u #106“): obě ikony na mřížce 32 × 32 dílků
 * přes čtverec, do kterého je hra kreslí. Počítají se dílky, kde je
 * aspoň jedna ikona neprůhledná; z nich se liší ty, kde je jedna průhledná
 * a druhá ne, nebo jsou obě neprůhledné a barva se liší aspoň o
 * `COLOR_DIFFERENCE` v některém kanálu. U ikon nástrojů je známý jen tvar
 * (barvy SVG test nerasterizuje), porovnává se tedy jen tvar, což je
 * přísnější. Rozdíl je díl lišících se dílků z počítaných.
 */

import { contrastRatio } from '../../../src/shared/logic/theme';
import { MASK_SAMPLES, maskOfSvg } from './toolIconMaskHelpers';
import { MEASURE_GRID } from './actionIconMeasures';
import type { EdgeColor, IconMeasure } from './actionIconMeasures';
import { ICON_FOLDER } from './toolIconHelpers';

export { ICON_FOLDER };

/** Nejmenší rozdíl ikony proti každé jiné ikoně ve hře (AC1, jako u #106). */
export const MIN_DIFFERENCE = 0.25;

/** O kolik se musí lišit kanál barvy, aby dílek platil za jinak barevný (čtvrtina rozsahu). */
export const COLOR_DIFFERENCE = 64;

/** Nejmenší kontrast ikony proti podkladu (AC2). */
export const MIN_CONTRAST = 3;

/** Nejmenší díl okraje ikony, který má proti podkladu aspoň `MIN_CONTRAST` (AC2). */
export const MIN_CONTRASTING_EDGE = 0.9;

/** Nejvýš tolik bajtů smí mít ikona (AC4). */
export const MAX_ACTION_ICON_BYTES = 8_192;

/** Dílek mřížky: průhledný, neprůhledný s barvou, nebo neprůhledný bez známé barvy. */
export type GridCell =
  { readonly kind: 'empty' } | { readonly kind: 'shape'; readonly hex: string | null };

export interface IconGrid {
  readonly name: string;
  readonly cells: readonly GridCell[];
}

const EMPTY: GridCell = { kind: 'empty' };

/** Mřížka ze změřených řádků; chyba ve tvaru měření se vrátí jako popis problému. */
export function gridOfMeasure(name: string, measure: IconMeasure): IconGrid | string {
  if (measure.rows.length !== MEASURE_GRID) {
    return `${name}: ${measure.rows.length} řádků místo ${MEASURE_GRID}`;
  }
  const cells: GridCell[] = [];
  for (const [index, row] of measure.rows.entries()) {
    const tokens = row.trim().split(/\s+/);
    if (tokens.length !== MEASURE_GRID) {
      return `${name}: řádek ${index + 1} má ${tokens.length} dílků místo ${MEASURE_GRID}`;
    }
    for (const token of tokens) {
      if (token === '-') {
        cells.push(EMPTY);
      } else if (/^#[0-9A-F]{6}$/i.test(token)) {
        cells.push({ kind: 'shape', hex: token.toUpperCase() });
      } else {
        return `${name}: řádek ${index + 1} má neznámý dílek „${token}“`;
      }
    }
  }
  return { name, cells };
}

/** Mřížka tvaru ikony SVG: dílek je neprůhledný, když je neprůhledná aspoň polovina jeho vzorků. */
export function gridOfSvg(name: string, svg: string): IconGrid {
  const mask = maskOfSvg(svg);
  const step = MASK_SAMPLES / MEASURE_GRID;
  const cells: GridCell[] = [];
  for (let row = 0; row < MEASURE_GRID; row += 1) {
    for (let column = 0; column < MEASURE_GRID; column += 1) {
      let opaque = 0;
      for (let y = row * step; y < (row + 1) * step; y += 1) {
        for (let x = column * step; x < (column + 1) * step; x += 1) {
          opaque += mask.opaque[y * MASK_SAMPLES + x] ?? 0;
        }
      }
      cells.push(opaque * 2 >= step * step ? { kind: 'shape', hex: null } : EMPTY);
    }
  }
  return { name, cells };
}

function channels(hex: string): readonly [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

function colorsDiffer(first: string, second: string): boolean {
  const a = channels(first);
  const b = channels(second);
  return a.some((channel, index) => Math.abs(channel - (b[index] ?? 0)) >= COLOR_DIFFERENCE);
}

function cellsDiffer(first: GridCell, second: GridCell): boolean {
  if (first.kind !== second.kind) {
    return true;
  }
  if (first.kind === 'empty' || second.kind === 'empty') {
    return false;
  }
  return first.hex !== null && second.hex !== null && colorsDiffer(first.hex, second.hex);
}

/** Díl dílků, kterými se ikony liší, z dílků, kde je aspoň jedna neprůhledná (0 až 1). */
export function differenceShare(first: IconGrid, second: IconGrid): number {
  let counted = 0;
  let differing = 0;
  for (let index = 0; index < first.cells.length; index += 1) {
    const a = first.cells[index] ?? EMPTY;
    const b = second.cells[index] ?? EMPTY;
    if (a.kind === 'empty' && b.kind === 'empty') {
      continue;
    }
    counted += 1;
    if (cellsDiffer(a, b)) {
      differing += 1;
    }
  }
  return counted === 0 ? 0 : differing / counted;
}

/** Díl neprůhledných dílků mřížky (prázdná ikona by se od ničeho „nelišila“ smysluplně). */
export function shapeShare(grid: IconGrid): number {
  const shapes = grid.cells.filter((cell) => cell.kind === 'shape').length;
  return shapes / grid.cells.length;
}

/** Barva `color` s neprůhledností `alpha` složená na podklad `background`, jak ji nakreslí plátno. */
export function compositeOn(color: string, alpha: number, background: string): string {
  const top = channels(color);
  const bottom = channels(background);
  const mixed = top.map((channel, index) =>
    Math.round(alpha * channel + (1 - alpha) * (bottom[index] ?? 0)),
  );
  return `#${mixed.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

/**
 * Díl okraje ikony, který má po složení na podklad `background` (s průhledností
 * okrajového bodu) kontrast aspoň `MIN_CONTRAST` proti tomuto podkladu.
 */
export function contrastingEdgeShare(edgeColors: readonly EdgeColor[], background: string): number {
  return edgeColors
    .filter(
      (edge) =>
        contrastRatio(compositeOn(edge.color, edge.alpha, background), background) >= MIN_CONTRAST,
    )
    .reduce((sum, edge) => sum + edge.share, 0);
}

// ---------------------------------------------------------------------------
// Soubory WebP ve složce ikon
// ---------------------------------------------------------------------------

/** Obrázky WebP ve složce ikon jako `data:` adresy, klíč je jméno souboru. */
export const WEBP_ICON_FILES: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(
    import.meta.glob<string>('../../../src/games/coloring/icons/*.webp', {
      query: '?inline',
      import: 'default',
      eager: true,
    }),
  ).map(([path, dataUrl]) => [path.replace('../../../src/games/coloring/icons/', ''), dataUrl]),
);

export function bytesOfDataUrl(dataUrl: string): Uint8Array<ArrayBuffer> {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}

export function asciiOf(bytes: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...bytes.slice(start, start + length));
}

/** Bajty ikony WebP podle jména souboru; `null`, když soubor ve složce není. */
export function webpBytesOf(file: string): Uint8Array<ArrayBuffer> | null {
  const dataUrl = WEBP_ICON_FILES[file];
  return dataUrl === undefined ? null : bytesOfDataUrl(dataUrl);
}

export async function sha256Of(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
