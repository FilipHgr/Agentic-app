/**
 * Sezení hry Porovnávání (#178), bez Phaseru: příklad, vyhodnocení
 * ťuknutí, hvězdičky, oslava po 10. hvězdičce, uložení postupu a odchod.
 * Scéna jen kreslí, co sezení ohlásí (`onChange`), a předává ťuknutí.
 *
 * Průběh: dítě ťukne správně → hvězdička a znak mezi kartami, za chvíli
 * nový příklad (po 10. hvězdičce nejdřív oslava a prázdná řada). Během
 * přechodu a oslavy se ťuknutí nepočítají. Špatné ťuknutí nic nebere,
 * jen zazní tichý tón a ťuknutá karta (nebo „=“) se zatřese.
 */

import { createStarProgress, starsAfterTap } from '../../../shared/logic/stars';
import type { AnswerOutcome, StarProgress } from '../../../shared/logic/stars';
import type { KeyValueStorage } from '../../../shared/storage/keyValueStorage';
import { loadProgress, saveProgress } from '../storage/progressStorage';
import { correctChoice, nextProblem, signOf } from './compareProblems';
import type { CompareChoice, CompareProblem, CompareSign } from './compareProblems';
import type { CompareSoundName } from './compareSounds';

export type { CompareSoundName } from './compareSounds';

/** Jak dlouho po správné odpovědi zůstane příklad se znakem, než přijde další. */
export const NEXT_PROBLEM_MS = 1400;

/** Jak dlouho trvá oslava s konfetami po 10. hvězdičce. */
export const CELEBRATION_MS = 2600;

/** Co se ve hře změnilo; scéna to nakreslí. */
export type CompareChange =
  | { readonly kind: 'problemStarted' }
  | { readonly kind: 'solved'; readonly choice: CompareChoice; readonly sign: CompareSign }
  | { readonly kind: 'wrong'; readonly choice: CompareChoice }
  | { readonly kind: 'celebrationStarted' }
  | { readonly kind: 'celebrationEnded' };

export interface CompareSounds {
  play(name: CompareSoundName): void;
  stopAll(): void;
}

export interface CompareTimers {
  /** Zavolá `callback` za `ms`; vrátí zrušení. */
  after(ms: number, callback: () => void): () => void;
}

export interface CompareSessionOptions {
  /** Úložiště hry aktivního profilu; bez něj se hvězdičky pamatují jen v paměti. */
  readonly storage?: KeyValueStorage | undefined;
  readonly random: () => number;
  readonly sounds: CompareSounds;
  readonly timers: CompareTimers;
  readonly onChange?: ((change: CompareChange) => void) | undefined;
}

export interface CompareSession {
  problem(): CompareProblem;
  starCount(): number;
  /** Znak mezi kartami po správné odpovědi, jinak `null`. */
  shownSign(): CompareSign | null;
  isCelebrating(): boolean;
  /** Dítě ťuklo na kartu nebo na „=“. */
  tap(choice: CompareChoice): AnswerOutcome;
  /** Odchod z hry: zruší naplánované akce a ztiší zvuky. */
  leave(): void;
}

/** Co hra právě dělá: čeká na odpověď, ukazuje vyřešený příklad, slaví, nebo skončila. */
type Phase = 'waiting' | 'solved' | 'celebrating' | 'left';

export function createCompareSession(options: CompareSessionOptions): CompareSession {
  const { storage, random, sounds, timers } = options;
  let progress: StarProgress = loadProgress(storage);
  let problem = nextProblem(null, random);
  let phase: Phase = 'waiting';
  let sign: CompareSign | null = null;
  let cancelPending: (() => void) | null = null;

  const notify = (change: CompareChange): void => options.onChange?.(change);

  const schedule = (ms: number, callback: () => void): void => {
    cancelPending = timers.after(ms, () => {
      cancelPending = null;
      callback();
    });
  };

  const startNextProblem = (): void => {
    problem = nextProblem(problem, random);
    sign = null;
    phase = 'waiting';
    notify({ kind: 'problemStarted' });
  };

  const endCelebration = (): void => {
    progress = createStarProgress();
    saveProgress(storage, progress);
    notify({ kind: 'celebrationEnded' });
    startNextProblem();
  };

  const startCelebration = (): void => {
    phase = 'celebrating';
    sounds.play('celebration');
    notify({ kind: 'celebrationStarted' });
    schedule(CELEBRATION_MS, endCelebration);
  };

  const answerCorrectly = (choice: CompareChoice): void => {
    const result = starsAfterTap(progress, 'correct');
    progress = result.progress;
    // Plná řada se uloží taky: po zavření uprostřed oslavy začne prázdná řada.
    saveProgress(storage, progress);
    phase = 'solved';
    sign = signOf(problem);
    sounds.play('correct');
    notify({ kind: 'solved', choice, sign });
    schedule(NEXT_PROBLEM_MS, result.setCompleted ? startCelebration : startNextProblem);
  };

  return {
    problem: () => problem,
    starCount: () => progress.earned,
    shownSign: () => sign,
    isCelebrating: () => phase === 'celebrating',
    tap: (choice) => {
      if (phase !== 'waiting') {
        return 'ignored';
      }
      if (choice !== correctChoice(problem)) {
        sounds.play('wrong');
        notify({ kind: 'wrong', choice });
        return 'wrong';
      }
      answerCorrectly(choice);
      return 'correct';
    },
    leave: () => {
      if (phase === 'left') {
        return;
      }
      phase = 'left';
      cancelPending?.();
      cancelPending = null;
      sounds.stopAll();
    },
  };
}
