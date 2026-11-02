import Phaser from 'phaser';

import { mascotExpression } from '../logic/mascot';
import type { MascotReaction } from '../logic/mascot';
import { MASCOT_DANCE_SWAY, MASCOT_JUMP_HEIGHT, MASCOT_SIZE } from '../logic/screenLayout';
import type { Point } from '../logic/screenLayout';

const BODY_COLOR = 0x8d6e63;
const BELLY_COLOR = 0xd7ccc8;
const WING_COLOR = 0x6d4c41;
const EYE_WHITE_COLOR = 0xffffff;
const PUPIL_COLOR = 0x3e2723;
const BEAK_COLOR = 0xffa726;

/** Rozměry sovičky jsou poměry k její velikosti, aby šla zvětšit jedním číslem. */
const UNIT = MASCOT_SIZE / 160;

/** Jak dlouho trvá radost ze správné odpovědi. */
const JOY_MS = 700;

/** Mrknutí přijde náhodně jednou za tuto dobu. */
const BLINK_MIN_MS = 2500;
const BLINK_MAX_MS = 5000;

/**
 * Sovička vlevo vedle příkladu. Jen se dívá a reaguje, na dotyk nereaguje.
 * Vnější kontejner skáče a tančí, vnitřní se pohupuje a kývá, aby se
 * pohyby nepraly.
 */
export class Mascot {
  private readonly outer: Phaser.GameObjects.Container;
  private readonly body: Phaser.GameObjects.Container;
  private readonly openEyes: Phaser.GameObjects.Container;
  private readonly happyEyes: Phaser.GameObjects.Graphics;
  private readonly leftWing: Phaser.GameObjects.Ellipse;
  private readonly rightWing: Phaser.GameObjects.Ellipse;
  private readonly home: Point;

  constructor(
    private readonly scene: Phaser.Scene,
    position: Point,
  ) {
    this.home = position;

    this.leftWing = scene.add.ellipse(-58 * UNIT, 22 * UNIT, 34 * UNIT, 80 * UNIT, WING_COLOR);
    this.rightWing = scene.add.ellipse(58 * UNIT, 22 * UNIT, 34 * UNIT, 80 * UNIT, WING_COLOR);
    this.openEyes = this.createOpenEyes();
    this.happyEyes = this.createHappyEyes();

    this.body = scene.add.container(0, 0, [
      this.leftWing,
      this.rightWing,
      ...this.createEars(),
      scene.add.ellipse(0, 10 * UNIT, 120 * UNIT, 140 * UNIT, BODY_COLOR),
      scene.add.ellipse(0, 34 * UNIT, 76 * UNIT, 78 * UNIT, BELLY_COLOR),
      ...this.createFeet(),
      this.openEyes,
      this.happyEyes,
      scene.add.triangle(0, 4 * UNIT, -9 * UNIT, 0, 9 * UNIT, 0, 0, 16 * UNIT, BEAK_COLOR),
    ]);
    this.outer = scene.add.container(position.x, position.y, [this.body]);

    this.showExpression('idle');
    this.startIdleBobbing();
    this.scheduleBlink();
  }

  /** Spustí animaci podle reakce z logiky hry. */
  react(reaction: MascotReaction, durationMs = 0): void {
    switch (reaction) {
      case 'idle':
        this.showExpression('idle');
        return;
      case 'joy':
        this.jumpForJoy();
        return;
      case 'encourage':
        this.nodEncouragingly();
        return;
      case 'dance':
        this.dance(durationMs);
        return;
    }
  }

  private createEars(): Phaser.GameObjects.Triangle[] {
    const ear = (side: number) =>
      this.scene.add.triangle(
        side * 26 * UNIT,
        -52 * UNIT,
        -14 * UNIT,
        14 * UNIT,
        14 * UNIT,
        14 * UNIT,
        side * 10 * UNIT,
        -20 * UNIT,
        BODY_COLOR,
      );
    return [ear(-1), ear(1)];
  }

  private createFeet(): Phaser.GameObjects.Ellipse[] {
    const foot = (side: number) =>
      this.scene.add.ellipse(side * 22 * UNIT, 78 * UNIT, 28 * UNIT, 12 * UNIT, BEAK_COLOR);
    return [foot(-1), foot(1)];
  }

  private createOpenEyes(): Phaser.GameObjects.Container {
    const eye = (side: number) => [
      this.scene.add.circle(side * 26 * UNIT, -22 * UNIT, 22 * UNIT, EYE_WHITE_COLOR),
      this.scene.add.circle(side * 24 * UNIT, -20 * UNIT, 10 * UNIT, PUPIL_COLOR),
    ];
    return this.scene.add.container(0, 0, [...eye(-1), ...eye(1)]);
  }

  /** Veselé oči jako obloučky „^ ^“. */
  private createHappyEyes(): Phaser.GameObjects.Graphics {
    const graphics = this.scene.add.graphics();
    graphics.lineStyle(6 * UNIT, PUPIL_COLOR, 1);
    for (const side of [-1, 1]) {
      graphics.beginPath();
      graphics.arc(side * 26 * UNIT, -14 * UNIT, 14 * UNIT, Math.PI * 1.15, Math.PI * 1.85);
      graphics.strokePath();
    }
    return graphics;
  }

  private showExpression(reaction: MascotReaction): void {
    const happy = mascotExpression(reaction) === 'happy';
    this.openEyes.setVisible(!happy);
    this.happyEyes.setVisible(happy);
  }

  private startIdleBobbing(): void {
    this.scene.tweens.add({
      targets: this.body,
      y: 4 * UNIT,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private scheduleBlink(): void {
    this.scene.time.delayedCall(Phaser.Math.Between(BLINK_MIN_MS, BLINK_MAX_MS), () => {
      this.scene.tweens.add({
        targets: this.openEyes,
        scaleY: 0.1,
        duration: 80,
        yoyo: true,
      });
      this.scheduleBlink();
    });
  }

  /** Zastaví předchozí reakci a vrátí sovičku na její místo. */
  private resetPose(): void {
    this.scene.tweens.killTweensOf([this.outer, this.leftWing, this.rightWing]);
    this.outer.setPosition(this.home.x, this.home.y).setAngle(0);
    this.leftWing.setAngle(0);
    this.rightWing.setAngle(0);
  }

  private flapWings(times: number): void {
    for (const [wing, direction] of [
      [this.leftWing, 1],
      [this.rightWing, -1],
    ] as const) {
      this.scene.tweens.add({
        targets: wing,
        angle: direction * 35,
        duration: 90,
        yoyo: true,
        repeat: times * 2 - 1,
      });
    }
  }

  private jumpForJoy(): void {
    this.resetPose();
    this.showExpression('joy');
    this.flapWings(2);
    this.scene.tweens.add({
      targets: this.outer,
      y: this.home.y - MASCOT_JUMP_HEIGHT,
      duration: 180,
      yoyo: true,
      ease: 'Quad.easeOut',
    });
    this.scene.time.delayedCall(JOY_MS, () => this.showExpression('idle'));
  }

  private nodEncouragingly(): void {
    this.resetPose();
    this.showExpression('encourage');
    this.scene.tweens.add({
      targets: this.outer,
      y: this.home.y + 8 * UNIT,
      duration: 140,
      yoyo: true,
      repeat: 1,
      ease: 'Sine.easeInOut',
    });
  }

  private dance(durationMs: number): void {
    this.resetPose();
    this.showExpression('dance');
    const stepMs = 220;
    const steps = Math.max(1, Math.floor(durationMs / (stepMs * 2)));

    this.flapWings(steps);
    this.scene.tweens.add({
      targets: this.outer,
      x: { from: this.home.x - MASCOT_DANCE_SWAY, to: this.home.x + MASCOT_DANCE_SWAY },
      angle: { from: -8, to: 8 },
      duration: stepMs,
      yoyo: true,
      repeat: steps - 1,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        this.resetPose();
        this.showExpression('idle');
      },
    });
  }
}
