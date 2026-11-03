import Phaser from 'phaser';

import { HOLD_TO_OPEN_SETTINGS_MS, isHoldLongEnough } from '../logic/settings';
import type { ButtonSlot } from '../logic/screenLayout';

const GEAR_COLOR = 0xffffff;
const GEAR_HOLE_COLOR = 0x1f6f43;
const PROGRESS_COLOR = 0xffd54f;
const GEAR_TEETH = 8;

/**
 * Ozubené kolečko nastavení. Otevře nastavení až po podržení
 * (`HOLD_TO_OPEN_SETTINGS_MS`), aby se tam dítě nedostalo omylem;
 * během držení se kolem kolečka plní žlutý kruh.
 */
export class SettingsButton {
  private readonly container: Phaser.GameObjects.Container;
  private readonly progress: Phaser.GameObjects.Graphics;
  private holdTween: Phaser.Tweens.Tween | undefined;
  private holdStartedAt = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly slot: ButtonSlot,
    private readonly onOpen: () => void,
  ) {
    this.progress = scene.add.graphics();
    this.container = scene.add
      .container(slot.x, slot.y, [this.drawGear(), this.progress])
      .setSize(slot.size, slot.size)
      .setInteractive();

    this.container.on('pointerdown', () => this.startHold());
    this.container.on('pointerup', () => this.cancelHold());
    this.container.on('pointerout', () => this.cancelHold());
  }

  private drawGear(): Phaser.GameObjects.Graphics {
    const outer = this.slot.size * 0.36;
    const inner = this.slot.size * 0.27;
    const points: Phaser.Math.Vector2[] = [];

    for (let step = 0; step < GEAR_TEETH * 4; step += 1) {
      const angle = (step / (GEAR_TEETH * 4)) * Math.PI * 2;
      const radius = step % 4 < 2 ? outer : inner;
      points.push(new Phaser.Math.Vector2(Math.cos(angle) * radius, Math.sin(angle) * radius));
    }

    return this.scene.add
      .graphics()
      .fillStyle(GEAR_COLOR, 0.85)
      .fillPoints(points, true)
      .fillStyle(GEAR_HOLE_COLOR, 1)
      .fillCircle(0, 0, this.slot.size * 0.12);
  }

  private startHold(): void {
    this.cancelHold();
    this.holdStartedAt = this.scene.time.now;
    const state = { done: 0 };

    this.holdTween = this.scene.tweens.add({
      targets: state,
      done: 1,
      duration: HOLD_TO_OPEN_SETTINGS_MS,
      onUpdate: () => this.drawProgress(state.done),
      onComplete: () => {
        const heldMs = this.scene.time.now - this.holdStartedAt;
        this.clearProgress();
        if (isHoldLongEnough(heldMs)) {
          this.onOpen();
        }
      },
    });
  }

  private cancelHold(): void {
    this.holdTween?.stop();
    this.holdTween = undefined;
    this.clearProgress();
  }

  private drawProgress(done: number): void {
    const start = -Math.PI / 2;
    this.progress
      .clear()
      .lineStyle(8, PROGRESS_COLOR, 1)
      .beginPath()
      .arc(0, 0, this.slot.size * 0.46, start, start + done * Math.PI * 2)
      .strokePath();
  }

  private clearProgress(): void {
    this.progress.clear();
  }
}
