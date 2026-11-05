/**
 * Stránka s menu (#67): plátno menu přes celé okno, logika menu, odemčení
 * zvuku prvním ťuknutím a spuštění hry. Po spuštění hry se menu schová
 * a uspí (nekreslí se), po návratu z hry domečkem (#68) se znovu ukáže
 * na stejné kategorii a se stejným posunem mřížky i kategorií (#69).
 * Plátno menu je jedno pro celé načtení stránky, takže
 * opakované vstupy do her a návraty nezakládají nová plátna ani posluchače.
 * Po výběru jiného jazyka (#70) se menu nakreslí znovu v novém jazyce
 * a stránka dostane jeho `lang` a název; hra spuštěná potom si jazyk vezme
 * ze sdílené části.
 */

import Phaser from 'phaser';

import { unlockSharedAudio } from '../../shared/audio/sharedAudio';
import type { GameCategory, GameEntry } from '../../shared/logic/gameRegistry';
import { chooseSubscriptionSource } from '../../shared/logic/subscriptionSource';
import { PAGE_BACKGROUND } from '../../shared/logic/theme';
import type { ProfileStore } from '../../shared/storage/profileStorage';
import { currentLanguage } from '../../shared/texts/languages';
import { readViewport, watchViewport } from '../../shared/ui/viewport';
import { createMenu } from '../logic/menu';
import type { Menu } from '../logic/menu';
import { menuLayoutFor } from '../logic/menuLayout';
import type { MenuLayout } from '../logic/menuLayout';
import { menuText } from '../logic/menuTexts';
import { createMenuTouch } from '../logic/menuTouch';
import { MENU_UNITS_PER_CSS_PX, MenuScene } from '../scenes/MenuScene';
import { launchGame } from './launchGame';
import { showPageLanguage } from './pageLanguage';

export interface MenuPageOptions {
  readonly games: readonly GameEntry[];
  readonly categories: readonly GameCategory[];
  /** Profily zařízení (#71): kolečko v menu a úložiště spuštěné hry. */
  readonly profiles: ProfileStore;
}

/** Text menu v aktuálním jazyce. */
function translate(key: string): string {
  return menuText(key, currentLanguage()) ?? '';
}

/** Velikost plátna menu v jednotkách: celé okno, dvě jednotky na CSS px. */
function canvasSize(): { width: number; height: number } {
  return {
    width: Math.max(1, Math.round(window.innerWidth * MENU_UNITS_PER_CSS_PX)),
    height: Math.max(1, Math.round(window.innerHeight * MENU_UNITS_PER_CSS_PX)),
  };
}

/**
 * Safari pustí zvuk jen v reakci na dotyk, a to až po zvednutí prstu.
 * Odemčený zvuk pak hra spuštěná z menu použije hned (průvodce, #67 AC6).
 */
function unlockAudioOnTouch(): void {
  for (const type of ['pointerdown', 'pointerup', 'touchend'] as const) {
    document.addEventListener(type, unlockSharedAudio, { capture: true, passive: true });
  }
}

/** Plátno menu přes celé okno; zvuky menu hraje vlastní přehrávač tónů. */
function createMenuGame(scene: MenuScene): Phaser.Game {
  const size = canvasSize();
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'menu',
    backgroundColor: PAGE_BACKGROUND,
    disableContextMenu: true,
    audio: { noAudio: true },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: size.width,
      height: size.height,
    },
    scene: [scene],
  });
}

/**
 * Název stránky, kolečko nastavení a domeček podle logiky menu (#67 AC1,
 * AC2, #68 AC1): v menu „Matematika“ a obojí skryté, po naběhnutí hry její
 * název a kolečko. Domeček ve hře ukáže hra, když jde použít.
 */
function showPageState(menu: Menu): void {
  document.title = menu.pageTitle();
  const settingsButton = document.getElementById('settings-button');
  if (settingsButton) {
    settingsButton.hidden = !menu.canOpenSettings();
  }
  const homeButton = document.getElementById('home-button');
  if (homeButton && !menu.canGoHome()) {
    homeButton.hidden = true;
  }
}

/** Co menu potřebuje až po svém vytvoření: scénu pro odezvu, schování a ukázání menu. */
interface MenuView {
  scene?: MenuScene;
  close?: () => void;
  reopen?: () => void;
}

export function startMenuPage(options: MenuPageOptions): void {
  const view: MenuView = {};
  const menu: Menu = createMenu({
    games: options.games,
    categories: options.categories,
    translate,
    start: (game, loaded) =>
      launchGame(game, loaded, {
        closeMenu: () => view.close?.(),
        returnToMenu: () => menu.returnFromGame(),
        subscription: chooseSubscriptionSource(),
        gameStorage: (gameId) => options.profiles.gameStorage(gameId),
      }),
    feedback: (event) => view.scene?.play(event),
    profile: () => options.profiles.activeProfile(),
    onStarted: () => showPageState(menu),
    onReturned: () => {
      showPageState(menu);
      view.reopen?.();
    },
    onLanguageChanged: () => {
      showPageLanguage(document, currentLanguage());
      showPageState(menu);
    },
  });

  // „Vše“ ukáže všechny hry; podle jejich počtu se volí výška dlaždic (#69).
  const allTileCount = options.games.length;
  // Názvy kategorií a jazyků se berou při každém kreslení, po výběru
  // jazyka jsou v novém jazyce (#70).
  const layout = (): MenuLayout =>
    menuLayoutFor(readViewport(), {
      categoryTitles: menu.categories().map((category) => category.title),
      tileCount: menu.tiles().length,
      allTileCount,
      languageNames: menu.languages().map((language) => language.name),
      profileNickname: menu.profileBadge().nickname,
    });
  // Posun mřížky a kategorií žije s menu po celé načtení stránky, takže
  // po návratu z hry zůstane, jak ho dítě nechalo (#69 AC5).
  const touch = createMenuTouch({ menu });
  const scene = new MenuScene({
    menu,
    touch,
    layout,
    onTapped: () => scene.redrawIfSelectionChanged(),
  });
  view.scene = scene;

  const menuGame = createMenuGame(scene);
  showPageLanguage(document, currentLanguage());
  showPageState(menu);
  unlockAudioOnTouch();

  const parent = document.getElementById('menu');
  let menuShown = true;

  /** Plátno menu podle současného okna; nakreslí se znovu v dalším snímku. */
  const fitToWindow = (): void => {
    const next = canvasSize();
    menuGame.scale.getParentBounds();
    menuGame.scale.setGameSize(next.width, next.height);
    scene.requestRedraw();
  };

  // Po otočení nebo změně lišty prohlížeče se plátno zvětší na nové okno.
  // Schované menu se přizpůsobí až při návratu z hry.
  watchViewport(() => {
    if (menuShown) {
      fitToWindow();
    }
  });

  view.close = () => {
    menuShown = false;
    menuGame.loop.sleep();
    if (parent) {
      parent.hidden = true;
    }
  };

  view.reopen = () => {
    menuShown = true;
    if (parent) {
      parent.hidden = false;
    }
    menuGame.loop.wake();
    fitToWindow();
  };
}
