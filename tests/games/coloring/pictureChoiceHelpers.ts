/**
 * Pomůcky pro testy k #124 (výběr omalovánky ze sady, každá si pamatuje
 * svůj obrázek). Testy pracují se zadanou sadou (doporučení reviewera),
 * ne s tím, co je v repozitáři: sada je seznam označení omalovánek
 * `PictureIdentity` a výběr (`startPictureChoice`) dostane sadu zvenku.
 *
 * Jedno „otevření omalovánky z výběru“ je ťuknutí na náhled, hlášení scény,
 * že je malování vidět (`paintingShown`), a `openColoring` s omalovánkou,
 * kterou výběr otevřel, nad úložištěm hry aktivního profilu. Jeden
 * „návrat na výběr“ je podržení domečku v malování (`holdHome`) a uložení
 * obrázku, které při něm scéna udělá (`suspend`, jako #92 AC3).
 *
 * Výběr měří čas od chvíle, kdy je malování vidět (`now`, #124 AC5:
 * podržení se počítá až od té chvíle). Testy bez časovačů mu dávají
 * zkušební hodiny `pickerClock`, které posune jen `backToPicker`
 * o celé podržení domečku; testy domečku dávají `() => Date.now()`
 * s falešnými časovači Vitestu.
 *
 * Všechny omalovánky sady mají v testech stejný zkušební obrys
 * `twoHalves()`: logika výběru a ukládání obrys nezná, rozlišuje jen
 * označení omalovánky.
 */

import { expect } from 'vitest';

import { startPictureChoice } from '../../../src/games/coloring/logic/pictureChoice';
import type { PictureChoice } from '../../../src/games/coloring/logic/pictureChoice';
import type { RegionMap } from '../../../src/games/coloring/logic/regionMap';
import { openColoring } from '../../../src/games/coloring/logic/savedPicture';
import type {
  PictureIdentity,
  SavedColoring,
} from '../../../src/games/coloring/logic/savedPicture';
import { COLORING_META } from '../../../src/games/coloring/meta';
import { HOLD_TO_GO_HOME_MS } from '../../../src/shared/logic/homeButton';
import type { KeyValueStorage } from '../../../src/shared/storage/keyValueStorage';
import type { ProfileStore } from '../../../src/shared/storage/profileStorage';

/** Omalovánka domku s dnešním označením (#124 AC2), schválně opsaná, ne konstanta z kódu. */
export const HOUSE: PictureIdentity = { id: 'house', version: 1 };

/** Zástupné omalovánky (otázka 3: velké kruhy a hvězda). */
export const CIRCLES: PictureIdentity = { id: 'circles', version: 1 };
export const STAR: PictureIdentity = { id: 'star', version: 1 };

/** Zadaná sada se třemi omalovánkami v pořadí náhledů. */
export const THREE_PICTURES: readonly PictureIdentity[] = [HOUSE, CIRCLES, STAR];

/** Sada s jedinou omalovánkou (zástupné skryté, doporučení k otázce 4). */
export const ONLY_HOUSE: readonly PictureIdentity[] = [HOUSE];

/** Náhledů se měří 6 (#124 AC6), sada s plnou mřížkou. */
export const SIX_PICTURES: readonly PictureIdentity[] = [
  HOUSE,
  CIRCLES,
  STAR,
  { id: 'fourth', version: 1 },
  { id: 'fifth', version: 1 },
  { id: 'sixth', version: 1 },
];

/** Zkušební hodiny výběru v ms; jdou jen dopředu, takže testy dopadnou vždy stejně. */
const pickerClock = { now: 0 };

/** Čas zkušebních hodin. */
export function pickerTime(): number {
  return pickerClock.now;
}

/** Posune zkušební hodiny o `ms`. */
export function advancePickerClock(ms: number): void {
  pickerClock.now += ms;
}

/** Dítě ťukne v menu na Omalovánky: výběr nad zadanou sadou. */
export function enterPicker(
  pictures: readonly PictureIdentity[] = THREE_PICTURES,
  now: () => number = pickerTime,
): PictureChoice {
  return startPictureChoice(pictures, { now });
}

/** Úložiště hry aktivního profilu, jak ho stránka dá Omalovánkám. */
export function coloringStorage(store: ProfileStore): KeyValueStorage {
  return store.gameStorage(COLORING_META.id);
}

/**
 * Dítě na výběru ťukne na náhled `index`, malování se ukáže a omalovánka
 * se otevře nad úložištěm `storage`. Selže, když výběr omalovánku neotevřel.
 */
export function openFromPicker(
  choice: PictureChoice,
  index: number,
  storage: KeyValueStorage | undefined,
  regions: RegionMap,
): SavedColoring {
  const tap = choice.tapPreview(index);
  if (tap.kind !== 'open') {
    throw new Error(`náhled ${index + 1} omalovánku neotevřel`);
  }
  choice.paintingShown();
  return openColoring({ regions, picture: tap.picture, storage });
}

/**
 * Dítě v malování podrží domeček 1 s: výběr vrátí dítě na výběr a scéna
 * obrázek uloží (rozpracovaný tah ukončí, #92 AC3).
 */
export function backToPicker(choice: PictureChoice, game: SavedColoring): void {
  advancePickerClock(HOLD_TO_GO_HOME_MS);
  expect(choice.holdHome(), 'domeček v malování vede na výběr').toBe('toPicker');
  game.suspend();
}
