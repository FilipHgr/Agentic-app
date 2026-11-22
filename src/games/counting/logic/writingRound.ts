/**
 * Kolo s odpovědí psanou prstem (#41): jedno okénko na psaní a příklad,
 * ke kterému patří. Tahy, čekání na rozpoznání, ukázaná číslice
 * a odmítnutý zápis řídí sdílená logika okénka
 * (`src/shared/logic/writingBox.ts`, #189), tady se jen vyhodnocuje
 * odpověď. Čas se předává jako číslo v ms. Čistý TypeScript bez Phaseru.
 * Rozpoznávání se stahuje na pozadí (#58): dokud není, kolo má místo něj
 * `null`, zápis zůstane vidět a počká, ✓ nejde stisknout.
 */

import type { AnswerRound, TapOutcome } from './answerRound';
import type { Stroke, WritingAreaSize } from './digitRecognition';
import { isCorrectAnswer } from './problems';
import {
  RECOGNITION_DELAY_MS,
  REJECTED_FADE_MS,
  clearWritingBox,
  createWritingBox,
  finishWritingStroke,
  startWritingStroke,
  updateWritingBox,
} from '../../../shared/logic/writingBox';
import type { StrokeRecognizer, WritingBoxState } from '../../../shared/logic/writingBox';

/**
 * Za jak dlouho po zvednutí prstu se ukáže rozpoznaná číslice a jak dlouho
 * bledne odmítnutý zápis: od #188 společné pro všechna okénka na psaní.
 */
export { RECOGNITION_DELAY_MS, REJECTED_FADE_MS };

export type DigitRecognizer = StrokeRecognizer<number>;

/** Okénko na psaní číslice (`value` je rozpoznaná číslice) s příkladem. */
export interface WritingRound extends WritingBoxState<number> {
  readonly answer: AnswerRound;
  /** Stažené rozpoznávání; `null`, dokud se nestáhne (#58). */
  readonly recognize: DigitRecognizer | null;
}

export interface ConfirmResult {
  readonly outcome: TapOutcome;
  readonly round: WritingRound;
}

/** Nové kolo s prázdnou plochou na psaní; `recognize` je `null`, dokud se nestáhne. */
export function createWritingRound(
  answer: AnswerRound,
  area: WritingAreaSize,
  recognize: DigitRecognizer | null,
): WritingRound {
  return { ...createWritingBox<number>(area), answer, recognize };
}

/** Rozpoznávání se stáhlo: čekající zápis se rozpozná při dalším posunu v čase. */
export function withRecognizer(round: WritingRound, recognize: DigitRecognizer): WritingRound {
  return { ...round, recognize };
}

/** Prst se dotkl plochy: dokud je dole, nic se nerozpoznává. */
export function startStroke(round: WritingRound, nowMs: number): WritingRound {
  return { ...round, ...startWritingStroke(round, nowMs) };
}

/** Prst se zvedl: tah se přidá k zápisu a za 1 s se zápis rozpozná. */
export function finishStroke(round: WritingRound, stroke: Stroke, nowMs: number): WritingRound {
  return { ...round, ...finishWritingStroke(round, stroke, nowMs) };
}

/**
 * Posune kolo v čase: rozpozná čekající zápis a nechá zmizet vybledlý.
 * Bez staženého rozpoznávání zápis čeká dál, bez časového limitu;
 * vybledlý zápis ale zmizí i tak.
 */
export function updateWriting(round: WritingRound, nowMs: number): WritingRound {
  if (round.recognize === null) {
    return { ...round, fading: fadingAfterWaiting(round, nowMs) };
  }
  return { ...round, ...updateWritingBox(round, nowMs, round.recognize) };
}

/**
 * Bez rozpoznávání se okénko posune jako s prstem na ploše: zápis se
 * nerozpozná ani neodmítne, jen odmítnutý zápis dobledne a zmizí.
 */
function fadingAfterWaiting(round: WritingRound, nowMs: number): readonly Stroke[] {
  const waiting = updateWritingBox({ ...round, fingerDown: true }, nowMs, recognizeNothing);
  return waiting.fading;
}

/** Rozpoznávání, které se nikdy nezavolá: okénko s prstem na ploše nic nerozpoznává. */
function recognizeNothing(): null {
  return null;
}

/** Smazání: zápis i číslice zmizí. Není to chyba. */
export function clearWriting(round: WritingRound): WritingRound {
  return { ...round, ...clearWritingBox(round) };
}

/** Jde teď ťuknout na ✓? Jen s ukázanou číslicí a nevyřešeným příkladem. */
export function canConfirm(round: WritingRound): boolean {
  return round.value !== null && !round.answer.solved;
}

/**
 * Potvrzení ✓ se vyhodnotí stejně jako ťuknutí na číselník. Po špatné
 * odpovědi se zápis smaže, aby dítě mohlo psát znovu.
 */
export function confirmWriting(round: WritingRound): ConfirmResult {
  if (round.value === null || !canConfirm(round)) {
    return { outcome: 'ignored', round };
  }

  const answer = round.answer;
  if (isCorrectAnswer(answer.problem, round.value)) {
    return { outcome: 'correct', round: { ...round, answer: { ...answer, solved: true } } };
  }

  return {
    outcome: 'wrong',
    round: clearWriting({ ...round, answer: { ...answer, wrongAnswers: answer.wrongAnswers + 1 } }),
  };
}

/** Rozpoznaná číslice, nebo `null`, když žádná není ukázaná. */
export function shownDigit(round: WritingRound): number | null {
  return round.value;
}

/** Tahy současného zápisu. */
export function writtenStrokes(round: WritingRound): readonly Stroke[] {
  return round.strokes;
}

/** Odmítnutý zápis, který právě bledne. */
export function fadingStrokes(round: WritingRound): readonly Stroke[] {
  return round.fading;
}
