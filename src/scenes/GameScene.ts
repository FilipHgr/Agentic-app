import Phaser from 'phaser';

import { createBrowserAudioContext, createTonePlayer } from '../audio/tonePlayer';
import { formatProblem } from '../logic/addition';
import { ANSWER_CHOICE_COUNT, createAnswerRound, tapAnswer } from '../logic/answerRound';
import type { AnswerRound, TapOutcome } from '../logic/answerRound';
import { SOUNDS, soundForOutcome } from '../logic/answerSounds';
import { layoutScreen } from '../logic/screenLayout';
import type { ButtonSlot } from '../logic/screenLayout';

const BUTTON_COLOR = 0xffffff;
const BUTTON_CORRECT_COLOR = 0x8be04e;
const BUTTON_REJECTED_COLOR = 0x9e9e9e;
const BUTTON_TEXT_COLOR = '#1f6f43';
const BUTTON_CORNER_RADIUS = 28;

/** Jak dlouho se po správné odpovědi čeká na nový příklad. */
const NEXT_PROBLEM_DELAY_MS = 800;

interface AnswerButton {
  readonly value: number;
  readonly container: Phaser.GameObjects.Container;
  readonly background: Phaser.GameObjects.Graphics;
  readonly size: number;
}

/** Scéna jen kreslí kolo a animuje; o správnosti rozhoduje logika v src/logic. */
export class GameScene extends Phaser.Scene {
  private round: AnswerRound | undefined;
  private roundObjects: Phaser.GameObjects.GameObject[] = [];
  private readonly sounds = createTonePlayer(createBrowserAudioContext);

  constructor() {
    super('game');
  }

  create(): void {
    this.startRound();
  }

  private startRound(): void {
    this.clearRound();
    this.round = createAnswerRound();

    const layout = layoutScreen(this.scale.width, this.scale.height, ANSWER_CHOICE_COUNT);

    const problemText = this.add
      .text(layout.problem.x, layout.problem.y, formatProblem(this.round.problem), {
        fontFamily: 'Arial, sans-serif',
        fontSize: '160px',
        color: '#ffffff',
      })
      .setOrigin(0.5);
    this.roundObjects.push(problemText);

    this.round.choices.forEach((value, index) => {
      const slot = layout.answerButtons[index];
      if (slot) {
        this.roundObjects.push(this.createAnswerButton(value, slot).container);
      }
    });
  }

  private clearRound(): void {
    for (const object of this.roundObjects) {
      this.tweens.killTweensOf(object);
      object.destroy();
    }
    this.roundObjects = [];
  }

  private createAnswerButton(value: number, slot: ButtonSlot): AnswerButton {
    const background = this.add.graphics();
    const label = this.add
      .text(0, 0, String(value), {
        fontFamily: 'Arial, sans-serif',
        fontSize: '110px',
        color: BUTTON_TEXT_COLOR,
      })
      .setOrigin(0.5);

    const container = this.add.container(slot.x, slot.y, [background, label]);
    const button: AnswerButton = { value, container, background, size: slot.size };

    this.paintButton(button, BUTTON_COLOR);
    container.setSize(slot.size, slot.size).setInteractive();
    container.on('pointerdown', () => this.onAnswerTapped(button));

    return button;
  }

  private paintButton(button: AnswerButton, color: number): void {
    const half = button.size / 2;

    button.background
      .clear()
      .fillStyle(color, 1)
      .fillRoundedRect(-half, -half, button.size, button.size, BUTTON_CORNER_RADIUS);
  }

  private onAnswerTapped(button: AnswerButton): void {
    if (!this.round) {
      return;
    }

    const result = tapAnswer(this.round, button.value);
    this.round = result.round;
    this.playSoundFor(result.outcome);

    if (result.outcome === 'correct') {
      this.celebrateCorrectAnswer(button);
    } else if (result.outcome === 'wrong') {
      this.showWrongAnswer(button);
    }
  }

  private playSoundFor(outcome: TapOutcome): void {
    const sound = soundForOutcome(outcome);
    if (sound) {
      this.sounds.play(SOUNDS[sound]);
    }
  }

  private celebrateCorrectAnswer(button: AnswerButton): void {
    this.paintButton(button, BUTTON_CORRECT_COLOR);
    this.tweens.add({
      targets: button.container,
      scale: 1.2,
      duration: 150,
      yoyo: true,
      ease: 'Quad.easeOut',
    });
    this.time.delayedCall(NEXT_PROBLEM_DELAY_MS, () => this.startRound());
  }

  private showWrongAnswer(button: AnswerButton): void {
    const startX = button.container.x;

    button.container.disableInteractive();
    this.tweens.add({
      targets: button.container,
      x: startX + 14,
      duration: 50,
      yoyo: true,
      repeat: 3,
      onComplete: () => {
        button.container.x = startX;
        this.paintButton(button, BUTTON_REJECTED_COLOR);
        button.container.setAlpha(0.6);
      },
    });
  }
}
