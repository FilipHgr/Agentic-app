/**
 * Pomůcky pro testy k #131 (malovat dál obrázek z alba). Označení podle
 * issue: **P** je rozmalovaná stránka omalovánky před ťuknutím, **A** je
 * obrázek z alba na velkém obrázku.
 *
 * Zařízení (`SwapDevice`) má dvě úložiště jako prohlížeč:
 * - úložiště hry aktivního profilu v `localStorage` (`KeyValueStorage`)
 *   s rozmalovanými stránkami, barvami nástrojů, nedávnými barvami
 *   a tloušťkou čáry,
 * - záznamy hry v IndexedDB (`GameRecords`, verze v paměti nad poličkou
 *   `MemoryRecordsShelf`) s albem.
 * Jedno „načtení stránky“ je `device.load()`: nové úložiště i záznamy nad
 * stejnými daty. „Otevření Omalovánek“ po načtení je `settleAlbumSwap`
 * (dokončení nebo vrácení odložené výměny) a výběr `startPictureChoice`
 * s úložištěm, záznamy a omalovánkami sady i s obrysem.
 *
 * Zařízení umí selhat jako skutečné úložiště: záznamy nedostupné celé,
 * jen mazání, jen ukládání (i jen několik dalších ukládání), plné
 * `localStorage` (zápis vyhodí výjimku jako Safari). A umí „vypnout
 * stránku“ (`cutAfterWrites`): po zadaném počtu zápisů do obou úložišť
 * stránka přestane žít, žádný další zápis se neprovede a rozběhnuté
 * operace záznamů už nikdy neskončí. Testy obnovení tak přeruší výměnu po
 * každém zápisu, bez znalosti toho, jak výměna kroky dělá (poznámka pro
 * implementaci v issue je nezávazná).
 *
 * Testy neznají tvar odložené P ani klíče úložiště: stav čtou jen tak, jak
 * ho vidí hráč (stránka v malování, obrázky alba, náhled na výběru).
 *
 * Navržené rozhraní viz výstup testů #131 (`albumSwap.ts`,
 * `pictureChoice.ts`, `pickerLayout.ts`).
 */

import { expect, vi } from 'vitest';

import { readAlbum } from '../../../src/games/coloring/logic/album';
import type { AlbumEntry, AlbumPicture } from '../../../src/games/coloring/logic/album';
import { settleAlbumSwap } from '../../../src/games/coloring/logic/albumSwap';
import type { SwapSettlement } from '../../../src/games/coloring/logic/albumSwap';
import { startPictureChoice } from '../../../src/games/coloring/logic/pictureChoice';
import type {
  ContinueResult,
  ContinueTap,
  PictureChoice,
  TrashFeedback,
} from '../../../src/games/coloring/logic/pictureChoice';
import type { RegionMap } from '../../../src/games/coloring/logic/regionMap';
import { openColoring } from '../../../src/games/coloring/logic/savedPicture';
import type {
  PictureIdentity,
  SavedColoring,
} from '../../../src/games/coloring/logic/savedPicture';
import type { Tone } from '../../../src/shared/audio/tonePlayer';
import { HOLD_TO_GO_HOME_MS } from '../../../src/shared/logic/homeButton';
import type { KeyValueStorage } from '../../../src/shared/storage/keyValueStorage';
import {
  createMemoryRecordsShelf,
  memoryProfileRecords,
} from '../../../src/shared/storage/profileRecords';
import type {
  GameRecords,
  MemoryRecordsShelf,
  RecordsAdd,
  RecordsList,
  RecordsWriteStatus,
} from '../../../src/shared/storage/profileRecords';
import {
  CIRCLES,
  COLORING_GAME_ID,
  HOUSE,
  STAR,
  THREE_PICTURES,
  addUnreadable,
  albumPicturesOf,
  fillAlbum,
  paintLeft,
  settle,
} from './albumHelpers';
import type { RemoveFailure } from './albumHelpers';
import { choose } from './drawingToolHelpers';
import { pixelsOf, twoHalves } from './savedPictureHelpers';

export { CIRCLES, HOUSE, STAR, THREE_PICTURES };

/** Profil v testech bez správy profilů. */
export const EMA = 'p-ema';
export const TOM = 'p-tom';

/** Barvy obrázků; album z `fillAlbum` má barvy 0, 1, 2 … podle pořadí focení. */
export const P_COLOR = 30;
export const OTHER_PAGE_COLOR = 33;

/** Pixely obrázku po řádcích (barva, `null` bez barvy). */
export type Pixels = Array<number | null>;

/** Slib, který nikdy neskončí: operace stránky, která už nežije. */
function never<T>(): Promise<T> {
  return new Promise<T>(() => undefined);
}

/** Jak skončí další ukládání do záznamů, když ho test nechá selhat. */
export type AddFailure = 'full' | 'unavailable';

/** Úložiště hry jednoho profilu v jednom načtení stránky. */
class DeviceStorage implements KeyValueStorage {
  constructor(
    private readonly device: SwapDevice,
    private readonly load: number,
    private readonly prefix: string,
  ) {}

  getItem(key: string): string | null {
    return this.device.kv.get(this.prefix + key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.device.isDead(this.load)) {
      return;
    }
    if (this.device.localStorageFull) {
      throw new Error('zkušební úložiště je plné');
    }
    this.device.kv.set(this.prefix + key, value);
    this.device.noteWrite(this.load);
  }

  /** Kdyby hra úložiště rozšířila o mazání, počítá se jako zápis. */
  removeItem(key: string): void {
    if (this.device.isDead(this.load)) {
      return;
    }
    if (this.device.localStorageFull) {
      throw new Error('zkušební úložiště je plné');
    }
    this.device.kv.delete(this.prefix + key);
    this.device.noteWrite(this.load);
  }
}

/** Zařízení s `localStorage` a IndexedDB v paměti, které umí selhat a vypnout stránku. */
export class SwapDevice {
  readonly shelf: MemoryRecordsShelf = createMemoryRecordsShelf();
  readonly kv = new Map<string, string>();
  /** Zápisy do obou úložišť od vytvoření zařízení. */
  writes = 0;
  /** Kolikrát hra zkusila mazat ze záznamů. */
  removes = 0;
  /** Kolikrát hra zkusila ukládat do záznamů. */
  adds = 0;
  /** Nejvíc záznamů profilu, které kdy v úložišti byly. */
  readonly maxRecords = new Map<string, number>();
  /** Záznamy nejdou vůbec použít (čtení, ukládání i mazání skončí „nedostupné“). */
  recordsUnavailable = false;
  /** Jen čtení alba skončí „nedostupné“. */
  listUnavailable = false;
  /** Každé další mazání skončí takto a nic nesmaže; `null` maže. */
  removeFailure: RemoveFailure | null = null;
  /** Každé další ukládání skončí takto a nic neuloží; `null` ukládá. */
  addFailure: AddFailure | null = null;
  /** Jen několik dalších ukládání skončí takto (po řadě), pak se ukládá. */
  readonly nextAddFailures: AddFailure[] = [];
  /** Zápis do `localStorage` vyhodí výjimku jako plné úložiště v Safari. */
  localStorageFull = false;
  private loadCount = 0;
  private deadLoads = new Set<number>();
  private cutAt: number | null = null;
  private fullAt: number | null = null;
  private heldRemoves: Array<() => void> = [];
  private holdingRemoves = false;

  /** Další načtení stránky: předchozí stránka už nic nezapíše. */
  nextLoad(): number {
    this.deadLoads.add(this.loadCount);
    this.loadCount += 1;
    this.cutAt = null;
    return this.loadCount;
  }

  currentLoad(): number {
    return this.loadCount;
  }

  isDead(load: number): boolean {
    return this.deadLoads.has(load);
  }

  noteWrite(load: number): void {
    this.writes += 1;
    if (this.cutAt !== null && this.writes >= this.cutAt) {
      this.deadLoads.add(load);
    }
    if (this.fullAt !== null && this.writes >= this.fullAt) {
      this.localStorageFull = true;
    }
  }

  /** Úložiště zase jde použít: žádné selhání čtení, ukládání ani mazání. */
  repair(): void {
    this.recordsUnavailable = false;
    this.listUnavailable = false;
    this.removeFailure = null;
    this.addFailure = null;
    this.nextAddFailures.splice(0);
    this.localStorageFull = false;
    this.fullAt = null;
  }

  /** `localStorage` se zaplní po `count` dalších zápisech (0 = hned); záznamy fungují dál. */
  fullAfterWrites(count: number): void {
    this.fullAt = this.writes + count;
    this.localStorageFull = count === 0;
  }

  /** Stránka přestane žít po `count` dalších zápisech (0 = hned). */
  cutAfterWrites(count: number): void {
    this.cutAt = this.writes + count;
    if (count === 0) {
      this.deadLoads.add(this.loadCount);
    }
  }

  /** Další mazání počkají na `releaseRemoves`. */
  holdRemoves(): void {
    this.holdingRemoves = true;
  }

  async releaseRemoves(): Promise<void> {
    this.holdingRemoves = false;
    for (const finish of this.heldRemoves.splice(0)) {
      finish();
    }
    await settle();
  }

  /** Úložiště hry profilu `profile` v tomto načtení stránky. */
  storage(profile: string = EMA): KeyValueStorage {
    return new DeviceStorage(this, this.loadCount, `${profile}/`);
  }

  /** Záznamy Omalovánek profilu `profile` v tomto načtení stránky. */
  records(profile: string = EMA): GameRecords {
    const load = this.loadCount;
    const inner = memoryProfileRecords(this.shelf).forGame(profile, COLORING_GAME_ID);
    const countRecords = (): void => {
      const count = this.shelf.records.filter((record) => record.profileId === profile).length;
      this.maxRecords.set(profile, Math.max(this.maxRecords.get(profile) ?? 0, count));
    };
    return {
      list: (): Promise<RecordsList> => {
        if (this.isDead(load)) {
          return never();
        }
        if (this.recordsUnavailable || this.listUnavailable) {
          return Promise.resolve({ status: 'unavailable' });
        }
        return inner.list();
      },
      add: (data): Promise<RecordsAdd> => {
        if (this.isDead(load)) {
          return never();
        }
        this.adds += 1;
        const failure = this.recordsUnavailable
          ? 'unavailable'
          : (this.nextAddFailures.shift() ?? this.addFailure);
        if (failure !== null) {
          return Promise.resolve({ status: failure });
        }
        const result = inner.add(data);
        this.noteWrite(load);
        countRecords();
        return result;
      },
      remove: (id): Promise<RecordsWriteStatus> => {
        if (this.isDead(load)) {
          return never();
        }
        this.removes += 1;
        if (this.recordsUnavailable) {
          return Promise.resolve('unavailable');
        }
        if (this.removeFailure === 'rejected') {
          return Promise.reject(new Error('zkušební chyba úložiště'));
        }
        if (this.removeFailure !== null) {
          return Promise.resolve(this.removeFailure);
        }
        const removeNow = (): Promise<RecordsWriteStatus> => {
          if (this.isDead(load)) {
            return never();
          }
          const result = inner.remove(id);
          this.noteWrite(load);
          return result;
        };
        if (!this.holdingRemoves) {
          return removeNow();
        }
        return new Promise((finish) => {
          this.heldRemoves.push(() => {
            void removeNow().then(finish);
          });
        });
      },
    };
  }

  /** Záznamy profilu přímo z poličky, bez selhání (jen pro čtení stavu v testu). */
  rawRecords(profile: string = EMA): GameRecords {
    return memoryProfileRecords(this.shelf).forGame(profile, COLORING_GAME_ID);
  }

  /** Úložiště profilu jen pro čtení stavu v testu; nic nezapíše. */
  reader(profile: string = EMA): KeyValueStorage {
    return {
      getItem: (key) => this.kv.get(`${profile}/${key}`) ?? null,
      setItem: () => undefined,
    };
  }

  /** Kopie všech dat zařízení (pro „nic se nesmazalo ani nepřepsalo“). */
  snapshot(): { readonly kv: Array<[string, string]>; readonly records: unknown } {
    return {
      kv: [...this.kv.entries()].sort(([a], [b]) => a.localeCompare(b)),
      records: structuredClone(this.shelf.records),
    };
  }

  /** Kopie dat profilu `profile` (jeho `localStorage` a záznamy). */
  profileSnapshot(profile: string): {
    readonly kv: Array<[string, string]>;
    readonly records: unknown;
  } {
    return {
      kv: [...this.kv.entries()]
        .filter(([key]) => key.startsWith(`${profile}/`))
        .sort(([a], [b]) => a.localeCompare(b)),
      records: structuredClone(this.shelf.records.filter((record) => record.profileId === profile)),
    };
  }
}

/** Výběr Omalovánek nad úložištěm a záznamy jednoho profilu. */
export interface ChoicePage {
  readonly storage: KeyValueStorage;
  readonly records: GameRecords;
  readonly choice: PictureChoice;
  readonly trashFeedback: TrashFeedback[];
  readonly pictures: readonly AlbumPicture[];
  readonly regions: RegionMap;
}

/** Jedno načtení stránky s Omalovánkami na zkušebním zařízení. */
export interface SwapPage extends ChoicePage {
  readonly device: SwapDevice;
}

export interface PageOptions {
  readonly profile?: string;
  readonly pictures?: readonly AlbumPicture[];
}

/** Omalovánky sady i s obrysem (všechny se zkušebním obrysem). */
export function swapPictures(): AlbumPicture[] {
  return albumPicturesOf(THREE_PICTURES, twoHalves());
}

/**
 * Dítě ťukne v menu na Omalovánky: výběr se záznamy a úložištěm hry
 * profilu a omalovánkami sady i s obrysem.
 */
export function enterChoice(
  storage: KeyValueStorage,
  records: GameRecords,
  pictures: readonly AlbumPicture[] = swapPictures(),
): ChoicePage {
  const trashFeedback: TrashFeedback[] = [];
  const choice = startPictureChoice(
    pictures.map((picture) => picture.identity),
    {
      now: () => Date.now(),
      records,
      storage,
      albumPictures: pictures,
      onTrash: (event) => {
        trashFeedback.push(event);
      },
    },
  );
  const regions = pictures[0]?.regions ?? twoHalves();
  return { storage, records, choice, trashFeedback, pictures, regions };
}

/** Výběr nad načtenou stránkou zařízení (bez dokončení odložené výměny). */
export function choiceOn(device: SwapDevice, options: PageOptions = {}): SwapPage {
  const profile = options.profile ?? EMA;
  const page = enterChoice(device.storage(profile), device.records(profile), options.pictures);
  return { ...page, device };
}

/** Odložená výměna se dokončí nebo vrátí při otevření Omalovánek nad stránkou `page`. */
export function settleOn(page: ChoicePage): Promise<SwapSettlement> {
  return settleAlbumSwap({
    storage: page.storage,
    records: page.records,
    pictures: page.pictures,
  });
}

/**
 * Dítě obnoví stránku a otevře Omalovánky: nové načtení, dokončení nebo
 * vrácení odložené výměny a výběr.
 */
export async function reloadAndOpen(
  device: SwapDevice,
  options: PageOptions = {},
): Promise<{ readonly page: SwapPage; readonly settlement: SwapSettlement }> {
  device.nextLoad();
  const page = choiceOn(device, options);
  const settlement = await settleOn(page);
  await settle();
  return { page, settlement };
}

/** Album tak, jak ho kniha přečte. */
export function albumOn(page: ChoicePage): ReturnType<typeof readAlbum> {
  return readAlbum(page.records, page.pictures);
}

/**
 * Dítě otevře album knihou a ťukne na náhled `index`, velký obrázek se
 * ukáže a hodiny se posunou o celé podržení domečku (jako #129).
 * Vrátí obrázek alba, který je vidět.
 */
export async function openBigPicture(page: ChoicePage, index: number): Promise<AlbumEntry> {
  const album = await albumOn(page);
  expect(page.choice.tapBook(album).kind, 'kniha otevře album').toBe('open');
  const tap = page.choice.tapAlbumPreview(index);
  expect(tap.kind, `náhled ${index + 1} otevře velký obrázek`).toBe('open');
  page.choice.bigPictureShown();
  vi.advanceTimersByTime(HOLD_TO_GO_HOME_MS);
  const screen = page.choice.screen();
  if (screen.kind !== 'bigPicture') {
    throw new Error('velký obrázek se neukázal');
  }
  return screen.entry;
}

/** Co nakonec udělalo ťuknutí na štětec: zhoupnutí s tónem, nebo otevření malování. */
export type ContinueOutcome =
  | { readonly kind: 'wobble'; readonly tones: readonly Tone[] }
  | { readonly kind: 'opened'; readonly picture: PictureIdentity }
  | { readonly kind: 'ignored' };

/**
 * Výsledek ťuknutí na štětec po doběhnutí výměny. Zhoupnutí hned
 * (`wobble`) i nepovedená výměna (`failed`) jsou zhoupnutí s tónem.
 */
export async function outcomeOf(tap: ContinueTap): Promise<ContinueOutcome> {
  if (tap.kind === 'ignored') {
    return { kind: 'ignored' };
  }
  if (tap.kind === 'wobble') {
    return { kind: 'wobble', tones: tap.tones };
  }
  const result: ContinueResult = await tap.done;
  await settle();
  return result.kind === 'opened'
    ? { kind: 'opened', picture: result.picture }
    : { kind: 'wobble', tones: result.tones };
}

/** Dítě ťukne na štětec a výměna doběhne. */
export async function tapContinue(page: ChoicePage): Promise<ContinueOutcome> {
  return outcomeOf(page.choice.tapContinue());
}

/**
 * Scéna ukáže malování omalovánky, kterou výběr otevřel, nad úložištěm
 * stránky (s albem přečteným při otevírání).
 */
export async function showPainting(
  page: ChoicePage,
  picture: PictureIdentity = HOUSE,
): Promise<SavedColoring> {
  const contents = await albumOn(page);
  page.choice.paintingShown();
  return openColoring({
    regions: page.regions,
    picture,
    storage: page.storage,
    album: { records: page.records, contents },
  });
}

/** Rozmalovaná stránka omalovánky `picture`, jak by ji dítě vidělo po otevření. */
export function pageOf(
  device: SwapDevice,
  picture: PictureIdentity = HOUSE,
  profile: string = EMA,
  regions: RegionMap = twoHalves(),
): Pixels {
  const game = openColoring({ regions, picture, storage: device.reader(profile) });
  return pixelsOf(game, regions);
}

/** Obrázky alba profilu od nejnovějšího (pixely), přímo z úložiště. */
export async function albumPixels(
  device: SwapDevice,
  profile: string = EMA,
  pictures: readonly AlbumPicture[] = swapPictures(),
): Promise<Pixels[]> {
  const album = await readAlbum(device.rawRecords(profile), pictures);
  const regions = pictures[0]?.regions ?? twoHalves();
  return album.status === 'read'
    ? album.entries.map((entry) => pixelsOf(entry.colors, regions))
    : [];
}

/** Kolikrát je obrázek `pixels` mezi obrázky `album`. */
export function timesIn(album: readonly Pixels[], pixels: Pixels): number {
  return album.filter((each) => sameImage(each, pixels)).length;
}

export function sameImage(first: Pixels, second: Pixels): boolean {
  return first.length === second.length && first.every((value, index) => value === second[index]);
}

export function sameAlbum(first: readonly Pixels[], second: readonly Pixels[]): boolean {
  return (
    first.length === second.length &&
    first.every((pixels, index) => sameImage(pixels, second[index] ?? []))
  );
}

/** Jak dítě rozmalovalo stránku P domku. */
export type PagePainting =
  /** Levá polovina barvou `P_COLOR`, jiný obrázek než všechny v albu. */
  | 'distinct'
  /** Stránka se nikdy nemalovala. */
  | 'clean'
  /** Stránka se namalovala a celá vygumovala. */
  | 'erased'
  /** Stránka je stejná jako obrázek alba na místě `index` (od nejnovějšího). */
  | { readonly sameAsAlbumIndex: number };

export interface SwapScenario {
  /** Obrázků domku v albu (barvy 0, 1, … podle pořadí focení). */
  readonly albumCount?: number;
  /** Nečitelných záznamů v albu navíc. */
  readonly unreadable?: number;
  readonly page?: PagePainting;
  /** Má i jiná omalovánka (kruhy) rozmalovanou stránku? */
  readonly otherPage?: boolean;
  /** Na který obrázek alba (od nejnovějšího) dítě ťukne. */
  readonly aIndex?: number;
  readonly profile?: string;
}

export interface PreparedSwap {
  readonly device: SwapDevice;
  readonly page: SwapPage;
  /** Obrázek alba na velkém obrázku. */
  readonly entry: AlbumEntry;
  /** Pixely P, A a alba před ťuknutím na štětec. */
  readonly p: Pixels;
  readonly a: Pixels;
  readonly albumBefore: Pixels[];
  /** Stránka kruhů (jiné omalovánky) před ťuknutím. */
  readonly otherPageBefore: Pixels;
}

/** Guma přejede celou oblast A (vlevo) vodorovnými tahy jako v testech gumy. */
function eraseLeft(game: SavedColoring): void {
  choose(game, 'eraser');
  for (let y = 0; y < 200; y += 2) {
    game.pointerDown({ id: 1, x: 0, y, kind: 'touch' });
    game.pointerMove({ id: 1, x: 149, y, kind: 'touch' });
    game.pointerUp(1);
  }
}

/**
 * Připraví zařízení: album domku, rozmalovanou stránku P domku, případně
 * stránku kruhů, a dítě na velkém obrázku A. Album se plní se skutečnými
 * časovači jako v testech #126, pak se zapnou falešné.
 */
export async function prepareSwap(scenario: SwapScenario = {}): Promise<PreparedSwap> {
  vi.useRealTimers();
  const profile = scenario.profile ?? EMA;
  const device = new SwapDevice();
  const regions = twoHalves();
  await fillAlbum(device.records(profile), scenario.albumCount ?? 3, HOUSE);
  await addUnreadable(device.records(profile), scenario.unreadable ?? 0);
  const setupAlbum = await albumPixels(device, profile);
  const painting = scenario.page ?? 'distinct';
  const house = openColoring({ regions, picture: HOUSE, storage: device.storage(profile) });
  if (painting === 'distinct') {
    paintLeft(house, P_COLOR);
  } else if (painting === 'erased') {
    paintLeft(house, P_COLOR);
    eraseLeft(house);
    choose(house, 'brush');
  } else if (painting !== 'clean') {
    const target = setupAlbum[painting.sameAsAlbumIndex];
    const color = target?.find((value) => value !== null) ?? null;
    if (color === null || color === undefined) {
      throw new Error('obrázek alba pro stejnou stránku chybí');
    }
    paintLeft(house, color);
  }
  house.suspend();
  if (scenario.otherPage === true) {
    const circles = openColoring({ regions, picture: CIRCLES, storage: device.storage(profile) });
    paintLeft(circles, OTHER_PAGE_COLOR);
    circles.suspend();
  }
  vi.useFakeTimers();
  device.nextLoad();
  const page = choiceOn(device, { profile });
  await settleOn(page);
  const entry = await openBigPicture(page, scenario.aIndex ?? 1);
  return {
    device,
    page,
    entry,
    p: pageOf(device, HOUSE, profile),
    a: pixelsOf(entry.colors, regions),
    albumBefore: await albumPixels(device, profile),
    otherPageBefore: pageOf(device, CIRCLES, profile),
  };
}

/** Album po výměně: P navíc jako nejnovější (když přibývá), A pryč, ostatní v pořadí. */
export function albumAfter(prepared: PreparedSwap, pAdded: boolean): Pixels[] {
  const others = prepared.albumBefore.filter((pixels) => !sameImage(pixels, prepared.a));
  return pAdded ? [prepared.p, ...others] : others;
}

/** Je na stránce a v albu celý stav před výměnou, nebo celý stav po ní? */
export async function wholeState(
  prepared: PreparedSwap,
  pAdded: boolean,
): Promise<'před' | 'po' | 'napůl'> {
  const page = pageOf(prepared.device);
  const album = await albumPixels(prepared.device);
  if (sameImage(page, prepared.p) && sameAlbum(album, prepared.albumBefore)) {
    return 'před';
  }
  if (sameImage(page, prepared.a) && sameAlbum(album, albumAfter(prepared, pAdded))) {
    return 'po';
  }
  return 'napůl';
}

/** Kolik zápisů udělá celá výměna bez přerušení ve stejném scénáři. */
export async function writesOfWholeSwap(scenario: SwapScenario): Promise<number> {
  const prepared = await prepareSwap(scenario);
  const before = prepared.device.writes;
  const outcome = await tapContinue(prepared.page);
  expect(outcome.kind, 'výměna bez přerušení otevře malování').toBe('opened');
  return prepared.device.writes - before;
}
