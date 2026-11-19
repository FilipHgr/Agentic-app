/**
 * Výběr omalovánky ze sady (#124), čistá logika bez Phaseru. Výběr dostane
 * sadu zvenku a drží, co je vidět: výběr, otevírání omalovánky, nebo
 * malování. Scéna jen kreslí a hlásí ťuknutí, zobrazení malování
 * a podržení domečku.
 *
 * - Při 2 a více omalovánkách začíná výběr, při jediné se otevře rovnou
 *   malování a domeček vede do menu.
 * - Ťuknutí na náhled otevře omalovánku jen na výběru: druhý prst nebo
 *   dvojí ťuknutí během otevírání nic neotevře (AC5).
 * - Domeček v malování vede na výběr, na výběru do menu (AC4). Podržení se
 *   počítá až od chvíle, kdy je malování vidět (AC5): podržení dokončené
 *   během otevírání nebo dřív než za 1 s po zobrazení malování začalo
 *   ještě před ním a nepočítá se.
 * - Kniha na výběru (#126 AC4) otevře album aktivního profilu, které scéna
 *   přečetla (`album.ts`). Prázdné, nedostupné nebo ještě nepřečtené album
 *   se neotevře a kniha se jen zhoupne s tónem domečku. Domeček z alba
 *   vede zpátky na výběr.
 * - Ťuknutí na náhled v albu (#129 AC1) otevře velký obrázek. Během
 *   otevírání se druhý prst ani dvojí ťuknutí nepočítá a podržení domečku
 *   se počítá až od chvíle, kdy je velký obrázek vidět (AC5). Domeček
 *   z velkého obrázku vede do alba (AC2).
 * - Koš na velkém obrázku (#129 AC3) smaže obrázek podržením 1 s jako
 *   „Smazat“ u profilu (#108). Ťuknutí koš jen zhoupne s tónem domečku.
 *   Když se drží koš, domeček nic neudělá, a když se drží domeček, koš
 *   nic neudělá (AC5). Během mazání koš jen zhoupne a podržení domečku
 *   přepne obrazovku až po mazání. Po smazání je dítě v albu bez obrázku
 *   (album vznikne bez nového čtení), s prázdným albem na výběru. Když se
 *   smazání nepovede, zůstane velký obrázek a koš se zhoupne (AC4).
 * - Štětec na velkém obrázku (#131) vymění rozmalovanou stránku té
 *   omalovánky a obrázek z alba (`albumSwap.ts`) a otevře malování.
 *   Ťuknutí hned zahraje tón náhledu; když výměna nemůže začít nebo se
 *   nepovede, štětec se zhoupne s tónem domečku a dítě zůstane na velkém
 *   obrázku. Druhé ťuknutí, druhý prst, ťuknutí během otevírání velkého
 *   obrázku a při drženém koši se nepočítá (AC6). Během výměny nic
 *   neudělá štětec, koš ani domeček. Když se P nepodaří uložit a A se
 *   vrátí do alba, ukazuje velký obrázek vrácený A (AC4).
 * - Náhled omalovánky, jejíž výměna se může ještě vrátit, se jen zhoupne
 *   s tónem domečku (#131 AC5), aby dítě nemalovalo do stránky, kterou by
 *   vrácení přepsalo.
 * - Zamčená omalovánka (#140, volba `locks`) se bez celého klíče neotevře:
 *   zámek a ukazatel klíčů se zhoupnou s tónem domečku a nic se nezmění
 *   (AC4). S celým klíčem (#159, nahrazuje odemčení jedním ťuknutím z #140
 *   AC5) první ťuknutí klíč nespotřebuje, jen ho pošle z ukazatele do
 *   zámku (`keyToLock`); scéna po letu hlásí `keyLanded`. Ťuknutí na
 *   stejnou omalovánku za letu nic neudělá. Druhé ťuknutí po doletu klíč
 *   utratí, zámek se otevře a omalovánka se otevírá jako po ťuknutí na
 *   odemčenou. Během otevírání se další ťuknutí nepočítá, takže se utratí
 *   jen jeden klíč (#140 AC6). Ťuknutí na jinou zamčenou omalovánku pošle
 *   klíč k ní, cokoli jiného na výběru (odemčená omalovánka, prázdné místo,
 *   šipky, listování, kniha, domeček) klíč vrátí do ukazatele a proběhne
 *   jako dřív. Klíč se vrátí i 5 s po doletu bez ťuknutí (`keyInLock`
 *   pak vrátí `null`). Klíč v zámku se nikam neukládá, nový výběr (po
 *   obnovení stránky) ho má v ukazateli.
 * - Rozmalovaný obrázek jde do alba sám (#141, `pageToAlbum.ts`): scéna
 *   při otevření Omalovánek po `settleAlbumSwap` volá `movePagesToAlbum`
 *   a po podržení domečku v malování `paintingLeft`, který malování
 *   ukončí, uloží a pak přesune všechny stránky. Přesuny běží po jednom
 *   za sebou (`pageMoveQueue.ts`), takže souběžné volání nic neuloží
 *   dvakrát. Náhled se jen zhoupne s tónem domečku u stránky, kterou
 *   přesun právě zpracovává. Omalovánku, jejíž malování je vidět, přesun
 *   přeskočí, dokud z něj dítě neodejde (i do menu u jediné omalovánky).
 *   Přesun nikdy nevyhodí výjimku.
 * - Koště v malování (#142) vrátí podržením 1 s stránku malování, které
 *   scéna předala (`attachPainting`), na začátek (`clearPage`). Ťuknutí,
 *   kratší podržení a stránka stejná jako začátek koště jen zhoupnou
 *   s tónem domečku. Koště nic neudělá, když jiný prst maluje, během
 *   ukládání fotoaparátem, když se drží domeček a podržení začaté před
 *   zobrazením malování se nepočítá. Když se drží koště, domeček nic
 *   neudělá.
 * - Album ukazuje obrázky po stránkách s 12 obrázky od nejnovějšího (#149)
 *   a otevře se na 1. stránce. Stránka je na obrazovce alba i velkého
 *   obrázku, aby se album po zavření velkého obrázku vrátilo na stejnou
 *   stránku. Listuje se šipkami ◀ ▶ (`tapAlbumArrow`) a tahem prstu:
 *   scéna hlásí stisk a zvednutí prstu v CSS px (`albumPointerDown`,
 *   `albumPointerUp`) a výběr pozná tah (aspoň 48 px vodorovně a víc než
 *   svisle) a ťuknutí na náhled. Na kraji se šipka nebo náhledy jen
 *   zhoupnou s tónem domečku. Po nalistování scéna ukáže novou stránku
 *   a zavolá `albumPageShown`; do té doby ťuknutí na náhled nic neotevře
 *   a nelistuje se. Jeden tah nalistuje jen o jednu stránku, i když se
 *   alba dotýkají dva prsty. Po smazání obrázku zůstane album na stejné
 *   stránce, a když na ní žádný obrázek nezbyl, ukáže předchozí.
 * - Výběr ukazuje omalovánky po 12 ve stálém pořadí sady (#150) a listuje
 *   se stejně jako v albu (`pageTurner.ts`): šipky `tapPickerArrow`, prsty
 *   `pickerPointerDown`, `pickerPointerUp` a po nalistování
 *   `pickerPageShown`. `tapPreview` dostane místo na stránce, která je
 *   vidět. Stránka výběru se drží po celou dobu výběru (i během malování,
 *   v albu a po Malovat dál), nikam se neukládá a nový výběr začíná na
 *   1. stránce. Během listování ťuknutí na náhled ani na knihu nic neotevře.
 */

import type { Tone } from '../../../shared/audio/tonePlayer';
import type { HomeHoldDecision } from '../../../shared/logic/gameHost';
import { createHoldButton } from '../../../shared/logic/holdButton';
import type { HoldButton } from '../../../shared/logic/holdButton';
import { HOLD_TO_GO_HOME_MS, HOME_WOBBLE_TONES } from '../../../shared/logic/homeButton';
import type { KeyValueStorage } from '../../../shared/storage/keyValueStorage';
import type { GameRecords } from '../../../shared/storage/profileRecords';
import { albumEmptyPlaces, albumPageCount, albumPageEntries, removeAlbumEntry } from './album';
import type { AlbumContents, AlbumEntry, AlbumPicture } from './album';
import { planAlbumSwap, runAlbumSwap, swapBlocksPicture } from './albumSwap';
import { readPendingSwap } from './albumSwapRecord';
import type { SwapRun } from './albumSwap';
import { createPageMoveQueue } from './pageMoveQueue';
import type { PageMove } from './pageToAlbum';
import { createPageTurner, pageCountOf, pageItemsOf } from './pageTurner';
import type { AlbumDirection, AlbumPoint, AlbumTurn } from './pageTurner';
import { PICKER_PLACES } from './pickerLayout';
import type { PictureLocks } from './pictureLocks';
import { TOOL_PICK_TONES } from './toolPanel';
import type { ChangedArea } from './coloring';
import type { PictureIdentity, SavedColoring } from './savedPicture';

/**
 * Co je vidět: výběr, otevírání omalovánky, malování, album (#126), nebo
 * otevírání a zobrazení velkého obrázku `entry` z alba `entries` (#129).
 */
export type ColoringScreen =
  | { readonly kind: 'picker' }
  | { readonly kind: 'opening'; readonly picture: PictureIdentity }
  | { readonly kind: 'painting'; readonly picture: PictureIdentity }
  | {
      readonly kind: 'album';
      readonly entries: readonly AlbumEntry[];
      /** Stránka alba, která je vidět (#149, 0 je 1. stránka). */
      readonly page: number;
    }
  | {
      readonly kind: 'openingBigPicture';
      readonly entries: readonly AlbumEntry[];
      readonly entry: AlbumEntry;
      /** Stránka alba, na kterou se velký obrázek vrátí (#149). */
      readonly page: number;
    }
  | {
      readonly kind: 'bigPicture';
      readonly entries: readonly AlbumEntry[];
      readonly entry: AlbumEntry;
      /** Stránka alba, na kterou se velký obrázek vrátí (#149). */
      readonly page: number;
    };

export type { AlbumDirection, AlbumPoint, AlbumTurn } from './pageTurner';
export { ALBUM_SWIPE_MIN_CSS } from './pageTurner';

/** Co udělá zvednutí prstu v albu: nalistuje, zhoupne se na kraji, otevře velký obrázek, nebo nic. */
export type AlbumPointerResult = AlbumTurn | Extract<AlbumPreviewTap, { kind: 'open' | 'wobble' }>;

/**
 * Co udělá zvednutí prstu na výběru (#150): nalistuje, zhoupne se na kraji,
 * nebo se chová jako ťuknutí na náhled (`tapPreview`).
 */
export type PickerPointerResult = AlbumTurn | PreviewTap;

/** Omalovánek na jedné stránce výběru (#150 AC1), stejně jako míst v mřížce. */
export const PICKER_PAGE_SIZE = PICKER_PLACES;

/** Co udělá ťuknutí na knihu (#126 AC4). */
export type BookTap =
  /** Album se otevře s obrázky od nejnovějšího; kniha se zhoupne s tónem náhledu. */
  | {
      readonly kind: 'open';
      readonly tones: readonly Tone[];
      readonly entries: readonly AlbumEntry[];
    }
  /** Prázdné, nedostupné nebo nepřečtené album: kniha se jen zhoupne s tónem domečku. */
  | { readonly kind: 'wobble'; readonly tones: readonly Tone[] }
  /** Mimo výběr kniha nic nedělá. */
  | { readonly kind: 'ignored' };

/**
 * Co udělá ťuknutí na místo v albu: náhled otevře velký obrázek s tónem
 * náhledu (#129), prázdné okénko (#158 AC3) se zhoupne s tónem domečku,
 * jinak nic.
 */
export type AlbumPreviewTap =
  | {
      readonly kind: 'open';
      readonly index: number;
      readonly entry: AlbumEntry;
      readonly tones: readonly Tone[];
    }
  | { readonly kind: 'wobble'; readonly index: number; readonly tones: readonly Tone[] }
  | { readonly kind: 'ignored' };

/** Jak skončilo mazání obrázku košem (#129 AC3, AC4). */
export type TrashResult =
  /** Obrázek je smazaný, dítě je v albu bez něj, nebo s prázdným albem na výběru. */
  | { readonly kind: 'deleted' }
  /** Smazání se nepovedlo: obrázek je dál v albu a koš se zhoupne s tónem domečku. */
  | { readonly kind: 'failed'; readonly tones: readonly Tone[] };

/** Odezva koše na velkém obrázku, kterou scéna nakreslí (#129). */
export type TrashFeedback =
  /** Kroužek kolem koše se začal plnit (`true`), nebo zmizel (`false`). */
  | { readonly kind: 'trashHolding'; readonly holding: boolean }
  /** Ťuknutí, kratší podržení nebo koš během mazání: koš se jen zhoupne. */
  | { readonly kind: 'trashWobble'; readonly tones: readonly Tone[] }
  /** Podržení 1 s začalo mazat obrázek `entry`; `done` řekne, jak mazání skončilo. */
  | { readonly kind: 'deleting'; readonly entry: AlbumEntry; readonly done: Promise<TrashResult> };

/** Odezva koštěte v malování, kterou scéna nakreslí (#142). */
export type BroomFeedback =
  /** Kroužek kolem koštěte se začal plnit (`true`), nebo zmizel (`false`). */
  | { readonly kind: 'broomHolding'; readonly holding: boolean }
  /** Ťuknutí, kratší podržení nebo stránka stejná jako začátek: koště se jen zhoupne. */
  | { readonly kind: 'broomWobble'; readonly tones: readonly Tone[] }
  /** Stránka je zpátky na začátku: scéna překreslí `changed` a smete barvy. */
  | { readonly kind: 'cleared'; readonly changed: ChangedArea };

/**
 * Co udělá ťuknutí na náhled: otevře omalovánku s tónem, zhoupne se
 * s tónem domečku (výměna s albem, která se může vrátit, #131 AC5),
 * zhoupne zámek a ukazatel klíčů (zamčená bez klíče, #140 AC4), pošle
 * klíč do zámku zamčené (#159 AC2), odemkne zamčenou klíčem v zámku
 * a otevře ji (#140 AC5, #159 AC3), nebo nic.
 */
export type PreviewTap =
  | {
      readonly kind: 'open';
      readonly index: number;
      readonly picture: PictureIdentity;
      readonly tones: readonly Tone[];
    }
  | { readonly kind: 'wobble'; readonly tones: readonly Tone[] }
  | { readonly kind: 'locked'; readonly index: number; readonly tones: readonly Tone[] }
  /**
   * Klíč letí do zámku omalovánky na místě `index` z ukazatele (`from`
   * je `null`), nebo ze zámku náhledu na místě `from`; nic se nespotřebuje.
   */
  | {
      readonly kind: 'keyToLock';
      readonly index: number;
      readonly from: number | null;
      readonly tones: readonly Tone[];
    }
  | {
      readonly kind: 'unlocked';
      readonly index: number;
      readonly picture: PictureIdentity;
      readonly tones: readonly Tone[];
    }
  | { readonly kind: 'ignored' };

/** Jak skončila výměna po ťuknutí na štětec (#131). */
export type ContinueResult =
  /** Výměna proběhla, otevírá se malování omalovánky `picture` (scéna pak hlásí `paintingShown`). */
  | { readonly kind: 'opened'; readonly picture: PictureIdentity }
  /** Nic se nevyměnilo: dítě zůstane na velkém obrázku a štětec se zhoupne s tónem domečku. */
  | { readonly kind: 'failed'; readonly tones: readonly Tone[] };

/** Co udělá ťuknutí na štětec na velkém obrázku (#131). */
export type ContinueTap =
  /** Hned tón náhledu a zhoupnutí; výměna běží a `done` řekne, jak skončila. */
  | {
      readonly kind: 'swapping';
      readonly tones: readonly Tone[];
      readonly done: Promise<ContinueResult>;
    }
  /** Výměna nemůže začít: štětec se jen zhoupne s tónem domečku. */
  | { readonly kind: 'wobble'; readonly tones: readonly Tone[] }
  /** Ťuknutí se nepočítá. */
  | { readonly kind: 'ignored' };

/** Kde je klíč, který dítě poslalo do zámku (#159): omalovánka, místo na stránce a jestli už doletěl. */
export interface KeyInLock {
  readonly picture: PictureIdentity;
  readonly index: number;
  readonly landed: boolean;
}

/** Kam vede podržení domečku: na výběr, do menu, do alba (#129), nebo nikam. */
export type HomeHold = 'toPicker' | 'toMenu' | 'toAlbum' | 'ignored';

/** Jak dlouho se drží koš, aby smazal obrázek (#129 AC3, jako „Smazat“ u profilu). */
export const TRASH_HOLD_MS = 1000;

/** Jak dlouho se drží koště, aby vrátilo stránku na začátek (#142 AC1, jako koš). */
export const BROOM_HOLD_MS = TRASH_HOLD_MS;

/** Jak dlouho letí klíč z ukazatele do zámku (#159 AC2). */
export const KEY_FLIGHT_MS = 500;

/** Jak dlouho klíč v zámku čeká na druhé ťuknutí, počítáno od doletu (#159 AC4). */
export const KEY_WAIT_MS = 5000;

/**
 * Tón prvního ťuknutí na zamčenou omalovánku, kdy klíč letí do zámku
 * (#159): krátký tón výběru nástroje, jiný než otevření omalovánky.
 */
export const KEY_SEND_TONES: readonly Tone[] = TOOL_PICK_TONES;

/** Tón ťuknutí na náhled: krátký vzestupný dvojtón. */
export const PREVIEW_TAP_TONES: readonly Tone[] = [
  { frequencyHz: 659.25, startSeconds: 0, durationSeconds: 0.09, volume: 0.13 },
  { frequencyHz: 880, startSeconds: 0.08, durationSeconds: 0.12, volume: 0.13 },
];

export interface PictureChoice {
  /** Omalovánky na výběru v pořadí sady (všechny stránky); při jediné omalovánce žádné. */
  previews(): readonly PictureIdentity[];
  /**
   * Stránka výběru, která je vidět (#150, 0 je 1. stránka); během
   * otevírání, malování a v albu stránka, na kterou se výběr vrátí.
   */
  pickerPage(): number;
  /** Omalovánky stránky výběru, která je vidět, v pořadí sady (nejvýš 12, #150). */
  pagePreviews(): readonly PictureIdentity[];
  screen(): ColoringScreen;
  /** Ťuknutí na místo náhledu `place` (0–11) na stránce výběru, která je vidět. */
  tapPreview(place: number): PreviewTap;
  /** Ťuknutí na šipku ◀ (`previous`), nebo ▶ (`next`) na výběru (#150). */
  tapPickerArrow(direction: AlbumDirection): AlbumTurn;
  /** Prst `pointerId` se na výběru dotkl v bodě `point` (CSS px) na místě náhledu `place`, nebo mimo (`null`). */
  pickerPointerDown(pointerId: number, point: AlbumPoint, place: number | null): void;
  /** Prst `pointerId` se na výběru zvedl v bodě `point` (CSS px): tah nalistuje, ťuknutí je `tapPreview`. */
  pickerPointerUp(pointerId: number, point: AlbumPoint): PickerPointerResult;
  /** Prohlížeč dotyk na výběru zrušil: prst `pointerId` (bez čísla všechny) se zapomene (#150). */
  pickerPointerCancel(pointerId?: number): void;
  /** Scéna ukázala nalistovanou stránku výběru (#150). */
  pickerPageShown(): void;
  /** Scéna ukázala malování otevírané omalovánky. */
  paintingShown(): void;
  /** Klíč doletěl do zámku (#159 AC2); do té doby ho druhé ťuknutí neutratí. */
  keyLanded(): void;
  /** Kde je klíč poslaný do zámku; `null`, když je v ukazateli (#159). */
  keyInLock(): KeyInLock | null;
  /** Domeček se držel 1 s. */
  holdHome(): HomeHold;
  /** Ťuknutí na knihu s albem, jak ho scéna přečetla; `null`, když ještě není přečtené. */
  tapBook(album: AlbumContents | null): BookTap;
  /** Ťuknutí na místo náhledu `index` na stránce alba, která je vidět. */
  tapAlbumPreview(index: number): AlbumPreviewTap;
  /** Ťuknutí na šipku ◀ (`previous`), nebo ▶ (`next`) v albu (#149). */
  tapAlbumArrow(direction: AlbumDirection): AlbumTurn;
  /** Prst `pointerId` se v albu dotkl v bodě `point` (CSS px) na místě náhledu `place`, nebo mimo (`null`). */
  albumPointerDown(pointerId: number, point: AlbumPoint, place: number | null): void;
  /** Prst `pointerId` se v albu zvedl v bodě `point` (CSS px): tah nalistuje, ťuknutí otevře náhled. */
  albumPointerUp(pointerId: number, point: AlbumPoint): AlbumPointerResult;
  /** Prohlížeč dotyk v albu zrušil: prst `pointerId` (bez čísla všechny) se zapomene (#150). */
  albumPointerCancel(pointerId?: number): void;
  /** Scéna ukázala nalistovanou stránku alba (#149). */
  albumPageShown(): void;
  /** Scéna ukázala otevíraný velký obrázek (#129). */
  bigPictureShown(): void;
  /** Koš na velkém obrázku: scéna mu předává stisk, zvednutí a sjetí prstu (#129 AC3). */
  readonly trashButton: HoldButton;
  /** Koště v malování: scéna mu předává stisk, zvednutí, přerušení a sjetí prstu (#142). */
  readonly broomButton: HoldButton;
  /** Scéna předá malování, které otevřela; koště pak vrací jeho stránku (#142). */
  attachPainting(game: SavedColoring): void;
  /** Stránka hlásí, že se domeček začal (`true`), nebo přestal (`false`) držet (#129 AC5). */
  homeHolding(holding: boolean): void;
  /** Ťuknutí na štětec na velkém obrázku (#131). */
  tapContinue(): ContinueTap;
  /**
   * Při otevření Omalovánek, po `settleAlbumSwap` (#141 AC4): přesune
   * rozmalované stránky do alba v pořadí sady. Vrátí stránky, které
   * zkusil přesunout; nikdy neskončí zamítnutým slibem.
   */
  movePagesToAlbum(): Promise<readonly PageMove[]>;
  /**
   * Po podržení domečku v malování (`toPicker`, u jediné omalovánky
   * i `toMenu`, #141 AC1): ukončí tah, uloží malování `game`, počká na
   * rozběhnuté ukládání fotoaparátem a přesune všechny stránky do alba.
   */
  paintingLeft(game: SavedColoring): Promise<readonly PageMove[]>;
  /**
   * Skončí, až přesuny do alba, které běží nebo čekají, vyřídí stránku
   * omalovánky `picture`; jinak hned (#141). Malování čte stránku až po
   * něm, aby nezačalo se stránkou, kterou přesun vzápětí vyčistí.
   */
  pageSettled(picture: PictureIdentity): Promise<void>;
}

export interface PictureChoiceOptions {
  /** Hodiny v ms (v testech zkušební). */
  readonly now?: () => number;
  /** Záznamy aktivního profilu, ze kterých koš maže (#129); bez nich se smazání nepovede. */
  readonly records?: GameRecords | undefined;
  /** Odezva koše pro scénu (#129). */
  readonly onTrash?: (feedback: TrashFeedback) => void;
  /** Odezva koštěte v malování pro scénu (#142). */
  readonly onBroom?: (feedback: BroomFeedback) => void;
  /** Úložiště hry aktivního profilu s rozmalovanými stránkami (#131); bez něj se nic nevymění. */
  readonly storage?: KeyValueStorage | undefined;
  /**
   * Omalovánky sady i s obrysem (#131), pole nebo funkce, protože scéna
   * obrysy připravuje postupně. Omalovánka bez obrysu se nevymění.
   */
  readonly albumPictures?: readonly AlbumPicture[] | (() => readonly AlbumPicture[]);
  /** Zámky omalovánek (#140); bez nich jsou všechny omalovánky odemčené. */
  readonly locks?: PictureLocks | undefined;
}

/** Co má stránka udělat po podržení domečku: do menu odejít, jinak zůstat ve hře. */
export function homeHoldDecision(hold: HomeHold): HomeHoldDecision {
  return hold === 'toMenu' ? 'leave' : 'stay';
}

/**
 * Album bez obrázku `removed`; prázdné album je výběr (#129 AC3). Album
 * zůstane na stránce `page`, a když na ní nic nezbylo, ukáže předchozí (#149 AC4).
 */
function screenWithout(
  entries: readonly AlbumEntry[],
  removed: AlbumEntry,
  page: number,
): ColoringScreen {
  const left = entries.filter((entry) => entry.recordId !== removed.recordId);
  if (left.length === 0) {
    return { kind: 'picker' };
  }
  return { kind: 'album', entries: left, page: Math.min(page, albumPageCount(left.length) - 1) };
}

/** Album bez obrázku `replaced` a s obrázkem `returned` jako nejnovějším (#131 AC4). */
function entriesWithReturned(
  entries: readonly AlbumEntry[],
  replaced: AlbumEntry,
  returned: AlbumEntry,
): AlbumEntry[] {
  return [returned, ...entries.filter((entry) => entry.recordId !== replaced.recordId)];
}

/** Označení omalovánky i s verzí obrysu. */
function pictureKey(picture: PictureIdentity): string {
  return `${picture.id}@${picture.version}`;
}

/** Výběr nad sadou `pictures`. */
export function startPictureChoice(
  pictures: readonly PictureIdentity[],
  options: PictureChoiceOptions = {},
): PictureChoice {
  const now = options.now ?? (() => Date.now());
  const onTrash = options.onTrash ?? (() => undefined);
  const onBroom = options.onBroom ?? (() => undefined);
  const onlyPicture = pictures.length === 1 ? pictures[0] : undefined;
  let screen: ColoringScreen =
    onlyPicture === undefined ? { kind: 'picker' } : { kind: 'opening', picture: onlyPicture };
  /** Kdy se naposledy ukázalo malování nebo velký obrázek. */
  let shownAt = Number.NEGATIVE_INFINITY;
  /** Drží teď dítě domeček (hlásí stránka, #129 AC5)? */
  let homeHeld = false;
  /** Maže se teď obrázek z alba? */
  let deleting = false;
  /** Domeček se podržel během mazání: po mazání se ukáže album (#129 AC3). */
  let homeAfterDeleting = false;
  /** Běží výměna stránky a obrázku z alba (#131)? */
  let swapping = false;
  /** Omalovánky, u kterých tahle stránka ví, že A z alba při výměně zmizel (#131). */
  const albumRemovedFor = new Set<string>();

  const albumPictures = (): readonly AlbumPicture[] => {
    const given = options.albumPictures ?? [];
    return typeof given === 'function' ? given() : given;
  };
  const albumPictureOf = (picture: PictureIdentity): AlbumPicture | undefined =>
    albumPictures().find(
      (each) => each.identity.id === picture.id && each.identity.version === picture.version,
    );
  /** Náhled se jen zhoupne: výměna té omalovánky se může ještě vrátit (#131 AC5). */
  const previewBlocked = (picture: PictureIdentity): boolean => {
    const removedNow = albumRemovedFor.has(pictureKey(picture));
    const withOutline = albumPictureOf(picture);
    if (withOutline !== undefined) {
      return swapBlocksPicture(options.storage, withOutline, removedNow);
    }
    // Obrys ještě není připravený (scéna ho chystá postupně): bez něj nejde
    // poznat, co je na stránce, takže odložená výměna té omalovánky náhled
    // zablokuje, dokud o ní nerozhodne `settleAlbumSwap`.
    const swap = options.storage === undefined ? null : readPendingSwap(options.storage);
    return (
      swap !== null &&
      !swap.albumRemoved &&
      !removedNow &&
      swap.pictureId === picture.id &&
      swap.pictureVersion === picture.version
    );
  };

  /**
   * Odešlo už dítě z malování, které je vidět (`paintingLeft`, i po
   * podržení domečku do menu u jediné omalovánky)? (#141)
   */
  let paintingEnded = false;

  /**
   * Maluje se právě v omalovánce (malování je vidět a dítě z něj ještě
   * neodešlo)? Přesun ji přeskočí; otevírající se omalovánku ne (#141).
   */
  const isOpen = (picture: PictureIdentity): boolean =>
    screen.kind === 'painting' &&
    !paintingEnded &&
    pictureKey(screen.picture) === pictureKey(picture);

  /** Přesuny rozmalovaných stránek do alba po jednom (#141). */
  const pageMoves = createPageMoveQueue({
    storage: options.storage,
    records: options.records,
    pictures: albumPictures,
    isOpen,
  });

  /** Začalo podržení až ve chvíli, kdy bylo malování nebo velký obrázek vidět? */
  const heldSinceShown = (): boolean => now() - shownAt >= HOLD_TO_GO_HOME_MS;

  const wobbleTrash = (): void => onTrash({ kind: 'trashWobble', tones: HOME_WOBBLE_TONES });

  /** Smaže obrázek velkého obrázku a podle výsledku přepne obrazovku. */
  const startDeleting = (): void => {
    if (screen.kind !== 'bigPicture') {
      return;
    }
    const shown = screen;
    deleting = true;
    homeAfterDeleting = false;
    const done = removeAlbumEntry(options.records, shown.entry.recordId).then(
      (removal): TrashResult => {
        deleting = false;
        const backToAlbum = homeAfterDeleting;
        homeAfterDeleting = false;
        if (removal === 'removed') {
          screen = screenWithout(shown.entries, shown.entry, shown.page);
          return { kind: 'deleted' };
        }
        if (backToAlbum) {
          screen = { kind: 'album', entries: shown.entries, page: shown.page };
        }
        return { kind: 'failed', tones: HOME_WOBBLE_TONES };
      },
    );
    onTrash({ kind: 'deleting', entry: shown.entry, done });
  };

  const trashHold = createHoldButton({
    holdMs: TRASH_HOLD_MS,
    isEnabled: () => screen.kind === 'bigPicture' && !deleting && !homeHeld && !swapping,
    onHoldComplete: startDeleting,
    onTap: wobbleTrash,
    onHoldingChange: (holding) => onTrash({ kind: 'trashHolding', holding }),
  });

  /** Koš: během mazání jen zhoupne, při drženém domečku nic, jinak podržení 1 s. */
  const trashButton: HoldButton = {
    press: (pointerId) => {
      if (screen.kind !== 'bigPicture' || homeHeld || swapping) {
        return;
      }
      if (deleting) {
        wobbleTrash();
        return;
      }
      trashHold.press(pointerId);
    },
    release: (pointerId) => trashHold.release(pointerId),
    cancel: (pointerId) => trashHold.cancel(pointerId),
    leave: (pointerId) => trashHold.leave(pointerId),
    isHolding: () => trashHold.isHolding(),
    dispose: () => trashHold.dispose(),
  };

  /** Malování, které scéna otevřela a předala (#142); koště vrací jeho stránku. */
  let painting: SavedColoring | null = null;

  /** Je vidět malování, ze kterého dítě neodešlo, a koště ho může vrátit? */
  const broomEnabled = (): boolean =>
    screen.kind === 'painting' &&
    !paintingEnded &&
    !homeHeld &&
    painting !== null &&
    painting.canUseBroom();

  const clearPainting = (): void => {
    const result = painting?.clearPage() ?? { kind: 'ignored' };
    switch (result.kind) {
      case 'cleared':
        onBroom({ kind: 'cleared', changed: result.changed });
        return;
      case 'unchanged':
        onBroom({ kind: 'broomWobble', tones: HOME_WOBBLE_TONES });
        return;
      case 'ignored':
        return;
    }
  };

  const broomButton = createHoldButton({
    holdMs: BROOM_HOLD_MS,
    isEnabled: broomEnabled,
    onHoldComplete: clearPainting,
    onTap: () => onBroom({ kind: 'broomWobble', tones: HOME_WOBBLE_TONES }),
    onHoldingChange: (holding) => {
      painting?.broomHolding(holding);
      onBroom({ kind: 'broomHolding', holding });
    },
  });

  /** Domeček z velkého obrázku: do alba, během mazání až po mazání. */
  const homeFromBigPicture = (shown: Extract<ColoringScreen, { kind: 'bigPicture' }>): HomeHold => {
    if (trashHold.isHolding() || swapping || !heldSinceShown()) {
      return 'ignored';
    }
    if (deleting) {
      homeAfterDeleting = true;
      return 'toAlbum';
    }
    screen = { kind: 'album', entries: shown.entries, page: shown.page };
    return 'toAlbum';
  };

  /** Po výměně: malování té omalovánky se otevírá, nebo dítě zůstane na velkém obrázku. */
  const afterSwap = (
    shown: Extract<ColoringScreen, { kind: 'bigPicture' }>,
    run: SwapRun,
  ): ContinueResult => {
    swapping = false;
    const picture = shown.entry.picture;
    switch (run.kind) {
      case 'swapped':
      case 'deferred':
        albumRemovedFor.add(pictureKey(picture));
        screen = { kind: 'opening', picture };
        return { kind: 'opened', picture };
      case 'restored':
        screen = {
          kind: 'bigPicture',
          entries: entriesWithReturned(shown.entries, shown.entry, run.entry),
          entry: run.entry,
          page: shown.page,
        };
        return { kind: 'failed', tones: HOME_WOBBLE_TONES };
      case 'kept':
        return { kind: 'failed', tones: HOME_WOBBLE_TONES };
    }
  };

  /** Štětec na velkém obrázku (#131): výměna a otevření malování. */
  const tapContinue = (): ContinueTap => {
    if (screen.kind !== 'bigPicture' || swapping || deleting || homeHeld || trashHold.isHolding()) {
      return { kind: 'ignored' };
    }
    const shown = screen;
    const plan = planAlbumSwap({
      storage: options.storage,
      records: options.records,
      pictures: albumPictures(),
      entry: shown.entry,
    });
    if (plan === null) {
      return { kind: 'wobble', tones: HOME_WOBBLE_TONES };
    }
    swapping = true;
    albumRemovedFor.delete(pictureKey(shown.entry.picture));
    const done = runAlbumSwap(plan).then((run) => afterSwap(shown, run));
    return { kind: 'swapping', tones: PREVIEW_TAP_TONES, done };
  };

  /** Listování v albu (#149): stránka je na obrazovce alba. */
  const albumPages = createPageTurner({
    isActive: () => screen.kind === 'album',
    pageCount: () => (screen.kind === 'album' ? albumPageCount(screen.entries.length) : 0),
    page: () => (screen.kind === 'album' ? screen.page : 0),
    showPage: (page) => {
      if (screen.kind === 'album') {
        screen = { kind: 'album', entries: screen.entries, page };
      }
    },
    turnTones: PREVIEW_TAP_TONES,
  });

  /** Ťuknutí na místo `index` na stránce alba, která je vidět (#129, #149). */
  const tapAlbumPreview = (index: number): AlbumPreviewTap => {
    if (screen.kind !== 'album' || albumPages.isTurning() || !Number.isInteger(index)) {
      return { kind: 'ignored' };
    }
    const entry = albumPageEntries(screen.entries, screen.page)[index];
    if (entry === undefined) {
      // Okénko na volném místě stránky jen zhoupne (#158 AC3).
      const emptyPlace = albumEmptyPlaces(screen.entries.length, screen.page).includes(index);
      return emptyPlace ? { kind: 'wobble', index, tones: HOME_WOBBLE_TONES } : { kind: 'ignored' };
    }
    screen = { kind: 'openingBigPicture', entries: screen.entries, entry, page: screen.page };
    albumPages.forgetPointers();
    return { kind: 'open', index, entry, tones: PREVIEW_TAP_TONES };
  };

  /**
   * Stránka výběru, která je vidět (#150). Drží se i během malování a alba,
   * aby se výběr vrátil na stejnou stránku; nikam se neukládá (AC2).
   */
  let pickerPage = 0;
  /** Omalovánky na výběru: při jediné omalovánce se výběr přeskočí. */
  const pickerPictures: readonly PictureIdentity[] = onlyPicture === undefined ? pictures : [];

  /** Listování na výběru (#150), stejné jako v albu. */
  const pickerPages = createPageTurner({
    isActive: () => screen.kind === 'picker',
    pageCount: () => pageCountOf(pickerPictures.length, PICKER_PAGE_SIZE),
    page: () => pickerPage,
    showPage: (page) => {
      pickerPage = page;
    },
    turnTones: PREVIEW_TAP_TONES,
  });

  /**
   * Klíč poslaný do zámku (#159): omalovánka, místo na stránce, kdy vyletěl
   * a kdy doletěl (`null` za letu). V ukazateli je klíč, když je `null`.
   */
  let sentKey: {
    readonly picture: PictureIdentity;
    readonly index: number;
    readonly sentAt: number;
    readonly landedAt: number | null;
  } | null = null;

  /**
   * Klíč poslaný do zámku, nebo `null`. Po 5 s v zámku bez ťuknutí se
   * vrátí do ukazatele (#159 AC4). Klíč, o jehož doletu scéna nedala
   * vědět (scéna skončila), se vrátí po stejné době od doletu podle plánu.
   */
  const currentKey = (): typeof sentKey => {
    if (sentKey === null) {
      return null;
    }
    const returnsAt =
      sentKey.landedAt === null
        ? sentKey.sentAt + KEY_FLIGHT_MS + KEY_WAIT_MS
        : sentKey.landedAt + KEY_WAIT_MS;
    if (now() >= returnsAt) {
      sentKey = null;
    }
    return sentKey;
  };

  /** Klíč se vrátí do ukazatele (ťuknutí jinam, listování, kniha, domeček, #159 AC4). */
  const returnKey = (): void => {
    sentKey = null;
  };

  /**
   * Ťuknutí na zamčenou omalovánku `picture` na místě `place` (#140, #159):
   * bez celého klíče se zhoupne, s klíčem v jejím zámku se odemkne, jinak
   * k ní klíč vyletí.
   */
  const tapLocked = (picture: PictureIdentity, place: number): PreviewTap => {
    const key = currentKey();
    const keyHere = key !== null && pictureKey(key.picture) === pictureKey(picture);
    if (keyHere && key.landedAt === null) {
      // Ťuknutí za letu klíče nic nespotřebuje (#159 AC3).
      return { kind: 'ignored' };
    }
    if (!keyHere) {
      // Klíč vyletí, jen když ho druhé ťuknutí může utratit (#159 AC5, #140 AC2).
      if (options.locks?.canUnlock(picture) !== true) {
        returnKey();
        return { kind: 'locked', index: place, tones: HOME_WOBBLE_TONES };
      }
      sentKey = { picture, index: place, sentAt: now(), landedAt: null };
      return {
        kind: 'keyToLock',
        index: place,
        from: key?.index ?? null,
        tones: KEY_SEND_TONES,
      };
    }
    returnKey();
    const unlock = options.locks?.unlock(picture) ?? 'alreadyUnlocked';
    if (unlock === 'noKey') {
      // Celý klíč mezitím utratil jiný panel (#140 AC6), nebo jde odemknout jen
      // později (#140 AC2): klíč se vrátí do ukazatele a zámek se jen zhoupne (AC4).
      return { kind: 'locked', index: place, tones: HOME_WOBBLE_TONES };
    }
    screen = { kind: 'opening', picture };
    pickerPages.forgetPointers();
    if (unlock === 'unlocked') {
      return { kind: 'unlocked', index: place, picture, tones: PREVIEW_TAP_TONES };
    }
    return { kind: 'open', index: place, picture, tones: PREVIEW_TAP_TONES };
  };

  /** Ťuknutí na místo `place` na stránce výběru, která je vidět (#124, #150). */
  const tapPreview = (place: number): PreviewTap => {
    const onPage = Number.isInteger(place) && place >= 0 && place < PICKER_PAGE_SIZE;
    const picture = onPage ? pickerPictures[pickerPage * PICKER_PAGE_SIZE + place] : undefined;
    if (screen.kind !== 'picker' || pickerPages.isTurning() || picture === undefined) {
      return { kind: 'ignored' };
    }
    if (pageMoves.isMoving(picture) || previewBlocked(picture)) {
      // Stránka jde do alba (#141 AC4), nebo se výměna může vrátit (#131 AC5).
      returnKey();
      return { kind: 'wobble', tones: HOME_WOBBLE_TONES };
    }
    if (options.locks?.isLocked(picture) === true) {
      return tapLocked(picture, place);
    }
    returnKey();
    screen = { kind: 'opening', picture };
    pickerPages.forgetPointers();
    return { kind: 'open', index: place, picture, tones: PREVIEW_TAP_TONES };
  };

  /**
   * Zvednutí prstu na výběru: ťuknutí na náhled je `tapPreview`, cokoli
   * jiného (tah, ťuknutí na prázdné místo) vrátí klíč do ukazatele (#159 AC4).
   */
  const pickerPointerUp = (pointerId: number, point: AlbumPoint): PickerPointerResult => {
    let tappedPreview = false;
    const result = pickerPages.pointerUp(pointerId, point, (place) => {
      tappedPreview = true;
      return tapPreview(place);
    });
    if (!tappedPreview && screen.kind === 'picker') {
      returnKey();
    }
    return result;
  };

  return {
    previews: () => pickerPictures,
    pickerPage: () => pickerPage,
    pagePreviews: () => pageItemsOf(pickerPictures, pickerPage, PICKER_PAGE_SIZE),
    screen: () => screen,
    tapPreview,
    tapPickerArrow: (direction) => {
      if (screen.kind === 'picker') {
        returnKey();
      }
      return pickerPages.arrow(direction);
    },
    pickerPointerDown: (pointerId, point, place) =>
      pickerPages.pointerDown(pointerId, point, place),
    pickerPointerUp,
    pickerPointerCancel: (pointerId) => pickerPages.pointerCancel(pointerId),
    pickerPageShown: () => pickerPages.pageShown(),
    paintingShown: () => {
      if (screen.kind !== 'opening') {
        return;
      }
      screen = { kind: 'painting', picture: screen.picture };
      paintingEnded = false;
      shownAt = now();
    },
    keyLanded: () => {
      if (sentKey !== null && sentKey.landedAt === null) {
        sentKey = { ...sentKey, landedAt: now() };
      }
    },
    keyInLock: () => {
      const key = currentKey();
      return key === null
        ? null
        : { picture: key.picture, index: key.index, landed: key.landedAt !== null };
    },
    tapBook: (album) => {
      // Během listování výběru ťuknutí nic neotevře (#150 AC4).
      if (screen.kind !== 'picker' || pickerPages.isTurning()) {
        return { kind: 'ignored' };
      }
      returnKey();
      if (album === null || album.status !== 'read' || album.entries.length === 0) {
        return { kind: 'wobble', tones: HOME_WOBBLE_TONES };
      }
      screen = { kind: 'album', entries: album.entries, page: 0 };
      albumPages.reset();
      pickerPages.forgetPointers();
      return { kind: 'open', tones: PREVIEW_TAP_TONES, entries: album.entries };
    },
    tapAlbumPreview,
    tapAlbumArrow: (direction) => albumPages.arrow(direction),
    albumPointerDown: (pointerId, point, place) => albumPages.pointerDown(pointerId, point, place),
    albumPointerUp: (pointerId, point): AlbumPointerResult =>
      albumPages.pointerUp(pointerId, point, (place) => {
        const tap = tapAlbumPreview(place);
        return tap.kind === 'ignored' ? { kind: 'ignored' as const } : tap;
      }),
    albumPointerCancel: (pointerId) => albumPages.pointerCancel(pointerId),
    albumPageShown: () => albumPages.pageShown(),
    bigPictureShown: () => {
      if (screen.kind !== 'openingBigPicture') {
        return;
      }
      screen = {
        kind: 'bigPicture',
        entries: screen.entries,
        entry: screen.entry,
        page: screen.page,
      };
      shownAt = now();
    },
    trashButton,
    broomButton,
    attachPainting: (game) => {
      painting = game;
    },
    homeHolding: (holding) => {
      homeHeld = holding;
      // Během držení domečku tlačítka rychlého přepínání v malování nic nedělají (#148 AC6).
      painting?.homeHolding(holding);
    },
    tapContinue,
    movePagesToAlbum: () => pageMoves.enqueue(Promise.resolve()),
    paintingLeft: (game) => {
      paintingEnded = true;
      return pageMoves.enqueue(game.leave());
    },
    pageSettled: (picture) => pageMoves.pageSettled(picture),
    holdHome: () => {
      switch (screen.kind) {
        case 'album':
          screen = { kind: 'picker' };
          return 'toPicker';
        case 'picker':
          returnKey();
          return 'toMenu';
        case 'opening':
        case 'openingBigPicture':
          return 'ignored';
        case 'bigPicture':
          return homeFromBigPicture(screen);
        case 'painting':
          if (!heldSinceShown() || broomButton.isHolding()) {
            return 'ignored';
          }
          if (onlyPicture !== undefined) {
            return 'toMenu';
          }
          screen = { kind: 'picker' };
          return 'toPicker';
      }
    },
  };
}
