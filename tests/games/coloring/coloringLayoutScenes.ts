/**
 * Obrazovka Omalovánek pro společná pravidla rozložení
 * (`tests/shared/layoutRules.ts`) ve všech oknech, kde se hry hrají (iPad
 * na šířku, okno těsně nad hranicí telefonu, telefon na šířku i na výšku,
 * hranice a úzký iPad, spuštění z plochy). Prvky jsou v CSS px okna.
 *
 * Od #96 je obrázek přes celou obrazovku a vedle něj jen úzký pruh
 * ovládání: domeček, úchyt panelu, Zpět a místo pro 2 nedávné barvy.
 * Na šířku je pruh vlevo a panel vyjíždí zleva (L-A), na výšku je pruh
 * dole, úchyt uprostřed, Zpět vpravo, nedávné barvy vlevo a panel vyjíždí
 * zdola (P-A). Domeček na výšku zůstává vlevo nahoře.
 *
 * Od #105 je panel ve dvou krocích se stejným rozměrem panelu: krok
 * nástrojů (od #112 tři tlačítka tloušťky v hlavičce a 10 nástrojů v těle)
 * a krok barev (vybraný nástroj na 1. místě hlavičky a 12 barev v těle),
 * každý nejvýš 13 ploch. Každé okno se zkouší se zavřeným panelem a v obou
 * krocích. Otevřený panel leží přes obrázek, proto se s ním smí překrývat
 * (a plochy kroku s pozadím panelu). Plochy druhého kroku na obrazovce
 * nejsou, proto se s plochami zobrazeného kroku nesrovnávají.
 *
 * Kolečko nastavení v Omalovánkách není (#88, otázka 2), jeho roh se
 * nevyhrazuje. Domeček je prvek stránky (u iPadu leží zčásti mimo herní
 * plochu), proto je vyhrazené místo: plocha pro prst a 8 px kolem.
 *
 * Omalovánky mají herní plochu přes celou volnou plochu okna i na iPadu
 * (`COLORING_GAME_AREA_FIT`, #96), jak ji hra dostane od stránky.
 *
 * Od #111 sahá obrázek na šířku až k hornímu a dolnímu okraji volné plochy
 * (#111 AC4). Je to schválená výjimka z pravidla „aspoň 4 px od okraje“
 * (rozhodnutí 2026-11-08), proto má plocha omalovánky na šířku odstup od
 * okraje 0 px (`PICTURE_EDGE_EXCEPTION`). Výjimka platí jen pro obrázek
 * a jen na šířku, ostatní prvky mají dál aspoň 4 px. Na výšku je obrázek
 * otočený o 90° po směru hodinových ručiček (#111 AC1), `picture` je
 * obdélník, který zabírá na obrazovce (šířka 3, výška 4).
 *
 * Navržené rozhraní `src/games/coloring/logic/coloringLayout.ts`
 * (v herních jednotkách, jedno rozložení pro oba stavy panelu, aby se
 * obrázek při otevření ani zavření neposunul):
 * `layoutColoring(area: GameArea): ColoringLayout` s poli
 * - `picture: LayoutRect` plocha omalovánky,
 * - `handle: LayoutRect` úchyt panelu (#96),
 * - `undoButton: LayoutRect` Zpět v pruhu (#89, místo od #96),
 * - `recentColors: readonly LayoutRect[]` 2 místa pro nedávné barvy,
 * - `panel: LayoutRect` pozadí otevřeného panelu,
 * - `paletteColors: readonly LayoutRect[]` 12 míst pro barvy v panelu
 *   (barvy `PALETTE` na prvních místech, ostatní zatím prázdné),
 * - `toolSlots: readonly LayoutRect[]` 10 míst pro nástroje,
 * - `sizeButtons: readonly LayoutRect[]` tři tlačítka tloušťky (#112,
 *   nahrazují přepínač `sizeToggle` z #91).
 *
 * Od #112 jsou v hlavičce kroku nástrojů místo přepínače tři tlačítka
 * tloušťky (malá, střední, velká, `sizeButtons`), krok nástrojů má tedy
 * 13 ploch. Vybraný nástroj v kroku barev je na místě prvního z nich.
 *
 * Navržené rozšíření (#105):
 * - `paletteColors` a `toolSlots` jsou tělo kroku barev a kroku nástrojů
 *   (na stejném místě panelu, každý krok ukazuje jen svoje),
 * - `colorStepTool: LayoutRect` vybraný nástroj v hlavičce kroku barev,
 *   stejný obdélník jako první tlačítko tloušťky v hlavičce kroku nástrojů,
 * - `panelDivider: LayoutRect` čára mezi hlavičkou a tělem (v obou krocích),
 * - `touchTargetAt(layout, panel: PanelView, x, y)` s
 *   `PanelView = 'closed' | 'tools' | 'colors'` (`toolPanel.ts`) a novým
 *   cílem `{ kind: 'backToTools' }` pro vybraný nástroj v kroku barev.
 */

import {
  COLORING_GAME_AREA_FIT,
  layoutColoring,
} from '../../../src/games/coloring/logic/coloringLayout';
import type { ColoringLayout, LayoutRect } from '../../../src/games/coloring/logic/coloringLayout';
import type { PanelView } from '../../../src/games/coloring/logic/toolPanel';
import { homeButtonFor } from '../../../src/shared/logic/homeButton';
import { gameAreaFor } from '../../../src/shared/logic/viewportLayout';
import type { GameArea } from '../../../src/shared/logic/viewportLayout';
import { HOME_SCREEN_WINDOWS, MIN_TAP_GAP } from '../../shared/layoutRules';
import type { LayoutItem, LayoutScene } from '../../shared/layoutRules';
import {
  IPAD_WINDOWS,
  JUST_ABOVE_LIMIT,
  NO_NOTCH,
  PHONE_PORTRAIT_EDGE_WINDOWS,
  PHONE_PORTRAIT_WINDOWS,
  PHONE_WINDOWS,
  freeAreaOf,
  toCss,
  viewportOf,
} from '../../shared/viewportFixtures';
import type { Box, TestWindow } from '../../shared/viewportFixtures';

/**
 * iPhone 8 Plus na výšku v Safari s lištami (#111): nízké okno, kde se
 * otočený obrázek přes šířku okna nevejde mezi domeček a lištu a musí se
 * zmenšit na volnou výšku.
 */
export const LOW_PORTRAIT_PHONE: TestWindow = {
  name: '414×622 iPhone 8 Plus v Safari s lištami',
  width: 414,
  height: 622,
  safeArea: NO_NOTCH,
};

/** Všechna okna, ve kterých se Omalovánky hrají, i z plochy. */
export const COLORING_WINDOWS: readonly TestWindow[] = [
  ...IPAD_WINDOWS,
  JUST_ABOVE_LIMIT,
  ...PHONE_WINDOWS,
  ...PHONE_PORTRAIT_WINDOWS,
  LOW_PORTRAIT_PHONE,
  ...PHONE_PORTRAIT_EDGE_WINDOWS,
  ...HOME_SCREEN_WINDOWS,
];

/**
 * Je herní plocha na šířku (obrázek neotočený)? Rozložení rozhoduje podle
 * tvaru herní plochy, ne okna (#111).
 */
export function isLandscapeArea(area: GameArea): boolean {
  return area.width >= area.height;
}

/** Zavřený panel, krok nástrojů, nebo krok barev (#105). */
export type PanelState = PanelView;

export const PANEL_STATES: readonly PanelState[] = ['closed', 'tools', 'colors'];

/** Je panel v případu otevřený (v kterémkoli kroku)? */
export function isOpen(testCase: { readonly panel: PanelState }): boolean {
  return testCase.panel !== 'closed';
}

/** Obsah panelu (#96 AC3, #112): 12 barev, 10 nástrojů a 3 tlačítka tloušťky. */
export const PLANNED_COLORS = 12;
export const PLANNED_TOOLS = 10;
export const PLANNED_LINE_SIZES = 3;

/** Krok panelu má nejvýš tolik ploch (#105, schválené obrázky). */
export const MAX_STEP_PLACES = 13;

/** Místa pro nedávné barvy v pruhu (#96 AC1). */
export const RECENT_COLOR_PLACES = 2;

export const PICTURE_NAME = 'plocha omalovánky';
export const HOME_NAME = 'domeček a 8 px kolem';
export const HANDLE_NAME = 'úchyt panelu';
export const UNDO_NAME = 'Zpět';
export const PANEL_NAME = 'panel nástrojů';
export const COLOR_STEP_TOOL_NAME = 'vybraný nástroj';

export function colorName(index: number): string {
  return `barva ${index + 1}`;
}

export function toolName(index: number): string {
  return `nástroj ${index + 1}`;
}

/** Tlačítko tloušťky na místě `index` hlavičky (0 malá, 1 střední, 2 velká, #112). */
export function lineSizeName(index: number): string {
  return `tloušťka ${index + 1}`;
}

/**
 * Schválený odstup obrázku od okraje volné plochy na šířku v CSS px
 * (#111 AC4, rozhodnutí 2026-11-08): obrázek smí sahat k hornímu
 * a dolnímu okraji. Jen pro plochu omalovánky.
 */
export const PICTURE_EDGE_EXCEPTION = 0;

export function recentColorName(index: number): string {
  return `nedávná barva ${index + 1}`;
}

export function boxOfRect(rect: LayoutRect): Box {
  return {
    left: rect.left,
    right: rect.left + rect.width,
    top: rect.top,
    bottom: rect.top + rect.height,
  };
}

/** Kde je na obrazovce vidět hra: volná plocha okna a zároveň herní plocha. */
function visibleAreaOf(window: TestWindow, area: GameArea): Box {
  const free = freeAreaOf(window);
  const plane = toCss({ left: 0, right: area.width, top: 0, bottom: area.height }, area);
  return {
    left: Math.max(free.left, plane.left),
    right: Math.min(free.right, plane.right),
    top: Math.max(free.top, plane.top),
    bottom: Math.min(free.bottom, plane.bottom),
  };
}

/** Plocha domečku pro prst v CSS px okna. */
function homeHitOf(window: TestWindow): Box {
  const home = homeButtonFor(viewportOf(window));
  return {
    left: home.left,
    right: home.left + home.hitSize,
    top: home.top,
    bottom: home.top + home.hitSize,
  };
}

function surroundingOf(inner: Box, margin: number): Box {
  return {
    left: inner.left - margin,
    right: inner.right + margin,
    top: inner.top - margin,
    bottom: inner.bottom + margin,
  };
}

/** Prvky otevřeného panelu, které leží přes obrázek. */
const PANEL_PART = /^(panel nástrojů|barva \d+|nástroj \d+|tloušťka \d+|vybraný nástroj)$/;

function isPanelPart(item: LayoutItem): boolean {
  return PANEL_PART.test(item.name);
}

/**
 * Schválený překryv (#96 AC4): otevřený panel leží přes obrázek a jeho
 * tlačítka na pozadí panelu. S ničím jiným se panel překrývat nesmí.
 */
function panelOverObjects(first: LayoutItem, second: LayoutItem): boolean {
  const names = [first.name, second.name];
  const onPicture = names.includes(PICTURE_NAME) && (isPanelPart(first) || isPanelPart(second));
  const onPanel =
    names.includes(PANEL_NAME) &&
    isPanelPart(first) &&
    isPanelPart(second) &&
    first.name !== second.name;
  return onPicture || onPanel;
}

export interface ColoringCase {
  readonly window: TestWindow;
  readonly area: GameArea;
  /** Zavřený panel, krok nástrojů, nebo krok barev. */
  readonly panel: PanelState;
  /** Na šířku (pruh vlevo, L-A), nebo na výšku (pruh dole, P-A)? */
  readonly landscape: boolean;
  /** Rozložení v herních jednotkách (pro `touchTargetAt`). */
  readonly layout: ColoringLayout;
  /** Volná plocha, kde je hra vidět, v CSS px okna. */
  readonly visible: Box;
  /** Plocha omalovánky v CSS px okna. */
  readonly picture: Box;
  /** Plocha domečku pro prst v CSS px okna. */
  readonly home: Box;
  readonly handle: Box;
  readonly undo: Box;
  readonly recentColors: readonly Box[];
  /** Pozadí panelu v CSS px okna (vidět jen při otevřeném panelu). */
  readonly panelBox: Box;
  /** Místa pro barvy v panelu v CSS px okna. */
  readonly colors: readonly Box[];
  /** Místa pro nástroje v kroku nástrojů v CSS px okna. */
  readonly tools: readonly Box[];
  /** Tři tlačítka tloušťky v hlavičce kroku nástrojů (#112), od nejtenčí. */
  readonly sizeButtons: readonly Box[];
  /** Vybraný nástroj v hlavičce kroku barev (#105). */
  readonly colorStepTool: Box;
  /** Čára mezi hlavičkou a tělem panelu (#105). */
  readonly divider: Box;
  /** Ťukací plochy zobrazeného kroku (hlavička první), u zavřeného panelu žádné. */
  readonly stepPlaces: readonly Box[];
  readonly scene: LayoutScene;
}

function stripItems(home: Box, handle: Box, undo: Box, recentColors: readonly Box[]): LayoutItem[] {
  return [
    { name: HOME_NAME, box: surroundingOf(home, MIN_TAP_GAP), reserved: true },
    { name: HANDLE_NAME, box: handle, tappable: true },
    { name: UNDO_NAME, box: undo, tappable: true },
    ...recentColors.map((box, index) => ({ name: recentColorName(index), box, tappable: true })),
  ];
}

/** Krok nástrojů: 3 tlačítka tloušťky a 10 nástrojů, žádné barvy (#105 AC1, #112 AC1). */
function toolStepItems(sizeButtons: readonly Box[], tools: readonly Box[]): LayoutItem[] {
  return [
    ...sizeButtons.map((box, index) => ({ name: lineSizeName(index), box, tappable: true })),
    ...tools.map((box, index) => ({ name: toolName(index), box, tappable: true })),
  ];
}

/** Krok barev: vybraný nástroj a 12 barev (#105 AC2). */
function colorStepItems(colorStepTool: Box, colors: readonly Box[]): LayoutItem[] {
  return [
    { name: COLOR_STEP_TOOL_NAME, box: colorStepTool, tappable: true },
    ...colors.map((box, index) => ({ name: colorName(index), box, tappable: true })),
  ];
}

function panelItems(
  panel: PanelState,
  panelBox: Box,
  places: {
    sizeButtons: readonly Box[];
    tools: readonly Box[];
    colorStepTool: Box;
    colors: readonly Box[];
  },
): LayoutItem[] {
  if (panel === 'closed') {
    return [];
  }
  const step =
    panel === 'tools'
      ? toolStepItems(places.sizeButtons, places.tools)
      : colorStepItems(places.colorStepTool, places.colors);
  return [{ name: PANEL_NAME, box: panelBox }, ...step];
}

const PANEL_LABELS: Readonly<Record<PanelState, string>> = {
  closed: 'panel zavřený',
  tools: 'krok nástrojů',
  colors: 'krok barev',
};

/** Omalovánky v okně `window` s panelem `panel` jako obrazovka pro pravidla. */
export function coloringCase(window: TestWindow, panel: PanelState = 'closed'): ColoringCase {
  const area = gameAreaFor(viewportOf(window), COLORING_GAME_AREA_FIT);
  const layout = layoutColoring(area);
  const css = (rect: LayoutRect): Box => toCss(boxOfRect(rect), area);
  const picture = css(layout.picture);
  const home = homeHitOf(window);
  const handle = css(layout.handle);
  const undo = css(layout.undoButton);
  const recentColors = layout.recentColors.map(css);
  const panelBox = css(layout.panel);
  const colors = layout.paletteColors.map(css);
  const tools = layout.toolSlots.map(css);
  // Před implementací #112 pole chybí; obrazovka se pak složí bez tlačítek
  // tloušťky a testy #112 selžou na vlastních kontrolách, ne tady.
  const sizeButtons = (layout.sizeButtons ?? []).map(css);
  const colorStepTool = css(layout.colorStepTool);
  const divider = css(layout.panelDivider);
  const panelPlaces = { sizeButtons, tools, colorStepTool, colors };
  const landscape = window.width >= window.height;
  const pictureItem: LayoutItem = isLandscapeArea(area)
    ? { name: PICTURE_NAME, box: picture, minEdge: PICTURE_EDGE_EXCEPTION }
    : { name: PICTURE_NAME, box: picture };
  const items: LayoutItem[] = [
    pictureItem,
    ...stripItems(home, handle, undo, recentColors),
    ...panelItems(panel, panelBox, panelPlaces),
  ];
  const stepPlaces = items
    .filter((item) => item.tappable === true && isPanelPart(item))
    .map((item) => item.box);
  return {
    window,
    area,
    panel,
    landscape,
    layout,
    visible: visibleAreaOf(window, area),
    picture,
    home,
    handle,
    undo,
    recentColors,
    panelBox,
    colors,
    tools,
    sizeButtons,
    colorStepTool,
    divider,
    stepPlaces,
    scene: {
      label: `${window.name}, Omalovánky, ${PANEL_LABELS[panel]}`,
      free: visibleAreaOf(window, area),
      items,
      mayOverlap: panelOverObjects,
    },
  };
}

/** Každé okno se zavřeným panelem a v obou krocích panelu. */
export function coloringCases(
  windows: readonly TestWindow[] = COLORING_WINDOWS,
  panels: readonly PanelState[] = PANEL_STATES,
): ColoringCase[] {
  return windows.flatMap((window) => panels.map((panel) => coloringCase(window, panel)));
}
