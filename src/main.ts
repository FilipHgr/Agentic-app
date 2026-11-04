import Phaser from 'phaser';

import { PAGE_BACKGROUND } from './logic/theme';
import { GameScene } from './scenes/GameScene';

/** Základní rozlišení 4:3 odpovídá iPadu na šířku, Scale.FIT dopočítá zbytek. */
new Phaser.Game({
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
    width: 1024,
    height: 768,
  },
  scene: [GameScene],
});
