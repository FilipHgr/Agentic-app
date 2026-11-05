/**
 * Stránka s menu (#67): plátno menu přes celé okno, logika menu, odemčení
 * zvuku prvním ťuknutím a spuštění hry. Po spuštění hry se menu zavře.
 * Návrat z hry do menu přijde v #68.
 */

import Phaser from 'phaser';

import { unlockSharedAudio } from '../../shared/audio/sharedAudio';
import type { GameCategory, GameEntry } from '../../shared/logic/gameRegistry';
import { PAGE_BACKGROUND } from '../../shared/logic/theme';
import { currentLanguage } from '../../shared/texts/languages';
import { readViewport, watchViewport } from '../../shared/ui/viewport';
import { createMenu } from '../logic/menu';
import type { Menu } from '../logic/menu';
import { menuLayoutFor } from '../logic/menuLayout';
import type { MenuLayout } from '../logic/menuLayout';
import { menuText } from '../logic/menuTexts';
import { MENU_UNITS_PER_CSS_PX, MenuScene } from '../scenes/MenuScene';
import { launchGame } from './launchGame';

export interface MenuPageOptions {
  readonly games: readonly GameEntry[];
  readonly categories: readonly GameCategory[];
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
 * Název stránky a kolečko nastavení podle logiky menu (#67 AC1, AC2):
 * v menu „Matematika“ a skryté kolečko, po naběhnutí hry její název a kolečko.
 */
function showPageState(menu: Menu): void {
  document.title = menu.pageTitle();
  const settingsButton = document.getElementById('settings-button');
  if (settingsButton) {
    settingsButton.hidden = !menu.canOpenSettings();
  }
}

/** Co menu potřebuje až po svém vytvoření: scénu pro odezvu a zavření menu. */
interface MenuView {
  scene?: MenuScene;
  close?: () => void;
}

export function startMenuPage(options: MenuPageOptions): void {
  const view: MenuView = {};
  const menu: Menu = createMenu({
    games: options.games,
    categories: options.categories,
    translate,
    start: (game, loaded) => launchGame(game, loaded, { closeMenu: () => view.close?.() }),
    feedback: (event) => view.scene?.play(event),
    onStarted: () => showPageState(menu),
  });

  const categoryTitles = menu.categories().map((category) => category.title);
  const layout = (): MenuLayout =>
    menuLayoutFor(readViewport(), { categoryTitles, tileCount: menu.tiles().length });
  const scene = new MenuScene({
    menu,
    layout,
    onTapped: () => scene.redrawIfSelectionChanged(),
  });
  view.scene = scene;

  const menuGame = createMenuGame(scene);
  showPageState(menu);
  unlockAudioOnTouch();

  // Po otočení nebo změně lišty prohlížeče se plátno zvětší na nové okno.
  const stopWatchingViewport = watchViewport(() => {
    const next = canvasSize();
    menuGame.scale.getParentBounds();
    menuGame.scale.setGameSize(next.width, next.height);
    scene.requestRedraw();
  });

  view.close = () => {
    stopWatchingViewport();
    menuGame.destroy(true);
    const parent = document.getElementById('menu');
    if (parent) {
      parent.hidden = true;
    }
  };
}
