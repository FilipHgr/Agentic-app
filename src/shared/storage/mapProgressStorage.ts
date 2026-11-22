/**
 * Uložení mapy postupu (#87, #133), od #193 jedné pro profil a společné
 * všem hrám s hvězdičkami: krok získaný ve Znaménkách pokračuje
 * v Počítání a naopak. Stránka dá hře mapu aktivního profilu jako
 * `openMapProgress(gameStorage(MAP_PROGRESS_AREA), gameStorage(LEGACY_MAP_GAME_ID))`:
 * záznam tak leží pod vnitřním označením profilu (nikdy s přezdívkou),
 * jiný profil ho nevidí a smazáním profilu zmizí s ostatními daty profilu.
 *
 * Převod (#193 AC3): do #193 měla mapu jen Počítání ve svém úložišti hry
 * (klíč `MAP_PROGRESS_KEY` v oblasti `counting`). Když společný záznam
 * ještě není, přečte se při prvním načtení záznam Počítání (i ve tvaru
 * z #87 s 8 kroky, #133 AC4) a uloží se do společného. Potom už společný
 * záznam je a záznam Počítání se nikdy nečte znovu, takže se žádný krok
 * ani dokončená mapa neztratí ani nezapočte dvakrát. Převod je u stránky,
 * ne ve hře, aby ho žádná hra nemohla předběhnout. Sdílená část nesmí
 * importovat z her, proto je tu označení Počítání napsané přímo (jako
 * převod dat z doby před profily v `profileStorage.ts`).
 *
 * Záznam se čte znovu při každém načtení, takže dva panely se stejným
 * profilem vidí stejnou mapu. Když prohlížeč úložiště nedovolí nebo zápis
 * selže, hra jede dál s mapou v paměti a hráč nevidí chybu. Nikdy nevyhodí
 * výjimku.
 */

import {
  START_MAP,
  readMapRecord,
  serializeMapProgress,
  totalMapSteps,
} from '../logic/progressMap';
import type { MapProgress, MapProgressStore, MapRecord } from '../logic/progressMap';
import type { KeyValueStorage } from './keyValueStorage';

/** Oblast úložiště profilu pro mapu postupu, společná všem hrám (jako označení hry). */
export const MAP_PROGRESS_AREA = 'shared-map';

/** Klíč záznamu mapy; stejný ve společné oblasti i v úložišti Počítání do #193. */
export const MAP_PROGRESS_KEY = 'agentic-app.map';

/** Hra, která měla mapu do #193 ve svém úložišti (Počítání). */
export const LEGACY_MAP_GAME_ID = 'counting';

export type { MapProgressStore } from '../logic/progressMap';

/** Přečtený záznam, nebo `null`, když v úložišti žádný není. */
function readStoredRecord(storage: KeyValueStorage): MapRecord | null {
  const saved = storage.getItem(MAP_PROGRESS_KEY);
  return saved === null ? null : readMapRecord(saved);
}

/**
 * Načte postup na mapě z úložiště `storage` (záznam z #87 převede na
 * 3 kroky a hned uloží v novém tvaru, #133 AC4); bez úložiště nebo při
 * chybě vrátí start.
 */
export function loadMapProgress(storage: KeyValueStorage | undefined): MapProgress {
  let record: MapRecord;
  try {
    record = readMapRecord(storage?.getItem(MAP_PROGRESS_KEY));
  } catch {
    // Nečitelné úložiště je stejný případ jako prázdné.
    return START_MAP;
  }
  if (record.legacy) {
    // Když zápis selže, hra jede s převedeným postupem v paměti.
    saveMapProgress(storage, record.progress);
  }
  return record.progress;
}

/** Uloží postup na mapě. Když to nejde, postup platí aspoň do zavření stránky. */
export function saveMapProgress(
  storage: KeyValueStorage | undefined,
  progress: MapProgress,
): boolean {
  try {
    storage?.setItem(MAP_PROGRESS_KEY, serializeMapProgress(progress));
    return storage !== undefined;
  } catch {
    // Plné nebo zakázané úložiště: hra pokračuje s mapou v paměti.
    return false;
  }
}

/**
 * Společný záznam; když ještě není, převede se jednou záznam Počítání
 * (AC3). `null`, když úložiště nejde přečíst.
 */
function loadShared(
  shared: KeyValueStorage | undefined,
  legacy: KeyValueStorage | undefined,
): MapProgress | null {
  if (shared === undefined) {
    return null;
  }
  let stored: MapRecord | null;
  try {
    stored = readStoredRecord(shared);
  } catch {
    // Zakázané úložiště (soukromý režim): mapa jen v paměti.
    return null;
  }
  if (stored !== null) {
    if (stored.legacy) {
      saveMapProgress(shared, stored.progress);
    }
    return stored.progress;
  }
  const moved = loadMapProgress(legacy);
  // Start se neukládá: převod se zkusí znovu, až bude co převést.
  if (totalMapSteps(moved) > 0) {
    saveMapProgress(shared, moved);
  }
  return moved;
}

/** Z dvou postupů ten, který je dál (mapa jde jen dopředu); při shodě první. */
function furtherOf(first: MapProgress, second: MapProgress): MapProgress {
  return totalMapSteps(second) > totalMapSteps(first) ? second : first;
}

/**
 * Mapa profilu nad společným úložištěm `shared`, s jednorázovým převodem
 * záznamu Počítání z úložiště `legacy` (AC3). Bez úložiště jen v paměti.
 */
export function openMapProgress(
  shared: KeyValueStorage | undefined,
  legacy?: KeyValueStorage | undefined,
): MapProgressStore {
  /**
   * Postup, který se nepodařilo uložit; platí jen pro tuto instanci, tedy
   * do návratu do menu (úložiště profilu ho navíc drží v paměti samo).
   */
  let unsaved: MapProgress = START_MAP;

  return {
    load: () => {
      const stored = loadShared(shared, legacy);
      return stored === null ? unsaved : furtherOf(stored, unsaved);
    },
    save: (progress) => {
      const saved = saveMapProgress(shared, progress);
      unsaved = saved ? START_MAP : progress;
      return saved;
    },
  };
}
