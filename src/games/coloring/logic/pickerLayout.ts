/**
 * Rozložení výběru omalovánky (#124 AC6) podle schválených obrázků. Výběr
 * má stejnou herní plochu jako malování a místo pro 6 náhledů stejné
 * velikosti s poměrem stran omalovánky 4 : 3:
 * - na šířku mřížka 3 × 2 mezi pruhem domečku vlevo a stejně širokým
 *   pruhem vpravo,
 * - na výšku mřížka 2 × 3 pod domečkem.
 * Mřížka je ve volném místě uprostřed. Míst je vždy 6, i když má sada méně
 * omalovánek; prázdná místa scéna nekreslí.
 *
 * Od #126 je na výběru kniha vpravo nahoře zrcadlově k domečku a stejně
 * velká, mimo mřížku (mřížka se nemění). Album má ve stejném volném místě
 * 12 náhledů: na šířku 4 × 3, na výšku 3 × 4 nebo 2 × 6, podle toho, co
 * dá větší náhledy. Čistý TypeScript bez Phaseru.
 */

import { homeButtonInFreeArea } from '../../../shared/logic/homeButton';
import { isPhoneMode } from '../../../shared/logic/viewportLayout';
import type { GameArea } from '../../../shared/logic/viewportLayout';
import { PICTURE_ASPECT } from './coloringLayout';
import type { LayoutRect } from './coloringLayout';

/** Míst pro náhledy (#124 AC6, posouvání pro víc omalovánek je mimo rozsah). */
export const PICKER_PLACES = 6;

/** Mezera mezi náhledy v CSS px: na telefonu nejmenší povolená 16 px, na iPadu víc. */
const PHONE_GAP_CSS = 16;
const TABLET_GAP_CSS = 24;

/** Odstup mřížky od domečku a od okraje plochy v CSS px. */
const EDGE_CSS = 8;

/** Zaoblení rohů dlaždice v CSS px jako u dlaždic menu. */
const PHONE_RADIUS_CSS = 20;
const TABLET_RADIUS_CSS = 24;

export interface PickerLayout {
  /** 6 míst náhledů v herních jednotkách, po řadách zleva doprava. */
  readonly previews: readonly LayoutRect[];
  /** Zaoblení rohů dlaždice v herních jednotkách. */
  readonly cornerRadius: number;
  /** Kniha vpravo nahoře, otevře album (#126 AC4). */
  readonly book: LayoutRect;
}

/** Volné místo pro mřížku v CSS px. */
interface FreeBox {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Volné místo pro mřížku v CSS px: na šířku mezi pruhem domečku a stejně
 * širokým pruhem vpravo, na výšku pod domečkem.
 */
function freeBoxFor(area: GameArea, landscape: boolean): FreeBox {
  const cssPerUnit = area.scale;
  const home = homeButtonInFreeArea(area);
  const width = area.width * cssPerUnit;
  const height = area.height * cssPerUnit;
  if (landscape) {
    const strip = (home.left + home.size) * cssPerUnit + EDGE_CSS;
    return { left: strip, top: EDGE_CSS, width: width - 2 * strip, height: height - 2 * EDGE_CSS };
  }
  const top = (home.top + home.size) * cssPerUnit + EDGE_CSS;
  return { left: EDGE_CSS, top, width: width - 2 * EDGE_CSS, height: height - top - EDGE_CSS };
}

/** Největší šířka náhledu 4 : 3, se kterou se mřížka vejde do volného místa. */
function previewWidthFor(free: FreeBox, columns: number, rows: number, gap: number): number {
  const byWidth = (free.width - (columns - 1) * gap) / columns;
  const byHeight = ((free.height - (rows - 1) * gap) / rows) * PICTURE_ASPECT;
  return Math.min(byWidth, byHeight);
}

/** Rozložení výběru pro herní plochu `area`. */
export function layoutPicker(area: GameArea): PickerLayout {
  const phone = isPhoneMode(area.mode);
  const landscape = area.width >= area.height;
  const columns = landscape ? 3 : 2;
  const rows = PICKER_PLACES / columns;
  const gap = phone ? PHONE_GAP_CSS : TABLET_GAP_CSS;
  const free = freeBoxFor(area, landscape);
  const width = previewWidthFor(free, columns, rows, gap);
  const height = width / PICTURE_ASPECT;
  const gridLeft = free.left + (free.width - (columns * width + (columns - 1) * gap)) / 2;
  const gridTop = free.top + (free.height - (rows * height + (rows - 1) * gap)) / 2;
  const unitsPerCss = 1 / area.scale;
  const previews = Array.from({ length: PICKER_PLACES }, (_, place) => ({
    left: (gridLeft + (place % columns) * (width + gap)) * unitsPerCss,
    top: (gridTop + Math.floor(place / columns) * (height + gap)) * unitsPerCss,
    width: width * unitsPerCss,
    height: height * unitsPerCss,
  }));
  const radius = phone ? PHONE_RADIUS_CSS : TABLET_RADIUS_CSS;
  return { previews, cornerRadius: radius * unitsPerCss, book: bookButtonFor(area) };
}

/** Místo náhledu pod dotykem (herní jednotky), `null` mimo náhledy a v mezerách. */
export function previewAt(layout: PickerLayout, x: number, y: number): number | null {
  return placeAt(layout.previews, x, y);
}

/** Místo v `places` pod dotykem, `null` mimo místa a v mezerách. */
function placeAt(places: readonly LayoutRect[], x: number, y: number): number | null {
  const place = places.findIndex(
    (rect) =>
      x >= rect.left && x < rect.left + rect.width && y >= rect.top && y < rect.top + rect.height,
  );
  return place < 0 ? null : place;
}

// ---------------------------------------------------------------------------
// Kniha a album (#126 AC6)
// ---------------------------------------------------------------------------

/** Kniha vpravo nahoře zrcadlově k domečku a stejně velká (herní jednotky, otázka 5). */
function bookButtonFor(area: GameArea): LayoutRect {
  const home = homeButtonInFreeArea(area);
  return {
    left: area.width - home.left - home.size,
    top: home.top,
    width: home.size,
    height: home.size,
  };
}

/** Míst pro obrázky v albu (#126, posouvání alba je mimo rozsah). */
export const ALBUM_PLACES = 12;

/** Sloupce alba podle schválených obrázků: na šířku 4 × 3, na výšku 3 × 4 nebo 2 × 6. */
const LANDSCAPE_ALBUM_COLUMNS: readonly number[] = [4];
const PORTRAIT_ALBUM_COLUMNS: readonly number[] = [3, 2];

/** Zaoblení náhledu alba nejvýš tento díl jeho výšky, aby roh malý obrázek moc neořízl. */
const ALBUM_RADIUS_SHARE = 0.16;

export interface AlbumLayout {
  /** 12 míst obrázků v herních jednotkách od nejnovějšího, po řadách zleva doprava. */
  readonly previews: readonly LayoutRect[];
  /** Zaoblení rohů náhledu v herních jednotkách. */
  readonly cornerRadius: number;
}

/**
 * Rozložení alba pro herní plochu `area`: 12 náhledů 4 : 3 ve volném místě
 * jako na výběru, s tolika sloupci, aby byly náhledy co největší.
 */
export function layoutAlbum(area: GameArea): AlbumLayout {
  const phone = isPhoneMode(area.mode);
  const landscape = area.width >= area.height;
  const gap = phone ? PHONE_GAP_CSS : TABLET_GAP_CSS;
  const free = freeBoxFor(area, landscape);
  let columns = 0;
  let width = 0;
  for (const candidate of landscape ? LANDSCAPE_ALBUM_COLUMNS : PORTRAIT_ALBUM_COLUMNS) {
    const candidateWidth = previewWidthFor(free, candidate, ALBUM_PLACES / candidate, gap);
    if (candidateWidth > width) {
      columns = candidate;
      width = candidateWidth;
    }
  }
  const rows = ALBUM_PLACES / columns;
  const height = width / PICTURE_ASPECT;
  const gridLeft = free.left + (free.width - (columns * width + (columns - 1) * gap)) / 2;
  const gridTop = free.top + (free.height - (rows * height + (rows - 1) * gap)) / 2;
  const unitsPerCss = 1 / area.scale;
  const previews = Array.from({ length: ALBUM_PLACES }, (_, place) => ({
    left: (gridLeft + (place % columns) * (width + gap)) * unitsPerCss,
    top: (gridTop + Math.floor(place / columns) * (height + gap)) * unitsPerCss,
    width: width * unitsPerCss,
    height: height * unitsPerCss,
  }));
  const radius = Math.min(
    phone ? PHONE_RADIUS_CSS : TABLET_RADIUS_CSS,
    height * ALBUM_RADIUS_SHARE,
  );
  return { previews, cornerRadius: radius * unitsPerCss };
}

/** Trefil dotyk `x`, `y` knihu na výběru (herní jednotky)? */
export function bookAt(layout: PickerLayout, x: number, y: number): boolean {
  return placeAt([layout.book], x, y) !== null;
}

/** Místo obrázku alba pod dotykem (herní jednotky), `null` mimo náhledy a v mezerách. */
export function albumPreviewAt(layout: AlbumLayout, x: number, y: number): number | null {
  return placeAt(layout.previews, x, y);
}
