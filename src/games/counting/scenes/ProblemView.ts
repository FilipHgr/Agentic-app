import type Phaser from 'phaser';

import { problemText } from '../logic/answerRound';
import type { AnswerRound } from '../logic/answerRound';
import type { DeviceScreenLayout, DeviceWritingLayout } from '../logic/deviceLayout';
import { FONT_FAMILY } from '../../../shared/logic/theme';
import { PROBLEM_STYLE } from '../logic/theme';
import {
  QUESTION_MARK_HOP_MS,
  questionMarkLiftAt,
  questionMarkScaleAt,
} from '../logic/wrongAnswerFeedback';

/** Výsledek v příkladu po správné odpovědi: zelený jako správné tlačítko. */
const ANSWER_REVEALED_COLOR = PROBLEM_STYLE.revealedAnswerColor;
const PROBLEM_TEXT_COLOR = PROBLEM_STYLE.color;
const QUESTION_MARK_COLOR = PROBLEM_STYLE.questionMarkColor;

/** Rozpoznaná, ještě nepotvrzená číslice v příkladu: modrá jako číslice číselníku. */
const ANSWER_WRITTEN_COLOR = PROBLEM_STYLE.writtenDigitColor;

/** Mezera mezi rovnítkem a odpovědí jako část velikosti písma (přibližná šířka mezery). */
const ANSWER_GAP_RATIO = 0.28;

type ProblemLayout = DeviceScreenLayout | DeviceWritingLayout;

/** Příklad ze dvou částí: levá strana „3 + 4 =“ a odpověď „?“, později výsledek. */
export class ProblemView {
  private equation: Phaser.GameObjects.Text | undefined;
  private answer: Phaser.GameObjects.Text | undefined;
  /** Kdy začal poskok „?“ po špatné odpovědi (#155); `undefined` = „?“ je v klidu. */
  private hopStartMs: number | undefined;
  /** Rozložení, ve kterém „?“ poskakuje (výška poskoku i klidová poloha). */
  private hopLayout: ProblemLayout | undefined;

  constructor(private readonly scene: Phaser.Scene) {}

  /** Je příklad aspoň jednou nakreslený (má kam ukázat odpověď)? */
  get hasAnswer(): boolean {
    return this.answer !== undefined;
  }

  /**
   * Nakreslí příklad kola `round`.
   *
   * @returns Nové objekty, které se smažou s kolem.
   */
  draw(round: AnswerRound, layout: ProblemLayout): Phaser.GameObjects.Text[] {
    const text = problemText(round);
    const style = {
      fontFamily: FONT_FAMILY,
      fontSize: `${layout.problemFontSize}px`,
      fontStyle: String(PROBLEM_STYLE.fontWeight),
      color: PROBLEM_TEXT_COLOR,
    };

    const equation = this.scene.add
      .text(0, layout.problem.y, text.equation, style)
      .setOrigin(0, 0.5);
    const answerColor = text.answerRevealed ? ANSWER_REVEALED_COLOR : QUESTION_MARK_COLOR;
    const answer = this.scene.add
      .text(0, layout.problem.y, text.answer, { ...style, color: answerColor })
      .setOrigin(0.5);
    this.equation = equation;
    this.answer = answer;
    this.hopStartMs = undefined;
    this.center(layout);
    return [equation, answer];
  }

  /**
   * Rozpoznané číslo se ukáže modře místo „?“, dokud ho dítě nepotvrdí;
   * `null` vrátí otazník.
   */
  showWritten(round: AnswerRound, number: number | null, layout: ProblemLayout): void {
    if (!this.answer) {
      return;
    }
    if (number === null) {
      this.answer.setText(problemText(round).answer).setColor(QUESTION_MARK_COLOR);
    } else {
      this.answer.setText(String(number)).setColor(ANSWER_WRITTEN_COLOR);
    }
    this.center(layout);
  }

  /** Po správné odpovědi se místo „?“ ukáže zelený výsledek a jednou poskočí. */
  reveal(round: AnswerRound, layout: ProblemLayout): void {
    if (!this.answer) {
      return;
    }
    const text = problemText(round);
    // Rozběhnutý poskok „?“ skončí, zelený výsledek stojí na svém místě.
    this.hopStartMs = undefined;
    this.answer.setY(layout.problem.y).setScale(1);
    this.answer.setText(text.answer).setColor(ANSWER_REVEALED_COLOR);
    this.center(layout);
    this.scene.tweens.add({
      targets: this.answer,
      scale: 1.25,
      duration: 150,
      yoyo: true,
      ease: 'Quad.easeOut',
    });
  }

  /** Po špatné odpovědi „?“ krátce poskočí, na telefonu se i zvětší (#155); průběh kreslí `update`. */
  hop(layout: ProblemLayout, nowMs: number): void {
    if (!this.answer) {
      return;
    }
    this.hopStartMs = nowMs;
    this.hopLayout = layout;
    this.update(nowMs);
  }

  /** Posune „?“ podle poskoku v čase `nowMs`; po jeho konci ho vrátí na místo. */
  update(nowMs: number): void {
    const startMs = this.hopStartMs;
    const layout = this.hopLayout;
    if (!this.answer || startMs === undefined || !layout) {
      return;
    }
    const elapsed = nowMs - startMs;
    this.answer.y = layout.problem.y - questionMarkLiftAt(elapsed, layout);
    // Kde na poskok není místo (telefon), se „?“ navíc zvětší kolem středu.
    this.answer.setScale(questionMarkScaleAt(elapsed, layout));
    if (elapsed >= QUESTION_MARK_HOP_MS) {
      this.hopStartMs = undefined;
    }
  }

  /** Vycentruje celý příklad; odpověď může po vyřešení změnit šířku. */
  private center(layout: ProblemLayout): void {
    if (!this.equation || !this.answer) {
      return;
    }
    const gap = layout.problemFontSize * ANSWER_GAP_RATIO;
    const totalWidth = this.equation.width + gap + this.answer.width;
    const left = layout.problem.x - totalWidth / 2;

    this.equation.x = left;
    this.answer.x = left + this.equation.width + gap + this.answer.width / 2;
  }
}
