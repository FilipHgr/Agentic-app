/**
 * Rozložení výběru omalovánky (#124 AC6) podle schválených obrázků. Výběr
 * má stejnou herní plochu jako malování a místo pro 6 náhledů stejné
 * velikosti s poměrem stran omalovánky 4 : 3:
 * - na šířku mřížka 3 × 2 mezi pruhem domečku vlevo a stejně širokým
 *   pruhem vpravo,
 * - na výšku mřížka 2 × 3 pod domečkem.
 * Mřížka je ve volném místě uprostřed. Míst je vždy 6, i když má sada méně
 * omalovánek; prázdná místa scéna nekreslí. Čistý TypeScript bez Phaseru.
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
  return { previews, cornerRadius: radius * unitsPerCss };
}

/** Místo náhledu pod dotykem (herní jednotky), `null` mimo náhledy a v mezerách. */
export function previewAt(layout: PickerLayout, x: number, y: number): number | null {
  const place = layout.previews.findIndex(
    (rect) =>
      x >= rect.left && x < rect.left + rect.width && y >= rect.top && y < rect.top + rect.height,
  );
  return place < 0 ? null : place;
}
