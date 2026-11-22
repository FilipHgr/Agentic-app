/**
 * Sezení hry Porovnávání (#178, od #187 doplň znaménko), bez Phaseru:
 * příklad „a ☐ b = c“, vyhodnocení ťuknutí na + nebo −, hvězdičky,
 * oslava po 10. hvězdičce, uložení postupu, nastavení pro rodiče za
 * kolečkem (#179) a odchod. Scéna jen kreslí, co sezení ohlásí
 * (`onChange`), a předává ťuknutí.
 *
 * Průběh (#187 AC2): dítě ťukne na správné znaménko → hvězdička a znaménko
 * zůstane v zeleném okénku, za chvíli nový příklad (po 10. hvězdičce
 * nejdřív oslava a prázdná řada). Během přechodu a oslavy se ťuknutí
 * nepočítají. Špatné znaménko nic nebere: zazní tichý tón, okénko se
 * zatřese a vyprázdní a dítě zkouší dál. Ťuknutí na prázdné okénko není
 * odpověď: okénko se zhoupne s jemným tónem a tlačítka + a − se rozsvítí,
 * aby dítě vědělo, čím okénko vyplnit.
 *
 * Nastavení (#179, #187 AC3): podržení kolečka ho otevře s uloženými
 * volbami. Dokud je otevřené, ťuknutí do hry se nepočítají, domeček nejde
 * a nic se nedohrává (přechod na další příklad ani oslava). Ťuknutí na ✓
 * volby uloží; změněné platí od dalšího příkladu, který hned přijde, beze
 * změny zůstane rozehraný příklad. Hvězdičky zůstanou a oslava za plnou
 * řadu přijde vždy, po ✓ znovu od začátku. Bez ✓ (odchod z hry) se nic
 * neuloží.
 *
 * Panda Rudy (#181, od #186 jen po 10. hvězdičce, přímo na obrazovce):
 * po 10. hvězdičce nejdřív přiskočí Rudy s oslavou a teprve po jeho
 * odchodu melodie a konfety; dokud je vidět, ťuknutí se nepočítají. Rudyho,
 * který se nestáhne, hra nečeká (jde dál hned). Nastavení Rudyho pošle
 * pryč; po ✓ s plnou řadou přijde Rudy znovu, jen když ho dítě za tuto
 * řadu ještě nevidělo, jinak rovnou konfety.
 */

import { STARS_PER_SET, createStarProgress, starsAfterTap } from '../../../shared/logic/stars';
import type { AnswerOutcome, StarProgress } from '../../../shared/logic/stars';
import type { KeyValueStorage } from '../../../shared/storage/keyValueStorage';
import { loadProgress, saveProgress } from '../storage/progressStorage';
import { loadCompareSettings, saveCompareSettings } from '../storage/settingsStorage';
import { correctSign, nextProblem } from './compareProblems';
import type { CompareProblem, CompareSign } from './compareProblems';
import { isSameSettings } from './compareSettings';
import type { CompareSettings } from './compareSettings';
import type { CompareSoundName } from './compareSounds';

export type { CompareSoundName } from './compareSounds';

/** Jak dlouho po správné odpovědi zůstane příklad se znaménkem v okénku, než přijde další. */
export const NEXT_PROBLEM_MS = 1400;

/** Jak dlouho trvá oslava s konfetami po 10. hvězdičce. */
export const CELEBRATION_MS = 2600;

/**
 * Od kolikáté hvězdičky v řadě se dopředu stahuje oslava Rudyho, aby po
 * 10. hvězdičce Rudy nečekal (#181, jako v Počítání).
 */
export const PREPARE_CELEBRATION_FROM_STARS = 8;

/** Co se ve hře změnilo; scéna to nakreslí. */
export type CompareChange =
  | { readonly kind: 'problemStarted' }
  | { readonly kind: 'solved'; readonly sign: CompareSign }
  | { readonly kind: 'wrong'; readonly sign: CompareSign }
  | { readonly kind: 'boxTapped' }
  | { readonly kind: 'celebrationStarted' }
  | { readonly kind: 'celebrationEnded' }
  | { readonly kind: 'settingsOpened' }
  | { readonly kind: 'settingsClosed' };

export interface CompareSounds {
  play(name: CompareSoundName): void;
  stopAll(): void;
}

/** Co Rudy hře ohlásí: ukázal se, nebo odešel (i když se neukázal). */
export interface CompareRudyEvents {
  onOpened(): void;
  onClosed(): void;
}

/**
 * Panda Rudy (#181, od #186 přímo na obrazovce a jen po 10. hvězdičce):
 * přiskočí a oslaví. Ukáže se, až se stáhne; když se nestáhne, zavolá
 * rovnou `onClosed` a oslava jde dál bez něj.
 */
export interface CompareRudy {
  /** Rudy oslaví. */
  celebrate(events: CompareRudyEvents): void;
  /** Stáhne oslavu dopředu, aby se pak Rudy ukázal hned. */
  prepare(): void;
  /** Čekající Rudy se neukáže a ten, který je vidět, odejde (nastavení, odchod). */
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
  /** Panda Rudy (#181, #186); bez ní oslava začne hned po 10. hvězdičce. */
  readonly rudy?: CompareRudy | undefined;
  readonly onChange?: ((change: CompareChange) => void) | undefined;
}

export interface CompareSession {
  problem(): CompareProblem;
  starCount(): number;
  /** Znaménko v okénku po správné odpovědi, jinak `null` (prázdné okénko). */
  filledSign(): CompareSign | null;
  isCelebrating(): boolean;
  /** Platné nastavení (po posledním ✓). */
  settings(): CompareSettings;
  settingsOpen(): boolean;
  /** Volby v otevřeném nastavení, při zavřeném `null`. */
  settingsChoice(): CompareSettings | null;
  /** Jde teď domečkem odejít (ne při otevřeném nastavení)? */
  homeAvailable(): boolean;
  /** Rodič ťukl na volbu v otevřeném nastavení. */
  chooseSetting(change: Partial<CompareSettings>): void;
  /** Rodič ťukl na ✓: volby platí od dalšího příkladu, který hned přijde. */
  confirmSettings(): void;
  /** Dítě ťuklo na tlačítko + nebo −. */
  tap(sign: CompareSign): AnswerOutcome;
  /**
   * Dítě ťuklo na prázdné okénko (#187): není to odpověď, okénko se jen
   * zhoupne s jemným tónem a ukáže na tlačítka. `true`, když zareagovalo.
   */
  tapBox(): boolean;
  /** Odchod z hry: zruší naplánované akce a ztiší zvuky. */
  leave(): void;
}

/** Co hra právě dělá: čeká na odpověď, ukazuje vyřešený příklad, slaví, nebo skončila. */
type Phase = 'waiting' | 'solved' | 'celebrating' | 'left';

export function createCompareSession(options: CompareSessionOptions): CompareSession {
  const { storage, random, sounds, timers } = options;
  let progress: StarProgress = loadProgress(storage);
  let settings: CompareSettings = loadCompareSettings(storage);
  /** Volby v otevřeném nastavení; `null`, když je zavřené. */
  let choice: CompareSettings | null = null;
  let problem: CompareProblem = nextProblem(null, random, settings.maxNumber);
  let phase: Phase = 'waiting';
  let filledSign: CompareSign | null = null;
  let cancelPending: (() => void) | null = null;
  /** Rudy, o kterého hra požádala a který ještě neodešel (#181). */
  let rudyMoment: { readonly id: number } | null = null;
  let rudyMomentCount = 0;
  let rudyIsOpen = false;
  /** Vidělo dítě za plnou řadu Rudyho s oslavou? Po ✓ nastavení se pak neopakuje. */
  let rowCelebratedByRudy = false;

  const notify = (change: CompareChange): void => options.onChange?.(change);

  const schedule = (ms: number, callback: () => void): void => {
    cancelPending = timers.after(ms, () => {
      cancelPending = null;
      callback();
    });
  };

  const startNextProblem = (): void => {
    problem = nextProblem(problem, random, settings.maxNumber);
    filledSign = null;
    phase = 'waiting';
    notify({ kind: 'problemStarted' });
  };

  /**
   * Rudy přiskočí s oslavou a po jeho odchodu se zavolá `then`. Bez
   * Rudyho se `then` zavolá hned. Zastavený Rudy (`stopRudy`) už `then`
   * nezavolá.
   */
  const showRudy = (then: () => void): void => {
    const rudy = options.rudy;
    if (rudy === undefined) {
      then();
      return;
    }
    rudyMomentCount += 1;
    const moment = { id: rudyMomentCount };
    rudyMoment = moment;
    const isCurrent = (): boolean => phase !== 'left' && rudyMoment?.id === moment.id;
    rudy.celebrate({
      onOpened: () => {
        if (isCurrent()) {
          rudyIsOpen = true;
          rowCelebratedByRudy = true;
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

  /** Čekající nebo viditelný Rudy se zruší (nastavení, odchod). */
  const stopRudy = (): void => {
    if (rudyMoment === null) {
      return;
    }
    rudyMoment = null;
    rudyIsOpen = false;
    options.rudy?.stop();
  };

  /** Od 8. hvězdičky se oslava stáhne dopředu, aby Rudy po 10. hvězdičce nečekal. */
  const prepareCelebrationIfDue = (): void => {
    if (phase === 'left' || progress.earned < PREPARE_CELEBRATION_FROM_STARS) {
      return;
    }
    options.rudy?.prepare();
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

  /** Plná řada: nejdřív Rudy s oslavou, po jeho odchodu melodie a konfety (#181 AC2, #186 AC3). */
  const celebrateWithRudy = (): void => {
    if (rowCelebratedByRudy) {
      startCelebration();
      return;
    }
    showRudy(startCelebration);
  };

  const answerCorrectly = (sign: CompareSign): void => {
    const result = starsAfterTap(progress, 'correct');
    progress = result.progress;
    // Plná řada se uloží taky: po zavření uprostřed oslavy začne prázdná řada.
    saveProgress(storage, progress);
    prepareCelebrationIfDue();
    phase = 'solved';
    filledSign = sign;
    sounds.play('correct');
    notify({ kind: 'solved', sign });
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
   * příklad už vyřešený; beze změny zůstane rozehraný příklad (#187 AC3).
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

  const tap = (sign: CompareSign): AnswerOutcome => {
    if (phase !== 'waiting' || choice !== null || rudyIsOpen) {
      return 'ignored';
    }
    if (sign !== correctSign(problem)) {
      sounds.play('wrong');
      notify({ kind: 'wrong', sign });
      return 'wrong';
    }
    answerCorrectly(sign);
    return 'correct';
  };

  const tapBox = (): boolean => {
    if (phase !== 'waiting' || choice !== null || rudyIsOpen) {
      return false;
    }
    sounds.play('boxTap');
    notify({ kind: 'boxTapped' });
    return true;
  };

  const detachGear = options.attachSettingsGear?.(openSettings) ?? (() => undefined);
  // Rudy přijde až po 10. hvězdičce (#186); s 8 a víc hvězdičkami se stáhne hned.
  prepareCelebrationIfDue();

  return {
    problem: () => problem,
    starCount: () => progress.earned,
    filledSign: () => filledSign,
    isCelebrating: () => phase === 'celebrating' && choice === null,
    settings: () => settings,
    settingsOpen: () => choice !== null,
    settingsChoice: () => choice,
    homeAvailable: () => phase !== 'left' && choice === null,
    chooseSetting: (change) => {
      if (choice !== null) {
        choice = { ...choice, ...change };
      }
    },
    confirmSettings,
    tap,
    tapBox,
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
