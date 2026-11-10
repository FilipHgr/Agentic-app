/**
 * Obrázky na dlaždicích her (#122): rozhodne, jestli dlaždice ukáže
 * obrázek hry, nebo dnešní symbol, podle toho, co se opravdu načetlo.
 * Phaser při chybějící textuře kreslí zástupný obrázek, proto obrázek
 * dostane jen dlaždice, jejíž obrázek scéna ohlásila jako načtený.
 *
 * Objekt žije po celou dobu stránky (ne ve scéně): obrázky se načítají
 * jen při prvním zobrazení menu a po návratu z hry se nic nenačítá znovu,
 * ani obrázek, který napoprvé selhal.
 *
 * Menu čeká na obrázky nejdéle `TILE_IMAGE_WAIT_MS` od začátku prvního
 * zobrazení. Obrázek, který do té doby nepřišel, zůstane nenačtený
 * a dlaždice ukáže symbol, i když obrázek dorazí později.
 *
 * Čistý TypeScript bez Phaseru, čas předává volající.
 */

/** Nejdelší čekání na obrázky dlaždic před ukázáním menu. */
export const TILE_IMAGE_WAIT_MS = 3000;

/** Hra v menu: id a nepovinná adresa obrázku dlaždice (z `meta.ts`). */
export interface TileImageGame {
  readonly id: string;
  readonly tile?: string;
}

/** Obrázek, který má scéna načíst. */
export interface TileImageRequest {
  readonly gameId: string;
  readonly url: string;
}

/** Co dlaždice ukáže: obrázek hry, nebo symbol. */
export type TileFace = 'image' | 'symbol';

export interface TileImages {
  /**
   * Menu se začíná ukazovat. Vrátí obrázky, které má scéna teď načíst,
   * jen ty, které se ještě nikdy nenačítaly.
   */
  startShowing(nowMs: number): TileImageRequest[];
  /** Obrázek hry se načetl (`true`), nebo skončil chybou (`false`). */
  settle(gameId: string, loaded: boolean, nowMs: number): void;
  /** Smí se menu ukázat: všechno vyřízené, nebo uplynul limit čekání. */
  isReady(nowMs: number): boolean;
  /** Obrázek, nebo symbol pro dlaždici hry. */
  faceOf(gameId: string): TileFace;
}

/** Stav obrázku jedné hry. */
type ImageState = 'waiting' | 'loading' | 'loaded' | 'missing';

interface TrackedImage {
  readonly url: string;
  state: ImageState;
}

export function createTileImages(games: readonly TileImageGame[]): TileImages {
  const images = new Map<string, TrackedImage>();
  for (const game of games) {
    if (typeof game.tile === 'string' && game.tile !== '') {
      images.set(game.id, { url: game.tile, state: 'waiting' });
    }
  }
  /** Začátek prvního zobrazení menu; od něj se měří limit čekání. */
  let startedAtMs: number | null = null;

  const isLate = (nowMs: number): boolean =>
    startedAtMs !== null && nowMs - startedAtMs >= TILE_IMAGE_WAIT_MS;

  return {
    startShowing(nowMs) {
      if (startedAtMs === null) {
        startedAtMs = nowMs;
      }
      const requests: TileImageRequest[] = [];
      for (const [gameId, image] of images) {
        if (image.state === 'waiting') {
          image.state = 'loading';
          requests.push({ gameId, url: image.url });
        }
      }
      return requests;
    },

    settle(gameId, loaded, nowMs) {
      const image = images.get(gameId);
      if (image === undefined || image.state !== 'loading') {
        return;
      }
      // Obrázek po limitu už menu nečeká: dlaždice zůstane u symbolu.
      image.state = loaded && !isLate(nowMs) ? 'loaded' : 'missing';
    },

    isReady(nowMs) {
      if (isLate(nowMs)) {
        return true;
      }
      return [...images.values()].every((image) => image.state !== 'loading');
    },

    faceOf(gameId) {
      return images.get(gameId)?.state === 'loaded' ? 'image' : 'symbol';
    },
  };
}
