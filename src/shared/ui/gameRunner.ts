/**
 * Spuštění stažené hry na stránce (#67), společné pro všechny hry. Hra
 * se kreslí do prvku `#game` jako dřív v `src/main.ts`: herní plocha podle
 * okna (#54, #56), kolečko nastavení v rohu obrazovky (#55) a přepočet
 * po otočení nebo změně lišty prohlížeče.
 */

import Phaser from 'phaser';

import { settingsGearFor } from '../logic/settingsGear';
import { PAGE_BACKGROUND } from '../logic/theme';
import { gameAreaFor } from '../logic/viewportLayout';
import type { Viewport } from '../logic/viewportLayout';
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

/** Kolečko nastavení: na telefonu menší, na iPadu jako dřív (#55). */
function placeSettingsGear(settingsButton: HTMLElement | null, viewport: Viewport): void {
  if (settingsButton) {
    applySettingsGear(settingsButton, settingsGearFor(viewport));
  }
}

/**
 * Herní plocha podle okna (#54, #56): na iPadu a v ostatních oknech pevně
 * 1024 × 768, na telefonu na šířku i na výšku přes celou volnou plochu.
 * Scale.FIT ji do prvku s hrou zmenší a vycentruje. Kolečko nastavení
 * ukáže stránka menu, až hra naběhne (#67 AC1).
 */
export function runGame(module: GameModule): Phaser.Game {
  const parent = document.getElementById('game');
  const settingsButton = document.getElementById('settings-button');
  let area = gameAreaFor(readViewport());
  if (parent) {
    placeGameParent(parent, area);
  }
  placeSettingsGear(settingsButton, readViewport());

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: PAGE_BACKGROUND,
    // Chrome na Androidu jinak při podržení prstu otevře nabídku obrázku
    // a podržení kolečka nastavení přeruší.
    disableContextMenu: true,
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
  game.registry.set(GAME_AREA_KEY, area);

  /**
   * Po otočení nebo změně lišty prohlížeče se herní plocha přepočítá. Scéna
   * se překreslí jen při jiném rozložení, jinak se plocha jen posune.
   */
  watchViewport(() => {
    const viewport = readViewport();
    placeSettingsGear(settingsButton, viewport);
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
  return game;
}
