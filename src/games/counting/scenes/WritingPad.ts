import Phaser from 'phaser';

import type { AnswerRound } from '../logic/answerRound';
import {
  CLEAR_ICON_COLOR,
  KEYPAD_BUTTON_STYLE,
  CONFIRM_BUTTON_STYLE,
  PROBLEM_STYLE,
  WRITING_PAD_STYLE,
} from '../logic/theme';
import type { DeviceWritingLayout } from '../logic/deviceLayout';
import {
  boxesWithRecognizer,
  boxFadingStrokes,
  boxStrokes,
  canConfirmBoxes,
  clearBoxes,
  confirmBoxes,
  createTwoBoxRound,
  finishBoxStroke,
  shownNumber,
  startBoxStroke,
  updateBoxes,
} from '../logic/twoBoxWriting';
import type { TwoBoxConfirmResult, TwoBoxRound, WritingBox } from '../logic/twoBoxWriting';
import type { DigitRecognizer } from '../logic/writingRound';
import { WritingPad as SharedWritingPad } from '../../../shared/ui/WritingPad';
import type { WritingPadLook, WritingPadModel } from '../../../shared/ui/WritingPad';

/**
 * Barvy jsou ve světlém vzhledu (#52) v `src/games/counting/logic/theme.ts`.
 * Smazat vypadá jako tlačítko číselníku, aby se nepletlo s bílým okénkem;
 * ✓ bez rozpoznané číslice je pobledlé, aby bylo vidět, že ještě nejde.
 */
const COUNTING_PAD_LOOK: WritingPadLook = {
  areaBackground: WRITING_PAD_STYLE.background,
  areaBorder: WRITING_PAD_STYLE.borderColor,
  areaBorderWidth: WRITING_PAD_STYLE.borderWidth,
  ink: WRITING_PAD_STYLE.inkColor,
  clearBackground: KEYPAD_BUTTON_STYLE.background,
  clearBorder: KEYPAD_BUTTON_STYLE.borderColor,
  clearBorderWidth: KEYPAD_BUTTON_STYLE.borderWidth,
  clearIcon: CLEAR_ICON_COLOR,
  confirmBackground: CONFIRM_BUTTON_STYLE.background,
  tick: CONFIRM_BUTTON_STYLE.tickColor,
  disabledAlpha: CONFIRM_BUTTON_STYLE.disabledAlpha,
  // Rozpoznané číslo Počítání ukazuje v příkladu, ne v okénku.
  label: PROBLEM_STYLE.writtenDigitColor,
  // Po správné odpovědi zůstává smazání jako dřív.
  dimClearWhenLocked: false,
};

export interface WritingPadEvents {
  /** Změnilo se rozpoznané číslo (`null` = žádné). */
  readonly onNumberChanged: (number: number | null) => void;
  /** Dítě ťuklo na ✓ a odpověď se vyhodnotila. */
  readonly onConfirmed: (result: TwoBoxConfirmResult) => void;
}

/** Okénko podle pořadí v rozložení: jediné okénko jsou jednotky, dvě desítky a jednotky. */
function boxAt(boxCount: number, index: number): WritingBox {
  return boxCount === 2 && index === 0 ? 'tens' : 'ones';
}

/** Logika dvou okének z `twoBoxWriting.ts` pro sdílenou plochu na psaní (#188). */
function twoBoxModel(boxCount: number): WritingPadModel<TwoBoxRound, TwoBoxConfirmResult> {
  return {
    startStroke: (round, index, nowMs) => startBoxStroke(round, boxAt(boxCount, index), nowMs),
    finishStroke: (round, stroke, nowMs) => finishBoxStroke(round, stroke, nowMs),
    update: (round, nowMs) => updateBoxes(round, nowMs),
    clear: (round) => clearBoxes(round),
    canConfirm: (round) => canConfirmBoxes(round),
    confirm: (round) => {
      const result = confirmBoxes(round);
      return { state: result.round, shake: result.outcome === 'wrong', result };
    },
    strokes: (round, index) => boxStrokes(round, boxAt(boxCount, index)),
    fading: (round, index) => boxFadingStrokes(round, boxAt(boxCount, index)),
  };
}

/**
 * Okénka na psaní (jedno při rozsahu 5, desítky a jednotky při 10 a 20)
 * s tlačítky smazání a ✓. Kreslí je sdílená plocha na psaní
 * (`src/shared/ui/WritingPad.ts`, #188); tady se jen napojí logika
 * `twoBoxWriting.ts`, která rozhoduje o rozpoznání a správnosti.
 */
export class WritingPad {
  private readonly pad: SharedWritingPad<TwoBoxRound, TwoBoxConfirmResult>;
  private lastNumber: number | null = null;

  /**
   * @param recognize Stažené rozpoznávání; `null`, dokud se stahuje (#58), zápis pak počká.
   * @param initialRound Stav okének po změně velikosti okna (#54); jinak prázdná okénka.
   */
  constructor(
    scene: Phaser.Scene,
    layout: DeviceWritingLayout,
    answer: AnswerRound,
    recognize: DigitRecognizer | null,
    private readonly events: WritingPadEvents,
    initialRound?: TwoBoxRound,
  ) {
    const [first] = layout.writingAreas;
    const size = { width: first?.width ?? 0, height: first?.height ?? 0 };
    const round = initialRound ?? createTwoBoxRound(answer, size, recognize);
    const startRound = recognize === null ? round : boxesWithRecognizer(round, recognize);
    this.pad = new SharedWritingPad(
      scene,
      layout,
      twoBoxModel(layout.writingAreas.length),
      startRound,
      COUNTING_PAD_LOOK,
      {
        onChanged: (current) => this.reportNumber(current),
        onConfirmed: (result) => this.events.onConfirmed(result),
      },
    );
  }

  /** Volá scéna každý snímek: rozpozná okénka po 1 s a nechá zmizet odmítnutý zápis. */
  update(nowMs: number): void {
    this.pad.update(nowMs);
  }

  /** Rozpoznávání se stáhlo (#58): rozepsaný zápis se rozpozná při dalším snímku. */
  useRecognizer(recognize: DigitRecognizer): void {
    this.pad.replaceState((round) => boxesWithRecognizer(round, recognize));
  }

  /** Po správné odpovědi se už nepíše, jen se čeká na nový příklad. */
  lock(): void {
    this.pad.lock();
  }

  /** Současný stav okének, aby přežil změnu velikosti okna (#54). */
  get state(): TwoBoxRound {
    return this.pad.current;
  }

  /** Místo, odkud vyletí hvězdička za správnou odpověď. */
  get confirmPosition(): { x: number; y: number } {
    return this.pad.confirmPosition;
  }

  destroy(): void {
    this.pad.destroy();
  }

  /** Rozpoznané číslo se ohlásí, jen když se změnilo. */
  private reportNumber(round: TwoBoxRound): void {
    const number = shownNumber(round);
    if (number !== this.lastNumber) {
      this.lastNumber = number;
      this.events.onNumberChanged(number);
    }
  }
}
