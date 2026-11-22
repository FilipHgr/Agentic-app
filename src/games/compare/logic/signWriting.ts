/**
 * Znaménko psané prstem do okénka příkladu (#188). Okénko se chová jako
 * okénko v Počítání (sdílené `src/shared/logic/writingBox.ts`): 1 s po
 * zvednutí prstu se zápis rozpozná (`signRecognition.ts`), rozpoznané
 * znaménko se ukáže v okénku a dítě ho potvrdí ✓, nebo přepíše dalším
 * tahem (− doplněné svislou čarou je +). Nerozpoznaný zápis vybledne
 * a nic se nepočítá. Čistý TypeScript bez Phaseru.
 */

import type { AnswerOutcome } from '../../../shared/logic/stars';
import type { WritingAreaSize } from '../../../shared/logic/strokes';
import {
  canConfirmWritingBox,
  clearWritingBox,
  createWritingBox,
  updateWritingBox,
} from '../../../shared/logic/writingBox';
import type { WritingBoxState } from '../../../shared/logic/writingBox';
import type { CompareSign } from './compareProblems';
import { recognizeSign } from './signRecognition';

export type SignWriting = WritingBoxState<CompareSign>;

export interface SignConfirmResult {
  readonly outcome: AnswerOutcome;
  readonly writing: SignWriting;
}

/** Prázdné okénko na psaní velikosti `area`. */
export function createSignWriting(area: WritingAreaSize): SignWriting {
  return createWritingBox<CompareSign>(area);
}

/** Posune okénko v čase: 1 s po zvednutí prstu rozpozná + nebo −. */
export function updateSignWriting(writing: SignWriting, nowMs: number): SignWriting {
  return updateWritingBox(writing, nowMs, recognizeSign);
}

/** Rozpoznané znaménko, které čeká na ✓; jinak `null`. */
export function writtenSign(writing: SignWriting): CompareSign | null {
  return writing.value;
}

/** Jde ťuknout na ✓? Jen s rozpoznaným znaménkem a prstem nahoře. */
export function canConfirmSign(writing: SignWriting): boolean {
  return canConfirmWritingBox(writing);
}

/**
 * ✓: rozpoznané znaménko se vyhodnotí stejně jako ťuknutí na tlačítko
 * (`answer`, sezení hry). Po špatném znaménku se okénko vyprázdní, aby
 * dítě psalo znovu; po správném zůstane, než přijde další příklad.
 */
export function confirmSign(
  writing: SignWriting,
  answer: (sign: CompareSign) => AnswerOutcome,
): SignConfirmResult {
  const sign = writtenSign(writing);
  if (sign === null || !canConfirmSign(writing)) {
    return { outcome: 'ignored', writing };
  }
  const outcome = answer(sign);
  return { outcome, writing: outcome === 'wrong' ? clearWritingBox(writing) : writing };
}
