import Phaser from 'phaser';

import { createBrowserAudioContext, createTonePlayer } from '../audio/tonePlayer';
import {
  answerChoices,
  createAnswerRound,
  problemText,
  hintCrossedOutDots,
  hintDotGroups,
  isHintVisible,
  tapAnswer,
} from '../logic/answerRound';
import type { AnswerRound, TapOutcome } from '../logic/answerRound';
import { SOUNDS, soundForOutcome } from '../logic/answerSounds';
import { mascotReactionToTap } from '../logic/mascot';
import {
  STAR_SIZE,
  layoutHintDots,
  layoutScreen,
  layoutWritingScreen,
} from '../logic/screenLayout';
import type { ButtonSlot, ScreenLayout } from '../logic/screenLayout';
import { STARS_PER_SET, startNewStarSet, starsAfterTap } from '../logic/stars';
import type { StarProgress } from '../logic/stars';
import { nextCharacter } from '../logic/characters';
import type { CharacterId } from '../logic/characters';
import { isWritingActive } from '../logic/settings';
import type { GameSettings } from '../logic/settings';
import type { TwoBoxConfirmResult } from '../logic/twoBoxWriting';
import { loadProgress, saveProgress } from '../storage/progressStorage';
import { browserStorage, loadSettings, saveSettings } from '../storage/settingsStorage';
import { Mascot } from './Mascot';
import { attachSettingsButton } from '../ui/settingsButton';
import { SettingsPanel } from './SettingsPanel';
import { WritingPad } from './WritingPad';

const BUTTON_COLOR = 0xffffff;
const BUTTON_CORRECT_COLOR = 0x8be04e;
/** Každé sčítané číslo má tečky jiné barvy, aby šly skupinky rozlišit. */
const HINT_GROUP_COLORS = [0xffd54f, 0x81d4fa];

/** Odečítané tečky u odčítání jsou šedé a přeškrtnuté. */
const HINT_CROSSED_OUT_COLOR = 0x9e9e9e;
const HINT_CROSS_COLOR = 0xffffff;

/** Číslo na tlačítku zabírá asi dvě třetiny jeho výšky. */
const BUTTON_LABEL_RATIO = 0.64;

/** Tečky naskakují jedna po druhé, aby je dítě mohlo počítat s nimi. */
const HINT_DOT_DELAY_MS = 120;
const BUTTON_TEXT_COLOR = '#1f6f43';
const BUTTON_CORNER_RADIUS = 24;

/** Výsledek v příkladu po správné odpovědi: zelený jako správné tlačítko. */
const ANSWER_REVEALED_COLOR = '#8be04e';
const PROBLEM_TEXT_COLOR = '#ffffff';

/** Rozpoznaná, ještě nepotvrzená číslice v příkladu: žlutá jako vybraná volba. */
const ANSWER_WRITTEN_COLOR = '#ffd54f';

/** Mezera mezi rovnítkem a odpovědí jako část velikosti písma (šířka mezery v Arialu). */
const ANSWER_GAP_RATIO = 0.28;

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

/** Místo, odkud vyletí hvězdička za správnou odpověď. */
interface Origin {
  readonly x: number;
  readonly y: number;
}

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
  private problemEquation: Phaser.GameObjects.Text | undefined;
  private problemAnswer: Phaser.GameObjects.Text | undefined;
  private hintIsShown = false;
  /** Plocha na psaní, když dítě odpovídá psaním (#41); jinak číselník. */
  private writingPad: WritingPad | undefined;
  // Hvězdičky a postavička přežijí zavření hry (načtou se ze zařízení).
  private readonly savedProgress = loadProgress(browserStorage());
  private starProgress: StarProgress = { earned: this.savedProgress.earned };
  private starIcons: Phaser.GameObjects.Star[] = [];
  private mascot: Mascot | undefined;
  private character: CharacterId = this.savedProgress.character;
  private settings: GameSettings = loadSettings(browserStorage());
  private settingsOpen = false;
  private readonly sounds = createTonePlayer(createBrowserAudioContext);

  constructor() {
    super('game');
  }

  preload(): void {
    // Když se obrázek nenačte, hra běží dál bez postavičky (viz Mascot.showMood).
    Mascot.preload(this);
  }

  create(): void {
    this.createStarRow();
    this.paintStars();
    this.mascot = new Mascot(this, this.layout().mascot, this.character);
    // Kolečko je tlačítko stránky v rohu obrazovky, mimo herní plochu.
    const settingsButton = document.getElementById('settings-button');
    if (settingsButton) {
      attachSettingsButton(settingsButton, () => this.openSettings());
    }
    this.startRound();
  }

  override update(time: number): void {
    this.writingPad?.update(time);
  }

  /** Uloží hvězdičky a postavičku do zařízení; když to nejde, hra jede dál. */
  private saveProgress(): void {
    saveProgress(browserStorage(), {
      earned: this.starProgress.earned,
      character: this.character,
    });
  }

  /** Nastavení pro rodiče; po potvrzení se uloží a přijde nový příklad. */
  private openSettings(): void {
    if (this.settingsOpen) {
      return;
    }
    this.settingsOpen = true;

    new SettingsPanel(this, this.settings, (chosen) => {
      this.settings = chosen;
      saveSettings(browserStorage(), chosen);
      this.settingsOpen = false;
      this.startRound();
    });
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
    // Nový příklad nesmí být stejný jako ten z minulého kola (při startu žádný není).
    this.round = createAnswerRound(this.settings, Math.random, this.round?.problem);
    this.hintIsShown = false;

    const layout = this.layout();

    this.drawProblem(layout);

    if (isWritingActive(this.settings)) {
      this.createWritingPad(this.round);
      return;
    }

    answerChoices(this.round.maxNumber).forEach((value, index) => {
      const slot = layout.answerButtons[index];
      if (slot) {
        this.roundObjects.push(this.createAnswerButton(value, slot).container);
      }
    });
  }

  /** Místo číselníku okénka na psaní: při rozsahu 5 jedno, při 10 a 20 dvě (#42). */
  private createWritingPad(round: AnswerRound): void {
    const layout = layoutWritingScreen(
      this.scale.width,
      this.scale.height,
      this.settings.maxNumber,
      STARS_PER_SET,
    );
    this.writingPad = new WritingPad(this, layout, round, {
      onNumberChanged: (number) => this.showWrittenNumber(number),
      onConfirmed: (result) => this.onWritingConfirmed(result),
    });
  }

  /** Rozpoznané číslo se ukáže žlutě místo „?“, dokud ho dítě nepotvrdí. */
  private showWrittenNumber(number: number | null): void {
    if (!this.round || this.round.solved || !this.problemAnswer) {
      return;
    }
    if (number === null) {
      this.problemAnswer.setText(problemText(this.round).answer).setColor(PROBLEM_TEXT_COLOR);
    } else {
      this.problemAnswer.setText(String(number)).setColor(ANSWER_WRITTEN_COLOR);
    }
    this.centerProblem(this.layout());
  }

  private onWritingConfirmed(result: TwoBoxConfirmResult): void {
    const pad = this.writingPad;
    if (!pad) {
      return;
    }
    this.round = result.round.answer;
    this.applyOutcome(result.outcome, pad.confirmPosition, {
      onCorrect: () => pad.lock(),
      onWrong: () => this.showWrittenNumber(null),
    });
  }

  /** Příklad ze dvou částí: bílá levá strana „3 + 4 =“ a odpověď „?“, později výsledek. */
  private drawProblem(layout: ScreenLayout): void {
    if (!this.round) {
      return;
    }
    const text = problemText(this.round);
    const style = {
      fontFamily: 'Arial, sans-serif',
      fontSize: `${layout.problemFontSize}px`,
      color: PROBLEM_TEXT_COLOR,
    };

    this.problemEquation = this.add
      .text(0, layout.problem.y, text.equation, style)
      .setOrigin(0, 0.5);
    this.problemAnswer = this.add.text(0, layout.problem.y, text.answer, style).setOrigin(0.5);
    this.roundObjects.push(this.problemEquation, this.problemAnswer);
    this.centerProblem(layout);
  }

  /** Vycentruje celý příklad; odpověď může po vyřešení změnit šířku. */
  private centerProblem(layout: ScreenLayout): void {
    if (!this.problemEquation || !this.problemAnswer) {
      return;
    }
    const gap = layout.problemFontSize * ANSWER_GAP_RATIO;
    const totalWidth = this.problemEquation.width + gap + this.problemAnswer.width;
    const left = layout.problem.x - totalWidth / 2;

    this.problemEquation.x = left;
    this.problemAnswer.x = left + this.problemEquation.width + gap + this.problemAnswer.width / 2;
  }

  /** Po správné odpovědi se místo „?“ ukáže zelený výsledek a jednou poskočí. */
  private revealAnswer(): void {
    if (!this.round || !this.problemAnswer) {
      return;
    }
    const text = problemText(this.round);
    this.problemAnswer.setText(text.answer).setColor(ANSWER_REVEALED_COLOR);
    this.centerProblem(this.layout());
    this.tweens.add({
      targets: this.problemAnswer,
      scale: 1.25,
      duration: 150,
      yoyo: true,
      ease: 'Quad.easeOut',
    });
  }

  private clearRound(): void {
    this.writingPad?.destroy();
    this.writingPad = undefined;
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
        fontSize: `${Math.round(slot.size * BUTTON_LABEL_RATIO)}px`,
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
    this.applyOutcome(result.outcome, button.container, {
      onCorrect: () => this.highlightCorrectButton(button),
      onWrong: () => this.showWrongAnswer(button),
    });
  }

  /**
   * Společné vyhodnocení pro číselník i psaní: zvuk, hvězdička, postavička,
   * výsledek v příkladu a nápověda po 2. chybě.
   */
  private applyOutcome(
    outcome: TapOutcome,
    origin: Origin,
    visuals: { onCorrect: () => void; onWrong: () => void },
  ): void {
    this.playSoundFor(outcome);

    const stars = starsAfterTap(this.starProgress, outcome);
    this.starProgress = stars.progress;
    if (stars.starEarned) {
      this.saveProgress();
    }

    // Tanec začne až s oslavou, po doletu poslední hvězdičky.
    const reaction = mascotReactionToTap(outcome, stars.setCompleted);
    if (reaction && reaction !== 'dance') {
      this.mascot?.react(reaction);
    }

    if (outcome === 'correct') {
      visuals.onCorrect();
      this.celebrateCorrectAnswer(origin, stars.setCompleted);
    } else if (outcome === 'wrong') {
      visuals.onWrong();
      this.showHintWhenNeeded();
    }
  }

  private layout(): ScreenLayout {
    const maxNumber = this.round?.maxNumber ?? this.settings.maxNumber;
    return layoutScreen(
      this.scale.width,
      this.scale.height,
      answerChoices(maxNumber).length,
      STARS_PER_SET,
    );
  }

  private showHintWhenNeeded(): void {
    if (!this.round || this.hintIsShown || !isHintVisible(this.round)) {
      return;
    }
    this.hintIsShown = true;

    const layout = this.layout();
    const style = layout.hintStyle;
    const dots = layoutHintDots(hintDotGroups(this.round.problem), layout.hint, style);
    const firstCrossedOut = dots.length - hintCrossedOutDots(this.round.problem);

    dots.forEach((dot, index) => {
      const crossedOut = index >= firstCrossedOut;
      const color = crossedOut
        ? HINT_CROSSED_OUT_COLOR
        : HINT_GROUP_COLORS[dot.group % HINT_GROUP_COLORS.length];
      const parts: Phaser.GameObjects.Shape[] = [
        this.add.circle(dot.x, dot.y, style.dotSize / 2, color),
      ];
      if (crossedOut) {
        parts.push(
          this.add
            .rectangle(dot.x, dot.y, style.dotSize * 1.25, style.dotSize * 0.14, HINT_CROSS_COLOR)
            .setAngle(-45),
        );
      }

      for (const part of parts) {
        part.setScale(0);
        this.roundObjects.push(part);
      }
      this.tweens.add({
        targets: parts,
        scale: 1,
        duration: 200,
        delay: index * HINT_DOT_DELAY_MS,
        ease: 'Back.easeOut',
      });
    });
  }

  private playSoundFor(outcome: TapOutcome): void {
    const sound = soundForOutcome(outcome);
    if (sound) {
      this.sounds.play(SOUNDS[sound]);
    }
  }

  /** Správné tlačítko zezelená a poskočí. */
  private highlightCorrectButton(button: AnswerButton): void {
    this.paintButton(button, BUTTON_CORRECT_COLOR);
    this.tweens.add({
      targets: button.container,
      scale: 1.2,
      duration: 150,
      yoyo: true,
      ease: 'Quad.easeOut',
    });
  }

  private celebrateCorrectAnswer(origin: Origin, setCompleted: boolean): void {
    this.revealAnswer();
    this.flyStarToRow(origin, () => {
      if (setCompleted) {
        this.celebrateFullSet();
      }
    });

    if (!setCompleted) {
      this.time.delayedCall(NEXT_PROBLEM_DELAY_MS, () => this.startRound());
    }
  }

  /** Hvězdička přiletí od tlačítka na své místo v řadě a rozsvítí ho. */
  private flyStarToRow(origin: Origin, onArrived: () => void): void {
    const targetIcon = this.starIcons[this.starProgress.earned - 1];
    if (!targetIcon) {
      onArrived();
      return;
    }

    const flyingStar = this.createStarShape(origin.x, origin.y, STAR_FILLED_COLOR).setScale(1.6);

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
    this.mascot?.react('dance', CELEBRATION_MS);

    this.time.delayedCall(CELEBRATION_MS, () => {
      this.starProgress = startNewStarSet();
      this.character = nextCharacter(this.character);
      this.saveProgress();
      this.mascot?.switchTo(this.character);
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
