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
 * nereaguje. Čistý TypeScript bez Phaseru.
 */

import { homeButtonInFreeArea } from '../../../shared/logic/homeButton';
import { isPhoneMode } from '../../../shared/logic/viewportLayout';
import type { GameArea } from '../../../shared/logic/viewportLayout';
import { PICTURE_ASPECT, layoutColoring, pictureWithoutBroom } from './coloringLayout';
import type { LayoutRect } from './coloringLayout';

/**
 * Míst pro náhledy: 12 v mřížce na šířku 4 × 3, na výšku 3 × 4 nebo 2 × 6 (#132),
 * sada má 11 omalovánek a 12. místo zůstane prázdné. Posouvání je mimo rozsah.
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

/** Rozložení výběru pro herní plochu `area`. */
export function layoutPicker(area: GameArea): PickerLayout {
  const phone = isPhoneMode(area.mode);
  const landscape = area.width >= area.height;
  const gap = phone ? PHONE_GAP_CSS : TABLET_GAP_CSS;
  const free = awayFromBook(freeBoxFor(area, landscape), landscape);
  // Stejně jako album: na výšku 3 × 4, nebo 2 × 6, podle toho, co dá větší náhled.
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
  const book = bookButtonFor(area);
  return {
    previews,
    cornerRadius: radius * unitsPerCss,
    book,
    keyIndicator: keyIndicatorBeside(book, area, landscape),
  };
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

/** Míst pro obrázky v albu (#126, posouvání alba je mimo rozsah). */
export const ALBUM_PLACES = 12;

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
