/**
 * Spuštění stažené hry na stránce (#67), společné pro všechny hry. Hra
 * se kreslí do prvku `#game` jako dřív v `src/main.ts`: herní plocha podle
 * okna (#54, #56), kolečko nastavení v pravém a domeček v levém horním
 * rohu obrazovky (#55, #68) a přepočet po otočení nebo změně lišty prohlížeče.
 *
 * Odchod domečkem (#68): hra se nejdřív zastaví (`GameHost.onLeave`), pak se
 * odpojí kolečko, domeček i hlídání okna, Phaser hra se zničí i s plátnem
 * a kontextem WebGL a nakonec se ohlásí `onLeft`. Po odchodu nezůstane
 * žádný posluchač, časovač ani zvuk.
 */

import Phaser from 'phaser';

import { GAME_HOST_KEY } from '../logic/gameHost';
import type { GameHost } from '../logic/gameHost';
import { homeButtonFor } from '../logic/homeButton';
import { settingsGearFor } from '../logic/settingsGear';
import { PAGE_BACKGROUND } from '../logic/theme';
import { gameAreaFor } from '../logic/viewportLayout';
import type { GameArea, Viewport } from '../logic/viewportLayout';
import { applyHomeButton, attachHomeButton } from './homeButton';
import { attachSettingsButton } from './settingsButton';
import { applySettingsGear } from './settingsGear';
import {
  GAME_AREA_KEY,
  hasSameLayout,
  placeGameParent,
  readViewport,
  watchViewport,
} from './viewport';

/** Co vstup hry (`src/games/<hra>/index.ts`) vydává: scény hry, první se spustí. */
export interface GameModule {
  readonly scenes: readonly Phaser.Types.Scenes.SceneType[];
}

/** Je stažený soubor opravdu vstup hry se scénami? */
export function isGameModule(value: unknown): value is GameModule {
  if (typeof value !== 'object' || value === null || !('scenes' in value)) {
    return false;
  }
  const scenes = (value as { scenes: unknown }).scenes;
  return Array.isArray(scenes) && scenes.length > 0;
}

/** Kolečko nastavení a domeček: na telefonu menší, na iPadu jako dřív (#55, #68). */
function placeCornerButtons(page: PageButtons, viewport: Viewport): void {
  if (page.settingsButton) {
    applySettingsGear(page.settingsButton, settingsGearFor(viewport));
  }
  if (page.homeButton) {
    applyHomeButton(page.homeButton, homeButtonFor(viewport));
  }
}

interface PageButtons {
  readonly settingsButton: HTMLElement | null;
  readonly homeButton: HTMLElement | null;
}

export interface RunGameOptions {
  /** Dítě odešlo domečkem a hra je zničená: stránka ukáže menu. */
  readonly onLeft: () => void;
}

/** Phaser hra bez vlastních zvuků: hry hrají přes společný zvukový kontext stránky. */
function createGame(module: GameModule, area: GameArea): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: PAGE_BACKGROUND,
    // Chrome na Androidu jinak při podržení prstu otevře nabídku obrázku
    // a podržení kolečka nastavení přeruší.
    disableContextMenu: true,
    // Každý vstup do hry by jinak založil nový zvukový kontext (#68 AC5).
    audio: { noAudio: true },
    // Dva prsty najednou: dítě smí ťuknout na dvě tečky nápovědy současně (#43).
    input: { activePointers: 2 },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: area.width,
      height: area.height,
    },
    scene: [...module.scenes],
  });
}

/**
 * Zničí hru i s plátnem. Phaser kontext WebGL sám neuvolní a prohlížeč jich
 * drží jen pár, proto se po zničení výslovně zahodí (#68 AC5).
 */
function destroyGame(game: Phaser.Game): void {
  const renderer = game.renderer;
  const gl = renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer ? renderer.gl : null;
  game.events.once(Phaser.Core.Events.DESTROY, () => {
    // Renderer se ničí až po této události, kontext se zahodí hned po něm.
    setTimeout(() => gl?.getExtension('WEBGL_lose_context')?.loseContext(), 0);
  });
  game.destroy(true);
}

/**
 * Herní plocha podle okna (#54, #56): na iPadu a v ostatních oknech pevně
 * 1024 × 768, na telefonu na šířku i na výšku přes celou volnou plochu.
 * Scale.FIT ji do prvku s hrou zmenší a vycentruje. Kolečko nastavení
 * ukáže stránka menu, až hra naběhne (#67 AC1); domeček ukáže hra, když
 * jde použít (#68 AC4).
 */
export function runGame(module: GameModule, options: RunGameOptions): Phaser.Game {
  const parent = document.getElementById('game');
  const page: PageButtons = {
    settingsButton: document.getElementById('settings-button'),
    homeButton: document.getElementById('home-button'),
  };
  let area = gameAreaFor(readViewport());
  if (parent) {
    parent.hidden = false;
    placeGameParent(parent, area);
  }
  placeCornerButtons(page, readViewport());

  const game = createGame(module, area);
  game.registry.set(GAME_AREA_KEY, area);

  /** Kdo teď poslouchá podržení kolečka (jen právě hraná hra). */
  let openSettings: (() => void) | null = null;
  let homeAvailable = false;
  const leaveHandlers: Array<() => void> = [];
  let hasLeft = false;

  const host: GameHost = {
    attachSettingsGear: (open) => {
      openSettings = open;
      return () => {
        if (openSettings === open) {
          openSettings = null;
        }
      };
    },
    setHomeAvailable: (available) => {
      homeAvailable = available && !hasLeft;
      if (page.homeButton) {
        page.homeButton.hidden = !homeAvailable;
      }
    },
    onLeave: (handler) => {
      leaveHandlers.push(handler);
    },
  };
  game.registry.set(GAME_HOST_KEY, host);

  const detachSettings = page.settingsButton
    ? attachSettingsButton(page.settingsButton, () => openSettings?.())
    : () => undefined;
  const detachHome = page.homeButton
    ? attachHomeButton(page.homeButton, {
        isEnabled: () => homeAvailable && !hasLeft,
        onGoHome: () => leave(),
      })
    : () => undefined;

  /**
   * Po otočení nebo změně lišty prohlížeče se herní plocha přepočítá. Scéna
   * se překreslí jen při jiném rozložení, jinak se plocha jen posune.
   */
  const stopWatchingViewport = watchViewport(() => {
    const viewport = readViewport();
    placeCornerButtons(page, viewport);
    const next = gameAreaFor(viewport);
    const layoutChanged = !hasSameLayout(next, area);
    area = next;
    if (parent) {
      placeGameParent(parent, area);
    }
    // Phaser si velikost prvku s hrou jinak přečte až později a hru by zmenšil podle staré.
    game.scale.getParentBounds();
    if (!layoutChanged) {
      game.scale.refresh();
      return;
    }
    game.scale.setGameSize(area.width, area.height);
    // Scéna poslouchá změnu v registru a překreslí se podle nové plochy.
    game.registry.set(GAME_AREA_KEY, area);
  });

  function leave(): void {
    if (hasLeft) {
      return;
    }
    hasLeft = true;
    homeAvailable = false;
    // Hra se zastaví dřív, než zmizí: ztiší zvuky a zruší naplánované akce.
    for (const handler of leaveHandlers.splice(0)) {
      handler();
    }
    openSettings = null;
    detachSettings();
    detachHome();
    stopWatchingViewport();
    if (page.homeButton) {
      page.homeButton.hidden = true;
    }
    destroyGame(game);
    // Prázdný prvek hry by jinak ležel přes menu a bral mu ťuknutí.
    if (parent) {
      parent.hidden = true;
    }
    options.onLeft();
  }

  return game;
}
