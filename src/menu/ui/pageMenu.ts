/**
 * Menu stránky napojené na spouštění her (#67, #68, #74), bez DOM. Hra se
 * spouští přes `launchGame` se zdrojem stavu předplatného z výběru zdroje
 * (`chooseSubscriptionSource`), takže zamčená hra nejde spustit ani tady.
 * Kolečko nastavení a domeček dostane menu zvenku jako tlačítka
 * s atributem `hidden`: na stránce skutečné prvky, v testech falešné.
 *
 * Tlačítka se nastaví hned po vytvoření menu, po naběhnutí hry, po návratu
 * z hry a po změně jazyka (#70). Stránka se o každém nastavení dozví přes
 * `onPageStateChanged` (název stránky).
 */

import type { GameProfileMarker } from '../../shared/logic/gameHost';
import { chooseSubscriptionSource } from '../../shared/logic/subscriptionSource';
import type { KeyValueStorage } from '../../shared/storage/keyValueStorage';
import { createMenu } from '../logic/menu';
import type { Menu, MenuOptions } from '../logic/menu';
import { launchGame } from './launchGame';

/** Tlačítko v rohu stránky; menu u něj přepíná jen `hidden`. */
export interface CornerButton {
  hidden: boolean;
}

/** Kolečko nastavení a domeček; chybějící tlačítko je `null`. */
export interface CornerButtons {
  readonly settingsButton: CornerButton | null;
  readonly homeButton: CornerButton | null;
}

export interface PageMenuOptions extends Omit<MenuOptions, 'start' | 'onStarted' | 'onReturned'> {
  readonly buttons: CornerButtons;
  /** Schová menu, až hra naběhne. */
  readonly closeMenu: () => void;
  /** Znovu ukáže menu po návratu z hry domečkem (#68). */
  readonly reopenMenu: () => void;
  /** Úložiště hry pro aktivní profil (#71); bez něj hra ukládá jen do paměti. */
  readonly gameStorage?: ((gameId: string) => KeyValueStorage) | undefined;
  /** Značka aktivního profilu pro hru (#87): jen barva a písmeno. */
  readonly profileMarker?: (() => GameProfileMarker) | undefined;
  /** Menu právě nastavilo tlačítka: stránka podle menu nastaví svůj název. */
  readonly onPageStateChanged?: ((menu: Menu) => void) | undefined;
}

/**
 * Kolečko nastavení a domeček podle logiky menu (#67 AC1, AC2, #68 AC1):
 * v menu obojí skryté, po naběhnutí hry kolečko vidět. Domeček menu jen
 * skrývá, ve hře ho ukáže hra, když jde použít (#68 AC4).
 */
export function showCornerButtons(menu: Menu, buttons: CornerButtons): void {
  if (buttons.settingsButton) {
    buttons.settingsButton.hidden = !menu.canOpenSettings();
  }
  if (buttons.homeButton && !menu.canGoHome()) {
    buttons.homeButton.hidden = true;
  }
}

export function createPageMenu(options: PageMenuOptions): Menu {
  const {
    buttons,
    closeMenu,
    reopenMenu,
    gameStorage,
    profileMarker,
    onPageStateChanged,
    ...menuOptions
  } = options;
  const showPageState = (): void => {
    onPageStateChanged?.(menu);
    showCornerButtons(menu, buttons);
  };
  const menu: Menu = createMenu({
    ...menuOptions,
    start: (game, loaded) =>
      launchGame(game, loaded, {
        closeMenu,
        returnToMenu: () => menu.returnFromGame(),
        subscription: chooseSubscriptionSource(),
        gameStorage,
        profileMarker,
      }),
    onStarted: () => showPageState(),
    onReturned: () => {
      showPageState();
      reopenMenu();
    },
    onLanguageChanged: () => {
      options.onLanguageChanged?.();
      showPageState();
    },
  });
  showPageState();
  return menu;
}
