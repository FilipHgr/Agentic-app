/**
 * Stránka s menu (#67): plátno menu přes celé okno, logika menu, odemčení
 * zvuku prvním ťuknutím a spuštění hry (napojení menu na spouštění her,
 * kolečko a domeček je v `pageMenu.ts`). Po spuštění hry se menu schová
 * a uspí (nekreslí se), po návratu z hry domečkem (#68) se znovu ukáže
 * na stejné kategorii a se stejným posunem mřížky i kategorií (#69).
 * Plátno menu je jedno pro celé načtení stránky, takže
 * opakované vstupy do her a návraty nezakládají nová plátna ani posluchače.
 * Po výběru jiného jazyka (#70) se menu nakreslí znovu v novém jazyce
 * a stránka dostane jeho `lang` a název; hra spuštěná potom si jazyk vezme
 * ze sdílené části.
 *
 * Výběr profilu a formulář nového profilu (#72) jsou druhá scéna na
 * stejném plátně. Při startu se výběr ukáže jen při dvou a více profilech,
 * z menu ho otevře ťuknutí na kolečko profilu. Dokud je otevřený, menu
 * spí; po výběru profilu se menu probudí a nakreslí s novým kolečkem
 * a hra pak dostane úložiště vybraného profilu.
 *
 * Nová verze webu (#76): když se hra nestáhne a server stránky odpovídá,
 * stránka se sama jednou obnoví (`pageUpdate`). Dotaz jde jen na stejný
 * původ, nikdy na cizí server.
 */

import Phaser from 'phaser';

import { unlockSharedAudio } from '../../shared/audio/sharedAudio';
import { profileMarkerOf } from '../../shared/logic/gameHost';
import type { GameCategory, GameEntry } from '../../shared/logic/gameRegistry';
import { PAGE_BACKGROUND } from '../../shared/logic/theme';
import { browserStorage } from '../../shared/storage/keyValueStorage';
import type { ProfileStore } from '../../shared/storage/profileStorage';
import { currentLanguage } from '../../shared/texts/languages';
import { readViewport, watchViewport } from '../../shared/ui/viewport';
import type { Menu } from '../logic/menu';
import { menuLayoutFor } from '../logic/menuLayout';
import type { MenuLayout } from '../logic/menuLayout';
import { menuText } from '../logic/menuTexts';
import { createMenuTouch } from '../logic/menuTouch';
import { createPageUpdate } from '../logic/pageUpdate';
import type { PageUpdate } from '../logic/pageUpdate';
import { createProfileScreens } from '../logic/profileScreens';
import { MENU_SCENE_KEY, MENU_UNITS_PER_CSS_PX, MenuScene } from '../scenes/MenuScene';
import { PROFILE_SCENE_KEY, ProfileScene } from '../scenes/ProfileScene';
import { showPageLanguage } from './pageLanguage';
import { createPageMenu } from './pageMenu';

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

/**
 * Plátno menu přes celé okno se scénou menu a nad ní scénou profilů;
 * zvuky hrají vlastní přehrávače tónů.
 */
function createMenuGame(scenes: readonly Phaser.Scene[]): Phaser.Game {
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
    scene: [...scenes],
  });
}

/** Jak dlouho se čeká na odpověď serveru, než se bere jako výpadek sítě. */
const SERVER_CHECK_TIMEOUT_MS = 5000;

/**
 * Odpovídá server stránky? Dotaz na úvodní stránku stejného původu bez
 * mezipaměti. Cloudflare na neexistující soubor vrací stránku s kódem 200,
 * takže dotaz jen ověří, že server žije, ne že chybí soubor hry. Podle
 * otevřené otázky 2 v #76 to stačí: jiný důvod selhání vede nejvýš na
 * jedno zbytečné obnovení, další hlídá značka obnovení.
 */
async function serverResponds(): Promise<boolean> {
  // Prohlížeč odmítne cokoli mimo stejný původ, i přesměrování. Visící
  // spojení se po chvíli zruší a bere se jako „server neodpovídá“.
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), SERVER_CHECK_TIMEOUT_MS);
  try {
    const response = await fetch('./', {
      cache: 'no-store',
      mode: 'same-origin',
      credentials: 'same-origin',
      signal: controller.signal,
    });
    return response.ok;
  } finally {
    window.clearTimeout(timer);
  }
}

/** Obnovení stránky po nasazení nové verze (#76). */
function pageUpdateFor(profiles: ProfileStore): PageUpdate {
  return createPageUpdate({
    storage: browserStorage(),
    serverResponds,
    reloadPage: () => window.location.reload(),
    activeProfileId: () => profiles.activeProfile().id,
  });
}

/** Co menu potřebuje až po svém vytvoření: scénu pro odezvu, schování a ukázání menu. */
interface MenuView {
  scene?: MenuScene;
  profileScene?: ProfileScene;
  close?: () => void;
  reopen?: () => void;
  openProfiles?: () => void;
  closeProfiles?: () => void;
}

export function startMenuPage(options: MenuPageOptions): void {
  const view: MenuView = {};
  const screens = createProfileScreens({
    profiles: options.profiles,
    feedback: (event) => view.profileScene?.play(event),
    onProfileChosen: () => view.closeProfiles?.(),
  });
  const pageUpdate = pageUpdateFor(options.profiles);
  if (pageUpdate.startScreen(options.profiles.profiles()) === 'profilePicker') {
    screens.open();
  }
  const menu: Menu = createPageMenu({
    games: options.games,
    categories: options.categories,
    translate,
    buttons: {
      settingsButton: document.getElementById('settings-button'),
      homeButton: document.getElementById('home-button'),
    },
    closeMenu: () => view.close?.(),
    reopenMenu: () => view.reopen?.(),
    gameStorage: (gameId) => options.profiles.gameStorage(gameId),
    profileMarker: () => profileMarkerOf(options.profiles.activeProfile()),
    onPageStateChanged: (shown) => {
      document.title = shown.pageTitle();
    },
    feedback: (event) => view.scene?.play(event),
    profile: () => options.profiles.activeProfile(),
    onOpenProfilePicker: () => view.openProfiles?.(),
    pageUpdate,
    onLanguageChanged: () => showPageLanguage(document, currentLanguage()),
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
  const profileScene = new ProfileScene({
    screens,
    menu,
    translate,
    isOpen: () => screens.screen() !== 'closed',
    onCreated: () => {
      if (screens.screen() !== 'closed') {
        menuGame.scene.sleep(MENU_SCENE_KEY);
      }
    },
  });
  view.profileScene = profileScene;

  const menuGame = createMenuGame([scene, profileScene]);
  showPageLanguage(document, currentLanguage());
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
      profileScene.requestRedraw();
    }
  });

  view.openProfiles = () => {
    screens.open();
    menuGame.scene.wake(PROFILE_SCENE_KEY);
    profileScene.requestRedraw();
    menuGame.scene.sleep(MENU_SCENE_KEY);
  };

  view.closeProfiles = () => {
    menuGame.scene.sleep(PROFILE_SCENE_KEY);
    menuGame.scene.wake(MENU_SCENE_KEY);
    scene.requestRedraw();
  };

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
