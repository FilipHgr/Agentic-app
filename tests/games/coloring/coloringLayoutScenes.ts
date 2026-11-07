/**
 * Obrazovka Omalovánek (#88 AC1, AC4, AC6) pro společná pravidla rozložení
 * (`tests/shared/layoutRules.ts`): plocha omalovánky, vedle ní paleta
 * 8 barev a domeček vlevo nahoře, ve všech oknech, kde se hry hrají (iPad
 * na šířku, okno těsně nad hranicí telefonu, telefon na šířku i na výšku,
 * hranice a úzký iPad, spuštění z plochy). Prvky jsou v CSS px okna.
 *
 * Kolečko nastavení v Omalovánkách není (rozhodnutí k otázce 2), proto
 * jeho roh není vyhrazený. Domeček je prvek stránky (u iPadu leží zčásti
 * mimo herní plochu), proto je vyhrazené místo: jeho plocha pro prst
 * a 8 px kolem, aby barvy měly od domečku stejnou mezeru jako od sebe.
 *
 * Navržené rozhraní `src/games/coloring/logic/coloringLayout.ts`:
 * `layoutColoring(area: GameArea): ColoringLayout` v herních jednotkách
 * jako rozložení Počítání:
 * - `picture: LayoutRect` plocha omalovánky,
 * - `paletteColors: readonly LayoutRect[]` ťukací plochy barev v pořadí palety,
 * - `LayoutRect { left; top; width; height }`.
 */

import { layoutColoring } from '../../../src/games/coloring/logic/coloringLayout';
import type { LayoutRect } from '../../../src/games/coloring/logic/coloringLayout';
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

export const PICTURE_NAME = 'plocha omalovánky';

export function colorName(index: number): string {
  return `barva ${index + 1}`;
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

/** Plocha domečku pro prst a mezera 8 px kolem ní, v CSS px okna. */
function homeSurroundingOf(window: TestWindow): Box {
  const home = homeButtonFor(viewportOf(window));
  return {
    left: home.left - MIN_TAP_GAP,
    right: home.left + home.hitSize + MIN_TAP_GAP,
    top: home.top - MIN_TAP_GAP,
    bottom: home.top + home.hitSize + MIN_TAP_GAP,
  };
}

export interface ColoringCase {
  readonly window: TestWindow;
  readonly area: GameArea;
  /** Plocha omalovánky v CSS px okna. */
  readonly picture: Box;
  /** Ťukací plochy barev v CSS px okna. */
  readonly colors: readonly Box[];
  readonly scene: LayoutScene;
}

/** Omalovánky v okně `window` jako obrazovka pro pravidla. */
export function coloringCase(window: TestWindow): ColoringCase {
  const area = gameAreaFor(viewportOf(window));
  const layout = layoutColoring(area);
  const picture = toCss(boxOfRect(layout.picture), area);
  const colors = layout.paletteColors.map((rect) => toCss(boxOfRect(rect), area));
  const items: LayoutItem[] = [
    { name: 'domeček a 8 px kolem', box: homeSurroundingOf(window), reserved: true },
    { name: PICTURE_NAME, box: picture },
    ...colors.map((color, index) => ({ name: colorName(index), box: color, tappable: true })),
  ];
  return {
    window,
    area,
    picture,
    colors,
    scene: { label: `${window.name}, Omalovánky`, free: visibleAreaOf(window, area), items },
  };
}

export function coloringCases(windows: readonly TestWindow[] = COLORING_WINDOWS): ColoringCase[] {
  return windows.map(coloringCase);
}
