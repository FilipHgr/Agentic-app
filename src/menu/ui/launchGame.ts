/**
 * Jediné místo, kudy se hra z menu spouští (#67). Při každém spuštění
 * ověří, že je hra odemčená (#74); o odemčení rozhoduje sdílená logika
 * přístupu podle stavu ze zdroje předplatného. Zamčená hra se nespustí.
 * Když je hra zamčená, stažený soubor není vstup hry nebo spuštění selže,
 * vyhodí výjimku a menu nechá dítě v menu se zatřesením. Rozehranou hru
 * pozdější změna stavu neukončí, zamčení platí až od dalšího spuštění.
 * Název stránky a kolečko nastaví stránka menu podle logiky menu.
 * Hra dostane úložiště aktivního profilu (#71), jiné úložiště nemá,
 * a značku profilu (#87): jen barvu a první písmeno přezdívky.
 */

import { isGameUnlocked } from '../../shared/logic/gameAccess';
import type { SubscriptionSource } from '../../shared/logic/gameAccess';
import type { GameProfileMarker } from '../../shared/logic/gameHost';
import type { GameEntry } from '../../shared/logic/gameRegistry';
import type { KeyValueStorage } from '../../shared/storage/keyValueStorage';
import { isGameModule, runGame } from '../../shared/ui/gameRunner';

export interface LaunchContext {
  /** Zavře menu, až hra naběhne. */
  readonly closeMenu: () => void;
  /** Dítě odešlo z hry domečkem a hra je zničená (#68): menu se znovu ukáže. */
  readonly returnToMenu: () => void;
  /** Zdroj stavu předplatného (#74); stav se čte při každém spuštění znovu. */
  readonly subscription: SubscriptionSource;
  /**
   * Úložiště hry pro aktivní profil v době spuštění (#71). Bez něj hra
   * ukládá jen do paměti.
   */
  readonly gameStorage?: ((gameId: string) => KeyValueStorage) | undefined;
  /** Značka aktivního profilu v době spuštění (#87). */
  readonly profileMarker?: (() => GameProfileMarker) | undefined;
}

export function launchGame(game: GameEntry, loaded: unknown, context: LaunchContext): void {
  if (!isGameUnlocked(game, context.subscription)) {
    throw new Error(`hra ${game.id} je zamčená`);
  }
  if (!isGameModule(loaded)) {
    throw new Error(`stažená hra ${game.id} nemá scény`);
  }
  runGame(loaded, {
    onLeft: context.returnToMenu,
    storage: context.gameStorage?.(game.id),
    profileMarker: context.profileMarker?.(),
  });
  context.closeMenu();
}
