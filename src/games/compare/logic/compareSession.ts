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
 *
 * Panda Rudy (#181, jako v Počítání #170): po otevření hry jednou okno
 * s pozdravem; dokud je vidět, ťuknutí se nepočítají. Ťuknutí dřív, než
 * se okno stáhne, pozdrav vynechá, aby nevyskočil uprostřed hraní. Po
 * 10. hvězdičce nejdřív okno s oslavou a teprve po jeho zavření melodie
 * a konfety. Okno, které se nestáhne, hra nečeká (jde dál hned). Nastavení
 * okno zavře; po ✓ s plnou řadou přijde okno s oslavou znovu, jen když ho
 * dítě za tuto řadu ještě nevidělo, jinak rovnou konfety.
 */

import { STARS_PER_SET, createStarProgress, starsAfterTap } from '../../../shared/logic/stars';
import type { AnswerOutcome, StarProgress } from '../../../shared/logic/stars';
import type { RudyLineMove } from '../../../shared/logic/rudy';
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

/**
 * Od kolikáté hvězdičky v řadě se dopředu stahuje oslava Rudyho, aby po
 * 10. hvězdičce okno nečekalo (#181, jako v Počítání).
 */
export const PREPARE_CELEBRATION_FROM_STARS = 8;

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

/** Co okno s pandou hře ohlásí: ukázalo se, nebo se zavřelo (i když se neukázalo). */
export interface CompareRudyEvents {
  onOpened(): void;
  onClosed(): void;
}

/**
 * Okno s pandou Rudym (#181): pozdrav po otevření hry a oslava po
 * 10. hvězdičce. Okno se ukáže, až se stáhne; když se nestáhne,
 * zavolá rovnou `onClosed` a hra jde dál.
 */
export interface CompareRudy {
  show(move: RudyLineMove, events: CompareRudyEvents): void;
  /** Stáhne pohyb dopředu, aby se pak okno ukázalo hned. */
  prepare(move: RudyLineMove): void;
  /** Čekající okno se neukáže a otevřené se zavře (nastavení, odchod). */
  stop(): void;
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
  /** Okno s pandou Rudym (#181); bez něj hra pozdrav ani okno s oslavou neukazuje. */
  readonly rudy?: CompareRudy | undefined;
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
  /** Okno s pandou, o které hra požádala a které se ještě nezavřelo (#181). */
  let rudyMoment: { readonly move: RudyLineMove; readonly id: number } | null = null;
  let rudyMomentCount = 0;
  let rudyIsOpen = false;
  /** Vidělo dítě za plnou řadu okno s oslavou? Po ✓ nastavení se pak neopakuje. */
  let rowCelebratedByRudy = false;

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

  /**
   * Ukáže okno s pandou a po jeho zavření zavolá `then`. Bez okna zavolá
   * `then` hned. Zastavené okno (`stopRudy`) už `then` nezavolá.
   */
  const showRudy = (move: RudyLineMove, then: () => void): void => {
    const rudy = options.rudy;
    if (rudy === undefined) {
      then();
      return;
    }
    rudyMomentCount += 1;
    const moment = { move, id: rudyMomentCount };
    rudyMoment = moment;
    const isCurrent = (): boolean => phase !== 'left' && rudyMoment?.id === moment.id;
    rudy.show(move, {
      onOpened: () => {
        if (isCurrent()) {
          rudyIsOpen = true;
          rowCelebratedByRudy ||= move === 'celebrate';
        }
      },
      onClosed: () => {
        if (!isCurrent()) {
          return;
        }
        rudyMoment = null;
        rudyIsOpen = false;
        then();
      },
    });
  };

  /** Čekající nebo otevřené okno s pandou se zruší (nastavení, odchod). */
  const stopRudy = (): void => {
    if (rudyMoment === null) {
      return;
    }
    rudyMoment = null;
    rudyIsOpen = false;
    options.rudy?.stop();
  };

  /**
   * Od 8. hvězdičky se oslava stáhne dopředu, až skončí pozdrav (v paměti
   * je vedle klidu jen jeden pohyb).
   */
  const prepareCelebrationIfDue = (): void => {
    if (
      phase === 'left' ||
      rudyMoment?.move === 'wave' ||
      progress.earned < PREPARE_CELEBRATION_FROM_STARS
    ) {
      return;
    }
    options.rudy?.prepare('celebrate');
  };

  /** Dítě ťuklo dřív, než se pozdrav stáhl: pozdrav se vynechá. */
  const skipWaitingGreeting = (): void => {
    if (rudyMoment?.move === 'wave' && !rudyIsOpen) {
      stopRudy();
      prepareCelebrationIfDue();
    }
  };

  const endCelebration = (): void => {
    rowCelebratedByRudy = false;
    progress = createStarProgress();
    saveProgress(storage, progress);
    notify({ kind: 'celebrationEnded' });
    startNextProblem();
  };

  const startCelebration = (): void => {
    // Nastavení mezitím mohlo oslavu přerušit.
    if (phase === 'left' || choice !== null) {
      return;
    }
    phase = 'celebrating';
    sounds.play('celebration');
    notify({ kind: 'celebrationStarted' });
    schedule(CELEBRATION_MS, endCelebration);
  };

  /** Plná řada: nejdřív okno s oslavou, po jeho zavření melodie a konfety (#181 AC2). */
  const celebrateWithRudy = (): void => {
    if (rowCelebratedByRudy) {
      startCelebration();
      return;
    }
    showRudy('celebrate', startCelebration);
  };

  const answerCorrectly = (choice: CompareChoice): void => {
    const result = starsAfterTap(progress, 'correct');
    progress = result.progress;
    // Plná řada se uloží taky: po zavření uprostřed oslavy začne prázdná řada.
    saveProgress(storage, progress);
    prepareCelebrationIfDue();
    phase = 'solved';
    sign = signOf(problem);
    sounds.play('correct');
    notify({ kind: 'solved', choice, sign });
    schedule(NEXT_PROBLEM_MS, result.setCompleted ? celebrateWithRudy : startNextProblem);
  };

  /** Podržení kolečka: nastavení s uloženými volbami; přechod ani oslava se nedohrají. */
  const openSettings = (): void => {
    if (phase === 'left' || choice !== null) {
      return;
    }
    cancelPending?.();
    cancelPending = null;
    stopRudy();
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
      celebrateWithRudy();
    } else if (changed || phase !== 'waiting') {
      startNextProblem();
    }
  };

  const detachGear = options.attachSettingsGear?.(openSettings) ?? (() => undefined);
  // Po otevření hry Rudy jednou pozdraví (#181 AC1); po pozdravu se jen hraje.
  showRudy('wave', prepareCelebrationIfDue);

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
      if (phase !== 'waiting' || choice !== null || rudyIsOpen) {
        return 'ignored';
      }
      skipWaitingGreeting();
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
      stopRudy();
      detachGear();
      sounds.stopAll();
    },
  };
}
