/**
 * Hvězdičky za vyřešené příklady. Po nasbírání celé řady přijde oslava
 * a začíná se znovu od prázdné řady. Čistý TypeScript bez Phaseru.
 */

import type { TapOutcome } from './answerRound';

/** Kolik hvězdiček je v jedné řadě, než přijde oslava. */
export const STARS_PER_SET = 10;

export interface StarProgress {
  /** Kolik hvězdiček v aktuální řadě už svítí. */
  readonly earned: number;
}

export interface StarResult {
  readonly progress: StarProgress;
  /** Hráč právě dostal hvězdičku. */
  readonly starEarned: boolean;
  /** Hráč právě zaplnil celou řadu, přijde oslava. */
  readonly setCompleted: boolean;
}

/** Na začátku hry nesvítí žádná hvězdička. */
export function createStarProgress(): StarProgress {
  return { earned: 0 };
}

/**
 * Hvězdičku dostane hráč za každou správnou odpověď, i po chybách
 * a s nápovědou. Chyba hvězdičku nikdy nebere.
 */
export function starsAfterTap(progress: StarProgress, outcome: TapOutcome): StarResult {
  if (outcome !== 'correct') {
    return { progress, starEarned: false, setCompleted: false };
  }

  // Plná řada se po oslavě vyprázdní; kdyby to scéna nestihla, začne se znovu.
  const earnedBefore = progress.earned >= STARS_PER_SET ? 0 : progress.earned;
  const earned = earnedBefore + 1;

  return {
    progress: { earned },
    starEarned: true,
    setCompleted: earned === STARS_PER_SET,
  };
}

/** Po oslavě začíná nová, prázdná řada hvězdiček. */
export function startNewStarSet(): StarProgress {
  return createStarProgress();
}
