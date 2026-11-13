/**
 * Přesun rozmalované stránky do alba (#141): po odchodu z malování
 * a při otevření Omalovánek jde každý rozmalovaný obrázek do alba
 * aktivního profilu a stránka omalovánky je zase čistá.
 *
 * Pravidla pro jednu stránku (`movePageToAlbum`):
 * - Stránka bez záznamu, nečitelná nebo bez jediné barvy se nemění
 *   a do alba nic nepřibude (AC2).
 * - Stránka s odloženou výměnou z #131, která se může vrátit, nebo
 *   s obrázkem A nedořešené výměny se přeskočí; rozhodne o ní nejdřív
 *   `settleAlbumSwap`.
 * - Stránka pixel po pixelu stejná jako obrázek té omalovánky v albu se
 *   jen vyčistí, i v plném albu (AC2).
 * - Jinak se obrázek uloží do alba jako nejnovější, když je v albu místo
 *   (jako u fotoaparátu: obrázky a odložená stránka z #131 pod 12,
 *   záznamy pod 24). Stránka se vyčistí až po potvrzeném uložení,
 *   takže obrázek je v každém okamžiku na stránce, v albu, nebo na obou
 *   místech (AC4). Po obnovení stránky na obou místech ji další otevření
 *   vyčistí jako stránku stejnou s obrázkem v albu.
 * - Plné nebo nedostupné album a nepovedený zápis stránku nechají beze
 *   změny (AC5).
 *
 * Čištění stránky přepíše jen stránku, která pořád ukazuje přesunutý
 * obrázek, a nechá v ní naposledy vybranou barvu. Barvy nástrojů, nedávné
 * barvy a tloušťka čáry jsou v samostatných záznamech a nemění se.
 * Nic se nemaže: nečitelné záznamy stránek ani alba zůstanou, jak byly.
 * Čistý TypeScript bez Phaseru.
 */

import { setItemChecked } from '../../../shared/storage/keyValueStorage';
import type { KeyValueStorage } from '../../../shared/storage/keyValueStorage';
import type { GameRecords, RecordData, RecordsAdd } from '../../../shared/storage/profileRecords';
import {
  ALBUM_PICTURE_LIMIT,
  ALBUM_RECORD_LIMIT,
  albumEntryOf,
  albumRecordOf,
  colorsOfLayer,
  readAlbum,
  sameLayers,
} from './album';
import type { AlbumEntry, AlbumPicture } from './album';
import { swapBlocksPicture } from './albumSwap';
import { isUnsettledSwapPicture, pendingAlbumPictures } from './albumSwapRecord';
import { NO_COLOR, emptyColorLayer } from './coloring';
import { pageKeyOf, pageRecordOf, readStoredPage } from './savedPicture';
import type { PictureColors, PictureIdentity } from './savedPicture';

/** Jak dopadla rozmalovaná stránka jedné omalovánky. */
export type PageMoveResult =
  /** Obrázek přibyl do alba jako nejnovější. */
  | 'added'
  /** Stejný obrázek té omalovánky už v albu je, nic nepřibylo. */
  | 'alreadyInAlbum'
  /** Do alba se nevešel nebo nešel uložit, stránka zůstala beze změny. */
  | 'kept';

/** Rozmalovaná stránka, kterou přesun zkusil přesunout do alba. */
export interface PageMove {
  readonly picture: PictureIdentity;
  readonly result: PageMoveResult;
  /** Je stránka teď čistá (obrázek je v albu)? */
  readonly pageCleared: boolean;
  /** Barvy obrázku, který byl na stránce (scéna z nich kreslí odlet do knihy). */
  readonly colors: PictureColors;
}

export interface PageMoveOptions {
  /** Úložiště hry aktivního profilu s rozmalovanými stránkami. */
  readonly storage: KeyValueStorage | undefined;
  /** Záznamy alba aktivního profilu; dočasný profil je nemá. */
  readonly records: GameRecords | undefined;
  /** Omalovánky sady s obrysem v pořadí sady. */
  readonly pictures: readonly AlbumPicture[];
  /**
   * Maluje se právě v omalovánce (malování je vidět)? Její stránku přesun
   * nechá beze změny (`kept`); přesune ji odchod z malování.
   */
  readonly isOpen?: (picture: PictureIdentity) => boolean;
  /** Přesun začal zpracovávat stránku omalovánky. */
  readonly onPictureStart?: (picture: PictureIdentity) => void;
  /** Stránka omalovánky je vyřízená (přesunutá, ponechaná, nebo nebyla co přesouvat). */
  readonly onPictureDone?: (picture: PictureIdentity) => void;
}

/** Album, jak ho přesun zná: přečtené na začátku a doplněné o každý přidaný obrázek. */
export interface MovingAlbum {
  entries: AlbumEntry[];
  recordCount: number;
  /** Nepovedl se zápis do alba? Další obrázky se pak už neukládají, jen čistí stejné. */
  addFailed: boolean;
}

function sameIdentity(first: PictureIdentity, second: PictureIdentity): boolean {
  return first.id === second.id && first.version === second.version;
}

function isCleanLayer(layer: Uint8Array): boolean {
  return layer.every((value) => value === NO_COLOR);
}

/** Je v albu obrázek omalovánky `picture` pixel po pixelu stejný jako `layer`? */
function albumHas(album: MovingAlbum, picture: AlbumPicture, layer: Uint8Array): boolean {
  return album.entries.some(
    (entry) =>
      sameIdentity(entry.picture, picture.identity) &&
      sameLayers(picture.regions, entry.layer, layer),
  );
}

/** Je album plné jako u fotoaparátu (odložená stránka z #131 se počítá)? */
function albumIsFull(storage: KeyValueStorage, album: MovingAlbum): boolean {
  const pictureCount = album.entries.length + pendingAlbumPictures(storage);
  return pictureCount >= ALBUM_PICTURE_LIMIT || album.recordCount >= ALBUM_RECORD_LIMIT;
}

/**
 * Zapíše záznam alba. Záznamy hry podle #125 nikdy neskončí zamítnutým
 * slibem; kdyby přece, je to jako „nedostupné“.
 */
async function addRecord(records: GameRecords, data: RecordData): Promise<RecordsAdd> {
  try {
    return await records.add(data);
  } catch (error) {
    console.warn('Omalovánky: obrázek nejde přesunout do alba', error);
    return { status: 'unavailable' };
  }
}

/**
 * Vyčistí stránku, jen když pořád ukazuje obrázek `layer` (mezitím ji
 * nic nepřepsalo). Naposledy vybraná barva zůstane. Vrátí, jestli je
 * stránka teď čistá.
 */
function clearPage(storage: KeyValueStorage, picture: AlbumPicture, layer: Uint8Array): boolean {
  const page = readStoredPage(storage, picture.identity, picture.regions);
  if (page.kind !== 'painted' || !sameLayers(picture.regions, page.layer, layer)) {
    return page.kind === 'clean' || (page.kind === 'painted' && isCleanLayer(page.layer));
  }
  const cleanRecord = pageRecordOf(
    picture.identity,
    picture.regions,
    emptyColorLayer(picture.regions),
    page.selectedColor,
  );
  if (cleanRecord === null) {
    // Čistý záznam nejde zapsat: stránka zůstane, aby se neztratila vybraná barva.
    return false;
  }
  return setItemChecked(storage, pageKeyOf(picture.identity), cleanRecord);
}

/**
 * Přesune rozmalovanou stránku omalovánky `picture` do alba (pravidla
 * v popisu souboru). Vrátí `null`, když na stránce není co přesouvat.
 * `album` se po přidání obrázku doplní.
 */
export async function movePageToAlbum(options: {
  readonly storage: KeyValueStorage;
  readonly records: GameRecords;
  readonly picture: AlbumPicture;
  readonly album: MovingAlbum;
}): Promise<PageMove | null> {
  const { storage, records, picture, album } = options;
  const page = readStoredPage(storage, picture.identity, picture.regions);
  if (page.kind !== 'painted' || isCleanLayer(page.layer)) {
    return null;
  }
  const layer = page.layer;
  const move = (result: PageMoveResult, pageCleared: boolean): PageMove => ({
    picture: picture.identity,
    result,
    pageCleared,
    colors: colorsOfLayer(picture.regions, layer),
  });
  if (
    swapBlocksPicture(storage, picture, false) ||
    isUnsettledSwapPicture(storage, picture.identity, picture.regions, layer)
  ) {
    // Výměnu z #131 nejdřív dořeší další otevření Omalovánek.
    return move('kept', false);
  }
  if (albumHas(album, picture, layer)) {
    return move('alreadyInAlbum', clearPage(storage, picture, layer));
  }
  const data = albumRecordOf(picture.identity, picture.regions, layer);
  if (album.addFailed || data === null || albumIsFull(storage, album)) {
    return move('kept', false);
  }
  const added = await addRecord(records, data);
  if (added.status !== 'saved') {
    album.addFailed = true;
    return move('kept', false);
  }
  album.entries.unshift(albumEntryOf(added.id, picture, layer));
  album.recordCount += 1;
  return move('added', clearPage(storage, picture, layer));
}

/**
 * Přesune všechny rozmalované stránky omalovánek `pictures` do alba
 * v pořadí sady, dokud je v albu místo; stránky stejné s obrázkem v albu
 * vyčistí i potom. Když album nejde přečíst, nic nezmění. Nikdy nevyhodí
 * výjimku. Vrátí stránky, které zkusil přesunout.
 */
export async function movePagesToAlbum(options: PageMoveOptions): Promise<PageMove[]> {
  try {
    return await moveSteps(options);
  } catch (error) {
    // Nečekaná chyba: co se nepřesunulo, zůstalo na stránce a zkusí se příště.
    console.warn('Omalovánky: rozmalované obrázky nejde přesunout do alba', error);
    return [];
  }
}

/** Rozmalovaná stránka otevřené omalovánky zůstane beze změny; `null` bez barev. */
function keptOpenPage(storage: KeyValueStorage, picture: AlbumPicture): PageMove | null {
  const page = readStoredPage(storage, picture.identity, picture.regions);
  if (page.kind !== 'painted' || isCleanLayer(page.layer)) {
    return null;
  }
  return {
    picture: picture.identity,
    result: 'kept',
    pageCleared: false,
    colors: colorsOfLayer(picture.regions, page.layer),
  };
}

async function moveSteps(options: PageMoveOptions): Promise<PageMove[]> {
  const isOpen = options.isOpen ?? (() => false);
  const start = options.onPictureStart ?? (() => undefined);
  const done = options.onPictureDone ?? (() => undefined);
  const { storage, records, pictures } = options;
  if (storage === undefined || records === undefined || pictures.length === 0) {
    return [];
  }
  const read = await readAlbum(records, pictures);
  if (read.status !== 'read') {
    return [];
  }
  const album: MovingAlbum = {
    entries: [...read.entries],
    recordCount: read.recordCount,
    addFailed: false,
  };
  const moves: PageMove[] = [];
  for (const picture of pictures) {
    // Otevřenost se zjišťuje až teď: dítě mohlo omalovánku otevřít, zatímco přesun čekal.
    if (isOpen(picture.identity)) {
      const kept = keptOpenPage(storage, picture);
      if (kept !== null) {
        moves.push(kept);
      }
      done(picture.identity);
      continue;
    }
    start(picture.identity);
    try {
      const move = await movePageToAlbum({ storage, records, picture, album });
      if (move !== null) {
        moves.push(move);
      }
    } finally {
      done(picture.identity);
    }
  }
  return moves;
}
