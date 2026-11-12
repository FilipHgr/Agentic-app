/**
 * Klíče za dokončené mapy (#139), společné pro všechny hry: za každou
 * dokončenou mapu v Počítání dostane profil půl klíče, za dvě mapy celý
 * klíč (navazující úkol jím odemkne omalovánku). Hra nahlásí, kolik map
 * profil dokončil, a dozví se, jestli tím přibyla půlka, nebo se dokončil
 * celý klíč. Započte se jen nejvyšší nahlášený počet, takže stejná mapa
 * nahlášená znovu (návrat do hry, druhý panel, poškozený záznam mapy, který
 * začne zase od 0) žádnou půlku nepřidá.
 * Celý klíč jde utratit za věc (#140, odemčení omalovánky); za stejnou věc
 * se klíč utratí jen jednou a celých klíčů nikdy není méně než 0.
 * Čistý TypeScript; ukládání je v `src/shared/storage/keyRewardsStorage.ts`.
 */

/**
 * Co dítě za mapu dostalo: `'half'` půlku klíče (lichý počet půlek),
 * `'wholeKey'` druhou půlku, která dokončila celý klíč (sudý počet).
 */
export type KeyReward = 'half' | 'wholeKey';

/**
 * Jak dopadlo utracení klíče za věc (#140): `'spent'` klíč se utratil,
 * `'alreadySpent'` za tuto věc už klíč utracený je (nic se nebere),
 * `'noKey'` dítě nemá celý klíč (nebo věc nemá označení) a nic se nezměnilo.
 */
export type KeySpend = 'spent' | 'alreadySpent' | 'noKey';

/** Kolik klíčů profil má. */
export interface KeyBalance {
  /** Všechny získané půlky (jedna za každou dokončenou mapu). */
  readonly halves: number;
  /** Celé klíče, které zbývají: dvojice půlek bez utracených klíčů (#140), nejméně 0. */
  readonly wholeKeys: number;
  /** Zbyla půlka bez druhé poloviny? */
  readonly hasHalf: boolean;
}

/** Klíče aktivního profilu, jak je stránka dá hře (`GameHost.keyRewards`). */
export interface KeyRewards {
  /**
   * Profil má dokončených `completedMaps` map. Vrátí, co tím dítě dostalo,
   * nebo `null`, když počet nepřesáhl dřív nahlášený (nebo nedává smysl).
   */
  reportCompletedMaps(completedMaps: number): KeyReward | null;
  /** Kolik klíčů profil teď má. */
  balance(): KeyBalance;
  /** Utratí jeden celý klíč za věc `itemId` (např. `coloring/car`). */
  spendKey(itemId: string): KeySpend;
  /** Věci, za které profil klíč utratil. */
  spentItems(): readonly string[];
}

/** Je hodnota smysluplný počet dokončených map (celé číslo od 0)? */
export function isCompletedMapCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

/** Tvar označení věci: `hra/věc` malými písmeny, číslicemi a pomlčkami (např. `coloring/car`). */
const SPEND_ITEM_PATTERN = /^[a-z0-9-]+\/[a-z0-9-]+$/;

/** Nejdelší označení věci. */
const SPEND_ITEM_MAX_LENGTH = 64;

/** Je hodnota označení věci, za kterou jde utratit klíč (`hra/věc`, nejvýš 64 znaků)? */
export function isSpendItemId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length <= SPEND_ITEM_MAX_LENGTH &&
    SPEND_ITEM_PATTERN.test(value)
  );
}

/** Stav klíčů po `halves` získaných půlkách a `spentKeys` utracených klíčích. */
export function balanceOf(halves: number, spentKeys = 0): KeyBalance {
  return {
    halves,
    wholeKeys: Math.max(0, Math.floor(halves / 2) - spentKeys),
    hasHalf: halves % 2 === 1,
  };
}

/**
 * Co přinese nahlášení `reported` map, když nejvyšší dřív započtený počet
 * byl `best`: nic, když počet nepřesáhl dřív dosažený, jinak podle toho,
 * jestli nový počet půlek dokončil celý klíč.
 */
export function rewardFor(best: number, reported: number): KeyReward | null {
  if (!isCompletedMapCount(reported) || reported <= best) {
    return null;
  }
  return reported % 2 === 0 ? 'wholeKey' : 'half';
}
