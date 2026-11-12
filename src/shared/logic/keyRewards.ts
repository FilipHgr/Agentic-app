/**
 * Klíče za dokončené mapy (#139), společné pro všechny hry: za každou
 * dokončenou mapu v Počítání dostane profil půl klíče, za dvě mapy celý
 * klíč (navazující úkol jím odemkne omalovánku). Hra nahlásí, kolik map
 * profil dokončil, a dozví se, jestli tím přibyla půlka, nebo se dokončil
 * celý klíč. Započte se jen nejvyšší nahlášený počet, takže stejná mapa
 * nahlášená znovu (návrat do hry, druhý panel, poškozený záznam mapy, který
 * začne zase od 0) žádnou půlku nepřidá.
 * Čistý TypeScript; ukládání je v `src/shared/storage/keyRewardsStorage.ts`.
 */

/**
 * Co dítě za mapu dostalo: `'half'` půlku klíče (lichý počet půlek),
 * `'wholeKey'` druhou půlku, která dokončila celý klíč (sudý počet).
 */
export type KeyReward = 'half' | 'wholeKey';

/** Kolik klíčů profil má. */
export interface KeyBalance {
  /** Všechny získané půlky (jedna za každou dokončenou mapu). */
  readonly halves: number;
  /** Celé klíče: dvojice půlek. */
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
}

/** Je hodnota smysluplný počet dokončených map (celé číslo od 0)? */
export function isCompletedMapCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

/** Stav klíčů po `halves` získaných půlkách. */
export function balanceOf(halves: number): KeyBalance {
  return { halves, wholeKeys: Math.floor(halves / 2), hasHalf: halves % 2 === 1 };
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
