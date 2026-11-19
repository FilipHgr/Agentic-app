/**
 * Pomůcky pro testy k #150 (listování na výběru omalovánek po 12).
 *
 * Testy pracují se zadanou testovací sadou s 13 a 25 omalovánkami (AC3),
 * ne s tím, co je v repozitáři: do hry se nové obrázky nepřidávají
 * a výběr (`startPictureChoice`) dostane sadu zvenku. Omalovánky sady mají
 * jen označení (`page-01` až `page-25`), logika výběru obrys nezná.
 *
 * Dotyky na výběru hlásí scéna stejně jako v albu (#149): stisk prstu
 * s místem náhledu pod ním (`pickerPointerDown`, `null` mimo náhledy),
 * zvednutí s místem, kde prst skončil (`pickerPointerUp`), a ťuknutí na
 * šipky ◀ ▶ (`tapPickerArrow`). Po nalistování scéna ukáže novou stránku
 * a zavolá `pickerPageShown`; do té doby se listuje.
 *
 * Výběr měří čas zkušebními hodinami z `pictureChoiceHelpers.ts`, jedno
 * „vrácení z malování“ je podržení domečku 1 s po zobrazení malování.
 */

import { expect } from 'vitest';

import { startPictureChoice } from '../../../src/games/coloring/logic/pictureChoice';
import type {
  PictureChoice,
  PictureChoiceOptions,
  PickerPointerResult,
} from '../../../src/games/coloring/logic/pictureChoice';
import type { PictureLocks } from '../../../src/games/coloring/logic/pictureLocks';
import type { PictureIdentity } from '../../../src/games/coloring/logic/savedPicture';
import { HOLD_TO_GO_HOME_MS } from '../../../src/shared/logic/homeButton';
import type { KeyValueStorage } from '../../../src/shared/storage/keyValueStorage';
import { advancePickerClock, pickerTime } from './pictureChoiceHelpers';

/** Omalovánek na jedné stránce výběru (#150 AC1), schválně opsané, ne konstanta z kódu. */
export const PICKER_PAGE_SIZE = 12;

/** Nejmenší vodorovný posun prstu, který je tah (#149 AC1, stejné ovládání). */
export const SWIPE_MIN = 48;

/** Tah dost dlouhý na nalistování. */
export const LONG_SWIPE = 120;

/** Kde prst začne v CSS px (uprostřed výběru, na tom nezáleží). */
export const START = { x: 500, y: 400 } as const;

/** Testovací sada s `count` omalovánkami v pořadí sady (AC3). */
export function testPictures(count: number): readonly PictureIdentity[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `page-${String(index + 1).padStart(2, '0')}`,
    version: 1,
  }));
}

/** Sada se 13 omalovánkami: plná 1. stránka a jediná na 2. (AC3). */
export const THIRTEEN_PICTURES = testPictures(13);

/** Sada s 25 omalovánkami: dvě plné stránky a jediná na 3. (AC3). */
export const TWENTY_FIVE_PICTURES = testPictures(25);

/** Dítě ťukne v menu na Omalovánky: výběr nad zadanou sadou. */
export function enterPagedPicker(
  pictures: readonly PictureIdentity[],
  options: Omit<PictureChoiceOptions, 'now'> = {},
): PictureChoice {
  return startPictureChoice(pictures, { ...options, now: pickerTime });
}

/** Omalovánky, které výběr ukazuje na stránce, která je vidět. */
export function shownIds(choice: PictureChoice): readonly string[] {
  return choice.pagePreviews().map((picture) => picture.id);
}

/** Omalovánky stránky `page` (0 je 1. stránka) v pořadí sady, jak je dítě má vidět. */
export function expectedIds(pictures: readonly PictureIdentity[], page: number): readonly string[] {
  return pictures
    .slice(page * PICKER_PAGE_SIZE, (page + 1) * PICKER_PAGE_SIZE)
    .map((picture) => picture.id);
}

/** Dítě nalistuje šipkou a scéna novou stránku ukáže. */
export function turnByArrow(choice: PictureChoice, direction: 'next' | 'previous'): void {
  const turn = choice.tapPickerArrow(direction);
  expect(turn.kind, `šipka ${direction === 'next' ? '▶' : '◀'} nalistuje`).toBe('turned');
  choice.pickerPageShown();
}

/** Dítě nalistuje šipkou ▶ na stránku `page` (0 je 1. stránka). */
export function turnToPage(choice: PictureChoice, page: number): void {
  for (let turn = 0; turn < page; turn += 1) {
    turnByArrow(choice, 'next');
  }
  expect(choice.pickerPage(), `předpoklad: ${page + 1}. stránka`).toBe(page);
}

/** Jeden prst se dotkne v `START` (na místě náhledu `place`) a zvedne o `dx`, `dy` dál. */
export function swipe(
  choice: PictureChoice,
  dx: number,
  dy: number,
  options: { readonly pointerId?: number; readonly place?: number | null } = {},
): PickerPointerResult {
  const pointerId = options.pointerId ?? 1;
  choice.pickerPointerDown(pointerId, START, options.place ?? null);
  return choice.pickerPointerUp(pointerId, { x: START.x + dx, y: START.y + dy });
}

/** Omalovánka, kterou otevřelo ťuknutí; `null`, když se nic neotevřelo. */
export function openedId(result: PickerPointerResult): string | null {
  return result.kind === 'open' || result.kind === 'unlocked' ? result.picture.id : null;
}

/**
 * Dítě ťukne na místo `place` na stránce, která je vidět, malování se
 * ukáže a po chvíli malování podrží domeček 1 s: je zpátky na výběru.
 * Vrátí omalovánku, která se otevřela. Zamčenou omalovánku s klíčem
 * odemkne od #159 až druhé ťuknutí po doletu klíče do zámku.
 */
export function paintAndReturn(choice: PictureChoice, place: number): string {
  let tap = choice.tapPreview(place);
  if (tap.kind === 'keyToLock') {
    choice.keyLanded();
    tap = choice.tapPreview(place);
  }
  if (tap.kind !== 'open' && tap.kind !== 'unlocked') {
    throw new Error(`místo ${place + 1} omalovánku neotevřelo (${tap.kind})`);
  }
  choice.paintingShown();
  advancePickerClock(HOLD_TO_GO_HOME_MS);
  expect(choice.holdHome(), 'domeček v malování vede na výběr').toBe('toPicker');
  return tap.picture.id;
}

/**
 * Zámky omalovánek pro testovací sadu: zamčené jsou `locked`, dítě má
 * `wholeKeys` celých klíčů. Skutečné zámky (`openPictureLocks`) znají jen
 * omalovánky hry, testovací sadu ne; výběr zná zámky jen přes rozhraní
 * `PictureLocks`.
 */
export function testLocks(
  locked: readonly string[],
  wholeKeys = 0,
): PictureLocks & { readonly spentKeys: () => number } {
  const stillLocked = new Set(locked);
  let keys = wholeKeys;
  let spent = 0;
  return {
    isLocked: (picture) => stillLocked.has(picture.id),
    keyIndicator: () => (stillLocked.size === 0 ? null : { wholeKeys: keys, hasHalf: false }),
    canUnlock: (picture) => stillLocked.has(picture.id) && keys > 0,
    unlock: (picture) => {
      if (!stillLocked.has(picture.id)) {
        return 'alreadyUnlocked';
      }
      if (keys === 0) {
        return 'noKey';
      }
      keys -= 1;
      spent += 1;
      stillLocked.delete(picture.id);
      return 'unlocked';
    },
    spentKeys: () => spent,
  };
}

/** Úložiště v paměti, které si pamatuje každý zápis (AC2: stránka se nikam neukládá). */
export function recordingStorage(): KeyValueStorage & { readonly writes: () => number } {
  const values = new Map<string, string>();
  let writes = 0;
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      writes += 1;
      values.set(key, value);
    },
    trySetItem: (key, value) => {
      writes += 1;
      values.set(key, value);
      return true;
    },
    writes: () => writes,
  };
}
