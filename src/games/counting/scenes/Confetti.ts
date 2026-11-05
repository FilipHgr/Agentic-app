import Phaser from 'phaser';

import { CONFETTI_COLORS } from '../logic/theme';
import { colorNumber } from '../../../shared/logic/theme';
import type { GameSize } from '../../../shared/logic/viewportLayout';

const CONFETTI_COUNT = 80;
/** Velikost konfet, odkud padají a jak daleko uletí do strany (na iPadu). */
const CONFETTI_WIDTH = 14;
const CONFETTI_HEIGHT = 22;
const CONFETTI_START_Y = -20;
const CONFETTI_DRIFT = 120;
const CONFETTI_END_MARGIN = 30;

/** Konfety v barvách, které jsou na světlém pozadí vidět (#53). */
const CONFETTI_COLOR_NUMBERS = CONFETTI_COLORS.map(colorNumber);

/** Konfety při oslavě po zaplnění řady hvězdiček. */
export class Confetti {
  private pieces: Phaser.GameObjects.Rectangle[] = [];

  constructor(private readonly scene: Phaser.Scene) {}

  /**
   * Konfety spadnou shora přes celou herní plochu.
   *
   * @param detail Velikost konfet a jejich pohybu proti iPadu (#54).
   */
  throw(area: GameSize, detail: number): void {
    const { width, height } = area;
    const drift = CONFETTI_DRIFT * detail;

    for (let index = 0; index < CONFETTI_COUNT; index += 1) {
      const color = CONFETTI_COLOR_NUMBERS[index % CONFETTI_COLOR_NUMBERS.length];
      const piece = this.scene.add
        .rectangle(
          Phaser.Math.Between(0, width),
          CONFETTI_START_Y * detail,
          CONFETTI_WIDTH * detail,
          CONFETTI_HEIGHT * detail,
          color,
        )
        .setAngle(Phaser.Math.Between(0, 360))
        .setDepth(10);
      this.pieces.push(piece);

      this.scene.tweens.add({
        targets: piece,
        y: height + CONFETTI_END_MARGIN * detail,
        x: piece.x + Phaser.Math.Between(-drift, drift),
        angle: piece.angle + Phaser.Math.Between(180, 720),
        duration: Phaser.Math.Between(1500, 2400),
        delay: Phaser.Math.Between(0, 500),
        ease: 'Sine.easeIn',
        onComplete: () => piece.destroy(),
      });
    }
  }

  /** Oslava doběhla: konfety dopadají samy, jen se na ně přestane pamatovat. */
  forget(): void {
    this.pieces = [];
  }

  /** Oslava se přerušila: konfety hned zmizí. */
  clear(): void {
    for (const piece of this.pieces) {
      this.scene.tweens.killTweensOf(piece);
      piece.destroy();
    }
    this.pieces = [];
  }
}
