/**
 * Spuštění stažené hry na stránce (#67), společné pro všechny hry. Hra
 * se kreslí do prvku `#game` jako dřív v `src/main.ts`: herní plocha podle
 * okna (#54, #56), kolečko nastavení v pravém a domeček v levém horním
 * rohu obrazovky (#55, #68) a přepočet po otočení nebo změně lišty prohlížeče.
 * Plátno má všude 2 obrazové body na zobrazený CSS px (#77), na iPadu
 * a ve zmenšeném zobrazení je zvětší kamera scény (`sharpCanvas.ts`).
 *
 * Odchod domečkem (#68): hra se nejdřív zastaví (`GameHost.onLeave`), pak se
 * odpojí kolečko, domeček i hlídání okna, Phaser hra se zničí i s plátnem
 * a kontextem WebGL a nakonec se ohlásí `onLeft`. Po odchodu nezůstane
 * žádný posluchač, časovač ani zvuk. Domeček a pořadí odchodu řídí
 * `gameSession.ts`, tady je Phaser hra a skutečná tlačítka stránky.
 */

import Phaser from 'phaser';

import { canvasResolutionFor } from '../logic/canvasResolution';
import type { CanvasResolution } from '../logic/canvasResolution';
import { GAME_HOST_KEY } from '../logic/gameHost';
import type { GameProfileMarker } from '../logic/gameHost';
import { homeButtonFor } from '../logic/homeButton';
import { settingsGearFor } from '../logic/settingsGear';
import { PAGE_BACKGROUND } from '../logic/theme';
import { gameAreaFor } from '../logic/viewportLayout';
import type { GameAreaFit, Viewport } from '../logic/viewportLayout';
import type { KeyValueStorage } from '../storage/keyValueStorage';
import type { GameRecords } from '../storage/profileRecords';
import { startGameSession } from './gameSession';
import { applyHomeButton, attachHomeButton } from './homeButton';
import { attachSettingsButton } from './settingsButton';
import { applySettingsGear } from './settingsGear';
import { CANVAS_RESOLUTION_KEY } from './sharpCanvas';
import {
  GAME_AREA_KEY,
  hasSameLayout,
  placeGameParent,
  readViewport,
  watchViewport,
} from './viewport';

/**
 * Co vstup hry (`src/games/<hra>/index.ts`) vydává: scény hry, první se
 * spustí, a volitelně jakou herní plochu hra chce (#96, bez ní dnešní).
 */
export interface GameModule {
  readonly scenes: readonly Phaser.Types.Scenes.SceneType[];
  readonly gameAreaFit?: GameAreaFit;
}

/** Plocha, o kterou si hra řekla; cokoli jiného je dnešní plocha. */
function gameAreaFitOf(module: GameModule): GameAreaFit {
  return module.gameAreaFit === 'fullWindow' ? 'fullWindow' : 'fixed';
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
  /** Úložiště hry pro aktivní profil (#71); bez něj hra ukládá jen do paměti. */
  readonly storage?: KeyValueStorage | undefined;
  /** Značka aktivního profilu (#87): jen barva a první písmeno přezdívky. */
  readonly profileMarker?: GameProfileMarker | undefined;
  /** Záznamy hry pro aktivní profil (#125), jen v zařízení. */
  readonly records?: GameRecords | undefined;
}

/** Phaser hra bez vlastních zvuků: hry hrají přes společný zvukový kontext stránky. */
function createGame(module: GameModule, resolution: CanvasResolution): Phaser.Game {
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
      // Plátno v obrazových bodech; prvek s hrou má přesně jeho zobrazenou velikost.
      width: resolution.pixelWidth,
      height: resolution.pixelHeight,
    },
    scene: [...module.scenes],
  });
}

/** Má plátno stejný počet obrazových bodů? Pak stačí ho jen posunout. */
function hasSameCanvasSize(first: CanvasResolution, second: CanvasResolution): boolean {
  return first.pixelWidth === second.pixelWidth && first.pixelHeight === second.pixelHeight;
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
 * Hra s `gameAreaFit: 'fullWindow'` ji má přes volnou plochu i na iPadu (#96).
 * Prvek s hrou leží přesně tam, kde má být plátno, a Scale.FIT do něj
 * plátno roztáhne (#77). Kolečko nastavení
 * je vidět, jen když se na něj hra napojí (#88 AC6); domeček ukáže hra,
 * když jde použít (#68 AC4).
 */
export function runGame(module: GameModule, options: RunGameOptions): Phaser.Game {
  const parent = document.getElementById('game');
  const page: PageButtons = {
    settingsButton: document.getElementById('settings-button'),
    homeButton: document.getElementById('home-button'),
  };
  const fit = gameAreaFitOf(module);
  let area = gameAreaFor(readViewport(), fit);
  let resolution = canvasResolutionFor(area);
  if (parent) {
    parent.hidden = false;
    placeGameParent(parent, resolution);
  }
  placeCornerButtons(page, readViewport());

  // Phaser hru založí až spuštění scén, aby hned dostala hostitele hry.
  const running: { game: Phaser.Game | null } = { game: null };
  startGameSession({
    homeButton: page.homeButton,
    settingsButton: page.settingsButton,
    storage: options.storage,
    profileMarker: options.profileMarker,
    records: options.records,
    onLeft: options.onLeft,
    startScenes: (session) => {
      const started = createGame(module, resolution);
      running.game = started;
      started.registry.set(GAME_AREA_KEY, area);
      started.registry.set(CANVAS_RESOLUTION_KEY, resolution);
      started.registry.set(GAME_HOST_KEY, session.host);

      const detachSettings = page.settingsButton
        ? attachSettingsButton(page.settingsButton, () => session.openSettings())
        : () => undefined;
      const detachHome = page.homeButton
        ? attachHomeButton(page.homeButton, {
            isEnabled: () => session.isHomeEnabled(),
            // Hra s háčkem (#124) může podržení domečku převzít, jinak odchod do menu.
            onGoHome: () => session.holdHome(),
          })
        : () => undefined;
      /**
       * Po otočení nebo změně lišty prohlížeče se herní plocha přepočítá. Scéna
       * se překreslí jen při jiném rozložení, jinak se plocha jen posune nebo
       * zmenší. Plátno dostane nové rozlišení podle zobrazené velikosti (#77 AC7).
       */
      const stopWatchingViewport = watchViewport(() => {
        const viewport = readViewport();
        placeCornerButtons(page, viewport);
        const next = gameAreaFor(viewport, fit);
        const layoutChanged = !hasSameLayout(next, area);
        const nextResolution = canvasResolutionFor(next);
        const canvasChanged = !hasSameCanvasSize(nextResolution, resolution);
        area = next;
        resolution = nextResolution;
        if (parent) {
          placeGameParent(parent, resolution);
        }
        // Phaser si velikost prvku s hrou jinak přečte až později a hru by zmenšil podle staré.
        started.scale.getParentBounds();
        if (canvasChanged) {
          started.scale.setGameSize(resolution.pixelWidth, resolution.pixelHeight);
        } else {
          started.scale.refresh();
        }
        // Kamera scény se zvětší podle nového plátna; rozložení se tím nemění.
        started.registry.set(CANVAS_RESOLUTION_KEY, resolution);
        if (layoutChanged) {
          // Scéna poslouchá změnu v registru a překreslí se podle nové plochy.
          started.registry.set(GAME_AREA_KEY, area);
        }
      });

      return () => {
        detachSettings();
        detachHome();
        stopWatchingViewport();
        destroyGame(started);
        // Prázdný prvek hry by jinak ležel přes menu a bral mu ťuknutí.
        if (parent) {
          parent.hidden = true;
        }
      };
    },
  });
  if (running.game === null) {
    throw new Error('hra se nespustila');
  }
  return running.game;
}
