/**
 * Nedávné barvy Omalovánek (#99): dvě místa v pruhu ovládání vedle úchytu
 * s předchozími barvami, aby dítě mohlo přepínat mezi dvěma barvami se
 * zavřeným panelem. Pořadí (AC2): je vybraná S a nedávné [A, B], výběr X
 * jiné než S dá vybranou X a nedávné S a za ní první ze starých nedávných,
 * která není X. Stejná barva tak nikdy není vidět dvakrát.
 *
 * Pamatují se podle profilu v samostatném záznamu vedle obrázku (AC5),
 * záznam obrázku zůstává beze změny. Záznam je text „a,b“ s indexy barev
 * palety, prázdné místo je prázdné pole. Z chybějícího nebo poškozeného
 * záznamu se vezme jen platná část: nic mimo paletu, žádná barva dvakrát
 * ani shodná s vybranou. Čistý TypeScript bez Phaseru.
 */

import type { KeyValueStorage } from '../../../shared/storage/keyValueStorage';
import { PALETTE } from './palette';

/** Kolik míst pro nedávné barvy je v pruhu (#99, otázka 1). */
export const RECENT_COLOR_COUNT = 2;

/** Místa v pořadí pruhu: index barvy `PALETTE`, `null` u prázdného místa. */
export type RecentColors = readonly (number | null)[];

const FIELD_SEPARATOR = ',';

function isPaletteIndex(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value < PALETTE.length;
}

/** Na začátku jsou obě místa prázdná (AC3). */
export function noRecentColors(): RecentColors {
  return Array.from({ length: RECENT_COLOR_COUNT }, () => null);
}

/**
 * Platná část míst: barvy z palety bez opakování a bez vybrané barvy,
 * obsazená místa napřed, doplněná prázdnými na `RECENT_COLOR_COUNT`.
 */
function cleaned(colors: readonly (number | null)[], selected: number): RecentColors {
  const kept: number[] = [];
  for (const color of colors) {
    if (color !== null && isPaletteIndex(color) && color !== selected && !kept.includes(color)) {
      kept.push(color);
    }
  }
  const places: (number | null)[] = kept.slice(0, RECENT_COLOR_COUNT);
  while (places.length < RECENT_COLOR_COUNT) {
    places.push(null);
  }
  return places;
}

/**
 * Nedávné barvy po výběru barvy `picked`, když byla vybraná `selected`
 * (AC2). Výběr už vybrané barvy nic nezmění.
 */
export function recentAfterPick(
  recent: RecentColors,
  selected: number,
  picked: number,
): RecentColors {
  if (picked === selected) {
    return recent;
  }
  const kept = recent.find((color) => color !== picked) ?? null;
  return cleaned([selected, kept], picked);
}

/** Klíč záznamu v úložišti hry profilu, samostatně vedle obrázku `pictureId`. */
function recordKey(pictureId: string): string {
  return `recentColors.${pictureId}`;
}

/** Jedno pole záznamu: index barvy v přesném zápisu, prázdné pole je prázdné místo. */
function readField(field: string): number | null {
  const value = Number(field);
  return field !== '' && String(value) === field && isPaletteIndex(value) ? value : null;
}

/** Text záznamu na místa; nesmyslný text dá prázdná místa. */
export function decodeRecentColors(record: string | null, selected: number): RecentColors {
  if (record === null) {
    return noRecentColors();
  }
  const fields = record.split(FIELD_SEPARATOR);
  if (fields.length !== RECENT_COLOR_COUNT) {
    return noRecentColors();
  }
  return cleaned(fields.map(readField), selected);
}

/** Místa jako text záznamu. */
export function encodeRecentColors(recent: RecentColors): string {
  return recent.map((color) => (color === null ? '' : String(color))).join(FIELD_SEPARATOR);
}

/**
 * Uložené nedávné barvy obrázku `pictureId` při vybrané barvě `selected`.
 * Chybějící, nesmyslný nebo nečitelný záznam dá prázdná místa (AC5).
 */
export function loadRecentColors(
  storage: KeyValueStorage,
  pictureId: string,
  selected: number,
): RecentColors {
  try {
    return decodeRecentColors(storage.getItem(recordKey(pictureId)), selected);
  } catch (error) {
    console.warn('Omalovánky: nedávné barvy nejde přečíst', error);
    return noRecentColors();
  }
}

/** Uloží nedávné barvy. Chyba úložiště hru nezastaví, barvy zůstanou v paměti. */
export function storeRecentColors(
  storage: KeyValueStorage,
  pictureId: string,
  recent: RecentColors,
): void {
  try {
    storage.setItem(recordKey(pictureId), encodeRecentColors(recent));
  } catch (error) {
    console.warn('Omalovánky: nedávné barvy nejde uložit', error);
  }
}
