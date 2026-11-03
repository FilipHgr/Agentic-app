/**
 * Jedno kolo hry: příklad, číselník s odpověďmi a kolikrát se hráč spletl.
 * Čistý TypeScript bez Phaseru, scéna jen volá tyto funkce a kreslí výsledek.
 */

import { MAX_SUM, createProblem, formatEquation, isCorrectAnswer } from './problems';
import type { Problem } from './problems';
import { DEFAULT_SETTINGS } from './settings';
import type { GameSettings } from './settings';

/** Čísla na číselníku: všechna od 0 do zvoleného rozsahu, vždy ve stejném pořadí. */
export function answerChoices(maxNumber: number): number[] {
  return Array.from({ length: maxNumber + 1 }, (_, index) => index);
}

/** Číselník při výchozím nastavení (0–10). */
export const ANSWER_CHOICES: readonly number[] = answerChoices(MAX_SUM);

/** Po kolika špatných odpovědích se ukáže nápověda s tečkami. */
export const WRONG_ANSWERS_BEFORE_HINT = 2;

export interface AnswerRound {
  readonly problem: Problem;
  /** Nejvyšší číslo na číselníku v tomto kole (zvolený rozsah). */
  readonly maxNumber: number;
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

/**
 * Připraví nové kolo s náhodným příkladem podle nastavení.
 *
 * @param previousProblem Příklad z minulého kola; nový nebude stejný.
 */
export function createAnswerRound(
  settings: GameSettings = DEFAULT_SETTINGS,
  random: () => number = Math.random,
  previousProblem?: Problem,
): AnswerRound {
  return {
    problem: createProblem(settings, random, previousProblem),
    maxNumber: settings.maxNumber,
    wrongAnswers: 0,
    solved: false,
  };
}

/** Vyhodnotí ťuknutí na číslo z číselníku a vrátí nový stav kola. */
export function tapAnswer(round: AnswerRound, tappedNumber: number): TapResult {
  if (round.solved || !answerChoices(round.maxNumber).includes(tappedNumber)) {
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
 * Skupinky teček pro nápovědu, nula skupinku nemá.
 * Sčítání: skupinka za každé sčítané číslo, 3 + 4 → [3, 4], 5 + 0 → [5], 0 + 0 → [].
 * Odčítání: jedna skupinka za první číslo, 7 − 3 → [7]; odečítané tečky
 * jsou její poslední tečky (viz `hintCrossedOutDots`).
 */
export function hintDotGroups(problem: Problem): number[] {
  const counts = problem.operation === 'plus' ? [problem.first, problem.second] : [problem.first];
  return counts.filter((count) => count > 0);
}

/** Kolik posledních teček nápovědy je přeškrtnutých: u odčítání odečítané číslo, jinak žádná. */
export function hintCrossedOutDots(problem: Problem): number {
  return problem.operation === 'minus' ? problem.second : 0;
}

/** Text příkladu rozdělený tak, aby šla odpověď vykreslit zvlášť (zeleně). */
export interface ProblemText {
  /** Levá strana i s rovnítkem, například „3 + 4 =“. */
  readonly equation: string;
  /** „?“, dokud příklad není vyřešený, potom výsledek, například „7“. */
  readonly answer: string;
  /** Výsledek je ukázaný (příklad je vyřešený). */
  readonly answerRevealed: boolean;
}

/** Co je v příkladu vidět: otazník, nebo po správné odpovědi výsledek. */
export function problemText(round: AnswerRound): ProblemText {
  return {
    equation: formatEquation(round.problem),
    answer: round.solved ? String(round.problem.result) : '?',
    answerRevealed: round.solved,
  };
}

/** Celý text příkladu, například „3 + 4 = ?“ a po vyřešení „3 + 4 = 7“. */
export function formatRoundProblem(round: AnswerRound): string {
  const text = problemText(round);
  return `${text.equation} ${text.answer}`;
}
