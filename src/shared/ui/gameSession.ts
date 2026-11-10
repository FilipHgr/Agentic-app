/**
 * Běžící hra na stránce (#68), bez Phaseru a bez DOM: co stránka nabízí
 * hře (`GameHost`), domeček a odchod z hry. Tlačítko domečku a spuštění
 * scén dostane zvenku, na stránce skutečný prvek a Phaser hru
 * (`gameRunner.ts`), v testech falešné.
 *
 * Domeček je vidět jen tehdy, když hra ohlásí, že jde použít (#68 AC4).
 * Kolečko nastavení je vidět jen tehdy, když je na něj napojená běžící hra
 * (#88 AC6): hra s nastavením (Počítání) se napojí, hra bez nastavení
 * (Omalovánky) ne, a kolečko pak zůstane skryté.
 * Odchod: hra se nejdřív zastaví (`GameHost.onLeave`), domeček se skryje,
 * pak se zavolá úklid ze spuštění scén (odpojení tlačítek a hlídání okna,
 * zničení hry) a nakonec se ohlásí `onLeft`. Druhý odchod nic neudělá
 * a hlášení domečku po odchodu ho už neukáže.
 * Podržení domečku (#124): hra napojená háčkem `onHomeHold` rozhodne, jestli
 * se odejde do menu, nebo zůstane ve hře (Omalovánky se vrátí na výběr).
 */

import type { GameHost, GameProfileMarker, HomeHoldDecision } from '../logic/gameHost';
import type { KeyValueStorage } from '../storage/keyValueStorage';
import type { GameRecords } from '../storage/profileRecords';

/** Tlačítko v rohu stránky (domeček, kolečko); hra u něj přepíná jen `hidden`. */
export interface HomeButton {
  hidden: boolean;
}

/** Kolečko nastavení stránky; přepíná se u něj jen `hidden` jako u domečku. */
export type SettingsButton = HomeButton;

export interface GameSessionOptions {
  readonly homeButton: HomeButton | null;
  /** Kolečko nastavení; bez něj (`null` nebo chybí) hra běží bez kolečka. */
  readonly settingsButton?: SettingsButton | null | undefined;
  /** Úložiště hry pro aktivní profil (#71); bez něj hra ukládá jen do paměti. */
  readonly storage?: KeyValueStorage | undefined;
  /** Značka aktivního profilu (#87): jen barva a písmeno. */
  readonly profileMarker?: GameProfileMarker | undefined;
  /** Záznamy hry pro aktivní profil (#125); bez nich hra žádné nedostane. */
  readonly records?: GameRecords | undefined;
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
  /**
   * Domeček se držel 1 s (#124 AC4): bez háčku hry nebo s odpovědí
   * `'leave'` odchod jako `leave()`, s `'stay'` nic. Po odchodu nic.
   */
  holdHome(): void;
}

export function startGameSession(options: GameSessionOptions): GameSession {
  /** Kdo teď poslouchá podržení kolečka (jen právě hraná hra). */
  let settingsOpener: (() => void) | null = null;
  let homeAvailable = false;
  let hasLeft = false;
  /** Kdo rozhoduje o podržení domečku (#124); bez něj se odchází do menu. */
  let homeHoldDecider: (() => HomeHoldDecision) | null = null;
  const leaveHandlers: Array<() => void> = [];
  let cleanUpScenes: (() => void) | null = null;

  const showHome = (): void => {
    if (options.homeButton) {
      options.homeButton.hidden = !homeAvailable;
    }
  };
  /** Kolečko je vidět, jen dokud ho běžící hra poslouchá. */
  const showSettings = (): void => {
    if (options.settingsButton) {
      options.settingsButton.hidden = settingsOpener === null;
    }
  };

  const host: GameHost = {
    attachSettingsGear: (open) => {
      if (hasLeft) {
        return () => undefined;
      }
      settingsOpener = open;
      showSettings();
      return () => {
        if (settingsOpener === open) {
          settingsOpener = null;
          showSettings();
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
    onHomeHold: (decide) => {
      homeHoldDecider = decide;
    },
    storage: options.storage,
    profileMarker: options.profileMarker,
    records: options.records,
  };

  const session: GameSession = {
    host,
    isHomeEnabled: () => homeAvailable && !hasLeft,
    openSettings: () => settingsOpener?.(),
    holdHome: () => {
      if (hasLeft) {
        return;
      }
      if (homeHoldDecider?.() === 'stay') {
        return;
      }
      session.leave();
    },
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
      showSettings();
      showHome();
      cleanUpScenes?.();
      cleanUpScenes = null;
      options.onLeft();
    },
  };

  // Kolečko se ukáže, až se na něj hra napojí.
  showSettings();
  cleanUpScenes = options.startScenes(session);
  return session;
}
