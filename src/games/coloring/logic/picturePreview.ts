/**
 * Náhled omalovánky na výběru (#124 AC3): zmenšený uložený obrázek. Čte se
 * ze stejného úložiště hry aktivního profilu jako malování, takže po
 * nepodařeném uložení ukazuje stav z paměti úložiště (AC5). Chybějící,
 * poškozený, nečitelný nebo cizí záznam dá náhled jen s obrysem na pozadí
 * obrázku, stejně jako prázdnou omalovánku v malování.
 *
 * Každý pixel náhledu vezme pixel obrázku ze středu plochy, která na něj
 * po zmenšení připadne: pozadí, obrys, nebo barvu dítěte. Barvy se
 * nemíchají. Stejně se kreslí náhledy obrázků v albu (#126).
 * Čistý TypeScript bez Phaseru.
 */

import type { KeyValueStorage } from '../../../shared/storage/keyValueStorage';
import { OUTLINE_REGION, regionAt } from './regionMap';
import type { RegionMap } from './regionMap';
import { openColoring } from './savedPicture';
import type { PictureColors, PictureIdentity } from './savedPicture';
import { PICTURE_STYLE } from './theme';
import { colorHex } from './toolColorSets';

/** Pixel náhledu: pozadí obrázku, obrys, nebo barva dítěte (číslo barvy). */
export type PreviewCell =
  | { readonly kind: 'background' }
  | { readonly kind: 'outline' }
  | { readonly kind: 'color'; readonly color: number };

export interface PicturePreview {
  readonly width: number;
  readonly height: number;
  /** Pixel náhledu (x, y). */
  cellAt(x: number, y: number): PreviewCell;
}

const BACKGROUND: PreviewCell = { kind: 'background' };
const OUTLINE: PreviewCell = { kind: 'outline' };

/** Barva pixelu náhledu jako '#RRGGBB'. */
export function previewCellHex(cell: PreviewCell): string {
  switch (cell.kind) {
    case 'background':
      return PICTURE_STYLE.background;
    case 'outline':
      return PICTURE_STYLE.outlineColor;
    case 'color':
      // Barvu mimo sady záznam nepustí; kdyby přece, ukáže se pozadí.
      return colorHex(cell.color) ?? PICTURE_STYLE.background;
  }
}

/** Pixel obrázku ve středu plochy, která připadne na pixel náhledu `index`. */
function sourceIndex(index: number, previewSize: number, pictureSize: number): number {
  return Math.min(pictureSize - 1, Math.floor(((index + 0.5) * pictureSize) / previewSize));
}

/** Náhled omalovánky `picture` v rozměru `width` × `height` pixelů. */
export function loadPicturePreview(options: {
  readonly storage: KeyValueStorage | undefined;
  readonly picture: PictureIdentity;
  readonly regions: RegionMap;
  readonly width: number;
  readonly height: number;
}): PicturePreview {
  // Samotné otevření nic nezapíše (#92 AC1), náhled tedy úložiště nemění.
  const saved = openColoring({
    regions: options.regions,
    picture: options.picture,
    storage: options.storage,
  });
  return previewOfColors({ ...options, colors: saved });
}

/** Náhled obrázku s barvami `colors` (i obrázku z alba, #126) v rozměru `width` × `height`. */
export function previewOfColors(options: {
  readonly colors: PictureColors;
  readonly regions: RegionMap;
  readonly width: number;
  readonly height: number;
}): PicturePreview {
  const { colors, regions, width, height } = options;
  return {
    width,
    height,
    cellAt: (x, y) => {
      const sourceX = sourceIndex(x, width, regions.width);
      const sourceY = sourceIndex(y, height, regions.height);
      if (regionAt(regions, sourceX, sourceY) === OUTLINE_REGION) {
        return OUTLINE;
      }
      const color = colors.colorAt(sourceX, sourceY);
      return color === null ? BACKGROUND : { kind: 'color', color };
    },
  };
}
