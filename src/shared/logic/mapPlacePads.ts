/**
 * Podložky zastávek na mapě postupu (#147, třetí část varianty D): pod
 * každým ze 4 míst (start, 2 zastávky, cíl) leží podložka podle tématu
 * mapy, aby místa vypadala jako součást krajiny: v lese pařez
 * s letokruhy, na ostrově písečný kopeček, na hradě kamenná dlaždice,
 * v podmoří kámen s řasou a ve vesmíru planetka. Podložka má střed ve
 * středu místa a je o něco větší než kruh místa (1,3–1,5× jeho průměru,
 * v těsném okně telefonu nejméně 1,2×). Nezávisí na kroku značky, na
 * rozsvícení ani na staženém obrázku (kreslí se i v zástupném vzhledu).
 * Rozsvícení dál ukazuje jen kruh místa. Čistý TypeScript bez Phaseru,
 * kreslí scéna.
 */

import type { MapLook } from './mapPictureLoading';
import { MAP_STEPS } from './progressMap';
import type { MapThemeId } from './progressMap';
import { layoutProgressMap, mapContentBox } from './progressMapLayout';
import type { MapArea, MapRect, ProgressMapLayout } from './progressMapLayout';
import { MAP_PLACE_PAD_COLORS } from './mapTheme';

/** Druh podložky: pařez, písečný kopeček, kamenná dlaždice, kámen s řasou, planetka. */
export type PlacePadKind = 'stump' | 'sandMound' | 'stoneTile' | 'seaweedRock' | 'planetoid';

/** Druh podložek každé mapy (AC1); žádný druh není na dvou mapách. */
export const MAP_PLACE_PAD_KINDS: Readonly<Record<MapThemeId, PlacePadKind>> = {
  forest: 'stump',
  island: 'sandMound',
  castle: 'stoneTile',
  underwater: 'seaweedRock',
  space: 'planetoid',
};

/** Podložka jednoho místa: střed (ve středu místa) a vnější rozměr celé kresby. */
export type MapPlacePad = MapRect;

/** Podložky všech míst mapy; index je krok (0 start … `MAP_STEPS` cíl). */
export interface MapPlacePads {
  readonly kind: PlacePadKind;
  readonly pads: readonly MapPlacePad[];
}

/**
 * Vnější rozměr podložky jako násobek průměru místa: šířka a výška.
 * Všechny tvary se vejdou do čtverce (pařez i s kořeny, kopeček i s vrškem
 * a kamínky, kámen i s řasou, planetka i s prstencem).
 * Největší rozměr nepřesáhne `PROGRESS_MAP_SHAPE.placePadMaxShare` (AC2: 1,5×).
 */
const PAD_SHARES: Readonly<Record<PlacePadKind, { width: number; height: number }>> = {
  stump: { width: 1.5, height: 1.5 },
  sandMound: { width: 1.5, height: 1.5 },
  stoneTile: { width: 1.46, height: 1.46 },
  seaweedRock: { width: 1.5, height: 1.5 },
  planetoid: { width: 1.5, height: 1.5 },
};

/**
 * O kolik se podložky zmenší, když se celé nevejdou (AC2): nejmenší krok
 * dá nejkratší stranu aspoň 1,2× průměru místa.
 */
const PAD_SHRINK_TRIES = [1, 0.96, 0.92, 0.88, 0.85];

/**
 * Podložky míst mapy `theme` v ploše `area`. Podložky mají plnou velikost
 * podle druhu; jen když by se dvě překryly, zasáhly do slavícího cíle
 * jiného místa nebo vyčnívaly z plochy mapy, zmenší se (nejméně na 1,2×).
 * Krajní případ, kdy se nevejdou ani zmenšené na 0,85, hlídají testy AC2
 * a AC3 (`mapPlacePads.test.ts`, `mapPlacePadsLayout.test.ts`).
 */
export function layoutMapPlacePads(
  area: MapArea,
  theme: MapThemeId,
  map: ProgressMapLayout = layoutProgressMap(area, theme),
): MapPlacePads {
  const kind = MAP_PLACE_PAD_KINDS[theme];
  const padsFor = (shrink: number): MapPlacePad[] => {
    const { width, height } = PAD_SHARES[kind];
    return map.places.map((place) => ({
      x: place.x,
      y: place.y,
      width: map.placeSize * width * shrink,
      height: map.placeSize * height * shrink,
    }));
  };
  const fitting = PAD_SHRINK_TRIES.map(padsFor).find((pads) => padsFit(area, map, pads));
  const smallest = PAD_SHRINK_TRIES[PAD_SHRINK_TRIES.length - 1] ?? 1;
  return { kind, pads: fitting ?? padsFor(smallest) };
}

/** Nepřekrývají se podložky navzájem ani s cizím slavícím cílem a jsou celé v ploše mapy? */
function padsFit(area: MapArea, map: ProgressMapLayout, pads: readonly MapPlacePad[]): boolean {
  const content = mapContentBox(area);
  const celebration: MapRect = {
    x: map.goalCelebration.x,
    y: map.goalCelebration.y,
    width: map.goalCelebration.size,
    height: map.goalCelebration.size,
  };
  return pads.every((pad, step) => {
    const inside =
      pad.x - pad.width / 2 >= content.left &&
      pad.x + pad.width / 2 <= content.left + content.width &&
      pad.y - pad.height / 2 >= content.top &&
      pad.y + pad.height / 2 <= content.top + content.height;
    // Podložka cíle leží pod jeho symbolem i pod slavícím cílem (upřesnění 1).
    const hitsCelebration = step !== MAP_STEPS && rectsOverlap(pad, celebration);
    const hitsPad = pads.some((other, index) => index !== step && rectsOverlap(pad, other));
    return inside && !hitsCelebration && !hitsPad;
  });
}

function rectsOverlap(first: MapRect, second: MapRect): boolean {
  return (
    Math.abs(first.x - second.x) < (first.width + second.width) / 2 &&
    Math.abs(first.y - second.y) < (first.height + second.height) / 2
  );
}

/** Barva plochy podložky, na které leží kruh místa, a jejího okraje (`#RRGGBB`). */
export interface PlacePadLook {
  readonly fillColor: string;
  readonly outlineColor: string;
}

/**
 * Barvy podložek mapy (AC5): okraj má kontrast aspoň 3 : 1 vůči obrázku
 * i zástupné barvě, plocha vůči okraji zhasnutého místa i výplni
 * rozsvíceného. Ve vesmíru je na tmavém obrázku planetka tmavá s bílým
 * okrajem (upřesnění 2), bez obrázku světlá. S rozsvícením se nemění.
 */
export function mapPlacePadStyleFor(theme: MapThemeId, look: MapLook): PlacePadLook {
  const colors = MAP_PLACE_PAD_COLORS[theme];
  return look === 'picture' ? colors.picture : colors.placeholder;
}
