import Phaser from 'phaser';

import { GameScene } from './scenes/GameScene';

/** Základní rozlišení 4:3 odpovídá iPadu na šířku, Scale.FIT dopočítá zbytek. */
new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#1f6f43',
  // Chrome na Androidu jinak při podržení prstu otevře nabídku obrázku
  // a podržení kolečka nastavení přeruší.
  disableContextMenu: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 1024,
    height: 768,
  },
  scene: [GameScene],
});
