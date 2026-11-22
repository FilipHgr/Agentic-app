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
 * Panda Rudy (#181, od #186 jen po 10. hvězdičce, přímo na obrazovce):
 * po 10. hvězdičce nejdřív přiskočí Rudy s oslavou a teprve po jeho
 * odchodu melodie a konfety; dokud je vidět, ťuknutí se nepočítají. Rudyho,
 * který se nestáhne, hra nečeká (jde dál hned). Nastavení Rudyho pošle
 * pryč; po ✓ s plnou řadou přijde Rudy znovu, jen když ho dítě za tuto
 * řadu ještě nevidělo, jinak rovnou konfety.
 *
 * Otázka (#182): každý příklad má otázku „víc“, nebo „míň“ podle nastavení
 * (při střídání losovanou), která se v příkladu nemění ani po chybě. Hlas
 * průvodce otázku řekne, když se změní proti naposledy řečené: po otevření
 * hry, s novým příkladem a po ✓ nastavení. Dokud je vidět Rudy nebo
 * otevřené nastavení, hlas mlčí.
 */

import { STARS_PER_SET, createStarProgress, starsAfterTap } from '../../../shared/logic/stars';
import type { AnswerOutcome, StarProgress } from '../../../shared/logic/stars';
import type { KeyValueStorage } from '../../../shared/storage/keyValueStorage';
import { loadProgress, saveProgress } from '../storage/progressStorage';
import { loadCompareSettings, saveCompareSettings } from '../storage/settingsStorage';
import { HINT_AFTER_MISTAKES } from './compareHint';
import { correctChoice, nextProblem, signOf } from './compareProblems';
import type {
  CompareChoice,
  CompareProblem,
  CompareQuestion,
  CompareSign,
} from './compareProblems';
import { nextQuestion } from './compareQuestion';
import type { CompareQuestionVoice } from './compareQuestion';
import { isSameSettings } from './compareSettings';
import type { CompareSettings } from './compareSettings';
import type { CompareSoundName } from './compareSounds';
import type { CompareRudyContext } from './rudyLines';

export type { CompareSoundName } from './compareSounds';
export type { CompareQuestionVoice } from './compareQuestion';
export type { CompareRudyContext } from './rudyLines';

/** Jak dlouho po správné odpovědi zůstane příklad se znakem, než přijde další. */
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
  /**
   * Rudy oslaví; `context` říká, jestli smí mluvit o „víc“ (#182: ne při
   * otázce míň ani při střídání).
   */
  celebrate(events: CompareRudyEvents, context: CompareRudyContext): void;
  /** Stáhne oslavu dopředu, aby se pak Rudy ukázal hned. */
  prepare(context: CompareRudyContext): void;
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
  /** Hlas průvodce, který řekne otázku (#182); bez něj ji ukáže jen symbol. */
  readonly voice?: CompareQuestionVoice | undefined;
  readonly onChange?: ((change: CompareChange) => void) | undefined;
}

export interface CompareSession {
  problem(): CompareProblem;
  /** Na co se rozehraný příklad ptá (#182): kde je víc, nebo kde je míň. */
  question(): CompareQuestion;
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
  /**
   * Dítě ťuklo na symbol otázky (#182); `true`, když symbol zareaguje
   * a hlas otázku zopakuje.
   */
  tapQuestion(): boolean;
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
  let question: CompareQuestion = nextQuestion(settings.question, random);
  /**
   * Otázka, kterou dítě naposledy opravdu slyšelo od hlasu průvodce; na
   * začátku žádná (#182 AC3).
   */
  let spokenQuestion: CompareQuestion | null = null;
  /** Otázka, kterou hlas právě říká (stahuje nebo hraje); `null`, když nic. */
  let askingQuestion: CompareQuestion | null = null;
  let askCount = 0;
  let phase: Phase = 'waiting';
  let sign: CompareSign | null = null;
  /** Špatná ťuknutí v rozehraném příkladu (#180). */
  let mistakes = 0;
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

  /**
   * Hlas řekne otázku. Za řečenou se počítá, až když nahrávka opravdu
   * hraje; při zamčeném zvuku nebo chybějící nahrávce to hra zkusí při
   * další příležitosti znovu.
   */
  const sayQuestion = (): void => {
    const voice = options.voice;
    if (voice === undefined) {
      return;
    }
    const asked = question;
    askCount += 1;
    const ask = askCount;
    askingQuestion = asked;
    void voice.say(asked).then((played) => {
      if (ask === askCount) {
        askingQuestion = null;
      }
      if (played && phase !== 'left') {
        spokenQuestion = asked;
      }
    });
  };

  /**
   * Hlas řekne otázku, když se změnila proti naposledy slyšené. Jen když
   * dítě může odpovídat: ne při Rudym (ani čekajícím) a nastavení.
   */
  const askQuestionIfChanged = (): void => {
    if (phase !== 'waiting' || choice !== null || rudyMoment !== null) {
      return;
    }
    if (spokenQuestion === question || askingQuestion === question) {
      return;
    }
    sayQuestion();
  };

  const startNextProblem = (): void => {
    problemLook = settings;
    problem = nextProblem(problem, random, settings.maxNumber);
    question = nextQuestion(settings.question, random);
    sign = null;
    mistakes = 0;
    phase = 'waiting';
    notify({ kind: 'problemStarted' });
    askQuestionIfChanged();
  };

  /**
   * Smí Rudy mluvit o „víc“ (oslava „Vždycky poznáš, kde je víc!“)? Jen
   * když se hra ptá jen na víc (#182).
   */
  const rudyContext = (): CompareRudyContext => ({ mayAskMore: settings.question === 'more' });

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
    rudy.celebrate(
      {
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
      },
      rudyContext(),
    );
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
    options.rudy?.prepare(rudyContext());
  };

  /** Rozehraná otázka se zastaví; nedořečená se pak řekne znovu. */
  const stopQuestion = (): void => {
    askCount += 1;
    askingQuestion = null;
    options.voice?.stop();
  };

  /**
   * Dítě ťuklo na symbol otázky (#182): hlas otázku zopakuje. Jde to, když
   * dítě může hrát (ne při nastavení, oslavě ani s Rudym na obrazovce).
   */
  const tapQuestion = (): boolean => {
    if (phase === 'left' || phase === 'celebrating' || choice !== null || rudyMoment !== null) {
      return false;
    }
    sayQuestion();
    return true;
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
    stopQuestion();
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
    } else {
      // Rozehraný příklad zůstal: otázka zazní, jen když ji dítě ještě neslyšelo.
      askQuestionIfChanged();
    }
  };

  const detachGear = options.attachSettingsGear?.(openSettings) ?? (() => undefined);
  // Po otevření hry hlas řekne otázku (#182 AC3); Rudy přijde až po 10. hvězdičce (#186).
  prepareCelebrationIfDue();
  askQuestionIfChanged();

  return {
    problem: () => problem,
    question: () => question,
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
    tapQuestion,
    tap: (tapped) => {
      if (phase !== 'waiting' || choice !== null || rudyIsOpen) {
        return 'ignored';
      }
      if (tapped !== correctChoice(problem, question)) {
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
      stopQuestion();
      detachGear();
      sounds.stopAll();
    },
  };
}
