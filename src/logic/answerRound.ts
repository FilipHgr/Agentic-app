/**
 * Jedno kolo hry: příklad, číselník s odpověďmi a kolikrát se hráč spletl.
 * Čistý TypeScript bez Phaseru, scéna jen volá tyto funkce a kreslí výsledek.
 */

import { MAX_SUM, createAdditionProblem, isCorrectAnswer } from './addition';
import type { AdditionProblem } from './addition';

/** Čísla na číselníku: vždy všechna od 0 do `MAX_SUM` ve stejném pořadí. */
export const ANSWER_CHOICES: readonly number[] = Array.from(
  { length: MAX_SUM + 1 },
  (_, index) => index,
);

/** Po kolika špatných odpovědích se ukáže nápověda s tečkami. */
export const WRONG_ANSWERS_BEFORE_HINT = 2;

export interface AnswerRound {
  readonly problem: AdditionProblem;
  /** Kolikrát hráč u tohoto příkladu ťukl na špatné číslo. */
  readonly wrongAnswers: number;
  /** Hráč už ťukl na správné číslo, kolo je u konce. */
  readonly solved: boolean;
}

/**
 * - `correct`: ťuknutí na správné číslo
 * - `wrong`: ťuknutí na špatné číslo
 * - `ignored`: ťuknutí, které nic nemění (kolo je vyřešené nebo číslo není na číselníku)
 */
export type TapOutcome = 'correct' | 'wrong' | 'ignored';

export interface TapResult {
  readonly outcome: TapOutcome;
  readonly round: AnswerRound;
}

/** Připraví nové kolo s náhodným příkladem. */
export function createAnswerRound(random: () => number = Math.random): AnswerRound {
  return {
    problem: createAdditionProblem(random),
    wrongAnswers: 0,
    solved: false,
  };
}

/** Vyhodnotí ťuknutí na číslo z číselníku a vrátí nový stav kola. */
export function tapAnswer(round: AnswerRound, tappedNumber: number): TapResult {
  if (round.solved || !ANSWER_CHOICES.includes(tappedNumber)) {
    return { outcome: 'ignored', round };
  }

  if (isCorrectAnswer(round.problem, tappedNumber)) {
    return { outcome: 'correct', round: { ...round, solved: true } };
  }

  return {
    outcome: 'wrong',
    round: { ...round, wrongAnswers: round.wrongAnswers + 1 },
  };
}

/** Má se teď ukázat nápověda s tečkami? */
export function isHintVisible(round: AnswerRound): boolean {
  return !round.solved && round.wrongAnswers >= WRONG_ANSWERS_BEFORE_HINT;
}

/**
 * Skupinky teček pro nápovědu: jedna skupinka za každé sčítané číslo,
 * nula skupinku nemá. Například 3 + 4 → [3, 4], 5 + 0 → [5], 0 + 0 → [].
 */
export function hintDotGroups(problem: AdditionProblem): number[] {
  return [problem.first, problem.second].filter((count) => count > 0);
}
