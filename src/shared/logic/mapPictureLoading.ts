/**
 * Stahování obrázků map postupu (#134 AC4, otevřená otázka 4). Během
 * hraní se na pozadí stáhne jen obrázek mapy, na které dítě je,
 * v orientaci okna (`prepare`). Když se mapa ukáže, rozhodne se jednou,
 * jestli má obrázek, nebo zástupný vzhled, a v tomto ukázání se už
 * nevymění, ani když se obrázek mezitím stáhne. Po výpadku se obrázek
 * zkusí stáhnout znovu při dalším `prepare`, nejpozději s dalším ukázáním.
 * Samotné stahování dodá scéna (Phaser loader), tady se jen rozhoduje.
 * Čistý TypeScript bez Phaseru.
 */

import type { MapOrientation } from './mapPictures';
import type { MapThemeId } from './progressMap';

export interface MapPictureId {
  readonly theme: MapThemeId;
  readonly orientation: MapOrientation;
}

export type MapPictureStatus = 'notStarted' | 'loading' | 'ready' | 'failed';

/** Obrázek prostředí, nebo zástupná barva pozadí z #133 AC6. */
export type MapLook = 'picture' | 'placeholder';

/** Stáhne obrázek; slib se splní po stažení, nebo odmítne po chybě. */
export type LoadMapPicture = (picture: MapPictureId) => Promise<void>;

export interface MapPictureLoading {
  /** Stav stažení obrázku. */
  status(picture: MapPictureId): MapPictureStatus;
  /** Hraje se mapa `picture.theme`: začne stahovat, když obrázek není stažený a nestahuje se. */
  prepare(picture: MapPictureId): void;
  /** Mapa se ukázala: vzhled pro toto ukázání; nestažený obrázek začne stahovat. */
  mapShown(picture: MapPictureId): MapLook;
  /** Zařízení se během zobrazení otočilo: vzhled pro novou orientaci. */
  orientationChanged(picture: MapPictureId): MapLook;
  /** Mapa zmizela; příští ukázání rozhodne o vzhledu znovu. */
  mapHidden(): void;
  /** Vzhled ukázané mapy, `null`, když mapa není vidět. */
  shownLook(): MapLook | null;
}

function keyOf(picture: MapPictureId): string {
  return `${picture.theme}-${picture.orientation}`;
}

export function createMapPictureLoading(load: LoadMapPicture): MapPictureLoading {
  const statuses = new Map<string, MapPictureStatus>();
  /** Vzhled podle orientace, který dítě v tomto ukázání už vidělo; `null` bez mapy. */
  let seenLooks: Map<MapOrientation, MapLook> | null = null;
  let currentLook: MapLook | null = null;

  const status = (picture: MapPictureId): MapPictureStatus =>
    statuses.get(keyOf(picture)) ?? 'notStarted';

  const settle = (picture: MapPictureId, result: MapPictureStatus): void => {
    statuses.set(keyOf(picture), result);
  };

  function prepare(picture: MapPictureId): void {
    const current = status(picture);
    if (current === 'loading' || current === 'ready') {
      return;
    }
    settle(picture, 'loading');
    let loading: Promise<void>;
    try {
      loading = load(picture);
    } catch {
      // Dítě chybu nevidí: obrázek se bere jako nestažený a zkusí se znovu.
      settle(picture, 'failed');
      return;
    }
    loading.then(
      () => settle(picture, 'ready'),
      () => settle(picture, 'failed'),
    );
  }

  /** Vzhled pro orientaci obrázku: jednou rozhodnutý v ukázání zůstane. */
  function lookFor(picture: MapPictureId): MapLook {
    const seen = seenLooks?.get(picture.orientation);
    if (seen !== undefined) {
      return seen;
    }
    const look: MapLook = status(picture) === 'ready' ? 'picture' : 'placeholder';
    prepare(picture);
    seenLooks?.set(picture.orientation, look);
    return look;
  }

  return {
    status,
    prepare,
    mapShown: (picture) => {
      seenLooks = new Map();
      currentLook = lookFor(picture);
      return currentLook;
    },
    orientationChanged: (picture) => {
      currentLook = lookFor(picture);
      return currentLook;
    },
    mapHidden: () => {
      seenLooks = null;
      currentLook = null;
    },
    shownLook: () => currentLook,
  };
}
