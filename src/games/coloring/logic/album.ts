/**
 * Album Omalovánek (#126): hotové obrázky, které dítě vyfotí fotoaparátem
 * v malování. Album je v záznamech hry aktivního profilu z #125
 * (`GameRecords`), jen v zařízení a bez přezdívky.
 *
 * Záznam alba obsahuje jen omalovánku, její verzi a vrstvu barev ve
 * formátu p5 binárně (bajty aritmetického kódu z `colorLayerCode.ts`):
 * `{ layerCode: 'p5', pictureId, pictureVersion, layer }`.
 *
 * Záznamy jsou data z úložiště, kterým hra nevěří (doporučení security
 * k #125). Album při čtení ověří každý záznam: přesně tato pole se
 * správnými typy, omalovánka a verze ze sady, známý formát, bajty
 * v limitu, vrstva přečtená přesně do posledního bajtu a jen barvy sad.
 * Záznam, který neprojde, se v albu nezobrazí, do limitu 12 obrázků se
 * nepočítá a nesmaže se (AC4). Do limitu 24 záznamů se počítá i on (AC2).
 * Čistý TypeScript bez Phaseru.
 */

import type { Tone } from '../../../shared/audio/tonePlayer';
import type { GameRecords, RecordData, RecordsList } from '../../../shared/storage/profileRecords';
import { NO_COLOR } from './coloring';
import { decodeColorLayerBytes, encodeColorLayerBytes } from './colorLayerCode';
import { OUTLINE_REGION } from './regionMap';
import type { RegionMap } from './regionMap';
import type { PictureColors, PictureIdentity } from './savedPicture';
import { ALL_COLOR_COUNT } from './toolColorSets';

/** Nejvíc zobrazitelných obrázků v albu jednoho profilu (otázka 2). */
export const ALBUM_PICTURE_LIMIT = 12;

/** Nejvíc záznamů alba v profilu včetně nečitelných (otázka 3). */
export const ALBUM_RECORD_LIMIT = 24;

/**
 * Nejvíc bajtů vrstvy barev v jednom záznamu (128 KiB). Je to víc, než
 * zabere obrázek, který jde uložit do `localStorage` (50 000 znaků po
 * 15 bitech, asi 94 000 B), a čtení tak nikdy nezpracuje nesmyslně dlouhá data.
 */
export const ALBUM_LAYER_BYTE_LIMIT = 131_072;

/** Cvak fotoaparátu (otázka 7): krátký vysoký dvojtón, dozní za 0,11 s. */
export const CAMERA_CLICK_TONES: readonly Tone[] = [
  { frequencyHz: 1318.5, startSeconds: 0, durationSeconds: 0.04, volume: 0.12 },
  { frequencyHz: 1760, startSeconds: 0.05, durationSeconds: 0.06, volume: 0.12 },
];

/** Formát vrstvy barev v záznamu alba; při změně kódování přibude další. */
const ALBUM_LAYER_CODE = 'p5';

/** Pole záznamu alba; jiná pole záznam nesmí mít. */
const RECORD_FIELDS: readonly string[] = ['layerCode', 'pictureId', 'pictureVersion', 'layer'];

/** Omalovánka sady s obrysem, podle kterého album čte její obrázky. */
export interface AlbumPicture {
  readonly identity: PictureIdentity;
  readonly regions: RegionMap;
}

/** Obrázek v albu. */
export interface AlbumEntry {
  /** Označení záznamu v úložišti. */
  readonly recordId: string;
  /** Omalovánka a verze, ke které obrázek patří. */
  readonly picture: PictureIdentity;
  /** Barvy obrázku po pixelech. */
  readonly colors: PictureColors;
  /** Vrstva barev (index barvy, `NO_COLOR` bez barvy); jen ke čtení. */
  readonly layer: Uint8Array;
}

/** Přečtené album: obrázky od nejnovějšího a počet všech záznamů, nebo „nedostupné“. */
export type AlbumContents =
  | {
      readonly status: 'read';
      readonly entries: readonly AlbumEntry[];
      readonly recordCount: number;
    }
  | { readonly status: 'unavailable' };

export interface ReadAlbumOptions {
  /**
   * Pauza mezi záznamy (scéna čeká na další snímek), aby čtení plného
   * alba nezdrželo vykreslování. Bez ní se čte bez pauzy.
   */
  readonly pause?: () => Promise<void>;
}

/**
 * Záznam alba z vrstvy barev obrázku; `null`, když je vrstva na uložení
 * moc velká.
 */
export function albumRecordOf(
  picture: PictureIdentity,
  regions: RegionMap,
  layer: Uint8Array,
): RecordData | null {
  const bytes = encodeColorLayerBytes(regions, layer);
  if (bytes.length > ALBUM_LAYER_BYTE_LIMIT) {
    return null;
  }
  return {
    layerCode: ALBUM_LAYER_CODE,
    pictureId: picture.id,
    pictureVersion: picture.version,
    layer: bytes,
  };
}

/** Má záznam přesně pole alba (nic navíc, nic nechybí)? */
function hasAlbumFields(data: RecordData): boolean {
  const keys = Object.keys(data);
  return (
    keys.length === RECORD_FIELDS.length && RECORD_FIELDS.every((field) => keys.includes(field))
  );
}

/** Jsou ve vrstvě jen barvy sad nástrojů (#116)? */
function hasOnlyKnownColors(layer: Uint8Array): boolean {
  return layer.every((value) => value === NO_COLOR || value < ALL_COLOR_COUNT);
}

/**
 * Ověří a přečte záznam alba; `null` u záznamu, který není obrázkem
 * alba, je poškozený, nebo patří omalovánce či verzi mimo sadu.
 */
export function readAlbumRecord(
  data: RecordData,
  pictures: readonly AlbumPicture[],
): { readonly picture: AlbumPicture; readonly layer: Uint8Array } | null {
  if (!hasAlbumFields(data)) {
    return null;
  }
  const { layerCode, pictureId, pictureVersion, layer } = data;
  if (
    layerCode !== ALBUM_LAYER_CODE ||
    typeof pictureId !== 'string' ||
    typeof pictureVersion !== 'number' ||
    !(layer instanceof Uint8Array) ||
    layer.length > ALBUM_LAYER_BYTE_LIMIT
  ) {
    return null;
  }
  const picture = pictures.find(
    (each) => each.identity.id === pictureId && each.identity.version === pictureVersion,
  );
  if (picture === undefined) {
    return null;
  }
  const decoded = decodeColorLayerBytes(picture.regions, layer);
  if (decoded === null || !hasOnlyKnownColors(decoded)) {
    return null;
  }
  return { picture, layer: decoded };
}

/** Barvy obrázku nad vrstvou barev. */
export function colorsOfLayer(regions: RegionMap, layer: Uint8Array): PictureColors {
  return {
    colorAt(x, y) {
      const column = Math.floor(x);
      const row = Math.floor(y);
      if (column < 0 || row < 0 || column >= regions.width || row >= regions.height) {
        return null;
      }
      const value = layer[row * regions.width + column] ?? NO_COLOR;
      return value === NO_COLOR ? null : value;
    },
  };
}

/** Obrázek alba z ověřené vrstvy. */
export function albumEntryOf(
  recordId: string,
  picture: AlbumPicture,
  layer: Uint8Array,
): AlbumEntry {
  return {
    recordId,
    picture: picture.identity,
    colors: colorsOfLayer(picture.regions, layer),
    layer,
  };
}

/**
 * Jsou dvě vrstvy omalovánky s obrysem `regions` pixel po pixelu stejné?
 * Pixely obrysu se nepočítají, jejich barvu dává obrys.
 */
export function sameLayers(regions: RegionMap, first: Uint8Array, second: Uint8Array): boolean {
  const { regionIds } = regions;
  for (let index = 0; index < regionIds.length; index += 1) {
    if (regionIds[index] !== OUTLINE_REGION && first[index] !== second[index]) {
      return false;
    }
  }
  return true;
}

/**
 * Záznamy hry podle #125 nikdy neskončí zamítnutým slibem; kdyby přece,
 * je album nedostupné a malování ani výběr se nezaseknou.
 */
async function listRecords(records: GameRecords): Promise<RecordsList> {
  try {
    return await records.list();
  } catch (error) {
    console.warn('Omalovánky: album nejde přečíst', error);
    return { status: 'unavailable' };
  }
}

/**
 * Přečte album ze záznamů aktivního profilu. Bez záznamů nebo při chybě
 * úložiště je album „nedostupné“. Nic nemaže ani nezapisuje.
 */
export async function readAlbum(
  records: GameRecords | undefined,
  pictures: readonly AlbumPicture[],
  options: ReadAlbumOptions = {},
): Promise<AlbumContents> {
  if (records === undefined) {
    return { status: 'unavailable' };
  }
  const listed = await listRecords(records);
  if (listed.status !== 'read') {
    return { status: 'unavailable' };
  }
  const entries: AlbumEntry[] = [];
  for (const record of listed.records) {
    const read = readAlbumRecord(record.data, pictures);
    if (read !== null) {
      entries.push(albumEntryOf(record.id, read.picture, read.layer));
    }
    await options.pause?.();
  }
  // Záznamy jsou v pořadí uložení, album ukazuje od nejnovějšího.
  entries.reverse();
  return { status: 'read', entries, recordCount: listed.records.length };
}

/** Jak skončilo smazání obrázku z alba (#129 AC3, AC4). */
export type AlbumRemoval = 'removed' | 'failed';

/**
 * Smaže z alba aktivního profilu jeden obrázek (záznam `recordId`, #129
 * AC3). Úložiště smaže záznam celý najednou, nic jiného se nepřepíše ani
 * nezapíše. Záznam, který už v albu není (smazala ho jiná záložka), je
 * smazaný. Plné nebo nedostupné úložiště, chyba úložiště i chybějící
 * záznamy skončí „nepovedlo se“; výjimku mazání nikdy nevyhodí (AC4).
 */
export async function removeAlbumEntry(
  records: GameRecords | undefined,
  recordId: string,
): Promise<AlbumRemoval> {
  if (records === undefined) {
    return 'failed';
  }
  try {
    return (await records.remove(recordId)) === 'saved' ? 'removed' : 'failed';
  } catch (error) {
    console.warn('Omalovánky: obrázek z alba nejde smazat', error);
    return 'failed';
  }
}
