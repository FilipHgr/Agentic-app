/**
 * Běžící hra na stránce (#68), bez Phaseru a bez DOM: co stránka nabízí
 * hře (`GameHost`), domeček a odchod z hry. Tlačítko domečku a spuštění
 * scén dostane zvenku, na stránce skutečný prvek a Phaser hru
 * (`gameRunner.ts`), v testech falešné.
 *
 * Domeček je vidět jen tehdy, když hra ohlásí, že jde použít (#68 AC4).
 * Odchod: hra se nejdřív zastaví (`GameHost.onLeave`), domeček se skryje,
 * pak se zavolá úklid ze spuštění scén (odpojení tlačítek a hlídání okna,
 * zničení hry) a nakonec se ohlásí `onLeft`. Druhý odchod nic neudělá
 * a hlášení domečku po odchodu ho už neukáže.
 */

import type { GameHost } from '../logic/gameHost';
import type { KeyValueStorage } from '../storage/keyValueStorage';

/** Domeček stránky; hra u něj přepíná jen `hidden`. */
export interface HomeButton {
  hidden: boolean;
}

export interface GameSessionOptions {
  readonly homeButton: HomeButton | null;
  /** Úložiště hry pro aktivní profil (#71); bez něj hra ukládá jen do paměti. */
  readonly storage?: KeyValueStorage | undefined;
  /**
   * Spustí scény hry s `session.host`. Vrátí úklid, který se zavolá při
   * odchodu z hry.
   */
  readonly startScenes: (session: GameSession) => () => void;
  /** Dítě odešlo domečkem a hra je uklizená: stránka ukáže menu. */
  readonly onLeft: () => void;
}

export interface GameSession {
  readonly host: GameHost;
  /** Jde teď domečkem odejít? */
  isHomeEnabled(): boolean;
  /** Podržení kolečka: otevře nastavení právě hrané hry, když nějaké poslouchá. */
  openSettings(): void;
  /** Odchod z hry domečkem. */
  leave(): void;
}

export function startGameSession(options: GameSessionOptions): GameSession {
  /** Kdo teď poslouchá podržení kolečka (jen právě hraná hra). */
  let settingsOpener: (() => void) | null = null;
  let homeAvailable = false;
  let hasLeft = false;
  const leaveHandlers: Array<() => void> = [];
  let cleanUpScenes: (() => void) | null = null;

  const showHome = (): void => {
    if (options.homeButton) {
      options.homeButton.hidden = !homeAvailable;
    }
  };

  const host: GameHost = {
    attachSettingsGear: (open) => {
      settingsOpener = open;
      return () => {
        if (settingsOpener === open) {
          settingsOpener = null;
        }
      };
    },
    setHomeAvailable: (available) => {
      homeAvailable = available && !hasLeft;
      showHome();
    },
    onLeave: (handler) => {
      leaveHandlers.push(handler);
    },
    storage: options.storage,
  };

  const session: GameSession = {
    host,
    isHomeEnabled: () => homeAvailable && !hasLeft,
    openSettings: () => settingsOpener?.(),
    leave: () => {
      if (hasLeft) {
        return;
      }
      hasLeft = true;
      homeAvailable = false;
      // Hra se zastaví dřív, než zmizí: ztiší zvuky a zruší naplánované akce.
      for (const handler of leaveHandlers.splice(0)) {
        handler();
      }
      settingsOpener = null;
      showHome();
      cleanUpScenes?.();
      cleanUpScenes = null;
      options.onLeft();
    },
  };

  cleanUpScenes = options.startScenes(session);
  return session;
}
