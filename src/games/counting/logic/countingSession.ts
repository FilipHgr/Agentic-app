/**
 * Jeden vstup do Počítání (#68 AC5): rozehraný příklad, chyby, nápověda,
 * hvězdičky, oslava, mapa postupu (#87), nastavení pro rodiče, průvodce
 * a stahování rozpoznávání psaní. Scéna jen kreslí podle sezení a předává mu ťuknutí.
 *
 * Časovače, zvuky, větu průvodce a kolečko nastavení dostane sezení zvenku,
 * aby je při odchodu domečkem (`leave`) mohlo všechny zastavit a odpojit.
 * Po odchodu sezení nic nenaplánuje, nezahraje, neuloží ani nenakreslí.
 * Čistý TypeScript bez Phaseru.
 */

import type { Tone } from '../../../shared/audio/tonePlayer';
import type { KeyValueStorage } from '../../../shared/storage/keyValueStorage';
import { loadMapProgress, saveMapProgress } from '../storage/mapStorage';
import { loadProgress, saveProgress } from '../storage/progressStorage';
import { loadSettingsState, saveSettings } from '../storage/settingsStorage';
import {
  answerRoundFor,
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
import { mapShowMs, stepOnMap } from './progressMap';
import type { MapMove, MapProgress } from './progressMap';
import { createRecognizerLoading } from './recognizerLoading';
import type { LoadRecognizer, RecognizerLoadStatus } from './recognizerLoading';
import { isWritingActive } from './settings';
import type { AnswerInput, GameSettings } from './settings';
import { confirmSettings as confirmSettingsChoice } from './settingsSession';
import { STARS_PER_SET, startNewStarSet, starsAfterTap } from './stars';
import type { StarProgress } from './stars';
import type { DigitRecognizer } from './writingRound';

/** Jak dlouho se po správné odpovědi čeká na nový příklad. */
export const NEXT_PROBLEM_DELAY_MS = 800;

/** Jak dlouho letí hvězdička od odpovědi do řady; oslava začne po doletu. */
export const STAR_FLIGHT_MS = 450;

/** Jak dlouho trvá oslava po zaplnění řady, než přijde nový příklad. */
export const CELEBRATION_MS = 2600;

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

/** Stránka kolem hry: kolečko nastavení v rohu obrazovky. */
export interface SessionPage {
  /** Napojí podržení kolečka na otevření nastavení. Vrátí odpojení. */
  attachSettingsGear(open: () => void): () => void;
}

/**
 * Co se změnilo a má se nakreslit:
 * - `roundStarted` nový příklad (při startu hry se nehlásí),
 * - `celebrationStarted` hvězdička doletěla do plné řady: konfety,
 * - `celebrationEnded` oslava doběhla, řada je prázdná (nový příklad přijde zvlášť),
 * - `celebrationStopped` oslavu přerušilo otevření nastavení,
 * - `starsChanged` jiný počet hvězdiček bez letu (nastavení přerušilo oslavu),
 * - `mapShown` po oslavě se ukázala mapa postupu s krokem `shownMap()` (#87),
 * - `mapHidden` mapa se po chvíli sama zavřela (nový příklad přijde zvlášť),
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
  /** Které tečky nápovědy už dítě spočítalo (#43). */
  dotCounting(): DotCounting;
  starProgress(): StarProgress;
  starCount(): number;
  /** Plná řada: od desáté odpovědi do konce oslavy. */
  celebrating(): boolean;
  /** Kde stojí značka na mapě a kolik map je hotových (#87). */
  mapProgress(): MapProgress;
  /** Krok, který mapa po oslavě právě ukazuje; `null`, když mapa není vidět. */
  shownMap(): MapMove | null;
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

  /** Ťuknutí na číslo číselníku. Po odchodu a při otevřeném panelu `ignored`. */
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
  // Mapa postupu přežije odchod i zavření hry (#87 AC3).
  let map: MapProgress = loadMapProgress(storage);
  /** Krok za právě zaplněnou řadu, který mapa ukáže po oslavě. */
  let moveToShow: MapMove | null = null;
  let shownMove: MapMove | null = null;
  const recognizerLoading = createRecognizerLoading(options.loadRecognizer);
  // Vystřídání příkladů jen pro toto spuštění, nic se neukládá (#94 AC7).
  let rotation: ProblemRotation = startProblemRotation();
  let round: AnswerRound = nextRound();
  let counting: DotCounting = startDotCounting(round.problem);
  let roundInput: AnswerInput = recognizerLoading.answerInput(settings);

  /** Naplánované akce; odchod je zruší všechny. */
  const pending = new Set<() => void>();
  /** Naplánované kroky oslavy a mapy; nastavení je zruší (#45, #87 AC4). */
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

  /** Oslava po zaplnění řady: melodie a konfety, pak nová prázdná řada. */
  function startCelebration(): void {
    // Nastavení mezitím mohlo oslavu přerušit a řadu vyprázdnit (#45).
    if (stars.earned < STARS_PER_SET || settingsAreOpen) {
      return;
    }
    sounds.play(SOUNDS.celebration);
    notify({ kind: 'celebrationStarted' });
    schedule(CELEBRATION_MS, finishCelebration, celebrationSteps);
  }

  function finishCelebration(): void {
    isCelebrating = false;
    stars = startNewStarSet();
    saveStars();
    notify({ kind: 'celebrationEnded' });
    showMap();
  }

  /** Plná řada: krok na mapě se započte a uloží hned, ještě před oslavou (#87 AC4). */
  function stepMap(): void {
    const result = stepOnMap(map);
    map = result.progress;
    moveToShow = result.move;
    saveMapProgress(storage, map);
  }

  /** Po oslavě se na chvíli ukáže mapa s krokem, pak sama zmizí (#87 AC1). */
  function showMap(): void {
    const move = moveToShow;
    moveToShow = null;
    if (move === null) {
      startRound();
      return;
    }
    shownMove = move;
    sounds.play(SOUNDS.mapStep);
    notify({ kind: 'mapShown' });
    schedule(mapShowMs(move), hideMap, celebrationSteps);
  }

  function hideMap(): void {
    shownMove = null;
    notify({ kind: 'mapHidden' });
    startRound();
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
    }
    if (outcome === 'correct') {
      if (result.setCompleted) {
        stepMap();
        isCelebrating = true;
        schedule(STAR_FLIGHT_MS, startCelebration, celebrationSteps);
      } else {
        schedule(NEXT_PROBLEM_DELAY_MS, startRound);
      }
    }
    return outcome;
  }

  function acceptsAnswers(): boolean {
    return !left && !guideIsOpen && !settingsAreOpen;
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
    moveToShow = null;
    if (celebrationSteps.size > 0) {
      cancelAll(celebrationSteps);
      if (shownMove === null) {
        notify({ kind: 'celebrationStopped' });
      } else {
        shownMove = null;
        notify({ kind: 'mapStopped' });
      }
    }
    notify({ kind: 'settingsOpened' });
  }

  const stopWatchingRecognizer = recognizerLoading.onChange((status) =>
    notify({ kind: 'recognizer', status }),
  );
  const detachGear = options.page.attachSettingsGear(openSettings);

  return {
    round: () => round,
    problem: () => round.problem,
    wrongAnswers: () => round.wrongAnswers,
    hintVisible: () => isHintVisible(round),
    hintButtonVisible: () => isHintButtonVisible(round),
    dotCounting: () => counting,
    starProgress: () => stars,
    starCount: () => stars.earned,
    celebrating: () => isCelebrating,
    mapProgress: () => map,
    shownMap: () => shownMove,
    settings: () => settings,
    answerInput: () => roundInput,
    recognizer: () => recognizerLoading.recognizer(),
    guideOpen: () => guideIsOpen,
    settingsOpen: () => settingsAreOpen,
    homeAvailable: () => !left && !guideIsOpen && !settingsAreOpen,
    hasLeft: () => left,

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
      moveToShow = null;
      shownMove = null;
      cancelAll(pending);
      stopWatchingRecognizer();
      detachGear();
      sounds.stopAll();
      voice.stop();
    },
  };
}
