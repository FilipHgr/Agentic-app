import Phaser from 'phaser';

import { createBrowserAudioContext, createTonePlayer } from '../audio/tonePlayer';
import { formatProblem } from '../logic/addition';
import {
  ANSWER_CHOICES,
  createAnswerRound,
  hintDotGroups,
  isHintVisible,
  tapAnswer,
} from '../logic/answerRound';
import type { AnswerRound, TapOutcome } from '../logic/answerRound';
import { SOUNDS, soundForOutcome } from '../logic/answerSounds';
import {
  HINT_DOT_SIZE,
  PROBLEM_FONT_SIZE,
  STAR_SIZE,
  layoutHintDots,
  layoutScreen,
} from '../logic/screenLayout';
import type { ButtonSlot, ScreenLayout } from '../logic/screenLayout';
import { STARS_PER_SET, createStarProgress, startNewStarSet, starsAfterTap } from '../logic/stars';
import type { StarProgress } from '../logic/stars';

const BUTTON_COLOR = 0xffffff;
const BUTTON_CORRECT_COLOR = 0x8be04e;
/** Každé sčítané číslo má tečky jiné barvy, aby šly skupinky rozlišit. */
const HINT_GROUP_COLORS = [0xffd54f, 0x81d4fa];

/** Tečky naskakují jedna po druhé, aby je dítě mohlo počítat s nimi. */
const HINT_DOT_DELAY_MS = 120;
const BUTTON_TEXT_COLOR = '#1f6f43';
const BUTTON_CORNER_RADIUS = 24;

/** Jak dlouho se po správné odpovědi čeká na nový příklad. */
const NEXT_PROBLEM_DELAY_MS = 800;

const STAR_EMPTY_COLOR = 0x175a36;
const STAR_FILLED_COLOR = 0xffd54f;
const STAR_OUTLINE_COLOR = 0xffffff;

/** Jak dlouho letí hvězdička od tlačítka do řady nahoře. */
const STAR_FLIGHT_MS = 450;

/** Jak dlouho trvá oslava po zaplnění řady, než přijde nový příklad. */
const CELEBRATION_MS = 2600;

const CONFETTI_COUNT = 80;
const CONFETTI_COLORS = [0xffd54f, 0x81d4fa, 0xff8a80, 0xb9f6ca, 0xffffff, 0xce93d8];

interface AnswerButton {
  readonly value: number;
  readonly container: Phaser.GameObjects.Container;
  readonly background: Phaser.GameObjects.Graphics;
  readonly size: number;
  /** Vodorovná poloha, kam se tlačítko vrací po zatřesení. */
  readonly homeX: number;
}

/** Scéna jen kreslí kolo a animuje; o správnosti rozhoduje logika v src/logic. */
export class GameScene extends Phaser.Scene {
  private round: AnswerRound | undefined;
  private roundObjects: Phaser.GameObjects.GameObject[] = [];
  private hintIsShown = false;
  private starProgress: StarProgress = createStarProgress();
  private starIcons: Phaser.GameObjects.Star[] = [];
  private readonly sounds = createTonePlayer(createBrowserAudioContext);

  constructor() {
    super('game');
  }

  create(): void {
    this.createStarRow();
    this.startRound();
  }

  private createStarRow(): void {
    this.starIcons = this.layout().stars.map((slot) =>
      this.createStarShape(slot.x, slot.y, STAR_EMPTY_COLOR).setStrokeStyle(
        3,
        STAR_OUTLINE_COLOR,
        0.7,
      ),
    );
  }

  private createStarShape(x: number, y: number, color: number): Phaser.GameObjects.Star {
    return this.add.star(x, y, 5, STAR_SIZE * 0.25, STAR_SIZE / 2, color);
  }

  /** Rozsvítí tolik hvězdiček zleva, kolik jich hráč v řadě získal. */
  private paintStars(): void {
    this.starIcons.forEach((icon, index) => {
      const filled = index < this.starProgress.earned;
      icon.setFillStyle(filled ? STAR_FILLED_COLOR : STAR_EMPTY_COLOR);
    });
  }

  private startRound(): void {
    this.clearRound();
    this.round = createAnswerRound();
    this.hintIsShown = false;

    const layout = this.layout();

    const problemText = this.add
      .text(layout.problem.x, layout.problem.y, formatProblem(this.round.problem), {
        fontFamily: 'Arial, sans-serif',
        fontSize: `${PROBLEM_FONT_SIZE}px`,
        color: '#ffffff',
      })
      .setOrigin(0.5);
    this.roundObjects.push(problemText);

    ANSWER_CHOICES.forEach((value, index) => {
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
        fontSize: '90px',
        color: BUTTON_TEXT_COLOR,
      })
      .setOrigin(0.5);

    const container = this.add.container(slot.x, slot.y, [background, label]);
    const button: AnswerButton = {
      value,
      container,
      background,
      size: slot.size,
      homeX: slot.x,
    };

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

    const stars = starsAfterTap(this.starProgress, result.outcome);
    this.starProgress = stars.progress;

    if (result.outcome === 'correct') {
      this.celebrateCorrectAnswer(button, stars.setCompleted);
    } else if (result.outcome === 'wrong') {
      this.showWrongAnswer(button);
      this.showHintWhenNeeded();
    }
  }

  private layout(): ScreenLayout {
    return layoutScreen(this.scale.width, this.scale.height, ANSWER_CHOICES.length, STARS_PER_SET);
  }

  private showHintWhenNeeded(): void {
    if (!this.round || this.hintIsShown || !isHintVisible(this.round)) {
      return;
    }
    this.hintIsShown = true;

    const groups = hintDotGroups(this.round.problem);
    layoutHintDots(groups, this.layout().hint).forEach((dot, index) => {
      const color = HINT_GROUP_COLORS[dot.group % HINT_GROUP_COLORS.length];
      const circle = this.add.circle(dot.x, dot.y, HINT_DOT_SIZE / 2, color);
      circle.setScale(0);
      this.tweens.add({
        targets: circle,
        scale: 1,
        duration: 200,
        delay: index * HINT_DOT_DELAY_MS,
        ease: 'Back.easeOut',
      });
      this.roundObjects.push(circle);
    });
  }

  private playSoundFor(outcome: TapOutcome): void {
    const sound = soundForOutcome(outcome);
    if (sound) {
      this.sounds.play(SOUNDS[sound]);
    }
  }

  private celebrateCorrectAnswer(button: AnswerButton, setCompleted: boolean): void {
    this.paintButton(button, BUTTON_CORRECT_COLOR);
    this.tweens.add({
      targets: button.container,
      scale: 1.2,
      duration: 150,
      yoyo: true,
      ease: 'Quad.easeOut',
    });
    this.flyStarToRow(button, () => {
      if (setCompleted) {
        this.celebrateFullSet();
      }
    });

    if (!setCompleted) {
      this.time.delayedCall(NEXT_PROBLEM_DELAY_MS, () => this.startRound());
    }
  }

  /** Hvězdička přiletí od tlačítka na své místo v řadě a rozsvítí ho. */
  private flyStarToRow(button: AnswerButton, onArrived: () => void): void {
    const targetIcon = this.starIcons[this.starProgress.earned - 1];
    if (!targetIcon) {
      onArrived();
      return;
    }

    const flyingStar = this.createStarShape(
      button.container.x,
      button.container.y,
      STAR_FILLED_COLOR,
    ).setScale(1.6);

    this.tweens.add({
      targets: flyingStar,
      x: targetIcon.x,
      y: targetIcon.y,
      scale: 1,
      duration: STAR_FLIGHT_MS,
      ease: 'Cubic.easeInOut',
      onComplete: () => {
        flyingStar.destroy();
        this.paintStars();
        this.tweens.add({
          targets: targetIcon,
          scale: 1.4,
          duration: 120,
          yoyo: true,
          repeat: 1,
        });
        onArrived();
      },
    });
  }

  /** Oslava po zaplnění řady: konfety a melodie, pak nová prázdná řada. */
  private celebrateFullSet(): void {
    this.sounds.play(SOUNDS.celebration);
    this.throwConfetti();

    this.time.delayedCall(CELEBRATION_MS, () => {
      this.starProgress = startNewStarSet();
      this.paintStars();
      this.startRound();
    });
  }

  private throwConfetti(): void {
    const { width, height } = this.scale;

    for (let index = 0; index < CONFETTI_COUNT; index += 1) {
      const color = CONFETTI_COLORS[index % CONFETTI_COLORS.length];
      const piece = this.add
        .rectangle(Phaser.Math.Between(0, width), -20, 14, 22, color)
        .setAngle(Phaser.Math.Between(0, 360))
        .setDepth(10);

      this.tweens.add({
        targets: piece,
        y: height + 30,
        x: piece.x + Phaser.Math.Between(-120, 120),
        angle: piece.angle + Phaser.Math.Between(180, 720),
        duration: Phaser.Math.Between(1500, 2400),
        delay: Phaser.Math.Between(0, 500),
        ease: 'Sine.easeIn',
        onComplete: () => piece.destroy(),
      });
    }
  }

  private showWrongAnswer(button: AnswerButton): void {
    // Opakované ťuknutí během třesení začne třesení znovu z výchozího místa.
    this.tweens.killTweensOf(button.container);
    button.container.x = button.homeX;

    this.tweens.add({
      targets: button.container,
      x: button.homeX + 14,
      duration: 50,
      yoyo: true,
      repeat: 3,
      onComplete: () => {
        button.container.x = button.homeX;
      },
    });
  }
}
