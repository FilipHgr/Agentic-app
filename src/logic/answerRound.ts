/**
 * Jedno kolo hry: příklad, nabízená čísla a co už hráč ťukl.
 * Čistý TypeScript bez Phaseru, scéna jen volá tyto funkce a kreslí výsledek.
 */

import { MAX_SUM, createAdditionProblem, isCorrectAnswer } from './addition';
import type { AdditionProblem } from './addition';

/** Kolik čísel hráč dostane na výběr. */
export const ANSWER_CHOICE_COUNT = 3;

export interface AnswerRound {
  readonly problem: AdditionProblem;
  /** Nabízená čísla v pořadí, v jakém se zobrazí na obrazovce. */
  readonly choices: readonly number[];
  /** Špatná čísla, na která hráč už ťukl. */
  readonly rejected: readonly number[];
  /** Hráč už ťukl na správné číslo, kolo je u konce. */
  readonly solved: boolean;
}

/**
 * - `correct`: ťuknutí na správné číslo
 * - `wrong`: ťuknutí na špatné číslo
 * - `ignored`: ťuknutí, které nic nemění (kolo je vyřešené nebo číslo už bylo zamítnuto)
 */
export type TapOutcome = 'correct' | 'wrong' | 'ignored';

export interface TapResult {
  readonly outcome: TapOutcome;
  readonly round: AnswerRound;
}

/** Vrátí čísla od 0 do `max` včetně. */
function numbersUpTo(max: number): number[] {
  return Array.from({ length: max + 1 }, (_, index) => index);
}

/** Vrátí položky v náhodném pořadí, původní pole nemění. */
function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const remaining = [...items];
  const result: T[] = [];

  while (remaining.length > 0) {
    // Ochrana proti generátoru, který by vrátil přesně 1.
    const index = Math.min(Math.floor(random() * remaining.length), remaining.length - 1);
    result.push(...remaining.splice(index, 1));
  }

  return result;
}

/**
 * Vybere nabízená čísla: správný výsledek a k němu různá špatná čísla
 * od 0 do `MAX_SUM`, vše v náhodném pořadí.
 */
export function createAnswerChoices(
  problem: AdditionProblem,
  random: () => number = Math.random,
): number[] {
  const wrongNumbers = numbersUpTo(MAX_SUM).filter((number) => number !== problem.result);
  const pickedWrongNumbers = shuffled(wrongNumbers, random).slice(0, ANSWER_CHOICE_COUNT - 1);

  return shuffled([problem.result, ...pickedWrongNumbers], random);
}

/** Připraví nové kolo s náhodným příkladem a nabízenými čísly. */
export function createAnswerRound(random: () => number = Math.random): AnswerRound {
  const problem = createAdditionProblem(random);

  return {
    problem,
    choices: createAnswerChoices(problem, random),
    rejected: [],
    solved: false,
  };
}

/** Vyhodnotí ťuknutí na nabízené číslo a vrátí nový stav kola. */
export function tapAnswer(round: AnswerRound, tappedNumber: number): TapResult {
  const canBeTapped =
    !round.solved && round.choices.includes(tappedNumber) && !round.rejected.includes(tappedNumber);

  if (!canBeTapped) {
    return { outcome: 'ignored', round };
  }

  if (isCorrectAnswer(round.problem, tappedNumber)) {
    return { outcome: 'correct', round: { ...round, solved: true } };
  }

  return {
    outcome: 'wrong',
    round: { ...round, rejected: [...round.rejected, tappedNumber] },
  };
}
