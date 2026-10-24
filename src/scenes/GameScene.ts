import Phaser from 'phaser';

import { createAdditionProblem, formatProblem } from '../logic/addition';

/** Scéna jen vykresluje příklad, který spočítá logika v src/logic. */
export class GameScene extends Phaser.Scene {
  constructor() {
    super('game');
  }

  create(): void {
    const problem = createAdditionProblem();

    this.add
      .text(this.scale.width / 2, this.scale.height / 2, formatProblem(problem), {
        fontFamily: 'Arial, sans-serif',
        fontSize: '160px',
        color: '#ffffff',
      })
      .setOrigin(0.5);
  }
}
