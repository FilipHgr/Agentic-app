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
 * zdola (P-A). Domeček na výšku zůstává vlevo nahoře. Každé okno se zkouší
 * se zavřeným i otevřeným panelem. Otevřený panel má plný plánovaný obsah:
 * 12 barev, 10 nástrojů a přepínač velikosti (23 ploch); leží přes obrázek,
 * proto se s ním smí překrývat (a jeho tlačítka s pozadím panelu).
 *
 * Kolečko nastavení v Omalovánkách není (#88, otázka 2), jeho roh se
 * nevyhrazuje. Domeček je prvek stránky (u iPadu leží zčásti mimo herní
 * plochu), proto je vyhrazené místo: plocha pro prst a 8 px kolem.
 *
 * Omalovánky mají herní plochu přes celou volnou plochu okna i na iPadu
 * (`COLORING_GAME_AREA_FIT`, #96), jak ji hra dostane od stránky.
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
 * - `sizeToggle: LayoutRect` přepínač velikosti.
 */

import {
  COLORING_GAME_AREA_FIT,
  layoutColoring,
} from '../../../src/games/coloring/logic/coloringLayout';
import type { ColoringLayout, LayoutRect } from '../../../src/games/coloring/logic/coloringLayout';
import { homeButtonFor } from '../../../src/shared/logic/homeButton';
import { gameAreaFor } from '../../../src/shared/logic/viewportLayout';
import type { GameArea } from '../../../src/shared/logic/viewportLayout';
import { HOME_SCREEN_WINDOWS, MIN_TAP_GAP } from '../../shared/layoutRules';
import type { LayoutItem, LayoutScene } from '../../shared/layoutRules';
import {
  IPAD_WINDOWS,
  JUST_ABOVE_LIMIT,
  PHONE_PORTRAIT_EDGE_WINDOWS,
  PHONE_PORTRAIT_WINDOWS,
  PHONE_WINDOWS,
  freeAreaOf,
  toCss,
  viewportOf,
} from '../../shared/viewportFixtures';
import type { Box, TestWindow } from '../../shared/viewportFixtures';

/** Všechna okna, ve kterých se Omalovánky hrají, i z plochy. */
export const COLORING_WINDOWS: readonly TestWindow[] = [
  ...IPAD_WINDOWS,
  JUST_ABOVE_LIMIT,
  ...PHONE_WINDOWS,
  ...PHONE_PORTRAIT_WINDOWS,
  ...PHONE_PORTRAIT_EDGE_WINDOWS,
  ...HOME_SCREEN_WINDOWS,
];

export type PanelState = 'closed' | 'open';

export const PANEL_STATES: readonly PanelState[] = ['closed', 'open'];

/** Plánovaný obsah panelu (#96 AC3): 12 barev, 10 nástrojů a přepínač velikosti. */
export const PLANNED_COLORS = 12;
export const PLANNED_TOOLS = 10;
export const PLANNED_PANEL_ITEMS = PLANNED_COLORS + PLANNED_TOOLS + 1;

/** Místa pro nedávné barvy v pruhu (#96 AC1). */
export const RECENT_COLOR_PLACES = 2;

export const PICTURE_NAME = 'plocha omalovánky';
export const HOME_NAME = 'domeček a 8 px kolem';
export const HANDLE_NAME = 'úchyt panelu';
export const UNDO_NAME = 'Zpět';
export const PANEL_NAME = 'panel nástrojů';
export const SIZE_TOGGLE_NAME = 'přepínač velikosti';

export function colorName(index: number): string {
  return `barva ${index + 1}`;
}

export function toolName(index: number): string {
  return `nástroj ${index + 1}`;
}

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
const PANEL_PART = /^(panel nástrojů|barva \d+|nástroj \d+|přepínač velikosti)$/;

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
  readonly tools: readonly Box[];
  readonly sizeToggle: Box;
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

function panelItems(
  panelBox: Box,
  colors: readonly Box[],
  tools: readonly Box[],
  sizeToggle: Box,
): LayoutItem[] {
  return [
    { name: PANEL_NAME, box: panelBox },
    ...colors.map((box, index) => ({ name: colorName(index), box, tappable: true })),
    ...tools.map((box, index) => ({ name: toolName(index), box, tappable: true })),
    { name: SIZE_TOGGLE_NAME, box: sizeToggle, tappable: true },
  ];
}

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
  const sizeToggle = css(layout.sizeToggle);
  const items: LayoutItem[] = [
    { name: PICTURE_NAME, box: picture },
    ...stripItems(home, handle, undo, recentColors),
    ...(panel === 'open' ? panelItems(panelBox, colors, tools, sizeToggle) : []),
  ];
  const panelLabel = panel === 'open' ? 'panel otevřený' : 'panel zavřený';
  return {
    window,
    area,
    panel,
    landscape: window.width >= window.height,
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
    sizeToggle,
    scene: {
      label: `${window.name}, Omalovánky, ${panelLabel}`,
      free: visibleAreaOf(window, area),
      items,
      mayOverlap: panelOverObjects,
    },
  };
}

/** Každé okno se zavřeným i otevřeným panelem. */
export function coloringCases(
  windows: readonly TestWindow[] = COLORING_WINDOWS,
  panels: readonly PanelState[] = PANEL_STATES,
): ColoringCase[] {
  return windows.flatMap((window) => panels.map((panel) => coloringCase(window, panel)));
}
