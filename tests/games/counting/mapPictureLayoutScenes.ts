/**
 * Obrazovka mapy postupu s obrázkem (#134 AC2) pro společná pravidla
 * rozložení (`tests/shared/layoutRules.ts`): start, 2 zastávky, cíl,
 * symbol cíle a značka hráče ve všech oknech mapy z #133 (`MAP_WINDOWS`),
 * pro každou z 5 map a se značkou na každém kroku 0 až 3.
 *
 * Proti obrazovce z #133 (`mapLayoutScenes.ts`) se měří, co scéna opravdu
 * nakreslí (kontrola #133):
 * - okraj místa a značky je čára o šířce `share × průměr` na hraně
 *   kruhu, takže kruh s okrajem má průměr `(1 + share) × průměr`,
 * - zastávka a cíl po dojití značky poskočí na `MAP_ARRIVAL_PULSE_SCALE`
 *   (1,15×) a značka také; start nikdy neposkočí (značka na něj jen
 *   vyráží),
 * - symbol cíle je samostatný prvek u cíle, nepřekrývá místa ani značku.
 *
 * Navržené rozhraní (navíc k #133):
 * - `ProgressMapLayout.goalSymbol: MapSquare` v
 *   `src/games/counting/logic/progressMapLayout.ts`, `MapSquare { x, y,
 *   size }` střed a strana čtverce symbolu v herních jednotkách,
 * - `MAP_ARRIVAL_PULSE_SCALE` tamtéž: kolikrát se místo a značka při
 *   dojití zvětší (scéna ho použije místo dnešních 1,15 v kódu scény),
 * - `PROGRESS_MAP_SHAPE` v `src/games/counting/logic/theme.ts`:
 *   `placeBorderShare`, `goalBorderShare`, `markerBorderShare` šířka
 *   okraje jako díl průměru (dnes konstanty ve scéně 0,08, 0,14, 0,07).
 *
 * Mapa nemá ťukací plochu (AC3), žádný její prvek proto není `tappable`.
 * Kolečko a domeček zůstanou a mapa nesmí do jejich rohu (#87 AC4).
 */

import { MAP_STEPS, MAP_THEMES } from '../../../src/games/counting/logic/progressMap';
import type { MapThemeId } from '../../../src/games/counting/logic/progressMap';
import {
  MAP_ARRIVAL_PULSE_SCALE,
  layoutProgressMap,
  markerAt,
} from '../../../src/games/counting/logic/progressMapLayout';
import type { ProgressMapLayout } from '../../../src/games/counting/logic/progressMapLayout';
import { PROGRESS_MAP_SHAPE } from '../../../src/games/counting/logic/theme';
import { gameAreaFor } from '../../../src/shared/logic/viewportLayout';
import type { GameArea } from '../../../src/shared/logic/viewportLayout';
import type { LayoutItem, LayoutScene } from '../../shared/layoutRules';
import { box, toCss, viewportOf } from '../../shared/viewportFixtures';
import type { Box, TestWindow } from '../../shared/viewportFixtures';
import { cornerItems, isOwnSurrounding, visibleAreaOf } from './layoutScenes';
import { MAP_WINDOWS, MARKER_NAME, placeName } from './mapLayoutScenes';

export { MAP_WINDOWS };

export const GOAL_SYMBOL_NAME = 'symbol cíle';

/** Mapa v jednom okně: plocha a rozložení (pro testy velikostí a kontrastu). */
export interface PictureMapCase {
  readonly label: string;
  readonly window: TestWindow;
  readonly theme: MapThemeId;
  readonly area: GameArea;
  readonly layout: ProgressMapLayout;
}

export function pictureMapCases(windows: readonly TestWindow[] = MAP_WINDOWS): PictureMapCase[] {
  return windows.flatMap((window) =>
    MAP_THEMES.map((theme) => {
      const area = gameAreaFor(viewportOf(window));
      return {
        label: `${window.name}, mapa ${theme}`,
        window,
        theme,
        area,
        layout: layoutProgressMap(area, theme),
      };
    }),
  );
}

/** Průměr místa i s okrajem a poskočením (start neposkočí). */
export function drawnPlaceSize(layout: ProgressMapLayout, step: number): number {
  const share =
    step === MAP_STEPS ? PROGRESS_MAP_SHAPE.goalBorderShare : PROGRESS_MAP_SHAPE.placeBorderShare;
  const pulse = step === 0 ? 1 : MAP_ARRIVAL_PULSE_SCALE;
  return layout.placeSize * (1 + share) * pulse;
}

/** Průměr značky i s bílým okrajem a poskočením. */
export function drawnMarkerSize(layout: ProgressMapLayout): number {
  return layout.markerSize * (1 + PROGRESS_MAP_SHAPE.markerBorderShare) * MAP_ARRIVAL_PULSE_SCALE;
}

/** Čtverec symbolu cíle v CSS px okna. */
export function goalSymbolBox(testCase: PictureMapCase): Box {
  const { goalSymbol } = testCase.layout;
  return toCss(box(goalSymbol.x, goalSymbol.y, goalSymbol.size, goalSymbol.size), testCase.area);
}

/** Mapa s obrázkem se značkou na kroku `step`. */
export function pictureMapScene(testCase: PictureMapCase, step: number): LayoutScene {
  const { window, area, layout } = testCase;
  const placeItems: LayoutItem[] = layout.places.map((place, index) => {
    const size = drawnPlaceSize(layout, index);
    return { name: placeName(index), box: toCss(box(place.x, place.y, size, size), area) };
  });
  const marker = markerAt(layout, step);
  const markerSize = drawnMarkerSize(layout);
  const markerItem: LayoutItem = {
    name: MARKER_NAME,
    box: toCss(box(marker.x, marker.y, markerSize, markerSize), area),
  };
  const symbolItem: LayoutItem = { name: GOAL_SYMBOL_NAME, box: goalSymbolBox(testCase) };
  const ownPlace = placeName(step);
  return {
    label: `${testCase.label}, značka na kroku ${step} (${ownPlace})`,
    free: visibleAreaOf(window, area),
    items: [...cornerItems(window, area), ...placeItems, symbolItem, markerItem],
    // Značka stojí na svém místě; symbol cíle ani jiné místo překrýt nesmí.
    mayOverlap: (first, second) =>
      ([first.name, second.name].includes(MARKER_NAME) &&
        [first.name, second.name].includes(ownPlace)) ||
      isOwnSurrounding(first, second) ||
      isOwnSurrounding(second, first),
  };
}

/** Mapa s obrázkem ve všech oknech, na každé z 5 map a se značkou na každém kroku. */
export function pictureMapScenes(windows: readonly TestWindow[] = MAP_WINDOWS): LayoutScene[] {
  return pictureMapCases(windows).flatMap((testCase) =>
    Array.from({ length: MAP_STEPS + 1 }, (_, step) => pictureMapScene(testCase, step)),
  );
}
