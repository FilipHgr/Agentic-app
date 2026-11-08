/**
 * Pomůcky pro testy ukládání Omalovánek (#92). Jedno „otevření hry“ je
 * `openColoring(…)` nad úložištěm hry aktivního profilu
 * (`store.gameStorage(COLORING_META.id)`), jedno „obnovení stránky“ je nové
 * `openProfiles(storage)` nad stejným úložištěm zařízení, jako v testech
 * mapy v Počítání (`tests/games/counting/progressMapProfiles.test.ts`).
 * Odchod domečkem, schování a zavření stránky hlásí scéna jako `suspend()`.
 */

import { openColoring } from '../../../src/games/coloring/logic/savedPicture';
import type {
  PictureIdentity,
  SavedColoring,
} from '../../../src/games/coloring/logic/savedPicture';
import type { RegionMap } from '../../../src/games/coloring/logic/regionMap';
import { COLORING_META } from '../../../src/games/coloring/meta';
import type { KeyValueStorage } from '../../../src/shared/storage/keyValueStorage';
import type { ProfileStore } from '../../../src/shared/storage/profileStorage';
import { LEGACY_P3_STORAGE } from './legacyP3RecordFixture';
import { drawing } from './outlineFixtures';
import type { Point } from './outlineFixtures';

/** Testovací omalovánka a její verze. */
export const PICTURE: PictureIdentity = { id: 'house', version: 1 };

/**
 * Zkušební obrázek 300 × 200 (W = 10 px): svislá čára x 150 a 151 dělí
 * plochu na oblast A vlevo a oblast B vpravo.
 */
export function twoHalves(): RegionMap {
  return drawing().verticalLine(150).regions();
}

/** Dítě otevře Omalovánky nad úložištěm `storage`. */
export function openOn(
  storage: KeyValueStorage | undefined,
  regions: RegionMap,
  picture: PictureIdentity = PICTURE,
): SavedColoring {
  return openColoring({ regions, picture, storage });
}

/** Dítě ťukne v menu na Omalovánky za aktivní profil. */
export function enterColoring(store: ProfileStore, regions: RegionMap): SavedColoring {
  return openOn(store.gameStorage(COLORING_META.id), regions);
}

/** Celý tah jedním prstem barvou vybranou v paletě: dotyk, pohyb, zvednutí. */
export function paint(game: SavedColoring, path: readonly Point[], id = 1): void {
  startStroke(game, path, id);
  game.pointerUp(id);
}

/** Tah, při kterém prst zůstane na ploše (nezvedne se). */
export function startStroke(game: SavedColoring, path: readonly Point[], id = 1): void {
  const [first, ...rest] = path;
  if (first === undefined) {
    return;
  }
  game.pointerDown({ id, x: first.x, y: first.y, kind: 'touch' });
  for (const point of rest) {
    game.pointerMove({ id, x: point.x, y: point.y, kind: 'touch' });
  }
}

/** Barvy všech pixelů po řádcích, aby šly dva obrázky porovnat pixel po pixelu. */
export function pixelsOf(
  game: { colorAt(x: number, y: number): number | null },
  regions: RegionMap,
): Array<number | null> {
  const colors: Array<number | null> = [];
  for (let y = 0; y < regions.height; y += 1) {
    for (let x = 0; x < regions.width; x += 1) {
      colors.push(game.colorAt(x, y));
    }
  }
  return colors;
}

/** Kolik pixelů je zabarvených. */
export function paintedPixels(
  game: { colorAt(x: number, y: number): number | null },
  regions: RegionMap,
): number {
  return pixelsOf(game, regions).filter((color) => color !== null).length;
}

/** Úložiště v paměti, které si pamatuje, co kdy dostalo, a umí selhat. */
export class RecordingStorage implements KeyValueStorage {
  readonly data = new Map<string, string>();
  failWrites = false;
  failReads = false;

  getItem(key: string): string | null {
    if (this.failReads) {
      throw new Error('úložiště nejde číst');
    }
    return this.data.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.failWrites) {
      throw new Error('úložiště je plné');
    }
    this.data.set(key, value);
  }

  /** Klíče, které hra zapsala. */
  keys(): string[] {
    return [...this.data.keys()];
  }

  /** Přepíše všechny zapsané záznamy textem z `change`. */
  rewriteAll(change: (value: string) => string): void {
    for (const [key, value] of this.data) {
      this.data.set(key, change(value));
    }
  }
}

/**
 * Klíče, které hra zapisovala před #110 (obrázek, nedávné barvy, velikost
 * čáry a záznam o prvním otevření), převzaté z pevného úložiště
 * `LEGACY_P3_STORAGE`. Záznam barev nástrojů z #110 mezi nimi není.
 */
const KEYS_BEFORE_110: ReadonlySet<string> = new Set(LEGACY_P3_STORAGE.map(([key]) => key));

/**
 * Nechá v úložišti jen záznamy, které uměla hra před #110, aby úložiště
 * vypadalo jako od staré verze (bez záznamu barev nástrojů, #110 AC6).
 * Testy tak nemusí znát klíč nového záznamu.
 */
export function keepOnlyRecordsBefore110(storage: RecordingStorage): void {
  for (const key of storage.keys()) {
    if (!KEYS_BEFORE_110.has(key)) {
      storage.data.delete(key);
    }
  }
}

/**
 * Klíče záznamů, které přibyly od #110 (v úložišti jsou, ale stará verze
 * je nezapisovala). Testy tak najdou záznam barev nástrojů bez znalosti
 * jeho klíče a tvaru.
 */
export function keysAddedBy110(storage: RecordingStorage): string[] {
  return storage.keys().filter((key) => !KEYS_BEFORE_110.has(key));
}
