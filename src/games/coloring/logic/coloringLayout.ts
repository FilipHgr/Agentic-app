/**
 * Rozložení obrazovky Omalovánek v herních jednotkách (#88, #96): obrázek
 * přes celou obrazovku (plocha `fullWindow`) a vedle něj jen úzký pruh
 * ovládání: domeček, úchyt panelu, Zpět a od #148 místo 2 nedávných barev
 * tlačítko kreslicího nástroje a guma (rychlé přepínání nástrojů).
 *
 * - Na šířku (L-A) je pruh vlevo: v jednom sloupci, když se do výšky vejde,
 *   jinak ve dvou (úchyt a Zpět vedle sebe, kreslicí nástroj a guma dole). Panel
 *   vyjíždí zleva hned vedle pruhu.
 * - Na výšku (P-A) je pruh dole: kreslicí nástroj a guma vlevo, úchyt uprostřed
 *   a Zpět vpravo, domeček zůstává vlevo nahoře. Panel vyjíždí zdola hned
 *   nad pruhem.
 *
 * Panel je od #105 ve dvou krocích se stejným rozměrem: hlavička
 * (v kroku nástrojů tlačítka tloušťky od #112, od #118 čtyři, v kroku barev vybraný
 * nástroj na místě prvního z nich), čára a tělo (10 nástrojů, nebo 12 barev na stejných
 * místech). Na iPadu a na výšku je hlavička řada nahoře, na telefonu na
 * šířku sloupec vlevo (schválené obrázky k #105). Jedno rozložení platí
 * pro zavřený panel i oba kroky, obrázek se tedy nikdy neposune. Kam
 * patří dotyk, rozhoduje `touchTargetAt` podle kroku panelu.
 *
 * Fotoaparát (#126) je na šířku v pruhu pod gumou (#148), na výšku
 * vpravo nahoře zrcadlově k domečku. Obrázek má stejnou velikost jako
 * před #126, jen se může posunout.
 *
 * Koště (#142) je stejně velké jako fotoaparát a 16 px od něj: na šířku
 * v jednom sloupci pod ním, jen když se tam vejde, jinak vpravo od něj
 * (pruh má pak dva sloupce), na výšku vlevo od něj. Místo obrázku se
 * počítá bez koštěte (obrázek zůstane stejný), jen když by byl ke koštěti
 * blíž než 8 px, posune se doprava. Panel vyjíždí vpravo od koštěte.
 *
 * Od #111 sahá obrázek na šířku k hornímu a dolnímu okraji, na výšku leží
 * rovně (#127, neotáčí se žádná omalovánka) přes šířku okna bez bočních
 * okrajů 8 px. Dotyk na omalovánku převádí
 * `pictureLayerPoint`, obráceně `pictureScreenPoint`.
 * Čistý TypeScript bez Phaseru.
 */

import { homeButtonInFreeArea } from '../../../shared/logic/homeButton';
import type { GameArea, GameAreaFit } from '../../../shared/logic/viewportLayout';
import { COLOR_BUTTON_STYLE, HANDLE_COLOR_DOT_STYLE } from './theme';
import { COLOR_STEP_SIZE } from './toolColorSets';
import { LINE_SIZES } from './toolPanel';
import type { LineSize, PanelView } from './toolPanel';

/** Omalovánky chtějí herní plochu přes celou volnou plochu okna i na iPadu (#96). */
export const COLORING_GAME_AREA_FIT: GameAreaFit = 'fullWindow';

/** Obdélník v herních jednotkách. */
export interface LayoutRect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export interface ColoringLayout {
  /** Plocha, kterou omalovánka zabírá na obrazovce (vždy 4 : 3, nikdy otočená, #127). */
  readonly picture: LayoutRect;
  /** Úchyt panelu nástrojů (#96 AC2). */
  readonly handle: LayoutRect;
  /** Tlačítko Zpět (#89) v pruhu u úchytu. */
  readonly undoButton: LayoutRect;
  /** První tlačítko rychlého přepínání: kreslicí nástroj (#148, #163), na místě 1. nedávné barvy. */
  readonly quickDrawingToolButton: LayoutRect;
  /** Druhé tlačítko rychlého přepínání: guma (#148), na místě 2. nedávné barvy. */
  readonly quickEraserButton: LayoutRect;
  /** Fotoaparát, uloží hotový obrázek do alba (#126). */
  readonly cameraButton: LayoutRect;
  /** Koště, podržením vrátí stránku na začátek (#142). */
  readonly broomButton: LayoutRect;
  /** Pozadí otevřeného panelu. */
  readonly panel: LayoutRect;
  /** 12 míst pro barvy v těle kroku barev, barvy `PALETTE` na prvních místech. */
  readonly paletteColors: readonly LayoutRect[];
  /** 10 míst pro nástroje v těle kroku nástrojů, štětec na prvním. */
  readonly toolSlots: readonly LayoutRect[];
  /**
   * Čtyři tlačítka tloušťky čáry (#112, #118) v hlavičce kroku nástrojů
   * v pořadí `LINE_SIZES` (od nejtenčí), na všech místech hlavičky.
   */
  readonly sizeButtons: readonly LayoutRect[];
  /** Vybraný nástroj v hlavičce kroku barev (#105), stejné místo jako `sizeButtons[0]`. */
  readonly colorStepTool: LayoutRect;
  /** Tenká čára mezi hlavičkou a tělem panelu (#105). */
  readonly panelDivider: LayoutRect;
  /** Odkud panel vyjíždí: zleva (na šířku), nebo zdola (na výšku). */
  readonly panelSlidesFrom: 'left' | 'bottom';
}

/** Kruh v herních jednotkách (kolečko barvy, #106). */
export interface LayoutCircle {
  readonly centerX: number;
  readonly centerY: number;
  readonly diameter: number;
}

/** Kam patří dotyk (#96 AC4). Malovat se smí jen u `picture`. */
export type TouchTarget =
  | { readonly kind: 'picture' }
  | { readonly kind: 'handle' }
  | { readonly kind: 'undo' }
  | { readonly kind: 'camera' }
  | { readonly kind: 'broom' }
  /** První tlačítko v pruhu: kreslicí nástroj (#148, #163). */
  | { readonly kind: 'quickDrawingTool' }
  /** Druhé tlačítko v pruhu: guma (#148). */
  | { readonly kind: 'quickEraser' }
  | { readonly kind: 'color'; readonly index: number }
  | { readonly kind: 'tool'; readonly index: number }
  /** Tlačítko tloušťky v kroku nástrojů (#112). */
  | { readonly kind: 'lineSize'; readonly size: LineSize }
  /** Vybraný nástroj v kroku barev: návrat ke kroku nástrojů (#105 AC4). */
  | { readonly kind: 'backToTools' }
  /** Pozadí panelu nebo prázdné místo v něm: nic se nestane, nemaluje se. */
  | { readonly kind: 'panel' }
  | { readonly kind: 'none' };

/** Poměr stran obrázku a vrstvy barev (1024 × 768). */
export const PICTURE_ASPECT = 4 / 3;

/** Obsah panelu (#96 AC3): barvy v kroku barev, nástroje v kroku nástrojů (#105). */
export const PANEL_COLOR_PLACES = 12;
export const PANEL_TOOL_PLACES = 10;
/** Tlačítka rychlého přepínání v pruhu: kreslicí nástroj a guma (#148). */
const QUICK_TOOL_PLACES = 2;

/** Plochy pruhu na šířku: domeček, úchyt, Zpět, kreslicí nástroj, guma a fotoaparát (#126). */
const LANDSCAPE_STRIP_CONTROLS = 4 + QUICK_TOOL_PLACES;

/** Mezera mezi plochami a mezi pruhem a obrázkem v CSS px. */
const GAP_CSS = 8;

/** Odstup koštěte od fotoaparátu v CSS px (#142 AC6). */
const BROOM_GAP_CSS = 16;

/**
 * Odstup obrázku od bočního okraje volné plochy v CSS px. Nahoře a dole
 * na šířku obrázek sahá až k okraji (#111 AC4).
 */
const PICTURE_EDGE_CSS = 8;

/** Nejmenší odstup prvku od okraje volné plochy v CSS px. */
const MIN_EDGE_CSS = 4;

/** Okraj uvnitř panelu kolem tlačítek v CSS px (na nízkém telefonu méně). */
const PANEL_PADDING_CSS = 12;

/**
 * Mezera mezi hlavičkou a tělem panelu v CSS px, v ní je čára. Od #112 je
 * čára 8 px pod hlavičkou (tlačítka tloušťky od ní mají aspoň 8 px)
 * a rozměr panelu ani tělo se nemění.
 */
const SECTION_GAP_CSS = 16;

/** Tloušťka čáry mezi hlavičkou a tělem v CSS px. */
const DIVIDER_CSS = 2;

/** Míst v těle kroku: tolik, kolik má větší z kroků (barvy). */
const BODY_PLACES = Math.max(PANEL_COLOR_PLACES, PANEL_TOOL_PLACES);

/**
 * Sloupce těla panelu (#105, #118 AC4): na iPadu na šířku i na výšku 4,
 * aby se nad tělo vešla řada 4 tlačítek tloušťky; na telefonu na šířku 3
 * (4 řady stejně vysoké jako sloupec 4 tlačítek tloušťky vlevo).
 */
const LANDSCAPE_BODY_COLUMNS = 4;
const PORTRAIT_BODY_COLUMNS = 4;
const PHONE_LANDSCAPE_BODY_COLUMNS = 3;

/** Ve výpočtu se pracuje v CSS px od levého horního rohu herní plochy. */
interface Box {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

function rect(left: number, top: number, width: number, height: number): LayoutRect {
  return { left, top, width, height };
}

function square(left: number, top: number, side: number): LayoutRect {
  return rect(left, top, side, side);
}

function rightOf(place: LayoutRect): number {
  return place.left + place.width;
}

function bottomOf(place: LayoutRect): number {
  return place.top + place.height;
}

/**
 * Největší obdélník 4 : 3 na středu `box` (L-A, na výšku viz
 * `portraitPicture`). Na šířku je tak i na nejnižším telefonu
 * vedle otevřeného panelu kus obrázku vidět.
 */
function fitPicture(box: Box): LayoutRect {
  const freeWidth = Math.max(0, box.right - box.left);
  const freeHeight = Math.max(0, box.bottom - box.top);
  // Strana, která obrázek omezuje, se převezme přesně (bez zaokrouhlovací chyby).
  const heightLimited = freeHeight * PICTURE_ASPECT <= freeWidth;
  const width = heightLimited ? freeHeight * PICTURE_ASPECT : freeWidth;
  const height = heightLimited ? freeHeight : freeWidth / PICTURE_ASPECT;
  const spareWidth = freeWidth - width;
  const spareHeight = freeHeight - height;
  return rect(box.left + spareWidth / 2, box.top + spareHeight / 2, width, height);
}

/** Délka řady `count` ploch strany `side` s mezerami. */
function lineLength(count: number, side: number): number {
  return count * side + (count - 1) * GAP_CSS;
}

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

/** `count` míst po řádcích v `columns` sloupcích od levého horního rohu `left`, `top`. */
function gridSlots(
  left: number,
  top: number,
  count: number,
  columns: number,
  side: number,
): LayoutRect[] {
  return Array.from({ length: count }, (_, index) =>
    square(
      left + (index % columns) * (side + GAP_CSS),
      top + Math.floor(index / columns) * (side + GAP_CSS),
      side,
    ),
  );
}

/** Hlavička je řada nad tělem (iPad, na výšku), nebo sloupec vlevo od těla (telefon na šířku). */
type HeaderPlacement = 'row' | 'column';

interface PanelGrid {
  readonly columns: number;
  readonly header: HeaderPlacement;
  readonly side: number;
}

/** Velikost těla: `BODY_PLACES` míst v `columns` sloupcích. */
function bodySizeOf(grid: PanelGrid): { width: number; height: number } {
  const rows = Math.ceil(BODY_PLACES / grid.columns);
  return { width: lineLength(grid.columns, grid.side), height: lineLength(rows, grid.side) };
}

/** Velikost hlavičky, čáry a těla dohromady, bez okraje panelu. */
function gridSizeOf(grid: PanelGrid): { width: number; height: number } {
  const body = bodySizeOf(grid);
  const headerDepth = grid.side + SECTION_GAP_CSS;
  return grid.header === 'row'
    ? { width: body.width, height: headerDepth + body.height }
    : { width: headerDepth + body.width, height: body.height };
}

interface PanelPlaces {
  readonly panel: LayoutRect;
  readonly paletteColors: LayoutRect[];
  readonly toolSlots: LayoutRect[];
  readonly sizeButtons: LayoutRect[];
  readonly colorStepTool: LayoutRect;
  readonly panelDivider: LayoutRect;
}

/** Tlačítek tloušťky v hlavičce (#112, #118): nejtenčí, malá, střední, velká. */
const LINE_SIZE_BUTTONS = LINE_SIZES.length;

/**
 * Panel s mřížkou `grid` a okrajem `padding`, levý horní roh `left`, `top`.
 * Hlavička je v levém horním rohu, tělo pod ní (řada), nebo vedle ní
 * (sloupec), čára uprostřed mezery mezi nimi.
 */
function panelAt(left: number, top: number, grid: PanelGrid, padding: number): PanelPlaces {
  const { columns, side } = grid;
  const size = gridSizeOf(grid);
  const body = bodySizeOf(grid);
  const innerLeft = left + padding;
  const innerTop = top + padding;
  const headerRow = grid.header === 'row';
  const bodyLeft = headerRow ? innerLeft : innerLeft + side + SECTION_GAP_CSS;
  const bodyTop = headerRow ? innerTop + side + SECTION_GAP_CSS : innerTop;
  const dividerOffset = side + GAP_CSS;
  const panelDivider = headerRow
    ? rect(innerLeft, innerTop + dividerOffset, body.width, DIVIDER_CSS)
    : rect(innerLeft + dividerOffset, innerTop, DIVIDER_CSS, body.height);
  // Tlačítka tloušťky na prvních místech hlavičky: v řadě nad sloupci
  // těla, ve sloupci vedle jeho řádků (#112 AC1).
  const sizeButtons = Array.from({ length: LINE_SIZE_BUTTONS }, (_, index) => {
    const offset = index * (side + GAP_CSS);
    return headerRow
      ? square(innerLeft + offset, innerTop, side)
      : square(innerLeft, innerTop + offset, side);
  });
  const header = sizeButtons[0] ?? square(innerLeft, innerTop, side);
  return {
    panel: rect(left, top, size.width + 2 * padding, size.height + 2 * padding),
    paletteColors: gridSlots(bodyLeft, bodyTop, PANEL_COLOR_PLACES, columns, side),
    toolSlots: gridSlots(bodyLeft, bodyTop, PANEL_TOOL_PLACES, columns, side),
    sizeButtons,
    colorStepTool: header,
    panelDivider,
  };
}

/** Okraj panelu: běžný, a když by se panel nevešel do `space`, menší (nejvýš na 0). */
function paddingFor(space: number, gridLength: number): number {
  return Math.max(0, Math.min(PANEL_PADDING_CSS, (space - gridLength) / 2));
}

// ---------------------------------------------------------------------------
// Na šířku (L-A)
// ---------------------------------------------------------------------------

interface Strip {
  readonly handle: LayoutRect;
  readonly undoButton: LayoutRect;
  readonly quickDrawingToolButton: LayoutRect;
  readonly quickEraserButton: LayoutRect;
  readonly cameraButton: LayoutRect;
}

interface StripWithBroom extends Strip {
  readonly broomButton: LayoutRect;
}

/** Vejde se do výšky jeden sloupec domečku, ovládání a navíc `extra` CSS px dole? */
function oneColumnFits(home: LayoutRect, height: number, extra: number): boolean {
  return (
    home.top + lineLength(LANDSCAPE_STRIP_CONTROLS, home.width) + extra <= height - MIN_EDGE_CSS
  );
}

/** Pruh v jednom sloupci pod domečkem. */
function oneColumnStrip(home: LayoutRect): Strip {
  const side = home.width;
  const below = bottomOf(home) + GAP_CSS;
  const step = side + GAP_CSS;
  return {
    handle: square(home.left, below, side),
    undoButton: square(home.left, below + step, side),
    quickDrawingToolButton: square(home.left, below + 2 * step, side),
    quickEraserButton: square(home.left, below + 3 * step, side),
    cameraButton: square(home.left, below + 4 * step, side),
  };
}

/**
 * Pruh ve dvou sloupcích (L-A na telefonu): úchyt a Zpět vedle sebe, pod
 * nimi kreslicí nástroj a guma (#148) a úplně dole fotoaparát (#126).
 */
function twoColumnStrip(home: LayoutRect, height: number): Strip {
  const side = home.width;
  const below = bottomOf(home) + GAP_CSS;
  const secondColumn = home.left + side + GAP_CSS;
  const cameraTop = Math.max(below + 2 * (side + GAP_CSS), height - home.top - side);
  const quickTop = cameraTop - side - GAP_CSS;
  return {
    handle: square(home.left, below, side),
    undoButton: square(secondColumn, below, side),
    quickDrawingToolButton: square(home.left, quickTop, side),
    quickEraserButton: square(secondColumn, quickTop, side),
    cameraButton: square(home.left, cameraTop, side),
  };
}

/** Pruh vlevo pod domečkem jako před #142: jeden sloupec, když se vejde, jinak dva. */
function stripWithoutBroom(home: LayoutRect, height: number): Strip {
  return oneColumnFits(home, height, 0) ? oneColumnStrip(home) : twoColumnStrip(home, height);
}

/**
 * Pruh vlevo pod domečkem s koštětem (#142 AC6): koště 16 px pod
 * fotoaparátem, jen když se tam do výšky vejde, jinak ve druhém sloupci
 * 16 px vpravo od fotoaparátu ve stejné výšce. Ostatní plochy pruhu
 * zůstanou na místě jako před #142.
 */
function landscapeStrip(home: LayoutRect, height: number): StripWithBroom {
  const side = home.width;
  const strip = stripWithoutBroom(home, height);
  const camera = strip.cameraButton;
  const broomButton = oneColumnFits(home, height, BROOM_GAP_CSS + side)
    ? square(camera.left, bottomOf(camera) + BROOM_GAP_CSS, side)
    : square(rightOf(camera) + BROOM_GAP_CSS, camera.top, side);
  return { ...strip, broomButton };
}

function stripRightOf(strip: Strip): number {
  return rightEdgeOf([
    strip.handle,
    strip.undoButton,
    strip.quickDrawingToolButton,
    strip.quickEraserButton,
    strip.cameraButton,
  ]);
}

function rightEdgeOf(places: readonly LayoutRect[]): number {
  return Math.max(...places.map(rightOf));
}

/**
 * Obrázek posunutý doprava, aby byl od pravého okraje pruhu `stripRight`
 * aspoň 8 px (#142 AC6), ale ne přes okraj `right`.
 */
function pictureBeside(picture: LayoutRect, stripRight: number, right: number): LayoutRect {
  const wanted = stripRight + GAP_CSS - picture.left;
  const room = right - rightOf(picture);
  const shift = Math.max(0, Math.min(wanted, room));
  return rect(picture.left + shift, picture.top, picture.width, picture.height);
}

/**
 * Panel vedle pruhu na středu výšky: na telefonu na šířku hlavička vlevo
 * a tělo 3 × 4, jinde hlavička nahoře a tělo 4 × 3 (#118 AC4).
 */
function landscapePanel(left: number, height: number, side: number, phone: boolean): PanelPlaces {
  const space = height - 2 * MIN_EDGE_CSS;
  const grid: PanelGrid = phone
    ? { columns: PHONE_LANDSCAPE_BODY_COLUMNS, header: 'column', side }
    : { columns: LANDSCAPE_BODY_COLUMNS, header: 'row', side };
  const gridHeight = gridSizeOf(grid).height;
  const padding = paddingFor(space, gridHeight);
  const panelHeight = gridHeight + 2 * padding;
  return panelAt(left, (height - panelHeight) / 2, grid, padding);
}

/**
 * Obrázek na šířku tak, jak by byl bez koštěte (před #142): na středu
 * vedle pruhu, přes celou výšku, nebo co nejširší.
 */
function landscapePictureWithoutBroom(width: number, height: number, home: LayoutRect): LayoutRect {
  return fitPicture({
    left: stripRightOf(stripWithoutBroom(home, height)) + GAP_CSS,
    right: width - PICTURE_EDGE_CSS,
    top: 0,
    bottom: height,
  });
}

function landscapeLayout(
  width: number,
  height: number,
  home: LayoutRect,
  phone: boolean,
): CssLayout {
  const strip = landscapeStrip(home, height);
  const stripRight = Math.max(stripRightOf(strip), rightOf(strip.broomButton));
  const picture = pictureBeside(
    landscapePictureWithoutBroom(width, height, home),
    stripRight,
    width - PICTURE_EDGE_CSS,
  );
  return {
    picture,
    ...strip,
    ...landscapePanel(stripRight + GAP_CSS, height, home.width, phone),
    panelSlidesFrom: 'left',
  };
}

// ---------------------------------------------------------------------------
// Na výšku (P-A)
// ---------------------------------------------------------------------------

/**
 * Pruh dole: kreslicí nástroj a guma vlevo (#148), úchyt uprostřed, Zpět vpravo u palce.
 * Fotoaparát je vpravo nahoře zrcadlově k domečku (#126), koště 16 px
 * vlevo od něj (#142).
 */
function portraitStrip(width: number, height: number, home: LayoutRect): StripWithBroom {
  const side = home.width;
  const top = height - home.top - side;
  const handleLeft = (width - side) / 2;
  // Kreslicí nástroj a guma od levého okraje jako domeček, v úzkém okně blíž k okraji.
  const quickLeft = Math.max(
    MIN_EDGE_CSS,
    Math.min(home.left, handleLeft - GAP_CSS - lineLength(QUICK_TOOL_PLACES, side)),
  );
  return {
    handle: square(handleLeft, top, side),
    undoButton: square(width - home.left - side, top, side),
    quickDrawingToolButton: square(quickLeft, top, side),
    quickEraserButton: square(quickLeft + side + GAP_CSS, top, side),
    cameraButton: square(width - home.left - side, home.top, side),
    broomButton: square(width - home.left - 2 * side - BROOM_GAP_CSS, home.top, side),
  };
}

/** Panel nad pruhem, na středu šířky, pod domečkem a 8 px kolem něj; hlavička nahoře. */
function portraitPanel(width: number, bottom: number, home: LayoutRect): PanelPlaces {
  const grid: PanelGrid = {
    columns: PORTRAIT_BODY_COLUMNS,
    header: 'row',
    side: home.width,
  };
  const size = gridSizeOf(grid);
  const belowHome = bottomOf(home) + GAP_CSS;
  const padding = Math.min(
    paddingFor(bottom - belowHome, size.height),
    paddingFor(width, size.width),
  );
  const panelWidth = size.width + 2 * padding;
  const panelHeight = size.height + 2 * padding;
  return panelAt((width - panelWidth) / 2, bottom - panelHeight, grid, padding);
}

/**
 * Obrázek na výšku (#127 AC1, rovně, bez otočení): přes šířku okna bez
 * bočních okrajů, výška 3/4 šířky, svisle na středu mezi spodkem domečku
 * a vrškem lišty.
 * Když se tak nevejde s odstupem 8 px od domečku i lišty (nízké okno),
 * zmenší se na volnou výšku a leží vodorovně na středu.
 */
function portraitPicture(width: number, homeBottom: number, stripTop: number): LayoutRect {
  const fullWidth = width - 2 * PICTURE_EDGE_CSS;
  const freeHeight = Math.max(0, stripTop - homeBottom - 2 * GAP_CSS);
  const fitsFullWidth = fullWidth / PICTURE_ASPECT <= freeHeight;
  const pictureHeight = fitsFullWidth ? fullWidth / PICTURE_ASPECT : freeHeight;
  const pictureWidth = fitsFullWidth ? fullWidth : freeHeight * PICTURE_ASPECT;
  const middle = (homeBottom + stripTop) / 2;
  return rect((width - pictureWidth) / 2, middle - pictureHeight / 2, pictureWidth, pictureHeight);
}

function portraitLayout(width: number, height: number, home: LayoutRect): CssLayout {
  const strip = portraitStrip(width, height, home);
  const aboveStrip = strip.handle.top - GAP_CSS;
  return {
    picture: portraitPicture(width, bottomOf(home), strip.handle.top),
    ...strip,
    ...portraitPanel(width, aboveStrip, home),
    panelSlidesFrom: 'bottom',
  };
}

// ---------------------------------------------------------------------------
// Celé rozložení
// ---------------------------------------------------------------------------

/** Rozložení v CSS px od levého horního rohu herní plochy. */
type CssLayout = ColoringLayout;

function toUnits(place: LayoutRect, unitsPerCss: number): LayoutRect {
  return rect(
    place.left * unitsPerCss,
    place.top * unitsPerCss,
    place.width * unitsPerCss,
    place.height * unitsPerCss,
  );
}

function layoutInUnits(css: CssLayout, unitsPerCss: number): ColoringLayout {
  const units = (place: LayoutRect): LayoutRect => toUnits(place, unitsPerCss);
  return {
    picture: units(css.picture),
    handle: units(css.handle),
    undoButton: units(css.undoButton),
    quickDrawingToolButton: units(css.quickDrawingToolButton),
    quickEraserButton: units(css.quickEraserButton),
    cameraButton: units(css.cameraButton),
    broomButton: units(css.broomButton),
    panel: units(css.panel),
    paletteColors: css.paletteColors.map(units),
    toolSlots: css.toolSlots.map(units),
    sizeButtons: css.sizeButtons.map(units),
    colorStepTool: units(css.colorStepTool),
    panelDivider: units(css.panelDivider),
    panelSlidesFrom: css.panelSlidesFrom,
  };
}

/** Domeček a rozměr herní plochy `area` v CSS px. */
function cssFrame(area: GameArea): { home: LayoutRect; width: number; height: number } {
  const cssPerUnit = area.scale;
  const home = homeButtonInFreeArea(area);
  return {
    home: square(home.left * cssPerUnit, home.top * cssPerUnit, home.size * cssPerUnit),
    width: area.width * cssPerUnit,
    height: area.height * cssPerUnit,
  };
}

/** Rozložení Omalovánek pro herní plochu `area` (oba stavy panelu). */
export function layoutColoring(area: GameArea): ColoringLayout {
  const { home, width, height } = cssFrame(area);
  const css =
    width >= height
      ? landscapeLayout(width, height, home, area.mode === 'phoneLandscape')
      : portraitLayout(width, height, home);
  return layoutInUnits(css, 1 / area.scale);
}

/**
 * Místo obrázku malování v herních jednotkách tak, jak by bylo bez koštěte
 * (před #142). Podle něj se staví velký obrázek z alba (#129, #131), který
 * koště nemá, a proto se kvůli němu neposouvá.
 */
export function pictureWithoutBroom(area: GameArea): LayoutRect {
  const { home, width, height } = cssFrame(area);
  if (width < height) {
    return layoutColoring(area).picture;
  }
  return toUnits(landscapePictureWithoutBroom(width, height, home), 1 / area.scale);
}

// ---------------------------------------------------------------------------
// Kam patří dotyk
// ---------------------------------------------------------------------------

/** Leží bod v obdélníku (levý a horní okraj patří dovnitř)? */
function contains(place: LayoutRect, x: number, y: number): boolean {
  return x >= place.left && x < rightOf(place) && y >= place.top && y < bottomOf(place);
}

function indexContaining(places: readonly LayoutRect[], x: number, y: number): number {
  return places.findIndex((place) => contains(place, x, y));
}

/** Dotyk v kroku nástrojů: nástroj, tlačítko tloušťky, nebo jen panel. */
function toolStepTarget(layout: ColoringLayout, x: number, y: number): TouchTarget {
  const tool = indexContaining(layout.toolSlots, x, y);
  if (tool >= 0) {
    return { kind: 'tool', index: tool };
  }
  const size = LINE_SIZES[indexContaining(layout.sizeButtons, x, y)];
  return size === undefined ? { kind: 'panel' } : { kind: 'lineSize', size };
}

/** Dotyk v kroku barev: barva, vybraný nástroj (návrat), nebo jen panel. */
function colorStepTarget(layout: ColoringLayout, x: number, y: number): TouchTarget {
  const color = indexContaining(layout.paletteColors, x, y);
  if (color >= 0) {
    return color < COLOR_STEP_SIZE ? { kind: 'color', index: color } : { kind: 'panel' };
  }
  return contains(layout.colorStepTool, x, y) ? { kind: 'backToTools' } : { kind: 'panel' };
}

/**
 * Kam patří dotyk v bodě `x`, `y` (herní jednotky): pruh ovládání,
 * otevřený panel v kroku `panel` (i v mezeře mezi tlačítky), obrázek,
 * nebo nic. Každý krok nabízí jen svoje plochy (#105).
 */
export function touchTargetAt(
  layout: ColoringLayout,
  panel: PanelView,
  x: number,
  y: number,
): TouchTarget {
  if (contains(layout.handle, x, y)) {
    return { kind: 'handle' };
  }
  if (contains(layout.undoButton, x, y)) {
    return { kind: 'undo' };
  }
  if (contains(layout.cameraButton, x, y)) {
    return { kind: 'camera' };
  }
  if (contains(layout.broomButton, x, y)) {
    return { kind: 'broom' };
  }
  if (contains(layout.quickDrawingToolButton, x, y)) {
    return { kind: 'quickDrawingTool' };
  }
  if (contains(layout.quickEraserButton, x, y)) {
    return { kind: 'quickEraser' };
  }
  if (panel !== 'closed' && contains(layout.panel, x, y)) {
    return panel === 'tools' ? toolStepTarget(layout, x, y) : colorStepTarget(layout, x, y);
  }
  return contains(layout.picture, x, y) ? { kind: 'picture' } : { kind: 'none' };
}

// ---------------------------------------------------------------------------
// Symbol úchytu (#164), kolečko barvy podle velikosti čáry (#91, #106, #164)
// a vlnka tloušťky (#112)
// ---------------------------------------------------------------------------

/**
 * Kolečko barvy podle velikosti čáry (#91, #106, od #164 na prvním tlačítku
 * rychlého přepínání): průměr barevné výplně jako díl strany tlačítka.
 * Tlačítko má aspoň 64 CSS px, malé kolečko má tak aspoň 12 CSS px, velké
 * i s bílým lemem a šedou linkou (2 + 1 CSS px na každé straně) nejvýš
 * 0,32 strany jako v maketě `sada-1.png`.
 */
const LINE_SIZE_COLOR_DOT_SHARES: Readonly<Record<LineSize, number>> = {
  // U nejtenčí stejně velké jako u malé (#118 AC3), velikosti se nemění.
  tiny: 12 / 64,
  small: 12 / 64,
  medium: 12.8 / 64,
  large: 13.6 / 64,
};

/**
 * Symbol panelu v úchytu (#164 AC1) zabere čtverec tohoto dílu strany
 * úchytu. Proti ikoně (0,48) je o kousek menší, aby se šipky nedotkl ani
 * tmavý obrys kolem palety (#164 AC5); menší být nesmí (#165 AC2).
 */
const HANDLE_SYMBOL_SHARE = 0.45;

/** Nejmenší odstup symbolu i s obrysem od okraje úchytu jako díl strany (#165 AC2). */
const HANDLE_SYMBOL_MIN_MARGIN_SHARE = 0.1;

/**
 * Neprůhledná část palety `artist-palette.svg` jako díl strany čtverce
 * symbolu (změřeno na mřížce 256 × 256). Vystředí se podle ní, ne podle
 * prázdného okraje obrázku (#165 AC1).
 */
const HANDLE_SYMBOL_SHAPE = {
  start: { x: 7 / 256, y: 16 / 256 },
  end: { x: 247 / 256, y: 240 / 256 },
} as const;

function sideOf(rect: LayoutRect): number {
  return Math.min(rect.width, rect.height);
}

/** Úsek na jedné ose (vodorovné nebo svislé). */
interface AxisSpan {
  readonly start: number;
  readonly end: number;
}

/**
 * Začátek čtverce symbolu na ose, kde je i šipka (#165 AC1): symbol
 * s obrysem a šipka dohromady uprostřed úchytu. Kde to nejde, protože by
 * symbol byl blíž k okraji než nejmenší odstup, zůstane na nejmenším odstupu.
 */
function symbolStartBesideArrow(
  handle: AxisSpan,
  arrow: AxisSpan,
  shape: AxisSpan,
  side: number,
  outline: number,
  minMargin: number,
): number {
  const arrowAfterSymbol = arrow.start + arrow.end > handle.start + handle.end;
  if (arrowAfterSymbol) {
    // Skupina od obrysu symbolu po konec šipky, odstup na začátku jako na konci.
    const groupStart = handle.start + (handle.end - arrow.end);
    const visibleStart = Math.max(groupStart, handle.start + minMargin);
    return visibleStart + outline - shape.start * side;
  }
  const groupEnd = handle.end - (arrow.start - handle.start);
  const visibleEnd = Math.min(groupEnd, handle.end - minMargin);
  return visibleEnd - outline - shape.end * side;
}

/** Začátek čtverce symbolu na ose bez šipky: neprůhledná paleta uprostřed. */
function symbolStartCentered(handle: AxisSpan, shape: AxisSpan, side: number): number {
  const handleCenter = (handle.start + handle.end) / 2;
  return handleCenter - ((shape.start + shape.end) / 2) * side;
}

/**
 * Kam úchyt kreslí svůj stálý symbol panelu (#164 AC1, #165 AC1): paleta
 * i s tmavým obrysem `outline` (herní jednotky) tvoří se šipkou skupinu
 * uprostřed úchytu. Na šířku je tedy symbol na opačné straně než šipka
 * a svisle uprostřed, na výšku nad šipkou a vodorovně uprostřed. Nezávisí
 * na nástroji, barvě ani velikosti čáry.
 */
export function handleSymbol(
  handle: LayoutRect,
  slidesFrom: ColoringLayout['panelSlidesFrom'],
  panelOpen: boolean,
  outline: number,
): LayoutRect {
  const side = sideOf(handle) * HANDLE_SYMBOL_SHARE;
  const minMargin = sideOf(handle) * HANDLE_SYMBOL_MIN_MARGIN_SHARE;
  const arrow = handleArrow(handle, slidesFrom, panelOpen);
  const across: AxisSpan = { start: handle.left, end: handle.left + handle.width };
  const down: AxisSpan = { start: handle.top, end: handle.top + handle.height };
  const shapeAcross = { start: HANDLE_SYMBOL_SHAPE.start.x, end: HANDLE_SYMBOL_SHAPE.end.x };
  const shapeDown = { start: HANDLE_SYMBOL_SHAPE.start.y, end: HANDLE_SYMBOL_SHAPE.end.y };
  if (slidesFrom === 'left') {
    const arrowAcross = { start: arrow.left, end: arrow.left + arrow.width };
    return {
      left: symbolStartBesideArrow(across, arrowAcross, shapeAcross, side, outline, minMargin),
      top: symbolStartCentered(down, shapeDown, side),
      width: side,
      height: side,
    };
  }
  const arrowDown = { start: arrow.top, end: arrow.top + arrow.height };
  return {
    left: symbolStartCentered(across, shapeAcross, side),
    top: symbolStartBesideArrow(down, arrowDown, shapeDown, side, outline, minMargin),
    width: side,
    height: side,
  };
}

/** Vlnka na tlačítku tloušťky: střední čára zleva doprava a tloušťka čáry (#112 AC3). */
export interface LineSizeWave {
  readonly points: readonly { readonly x: number; readonly y: number }[];
  /** Tloušťka čáry s kulatými konci v herních jednotkách. */
  readonly lineWidth: number;
}

/**
 * Tloušťka čáry vlnky jako díl strany tlačítka v poměru 1,5 : 3 : 5 : 10
 * (#112 AC3, nejtenčí podle schválení obrázků k #118): na tlačítku
 * 64 CSS px je to 1,5, 3, 5 a 10 CSS px.
 */
const WAVE_LINE_SHARES: Readonly<Record<LineSize, number>> = {
  tiny: 1.5 / 64,
  small: 3 / 64,
  medium: 5 / 64,
  large: 10 / 64,
};

/** Délka vlnky a výkyv nahoru i dolů od středu jako díl strany tlačítka. */
const WAVE_LENGTH_SHARE = 0.4;
const WAVE_AMPLITUDE_SHARE = 0.085;

/** Z kolika úseků se vlnka skládá (jedna celá vlna, nahoru a dolů). */
const WAVE_SEGMENTS = 24;

/**
 * Vlnka tloušťky `size` uprostřed tlačítka `button` (#112 AC1, AC3):
 * jedna celá vlna (nahoru a dolů), stejně dlouhá u všech tlouštěk, liší
 * se jen tloušťkou čáry.
 */
export function lineSizeWave(button: LayoutRect, size: LineSize): LineSizeWave {
  const side = sideOf(button);
  const length = side * WAVE_LENGTH_SHARE;
  const amplitude = side * WAVE_AMPLITUDE_SHARE;
  const left = button.left + (button.width - length) / 2;
  const middle = button.top + button.height / 2;
  const points = Array.from({ length: WAVE_SEGMENTS + 1 }, (_, index) => {
    const share = index / WAVE_SEGMENTS;
    return {
      x: left + share * length,
      y: middle - amplitude * Math.sin(share * 2 * Math.PI),
    };
  });
  return { points, lineWidth: side * WAVE_LINE_SHARES[size] };
}

// ---------------------------------------------------------------------------
// Ikony nástrojů a šipka úchytu (#106)
// ---------------------------------------------------------------------------

/** Ikona nástroje zabere tento díl strany místa v panelu. */
const TOOL_SLOT_ICON_SHARE = 0.62;

/** Šipka úchytu: délka ramene a tloušťka čáry jako díl strany úchytu. */
const HANDLE_ARROW_ARM_SHARE = 0.11;
const HANDLE_ARROW_LINE_SHARE = 0.055;

/** Vrchol šipky na šířku jako díl šířky úchytu: u otevřeného panelu vlevo, u zavřeného vpravo. */
const HANDLE_ARROW_OPEN_X_SHARE = 0.12;
const HANDLE_ARROW_CLOSED_X_SHARE = 0.88;

/** Vrchol šipky na výšku jako díl výšky úchytu (dole uprostřed). */
const HANDLE_ARROW_Y_SHARE = 0.87;

/**
 * Posun ikony z prostředku místa nahoru a doleva jako díl strany místa
 * (#114 AC4): uvolní roh pro kolečko barvy a odsune duhu od kolečka.
 * Nejvýš 3 CSS px na největším místě nástroje (iPad, 76 CSS px); kdyby
 * místo bylo větší, posun by 3 px překročil (hlídá test pravidel ikon).
 */
const TOOL_SLOT_ICON_SHIFT_SHARE = 3 / 76;

/**
 * Čtverec ikony nástroje v místě panelu i v hlavičce kroku barev (#105,
 * #106, #114): strana je díl kratší strany místa, ikona je kousek nahoru
 * a doleva od prostředku, u všech nástrojů stejně.
 */
export function toolSlotIcon(slot: LayoutRect): LayoutRect {
  const side = sideOf(slot) * TOOL_SLOT_ICON_SHARE;
  const shift = sideOf(slot) * TOOL_SLOT_ICON_SHIFT_SHARE;
  return {
    left: slot.left + slot.width / 2 - side / 2 - shift,
    top: slot.top + slot.height / 2 - side / 2 - shift,
    width: side,
    height: side,
  };
}

/**
 * Kolečko barvy nástroje v místě panelu (#110 AC2): stejně velké jako
 * střední kolečko na prvním tlačítku rychlého přepínání, ať je velikost
 * čáry jakákoli (velikost platí pro všechny nástroje a ukazují ji tlačítka tloušťky).
 */
const TOOL_SLOT_COLOR_DOT_SHARE = LINE_SIZE_COLOR_DOT_SHARES.medium;

/**
 * Kolečko barvy s výplní `share` strany vpravo dole v tlačítku `slot`.
 * Odstup středu od pravé i spodní hrany (#114 AC1): na nejmenším tlačítku
 * 64 CSS px je to silný modrý okraj vybraného nástroje (5 CSS px), bílý
 * lem a šedá linka (2 + 1 CSS px), 1 CSS px mezera a poloměr výplně. Na
 * větších tlačítkách je mezera od okraje větší.
 */
function cornerColorDot(slot: LayoutRect, share: number): LayoutCircle {
  const side = sideOf(slot);
  const insetShare =
    (COLOR_BUTTON_STYLE.selectedBorderWidthCss +
      HANDLE_COLOR_DOT_STYLE.rimCss +
      HANDLE_COLOR_DOT_STYLE.lineCss +
      1) /
      64 +
    share / 2;
  return {
    centerX: slot.left + slot.width - side * insetShare,
    centerY: slot.top + slot.height - side * insetShare,
    diameter: side * share,
  };
}

/**
 * Barevná výplň kolečka barvy nástroje vpravo dole v místě panelu (#110,
 * #114): `diameter` je průměr výplně, bílý lem a šedá linka se kreslí vně.
 * Kolečko je celé uvnitř silného okraje vybraného nástroje a u vybraného
 * i nevybraného nástroje na stejném místě.
 */
export function toolSlotColorDot(slot: LayoutRect): LayoutCircle {
  return cornerColorDot(slot, TOOL_SLOT_COLOR_DOT_SHARE);
}

/**
 * Kolečko barvy na prvním tlačítku rychlého přepínání (#164 AC4, dřív
 * v úchytu z #91 a #106): v rohu jako u nástroje v panelu, s tlustší
 * čárou větší. Celé zůstane uvnitř silného okraje vybraného tlačítka.
 */
export function quickToolColorDot(slot: LayoutRect, size: LineSize): LayoutCircle {
  return cornerColorDot(slot, LINE_SIZE_COLOR_DOT_SHARES[size]);
}

/** Šipka úchytu: vrchol, délka ramene a tloušťka čáry v herních jednotkách. */
export interface HandleArrowShape {
  readonly tipX: number;
  readonly tipY: number;
  /** Kam míří vrchol: doprava, doleva, nahoru, nebo dolů. */
  readonly points: 'right' | 'left' | 'up' | 'down';
  readonly arm: number;
  readonly lineWidth: number;
}

/**
 * Šipka, kam se panel po ťuknutí na úchyt pohne: na šířku vpravo „›“
 * (vysunout) nebo vlevo „‹“ (zasunout), na výšku dole „˄“ nebo „˅“.
 */
export function handleArrowShape(
  handle: LayoutRect,
  slidesFrom: ColoringLayout['panelSlidesFrom'],
  panelOpen: boolean,
): HandleArrowShape {
  const side = sideOf(handle);
  const arm = side * HANDLE_ARROW_ARM_SHARE;
  const lineWidth = side * HANDLE_ARROW_LINE_SHARE;
  if (slidesFrom === 'left') {
    const xShare = panelOpen ? HANDLE_ARROW_OPEN_X_SHARE : HANDLE_ARROW_CLOSED_X_SHARE;
    return {
      tipX: handle.left + handle.width * xShare,
      tipY: handle.top + handle.height / 2,
      points: panelOpen ? 'left' : 'right',
      arm,
      lineWidth,
    };
  }
  return {
    tipX: handle.left + handle.width / 2,
    tipY: handle.top + handle.height * HANDLE_ARROW_Y_SHARE,
    points: panelOpen ? 'down' : 'up',
    arm,
    lineWidth,
  };
}

/** Obdélník, do kterého se šipka úchytu vejde i s tloušťkou čáry. */
export function handleArrow(
  handle: LayoutRect,
  slidesFrom: ColoringLayout['panelSlidesFrom'],
  panelOpen: boolean,
): LayoutRect {
  const { tipX, tipY, points, arm, lineWidth } = handleArrowShape(handle, slidesFrom, panelOpen);
  const half = lineWidth / 2;
  if (points === 'left' || points === 'right') {
    const left = points === 'left' ? tipX : tipX - arm;
    return {
      left: left - half,
      top: tipY - arm - half,
      width: arm + lineWidth,
      height: 2 * arm + lineWidth,
    };
  }
  const top = points === 'up' ? tipY : tipY - arm;
  return {
    left: tipX - arm - half,
    top: top - half,
    width: 2 * arm + lineWidth,
    height: arm + lineWidth,
  };
}

// ---------------------------------------------------------------------------
// Převod mezi obrazovkou a vrstvou barev (#111 AC2)
// ---------------------------------------------------------------------------

/** Bod v herních jednotkách nebo v pixelech vrstvy. */
export interface PicturePoint {
  readonly x: number;
  readonly y: number;
}

/** Rozměr vrstvy barev v pixelech. */
export interface LayerSize {
  readonly width: number;
  readonly height: number;
}

/** Rozměr vrstvy barev na obrazovce (herní jednotky), obrázek se neotáčí (#127). */
export function pictureLayerSize(layout: ColoringLayout): LayerSize {
  const { picture } = layout;
  return { width: picture.width, height: picture.height };
}

/**
 * Bod vrstvy barev pod bodem obrazovky `x`, `y` (herní jednotky). Levý
 * horní roh obrázku je levý horní roh vrstvy. Bod mimo obrázek je mimo vrstvu.
 */
export function pictureLayerPoint(
  layout: ColoringLayout,
  layer: LayerSize,
  x: number,
  y: number,
): PicturePoint {
  const { picture } = layout;
  const across = (x - picture.left) / picture.width;
  const down = (y - picture.top) / picture.height;
  return { x: across * layer.width, y: down * layer.height };
}

/** Bod obrazovky (herní jednotky) nad bodem vrstvy `x`, `y`; obrácený `pictureLayerPoint`. */
export function pictureScreenPoint(
  layout: ColoringLayout,
  layer: LayerSize,
  x: number,
  y: number,
): PicturePoint {
  const { picture } = layout;
  const alongWidth = x / layer.width;
  const alongHeight = y / layer.height;
  return {
    x: picture.left + alongWidth * picture.width,
    y: picture.top + alongHeight * picture.height,
  };
}
