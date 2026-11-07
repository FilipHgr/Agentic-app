/**
 * Rozložení obrazovky Omalovánek v herních jednotkách (#88, #96): obrázek
 * přes celou obrazovku (plocha `fullWindow`) a vedle něj jen úzký pruh
 * ovládání: domeček, úchyt panelu, Zpět a místo pro 2 nedávné barvy.
 *
 * - Na šířku (L-A) je pruh vlevo: v jednom sloupci, když se do výšky vejde,
 *   jinak ve dvou (úchyt a Zpět vedle sebe, nedávné barvy dole). Panel
 *   vyjíždí zleva hned vedle pruhu.
 * - Na výšku (P-A) je pruh dole: nedávné barvy vlevo, úchyt uprostřed
 *   a Zpět vpravo, domeček zůstává vlevo nahoře. Panel vyjíždí zdola hned
 *   nad pruhem.
 *
 * Panel má místo pro celý plánovaný obsah: 12 barev, 10 nástrojů
 * a přepínač velikosti (23 ploch), barvy a nástroje jsou dva oddíly. Jedno
 * rozložení platí pro otevřený i zavřený panel, obrázek se tedy nikdy
 * neposune. Kam patří dotyk, rozhoduje `touchTargetAt`.
 * Čistý TypeScript bez Phaseru.
 */

import { homeButtonInFreeArea } from '../../../shared/logic/homeButton';
import type { GameArea, GameAreaFit } from '../../../shared/logic/viewportLayout';
import { PALETTE } from './palette';
import type { LineSize } from './toolPanel';

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
  /** Plocha omalovánky. */
  readonly picture: LayoutRect;
  /** Úchyt panelu nástrojů (#96 AC2). */
  readonly handle: LayoutRect;
  /** Tlačítko Zpět (#89) v pruhu u úchytu. */
  readonly undoButton: LayoutRect;
  /** Místa pro 2 nedávné barvy (zatím prázdná). */
  readonly recentColors: readonly LayoutRect[];
  /** Pozadí otevřeného panelu. */
  readonly panel: LayoutRect;
  /** 12 míst pro barvy v panelu, barvy `PALETTE` na prvních místech. */
  readonly paletteColors: readonly LayoutRect[];
  /** 10 míst pro nástroje, štětec na prvním. */
  readonly toolSlots: readonly LayoutRect[];
  /** Přepínač velikosti čáry (#91). */
  readonly sizeToggle: LayoutRect;
  /** Tenká čára mezi oddílem barev a nástrojů. */
  readonly panelDivider: LayoutRect;
  /** Odkud panel vyjíždí: zleva (na šířku), nebo zdola (na výšku). */
  readonly panelSlidesFrom: 'left' | 'bottom';
}

/** Kruh v herních jednotkách (tečka velikosti čáry, #91). */
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
  | { readonly kind: 'recentColor'; readonly index: number }
  | { readonly kind: 'color'; readonly index: number }
  | { readonly kind: 'tool'; readonly index: number }
  | { readonly kind: 'sizeToggle' }
  /** Pozadí panelu nebo prázdné místo v něm: nic se nestane, nemaluje se. */
  | { readonly kind: 'panel' }
  | { readonly kind: 'none' };

/** Poměr stran obrázku a vrstvy barev (1024 × 768). */
export const PICTURE_ASPECT = 4 / 3;

/** Plánovaný obsah panelu (#96 AC3). */
export const PANEL_COLOR_PLACES = 12;
export const PANEL_TOOL_PLACES = 10;
const RECENT_COLOR_PLACES = 2;

/** Plochy pruhu na šířku: domeček, úchyt, Zpět a 2 nedávné barvy. */
const LANDSCAPE_STRIP_CONTROLS = 3 + RECENT_COLOR_PLACES;

/** Mezera mezi plochami a mezi pruhem a obrázkem v CSS px. */
const GAP_CSS = 8;

/** Odstup obrázku od okraje volné plochy v CSS px. */
const PICTURE_EDGE_CSS = 8;

/** Nejmenší odstup prvku od okraje volné plochy v CSS px. */
const MIN_EDGE_CSS = 4;

/** Okraj uvnitř panelu kolem tlačítek v CSS px (na nízkém telefonu méně). */
const PANEL_PADDING_CSS = 12;

/** Mezera mezi oddílem barev a nástrojů v CSS px, uprostřed je čára. */
const SECTION_GAP_CSS = 16;

/** Tloušťka čáry mezi oddíly v CSS px. */
const DIVIDER_CSS = 2;

/** Sloupce oddílu v panelu: na šířku 3 (L-A), na výšku 4 (P-A). */
const LANDSCAPE_SECTION_COLUMNS = 3;
const PORTRAIT_SECTION_COLUMNS = 4;

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
 * Největší obdélník 4 : 3 na středu `box` (L-A i P-A). Na šířku je tak
 * i na nejnižším telefonu vedle otevřeného panelu kus obrázku vidět.
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

/** Oddíl panelu: `count` míst po řádcích v `columns` sloupcích. */
function sectionSlots(
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

function sectionHeight(count: number, columns: number, side: number): number {
  return lineLength(Math.ceil(count / columns), side);
}

/** Oddíly pod sebou (iPad, výška), nebo vedle sebe (nízké okno na šířku). */
type SectionArrangement = 'stacked' | 'sideBySide';

interface PanelGrid {
  readonly columns: number;
  readonly arrangement: SectionArrangement;
  readonly side: number;
}

/** Velikost mřížky panelu bez okraje. */
function gridSizeOf(grid: PanelGrid): { width: number; height: number } {
  const { columns, side } = grid;
  const sectionWidth = lineLength(columns, side);
  const colorsHeight = sectionHeight(PANEL_COLOR_PLACES, columns, side);
  const toolsHeight = sectionHeight(PANEL_TOOL_PLACES + 1, columns, side);
  return grid.arrangement === 'stacked'
    ? { width: sectionWidth, height: colorsHeight + SECTION_GAP_CSS + toolsHeight }
    : { width: 2 * sectionWidth + SECTION_GAP_CSS, height: Math.max(colorsHeight, toolsHeight) };
}

interface PanelPlaces {
  readonly panel: LayoutRect;
  readonly paletteColors: LayoutRect[];
  readonly toolSlots: LayoutRect[];
  readonly sizeToggle: LayoutRect;
  readonly panelDivider: LayoutRect;
}

/** Panel s mřížkou `grid` a okrajem `padding`, levý horní roh `left`, `top`. */
function panelAt(left: number, top: number, grid: PanelGrid, padding: number): PanelPlaces {
  const { columns, side } = grid;
  const size = gridSizeOf(grid);
  const innerLeft = left + padding;
  const innerTop = top + padding;
  const sectionWidth = lineLength(columns, side);
  const colorsHeight = sectionHeight(PANEL_COLOR_PLACES, columns, side);
  const stacked = grid.arrangement === 'stacked';
  const toolsLeft = stacked ? innerLeft : innerLeft + sectionWidth + SECTION_GAP_CSS;
  const toolsTop = stacked ? innerTop + colorsHeight + SECTION_GAP_CSS : innerTop;
  // Přepínač velikosti je hned za nástroji na posledním místě oddílu nástrojů.
  const tools = sectionSlots(toolsLeft, toolsTop, PANEL_TOOL_PLACES + 1, columns, side);
  const sizeToggle = tools.pop() ?? square(toolsLeft, toolsTop, side);
  const dividerOffset = (SECTION_GAP_CSS - DIVIDER_CSS) / 2;
  const panelDivider = stacked
    ? rect(innerLeft, innerTop + colorsHeight + dividerOffset, sectionWidth, DIVIDER_CSS)
    : rect(innerLeft + sectionWidth + dividerOffset, innerTop, DIVIDER_CSS, size.height);
  return {
    panel: rect(left, top, size.width + 2 * padding, size.height + 2 * padding),
    paletteColors: sectionSlots(innerLeft, innerTop, PANEL_COLOR_PLACES, columns, side),
    toolSlots: tools,
    sizeToggle,
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
  readonly recentColors: LayoutRect[];
}

/** Pruh vlevo pod domečkem: jeden sloupec, když se vejde, jinak dva. */
function landscapeStrip(home: LayoutRect, height: number): Strip {
  const side = home.width;
  const below = bottomOf(home) + GAP_CSS;
  const oneColumnFits =
    home.top + lineLength(LANDSCAPE_STRIP_CONTROLS, side) <= height - MIN_EDGE_CSS;
  if (oneColumnFits) {
    const step = side + GAP_CSS;
    return {
      handle: square(home.left, below, side),
      undoButton: square(home.left, below + step, side),
      recentColors: [
        square(home.left, below + 2 * step, side),
        square(home.left, below + 3 * step, side),
      ],
    };
  }
  // Dva sloupce (L-A na telefonu): úchyt a Zpět vedle sebe, nedávné barvy dole.
  const secondColumn = home.left + side + GAP_CSS;
  const recentTop = Math.max(below + side + GAP_CSS, height - home.top - side);
  return {
    handle: square(home.left, below, side),
    undoButton: square(secondColumn, below, side),
    recentColors: [square(home.left, recentTop, side), square(secondColumn, recentTop, side)],
  };
}

/** Panel vedle pruhu: oddíly pod sebou, když se vejdou do výšky, jinak vedle sebe. */
function landscapePanel(left: number, height: number, side: number): PanelPlaces {
  const space = height - 2 * MIN_EDGE_CSS;
  const stacked: PanelGrid = {
    columns: LANDSCAPE_SECTION_COLUMNS,
    arrangement: 'stacked',
    side,
  };
  const stackedFits = gridSizeOf(stacked).height + 2 * PANEL_PADDING_CSS <= space;
  const grid: PanelGrid = stackedFits ? stacked : { ...stacked, arrangement: 'sideBySide' };
  const gridHeight = gridSizeOf(grid).height;
  const padding = paddingFor(space, gridHeight);
  const panelHeight = gridHeight + 2 * padding;
  return panelAt(left, (height - panelHeight) / 2, grid, padding);
}

function landscapeLayout(width: number, height: number, home: LayoutRect): CssLayout {
  const strip = landscapeStrip(home, height);
  const stripRight = Math.max(
    ...[home, strip.handle, strip.undoButton, ...strip.recentColors].map(rightOf),
  );
  const besideStrip = stripRight + GAP_CSS;
  const picture = fitPicture({
    left: besideStrip,
    right: width - PICTURE_EDGE_CSS,
    top: PICTURE_EDGE_CSS,
    bottom: height - PICTURE_EDGE_CSS,
  });
  return {
    picture,
    ...strip,
    ...landscapePanel(besideStrip, height, home.width),
    panelSlidesFrom: 'left',
  };
}

// ---------------------------------------------------------------------------
// Na výšku (P-A)
// ---------------------------------------------------------------------------

/** Pruh dole: nedávné barvy vlevo, úchyt uprostřed, Zpět vpravo u palce. */
function portraitStrip(width: number, height: number, home: LayoutRect): Strip {
  const side = home.width;
  const top = height - home.top - side;
  const handleLeft = (width - side) / 2;
  // Nedávné barvy od levého okraje jako domeček, v úzkém okně blíž k okraji.
  const recentLeft = Math.max(
    MIN_EDGE_CSS,
    Math.min(home.left, handleLeft - GAP_CSS - lineLength(RECENT_COLOR_PLACES, side)),
  );
  return {
    handle: square(handleLeft, top, side),
    undoButton: square(width - home.left - side, top, side),
    recentColors: [square(recentLeft, top, side), square(recentLeft + side + GAP_CSS, top, side)],
  };
}

/** Panel nad pruhem, na středu šířky, pod domečkem a 8 px kolem něj. */
function portraitPanel(width: number, bottom: number, home: LayoutRect): PanelPlaces {
  const grid: PanelGrid = {
    columns: PORTRAIT_SECTION_COLUMNS,
    arrangement: 'stacked',
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

function portraitLayout(width: number, height: number, home: LayoutRect): CssLayout {
  const strip = portraitStrip(width, height, home);
  const aboveStrip = strip.handle.top - GAP_CSS;
  const picture = fitPicture({
    left: PICTURE_EDGE_CSS,
    right: width - PICTURE_EDGE_CSS,
    top: bottomOf(home) + GAP_CSS,
    bottom: aboveStrip,
  });
  return {
    picture,
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
    recentColors: css.recentColors.map(units),
    panel: units(css.panel),
    paletteColors: css.paletteColors.map(units),
    toolSlots: css.toolSlots.map(units),
    sizeToggle: units(css.sizeToggle),
    panelDivider: units(css.panelDivider),
    panelSlidesFrom: css.panelSlidesFrom,
  };
}

/** Rozložení Omalovánek pro herní plochu `area` (oba stavy panelu). */
export function layoutColoring(area: GameArea): ColoringLayout {
  const cssPerUnit = area.scale;
  const home = homeButtonInFreeArea(area);
  const homeCss = square(home.left * cssPerUnit, home.top * cssPerUnit, home.size * cssPerUnit);
  const width = area.width * cssPerUnit;
  const height = area.height * cssPerUnit;
  const css =
    width >= height
      ? landscapeLayout(width, height, homeCss)
      : portraitLayout(width, height, homeCss);
  return layoutInUnits(css, 1 / cssPerUnit);
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

/** Dotyk na otevřeném panelu: tlačítko, nebo jen panel (nikdy obrázek pod ním). */
function panelTarget(layout: ColoringLayout, x: number, y: number): TouchTarget {
  const color = indexContaining(layout.paletteColors, x, y);
  if (color >= 0) {
    return color < PALETTE.length ? { kind: 'color', index: color } : { kind: 'panel' };
  }
  const tool = indexContaining(layout.toolSlots, x, y);
  if (tool >= 0) {
    return { kind: 'tool', index: tool };
  }
  return contains(layout.sizeToggle, x, y) ? { kind: 'sizeToggle' } : { kind: 'panel' };
}

/**
 * Kam patří dotyk v bodě `x`, `y` (herní jednotky): pruh ovládání,
 * otevřený panel (i v mezeře mezi tlačítky), obrázek, nebo nic.
 */
export function touchTargetAt(
  layout: ColoringLayout,
  panelOpen: boolean,
  x: number,
  y: number,
): TouchTarget {
  if (contains(layout.handle, x, y)) {
    return { kind: 'handle' };
  }
  if (contains(layout.undoButton, x, y)) {
    return { kind: 'undo' };
  }
  const recent = indexContaining(layout.recentColors, x, y);
  if (recent >= 0) {
    return { kind: 'recentColor', index: recent };
  }
  if (panelOpen && contains(layout.panel, x, y)) {
    return panelTarget(layout, x, y);
  }
  return contains(layout.picture, x, y) ? { kind: 'picture' } : { kind: 'none' };
}

// ---------------------------------------------------------------------------
// Tečka velikosti čáry (#91)
// ---------------------------------------------------------------------------

/** Průměry tečky velikosti v poměru 1 : 2 : 3 (#91 AC1). */
const SIZE_DOT_STEPS: Readonly<Record<LineSize, number>> = { small: 1, medium: 2, large: 3 };

/** Velká tečka v úchytu má průměr tento díl strany úchytu (nejvýš čtvrtina, #91 AC1). */
const HANDLE_LARGE_DOT_SHARE = 0.24;

/**
 * Střed tečky v úchytu jako díl strany od levého horního rohu: v pravém
 * dolním rohu, uvnitř zaobleného okraje a mimo šipku panelu, která je
 * na šířku vpravo uprostřed výšky a na výšku dole uprostřed šířky.
 */
const HANDLE_DOT_CENTER_SHARE = 0.8;

/**
 * Ikona nástroje v úchytu: čtverec tohoto dílu strany se středem kousek
 * vlevo nahoru od středu úchytu, aby se nepřekrývala s tečkou ani šipkou.
 */
const HANDLE_ICON_SHARE = 0.56;
const HANDLE_ICON_CENTER_SHARE = 0.43;

/** Velká tečka v přepínači má průměr tento díl strany přepínače. */
const TOGGLE_LARGE_DOT_SHARE = 0.6;

function sideOf(rect: LayoutRect): number {
  return Math.min(rect.width, rect.height);
}

/** Průměr tečky velikosti `size`, když má velká tečka průměr `largeDiameter`. */
function dotDiameter(size: LineSize, largeDiameter: number): number {
  return (largeDiameter * SIZE_DOT_STEPS[size]) / SIZE_DOT_STEPS.large;
}

/**
 * Kam úchyt kreslí ikonu vybraného nástroje a tmavou tečku vybrané
 * velikosti (#91 AC1): ikona uprostřed, tečka v pravém dolním rohu.
 */
export function handleFace(
  handle: LayoutRect,
  size: LineSize,
): { readonly icon: LayoutRect; readonly sizeDot: LayoutCircle } {
  const side = sideOf(handle);
  const iconSide = side * HANDLE_ICON_SHARE;
  const icon = {
    left: handle.left + handle.width * HANDLE_ICON_CENTER_SHARE - iconSide / 2,
    top: handle.top + handle.height * HANDLE_ICON_CENTER_SHARE - iconSide / 2,
    width: iconSide,
    height: iconSide,
  };
  const sizeDot = {
    centerX: handle.left + handle.width - side * (1 - HANDLE_DOT_CENTER_SHARE),
    centerY: handle.top + handle.height - side * (1 - HANDLE_DOT_CENTER_SHARE),
    diameter: dotDiameter(size, side * HANDLE_LARGE_DOT_SHARE),
  };
  return { icon, sizeDot };
}

/** Tmavá tečka vybrané velikosti uprostřed přepínače (#91 AC1), poměr 1 : 2 : 3. */
export function sizeToggleDot(toggle: LayoutRect, size: LineSize): LayoutCircle {
  return {
    centerX: toggle.left + toggle.width / 2,
    centerY: toggle.top + toggle.height / 2,
    diameter: dotDiameter(size, sideOf(toggle) * TOGGLE_LARGE_DOT_SHARE),
  };
}
