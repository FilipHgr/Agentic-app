/**
 * Přístup ke hrám (#74): jediné místo, které rozhoduje, jestli je hra
 * odemčená. Hry ani menu si přístup nepočítají samy. Čistý TypeScript bez
 * Phaseru, bez sítě a bez úložiště.
 *
 * Každá hra je buď zdarma, nebo v předplatném. Hra zdarma je odemčená vždy,
 * hra v předplatném jen při aktivním předplatném. Stav předplatného dodává
 * zdroj za rozhraním `SubscriptionSource`, který jde vyměnit (dnes místní
 * zdroj „vše odemčeno“, později obchod). Předplatné patří celému zařízení,
 * ne profilu dítěte.
 */

/** Úrovně přístupu ke hře: zdarma, nebo v předplatném. */
export const GAME_ACCESS_LEVELS = ['free', 'subscription'] as const;

export type GameAccess = (typeof GAME_ACCESS_LEVELS)[number];

/** Stav předplatného, podle kterého se rozhoduje. Neznámý stav je `inactive`. */
export type SubscriptionState = 'active' | 'inactive';

/**
 * Zdroj stavu předplatného. `currentState()` vrací naposledy známý stav
 * zařízení: `'active'` nebo `'inactive'`. Cokoli jiného (výjimka, nesmysl,
 * `'pending'`, `undefined` nebo odpověď, která teprve přijde) je neznámý
 * stav a platí jako neaktivní předplatné.
 */
export interface SubscriptionSource {
  readonly currentState: () => unknown;
}

/** Je hodnota platná úroveň přístupu ke hře? */
export function isGameAccess(value: unknown): value is GameAccess {
  return GAME_ACCESS_LEVELS.some((level) => level === value);
}

/**
 * Stav předplatného ze zdroje. Aktivní je jen přesně `'active'`, všechno
 * ostatní včetně selhání zdroje je neaktivní. Hráč žádnou chybu nevidí.
 */
export function subscriptionStateOf(source: SubscriptionSource): SubscriptionState {
  let reported: unknown;
  try {
    reported = source.currentState();
  } catch {
    // Zdroj selhal: stav je neznámý a platí jako neaktivní předplatné.
    return 'inactive';
  }
  return reported === 'active' ? 'active' : 'inactive';
}

/**
 * Je hra odemčená? Hra zdarma vždy, ostatní jen při aktivním předplatném.
 * Hra s neplatnou úrovní se bere jako hra v předplatném.
 */
export function isGameUnlocked(
  game: { readonly access: GameAccess },
  source: SubscriptionSource,
): boolean {
  if (game.access === 'free') {
    return true;
  }
  return subscriptionStateOf(source) === 'active';
}
