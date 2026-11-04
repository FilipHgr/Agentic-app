import Phaser from 'phaser';

import {
  ANSWER_INPUT_OPTIONS,
  MAX_NUMBER_OPTIONS,
  OPERATION_OPTIONS,
  answerInputOf,
} from '../logic/settings';
import type { AnswerInput, GameSettings, MaxNumber, OperationMode } from '../logic/settings';

const BACKDROP_COLOR = 0x0f3d24;
const OPTION_COLOR = 0xffffff;
const OPTION_SELECTED_COLOR = 0xffd54f;
const OPTION_TEXT_COLOR = '#1f6f43';
const CONFIRM_COLOR = 0x8be04e;

const OPTION_WIDTH = 220;
const OPTION_HEIGHT = 130;
const OPTION_GAP = 40;
const OPTION_RADIUS = 28;
const CONFIRM_SIZE = 150;

/** Panel je nad vším ostatním, aby ťuknutí nepropadla do hry pod ním. */
const PANEL_DEPTH = 100;

/** Popisky voleb: jen čísla a znaménka, žádný text ke čtení. */
const MAX_NUMBER_LABELS: Record<MaxNumber, string> = { 5: '5', 10: '10', 20: '20' };
const OPERATION_LABELS: Record<OperationMode, string> = {
  plus: '+',
  minus: '−',
  mixed: '+ −',
};
/** Číselník jako „123“, psaní jako tužka. */
const ANSWER_INPUT_LABELS: Record<AnswerInput, string> = { keypad: '123', writing: '✎' };

/** Svislé polohy řad voleb a potvrzení jako část výšky obrazovky. */
const ROW_Y = [0.16, 0.38, 0.6] as const;
const CONFIRM_Y = 0.86;

interface OptionButton {
  readonly background: Phaser.GameObjects.Graphics;
  readonly isSelected: () => boolean;
}

/**
 * Obrazovka nastavení pro rodiče: řada rozsahů (5, 10, 20), řada druhů
 * příkladů (+, −, + −), způsob odpovědi (číselník, psaní) a potvrzovací „✓“. Vybrané volby jsou žluté.
 */
export class SettingsPanel {
  private readonly container: Phaser.GameObjects.Container;
  private readonly options: OptionButton[] = [];
  private choice: GameSettings;

  constructor(
    private readonly scene: Phaser.Scene,
    current: GameSettings,
    private readonly onConfirm: (settings: GameSettings) => void,
  ) {
    this.choice = current;
    const { width, height } = scene.scale;

    // Pozadí zachytí všechna ťuknutí, takže hra pod panelem nic nedostane.
    const backdrop = scene.add
      .rectangle(width / 2, height / 2, width, height, BACKDROP_COLOR, 0.94)
      .setInteractive();
    this.container = scene.add.container(0, 0, [backdrop]).setDepth(PANEL_DEPTH);

    this.addOptionRow(
      height * ROW_Y[0],
      MAX_NUMBER_OPTIONS.map((maxNumber) => ({
        label: MAX_NUMBER_LABELS[maxNumber],
        isSelected: () => this.choice.maxNumber === maxNumber,
        select: () => (this.choice = { ...this.choice, maxNumber }),
      })),
    );
    this.addOptionRow(
      height * ROW_Y[1],
      OPERATION_OPTIONS.map((operations) => ({
        label: OPERATION_LABELS[operations],
        isSelected: () => this.choice.operations === operations,
        select: () => (this.choice = { ...this.choice, operations }),
      })),
    );
    this.addOptionRow(
      height * ROW_Y[2],
      ANSWER_INPUT_OPTIONS.map((answerInput) => ({
        label: ANSWER_INPUT_LABELS[answerInput],
        isSelected: () => answerInputOf(this.choice) === answerInput,
        select: () => (this.choice = { ...this.choice, answerInput }),
      })),
    );
    this.addConfirmButton(width / 2, height * CONFIRM_Y);
    this.repaint();

    this.container.setAlpha(0);
    scene.tweens.add({ targets: this.container, alpha: 1, duration: 150 });
  }

  /** Řada voleb vycentrovaná na obrazovce. */
  private addOptionRow(
    y: number,
    items: { label: string; isSelected: () => boolean; select: () => void }[],
  ): void {
    const rowWidth = items.length * OPTION_WIDTH + (items.length - 1) * OPTION_GAP;
    const firstX = this.scene.scale.width / 2 - rowWidth / 2 + OPTION_WIDTH / 2;

    items.forEach((item, index) => {
      const x = firstX + index * (OPTION_WIDTH + OPTION_GAP);
      const background = this.scene.add.graphics();
      const label = this.scene.add
        .text(0, 0, item.label, {
          fontFamily: 'Arial, sans-serif',
          fontSize: '84px',
          color: OPTION_TEXT_COLOR,
        })
        .setOrigin(0.5);
      const button = this.scene.add
        .container(x, y, [background, label])
        .setSize(OPTION_WIDTH, OPTION_HEIGHT)
        .setInteractive();

      button.on('pointerdown', () => {
        item.select();
        this.repaint();
        this.scene.tweens.add({ targets: button, scale: 1.08, duration: 90, yoyo: true });
      });

      this.options.push({ background, isSelected: item.isSelected });
      this.container.add(button);
    });
  }

  private addConfirmButton(x: number, y: number): void {
    const background = this.scene.add.graphics();
    background
      .fillStyle(CONFIRM_COLOR, 1)
      .fillRoundedRect(-CONFIRM_SIZE / 2, -CONFIRM_SIZE / 2, CONFIRM_SIZE, CONFIRM_SIZE, 40);
    const tick = this.scene.add.graphics();
    tick
      .lineStyle(18, 0xffffff, 1)
      .beginPath()
      .moveTo(-38, 2)
      .lineTo(-10, 30)
      .lineTo(40, -26)
      .strokePath();

    const button = this.scene.add
      .container(x, y, [background, tick])
      .setSize(CONFIRM_SIZE, CONFIRM_SIZE)
      .setInteractive();
    button.on('pointerdown', () => this.confirm());
    this.container.add(button);
  }

  /** Vybrané volby žlutě, ostatní bíle. */
  private repaint(): void {
    for (const option of this.options) {
      const color = option.isSelected() ? OPTION_SELECTED_COLOR : OPTION_COLOR;
      option.background
        .clear()
        .fillStyle(color, 1)
        .fillRoundedRect(
          -OPTION_WIDTH / 2,
          -OPTION_HEIGHT / 2,
          OPTION_WIDTH,
          OPTION_HEIGHT,
          OPTION_RADIUS,
        );
    }
  }

  private confirm(): void {
    this.container.destroy();
    this.onConfirm(this.choice);
  }
}
