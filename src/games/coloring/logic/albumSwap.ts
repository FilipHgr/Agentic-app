/**
 * Malovat dál obrázek z alba (#131): výměna rozmalované stránky P té
 * omalovánky a obrázku A z alba. A se z alba přesune na stránku (album
 * neroste) a P přibude do alba jako nejnovější, jen když je rozmalovaná
 * a v albu není pixel po pixelu stejný obrázek té omalovánky (i A sám).
 *
 * Kroky výměny (poznámka pro implementaci v issue):
 * 0. album se přečte znovu; když nejde přečíst nebo v něm A už není, nic
 *    se nezmění,
 * 1. P se odloží v úložišti hry profilu spolu s A (`albumSwapRecord.ts`),
 * 2. stránka omalovánky se přepíše na A,
 * 3. A se smaže z alba,
 * 4. P se uloží do alba (jen když přibývá),
 * 5. odložená výměna se smaže.
 * Výměna nejdřív maže a pak ukládá, takže album nepřekročí 12 obrázků
 * ani 24 záznamů ani na okamžik.
 *
 * Selhání za běhu: krok 1 nebo 2 nic nezmění (odložená výměna se smaže),
 * krok 3 vrátí stránku P. Krok 4 (AC4) zkusí vrátit A do alba jako
 * nejnovější a stránku P; když nejde vrátit ani A, maluje dítě A a P
 * zůstane odložená, dokud ji do alba nedoplní další otevření Omalovánek.
 * Zápisy do úložiště hry se dělají zápisem s výsledkem (`setItemChecked`),
 * aby výměna nepočítala se zápisem drženým jen v paměti.
 *
 * Pravidlo po obnovení (`settleAlbumSwap`, volá se při otevření Omalovánek):
 * - A je v albu (obrázek té omalovánky pixel po pixelu stejný jako A)
 *   a odložená výměna neví, že A už jednou zmizel: výměna se vrátí. Stránka se přepíše zpátky na P, jen když na ní je A;
 *   jinak na ní je P (výměna se přerušila před krokem 2) a nic se nepřepíše.
 * - A v albu není, nebo je jistě smazaný (`albumRemoved`): výměna se dokončí. P jde do alba, pokud přibývá a stejný
 *   obrázek tam ještě není, stránka se nemění.
 * - Album nejde přečíst: nic se nesmaže ani nepřepíše, rozhodne další otevření.
 * Dokud výměna může stránku přepsat zpátky na P (na stránce je A a neví se,
 * že A z alba zmizel), náhled té omalovánky se jen zhoupne
 * (`swapBlocksPicture`), aby dítě nemalovalo do stránky, kterou by vrácení
 * přepsalo. Čistý TypeScript bez Phaseru.
 */

import { setItemChecked } from '../../../shared/storage/keyValueStorage';
import type { KeyValueStorage } from '../../../shared/storage/keyValueStorage';
import type { GameRecords, RecordData, RecordsAdd } from '../../../shared/storage/profileRecords';
import {
  ALBUM_PICTURE_LIMIT,
  ALBUM_RECORD_LIMIT,
  albumEntryOf,
  albumRecordOf,
  readAlbum,
  removeAlbumEntry,
  sameLayers,
} from './album';
import type { AlbumContents, AlbumEntry, AlbumPicture } from './album';
import { clearPendingSwap, readPendingSwap, storePendingSwap } from './albumSwapRecord';
import type { PendingSwap } from './albumSwapRecord';
import { NO_COLOR } from './coloring';
import { CURRENT_LAYER_CODE, decodeColorLayer, encodeColorLayer } from './colorLayerCode';
import { decodePageRecord, pageKeyOf, pageRecordOf, readStoredPage } from './savedPicture';
import type { PictureIdentity } from './savedPicture';
import { DEFAULT_TOOL_COLORS, loadToolColors } from './toolColors';

/** Jak dopadla odložená výměna při otevření Omalovánek. */
export type SwapSettlement =
  /** Žádná výměna nebyla odložená. */
  | { readonly kind: 'none' }
  /** Výměna se vrátila: stránka P, A v albu. */
  | { readonly kind: 'reverted' }
  /** Výměna se dokončila: stránka A, P v albu (když přibývá). */
  | { readonly kind: 'completed' }
  /** Úložiště teď nejde použít, výměna zůstává odložená do dalšího otevření. */
  | { readonly kind: 'waiting' };

export interface SettleOptions {
  readonly storage: KeyValueStorage | undefined;
  readonly records: GameRecords | undefined;
  /** Omalovánky sady i s obrysem. */
  readonly pictures: readonly AlbumPicture[];
}

/** Připravená výměna: všechno, co šlo ověřit hned po ťuknutí. */
export interface SwapPlan {
  readonly storage: KeyValueStorage;
  readonly records: GameRecords;
  readonly pictures: readonly AlbumPicture[];
  readonly picture: AlbumPicture;
  /** Obrázek A z alba. */
  readonly entry: AlbumEntry;
  /** Záznam stránky P; `null`, když stránka žádný nemá. */
  readonly pageRecord: string | null;
  /** Vrstva barev P; `null` u stránky bez záznamu. */
  readonly pageLayer: Uint8Array | null;
  /** Záznam stránky s obrázkem A. */
  readonly albumPageRecord: string;
}

/** Jak skončila výměna po ťuknutí na štětec. */
export type SwapRun =
  /** Výměna proběhla: stránka je A. */
  | { readonly kind: 'swapped' }
  /** AC4: P nejde uložit ani A vrátit; stránka je A a P zůstala odložená. */
  | { readonly kind: 'deferred' }
  /** AC4: P nejde uložit, A je zpátky v albu jako nejnovější (nový záznam). */
  | { readonly kind: 'restored'; readonly entry: AlbumEntry }
  /** Nic se nevyměnilo, stránka je P a A v albu. */
  | { readonly kind: 'kept' };

function sameIdentity(first: PictureIdentity, second: PictureIdentity): boolean {
  return first.id === second.id && first.version === second.version;
}

function pictureOf(
  pictures: readonly AlbumPicture[],
  identity: PictureIdentity,
): AlbumPicture | undefined {
  return pictures.find((each) => sameIdentity(each.identity, identity));
}

function isClean(layer: Uint8Array): boolean {
  return layer.every((value) => value === NO_COLOR);
}

/** Je v albu obrázek omalovánky `picture` pixel po pixelu stejný jako `layer`? */
function albumHas(album: AlbumContents, picture: AlbumPicture, layer: Uint8Array): boolean {
  return (
    album.status === 'read' &&
    album.entries.some(
      (entry) =>
        sameIdentity(entry.picture, picture.identity) &&
        sameLayers(picture.regions, entry.layer, layer),
    )
  );
}

/** Je na stránce omalovánky obrázek pixel po pixelu stejný jako `layer`? */
function pageShows(storage: KeyValueStorage, picture: AlbumPicture, layer: Uint8Array): boolean {
  const page = readStoredPage(storage, picture.identity, picture.regions);
  return page.kind === 'painted' && sameLayers(picture.regions, page.layer, layer);
}

/** Vrstva barev A z odložené výměny; `null` u poškozeného záznamu. */
function albumLayerOf(swap: PendingSwap, picture: AlbumPicture): Uint8Array | null {
  return decodeColorLayer(picture.regions, swap.albumLayer, CURRENT_LAYER_CODE);
}

/**
 * Zapíše záznam alba. Záznamy hry podle #125 nikdy neskončí zamítnutým
 * slibem; kdyby přece, je to jako „nedostupné“.
 */
async function addRecord(records: GameRecords, data: RecordData | null): Promise<RecordsAdd> {
  if (data === null) {
    return { status: 'full' };
  }
  try {
    return await records.add(data);
  } catch (error) {
    console.warn('Omalovánky: obrázek nejde uložit do alba', error);
    return { status: 'unavailable' };
  }
}

/** Vrátí stránku na P (záznam P, nebo prázdný záznam u stránky bez záznamu). */
function restorePage(
  storage: KeyValueStorage,
  picture: AlbumPicture,
  page: string | null,
): boolean {
  // Text stránky z odložené výměny se zapíše jen platný; podvržený nebo
  // poškozený se bere jako čistá stránka, aby stránka nezůstala nečitelná.
  const valid = page !== null && decodePageRecord(page, picture.identity, picture.regions) !== null;
  return setItemChecked(storage, pageKeyOf(picture.identity), valid ? page : '');
}

/** Odložená výměna si zapamatuje, že A z alba jistě zmizel (zápis jen když to jde). */
function noteAlbumRemoved(storage: KeyValueStorage, swap: PendingSwap): void {
  if (!swap.albumRemoved) {
    storePendingSwap(storage, { ...swap, albumRemoved: true });
  }
}

// ---------------------------------------------------------------------------
// Ťuknutí na štětec
// ---------------------------------------------------------------------------

/**
 * Ověří hned po ťuknutí, jestli výměna může začít (#131 AC3); `null`, když
 * ne: chybí úložiště nebo album, je už odložená jiná výměna, stránka P je
 * nečitelná, nebo se A nevejde do limitu stránky.
 */
export function planAlbumSwap(options: {
  readonly storage: KeyValueStorage | undefined;
  readonly records: GameRecords | undefined;
  readonly pictures: readonly AlbumPicture[];
  readonly entry: AlbumEntry;
}): SwapPlan | null {
  const { storage, records, pictures, entry } = options;
  if (storage === undefined || records === undefined || readPendingSwap(storage) !== null) {
    return null;
  }
  const picture = pictureOf(pictures, entry.picture);
  if (picture === undefined) {
    return null;
  }
  const page = readStoredPage(storage, picture.identity, picture.regions);
  if (page.kind === 'unreadable') {
    return null;
  }
  // Vybraná barva stránky zůstane, bez záznamu barva štětce.
  const selectedColor =
    page.kind === 'painted'
      ? page.selectedColor
      : (loadToolColors(storage, picture.identity.id)?.brush ?? DEFAULT_TOOL_COLORS.brush);
  const albumPageRecord = pageRecordOf(
    picture.identity,
    picture.regions,
    entry.layer,
    selectedColor,
  );
  if (albumPageRecord === null) {
    return null;
  }
  return {
    storage,
    records,
    pictures,
    picture,
    entry,
    pageRecord: page.kind === 'painted' ? page.record : null,
    pageLayer: page.kind === 'painted' ? page.layer : null,
    albumPageRecord,
  };
}

/**
 * Provede výměnu podle `plan` (kroky v popisu souboru). Nikdy nevyhodí
 * výjimku; každé selhání skončí jedním z celých stavů `SwapRun`.
 */
export async function runAlbumSwap(plan: SwapPlan): Promise<SwapRun> {
  try {
    return await swapSteps(plan);
  } catch (error) {
    // Nečekaná chyba: co se nedokončilo, dokončí nebo vrátí další otevření.
    console.warn('Omalovánky: výměna obrázku z alba se nepovedla', error);
    return { kind: 'kept' };
  }
}

async function swapSteps(plan: SwapPlan): Promise<SwapRun> {
  const { storage, records, picture, entry } = plan;
  const album = await readAlbum(records, plan.pictures);
  if (album.status !== 'read' || !album.entries.some((each) => each.recordId === entry.recordId)) {
    return { kind: 'kept' };
  }
  const pageLayer = plan.pageLayer;
  const addsPage =
    pageLayer !== null && !isClean(pageLayer) && !albumHas(album, picture, pageLayer);
  const swap: PendingSwap = {
    pictureId: picture.identity.id,
    pictureVersion: picture.identity.version,
    page: plan.pageRecord,
    albumLayer: encodeColorLayer(picture.regions, entry.layer),
    addsPage,
    albumRemoved: false,
  };
  if (!storePendingSwap(storage, swap)) {
    return { kind: 'kept' };
  }
  if (!setItemChecked(storage, pageKeyOf(picture.identity), plan.albumPageRecord)) {
    clearPendingSwap(storage);
    return { kind: 'kept' };
  }
  if ((await removeAlbumEntry(records, entry.recordId)) !== 'removed') {
    if (restorePage(storage, picture, plan.pageRecord)) {
      clearPendingSwap(storage);
    }
    return { kind: 'kept' };
  }
  if (addsPage && pageLayer !== null) {
    const added = await addRecord(
      records,
      albumRecordOf(picture.identity, picture.regions, pageLayer),
    );
    if (added.status !== 'saved') {
      return restoreAlbumPicture(plan, swap);
    }
  }
  clearPendingSwap(storage);
  return { kind: 'swapped' };
}

/**
 * AC4: P nejde uložit do alba, A se zkusí vrátit jako nejnovější a stránka
 * na P. Když nejde vrátit ani A, zůstane stránka A a P odložená.
 */
async function restoreAlbumPicture(plan: SwapPlan, swap: PendingSwap): Promise<SwapRun> {
  const { storage, records, picture, entry } = plan;
  const returned = await addRecord(
    records,
    albumRecordOf(picture.identity, picture.regions, entry.layer),
  );
  if (returned.status !== 'saved') {
    noteAlbumRemoved(storage, swap);
    return { kind: 'deferred' };
  }
  // Když se stránka nevrátí, vrátí ji další otevření (A je zase v albu).
  if (restorePage(storage, picture, plan.pageRecord)) {
    clearPendingSwap(storage);
  }
  return { kind: 'restored', entry: albumEntryOf(returned.id, picture, entry.layer) };
}

// ---------------------------------------------------------------------------
// Náhled na výběru
// ---------------------------------------------------------------------------

/**
 * Musí se náhled omalovánky `picture` jen zhoupnout (#131 AC5)? Ano, když
 * je odložená výměna té omalovánky, na stránce je A a neví se, že A z alba
 * zmizel (`albumRemoved`); vrácení výměny by stránku přepsalo na P.
 */
export function swapBlocksPicture(
  storage: KeyValueStorage | undefined,
  picture: AlbumPicture,
  albumRemovedNow: boolean,
): boolean {
  if (storage === undefined) {
    return false;
  }
  const swap = readPendingSwap(storage);
  if (
    swap === null ||
    swap.albumRemoved ||
    albumRemovedNow ||
    swap.pictureId !== picture.identity.id ||
    swap.pictureVersion !== picture.identity.version
  ) {
    return false;
  }
  const albumLayer = albumLayerOf(swap, picture);
  // Poškozený obrázek A v záznamu náhled nezablokuje, jinak by se omalovánka už nikdy neotevřela.
  return albumLayer !== null && pageShows(storage, picture, albumLayer);
}

// ---------------------------------------------------------------------------
// Dokončení nebo vrácení po obnovení stránky
// ---------------------------------------------------------------------------

/**
 * Dokončí nebo vrátí odloženou výměnu (pravidlo po obnovení v popisu
 * souboru). Volá se při otevření Omalovánek. Nikdy nevyhodí výjimku.
 */
export async function settleAlbumSwap(options: SettleOptions): Promise<SwapSettlement> {
  try {
    return await settleSteps(options);
  } catch (error) {
    // Nečekaná chyba: výměna zůstane odložená a rozhodne další otevření.
    console.warn('Omalovánky: odloženou výměnu nejde dokončit', error);
    return { kind: 'waiting' };
  }
}

async function settleSteps(options: SettleOptions): Promise<SwapSettlement> {
  const { storage, records, pictures } = options;
  const swap = storage === undefined ? null : readPendingSwap(storage);
  if (storage === undefined || swap === null) {
    return { kind: 'none' };
  }
  const picture = pictureOf(pictures, { id: swap.pictureId, version: swap.pictureVersion });
  const albumLayer = picture === undefined ? null : albumLayerOf(swap, picture);
  if (picture === undefined || albumLayer === null) {
    // Omalovánka mimo sadu nebo poškozený záznam: nic se nepřepíše.
    return { kind: 'waiting' };
  }
  const album = await readAlbum(records, pictures);
  if (album.status !== 'read') {
    return { kind: 'waiting' };
  }
  // Když je A z alba jistě pryč, výměna se jen dokončí: stejný obrázek
  // v albu je pak nový snímek (dítě vyfotilo A), ne A před výměnou.
  if (!swap.albumRemoved && albumHas(album, picture, albumLayer)) {
    return revertSwap(storage, picture, swap, albumLayer);
  }
  return completeSwap({ storage, records, picture, swap, album });
}

/** A je v albu: stránka znovu P (jen když na ní je A) a odložená výměna zmizí. */
function revertSwap(
  storage: KeyValueStorage,
  picture: AlbumPicture,
  swap: PendingSwap,
  albumLayer: Uint8Array,
): SwapSettlement {
  if (pageShows(storage, picture, albumLayer) && !restorePage(storage, picture, swap.page)) {
    return { kind: 'waiting' };
  }
  return clearPendingSwap(storage) ? { kind: 'reverted' } : { kind: 'waiting' };
}

/** A v albu není: P do alba (když přibývá a stejný obrázek tam není), odložená výměna zmizí. */
async function completeSwap(options: {
  readonly storage: KeyValueStorage;
  readonly records: GameRecords | undefined;
  readonly picture: AlbumPicture;
  readonly swap: PendingSwap;
  readonly album: Extract<AlbumContents, { status: 'read' }>;
}): Promise<SwapSettlement> {
  const { storage, records, picture, swap, album } = options;
  const pageLayer =
    swap.page === null
      ? null
      : (decodePageRecord(swap.page, picture.identity, picture.regions)?.layer ?? null);
  if (swap.addsPage && pageLayer !== null && !albumHas(album, picture, pageLayer)) {
    const full =
      album.entries.length >= ALBUM_PICTURE_LIMIT || album.recordCount >= ALBUM_RECORD_LIMIT;
    const added =
      full || records === undefined
        ? null
        : await addRecord(records, albumRecordOf(picture.identity, picture.regions, pageLayer));
    if (added === null || added.status !== 'saved') {
      // P počká odložená; náhled omalovánky se otevře, stránku už nic nepřepíše.
      noteAlbumRemoved(storage, swap);
      return { kind: 'waiting' };
    }
  }
  return clearPendingSwap(storage) ? { kind: 'completed' } : { kind: 'waiting' };
}
