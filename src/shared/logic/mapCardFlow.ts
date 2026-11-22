/**
 * Karta s mapou postupu po plné řadě hvězdiček (#87, #135, #139, #145,
 * #154), společná všem hrám s hvězdičkami (#193): Počítání i Znaménka ji
 * řídí stejně, se stejnými časy. Hra jen řekne, kdy se řada zaplnila
 * (`step`) a kdy po oslavě ukázat kartu (`show`); o krok na mapě, uložení,
 * půlku klíče, zvuky mapy, dolet hvězdiček, zavření ťuknutím i samo po 7 s
 * se postará tahle část.
 *
 * Mapa patří profilu, ne hře (#193 AC1): krok se připočte k mapě, kterou
 * stránka dala (`MapProgressStore`), a ta se čte znovu při každém kroku.
 * Dokončená mapa se hned nahlásí klíčům profilu (`KeyRewards`) počtem
 * dokončených map na společné mapě, takže za stejnou mapu je půlka jen
 * jednou, ať ji dokončila kterákoli hra (#193 AC4). Při otevření hry se
 * počet nahlásí taky, aby se dřív nezapočtené mapy (i z doby před #139)
 * započetly jednou a bez animace.
 *
 * Časovače i zvuky dá hra; po `leave` se nic nenaplánuje, nezahraje ani
 * neuloží. Čistý TypeScript bez Phaseru.
 */

import type { KeyReward, KeyRewards } from './keyRewards';
import {
  KEY_REWARD_APPEAR_MS,
  MARKER_ARRIVAL_MS,
  mapClosableFromMs,
  STARS_LANDED_MS,
} from './mapAnimation';
import type { MapSoundName } from './mapSounds';
import { mapShowMs, stepOnMap } from './progressMap';
import type { MapMove, MapProgress, MapProgressStore } from './progressMap';

/**
 * Za jak dlouho od začátku oslavy (melodie a konfety) se ukáže okno
 * s mapou (#154 AC1: nejvýš 1,5 s; od #170 AC3 se počítá od odchodu
 * Rudyho). Melodie a konfety doběhnou přes okno.
 */
export const CELEBRATION_TO_MAP_MS = 800;

/**
 * Jak dlouho po zavření karty ťuknutím hra nepřijímá odpovědi (#145 AC5),
 * aby rychlé druhé ťuknutí nezadalo odpověď v novém příkladu.
 */
export const MAP_CLOSE_ANSWER_PAUSE_MS = 300;

/**
 * Co udělalo ťuknutí na kartu s mapou (#145 AC4):
 * - `closed` karta se zavřela a hra pokračuje jako po mapě,
 * - `tooEarly` animace ještě běží, karta zůstane (scéna ji jen zhoupne),
 * - `ignored` karta není vidět (nebo po odchodu).
 */
export type MapTapOutcome = 'closed' | 'tooEarly' | 'ignored';

/** Časovače hry; ve scéně čas Phaseru. */
export interface MapCardTimers {
  /** Zavolá `callback` za `ms`. Vrátí funkci, která to zruší. */
  after(ms: number, callback: () => void): () => void;
}

/** Co se s kartou děje; hra to nakreslí a pokračuje podle toho. */
export interface MapCardEvents {
  /** Karta se ukázala s krokem `shownMove()`; hvězdičky z řady k ní teprve letí. */
  onShown(): void;
  /** Hvězdičky doletěly do mapy: řada je prázdná (#154 AC3). */
  onStarsLanded(): void;
  /** Karta se zavřela sama po 7 s, nebo ťuknutím (#145 AC3, AC4). */
  onHidden(): void;
}

export interface MapCardFlowOptions {
  /** Mapa aktivního profilu od stránky (#193); bez stránky jen v paměti. */
  readonly mapProgress: MapProgressStore;
  /** Klíče aktivního profilu (#139); bez nich mapa klíč nedává. */
  readonly keyRewards?: KeyRewards | undefined;
  readonly timers: MapCardTimers;
  /** Zvuky mapy (krok, cíl, půlka klíče), tóny jsou v `mapSounds.ts`. */
  readonly playSound: (name: MapSoundName) => void;
  readonly events: MapCardEvents;
}

export interface MapCardFlow {
  /** Kde stojí značka na mapě profilu a kolik map je hotových (#87). */
  mapProgress(): MapProgress;
  /** Krok, který karta právě ukazuje; `null`, když karta není vidět. */
  shownMove(): MapMove | null;
  /**
   * Co dal cíl, který karta právě ukazuje (#139): `'half'` půlku klíče,
   * `'wholeKey'` druhou půlku do celého klíče. `null` mimo obrazovku cíle
   * a když cíl nic nedal (mapa už započtená, třeba v druhém panelu).
   */
  goalKeyReward(): KeyReward | null;
  /** Čeká krok za plnou řadu na ukázání? */
  hasMoveToShow(): boolean;
  /** Je vidět karta, nebo se právě zavřela ťuknutím, takže se neodpovídá (#145 AC5)? */
  blocksAnswers(): boolean;
  /**
   * Plná řada: krok na mapě se započte a uloží hned, ještě před oslavou
   * (#87 AC4). Došla-li značka do cíle, nahlásí se hned i dokončená mapa,
   * aby přerušení obrazovky cíle půlku klíče nevzalo (#139 AC3).
   */
  step(): void;
  /**
   * Ukáže kartu s krokem za plnou řadu (#154): hvězdičky do ní doletí,
   * značka dojde a karta se po 7 s sama zavře. `false`, když žádný krok
   * nečeká (karta se neukáže).
   */
  show(): boolean;
  /** Ťuknutí kamkoli, když je vidět karta: zavře ji až po doběhnutí animace (#145 AC4). */
  tap(): MapTapOutcome;
  /**
   * Nastavení přerušilo kartu (#87 AC4, #154 AC6): nic se nedohraje
   * a karta zmizí. Když hvězdičky ještě nedoletěly, krok zůstane čekat na
   * nové ukázání. Vrátí, jestli byla karta vidět.
   */
  stop(): boolean;
  /** Krok za plnou řadu se už neukáže (Počítání po přerušení nastavením). */
  forgetMoveToShow(): void;
  /** Nastavení začalo nový příklad: chvíle bez odpovědí po zavření karty skončí hned. */
  resumeAnswers(): void;
  /** Odchod z hry: všechno se zastaví, mapa zůstane uložená. */
  leave(): void;
}

/** Krok a co za něj dal cíl, jak čekají na ukázání. */
interface MoveToShow {
  readonly move: MapMove;
  readonly keyReward: KeyReward | null;
}

export function createMapCardFlow(options: MapCardFlowOptions): MapCardFlow {
  const { mapProgress, timers, playSound, events } = options;
  let left = false;
  let map: MapProgress = mapProgress.load();
  let moveToShow: MoveToShow | null = null;
  let shown: MoveToShow | null = null;
  /** Doletěly už hvězdičky do ukázané karty? */
  let starsLanded = false;
  /** Doběhla už animace ukázané karty, takže ji ťuknutí zavře (#145 AC4)? */
  let closable = false;
  /** Karta se právě zavřela ťuknutím: chvíli se nepřijímají odpovědi (#145 AC5). */
  let answersPaused = false;
  /** Naplánované kroky ukázané karty; přerušení je zruší. */
  const cardSteps = new Set<() => void>();
  let cancelPause: (() => void) | null = null;

  function schedule(ms: number, callback: () => void): void {
    let cancelTimer: () => void = () => undefined;
    const cancel = (): void => {
      cardSteps.delete(cancel);
      cancelTimer();
    };
    cancelTimer = timers.after(ms, () => {
      cardSteps.delete(cancel);
      callback();
    });
    cardSteps.add(cancel);
  }

  function cancelCardSteps(): void {
    for (const cancel of [...cardSteps]) {
      cancel();
    }
  }

  function clearAnswerPause(): void {
    cancelPause?.();
    cancelPause = null;
    answersPaused = false;
  }

  /**
   * Nahlásí stránce počet dokončených map a vrátí, co tím dítě dostalo.
   * Klíče jsou cizí kód stránky: když selžou, dítě hraje dál bez půlky
   * a nevidí chybu (#139 AC6).
   */
  function reportCompletedMaps(completedMaps: number): KeyReward | null {
    if (options.keyRewards === undefined) {
      return null;
    }
    try {
      return options.keyRewards.reportCompletedMaps(completedMaps);
    } catch {
      // Selhání klíčů nesmí zastavit mapu ani další příklad.
      return null;
    }
  }

  function hide(): void {
    shown = null;
    starsLanded = false;
    closable = false;
    events.onHidden();
  }

  function landStars(): void {
    starsLanded = true;
    events.onStarsLanded();
  }

  // Mapy dokončené dřív (i před #139 a v jiné hře) se započtou hned, jednou
  // a bez animace (#139 AC5); dřív započtené mapy klíče nepřidají (AC3).
  reportCompletedMaps(map.completedMaps);

  return {
    mapProgress: () => map,
    shownMove: () => shown?.move ?? null,
    goalKeyReward: () => shown?.keyReward ?? null,
    hasMoveToShow: () => moveToShow !== null,
    blocksAnswers: () => shown !== null || answersPaused,

    step(): void {
      if (left) {
        return;
      }
      // Mapa profilu se čte znovu: krok z jiné hry nebo druhého panelu platí (#193 AC1).
      const result = stepOnMap(mapProgress.load());
      map = result.progress;
      mapProgress.save(map);
      const keyReward = result.move.reachedGoal ? reportCompletedMaps(map.completedMaps) : null;
      moveToShow = { move: result.move, keyReward };
    },

    show(): boolean {
      const toShow = moveToShow;
      moveToShow = null;
      if (left || toShow === null) {
        return false;
      }
      shown = toShow;
      starsLanded = false;
      closable = false;
      events.onShown();
      const { move, keyReward } = toShow;
      schedule(STARS_LANDED_MS, landStars);
      // Zvuk zazní, až po doletu hvězdiček značka na novém místě zastaví
      // (#135 AC2, AC3); melodie cíle tak začne až po melodii oslavy (#154 AC3).
      schedule(MARKER_ARRIVAL_MS, () => playSound(move.reachedGoal ? 'mapGoal' : 'mapStep'));
      if (keyReward !== null) {
        // Tón půlky klíče až po melodii cíle, spolu s půlkou (#139 AC2).
        schedule(KEY_REWARD_APPEAR_MS, () => playSound('keyReward'));
      }
      schedule(mapClosableFromMs(move, keyReward), () => {
        closable = true;
      });
      schedule(mapShowMs(move), hide);
      return true;
    },

    tap(): MapTapOutcome {
      if (left || shown === null) {
        return 'ignored';
      }
      if (!closable) {
        return 'tooEarly';
      }
      // Zbývající kroky karty (zavření po 7 s) se zruší, aby se nic nezdvojilo.
      cancelCardSteps();
      clearAnswerPause();
      answersPaused = true;
      cancelPause = timers.after(MAP_CLOSE_ANSWER_PAUSE_MS, () => {
        cancelPause = null;
        answersPaused = false;
      });
      hide();
      return 'closed';
    },

    stop(): boolean {
      cancelCardSteps();
      const interrupted = shown;
      if (interrupted === null) {
        return false;
      }
      if (!starsLanded) {
        moveToShow = interrupted;
      }
      shown = null;
      starsLanded = false;
      closable = false;
      return true;
    },

    forgetMoveToShow(): void {
      moveToShow = null;
    },

    resumeAnswers: clearAnswerPause,

    leave(): void {
      if (left) {
        return;
      }
      left = true;
      cancelCardSteps();
      clearAnswerPause();
      moveToShow = null;
      shown = null;
      starsLanded = false;
      closable = false;
    },
  };
}
