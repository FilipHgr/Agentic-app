/**
 * Uložení klíčů za dokončené mapy (#139) jen v zařízení. Stránka dá hře
 * klíče aktivního profilu jako `openKeyRewards(profiles.gameStorage(KEY_REWARDS_AREA))`:
 * záznam tak leží pod vnitřním označením profilu (nikdy s přezdívkou),
 * jiný profil ho nevidí a smazáním profilu zmizí s ostatními daty profilu.
 *
 * Záznam `{"completedMaps": n}` pod klíčem `KEY_REWARDS_KEY` drží nejvyšší
 * nahlášený počet dokončených map, tedy získané půlky. Utracené klíče
 * (odemčení omalovánek, #140) jsou oddělený záznam `{"spent": [věci]}` pod
 * klíčem `KEY_SPENDING_KEY` ve stejné oblasti: poškození jednoho záznamu
 * neovlivní druhý (poškozený záznam utracení vrátí klíče). Utracení se uloží
 * jedním zápisem spolu s tím, za co bylo, takže klíč nezmizí bez věci ani
 * naopak.
 *
 * Záznam se čte znovu při každém volání, takže dva panely se stejným
 * profilem vidí stejný stav a za stejnou mapu je půlka jen jednou (AC3).
 * Chybějící, poškozený nebo nečitelný záznam je 0 map (AC6); půlka, která
 * se nepodaří uložit, platí do zavření stránky. Totéž platí pro utracení.
 * Nikdy nevyhodí výjimku.
 */

import { balanceOf, isCompletedMapCount, isSpendItemId, rewardFor } from '../logic/keyRewards';
import type { KeyRewards } from '../logic/keyRewards';
import type { KeyValueStorage } from './keyValueStorage';

/** Oblast úložiště profilu pro klíče, společná všem hrám (jako označení hry). */
export const KEY_REWARDS_AREA = 'shared-keys';

/** Klíč záznamu získaných půlek v oblasti `KEY_REWARDS_AREA`. */
export const KEY_REWARDS_KEY = 'earned';

/** Klíč záznamu utracených klíčů v oblasti `KEY_REWARDS_AREA` (#140). */
export const KEY_SPENDING_KEY = 'spent';

/** Počet dokončených map ze záznamu; cokoli jiného než `{"completedMaps": n}` je 0. */
function parseCompletedMaps(saved: string | null): number {
  if (saved === null) {
    return 0;
  }
  let record: unknown;
  try {
    record = JSON.parse(saved);
  } catch {
    // Poškozený záznam: dítě začíná bez klíčů, hra jede dál (AC6).
    return 0;
  }
  if (typeof record !== 'object' || record === null || Array.isArray(record)) {
    return 0;
  }
  const completedMaps = (record as { completedMaps?: unknown }).completedMaps;
  return isCompletedMapCount(completedMaps) ? completedMaps : 0;
}

/** Uložený počet dokončených map; nečitelné úložiště je 0. */
function readCompletedMaps(storage: KeyValueStorage | undefined): number {
  if (storage === undefined) {
    return 0;
  }
  try {
    return parseCompletedMaps(storage.getItem(KEY_REWARDS_KEY));
  } catch {
    // Zakázané úložiště (soukromý režim): jako bez záznamu (AC6).
    return 0;
  }
}

/** Zapíše počet map; vrátí, jestli se zápis povedl. Výjimku nevyhodí. */
function writeCompletedMaps(storage: KeyValueStorage | undefined, completedMaps: number): boolean {
  if (storage === undefined) {
    return false;
  }
  try {
    storage.setItem(KEY_REWARDS_KEY, JSON.stringify({ completedMaps }));
    return true;
  } catch {
    // Plné úložiště: volající si počet podrží v paměti.
    return false;
  }
}

/** Věci, za které se utratil klíč; cokoli jiného než `{"spent": [texty]}` je nic. */
function parseSpentItems(saved: string | null): string[] {
  if (saved === null) {
    return [];
  }
  let record: unknown;
  try {
    record = JSON.parse(saved);
  } catch {
    // Poškozený záznam utracení: klíče se vrátí, hra jede dál (#140 AC7).
    return [];
  }
  if (typeof record !== 'object' || record === null || Array.isArray(record)) {
    return [];
  }
  const spent = (record as { spent?: unknown }).spent;
  if (!Array.isArray(spent)) {
    return [];
  }
  return withoutDuplicates(spent.filter(isSpendItemId));
}

/** Seznam bez opakovaných věcí, v původním pořadí. */
function withoutDuplicates(items: readonly string[]): string[] {
  return [...new Set(items)];
}

/** Uložené utracené věci; nečitelné úložiště je nic. */
function readSpentItems(storage: KeyValueStorage | undefined): string[] {
  if (storage === undefined) {
    return [];
  }
  try {
    return parseSpentItems(storage.getItem(KEY_SPENDING_KEY));
  } catch {
    // Zakázané úložiště (soukromý režim): jako bez záznamu.
    return [];
  }
}

/** Zapíše utracené věci; vrátí, jestli se zápis povedl. Výjimku nevyhodí. */
function writeSpentItems(storage: KeyValueStorage | undefined, spent: readonly string[]): boolean {
  if (storage === undefined) {
    return false;
  }
  try {
    storage.setItem(KEY_SPENDING_KEY, JSON.stringify({ spent }));
    return true;
  } catch {
    // Plné úložiště: volající si utracení podrží v paměti.
    return false;
  }
}

/** Klíče nad úložištěm profilu `storage`; bez úložiště jen v paměti. */
export function openKeyRewards(storage: KeyValueStorage | undefined): KeyRewards {
  /**
   * Počet map, který se nepodařilo uložit (úložiště zápis odmítlo výjimkou).
   * Platí jen pro tuto instanci, tedy do návratu do menu: stránka otevírá
   * klíče znovu při každém spuštění hry. Po návratu se počet znovu nahlásí
   * z mapy Počítání při vstupu do hry. Úložiště profilu navíc nepovedený
   * zápis podrží samo v paměti do zavření stránky (AC6).
   */
  let unsavedMaps = 0;

  /**
   * Utracené věci, které se nepodařilo uložit; platí jako `unsavedMaps` jen
   * pro tuto instanci, aby se neuložený klíč neutratil znovu (#140 AC7).
   */
  let unsavedSpent: string[] = [];

  const completedMaps = (): number => Math.max(readCompletedMaps(storage), unsavedMaps);
  const spentItems = (): string[] =>
    withoutDuplicates([...readSpentItems(storage), ...unsavedSpent]);
  const balance = () => balanceOf(completedMaps(), spentItems().length);

  return {
    reportCompletedMaps: (reported) => {
      const reward = rewardFor(completedMaps(), reported);
      if (reward !== null && !writeCompletedMaps(storage, reported)) {
        unsavedMaps = reported;
      }
      return reward;
    },
    balance,
    spendKey: (itemId) => {
      if (!isSpendItemId(itemId)) {
        return 'noKey';
      }
      const spent = spentItems();
      if (spent.includes(itemId)) {
        return 'alreadySpent';
      }
      if (balance().wholeKeys < 1) {
        return 'noKey';
      }
      const updated = [...spent, itemId];
      if (!writeSpentItems(storage, updated)) {
        unsavedSpent = updated;
      }
      return 'spent';
    },
    spentItems,
  };
}
