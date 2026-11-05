/**
 * Zdroj stavu předplatného pro hotovou hru (#74). Dnes je jen místní zdroj
 * „vše odemčeno“: hlásí aktivní předplatné, nic neukládá, nic neposílá
 * a nejde přepnout adresou, úložištěm ani režimem buildu. Později ho
 * nahradí obchod a herní kód se nezmění. Čistý TypeScript bez Phaseru.
 */

import type { SubscriptionSource } from './gameAccess';

/** Místní zdroj „vše odemčeno“: předplatné je vždy aktivní. */
export const ALL_UNLOCKED_SOURCE: SubscriptionSource = Object.freeze({
  currentState: () => 'active',
});

/** Zdroj stavu předplatného, podle kterého stránka hry odemyká. */
export function chooseSubscriptionSource(): SubscriptionSource {
  return ALL_UNLOCKED_SOURCE;
}
