/**
 * Rozložení výběru omalovánky (#124 AC6, od #132 pro 11 omalovánek) podle
 * schválených obrázků. Výběr má stejnou herní plochu jako malování a 12 míst
 * pro náhledy stejné velikosti s poměrem stran omalovánky 4 : 3:
 * - na šířku mřížka 4 × 3 mezi pruhem domečku vlevo a stejně širokým
 *   pruhem vpravo,
 * - na výšku mřížka 3 × 4, nebo 2 × 6 (co dá větší náhled) pod domečkem.
 * Mřížka je ve volném místě uprostřed, od knihy aspoň 16 px (na telefonu
 * na šířku 8 px). Míst je vždy 12; prázdná místa scéna nekreslí.
 *
 * Od #126 je na výběru kniha vpravo nahoře zrcadlově k domečku a stejně
 * velká, mimo mřížku. Album má ve stejném volném místě
 * 12 náhledů: na šířku 4 × 3, na výšku 3 × 4 nebo 2 × 6, podle toho, co
 * dá větší náhledy.
 *
 * Od #129 má velký obrázek z alba stejnou velikost jako obrázek v malování
 * a koš je na místě fotoaparátu z malování. Od #131 je vedle koše stejně
 * velké tlačítko malovat dál (štětec): na šířku ve sloupci koše 16 CSS px
 * nad ním, na výšku v řadě koše 16 CSS px vlevo od něj.
 *
 * Od #140 je vedle knihy ukazatel klíčů (ikona klíče s číslicí): na šířku
 * pod knihou v jejím pruhu, na výšku v řadě knihy vlevo od ní. Na ťuknutí
 * nereaguje.
 *
 * Od #150 má výběr s víc než 12 omalovánkami šipky ◀ ▶ na listování na
 * podobných místech vůči mřížce jako album (#149). Kniha a ukazatel klíčů
 * zůstanou na svém místě, náhledy stejně velké kromě 5 úzkých telefonů na
 * výšku (viz `layoutPicker`). Čistý TypeScript bez Phaseru.
 */

import { homeButtonInFreeArea } from '../../../shared/logic/homeButton';
import { isPhoneMode } from '../../../shared/logic/viewportLayout';
import type { GameArea } from '../../../shared/logic/viewportLayout';
import { albumPageCount } from './album';
import { pageCountOf } from './pageTurner';
import { PICTURE_ASPECT, layoutColoring, pictureWithoutBroom } from './coloringLayout';
import type { LayoutRect } from './coloringLayout';

/**
 * Míst pro náhledy: 12 v mřížce na šířku 4 × 3, na výšku 3 × 4 nebo 2 × 6 (#132).
 * Při víc než 12 omalovánkách se po 12 listuje šipkami (#150); prázdná
 * místa na poslední stránce scéna nekreslí.
 */
export const PICKER_PLACES = 12;

/** Mezera mezi náhledy v CSS px: na telefonu nejmenší povolená 16 px, na iPadu víc. */
const PHONE_GAP_CSS = 16;
const TABLET_GAP_CSS = 24;

/** Odstup mřížky od domečku a od okraje plochy v CSS px. */
const EDGE_CSS = 8;

/**
 * Odstup mřížky navíc v CSS px (#132 AC4): s mřížkou pro 11 omalovánek je
 * kniha od náhledů aspoň 16 px (na telefonu na šířku 8 px). Na šířku se
 * ubírá z obou stran, aby mřížka zůstala uprostřed.
 */
const BOOK_EXTRA_GAP_CSS = 8;

/** Zaoblení rohů dlaždice v CSS px jako u dlaždic menu. */
const PHONE_RADIUS_CSS = 20;
const TABLET_RADIUS_CSS = 24;

export interface PickerLayout {
  /** 12 míst náhledů v herních jednotkách, po řadách zleva doprava (#132). */
  readonly previews: readonly LayoutRect[];
  /** Zaoblení rohů dlaždice v herních jednotkách. */
  readonly cornerRadius: number;
  /** Kniha vpravo nahoře, otevře album (#126 AC4). */
  readonly book: LayoutRect;
  /** Ukazatel klíčů vedle knihy (#140 AC3), nereaguje na ťuknutí. */
  readonly keyIndicator: LayoutRect;
  /** Jsou šipky vidět (víc než 12 omalovánek, #150)? Bez nich je výběr jako před #150. */
  readonly arrows: boolean;
  /** Šipka ◀ na předchozí stránku (herní jednotky, #150). */
  readonly previousArrow: LayoutRect;
  /** Šipka ▶ na další stránku (herní jednotky, #150). */
  readonly nextArrow: LayoutRect;
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

/** Volné místo zúžené o odstup od knihy: na šířku z obou stran, na výšku shora. */
function awayFromBook(free: FreeBox, landscape: boolean): FreeBox {
  const gap = BOOK_EXTRA_GAP_CSS;
  return landscape
    ? { left: free.left + gap, top: free.top, width: free.width - 2 * gap, height: free.height }
    : { left: free.left, top: free.top + gap, width: free.width, height: free.height - gap };
}

/** Největší šířka náhledu 4 : 3, se kterou se mřížka vejde do volného místa. */
function previewWidthFor(free: FreeBox, columns: number, rows: number, gap: number): number {
  const byWidth = (free.width - (columns - 1) * gap) / columns;
  const byHeight = ((free.height - (rows - 1) * gap) / rows) * PICTURE_ASPECT;
  return Math.min(byWidth, byHeight);
}

/** Sloupce alba podle schválených obrázků: na šířku 4 × 3, na výšku 3 × 4 nebo 2 × 6. */
const LANDSCAPE_ALBUM_COLUMNS: readonly number[] = [4];
const PORTRAIT_ALBUM_COLUMNS: readonly number[] = [3, 2];

export interface PickerLayoutOptions {
  /**
   * Kolik omalovánek výběr má (#150). Šipky má jen výběr s víc stránkami;
   * bez šipek a bez počtu je výběr na stejném místě jako před #150.
   */
  readonly pictureCount?: number;
}

/**
 * Rozložení výběru pro herní plochu `area`. Při víc stránkách (#150) jsou
 * šipky ◀ ▶ vedle mřížky (`pickerArrows`) a mřížka se v těsných oknech
 * posune. Kniha a ukazatel klíčů zůstanou vždy stejně velké a na stejném
 * místě. Náhledy jsou stejně velké jako bez šipek, jen na úzkých
 * telefonech na výšku (390 × 844, 393 × 852, 430 × 932, 360 × 780,
 * 375 × 667) se zmenší, aby se šipky vešly pod mřížku.
 */
export function layoutPicker(area: GameArea, options: PickerLayoutOptions = {}): PickerLayout {
  const landscape = area.width >= area.height;
  const free = awayFromBook(freeBoxFor(area, landscape), landscape);
  const today = gridIn(free, area, landscape);
  const book = bookButtonFor(area);
  const keyIndicator = keyIndicatorBeside(book, area, landscape);
  const placement = pickerArrows(area, today, free, keyIndicator, landscape);
  const arrows =
    options.pictureCount !== undefined && pageCountOf(options.pictureCount, PICKER_PLACES) > 1;
  const grid = arrows ? placement.grid : today;
  const radius = isPhoneMode(area.mode) ? PHONE_RADIUS_CSS : TABLET_RADIUS_CSS;
  return {
    previews: placesOf(grid, area),
    cornerRadius: radius / area.scale,
    book,
    keyIndicator,
    arrows,
    previousArrow: toUnits(placement.previous, area),
    nextArrow: toUnits(placement.next, area),
  };
}

/** Šipka výběru pod dotykem (herní jednotky, #150); `null` mimo šipky a ve výběru bez šipek. */
export function pickerArrowAt(
  layout: PickerLayout,
  x: number,
  y: number,
): 'previous' | 'next' | null {
  return arrowUnder(layout, x, y);
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

/** Mezera mezi knihou a ukazatelem klíčů v CSS px (#140). */
const KEY_INDICATOR_GAP_CSS = 8;

/** Výška ukazatele klíčů na šířku jako díl strany knihy (řada klíče s číslicí a pod ní půlka). */
const LANDSCAPE_INDICATOR_HEIGHT_SHARE = 1.6;

/** Šířka ukazatele klíčů na výšku jako díl strany knihy (klíč, číslice a půlka v řadě). */
const PORTRAIT_INDICATOR_WIDTH_SHARE = 2;

/**
 * Ukazatel klíčů vedle knihy (#140): na šířku pod knihou v jejím pruhu
 * (stejně široký jako kniha), na výšku vlevo od knihy v její řadě (stejně
 * vysoký jako kniha). Od knihy je 8 CSS px.
 */
function keyIndicatorBeside(book: LayoutRect, area: GameArea, landscape: boolean): LayoutRect {
  const gap = KEY_INDICATOR_GAP_CSS / area.scale;
  if (landscape) {
    return {
      left: book.left,
      top: book.top + book.height + gap,
      width: book.width,
      height: book.height * LANDSCAPE_INDICATOR_HEIGHT_SHARE,
    };
  }
  const width = book.width * PORTRAIT_INDICATOR_WIDTH_SHARE;
  return { left: book.left - gap - width, top: book.top, width, height: book.height };
}

/** Míst pro obrázky na stránce alba (#126, od #149 se po 12 listuje), stejně jako na výběru. */
export const ALBUM_PLACES = PICKER_PLACES;

/** Zaoblení náhledu alba nejvýš tento díl jeho výšky, aby roh malý obrázek moc neořízl. */
const ALBUM_RADIUS_SHARE = 0.16;

/** Strana šipky ◀ ▶ v CSS px (#149 AC6: aspoň 64 px). */
const ARROW_SIDE_CSS = 64;

/** Odstup šipky od náhledů, knihy a domečku v CSS px (#149 AC6). */
const ARROW_GAP_CSS = 16;

/** Nejmenší odstup šipky od okraje plochy v CSS px. */
const ARROW_EDGE_CSS = 4;

/** Mezera mezi šipkami, když jsou obě vedle sebe na jedné straně, v CSS px. */
const ARROWS_BETWEEN_CSS = 8;

export interface AlbumLayout {
  /** 12 míst obrázků stránky v herních jednotkách od nejnovějšího, po řadách zleva doprava. */
  readonly previews: readonly LayoutRect[];
  /** Zaoblení rohů náhledu v herních jednotkách. */
  readonly cornerRadius: number;
  /** Jsou šipky vidět (album má víc stránek, #149)? Bez nich je album jako před #149. */
  readonly arrows: boolean;
  /** Šipka ◀ na předchozí stránku (herní jednotky, #149). */
  readonly previousArrow: LayoutRect;
  /** Šipka ▶ na další stránku (herní jednotky, #149). */
  readonly nextArrow: LayoutRect;
}

/** Mřížka náhledů alba nebo výběru v CSS px herní plochy. */
interface PreviewGrid {
  readonly left: number;
  readonly top: number;
  readonly columns: number;
  readonly rows: number;
  /** Šířka a výška jednoho náhledu. */
  readonly width: number;
  readonly height: number;
  readonly gap: number;
}

/** Obdélník v CSS px herní plochy. */
interface CssRect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Mřížka 12 náhledů 4 : 3 uprostřed volného místa `free`, s tolika sloupci,
 * aby byly náhledy co největší: na šířku 4 × 3, na výšku 3 × 4 nebo 2 × 6.
 */
function gridIn(free: FreeBox, area: GameArea, landscape: boolean): PreviewGrid {
  const gap = isPhoneMode(area.mode) ? PHONE_GAP_CSS : TABLET_GAP_CSS;
  let columns = 0;
  let width = 0;
  for (const candidate of landscape ? LANDSCAPE_ALBUM_COLUMNS : PORTRAIT_ALBUM_COLUMNS) {
    const candidateWidth = previewWidthFor(free, candidate, PICKER_PLACES / candidate, gap);
    if (candidateWidth > width) {
      columns = candidate;
      width = candidateWidth;
    }
  }
  const rows = PICKER_PLACES / columns;
  const height = width / PICTURE_ASPECT;
  const left = free.left + (free.width - (columns * width + (columns - 1) * gap)) / 2;
  const top = free.top + (free.height - (rows * height + (rows - 1) * gap)) / 2;
  return { left, top, columns, rows, width, height, gap };
}

function gridWidthOf(grid: PreviewGrid): number {
  return grid.columns * grid.width + (grid.columns - 1) * grid.gap;
}

function gridHeightOf(grid: PreviewGrid): number {
  return grid.rows * grid.height + (grid.rows - 1) * grid.gap;
}

/** Mřížka a šipky ◀ ▶ v CSS px herní plochy. */
interface ArrowPlacement {
  readonly grid: PreviewGrid;
  readonly previous: CssRect;
  readonly next: CssRect;
}

function arrowAt(left: number, top: number): CssRect {
  return { left, top, width: ARROW_SIDE_CSS, height: ARROW_SIDE_CSS };
}

/**
 * Šipky na šířku (#149): ◀ vlevo a ▶ vpravo od mřížky ve výšce jejího
 * středu, pod domečkem a místem knihy. Kde je vedle mřížky na každé
 * straně málo místa (telefony 932 px široké), jsou obě šipky vedle sebe
 * vlevo a mřížka se posune doprava. Náhledy zůstanou stejně velké.
 */
function landscapeArrows(area: GameArea, grid: PreviewGrid): ArrowPlacement {
  const width = area.width * area.scale;
  const home = homeButtonInFreeArea(area);
  const homeCenter = (home.left + home.size / 2) * area.scale;
  const gridWidth = gridWidthOf(grid);
  const top = grid.top + gridHeightOf(grid) / 2 - ARROW_SIDE_CSS / 2;
  const leftMost = grid.left - ARROW_GAP_CSS - ARROW_SIDE_CSS;
  const rightLeast = grid.left + gridWidth + ARROW_GAP_CSS;
  if (leftMost >= ARROW_EDGE_CSS && rightLeast + ARROW_SIDE_CSS <= width - ARROW_EDGE_CSS) {
    // Šipka co nejblíž pod středem domečku (vpravo zrcadlově), ale 16 px od mřížky.
    const aligned = homeCenter - ARROW_SIDE_CSS / 2;
    const previousLeft = Math.min(Math.max(aligned, ARROW_EDGE_CSS), leftMost);
    const nextLeft = Math.max(width - aligned - ARROW_SIDE_CSS, rightLeast);
    return {
      grid,
      previous: arrowAt(previousLeft, top),
      next: arrowAt(Math.min(nextLeft, width - ARROW_EDGE_CSS - ARROW_SIDE_CSS), top),
    };
  }
  const previous = arrowAt(ARROW_EDGE_CSS, top);
  const next = arrowAt(previous.left + ARROW_SIDE_CSS + ARROWS_BETWEEN_CSS, top);
  const shifted = { ...grid, left: next.left + ARROW_SIDE_CSS + ARROW_GAP_CSS };
  return { grid: shifted, previous, next };
}

/** Vejdou se šipky pod mřížku `grid`, když se mřížka posune nahoru nejvýš k `highestGridTop`? */
function fitsBelow(area: GameArea, grid: PreviewGrid, highestGridTop: number): boolean {
  return Math.min(grid.top, lowestGridTopFor(area, grid)) >= highestGridTop;
}

/** Nejníž položená mřížka, pod kterou se ještě vejdou šipky (CSS px). */
function lowestGridTopFor(area: GameArea, grid: PreviewGrid): number {
  const height = area.height * area.scale;
  return height - ARROW_EDGE_CSS - ARROW_SIDE_CSS - ARROW_GAP_CSS - gridHeightOf(grid);
}

/** Šipky pod mřížkou, ◀ vlevo a ▶ vpravo; mřížka se posune nahoru, kolik je třeba. */
function arrowsBelow(area: GameArea, grid: PreviewGrid): ArrowPlacement {
  const placed = { ...grid, top: Math.min(grid.top, lowestGridTopFor(area, grid)) };
  const top = placed.top + gridHeightOf(grid) + ARROW_GAP_CSS;
  return {
    grid: placed,
    previous: arrowAt(grid.left, top),
    next: arrowAt(grid.left + gridWidthOf(grid) - ARROW_SIDE_CSS, top),
  };
}

/**
 * Šipky nahoře v řadě domečku: ◀ 16 px vpravo od domečku, ▶ 16 px vlevo
 * od `rightLimit` (CSS px); mřížka se posune pod ně.
 */
function arrowsInHomeRow(area: GameArea, grid: PreviewGrid, rightLimit: number): ArrowPlacement {
  const height = area.height * area.scale;
  const home = homeButtonInFreeArea(area);
  const top = Math.max(
    ARROW_EDGE_CSS,
    Math.min(
      home.top * area.scale,
      height - ARROW_EDGE_CSS - gridHeightOf(grid) - ARROW_GAP_CSS - ARROW_SIDE_CSS,
    ),
  );
  return {
    grid: { ...grid, top: top + ARROW_SIDE_CSS + ARROW_GAP_CSS },
    previous: arrowAt((home.left + home.size) * area.scale + ARROW_GAP_CSS, top),
    next: arrowAt(rightLimit - ARROW_GAP_CSS - ARROW_SIDE_CSS, top),
  };
}

/**
 * Šipky na výšku (#149, upřesnění 2): pod mřížkou, ◀ vlevo a ▶ vpravo.
 * Když se pod mřížku nevejdou, mřížka se posune nahoru, a když ani tak
 * (mřížka přes celou výšku), jsou šipky nahoře v řadě domečku mezi
 * domečkem a místem knihy a mřížka se posune dolů. Náhledy zůstanou
 * stejně velké.
 */
function portraitArrows(area: GameArea, grid: PreviewGrid): ArrowPlacement {
  const home = homeButtonInFreeArea(area);
  if (fitsBelow(area, grid, (home.top + home.size) * area.scale + EDGE_CSS)) {
    return arrowsBelow(area, grid);
  }
  return arrowsInHomeRow(area, grid, bookButtonFor(area).left * area.scale);
}

/**
 * Šipky výběru (#150) jako v albu (#149), jen kniha a ukazatel klíčů
 * zůstanou na svém místě a šipky jsou od nich aspoň 16 px:
 * - na šířku vedle mřížky, v pruhu knihy pod ukazatelem klíčů (◀ ve
 *   stejné výšce),
 * - na výšku pod mřížkou (mřížka se posune nahoru), jinak v řadě domečku
 *   mezi domečkem a ukazatelem klíčů,
 * - na úzkých telefonech na výšku, kde se nevejdou ani tam, se náhledy
 *   zmenší, aby se šipky vešly pod mřížku (jinak by se šipky nevešly ani
 *   s posunutým ukazatelem klíčů).
 */
function pickerArrows(
  area: GameArea,
  grid: PreviewGrid,
  free: FreeBox,
  indicator: LayoutRect,
  landscape: boolean,
): ArrowPlacement {
  if (landscape) {
    const placed = landscapeArrows(area, grid);
    const belowIndicator = (indicator.top + indicator.height) * area.scale + ARROW_GAP_CSS;
    const lowest = area.height * area.scale - ARROW_EDGE_CSS - ARROW_SIDE_CSS;
    const top = Math.min(Math.max(placed.next.top, belowIndicator), lowest);
    return {
      grid: placed.grid,
      previous: { ...placed.previous, top },
      next: { ...placed.next, top },
    };
  }
  if (fitsBelow(area, grid, free.top)) {
    return arrowsBelow(area, grid);
  }
  const homeRow = arrowsInHomeRow(area, grid, indicator.left * area.scale);
  if (homeRow.next.left >= homeRow.previous.left + ARROW_SIDE_CSS + ARROWS_BETWEEN_CSS) {
    return homeRow;
  }
  const lowestBottom = area.height * area.scale - ARROW_EDGE_CSS - ARROW_SIDE_CSS - ARROW_GAP_CSS;
  const smaller = gridIn({ ...free, height: lowestBottom - free.top }, area, false);
  return arrowsBelow(area, smaller);
}

/** 12 míst náhledů mřížky `grid` po řadách zleva doprava (herní jednotky). */
function placesOf(grid: PreviewGrid, area: GameArea): LayoutRect[] {
  return Array.from({ length: PICKER_PLACES }, (_, place) =>
    toUnits(
      {
        left: grid.left + (place % grid.columns) * (grid.width + grid.gap),
        top: grid.top + Math.floor(place / grid.columns) * (grid.height + grid.gap),
        width: grid.width,
        height: grid.height,
      },
      area,
    ),
  );
}

function toUnits(rect: CssRect, area: GameArea): LayoutRect {
  const unitsPerCss = 1 / area.scale;
  return {
    left: rect.left * unitsPerCss,
    top: rect.top * unitsPerCss,
    width: rect.width * unitsPerCss,
    height: rect.height * unitsPerCss,
  };
}

export interface AlbumLayoutOptions {
  /**
   * Kolik obrázků album má (#149). Šipky má jen album s víc stránkami;
   * bez šipek je mřížka na stejném místě jako před #149, se šipkami se
   * v těsných oknech posune. Bez počtu se počítá se šipkami.
   */
  readonly pictureCount?: number;
}

/**
 * Rozložení alba pro herní plochu `area`: 12 náhledů 4 : 3 ve volném místě
 * jako na výběru, s tolika sloupci, aby byly náhledy co největší, a šipky
 * ◀ ▶ na listování (#149).
 */
export function layoutAlbum(area: GameArea, options: AlbumLayoutOptions = {}): AlbumLayout {
  const arrows = options.pictureCount === undefined || albumPageCount(options.pictureCount) > 1;
  const landscape = area.width >= area.height;
  const today = gridIn(freeBoxFor(area, landscape), area, landscape);
  const placement = landscape ? landscapeArrows(area, today) : portraitArrows(area, today);
  const grid = arrows ? placement.grid : today;
  const previews = placesOf(grid, area);
  const radius = Math.min(
    isPhoneMode(area.mode) ? PHONE_RADIUS_CSS : TABLET_RADIUS_CSS,
    grid.height * ALBUM_RADIUS_SHARE,
  );
  return {
    previews,
    cornerRadius: radius / area.scale,
    arrows,
    previousArrow: toUnits(placement.previous, area),
    nextArrow: toUnits(placement.next, area),
  };
}

/** Trefil dotyk `x`, `y` knihu na výběru (herní jednotky)? */
export function bookAt(layout: PickerLayout, x: number, y: number): boolean {
  return placeAt([layout.book], x, y) !== null;
}

/** Místo obrázku alba pod dotykem (herní jednotky), `null` mimo náhledy a v mezerách. */
export function albumPreviewAt(layout: AlbumLayout, x: number, y: number): number | null {
  return placeAt(layout.previews, x, y);
}

/** Šipka alba pod dotykem (herní jednotky, #149); `null` mimo šipky a v albu bez šipek. */
export function albumArrowAt(
  layout: AlbumLayout,
  x: number,
  y: number,
): 'previous' | 'next' | null {
  return arrowUnder(layout, x, y);
}

/** Šipka pod dotykem v albu nebo na výběru (herní jednotky); `null` mimo šipky a bez šipek. */
function arrowUnder(
  layout: Pick<AlbumLayout, 'arrows' | 'previousArrow' | 'nextArrow'>,
  x: number,
  y: number,
): 'previous' | 'next' | null {
  if (!layout.arrows) {
    return null;
  }
  if (placeAt([layout.previousArrow], x, y) !== null) {
    return 'previous';
  }
  return placeAt([layout.nextArrow], x, y) === null ? null : 'next';
}

// ---------------------------------------------------------------------------
// Velký obrázek a koš (#129 AC6)
// ---------------------------------------------------------------------------

/** Nejmenší mezera mezi košem a velkým obrázkem v CSS px (#129 AC6). */
const TRASH_GAP_CSS = 16;

/** Mezera mezi tlačítkem malovat dál a košem v CSS px (schválené obrázky #131). */
const CONTINUE_GAP_CSS = 16;

export interface BigPictureLayout {
  /** Velký obrázek 4 : 3 v herních jednotkách, stejně velký jako obrázek v malování. */
  readonly picture: LayoutRect;
  /** Koš na místě fotoaparátu z malování (herní jednotky). */
  readonly trash: LayoutRect;
  /** Tlačítko malovat dál, stejně velké jako koš (#131 AC7, herní jednotky). */
  readonly continueButton: LayoutRect;
}

/**
 * Tlačítko malovat dál vedle koše (#131): na šířku nad košem, na výšku
 * vlevo od koše, vždy 16 CSS px od něj.
 */
function continueButtonBeside(trash: LayoutRect, area: GameArea, landscape: boolean): LayoutRect {
  const gap = CONTINUE_GAP_CSS / area.scale;
  return landscape
    ? { ...trash, top: trash.top - gap - trash.height }
    : { ...trash, left: trash.left - gap - trash.width };
}

/**
 * Rozložení velkého obrázku pro herní plochu `area` podle schválených
 * obrázků: koš je tam, kde je v malování fotoaparát (na šířku vlevo dole,
 * na výšku vpravo nahoře), obrázek je stejně velký jako v malování. Na
 * šířku se obrázek posune doprava jen tolik, aby byl od koše 16 CSS px
 * (na iPadu 1180 × 820 o 8 px), na výšku zůstane na stejném místě.
 */
export function layoutBigPicture(area: GameArea): BigPictureLayout {
  const painting = layoutColoring(area);
  const trash = painting.cameraButton;
  // Velký obrázek koště nemá, posouvá se jen kvůli koši (#142).
  const picture = pictureWithoutBroom(area);
  const landscape = area.width >= area.height;
  const continueButton = continueButtonBeside(trash, area, landscape);
  if (!landscape) {
    return { picture, trash, continueButton };
  }
  const gapCss = (picture.left - (trash.left + trash.width)) * area.scale;
  const shift = Math.max(0, TRASH_GAP_CSS - gapCss) / area.scale;
  return { picture: { ...picture, left: picture.left + shift }, trash, continueButton };
}

/** Trefil dotyk `x`, `y` tlačítko malovat dál na velkém obrázku (herní jednotky, #131)? */
export function bigPictureContinueAt(layout: BigPictureLayout, x: number, y: number): boolean {
  return placeAt([layout.continueButton], x, y) !== null;
}

/** Trefil dotyk `x`, `y` koš na velkém obrázku (herní jednotky)? */
export function bigPictureTrashAt(layout: BigPictureLayout, x: number, y: number): boolean {
  return placeAt([layout.trash], x, y) !== null;
}

/** Kroužek podržení vně koše (#129, schválený prototyp): odstup od okraje koše a čáry v CSS px. */
const TRASH_RING_OFFSET_CSS = 8;
const TRASH_RING_WIDTH_CSS = 6;
const TRASH_RING_OUTLINE_CSS = 1;

/** Kroužek podržení kolem koše v herních jednotkách: střed, poloměr středu čáry a tloušťky. */
export interface TrashHoldRing {
  readonly centerX: number;
  readonly centerY: number;
  /** Poloměr středové čáry kroužku. */
  readonly radius: number;
  /** Tloušťka kroužku (šedá stopa i bílý postup). */
  readonly lineWidth: number;
  /** Tloušťka jemného tmavého okraje kolem bílého postupu. */
  readonly outlineWidth: number;
  /** Poloměr vnějšího okraje kroužku i s tmavým okrajem. */
  readonly outerRadius: number;
}

/**
 * Kroužek podržení vně koše na pozadí stránky: kruh se středem ve středu
 * koše a poloměrem o 8 CSS px větším než polovina strany koše. Kde je koš
 * blíž okraji plochy (nejmenší telefony), je kroužek těsnější, aby se vešel
 * celý; vždy ale zůstane vně stran koše.
 */
export function trashHoldRingFor(layout: BigPictureLayout, area: GameArea): TrashHoldRing {
  return holdRingAround(layout.trash, area);
}

/**
 * Stejný bílý kroužek podržení kolem tlačítka `trash` (herní jednotky):
 * kolem koše na velkém obrázku (#129) i kolem koštěte v malování (#142).
 */
export function holdRingAround(trash: LayoutRect, area: GameArea): TrashHoldRing {
  const unitsPerCss = 1 / area.scale;
  const side = Math.min(trash.width, trash.height);
  const lineWidth = TRASH_RING_WIDTH_CSS * unitsPerCss;
  const outlineWidth = TRASH_RING_OUTLINE_CSS * unitsPerCss;
  const roomToEdge = Math.min(
    trash.left,
    trash.top,
    area.width - (trash.left + trash.width),
    area.height - (trash.top + trash.height),
  );
  const offset = Math.max(
    lineWidth / 2 + outlineWidth,
    Math.min(TRASH_RING_OFFSET_CSS * unitsPerCss, roomToEdge - lineWidth / 2 - outlineWidth),
  );
  const radius = side / 2 + offset;
  return {
    centerX: trash.left + trash.width / 2,
    centerY: trash.top + trash.height / 2,
    radius,
    lineWidth,
    outlineWidth,
    outerRadius: radius + lineWidth / 2 + outlineWidth,
  };
}
