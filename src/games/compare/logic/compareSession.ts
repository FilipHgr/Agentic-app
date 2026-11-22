/**
 * Sezení hry Znaménka (#178, od #187 doplň znaménko, od #190 i < = >),
 * bez Phaseru: příklad „a ☐ b = c“ s + − nebo „a ☐ b“ s < = > podle řady
 * „Znaménka“ v nastavení, vyhodnocení ťuknutí na znaménko, hvězdičky,
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
 * Psaní prstem (#188, volba „Odpověď“ v nastavení): okénko je plocha na
 * psaní. Rozpoznané znaménko dítě potvrdí ✓ a vyhodnotí se stejně jako
 * ťuknutí na tlačítko (`tap`). Zápis, který není + ani −, se nepočítá:
 * okénko se zhoupne s jemným tónem a vyzve psát znovu (`writingRejected`).
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
 *
 * Mapa postupu (#193): po odchodu Rudyho melodie a konfety a za
 * `CELEBRATION_TO_MAP_MS` karta se společnou mapou profilu, stejně a se
 * stejnými časy jako v Počítání (sdílené `mapCardFlow.ts`): hvězdičky
 * z řady doletí do karty, značka dojde o krok dál, v cíli půlka klíče,
 * karta se zavře ťuknutím po doběhnutí animace nebo sama po 7 s a teprve
 * potom přijde nový příklad. Krok se započte a uloží hned po 10.
 * hvězdičce. Nastavení kartu zavře; když hvězdičky ještě nedoletěly,
 * ukáže se karta po ✓ znovu s oslavou, jinak přijde nový příklad.
 *
 * Přehled pro rodiče v menu (#192): vyřešený příklad se zapíše k dnešku,
 * napoprvé, když dítě u příkladu ještě neťuklo na špatné znaménko; každé
 * špatné znaménko je chyba u příkladu. Ťuknutí na prázdné okénko
 * a nerozpoznaný zápis chyba nejsou.
 */

import type { KeyReward, KeyRewards } from '../../../shared/logic/keyRewards';
import { CELEBRATION_TO_MAP_MS, createMapCardFlow } from '../../../shared/logic/mapCardFlow';
import type { MapTapOutcome } from '../../../shared/logic/mapCardFlow';
import { MAP_SHOW_MS } from '../../../shared/logic/progressMap';
import type { MapMove, MapProgress, MapProgressStore } from '../../../shared/logic/progressMap';
import { STARS_PER_SET, createStarProgress, starsAfterTap } from '../../../shared/logic/stars';
import { openMapProgress } from '../../../shared/storage/mapProgressStorage';
import type { AnswerOutcome, StarProgress } from '../../../shared/logic/stars';
import { comparisonKey, missingSignKey } from '../../../shared/logic/overviewProblems';
import { createActivityLog } from '../../../shared/storage/activityStorage';
import type { KeyValueStorage } from '../../../shared/storage/keyValueStorage';
import { COMPARE_OVERVIEW } from '../meta';
import { loadProgress, saveProgress } from '../storage/progressStorage';
import { loadCompareSettings, saveCompareSettings } from '../storage/settingsStorage';
import { correctSign, nextProblem, signsFor } from './compareProblems';
import type { CompareProblem, CompareSign } from './compareProblems';
import { isSameSettings } from './compareSettings';
import type { CompareSettings } from './compareSettings';
import type { CompareSoundName } from './compareSounds';

export type { CompareSoundName } from './compareSounds';

/** Jak dlouho po správné odpovědi zůstane příklad se znaménkem v okénku, než přijde další. */
export const NEXT_PROBLEM_MS = 1400;

export {
  CELEBRATION_TO_MAP_MS,
  MAP_CLOSE_ANSWER_PAUSE_MS,
} from '../../../shared/logic/mapCardFlow';
export type { MapTapOutcome } from '../../../shared/logic/mapCardFlow';

/**
 * Jak dlouho trvá oslava po odchodu Rudyho, když dítě kartu s mapou
 * nezavře ťuknutím: melodie a konfety, za `CELEBRATION_TO_MAP_MS` karta
 * s mapou a ta je vidět 7 s (#145 AC3, #193 AC2).
 */
export const CELEBRATION_MS = CELEBRATION_TO_MAP_MS + MAP_SHOW_MS;

/**
 * Od kolikáté hvězdičky v řadě se dopředu stahuje oslava Rudyho, aby po
 * 10. hvězdičce Rudy nečekal (#181, jako v Počítání).
 */
export const PREPARE_CELEBRATION_FROM_STARS = 8;

/**
 * Co se ve hře změnilo; scéna to nakreslí. U oslavy (#193):
 * `celebrationStarted` melodie a konfety, `mapShown` karta s mapou
 * (`shownMap()`), do které teprve letí hvězdičky z řady,
 * `celebrationEnded` hvězdičky doletěly a řada je prázdná, `mapHidden`
 * karta se zavřela (nový příklad přijde zvlášť), `mapStopped` kartu
 * zavřelo nastavení.
 */
export type CompareChange =
  | { readonly kind: 'problemStarted' }
  | { readonly kind: 'solved'; readonly sign: CompareSign }
  | { readonly kind: 'wrong'; readonly sign: CompareSign }
  | { readonly kind: 'boxTapped' }
  | { readonly kind: 'writeAgain' }
  | { readonly kind: 'celebrationStarted' }
  | { readonly kind: 'celebrationEnded' }
  | { readonly kind: 'mapShown' }
  | { readonly kind: 'mapHidden' }
  | { readonly kind: 'mapStopped' }
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
  /** Klíče aktivního profilu od stránky (#139, #193); bez nich mapa klíč nedává. */
  readonly keyRewards?: KeyRewards | undefined;
  /** Mapa postupu aktivního profilu, společná všem hrám (#193); bez ní jen v paměti. */
  readonly mapProgress?: MapProgressStore | undefined;
  readonly onChange?: ((change: CompareChange) => void) | undefined;
  /**
   * Dnešní datum podle kalendáře zařízení pro přehled pro rodiče (#192);
   * bez něj hodiny zařízení. Testy ho dávají samy.
   */
  readonly today?: (() => Date) | undefined;
}

export interface CompareSession {
  problem(): CompareProblem;
  starCount(): number;
  /** Znaménko v okénku po správné odpovědi, jinak `null` (prázdné okénko). */
  filledSign(): CompareSign | null;
  isCelebrating(): boolean;
  /** Kde stojí značka na společné mapě profilu a kolik map je hotových (#193). */
  mapProgress(): MapProgress;
  /** Krok, který právě ukazuje karta s mapou; `null`, když karta není vidět. */
  shownMap(): MapMove | null;
  /** Co dal cíl, který karta právě ukazuje (#139), jinak `null`. */
  goalKeyReward(): KeyReward | null;
  /**
   * Je příklad i s ovládáním (tlačítka znamének, plocha na psaní) schovaný,
   * protože je vidět karta s mapou (#193)? Jinak by vyčníval po stranách karty.
   */
  problemHidden(): boolean;
  /**
   * Ťuknutí kamkoli mimo kolečko a domeček, když je vidět karta s mapou
   * (#145 AC4): zavře ji až po doběhnutí animace, dřív nic nezmění.
   */
  tapMap(): MapTapOutcome;
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
  /**
   * Dítě ťuklo na tlačítko se znaménkem (+ −, u „a ☐ b“ < = >), nebo
   * potvrdilo ✓ napsané znaménko (#188). Znaménko, které k druhu příkladu
   * nepatří, se nepočítá (`ignored`).
   */
  tap(sign: CompareSign): AnswerOutcome;
  /**
   * Dítě ťuklo na prázdné okénko (#187): není to odpověď, okénko se jen
   * zhoupne s jemným tónem a ukáže na tlačítka. `true`, když zareagovalo.
   */
  tapBox(): boolean;
  /**
   * Napsaný zápis se nerozpoznal (#188 AC3): není to chyba, okénko se
   * zhoupne s jemným tónem a vyzve psát znovu. `true`, když zareagovalo.
   */
  writingRejected(): boolean;
  /** Odchod z hry: zruší naplánované akce a ztiší zvuky. */
  leave(): void;
}

/** Co hra právě dělá: čeká na odpověď, ukazuje vyřešený příklad, slaví, nebo skončila. */
type Phase = 'waiting' | 'solved' | 'celebrating' | 'left';

/** Příklad v záznamu chyb přehledu pro rodiče (#192): „7?5=2“ nebo „7?5“. */
function overviewKeyOf(problem: CompareProblem): string {
  return problem.kind === 'relation'
    ? comparisonKey(problem.a, problem.b)
    : missingSignKey(problem.a, problem.b, problem.result);
}

export function createCompareSession(options: CompareSessionOptions): CompareSession {
  const { storage, random, sounds, timers } = options;
  let progress: StarProgress = loadProgress(storage);
  let settings: CompareSettings = loadCompareSettings(storage);
  /** Volby v otevřeném nastavení; `null`, když je zavřené. */
  let choice: CompareSettings | null = null;
  let problem: CompareProblem = nextProblem(null, random, settings.maxNumber, settings.signKind);
  let phase: Phase = 'waiting';
  let filledSign: CompareSign | null = null;
  /** Ťuklo dítě u rozehraného příkladu na špatné znaménko? Pak není napoprvé (#192). */
  let mistakeInProblem = false;
  const activityLog = createActivityLog({
    storage,
    spec: COMPARE_OVERVIEW,
    today: options.today ?? (() => new Date()),
  });
  let cancelPending: (() => void) | null = null;
  /** Rudy, o kterého hra požádala a který ještě neodešel (#181). */
  let rudyMoment: { readonly id: number } | null = null;
  let rudyMomentCount = 0;
  let rudyIsOpen = false;
  /** Vidělo dítě za plnou řadu Rudyho s oslavou? Po ✓ nastavení se pak neopakuje. */
  let rowCelebratedByRudy = false;

  const notify = (change: CompareChange): void => options.onChange?.(change);

  /** Hvězdičky doletěly do karty s mapou: řada začíná od 0 (#154 AC3). */
  const landStars = (): void => {
    rowCelebratedByRudy = false;
    progress = createStarProgress();
    saveProgress(storage, progress);
    notify({ kind: 'celebrationEnded' });
  };

  // Karta s mapou po oslavě, krok na společné mapě profilu a půlka klíče za
  // dokončenou mapu jsou stejné jako v Počítání (#193 AC2, AC4).
  const mapCard = createMapCardFlow({
    mapProgress: options.mapProgress ?? openMapProgress(undefined),
    keyRewards: options.keyRewards,
    timers,
    playSound: (name) => sounds.play(name),
    events: {
      onShown: () => notify({ kind: 'mapShown' }),
      onStarsLanded: landStars,
      onHidden: () => {
        notify({ kind: 'mapHidden' });
        startNextProblem();
      },
    },
  });

  const schedule = (ms: number, callback: () => void): void => {
    cancelPending = timers.after(ms, () => {
      cancelPending = null;
      callback();
    });
  };

  const startNextProblem = (): void => {
    problem = nextProblem(problem, random, settings.maxNumber, settings.signKind);
    filledSign = null;
    mistakeInProblem = false;
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

  /** Karta s krokem za plnou řadu; bez kroku (nemělo by nastat) rovnou prázdná řada. */
  const showMap = (): void => {
    if (phase === 'left' || choice !== null) {
      return;
    }
    if (!mapCard.show()) {
      landStars();
      startNextProblem();
    }
  };

  const startCelebration = (): void => {
    // Nastavení mezitím mohlo oslavu přerušit.
    if (phase === 'left' || choice !== null) {
      return;
    }
    phase = 'celebrating';
    sounds.play('celebration');
    notify({ kind: 'celebrationStarted' });
    schedule(CELEBRATION_TO_MAP_MS, showMap);
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
    if (result.setCompleted) {
      // Krok na mapě se započte a uloží hned, ještě před oslavou (#87 AC4).
      mapCard.step();
    }
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
    // Karta s mapou se zavře; krok na mapě je už započtený (#193).
    const mapWasShown = mapCard.stop();
    choice = settings;
    if (phase === 'celebrating') {
      // Oslava se po ✓ přehraje znovu od začátku.
      sounds.stopAll();
    }
    if (mapWasShown) {
      notify({ kind: 'mapStopped' });
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
    if (phase !== 'waiting' || choice !== null || rudyIsOpen || mapCard.blocksAnswers()) {
      return 'ignored';
    }
    // Znaménko jiného druhu (třeba pozdě potvrzené + u „a ☐ b“) není odpověď.
    if (!signsFor(problem).includes(sign)) {
      return 'ignored';
    }
    if (sign !== correctSign(problem)) {
      mistakeInProblem = true;
      activityLog.mistake(overviewKeyOf(problem));
      sounds.play('wrong');
      notify({ kind: 'wrong', sign });
      return 'wrong';
    }
    activityLog.solved(!mistakeInProblem);
    answerCorrectly(sign);
    return 'correct';
  };

  const tapBox = (): boolean => {
    if (phase !== 'waiting' || choice !== null || rudyIsOpen || mapCard.blocksAnswers()) {
      return false;
    }
    sounds.play('boxTap');
    notify({ kind: 'boxTapped' });
    return true;
  };

  const writingRejected = (): boolean => {
    if (phase !== 'waiting' || choice !== null || rudyIsOpen || mapCard.blocksAnswers()) {
      return false;
    }
    sounds.play('boxTap');
    notify({ kind: 'writeAgain' });
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
    mapProgress: () => mapCard.mapProgress(),
    shownMap: () => mapCard.shownMove(),
    goalKeyReward: () => mapCard.goalKeyReward(),
    problemHidden: () => mapCard.shownMove() !== null,
    tapMap: () => (choice === null ? mapCard.tap() : 'ignored'),
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
    writingRejected,
    leave: () => {
      if (phase === 'left') {
        return;
      }
      phase = 'left';
      // Volby bez ✓ se zahodí, nic se neuloží (#179 AC6).
      choice = null;
      cancelPending?.();
      cancelPending = null;
      mapCard.leave();
      stopRudy();
      detachGear();
      sounds.stopAll();
    },
  };
}
