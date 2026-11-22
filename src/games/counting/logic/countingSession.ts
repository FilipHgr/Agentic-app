/**
 * Jeden vstup do Počítání (#68 AC5): rozehraný příklad, chyby, nápověda,
 * hvězdičky, oslava, mapa postupu (#87), půlka klíče za dokončenou mapu
 * (#139), Rudy s oslavou po 10. hvězdičce (#170, #186), nastavení pro rodiče, průvodce
 * a stahování rozpoznávání psaní. Scéna jen kreslí podle sezení a předává
 * mu ťuknutí.
 *
 * Časovače, zvuky, větu průvodce a kolečko nastavení dostane sezení zvenku,
 * aby je při odchodu domečkem (`leave`) mohlo všechny zastavit a odpojit.
 * Po odchodu sezení nic nenaplánuje, nezahraje, neuloží ani nenakreslí.
 * Čistý TypeScript bez Phaseru.
 */

import type { Tone } from '../../../shared/audio/tonePlayer';
import type { KeyReward, KeyRewards } from '../../../shared/logic/keyRewards';
import type { KeyValueStorage } from '../../../shared/storage/keyValueStorage';
import { equationKey } from '../../../shared/logic/overviewProblems';
import { createActivityLog } from '../../../shared/storage/activityStorage';
import { COUNTING_OVERVIEW } from '../meta';
import { loadProgress, saveProgress } from '../storage/progressStorage';
import { loadSettingsState, saveSettings } from '../storage/settingsStorage';
import {
  answerRoundFor,
  isHintButtonGlowing,
  isHintButtonVisible,
  isHintVisible,
  keepRequestedHint,
  requestHint,
  tapAnswer,
} from './answerRound';
import type { AnswerRound, TapOutcome } from './answerRound';
import { SOUNDS, soundForOutcome } from './answerSounds';
import { countDot, countingTone, startDotCounting } from './dotCounting';
import type { DotCounting } from './dotCounting';
import { drawProblem, startProblemRotation } from './problemRotation';
import type { ProblemRotation } from './problemRotation';
import type { Problem } from './problems';
import { STARS_LANDED_MS } from '../../../shared/logic/mapAnimation';
import { CELEBRATION_TO_MAP_MS, createMapCardFlow } from '../../../shared/logic/mapCardFlow';
import type { MapTapOutcome } from '../../../shared/logic/mapCardFlow';
import type { MapMove, MapProgress, MapProgressStore } from '../../../shared/logic/progressMap';
import { openMapProgress } from '../../../shared/storage/mapProgressStorage';
import { createRecognizerLoading } from './recognizerLoading';
import type { LoadRecognizer, RecognizerLoadStatus } from './recognizerLoading';
import { isWritingActive } from './settings';
import type { AnswerInput, GameSettings } from './settings';
import { confirmSettings as confirmSettingsChoice } from './settingsSession';
import { STARS_PER_SET, startNewStarSet, starsAfterTap } from '../../../shared/logic/stars';
import type { StarProgress } from '../../../shared/logic/stars';
import type { DigitRecognizer } from './writingRound';

/** Jak dlouho se po správné odpovědi čeká na nový příklad. */
export const NEXT_PROBLEM_DELAY_MS = 800;

// Karta s mapou je společná všem hrám s hvězdičkami (#193), časy jsou ve sdílené části.
export {
  CELEBRATION_TO_MAP_MS,
  MAP_CLOSE_ANSWER_PAUSE_MS,
} from '../../../shared/logic/mapCardFlow';
export type { MapTapOutcome } from '../../../shared/logic/mapCardFlow';

/** Jak dlouho letí hvězdička od odpovědi do řady; oslava začne po doletu. */
export const STAR_FLIGHT_MS = 450;

/**
 * Jak dlouho trvá oslava od začátku melodie do doletu hvězdiček z řady
 * do mapy (#154 upřesnění 2); potom je řada prázdná.
 */
export const CELEBRATION_MS = CELEBRATION_TO_MAP_MS + STARS_LANDED_MS;

/**
 * Od kolikáté hvězdičky v řadě se dopředu stahuje oslava Rudyho, aby po
 * 10. hvězdičce Rudy nečekal (#170).
 */
export const PREPARE_CELEBRATION_FROM_STARS = 8;

/** Zvuky hry (tóny odpovědí, teček a oslavy). */
export interface SessionSounds {
  play(tones: readonly Tone[]): void;
  /** Hned ztiší všechno, co hraje. */
  stopAll(): void;
}

/** Věta průvodce nastavením. */
export interface SessionVoice {
  /** Hned ztiší rozmluvenou větu. */
  stop(): void;
}

/** Časovače hry; ve scéně čas Phaseru. */
export interface SessionTimers {
  /** Zavolá `callback` za `ms`. Vrátí funkci, která to zruší. */
  after(ms: number, callback: () => void): () => void;
}

/** Co Rudy hře ohlásí: ukázal se, nebo odešel (i když se neukázal). */
export interface SessionRudyEvents {
  onOpened(): void;
  onClosed(): void;
}

/**
 * Panda Rudy (#170, od #186 přímo na obrazovce a jen po 10. hvězdičce):
 * přiskočí a oslaví. Ukáže se, až se stáhne; když se nestáhne, zavolá
 * rovnou `onClosed` a oslava jde dál bez něj.
 */
export interface SessionRudy {
  celebrate(events: SessionRudyEvents): void;
  /** Stáhne oslavu dopředu, aby se pak Rudy ukázal hned. */
  prepare(): void;
  /** Čekající Rudy se neukáže a ten, který je vidět, odejde (nastavení, odchod). */
  stop(): void;
}

/** Stránka kolem hry: kolečko nastavení v rohu obrazovky. */
export interface SessionPage {
  /** Napojí podržení kolečka na otevření nastavení. Vrátí odpojení. */
  attachSettingsGear(open: () => void): () => void;
}

/**
 * Co se změnilo a má se nakreslit:
 * - `roundStarted` nový příklad (při startu hry se nehlásí),
 * - `celebrationStarted` po odchodu Rudyho (#170 AC3, #186 AC3; bez Rudyho
 *   hned po doletu hvězdičky do plné řady): konfety,
 * - `celebrationEnded` hvězdičky doletěly z řady do mapy, řada je prázdná
 *   (melodie a konfety smí doběhnout samy, nový příklad přijde zvlášť, #154),
 * - `celebrationStopped` oslavu přerušilo otevření nastavení,
 * - `starsChanged` jiný počet hvězdiček bez letu (nastavení přerušilo oslavu),
 * - `mapShown` během oslavy se ukázala mapa postupu s krokem `shownMap()`
 *   (#87, #154): hvězdičky z řady k ní teprve letí,
 * - `mapHidden` karta s mapou se po 7 s sama zavřela, nebo ji dítě zavřelo
 *   ťuknutím (#145; nový příklad přijde zvlášť),
 * - `mapStopped` mapu přerušilo otevření nastavení,
 * - `settingsOpened` / `settingsClosed` nastavení pro rodiče po podržení kolečka a po ✓,
 * - `guideClosed` průvodce skončil „Začít hrát“,
 * - `recognizer` stahování rozpoznávání psaní změnilo stav (#58).
 */
export type SessionChange =
  | { readonly kind: 'roundStarted' }
  | { readonly kind: 'celebrationStarted' }
  | { readonly kind: 'celebrationEnded' }
  | { readonly kind: 'celebrationStopped' }
  | { readonly kind: 'starsChanged' }
  | { readonly kind: 'mapShown' }
  | { readonly kind: 'mapHidden' }
  | { readonly kind: 'mapStopped' }
  | { readonly kind: 'settingsOpened' }
  | { readonly kind: 'settingsClosed' }
  | { readonly kind: 'guideClosed' }
  | { readonly kind: 'recognizer'; readonly status: RecognizerLoadStatus };

export interface CountingSessionOptions {
  readonly storage: KeyValueStorage | undefined;
  readonly random: () => number;
  readonly sounds: SessionSounds;
  readonly voice: SessionVoice;
  readonly timers: SessionTimers;
  readonly page: SessionPage;
  readonly loadRecognizer: LoadRecognizer;
  /**
   * Klíče aktivního profilu od stránky (#139); bez nich mapa klíč nedává
   * a hra jede dál jako dřív.
   */
  readonly keyRewards?: KeyRewards | undefined;
  /**
   * Mapa postupu aktivního profilu od stránky, společná všem hrám (#193);
   * bez ní se mapa pamatuje jen v paměti.
   */
  readonly mapProgress?: MapProgressStore | undefined;
  /**
   * Panda Rudy (#170, #186); bez ní oslava začne hned po doletu hvězdičky.
   */
  readonly rudy?: SessionRudy | undefined;
  /**
   * Dnešní datum podle kalendáře zařízení pro přehled pro rodiče (#183, #192);
   * bez něj hodiny zařízení. Testy ho dávají samy.
   */
  readonly today?: (() => Date) | undefined;
  /** Obrazovka se má překreslit; po odchodu se už nezavolá. */
  readonly onChange: (change: SessionChange) => void;
}

export interface CountingSession {
  /** Rozehrané kolo (příklad, chyby, vyřešení). */
  round(): AnswerRound;
  problem(): Problem;
  wrongAnswers(): number;
  /** Má se ukázat nápověda s tečkami (po tlačítku nebo po 2. chybě)? */
  hintVisible(): boolean;
  /** Je vidět tlačítko nápovědy (#84)? */
  hintButtonVisible(): boolean;
  /** Svítí tlačítko nápovědy po 1. chybě (#155)? */
  hintButtonGlowing(): boolean;
  /** Které tečky nápovědy už dítě spočítalo (#43). */
  dotCounting(): DotCounting;
  starProgress(): StarProgress;
  starCount(): number;
  /** Plná řada: od desáté odpovědi do doletu hvězdiček do mapy (#154). */
  celebrating(): boolean;
  /** Je vidět Rudy (#170, #186)? Během něj se neodpovídá. */
  rudyOpen(): boolean;
  /** Kde stojí značka na mapě a kolik map je hotových (#87). */
  mapProgress(): MapProgress;
  /** Krok, který mapa po oslavě právě ukazuje; `null`, když mapa není vidět. */
  shownMap(): MapMove | null;
  /**
   * Co dal cíl, který mapa právě ukazuje (#139): `'half'` půlku klíče,
   * `'wholeKey'` druhou půlku do celého klíče. `null` mimo obrazovku cíle
   * a když cíl nic nedal (mapa už započtená, třeba v druhém panelu).
   */
  goalKeyReward(): KeyReward | null;
  /** Uložené nastavení rodiče. */
  settings(): GameSettings;
  /** Čím dítě odpovídá v rozehraném příkladu (psaní jen s rozpoznáváním, #58). */
  answerInput(): AnswerInput;
  /** Stažené rozpoznávání psaní, nebo `null`, dokud není. */
  recognizer(): DigitRecognizer | null;
  guideOpen(): boolean;
  settingsOpen(): boolean;
  /** Jde teď odejít domečkem? Ne při otevřeném nastavení, průvodci ani po odchodu. */
  homeAvailable(): boolean;
  hasLeft(): boolean;

  /**
   * Ťuknutí kamkoli mimo kolečko a domeček, když je vidět karta s mapou
   * (#145 AC4): zavře ji až po doběhnutí animace, dřív nic nezmění.
   */
  tapMap(): MapTapOutcome;
  /**
   * Ťuknutí na číslo číselníku. Po odchodu, při otevřeném panelu a během
   * karty s mapou `ignored`.
   */
  tapAnswer(number: number): TapOutcome;
  /**
   * Potvrzení zápisu v okénkách (#42): `answer` je kolo po vyhodnocení
   * a `outcome` výsledek, jako by dítě ťuklo na číslo.
   */
  answerWritten(answer: AnswerRound, outcome: TapOutcome): TapOutcome;
  /** Ťuknutí na tečku nápovědy; vrátí číslo, které tečka dostala, nebo `null`. */
  tapDot(index: number): number | null;
  /**
   * Ťuknutí na tlačítko nápovědy (#84): ukáže tečky, není to odpověď ani
   * chyba. Vrátí `true`, když se nápověda právě ukázala.
   */
  tapHintButton(): boolean;
  /** Stahování rozpoznávání selhalo uprostřed příkladu: odpovídá se číselníkem (#58 AC5). */
  switchToKeypad(answer: AnswerRound): void;
  /** Příklad je nakreslený: první spustí stahování rozpoznávání (#58 AC2). */
  problemDrawn(): void;
  /** ✓ v nastavení; bez `chosen` zůstane uložené nastavení. */
  confirmSettings(chosen?: GameSettings): void;
  /** „Začít hrát“ v průvodci. */
  finishGuide(settings: GameSettings): void;
  /** Odchod do menu: všechno se zastaví, hvězdičky a nastavení zůstanou uložené. */
  leave(): void;
}

export function createCountingSession(options: CountingSessionOptions): CountingSession {
  const { storage, random, sounds, voice, timers } = options;
  const launch = loadSettingsState(storage);
  let settings: GameSettings = launch.settings;
  let guideIsOpen = launch.firstLaunch;
  let settingsAreOpen = false;
  let left = false;
  // Hvězdičky přežijí odchod i zavření hry (načtou se ze zařízení, #38).
  let stars: StarProgress = loadProgress(storage);
  let isCelebrating = false;
  // Vyřešené příklady, chyby a nápověda pro přehled pro rodiče v menu (#183,
  // #184, #192); zápis je společný se Znaménky ve sdílené části.
  const activityLog = createActivityLog({
    storage,
    spec: COUNTING_OVERVIEW,
    today: options.today ?? (() => new Date()),
  });
  /** Rudy, o kterého hra požádala a který ještě neodešel (#170). */
  let rudyMoment: { readonly id: number } | null = null;
  let rudyMomentCount = 0;
  let rudyIsOpen = false;
  // Mapa postupu profilu přežije odchod i zavření hry (#87 AC3) a je
  // společná všem hrám (#193). Karta s mapou po oslavě, půlka klíče za
  // dokončenou mapu a mapy dokončené dřív (#139 AC5) jsou ve sdílené části.
  const mapCard = createMapCardFlow({
    mapProgress: options.mapProgress ?? openMapProgress(undefined),
    keyRewards: options.keyRewards,
    timers,
    playSound: (name) => sounds.play(SOUNDS[name]),
    events: {
      onShown: () => notify({ kind: 'mapShown' }),
      onStarsLanded: () => landStars(),
      onHidden: () => {
        notify({ kind: 'mapHidden' });
        startRound();
      },
    },
  });
  const recognizerLoading = createRecognizerLoading(options.loadRecognizer);
  // Vystřídání příkladů jen pro toto spuštění, nic se neukládá (#94 AC7).
  let rotation: ProblemRotation = startProblemRotation();
  let round: AnswerRound = nextRound();
  let counting: DotCounting = startDotCounting(round.problem);
  let roundInput: AnswerInput = recognizerLoading.answerInput(settings);

  /** Naplánované akce; odchod je zruší všechny. */
  const pending = new Set<() => void>();
  /** Naplánované kroky oslavy před kartou s mapou; nastavení je zruší (#45, #87 AC4). */
  const celebrationSteps = new Set<() => void>();

  function notify(change: SessionChange): void {
    if (!left) {
      options.onChange(change);
    }
  }

  function schedule(ms: number, callback: () => void, group?: Set<() => void>): void {
    let cancelTimer: () => void = () => undefined;
    const cancel = (): void => {
      pending.delete(cancel);
      group?.delete(cancel);
      cancelTimer();
    };
    cancelTimer = timers.after(ms, () => {
      pending.delete(cancel);
      group?.delete(cancel);
      callback();
    });
    pending.add(cancel);
    group?.add(cancel);
  }

  function cancelAll(group: Set<() => void>): void {
    for (const cancel of [...group]) {
      cancel();
    }
  }

  function saveStars(): void {
    saveProgress(storage, { earned: stars.earned });
  }

  function useSettings(chosen: GameSettings): void {
    settings = chosen;
    saveSettings(storage, chosen);
    if (isWritingActive(chosen)) {
      recognizerLoading.writingEnabled();
    }
  }

  /**
   * Další příklad z vystřídání (#94). Chyby ani nápověda losování neovlivní,
   * nový příklad přijde až po vyřešení nebo po potvrzení nastavení.
   */
  function nextRound(): AnswerRound {
    const drawn = drawProblem(rotation, settings, random);
    rotation = drawn.rotation;
    return answerRoundFor(drawn.problem, settings);
  }

  function startRound(): void {
    if (left) {
      return;
    }
    round = nextRound();
    counting = startDotCounting(round.problem);
    roundInput = recognizerLoading.answerInput(settings);
    notify({ kind: 'roundStarted' });
  }

  /**
   * Rudy přiskočí s oslavou a po jeho odchodu se zavolá `then` (#170 AC3,
   * #186). Bez Rudyho se `then` zavolá hned. Zastavený Rudy (`stopRudy`)
   * už `then` nezavolá.
   */
  function showRudy(then: () => void): void {
    const rudy = options.rudy;
    if (rudy === undefined) {
      then();
      return;
    }
    rudyMomentCount += 1;
    const moment = { id: rudyMomentCount };
    rudyMoment = moment;
    const isCurrent = (): boolean => !left && rudyMoment?.id === moment.id;
    rudy.celebrate({
      onOpened: () => {
        if (isCurrent()) {
          rudyIsOpen = true;
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
  }

  /** Čekající nebo viditelný Rudy se zruší (nastavení, odchod). */
  function stopRudy(): void {
    if (rudyMoment === null) {
      return;
    }
    rudyMoment = null;
    rudyIsOpen = false;
    options.rudy?.stop();
  }

  /** Od 8. hvězdičky se oslava stáhne dopředu, aby Rudy po 10. hvězdičce nečekal. */
  function prepareCelebrationIfDue(): void {
    if (left || stars.earned < PREPARE_CELEBRATION_FROM_STARS) {
      return;
    }
    options.rudy?.prepare();
  }

  /**
   * Hvězdička doletěla do plné řady: nejdřív Rudy s oslavou, po jeho
   * odchodu melodie, konfety a karta s mapou (#170 AC3, #186 AC3).
   */
  function celebrateWithRudy(): void {
    if (stars.earned < STARS_PER_SET || settingsAreOpen) {
      return;
    }
    showRudy(startCelebration);
  }

  /**
   * Oslava po zaplnění řady: melodie a konfety a hned za nimi okno s mapou,
   * do kterého hvězdičky z řady odletí (#154 AC1, AC3).
   */
  function startCelebration(): void {
    // Nastavení mezitím mohlo oslavu přerušit a řadu vyprázdnit (#45).
    if (stars.earned < STARS_PER_SET || settingsAreOpen) {
      return;
    }
    sounds.play(SOUNDS.celebration);
    notify({ kind: 'celebrationStarted' });
    schedule(CELEBRATION_TO_MAP_MS, showMap, celebrationSteps);
  }

  /** Hvězdičky doletěly do mapy: oslava končí a řada začíná od 0 (#154 AC3). */
  function landStars(): void {
    isCelebrating = false;
    stars = startNewStarSet();
    saveStars();
    notify({ kind: 'celebrationEnded' });
  }

  /**
   * Během oslavy se ukáže karta s mapou s krokem za plnou řadu, hvězdičky
   * z řady do ní odletí a pak sama zmizí (#87 AC1, #154). Ukázání oslavu
   * nepřeruší: melodie a konfety doběhnou přes okno.
   */
  function showMap(): void {
    if (!mapCard.show()) {
      landStars();
      startRound();
    }
  }

  /**
   * Vyřešený příklad se přičte k dnešku do přehledu pro rodiče (#183 AC1);
   * napoprvé je bez chyby a bez nápovědy. Plné úložiště hru nezastaví.
   */
  function countSolvedProblem(): void {
    const firstTry = round.wrongAnswers === 0 && round.hintRequested !== true;
    activityLog.solved(firstTry, round.problem.operation);
  }

  /**
   * Potvrzená špatná odpověď se zapíše k příkladu do přehledu chyb (#184
   * AC1). Číslo přepsané před ✓ sem nedojde, zrcadlově napsané správné
   * číslo je správná odpověď (#85).
   */
  function countMistake(): void {
    const { first, operation, second } = round.problem;
    activityLog.mistake(equationKey(first, operation, second));
  }

  /** Ťuknutí na tlačítko nápovědy do přehledu chyb (#184 AC5). */
  function countHintUsed(): void {
    activityLog.hintUsed();
  }

  /** Společné vyhodnocení číselníku i psaní: zvuk, hvězdička a další příklad. */
  function applyOutcome(outcome: TapOutcome): TapOutcome {
    const sound = soundForOutcome(outcome);
    if (sound) {
      sounds.play(SOUNDS[sound]);
    }
    const result = starsAfterTap(stars, outcome);
    stars = result.progress;
    if (result.starEarned) {
      saveStars();
      prepareCelebrationIfDue();
    }
    if (outcome === 'wrong') {
      countMistake();
    }
    if (outcome === 'correct') {
      countSolvedProblem();
      if (result.setCompleted) {
        // Krok na mapě se započte a uloží hned, ještě před oslavou (#87 AC4).
        mapCard.step();
        isCelebrating = true;
        schedule(STAR_FLIGHT_MS, celebrateWithRudy, celebrationSteps);
      } else {
        schedule(NEXT_PROBLEM_DELAY_MS, startRound);
      }
    }
    return outcome;
  }

  /**
   * Během oslavy, letu hvězdiček, karty s mapou a Rudyho se odpověď
   * nezadá (#145 AC5, #154 AC5, #186 AC3).
   */
  function acceptsAnswers(): boolean {
    return (
      !left &&
      !rudyIsOpen &&
      !guideIsOpen &&
      !settingsAreOpen &&
      !isCelebrating &&
      !mapCard.blocksAnswers()
    );
  }

  /** Ťuknutí na kartu: po doběhnutí animace ji zavře, jinak nic nezmění (#145 AC4). */
  function tapMap(): MapTapOutcome {
    if (settingsAreOpen) {
      return 'ignored';
    }
    return mapCard.tap();
  }

  /**
   * Podržení kolečka: nastavení se otevře, oslava ani mapa se pod ním
   * nedohrávají a po zavření se neukážou (#45 AC8, #87 AC4). Krok na mapě
   * už je započtený.
   */
  function openSettings(): void {
    if (left || guideIsOpen || settingsAreOpen) {
      return;
    }
    settingsAreOpen = true;
    // Rudy, který se ještě neukázal, patří k oslavě (#170 AC3).
    const celebrationRunning =
      celebrationSteps.size > 0 || rudyMoment !== null || mapCard.shownMove() !== null;
    stopRudy();
    // Krok na mapě je už započtený; karta se po zavření nastavení neukáže.
    const mapWasShown = mapCard.stop();
    mapCard.forgetMoveToShow();
    if (celebrationRunning) {
      cancelAll(celebrationSteps);
      notify({ kind: mapWasShown ? 'mapStopped' : 'celebrationStopped' });
    }
    notify({ kind: 'settingsOpened' });
  }

  const stopWatchingRecognizer = recognizerLoading.onChange((status) =>
    notify({ kind: 'recognizer', status }),
  );
  const detachGear = options.page.attachSettingsGear(openSettings);
  // Hra otevřená s 8 a více hvězdičkami v řadě: oslava se stáhne dopředu hned.
  prepareCelebrationIfDue();

  return {
    round: () => round,
    problem: () => round.problem,
    wrongAnswers: () => round.wrongAnswers,
    hintVisible: () => isHintVisible(round),
    hintButtonVisible: () => isHintButtonVisible(round),
    hintButtonGlowing: () => isHintButtonGlowing(round),
    dotCounting: () => counting,
    starProgress: () => stars,
    starCount: () => stars.earned,
    celebrating: () => isCelebrating,
    rudyOpen: () => rudyIsOpen,
    mapProgress: () => mapCard.mapProgress(),
    shownMap: () => mapCard.shownMove(),
    goalKeyReward: () => mapCard.goalKeyReward(),
    settings: () => settings,
    answerInput: () => roundInput,
    recognizer: () => recognizerLoading.recognizer(),
    guideOpen: () => guideIsOpen,
    settingsOpen: () => settingsAreOpen,
    homeAvailable: () => !left && !guideIsOpen && !settingsAreOpen,
    hasLeft: () => left,
    tapMap,

    tapAnswer(number: number): TapOutcome {
      if (!acceptsAnswers()) {
        return 'ignored';
      }
      const result = tapAnswer(round, number);
      round = result.round;
      return applyOutcome(result.outcome);
    },

    answerWritten(answer: AnswerRound, outcome: TapOutcome): TapOutcome {
      if (!acceptsAnswers()) {
        return 'ignored';
      }
      round = keepRequestedHint(answer, round);
      return applyOutcome(outcome);
    },

    tapDot(index: number): number | null {
      if (!acceptsAnswers()) {
        return null;
      }
      const result = countDot(round, counting, index);
      counting = result.counting;
      if (result.countedNumber !== null) {
        sounds.play([countingTone(result.countedNumber)]);
      }
      return result.countedNumber;
    },

    tapHintButton(): boolean {
      if (!acceptsAnswers() || !isHintButtonVisible(round)) {
        return false;
      }
      round = requestHint(round);
      sounds.play(SOUNDS.hint);
      countHintUsed();
      return true;
    },

    switchToKeypad(answer: AnswerRound): void {
      if (left) {
        return;
      }
      round = keepRequestedHint(answer, round);
      roundInput = 'keypad';
    },

    problemDrawn(): void {
      if (!left) {
        recognizerLoading.problemDrawn();
      }
    },

    confirmSettings(chosen: GameSettings = settings): void {
      if (left || !settingsAreOpen) {
        return;
      }
      const result = confirmSettingsChoice({ open: true, choice: chosen }, settings, {
        earned: stars.earned,
      });
      useSettings(result.settings);
      settingsAreOpen = false;
      // Nastavení přerušilo oslavu: dokončí se jako po oslavě (nová prázdná řada).
      if (result.progress.earned !== stars.earned) {
        isCelebrating = false;
        stars = { earned: result.progress.earned };
        saveStars();
        notify({ kind: 'starsChanged' });
      }
      notify({ kind: 'settingsClosed' });
      if (result.startNewProblem) {
        // Nový příklad hned; čekající příklad po odpovědi by přišel podruhé.
        cancelAll(pending);
        // Zrušená chvíle po zavření karty nesmí odpovědi zablokovat natrvalo.
        mapCard.resumeAnswers();
        startRound();
      }
    },

    finishGuide(chosen: GameSettings): void {
      if (left || !guideIsOpen) {
        return;
      }
      guideIsOpen = false;
      useSettings(chosen);
      notify({ kind: 'guideClosed' });
      startRound();
    },

    leave(): void {
      if (left) {
        return;
      }
      left = true;
      isCelebrating = false;
      mapCard.leave();
      stopRudy();
      cancelAll(pending);
      stopWatchingRecognizer();
      detachGear();
      sounds.stopAll();
      voice.stop();
    },
  };
}
