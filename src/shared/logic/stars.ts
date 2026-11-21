/**
 * Řada hvězdiček za vyřešené příklady, společná pro všechny hry. Po
 * nasbírání celé řady přijde oslava a začíná se znovu od prázdné řady.
 * Tady je i vzhled hvězdiček v řadě. Čistý TypeScript bez Phaseru.
 */

/** Výsledek ťuknutí na odpověď: správně, špatně, nebo se nepočítá. */
export type AnswerOutcome = 'correct' | 'wrong' | 'ignored';

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
export function starsAfterTap(progress: StarProgress, outcome: AnswerOutcome): StarResult {
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

export const STAR_STYLE = {
  earnedColor: '#FFCC00',
  earnedOutlineColor: '#A67C00',
  earnedOutlineWidth: 1.5,
  emptyColor: '#D2D2D7',
} as const;

export interface StarLook {
  readonly fill: string;
  readonly outlineColor: string | null;
  readonly outlineWidth: number;
}

/** Hvězdičky v řadě zleva: získané zlaté s obrysem, ostatní šedé. */
export function starLooks(progress: StarProgress): readonly StarLook[] {
  return Array.from({ length: STARS_PER_SET }, (_, index) =>
    index < progress.earned
      ? {
          fill: STAR_STYLE.earnedColor,
          outlineColor: STAR_STYLE.earnedOutlineColor,
          outlineWidth: STAR_STYLE.earnedOutlineWidth,
        }
      : { fill: STAR_STYLE.emptyColor, outlineColor: null, outlineWidth: 0 },
  );
}
