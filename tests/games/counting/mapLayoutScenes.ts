/**
 * Obrazovka mapy postupu (#87 AC7, #133 AC7) pro společná pravidla
 * rozložení (`tests/shared/layoutRules.ts`): zástupný vzhled se startem,
 * 2 zastávkami, cílem a značkou hráče ve všech oknech, kde se Počítání
 * hraje (iPad na šířku, telefon na šířku i na výšku, hranice, spuštění
 * z plochy), pro každou z 5 map a se značkou na každém kroku 0 až 3.
 *
 * Navržené rozhraní `src/games/counting/logic/progressMapLayout.ts`:
 * `layoutProgressMap(area: GameArea, theme: MapThemeId): ProgressMapLayout`
 * v herních jednotkách jako ostatní rozložení Počítání (mapa smí mít podle
 * `theme` vlastní tvar cesty):
 * - `places: readonly MapPoint[]` střed místa na mapě podle kroku
 *   (index 0 start, 1 a 2 zastávky, 3 cíl), `MapPoint { x, y }`;
 *   cesta vede rovnými úseky od místa k místu po řadě,
 * - `placeSize` průměr místa, `markerSize` průměr značky,
 * - `markerAt(layout, step): MapPoint` kde stojí značka na kroku `step`.
 *
 * Mapa nemá tlačítka (zavře se sama), proto žádná ťukací plocha.
 * Kolečko a domeček zůstanou (rodič smí otevřít nastavení a dítě odejít
 * domečkem i během mapy, #87 AC4), mapa nesmí do jejich rohu.
 */

import { MAP_STEPS, MAP_THEMES } from '../../../src/games/counting/logic/progressMap';
import type { MapThemeId } from '../../../src/games/counting/logic/progressMap';
import { layoutProgressMap, markerAt } from '../../../src/games/counting/logic/progressMapLayout';
import { gameAreaFor } from '../../../src/shared/logic/viewportLayout';
import { HOME_SCREEN_WINDOWS } from '../../shared/layoutRules';
import type { LayoutItem, LayoutScene } from '../../shared/layoutRules';
import { box, toCss, viewportOf } from '../../shared/viewportFixtures';
import type { TestWindow } from '../../shared/viewportFixtures';
import { PLAY_WINDOWS, cornerItems, isOwnSurrounding, visibleAreaOf } from './layoutScenes';

/** Všechna okna, ve kterých se mapa může ukázat. */
export const MAP_WINDOWS: readonly TestWindow[] = [...PLAY_WINDOWS, ...HOME_SCREEN_WINDOWS];

export const MARKER_NAME = 'značka';

/** Jméno místa na mapě podle kroku: start, 1. a 2. zastávka, cíl. */
export function placeName(step: number): string {
  if (step === 0) {
    return 'start';
  }
  if (step === MAP_STEPS) {
    return 'cíl';
  }
  return `zastávka ${step}`;
}

/** Mapa `theme` v okně `window` se značkou na kroku `step`. */
export function mapScene(window: TestWindow, theme: MapThemeId, step: number): LayoutScene {
  const area = gameAreaFor(viewportOf(window));
  const layout = layoutProgressMap(area, theme);
  const placeItems: LayoutItem[] = layout.places.map((place, index) => ({
    name: placeName(index),
    box: toCss(box(place.x, place.y, layout.placeSize, layout.placeSize), area),
  }));
  const marker = markerAt(layout, step);
  const markerItem: LayoutItem = {
    name: MARKER_NAME,
    box: toCss(box(marker.x, marker.y, layout.markerSize, layout.markerSize), area),
  };
  const ownPlace = placeName(step);
  return {
    label: `${window.name}, mapa ${theme}, značka na kroku ${step} (${ownPlace})`,
    free: visibleAreaOf(window, area),
    items: [...cornerItems(window, area), ...placeItems, markerItem],
    // Značka stojí na svém místě, jiné místo ani kolečko a domeček překrýt nesmí.
    // Kolečko a domeček leží ve svém okolí (#56, #68).
    mayOverlap: (first, second) =>
      ([first.name, second.name].includes(MARKER_NAME) &&
        [first.name, second.name].includes(ownPlace)) ||
      isOwnSurrounding(first, second) ||
      isOwnSurrounding(second, first),
  };
}

/** Mapa ve všech oknech, pro každou z 5 map a se značkou na každém kroku. */
export function mapScenes(windows: readonly TestWindow[] = MAP_WINDOWS): LayoutScene[] {
  return windows.flatMap((window) =>
    MAP_THEMES.flatMap((theme) =>
      Array.from({ length: MAP_STEPS + 1 }, (_, step) => mapScene(window, theme, step)),
    ),
  );
}
