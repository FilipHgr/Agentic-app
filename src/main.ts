import Phaser from 'phaser';

import { gameSizeFor } from './logic/screenLayout';
import { GameScene } from './scenes/GameScene';

/**
 * Herní plocha má stejný poměr stran jako obrazovka, takže ji Scale.FIT
 * roztáhne přes celou obrazovku bez prázdných pruhů. Při změně velikosti
 * okna ji scéna přepočítá (GameScene.fitToWindow).
 */
const size = gameSizeFor(window.innerWidth, window.innerHeight);

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#1f6f43',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: size.width,
    height: size.height,
  },
  scene: [GameScene],
});
