import type Phaser from 'phaser';

import { answerChoices } from '../logic/answerRound';
import type { AnswerRound } from '../logic/answerRound';
import type { DeviceScreenLayout } from '../logic/deviceLayout';
import type { DotCounting } from '../logic/dotCounting';
import { isWritingActive } from '../logic/settings';
import type { GameSettings } from '../logic/settings';
import type { TwoBoxConfirmResult, TwoBoxRound } from '../logic/twoBoxWriting';
import type { DigitRecognizer } from '../logic/writingRound';
import { createAnswerButton, paintAnswerButton } from './AnswerButton';
import type { AnswerButton } from './AnswerButton';
import { drawHintDots, showDotCounted } from './HintDots';
import type { HintDotsContext } from './HintDots';
import { ProblemView } from './ProblemView';
import type { SceneLayouts } from './SceneLayouts';
import { WritingPad } from './WritingPad';

/** Co se na kole stalo; o tom, co to znamená, rozhoduje scéna. */
export interface RoundViewEvents {
  /** Dítě ťuklo na tlačítko číselníku (jen jedním prstem). */
  readonly onAnswerTapped: (button: AnswerButton) => void;
  /** Změnilo se rozpoznané napsané číslo (`null` = žádné). */
  readonly onNumberWritten: (number: number | null) => void;
  /** Dítě potvrdilo napsané číslo. */
  readonly onWritingConfirmed: (result: TwoBoxConfirmResult) => void;
  /** Dítě ťuklo na tečku nápovědy s pořadím `index`. */
  readonly onDotTapped: (index: number, circle: Phaser.GameObjects.Arc) => void;
}

/** Co je potřeba k nakreslení rozehraného kola. */
export interface RoundDrawing {
  readonly round: AnswerRound;
  /** Nastavení, jak se má kolo ukázat (psaní jen se staženým nebo stahovaným rozpoznáváním, #58). */
  readonly settings: GameSettings;
  /** Stažené rozpoznávání pro okénka; `null`, dokud se stahuje. */
  readonly recognizer: DigitRecognizer | null;
  readonly hintIsShown: boolean;
  readonly counting: DotCounting;
}

/**
 * Nakreslené kolo: příklad, číselník nebo okénka na psaní a tečky nápovědy.
 * Všechno se smaže najednou, když přijde nový příklad nebo jiné rozložení.
 */
export class RoundView {
  readonly problem: ProblemView;
  private objects: Phaser.GameObjects.GameObject[] = [];
  /** Prst, který právě drží tlačítko číselníku; další prsty se nepočítají. */
  private keypadPointerId: number | undefined;
  /** Plocha na psaní, když dítě odpovídá psaním (#41); jinak číselník. */
  private pad: WritingPad | undefined;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly layouts: SceneLayouts,
    private readonly events: RoundViewEvents,
  ) {
    this.problem = new ProblemView(scene);
  }

  /** Okénka na psaní, když se odpovídá psaním. */
  get writingPad(): WritingPad | undefined {
    return this.pad;
  }

  /** Prst puštěný i mimo hrací plochu číselník uvolní, aby se nezasekl. */
  listenForKeypadRelease(): void {
    const releaseKeypad = (pointer: Phaser.Input.Pointer): void => {
      if (pointer.id === this.keypadPointerId) {
        this.keypadPointerId = undefined;
      }
    };
    this.scene.input.on('pointerup', releaseKeypad);
    this.scene.input.on('pointerupoutside', releaseKeypad);
  }

  /**
   * Nakreslí rozehrané kolo: příklad, číselník nebo okénka a nápovědu,
   * pokud už je vidět (po změně velikosti okna hned, bez naskakování).
   *
   * @param writingState Stav okének po změně velikosti okna; jinak prázdná okénka.
   * @param animateHint Tečky nápovědy naskočí jedna po druhé.
   */
  draw(drawing: RoundDrawing, writingState?: TwoBoxRound, animateHint = false): void {
    const { round } = drawing;
    const layout = this.layouts.keypad();
    this.objects.push(...this.problem.draw(round, this.layouts.scenery()));

    if (isWritingActive(drawing.settings)) {
      this.createWritingPad(round, drawing.recognizer, writingState);
    } else {
      this.createKeypad(layout, round);
    }
    if (drawing.hintIsShown) {
      this.drawHint(round, drawing.counting, animateHint);
    }
  }

  /** Tečky nápovědy v rozložení se skutečným ovládáním. */
  drawHint(round: AnswerRound, counting: DotCounting, animate: boolean): void {
    drawHintDots(this.hintContext(round, counting), animate);
  }

  /** Právě spočítaná tečka ukáže pořadové číslo. */
  showDotCounted(
    round: AnswerRound,
    counting: DotCounting,
    circle: Phaser.GameObjects.Arc,
    number: number,
  ): void {
    showDotCounted(this.hintContext(round, counting), circle, number);
  }

  /** Smaže všechno nakreslené z kola. */
  clear(): void {
    this.pad?.destroy();
    this.pad = undefined;
    for (const object of this.objects) {
      this.scene.tweens.killTweensOf(object);
      object.destroy();
    }
    this.objects = [];
  }

  /** Číselník; po vyřešení (čeká se na další příklad) je správné tlačítko zelené. */
  private createKeypad(layout: DeviceScreenLayout, round: AnswerRound): void {
    answerChoices(round.maxNumber).forEach((value, index) => {
      const slot = layout.answerButtons[index];
      if (!slot) {
        return;
      }
      const button = createAnswerButton(
        this.scene,
        value,
        slot,
        layout.detailScale,
        (pressed, pointer) => this.onButtonPressed(pressed, pointer),
      );
      if (round.solved && value === round.problem.result) {
        paintAnswerButton(button, 'correct');
      }
      this.objects.push(button.container);
    });
  }

  /** Číselník bere jen jeden prst: dva prsty (třeba dlaň) nesmí dát dvě odpovědi. */
  private onButtonPressed(button: AnswerButton, pointer: Phaser.Input.Pointer): void {
    if (this.keypadPointerId !== undefined && this.keypadPointerId !== pointer.id) {
      return;
    }
    this.keypadPointerId = pointer.id;
    this.events.onAnswerTapped(button);
  }

  /** Místo číselníku okénka na psaní: při rozsahu 5 jedno, při 10 a 20 dvě (#42). */
  private createWritingPad(
    round: AnswerRound,
    recognizer: DigitRecognizer | null,
    writingState?: TwoBoxRound,
  ): void {
    this.pad = new WritingPad(
      this.scene,
      this.layouts.writing(),
      round,
      recognizer,
      {
        onNumberChanged: (number) => this.events.onNumberWritten(number),
        onConfirmed: (result) => this.events.onWritingConfirmed(result),
      },
      writingState,
    );
    if (round.solved) {
      this.pad.lock();
    }
  }

  private hintContext(round: AnswerRound, counting: DotCounting): HintDotsContext {
    return {
      scene: this.scene,
      round,
      layout: this.layouts.answer(),
      counting,
      track: (...objects) => this.objects.push(...objects),
      onDotTapped: (index, circle) => this.events.onDotTapped(index, circle),
    };
  }
}
