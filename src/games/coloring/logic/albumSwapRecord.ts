/**
 * Odložená výměna stránky a obrázku z alba (#131) v úložišti hry profilu.
 * Výměna nejdřív odloží rozmalovanou stránku P (i „čistou“) spolu
 * s obrázkem A z alba, a teprve pak mění stránku a album. Když se stránka
 * zavře uprostřed, další otevření Omalovánek podle záznamu výměnu dokončí
 * nebo vrátí (`albumSwap.ts`).
 *
 * Záznam je JSON pod klíčem `albumSwap`: omalovánka a verze, záznam
 * stránky P (`null` u stránky bez záznamu), vrstva barev A ve formátu p5,
 * jestli P přibude do alba a jestli je A z alba už jistě pryč. Smazaný
 * záznam je prázdný text (úložiště hry neumí mazat). Poškozený záznam je
 * jako žádný. Čistý TypeScript bez Phaseru.
 */

import { setItemChecked } from '../../../shared/storage/keyValueStorage';
import type { KeyValueStorage } from '../../../shared/storage/keyValueStorage';
import { sameLayers } from './album';
import { CURRENT_LAYER_CODE, decodeColorLayer } from './colorLayerCode';
import type { RegionMap } from './regionMap';
import type { PictureIdentity } from './savedPicture';

/** Klíč odložené výměny v úložišti hry; profil a hru doplní úložiště profilu. */
export const ALBUM_SWAP_KEY = 'albumSwap';

/** Označení formátu záznamu; při změně tvaru se zvýší. */
const SWAP_FORMAT = 'swap1';

export interface PendingSwap {
  readonly pictureId: string;
  readonly pictureVersion: number;
  /** Záznam stránky P před výměnou; `null`, když stránka žádný neměla (čistá). */
  readonly page: string | null;
  /** Vrstva barev obrázku A ve formátu p5 (`encodeColorLayer`). */
  readonly albumLayer: string;
  /** Přibude P do alba (rozmalovaná a v albu není stejný obrázek)? */
  readonly addsPage: boolean;
  /** Je A z alba jistě smazaný (výměna se už jen dokončí)? */
  readonly albumRemoved: boolean;
}

/**
 * Nejdelší text odložené výměny: stránka P (nejvýš limit stránky) a obrázek
 * A (nejvýš limit vrstvy alba jako text) s rezervou. Delší záznam je
 * poškozený a čte se jako žádný, bez zbytečného rozboru.
 */
const PENDING_SWAP_TEXT_LIMIT = 400_000;

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    // Poškozený záznam je jako žádný.
    return undefined;
  }
}

function isPendingSwap(value: unknown): value is PendingSwap & { readonly format: string } {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    record.format === SWAP_FORMAT &&
    typeof record.pictureId === 'string' &&
    typeof record.pictureVersion === 'number' &&
    (record.page === null || typeof record.page === 'string') &&
    typeof record.albumLayer === 'string' &&
    typeof record.addsPage === 'boolean' &&
    typeof record.albumRemoved === 'boolean'
  );
}

/** Odložená výměna profilu; `null` bez ní, u poškozeného záznamu a když úložiště nejde číst. */
export function readPendingSwap(storage: KeyValueStorage): PendingSwap | null {
  let text: string | null;
  try {
    text = storage.getItem(ALBUM_SWAP_KEY);
  } catch (error) {
    console.warn('Omalovánky: odloženou výměnu nejde přečíst', error);
    return null;
  }
  if (text === null || text === '' || text.length > PENDING_SWAP_TEXT_LIMIT) {
    return null;
  }
  const value = parseJson(text);
  if (!isPendingSwap(value)) {
    return null;
  }
  return {
    pictureId: value.pictureId,
    pictureVersion: value.pictureVersion,
    page: value.page,
    albumLayer: value.albumLayer,
    addsPage: value.addsPage,
    albumRemoved: value.albumRemoved,
  };
}

/** Uloží odloženou výměnu; `true`, jen když je opravdu v zařízení. */
export function storePendingSwap(storage: KeyValueStorage, swap: PendingSwap): boolean {
  return setItemChecked(storage, ALBUM_SWAP_KEY, JSON.stringify({ format: SWAP_FORMAT, ...swap }));
}

/** Smaže odloženou výměnu; `true`, když se smazání uložilo. */
export function clearPendingSwap(storage: KeyValueStorage): boolean {
  return setItemChecked(storage, ALBUM_SWAP_KEY, '');
}

/**
 * Kolik obrázků odložená výměna do alba ještě přidá (#131 AC2): odložená
 * P, která do alba přibude, se počítá do limitu 12 obrázků, aby pro ni
 * zůstalo místo. Počítá se vědomě i před `albumRemoved` (výměna ještě
 * běží, nebo se záznam „A je pryč“ nepodařilo zapsat): fotoaparát tak
 * nikdy nezabere místo, které P potřebuje. Nejhůř se zhoupne o jeden
 * obrázek dřív, než další otevření Omalovánek výměnu dokončí nebo vrátí.
 */
export function pendingAlbumPictures(storage: KeyValueStorage): number {
  return readPendingSwap(storage)?.addsPage === true ? 1 : 0;
}

/**
 * Je `layer` obrázek A odložené výměny omalovánky `picture`, o kterém se
 * ještě neví, že z alba zmizel (#131)? Fotoaparát takový obrázek do alba
 * neuloží: vrácení výměny by ho po obnovení vzalo za A před výměnou.
 */
export function isUnsettledSwapPicture(
  storage: KeyValueStorage,
  picture: PictureIdentity,
  regions: RegionMap,
  layer: Uint8Array,
): boolean {
  const swap = readPendingSwap(storage);
  if (
    swap === null ||
    swap.albumRemoved ||
    swap.pictureId !== picture.id ||
    swap.pictureVersion !== picture.version
  ) {
    return false;
  }
  const albumLayer = decodeColorLayer(regions, swap.albumLayer, CURRENT_LAYER_CODE);
  return albumLayer !== null && sameLayers(regions, albumLayer, layer);
}
