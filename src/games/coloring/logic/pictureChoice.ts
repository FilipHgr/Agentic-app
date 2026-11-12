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
 *   (AC4). S celým klíčem ťuknutí klíč utratí, zámek se otevře
 *   a omalovánka se otevírá jako po ťuknutí na odemčenou (AC5). Během
 *   otevírání se další ťuknutí nepočítá, takže se utratí jen jeden klíč (AC6).
 */

import type { Tone } from '../../../shared/audio/tonePlayer';
import type { HomeHoldDecision } from '../../../shared/logic/gameHost';
import { createHoldButton } from '../../../shared/logic/holdButton';
import type { HoldButton } from '../../../shared/logic/holdButton';
import { HOLD_TO_GO_HOME_MS, HOME_WOBBLE_TONES } from '../../../shared/logic/homeButton';
import type { KeyValueStorage } from '../../../shared/storage/keyValueStorage';
import type { GameRecords } from '../../../shared/storage/profileRecords';
import { removeAlbumEntry } from './album';
import type { AlbumContents, AlbumEntry, AlbumPicture } from './album';
import { planAlbumSwap, runAlbumSwap, swapBlocksPicture } from './albumSwap';
import { readPendingSwap } from './albumSwapRecord';
import type { SwapRun } from './albumSwap';
import type { PictureLocks } from './pictureLocks';
import type { PictureIdentity } from './savedPicture';

/**
 * Co je vidět: výběr, otevírání omalovánky, malování, album (#126), nebo
 * otevírání a zobrazení velkého obrázku `entry` z alba `entries` (#129).
 */
export type ColoringScreen =
  | { readonly kind: 'picker' }
  | { readonly kind: 'opening'; readonly picture: PictureIdentity }
  | { readonly kind: 'painting'; readonly picture: PictureIdentity }
  | { readonly kind: 'album'; readonly entries: readonly AlbumEntry[] }
  | {
      readonly kind: 'openingBigPicture';
      readonly entries: readonly AlbumEntry[];
      readonly entry: AlbumEntry;
    }
  | {
      readonly kind: 'bigPicture';
      readonly entries: readonly AlbumEntry[];
      readonly entry: AlbumEntry;
    };

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

/** Co udělá ťuknutí na náhled v albu: otevře velký obrázek s tónem náhledu (#129), nebo nic. */
export type AlbumPreviewTap =
  | {
      readonly kind: 'open';
      readonly index: number;
      readonly entry: AlbumEntry;
      readonly tones: readonly Tone[];
    }
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

/**
 * Co udělá ťuknutí na náhled: otevře omalovánku s tónem, zhoupne se
 * s tónem domečku (výměna s albem, která se může vrátit, #131 AC5),
 * zhoupne zámek a ukazatel klíčů (zamčená bez klíče, #140 AC4), odemkne
 * zamčenou klíčem a otevře ji (#140 AC5), nebo nic.
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

/** Kam vede podržení domečku: na výběr, do menu, do alba (#129), nebo nikam. */
export type HomeHold = 'toPicker' | 'toMenu' | 'toAlbum' | 'ignored';

/** Jak dlouho se drží koš, aby smazal obrázek (#129 AC3, jako „Smazat“ u profilu). */
export const TRASH_HOLD_MS = 1000;

/** Tón ťuknutí na náhled: krátký vzestupný dvojtón. */
export const PREVIEW_TAP_TONES: readonly Tone[] = [
  { frequencyHz: 659.25, startSeconds: 0, durationSeconds: 0.09, volume: 0.13 },
  { frequencyHz: 880, startSeconds: 0.08, durationSeconds: 0.12, volume: 0.13 },
];

export interface PictureChoice {
  /** Omalovánky na výběru v pořadí náhledů; při jediné omalovánce žádné. */
  previews(): readonly PictureIdentity[];
  screen(): ColoringScreen;
  /** Ťuknutí na náhled `index`. */
  tapPreview(index: number): PreviewTap;
  /** Scéna ukázala malování otevírané omalovánky. */
  paintingShown(): void;
  /** Domeček se držel 1 s. */
  holdHome(): HomeHold;
  /** Ťuknutí na knihu s albem, jak ho scéna přečetla; `null`, když ještě není přečtené. */
  tapBook(album: AlbumContents | null): BookTap;
  /** Ťuknutí na náhled `index` v albu. */
  tapAlbumPreview(index: number): AlbumPreviewTap;
  /** Scéna ukázala otevíraný velký obrázek (#129). */
  bigPictureShown(): void;
  /** Koš na velkém obrázku: scéna mu předává stisk, zvednutí a sjetí prstu (#129 AC3). */
  readonly trashButton: HoldButton;
  /** Stránka hlásí, že se domeček začal (`true`), nebo přestal (`false`) držet (#129 AC5). */
  homeHolding(holding: boolean): void;
  /** Ťuknutí na štětec na velkém obrázku (#131). */
  tapContinue(): ContinueTap;
}

export interface PictureChoiceOptions {
  /** Hodiny v ms (v testech zkušební). */
  readonly now?: () => number;
  /** Záznamy aktivního profilu, ze kterých koš maže (#129); bez nich se smazání nepovede. */
  readonly records?: GameRecords | undefined;
  /** Odezva koše pro scénu (#129). */
  readonly onTrash?: (feedback: TrashFeedback) => void;
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

/** Album bez obrázku `removed`; prázdné album je výběr (#129 AC3). */
function screenWithout(entries: readonly AlbumEntry[], removed: AlbumEntry): ColoringScreen {
  const left = entries.filter((entry) => entry.recordId !== removed.recordId);
  return left.length === 0 ? { kind: 'picker' } : { kind: 'album', entries: left };
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
          screen = screenWithout(shown.entries, shown.entry);
          return { kind: 'deleted' };
        }
        if (backToAlbum) {
          screen = { kind: 'album', entries: shown.entries };
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

  /** Domeček z velkého obrázku: do alba, během mazání až po mazání. */
  const homeFromBigPicture = (shown: Extract<ColoringScreen, { kind: 'bigPicture' }>): HomeHold => {
    if (trashHold.isHolding() || swapping || !heldSinceShown()) {
      return 'ignored';
    }
    if (deleting) {
      homeAfterDeleting = true;
      return 'toAlbum';
    }
    screen = { kind: 'album', entries: shown.entries };
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

  return {
    previews: () => (onlyPicture === undefined ? pictures : []),
    screen: () => screen,
    tapPreview: (index) => {
      const picture = Number.isInteger(index) ? pictures[index] : undefined;
      if (screen.kind !== 'picker' || picture === undefined) {
        return { kind: 'ignored' };
      }
      if (previewBlocked(picture)) {
        return { kind: 'wobble', tones: HOME_WOBBLE_TONES };
      }
      const unlock =
        options.locks?.isLocked(picture) === true ? options.locks.unlock(picture) : null;
      if (unlock === 'noKey') {
        return { kind: 'locked', index, tones: HOME_WOBBLE_TONES };
      }
      screen = { kind: 'opening', picture };
      if (unlock === 'unlocked') {
        return { kind: 'unlocked', index, picture, tones: PREVIEW_TAP_TONES };
      }
      return { kind: 'open', index, picture, tones: PREVIEW_TAP_TONES };
    },
    paintingShown: () => {
      if (screen.kind !== 'opening') {
        return;
      }
      screen = { kind: 'painting', picture: screen.picture };
      shownAt = now();
    },
    tapBook: (album) => {
      if (screen.kind !== 'picker') {
        return { kind: 'ignored' };
      }
      if (album === null || album.status !== 'read' || album.entries.length === 0) {
        return { kind: 'wobble', tones: HOME_WOBBLE_TONES };
      }
      screen = { kind: 'album', entries: album.entries };
      return { kind: 'open', tones: PREVIEW_TAP_TONES, entries: album.entries };
    },
    tapAlbumPreview: (index) => {
      if (screen.kind !== 'album' || !Number.isInteger(index)) {
        return { kind: 'ignored' };
      }
      const entry = screen.entries[index];
      if (entry === undefined) {
        return { kind: 'ignored' };
      }
      screen = { kind: 'openingBigPicture', entries: screen.entries, entry };
      return { kind: 'open', index, entry, tones: PREVIEW_TAP_TONES };
    },
    bigPictureShown: () => {
      if (screen.kind !== 'openingBigPicture') {
        return;
      }
      screen = { kind: 'bigPicture', entries: screen.entries, entry: screen.entry };
      shownAt = now();
    },
    trashButton,
    homeHolding: (holding) => {
      homeHeld = holding;
    },
    tapContinue,
    holdHome: () => {
      switch (screen.kind) {
        case 'album':
          screen = { kind: 'picker' };
          return 'toPicker';
        case 'picker':
          return 'toMenu';
        case 'opening':
        case 'openingBigPicture':
          return 'ignored';
        case 'bigPicture':
          return homeFromBigPicture(screen);
        case 'painting':
          if (!heldSinceShown()) {
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
