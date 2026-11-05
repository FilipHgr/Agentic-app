/**
 * Jediné místo, kudy se hra z menu spouští (#67). Na něj později naváže
 * kontrola předplatného (#74). Když stažený soubor není vstup hry nebo
 * spuštění selže, vyhodí výjimku a menu nechá dítě v menu se zatřesením.
 * Název stránky a kolečko nastaví stránka menu podle logiky menu.
 */

import type { GameEntry } from '../../shared/logic/gameRegistry';
import { isGameModule, runGame } from '../../shared/ui/gameRunner';

export interface LaunchContext {
  /** Zavře menu, až hra naběhne. */
  readonly closeMenu: () => void;
}

export function launchGame(game: GameEntry, loaded: unknown, context: LaunchContext): void {
  if (!isGameModule(loaded)) {
    throw new Error(`stažená hra ${game.id} nemá scény`);
  }
  runGame(loaded);
  context.closeMenu();
}
