import Phaser from 'phaser';

import { WritingPad } from '../../../shared/ui/WritingPad';
import type { WritingPadModel } from '../../../shared/ui/WritingPad';
import type { AnswerOutcome } from '../../../shared/logic/stars';
import {
  clearWritingBox,
  finishWritingStroke,
  resizeWritingBox,
  startWritingStroke,
} from '../../../shared/logic/writingBox';
import type { Rect, WritingButtonsLayout } from '../logic/compareLayout';
import type { CompareSign, ProblemKind } from '../logic/compareProblems';
import {
  canConfirmSign,
  confirmSign,
  createSignWriting,
  updateSignWriting,
  writtenSign,
} from '../logic/signWriting';
import type { SignConfirmResult, SignWriting } from '../logic/signWriting';
import { WRITING_PAD_LOOK } from '../logic/theme';

/** Smazání a ✓ u plochy na psaní; stejné u obou druhů příkladů (#191). */
export type SignPadButtons = Pick<
  WritingButtonsLayout,
  'padInProblem' | 'clear' | 'confirm' | 'detailScale'
>;

/** Co okénko na psaní potřebuje od hry. */
export interface SignPadEvents {
  /** Dítě potvrdilo ✓ napsané znaménko; vyhodnotí ho sezení hry. */
  readonly answer: (sign: CompareSign) => AnswerOutcome;
  /** Zápis se nerozpoznal: okénko vyzve psát znovu (#188 AC3). */
  readonly onRejected: () => void;
  /** Změnilo se rozpoznané znaménko (`null` = žádné). */
  readonly onSignChanged: (sign: CompareSign | null) => void;
}

/**
 * Okénko příkladu jako plocha na psaní (#188 AC2, od #191 i < = >):
 * sdílená plocha na psaní (`src/shared/ui/WritingPad.ts`) se smazáním
 * a ✓ jako v Počítání a k ní logika znaménka (`signWriting.ts`). Rozpoznané
 * znaménko se ukáže modře v okénku, dokud ho dítě nepotvrdí nebo
 * nepřepíše.
 */
export class SignPad {
  private readonly pad: WritingPad<SignWriting, SignConfirmResult>;
  private lastSign: CompareSign | null = null;

  /**
   * @param kind Druh příkladu: rozpozná se jen znaménko, které k němu patří (#191).
   * @param previous Rozepsaný zápis před otočením zařízení; jinak prázdné okénko.
   */
  constructor(
    scene: Phaser.Scene,
    box: Rect,
    buttons: SignPadButtons,
    kind: ProblemKind,
    private readonly events: SignPadEvents,
    previous?: SignWriting,
  ) {
    const area = { width: box.width, height: box.height };
    const start = previous ? resizeWritingBox(previous, area) : createSignWriting(area);
    const model: WritingPadModel<SignWriting, SignConfirmResult> = {
      startStroke: (writing, _area, nowMs) => startWritingStroke(writing, nowMs),
      finishStroke: (writing, stroke, nowMs) => finishWritingStroke(writing, stroke, nowMs),
      update: (writing, nowMs) => updateSignWriting(writing, nowMs, kind),
      clear: (writing) => clearWritingBox(writing),
      canConfirm: (writing) => canConfirmSign(writing),
      confirm: (writing) => {
        const result = confirmSign(writing, events.answer);
        return { state: result.writing, shake: result.outcome === 'wrong', result };
      },
      strokes: (writing) => writing.strokes,
      fading: (writing) => writing.fading,
      label: (writing) => writtenSign(writing),
    };
    this.pad = new WritingPad(
      scene,
      {
        writingAreas: [
          {
            x: box.left + box.width / 2,
            y: box.top + box.height / 2,
            width: box.width,
            height: box.height,
          },
        ],
        clearButton: squareButton(buttons.clear),
        confirmButton: squareButton(buttons.confirm),
        detailScale: buttons.detailScale,
      },
      model,
      start,
      WRITING_PAD_LOOK,
      {
        onChanged: (writing) => this.reportSign(writtenSign(writing)),
        onConfirmed: () => undefined,
        onRejected: () => events.onRejected(),
      },
    );
    if (previous) {
      // Rozepsaný zápis po otočení zařízení zůstane vidět.
      this.pad.redrawInk();
    }
  }

  /** Volá scéna každý snímek. */
  update(nowMs: number): void {
    this.pad.update(nowMs);
  }

  /** Po správném znaménku se už nepíše, jen se čeká na další příklad. */
  lock(): void {
    this.pad.lock();
  }

  /** Schová plochu na psaní pod kartou s mapou (#193), `false` ji ukáže. */
  setHidden(hidden: boolean): void {
    this.pad.setHidden(hidden);
  }

  /** Okénko se zhoupne: vyzývá psát znovu. */
  sway(): void {
    this.pad.sway();
  }

  /** Rozepsaný zápis, aby přežil otočení zařízení. */
  get writing(): SignWriting {
    return this.pad.current;
  }

  destroy(): void {
    this.pad.destroy();
  }

  /** Rozpoznané znaménko se ohlásí, jen když se změnilo. */
  private reportSign(sign: CompareSign | null): void {
    if (sign !== this.lastSign) {
      this.lastSign = sign;
      this.events.onSignChanged(sign);
    }
  }
}

function squareButton(rect: Rect): { x: number; y: number; size: number } {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, size: rect.width };
}
