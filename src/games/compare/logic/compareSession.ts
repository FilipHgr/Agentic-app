/**
 * Sezení hry Porovnávání (#178), bez Phaseru: příklad, vyhodnocení
 * ťuknutí, hvězdičky, oslava po 10. hvězdičce, uložení postupu, nastavení
 * pro rodiče za kolečkem (#179) a odchod. Scéna jen kreslí, co sezení
 * ohlásí (`onChange`), a předává ťuknutí.
 *
 * Průběh: dítě ťukne správně → hvězdička a znak mezi kartami, za chvíli
 * nový příklad (po 10. hvězdičce nejdřív oslava a prázdná řada). Během
 * přechodu a oslavy se ťuknutí nepočítají. Špatné ťuknutí nic nebere,
 * jen zazní tichý tón a ťuknutá karta (nebo „=“) se zatřese. Po 2. chybě
 * v příkladu se ukáže nápověda párováním teček (#180), která zůstane do
 * konce příkladu; další příklad začíná bez ní.
 *
 * Nastavení (#179): podržení kolečka ho otevře s uloženými volbami. Dokud
 * je otevřené, ťuknutí do hry se nepočítají, domeček nejde a nic se
 * nedohrává (přechod na další příklad ani oslava). Ťuknutí na ✓ volby
 * uloží; změněné platí od dalšího příkladu, který hned přijde, beze změny
 * zůstane rozehraný příklad. Hvězdičky zůstanou a oslava za plnou řadu
 * přijde vždy, po ✓ znovu od začátku. Bez ✓ (odchod z hry) se nic neuloží.
 */

import { STARS_PER_SET, createStarProgress, starsAfterTap } from '../../../shared/logic/stars';
import type { AnswerOutcome, StarProgress } from '../../../shared/logic/stars';
import type { KeyValueStorage } from '../../../shared/storage/keyValueStorage';
import { loadProgress, saveProgress } from '../storage/progressStorage';
import { loadCompareSettings, saveCompareSettings } from '../storage/settingsStorage';
import { HINT_AFTER_MISTAKES } from './compareHint';
import { correctChoice, nextProblem, signOf } from './compareProblems';
import type { CompareChoice, CompareProblem, CompareSign } from './compareProblems';
import { isSameSettings } from './compareSettings';
import type { CompareSettings } from './compareSettings';
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
  | { readonly kind: 'hintShown' }
  | { readonly kind: 'celebrationStarted' }
  | { readonly kind: 'celebrationEnded' }
  | { readonly kind: 'settingsOpened' }
  | { readonly kind: 'settingsClosed' };

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
  /**
   * Napojí podržení kolečka stránky na otevření nastavení (#179 AC1).
   * Vrátí odpojení. Bez něj hra běží bez nastavení.
   */
  readonly attachSettingsGear?: ((open: () => void) => () => void) | undefined;
  readonly onChange?: ((change: CompareChange) => void) | undefined;
}

export interface CompareSession {
  problem(): CompareProblem;
  starCount(): number;
  /** Znak mezi kartami po správné odpovědi, jinak `null`. */
  shownSign(): CompareSign | null;
  isCelebrating(): boolean;
  /** Ukazuje se v rozehraném příkladu nápověda párováním teček (#180)? */
  hintShown(): boolean;
  /** Platné nastavení (po posledním ✓). */
  settings(): CompareSettings;
  /** Nastavení, se kterým začal rozehraný příklad: podle něj se karty kreslí. */
  problemLook(): CompareSettings;
  settingsOpen(): boolean;
  /** Volby v otevřeném nastavení, při zavřeném `null`. */
  settingsChoice(): CompareSettings | null;
  /** Jde teď domečkem odejít (ne při otevřeném nastavení)? */
  homeAvailable(): boolean;
  /** Rodič ťukl na volbu v otevřeném nastavení. */
  chooseSetting(change: Partial<CompareSettings>): void;
  /** Rodič ťukl na ✓: volby platí od dalšího příkladu, který hned přijde. */
  confirmSettings(): void;
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
  let settings: CompareSettings = loadCompareSettings(storage);
  let problemLook: CompareSettings = settings;
  /** Volby v otevřeném nastavení; `null`, když je zavřené. */
  let choice: CompareSettings | null = null;
  let problem = nextProblem(null, random, settings.maxNumber);
  let phase: Phase = 'waiting';
  let sign: CompareSign | null = null;
  /** Špatná ťuknutí v rozehraném příkladu (#180). */
  let mistakes = 0;
  let cancelPending: (() => void) | null = null;

  const notify = (change: CompareChange): void => options.onChange?.(change);

  const schedule = (ms: number, callback: () => void): void => {
    cancelPending = timers.after(ms, () => {
      cancelPending = null;
      callback();
    });
  };

  const startNextProblem = (): void => {
    problemLook = settings;
    problem = nextProblem(problem, random, settings.maxNumber);
    sign = null;
    mistakes = 0;
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

  /** Podržení kolečka: nastavení s uloženými volbami; přechod ani oslava se nedohrají. */
  const openSettings = (): void => {
    if (phase === 'left' || choice !== null) {
      return;
    }
    cancelPending?.();
    cancelPending = null;
    choice = settings;
    if (phase === 'celebrating') {
      // Oslava se po ✓ přehraje znovu od začátku.
      sounds.stopAll();
    }
    notify({ kind: 'settingsOpened' });
  };

  /**
   * ✓: volby se uloží. Při plné řadě (10. hvězdička nebo přerušená oslava)
   * přijde oslava znovu od začátku a teprve po ní prázdná řada (#179).
   * Jinak přijde další příklad, jen když se nastavení změnilo nebo byl
   * příklad už vyřešený; beze změny zůstane rozehraný příklad.
   */
  const confirmSettings = (): void => {
    if (phase === 'left' || choice === null) {
      return;
    }
    const changed = !isSameSettings(choice, settings);
    settings = choice;
    choice = null;
    saveCompareSettings(storage, settings);
    notify({ kind: 'settingsClosed' });
    if (progress.earned >= STARS_PER_SET) {
      startCelebration();
    } else if (changed || phase !== 'waiting') {
      startNextProblem();
    }
  };

  const detachGear = options.attachSettingsGear?.(openSettings) ?? (() => undefined);

  return {
    problem: () => problem,
    starCount: () => progress.earned,
    shownSign: () => sign,
    isCelebrating: () => phase === 'celebrating' && choice === null,
    hintShown: () => mistakes >= HINT_AFTER_MISTAKES,
    settings: () => settings,
    problemLook: () => problemLook,
    settingsOpen: () => choice !== null,
    settingsChoice: () => choice,
    homeAvailable: () => phase !== 'left' && choice === null,
    chooseSetting: (change) => {
      if (choice !== null) {
        choice = { ...choice, ...change };
      }
    },
    confirmSettings,
    tap: (tapped) => {
      if (phase !== 'waiting' || choice !== null) {
        return 'ignored';
      }
      if (tapped !== correctChoice(problem)) {
        sounds.play('wrong');
        notify({ kind: 'wrong', choice: tapped });
        mistakes += 1;
        if (mistakes === HINT_AFTER_MISTAKES) {
          notify({ kind: 'hintShown' });
        }
        return 'wrong';
      }
      answerCorrectly(tapped);
      return 'correct';
    },
    leave: () => {
      if (phase === 'left') {
        return;
      }
      phase = 'left';
      // Volby bez ✓ se zahodí, nic se neuloží (#179 AC6).
      choice = null;
      cancelPending?.();
      cancelPending = null;
      detachGear();
      sounds.stopAll();
    },
  };
}
