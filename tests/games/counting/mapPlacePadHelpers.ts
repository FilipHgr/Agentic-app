/**
 * Pomůcky pro testy podložek zastávek na mapě postupu (#147, třetí část
 * varianty D): pod každým ze 4 míst (start, 2 zastávky, cíl) leží
 * podložka podle tématu mapy. Měří se v kartě (#145) ve všech oknech mapy
 * z #133 AC7 a na 5 mapách, stejně jako stopy (#144) a oblouky (#146).
 *
 * Podložka má podle tématu jiný tvar (kulatý pařez, širší kopeček,
 * čtvercová dlaždice), proto ji testy měří jako její obdélník
 * `width × height` se středem `x`, `y` (tvar se do něj vždy vejde).
 *
 * Navržené rozhraní `src/games/counting/logic/mapPlacePads.ts` (čistý
 * TypeScript bez Phaseru, v herních jednotkách jako rozložení mapy):
 * - `type PlacePadKind = 'stump' | 'sandMound' | 'stoneTile' | 'seaweedRock' | 'planetoid'`
 *   (pařez, písečný kopeček, kamenná dlaždice, kámen s řasou, planetka),
 * - `MAP_PLACE_PAD_KINDS: Readonly<Record<MapThemeId, PlacePadKind>>`
 *   druh podložek každé mapy (les pařez, ostrov kopeček, hrad dlaždice,
 *   podmoří kámen s řasou, vesmír planetka),
 * - `interface MapPlacePad { x; y; width; height }`: střed podložky
 *   (ve středu místa) a vnější rozměr celé nakreslené podložky (i s okrajem
 *   a řasou), nenatočený,
 * - `interface MapPlacePads { kind: PlacePadKind; pads: readonly MapPlacePad[] }`
 *   podložka každého místa, index = krok (0 start … `MAP_STEPS` cíl),
 * - `layoutMapPlacePads(area: MapArea, theme: MapThemeId,
 *   map: ProgressMapLayout = layoutProgressMap(area, theme)): MapPlacePads`
 *   nezávislé na kroku značky, na rozsvícení i na tom, jestli je stažený
 *   obrázek (kreslí se i v zástupném vzhledu),
 * - `interface PlacePadLook { fillColor: string; outlineColor: string }`
 *   barva plochy podložky, na které leží kruh místa, a jejího okraje
 *   (`#RRGGBB`),
 * - `mapPlacePadStyleFor(theme: MapThemeId, look: MapLook): PlacePadLook`
 *   barvy podložek mapy; s rozsvícením se nemění (otevřená otázka 2).
 * Kruh místa, jeho barvy a rozsvícení (`PROGRESS_MAP_STYLE`,
 * `progressMapStyleFor`, `isPlaceLitAt`) zůstávají. `layoutMapScenery`,
 * `layoutMapFootprints` a místo klíče (`goalKey`) se smějí posunout,
 * aby podložkám uhnuly (AC3).
 */

import { layoutMapPlacePads } from '../../../src/games/counting/logic/mapPlacePads';
import type { MapPlacePad, MapPlacePads } from '../../../src/games/counting/logic/mapPlacePads';
import { box, toCss } from '../../shared/viewportFixtures';
import type { Box } from '../../shared/viewportFixtures';
import { arcCases } from './mapPathHelpers';
import type { ArcCase } from './mapPathHelpers';
import { placeName } from './mapLayoutScenes';

/** Mapa v kartě jednoho okna s podložkami. */
export interface PadCase extends ArcCase {
  readonly pads: MapPlacePads;
}

let cachedCases: PadCase[] | undefined;

/** Každé okno mapy × 5 map, mapa v kartě (#145) i s podložkami. */
export function padCases(): PadCase[] {
  cachedCases ??= arcCases().map((arc) => ({
    ...arc,
    pads: layoutMapPlacePads(arc.area, arc.theme, arc.layout),
  }));
  return cachedCases;
}

/** Obdélník podložky v herních jednotkách. */
export function padBox(pad: MapPlacePad): Box {
  return box(pad.x, pad.y, pad.width, pad.height);
}

/** Obdélník podložky v CSS px okna. */
export function padCssBox(testCase: PadCase, pad: MapPlacePad): Box {
  return toCss(padBox(pad), testCase.area);
}

export function padName(step: number): string {
  return `podložka (${placeName(step)})`;
}

/** Podložky případu s krokem místa, ke kterému patří. */
export function padsWithStep(testCase: PadCase): Array<{ pad: MapPlacePad; step: number }> {
  return testCase.pads.pads.map((pad, step) => ({ pad, step }));
}
