/**
 * Jediné místo, kudy se hra z menu spouští (#67). Při každém spuštění
 * ověří, že je hra odemčená (#74); o odemčení rozhoduje sdílená logika
 * přístupu podle stavu ze zdroje předplatného. Zamčená hra se nespustí.
 * Když je hra zamčená, stažený soubor není vstup hry nebo spuštění selže,
 * vyhodí výjimku a menu nechá dítě v menu se zatřesením. Rozehranou hru
 * pozdější změna stavu neukončí, zamčení platí až od dalšího spuštění.
 * Název stránky a kolečko nastaví stránka menu podle logiky menu.
 */

import { isGameUnlocked } from '../../shared/logic/gameAccess';
import type { SubscriptionSource } from '../../shared/logic/gameAccess';
import type { GameEntry } from '../../shared/logic/gameRegistry';
import { isGameModule, runGame } from '../../shared/ui/gameRunner';

export interface LaunchContext {
  /** Zavře menu, až hra naběhne. */
  readonly closeMenu: () => void;
  /** Dítě odešlo z hry domečkem a hra je zničená (#68): menu se znovu ukáže. */
  readonly returnToMenu: () => void;
  /** Zdroj stavu předplatného (#74); stav se čte při každém spuštění znovu. */
  readonly subscription: SubscriptionSource;
}

export function launchGame(game: GameEntry, loaded: unknown, context: LaunchContext): void {
  if (!isGameUnlocked(game, context.subscription)) {
    throw new Error(`hra ${game.id} je zamčená`);
  }
  if (!isGameModule(loaded)) {
    throw new Error(`stažená hra ${game.id} nemá scény`);
  }
  runGame(loaded, { onLeft: context.returnToMenu });
  context.closeMenu();
}
