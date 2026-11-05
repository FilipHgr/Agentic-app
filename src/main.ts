import Phaser from 'phaser';

import { gameAreaFor } from './shared/logic/viewportLayout';
import { settingsGearFor } from './shared/logic/settingsGear';
import type { Viewport } from './shared/logic/viewportLayout';
import { PAGE_BACKGROUND } from './shared/logic/theme';
import { GameScene } from './games/counting';
import { applySettingsGear } from './shared/ui/settingsGear';
import {
  GAME_AREA_KEY,
  hasSameLayout,
  placeGameParent,
  readViewport,
  watchViewport,
} from './shared/ui/viewport';

const parent = document.getElementById('game');
let area = gameAreaFor(readViewport());
if (parent) {
  placeGameParent(parent, area);
}

/** Kolečko nastavení: na telefonu menší, na iPadu jako dřív (#55). */
const settingsButton = document.getElementById('settings-button');
function placeSettingsGear(viewport: Viewport): void {
  if (settingsButton) {
    applySettingsGear(settingsButton, settingsGearFor(viewport));
  }
}
placeSettingsGear(readViewport());

/**
 * Herní plocha podle okna (#54, #56): na iPadu a v ostatních oknech pevně
 * 1024 × 768, na telefonu na šířku i na výšku přes celou volnou plochu. Scale.FIT
 * ji do prvku s hrou zmenší a vycentruje.
 */
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
  scene: [GameScene],
});
game.registry.set(GAME_AREA_KEY, area);

/**
 * Po otočení nebo změně lišty prohlížeče se herní plocha přepočítá. Scéna
 * se překreslí jen při jiném rozložení, jinak se plocha jen posune.
 */
watchViewport(() => {
  const viewport = readViewport();
  placeSettingsGear(viewport);
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
