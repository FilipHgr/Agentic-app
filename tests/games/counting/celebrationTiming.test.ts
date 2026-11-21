import { describe, expect, it } from 'vitest';

import { SOUNDS, soundLengthSeconds } from '../../../src/games/counting/logic/answerSounds';
import {
  STAR_FLIGHT_MS,
  createCountingSession,
} from '../../../src/games/counting/logic/countingSession';
import type {
  CountingSession,
  SessionChange,
} from '../../../src/games/counting/logic/countingSession';
import { MAP_STEPS, serializeMapProgress } from '../../../src/games/counting/logic/progressMap';
import type { MapProgress } from '../../../src/games/counting/logic/progressMap';
import { STARS_PER_SET } from '../../../src/games/counting/logic/stars';
import { MAP_PROGRESS_KEY } from '../../../src/games/counting/storage/mapStorage';
import type { Tone } from '../../../src/shared/audio/tonePlayer';
import type { KeyRewards } from '../../../src/shared/logic/keyRewards';
import type { KeyValueStorage } from '../../../src/shared/storage/keyValueStorage';
import { DeviceStorage } from '../../shared/profileFixtures';
import { countingStorageOf, keysOf, openPage } from './keyRewardFakes';
import { seededRandom } from './seededRandom';
import {
  FakePage,
  FakeRecognizerLoader,
  FakeRudy,
  FakeTimers,
  FakeVoice,
  KEYPAD_SETTINGS,
  WRITING_SETTINGS,
  testDevice,
} from './sessionFakes';
import type { TestDevice } from './sessionFakes';
import type { GameSettings } from '../../../src/games/counting/logic/settings';

/**
 * Testy k #154 AC1–AC6 na časové ose oslavy v sezení hry: po zavření okna
 * s oslavou (#170 AC3) začne oslava do 0,5 s a okno s mapou (#145)
 * se ukáže do 1,5 s, mezi tím není pauza delší než 0,5 s (AC1, AC2).
 * Hvězdičky z řady odletí do mapy, řada je pak prázdná, a melodie cíle ani
 * klíč se nepřekrývají s melodií oslavy (AC3). Bez ťuknutí přijde další
 * příklad nejvýš 8,5 s po zavření okna s oslavou (AC4). Během oslavy a letu se
 * neodpovídá (AC5), přerušení nastavením nebo domečkem nic nedohraje
 * a další plná řada průběh zopakuje (AC6).
 * Čas se měří po 1 ms, falešné časovače, stránka a okno s pandou jsou ze
 * `sessionFakes.ts`, klíče profilu z `keyRewardFakes.ts`.
 *
 * #170 AC3: po 10. hvězdičce se nejdřív ukáže okno s oslavou (Rudy). „Od
 * 10. odpovědi“ z #154 se od #170 počítá od zavření okna s oslavou:
 * `answerTenth` nechá okno `RUDY_OPEN_MS` otevřené, hodiny vynuluje
 * a okno zavře. Ostatní časy karty a klíče se počítají od otevření karty.
 *
 * Navržené rozhraní (navíc k dnešnímu, bez nových metod sezení):
 * - `starCount()` je při ukázání okna ještě 10 (hvězdičky jsou v řadě
 *   a odtud odletí), po doletu do mapy 0,
 * - `celebrating()` platí od 10. odpovědi do doletu hvězdiček do mapy,
 * - `mapShown` přijde nejpozději 1,5 s po zavření okna s oslavou, i když melodie
 *   a konfety oslavy ještě běží (`celebrationEnded` smí přijít až po ní),
 * - zvuk zastávky, melodie cíle a tón klíče zazní až po doletu hvězdiček.
 * Časová osa letu je v `mapAnimation.ts` (`starFlight.test.ts`).
 *
 * Ručně se kontroluje (AC2, AC7): že konfety opravdu padají až do ukázání
 * okna a přes něj (kreslí scéna), let je vidět na první pohled, běží
 * v 60 fps a otočení zařízení během letu nezastaví odpočet (scéna jen
 * překreslí polohy, časy běží v sezení).
 */

/** Nejpozději tehdy začnou konfety a melodie oslavy, ms od zavření okna s oslavou (AC1). */
const CELEBRATION_START_LIMIT_MS = 500;

/** Nejpozději tehdy se ukáže okno s mapou, ms od zavření okna s oslavou (AC1). */
const CARD_LIMIT_MS = 1500;

/** Nejdelší chvíle, kdy se nic nehýbe ani nezní (AC2). */
const LONGEST_PAUSE_MS = 500;

/** Nejdéle letí hvězdičky do mapy, ms od ukázání okna (AC3). */
const FLIGHT_LIMIT_MS = 600;

/** Nejpozději tehdy jde okno zavřít ťuknutím, ms od ukázání okna (AC3). */
const CLOSABLE_LIMIT_MS = 5600;

/** Jak dlouho je okno otevřené bez ťuknutí (AC4, #145). */
const CARD_OPEN_MS = 7000;

/** Nejpozději tehdy přijde bez ťuknutí další příklad, ms od zavření okna s oslavou (AC4). */
const NEXT_PROBLEM_LIMIT_MS = 8500;

/** Do kdy se po zavření okna s oslavou čeká, ms. */
const WATCH_MS = 12_000;

/** Jak dlouho je okno s oslavou otevřené (bez hlasu 3,5 s, #169). */
const RUDY_OPEN_MS = 3500;

/** Co se stalo a kdy (ms od zavření okna s oslavou). */
interface Timed<T> {
  readonly value: T;
  readonly atMs: number;
}

/** Sezení s hodinami: změny obrazovky a zvuky se zapisují s časem. */
interface TimedCounting {
  readonly session: CountingSession;
  readonly timers: FakeTimers;
  readonly page: FakePage;
  readonly rudy: FakeRudy;
  /** Kolik ms uběhlo od zavření okna s oslavou (posouvá `tick`). */
  readonly clock: { nowMs: number };
  readonly changes: Array<Timed<SessionChange['kind']>>;
  readonly sounds: Array<Timed<readonly Tone[]>>;
  stopped: number;
}

function enterTimed(storage: KeyValueStorage, keyRewards?: KeyRewards): TimedCounting {
  const timers = new FakeTimers();
  const page = new FakePage();
  const rudy = new FakeRudy();
  const clock = { nowMs: 0 };
  const changes: Array<Timed<SessionChange['kind']>> = [];
  const sounds: Array<Timed<readonly Tone[]>> = [];
  const test: TimedCounting = {
    session: undefined as unknown as CountingSession,
    timers,
    page,
    rudy,
    clock,
    changes,
    sounds,
    stopped: 0,
  };
  const session = createCountingSession({
    storage,
    random: seededRandom(154),
    sounds: {
      play: (tones) => sounds.push({ value: tones, atMs: clock.nowMs }),
      stopAll: () => {
        test.stopped += 1;
      },
    },
    voice: new FakeVoice(),
    timers,
    page,
    loadRecognizer: new FakeRecognizerLoader().load,
    keyRewards,
    rudy,
    onChange: (change) => changes.push({ value: change.kind, atMs: clock.nowMs }),
  });
  // Pozdrav po otevření hry (#170 AC2) se ukáže a zavře, pak se hraje.
  rudy.openPending();
  rudy.close();
  return Object.assign(test, { session });
}

/** Posune čas o `ms` po 1 ms, aby se každá změna zapsala s přesným časem. */
function tick(test: TimedCounting, ms = 1): void {
  for (let step = 0; step < ms; step += 1) {
    test.clock.nowMs += 1;
    test.timers.advance(1);
  }
}

/** Posouvá čas po 1 ms, dokud neplatí `condition`; vrátí čas od zavření okna s oslavou, nebo `null`. */
function tickUntil(
  test: TimedCounting,
  condition: () => boolean,
  limitMs = WATCH_MS,
): number | null {
  while (test.clock.nowMs <= limitMs) {
    if (condition()) {
      return test.clock.nowMs;
    }
    tick(test);
  }
  return null;
}

/**
 * Dítě vyřeší 9 příkladů a ťukne správně na 10.; po doletu hvězdičky se
 * ukáže okno s oslavou (#170 AC3). Před jeho zavřením začnou hodiny od nuly
 * a zápis změn a zvuků začne znovu.
 */
function answerTenth(test: TimedCounting): void {
  for (let solved = 0; solved < STARS_PER_SET - 1; solved += 1) {
    test.session.tapAnswer(test.session.problem().result);
    test.timers.runAll();
  }
  test.session.tapAnswer(test.session.problem().result);
  tick(test, STAR_FLIGHT_MS);
  expect(test.rudy.waitingMove(), 'po doletu 10. hvězdičky okno s oslavou').toBe('celebrate');
  test.rudy.openPending();
  tick(test, RUDY_OPEN_MS);
  test.changes.length = 0;
  test.sounds.length = 0;
  test.clock.nowMs = 0;
  test.rudy.close();
}

function firstChange(test: TimedCounting, kind: SessionChange['kind']): number | null {
  return test.changes.find((change) => change.value === kind)?.atMs ?? null;
}

function soundTimes(test: TimedCounting, tones: readonly Tone[]): number[] {
  return test.sounds.filter((sound) => sound.value === tones).map((sound) => sound.atMs);
}

function lengthMs(tones: readonly Tone[]): number {
  return soundLengthSeconds(tones) * 1000;
}

function deviceWithMap(map: MapProgress, settings: GameSettings = KEYPAD_SETTINGS): TestDevice {
  const device = testDevice(settings);
  device.storage.setItem(MAP_PROGRESS_KEY, serializeMapProgress(map));
  return device;
}

interface RowCase {
  readonly label: string;
  readonly reachedGoal: boolean;
  readonly open: () => TimedCounting;
}

/** Plná řada na zastávce, v cíli s půlkou, s celým klíčem a bez klíčů stránky. */
const ROW_CASES: readonly RowCase[] = [
  {
    label: 'krok na zastávku',
    reachedGoal: false,
    open: () => enterTimed(testDevice().storage),
  },
  {
    label: 'cíl s půlkou klíče',
    reachedGoal: true,
    open: () => {
      const page = openPage(new DeviceStorage());
      return enterTimed(
        countingStorageOf(page, { step: MAP_STEPS - 1, completedMaps: 0 }),
        keysOf(page),
      );
    },
  },
  {
    label: 'cíl s celým klíčem',
    reachedGoal: true,
    open: () => {
      const page = openPage(new DeviceStorage());
      return enterTimed(
        countingStorageOf(page, { step: MAP_STEPS - 1, completedMaps: 1 }),
        keysOf(page),
      );
    },
  },
  {
    label: 'cíl bez klíčů stránky',
    reachedGoal: true,
    open: () => enterTimed(deviceWithMap({ step: MAP_STEPS - 1, completedMaps: 0 }).storage),
  },
];

/** Hlavní body časové osy jedné plné řady bez ťuknutí, ms od zavření okna s oslavou. */
interface RowTimeline {
  readonly celebrationAt: number | null;
  readonly cardAt: number | null;
  /** Kdy je řada prázdná (hvězdičky doletěly do mapy). */
  readonly rowEmptyAt: number | null;
  readonly cardHiddenAt: number | null;
  readonly nextProblemAt: number | null;
}

/** Dítě zaplní řadu, na okno neťukne a počká na další příklad. */
function watchRow(test: TimedCounting): RowTimeline {
  answerTenth(test);
  const cardAt = tickUntil(test, () => test.session.shownMap() !== null);
  const rowEmptyAt = tickUntil(test, () => test.session.starCount() === 0);
  const nextProblemAt = tickUntil(
    test,
    () => test.session.shownMap() === null && !test.session.round().solved,
  );
  return {
    celebrationAt: firstChange(test, 'celebrationStarted'),
    cardAt,
    rowEmptyAt,
    cardHiddenAt: firstChange(test, 'mapHidden'),
    nextProblemAt,
  };
}

/** Kdy se v čisté plné řadě (bez přerušení) ukáže okno a kdy doletí hvězdičky. */
function probeTimes(open: () => TimedCounting): { cardAt: number; rowEmptyAt: number } {
  const timeline = watchRow(open());
  if (timeline.cardAt === null || timeline.rowEmptyAt === null) {
    throw new Error('okno s mapou se neukázalo nebo řada nezůstala prázdná');
  }
  return { cardAt: timeline.cardAt, rowEmptyAt: timeline.rowEmptyAt };
}

describe('#154 AC1: oslava začne hned a okno s mapou se ukáže do 1,5 s', () => {
  it('konfety a melodie oslavy začnou nejpozději 0,5 s po zavření okna s oslavou', () => {
    for (const { label, open } of ROW_CASES) {
      const test = open();
      answerTenth(test);
      tickUntil(test, () => test.session.shownMap() !== null);

      const confetti = firstChange(test, 'celebrationStarted');
      const melody = soundTimes(test, SOUNDS.celebration);
      expect(confetti, `${label}: konfety`).not.toBeNull();
      expect(confetti ?? Infinity, `${label}: konfety`).toBeLessThanOrEqual(
        CELEBRATION_START_LIMIT_MS,
      );
      expect(melody, `${label}: melodie oslavy jednou`).toHaveLength(1);
      expect(melody[0] ?? Infinity, `${label}: melodie`).toBeLessThanOrEqual(
        CELEBRATION_START_LIMIT_MS,
      );
    }
  });

  it('okno s mapou se ukáže nejpozději 1,5 s po zavření okna s oslavou, na zastávce i v cíli', () => {
    for (const { label, reachedGoal, open } of ROW_CASES) {
      const test = open();
      answerTenth(test);
      const cardAt = tickUntil(test, () => test.session.shownMap() !== null);
      expect(cardAt, label).not.toBeNull();
      expect(cardAt ?? Infinity, label).toBeLessThanOrEqual(CARD_LIMIT_MS);
      expect(test.session.shownMap()?.reachedGoal, label).toBe(reachedGoal);
      expect(firstChange(test, 'mapShown'), `${label}: okno se nakreslí`).toBe(cardAt);
    }
  });

  it('okno nepřijde dřív než oslava: nejdřív konfety a melodie, potom mapa', () => {
    for (const { label, open } of ROW_CASES) {
      const test = open();
      const { celebrationAt, cardAt } = watchRow(test);
      expect(celebrationAt, label).not.toBeNull();
      expect(cardAt ?? -1, label).toBeGreaterThanOrEqual(celebrationAt ?? Infinity);
    }
  });

  it('konfety smí doběhnout přes okno: ukázání okna oslavu nepřeruší ani neztiší', () => {
    for (const { label, open } of ROW_CASES) {
      const test = open();
      watchRow(test);
      expect(firstChange(test, 'celebrationStopped'), `${label}: konfety nezmizí naráz`).toBeNull();
      expect(test.stopped, `${label}: melodie oslavy se neztiší`).toBe(0);
    }
  });
});

describe('#154 AC2: po zavření okna s oslavou do ukázání mapy není pauza delší než 0,5 s', () => {
  it('v každé chvíli po zavření okna s oslavou něco zní: melodie oslavy až do mapy', () => {
    for (const { label, open } of ROW_CASES) {
      const test = open();
      const { cardAt } = watchRow(test);
      expect(cardAt, label).not.toBeNull();
      const until = cardAt ?? 0;

      // Od zavření okna s oslavou se počítají jen zvuky, každý po celou
      // svou délku (let hvězdičky do řady proběhl už před oknem). Konfety
      // se nepočítají, jejich délku určuje scéna (ruční kontrola).
      const busy: Array<readonly [number, number]> = [];
      for (const sound of test.sounds) {
        busy.push([sound.atMs, sound.atMs + lengthMs(sound.value)]);
      }

      let pause = 0;
      let longest = 0;
      for (let ms = 0; ms <= until; ms += 1) {
        const moving = busy.some(([from, to]) => ms >= from && ms <= to);
        pause = moving ? 0 : pause + 1;
        longest = Math.max(longest, pause);
      }
      expect(longest, `${label}: nejdelší pauza do ukázání okna`).toBeLessThanOrEqual(
        LONGEST_PAUSE_MS,
      );
    }
  });
});

describe('#154 AC3: hvězdičky odletí do mapy, teprve potom jde značka', () => {
  it('při ukázání okna je v řadě 10 hvězdiček, nejvýš 0,6 s potom je řada prázdná', () => {
    for (const { label, open } of ROW_CASES) {
      const test = open();
      answerTenth(test);
      const cardAt = tickUntil(test, () => test.session.shownMap() !== null);
      expect(cardAt, label).not.toBeNull();
      expect(test.session.starCount(), `${label}: hvězdičky jsou ještě v řadě`).toBe(STARS_PER_SET);

      const rowEmptyAt = tickUntil(test, () => test.session.starCount() === 0);
      expect(rowEmptyAt, label).not.toBeNull();
      expect((rowEmptyAt ?? Infinity) - (cardAt ?? 0), `${label}: let`).toBeLessThanOrEqual(
        FLIGHT_LIMIT_MS,
      );
      expect(test.session.celebrating(), `${label}: po doletu oslava skončila`).toBe(false);
    }
  });

  it('po doletu zůstane řada prázdná až do dalšího příkladu a nová začne od 0', () => {
    for (const { label, open } of ROW_CASES) {
      const test = open();
      const { rowEmptyAt } = watchRow(test);
      expect(rowEmptyAt, label).not.toBeNull();
      expect(test.session.starCount(), `${label}: nový příklad s prázdnou řadou`).toBe(0);

      test.timers.runAll();
      test.session.tapAnswer(test.session.problem().result);
      expect(test.session.starCount(), `${label}: první hvězdička nové řady`).toBe(1);
    }
  });

  it('zvuk zastávky a melodie cíle zazní, až když hvězdičky doletí a značka dojde', () => {
    for (const { label, reachedGoal, open } of ROW_CASES) {
      const test = open();
      const { rowEmptyAt } = watchRow(test);
      const arrival = soundTimes(test, reachedGoal ? SOUNDS.mapGoal : SOUNDS.mapStep);
      expect(arrival, label).toHaveLength(1);
      expect(arrival[0] ?? -1, `${label}: ne během letu`).toBeGreaterThan(rowEmptyAt ?? Infinity);
    }
  });

  it('melodie cíle a tón půlky klíče se nepřekrývají s melodií oslavy', () => {
    for (const { label, reachedGoal, open } of ROW_CASES) {
      if (!reachedGoal) {
        continue;
      }
      const test = open();
      watchRow(test);
      const celebration = soundTimes(test, SOUNDS.celebration)[0];
      expect(celebration, label).toBeDefined();
      const celebrationEnd = (celebration ?? Infinity) + lengthMs(SOUNDS.celebration);
      for (const tones of [SOUNDS.mapGoal, SOUNDS.keyReward]) {
        for (const at of soundTimes(test, tones)) {
          expect(at, `${label}: začne až po melodii oslavy`).toBeGreaterThanOrEqual(celebrationEnd);
        }
      }
      expect(soundTimes(test, SOUNDS.mapGoal), `${label}: melodie cíle zazní`).toHaveLength(1);
    }
  });

  it('ťuknutím jde okno zavřít nejpozději 5,6 s od ukázání, i v cíli s celým klíčem', () => {
    for (const { label, open } of ROW_CASES) {
      const test = open();
      answerTenth(test);
      const cardAt = tickUntil(test, () => test.session.shownMap() !== null) ?? 0;
      tick(test, CLOSABLE_LIMIT_MS);
      expect(test.clock.nowMs - cardAt, label).toBe(CLOSABLE_LIMIT_MS);
      expect(test.session.tapMap(), label).toBe('closed');
    }
  });
});

describe('#154 AC4: okno se zavře samo 7 s od ukázání a další příklad přijde do 8,5 s', () => {
  it('bez ťuknutí se okno zavře samo 7 s od ukázání, na zastávce i v cíli', () => {
    for (const { label, open } of ROW_CASES) {
      const { cardAt, cardHiddenAt } = watchRow(open());
      expect(cardHiddenAt, label).not.toBeNull();
      expect((cardHiddenAt ?? 0) - (cardAt ?? 0), label).toBe(CARD_OPEN_MS);
    }
  });

  it('bez ťuknutí uplyne od zavření okna s oslavou do dalšího příkladu nejvýš 8,5 s', () => {
    for (const { label, open } of ROW_CASES) {
      const test = open();
      const { nextProblemAt } = watchRow(test);
      expect(nextProblemAt, label).not.toBeNull();
      expect(nextProblemAt ?? Infinity, label).toBeLessThanOrEqual(NEXT_PROBLEM_LIMIT_MS);
      expect(firstChange(test, 'roundStarted'), `${label}: nový příklad se nakreslí`).toBe(
        nextProblemAt,
      );
    }
  });

  it('ťuknutí po doběhu animace okno zavře dřív a další příklad přijde hned po něm', () => {
    for (const { label, open } of ROW_CASES) {
      const test = open();
      answerTenth(test);
      const cardAt = tickUntil(test, () => test.session.shownMap() !== null) ?? 0;
      const closedAt = tickUntil(test, () => test.session.tapMap() === 'closed');
      expect(closedAt, label).not.toBeNull();
      expect((closedAt ?? Infinity) - cardAt, label).toBeLessThan(CARD_OPEN_MS);
      expect(test.session.shownMap(), label).toBeNull();
      expect(test.session.round().solved, `${label}: nový příklad`).toBe(false);
    }
  });
});

describe('#154 AC5: během oslavy a letu se neodpovídá a hvězdička nepřibude', () => {
  it('číselník, psaní, nápověda ani tečky nic nezadají po zavření okna s oslavou do doletu hvězdiček', () => {
    for (const map of [
      { step: 0, completedMaps: 0 },
      { step: MAP_STEPS - 1, completedMaps: 0 },
    ]) {
      const device = deviceWithMap(map, WRITING_SETTINGS);
      const test = enterTimed(device.storage);
      answerTenth(test);
      // Zvuk 10. odpovědi samotné se nepočítá, hlídají se jen další odpovědi.
      const tenthSounds = test.sounds.length;
      const progress = test.session.mapProgress();
      const problem = test.session.problem();
      const label = `krok ${map.step} → ${map.step + 1}`;

      while (test.session.starCount() !== 0 && test.clock.nowMs <= WATCH_MS) {
        const where = `${label}, ${test.clock.nowMs} ms`;
        const round = test.session.round();
        expect(test.session.tapAnswer(round.problem.result), `${where}: číselník`).toBe('ignored');
        expect(test.session.answerWritten(round, 'correct'), `${where}: psaní`).toBe('ignored');
        expect(test.session.tapHintButton(), `${where}: nápověda`).toBe(false);
        expect(test.session.tapDot(0), `${where}: tečka`).toBeNull();
        expect(test.session.starCount(), `${where}: hvězdička nepřibude`).toBe(STARS_PER_SET);
        tick(test, 25);
      }

      expect(test.session.starCount(), `${label}: řada je po letu prázdná`).toBe(0);
      expect(test.session.mapProgress(), `${label}: krok se nezdvojí`).toEqual(progress);
      expect(test.session.problem(), `${label}: příklad se nezměnil`).toEqual(problem);
      const later = test.sounds.slice(tenthSounds).map((sound) => sound.value);
      expect(later, `${label}: žádná další správná odpověď`).not.toContain(SOUNDS.correct);
      expect(later, `${label}: žádná chyba`).not.toContain(SOUNDS.wrong);
    }
  });

  it('ťuknutí během letu hvězdiček okno nezavře, jen se zhoupne', () => {
    for (const { label, open } of ROW_CASES) {
      const test = open();
      answerTenth(test);
      tickUntil(test, () => test.session.shownMap() !== null);
      const move = test.session.shownMap();

      while (test.session.starCount() !== 0 && test.clock.nowMs <= WATCH_MS) {
        expect(test.session.tapMap(), `${label}, ${test.clock.nowMs} ms`).toBe('tooEarly');
        expect(test.session.shownMap(), `${label}, ${test.clock.nowMs} ms`).toEqual(move);
        tick(test, 10);
      }
      expect(test.session.starCount(), label).toBe(0);
    }
  });
});

describe('#154 AC6: přerušení během oslavy nebo letu nic nedohraje', () => {
  /** Kdy přerušit: uprostřed oslavy před oknem a uprostřed letu hvězdiček. */
  function interruptionMoments(open: () => TimedCounting): Array<{ label: string; atMs: number }> {
    const { cardAt, rowEmptyAt } = probeTimes(open);
    const celebrationStart = Math.min(CELEBRATION_START_LIMIT_MS, cardAt);
    return [
      { label: 'během oslavy', atMs: Math.floor((celebrationStart + cardAt) / 2) },
      { label: 'během letu', atMs: Math.floor((cardAt + rowEmptyAt) / 2) },
    ];
  }

  function goalWithKeys(): { open: () => TimedCounting; halves: () => number } {
    const page = openPage(new DeviceStorage());
    return {
      open: () =>
        enterTimed(
          countingStorageOf(page, { step: MAP_STEPS - 1, completedMaps: 0 }),
          keysOf(page),
        ),
      halves: () => keysOf(page).balance().halves,
    };
  }

  it('nastavení během oslavy nebo letu: nic se nedohraje, krok i klíč zůstanou a okno se neukáže', () => {
    const probe = goalWithKeys();
    for (const { label, atMs } of interruptionMoments(probe.open)) {
      const keys = goalWithKeys();
      const test = keys.open();
      answerTenth(test);
      tick(test, atMs);
      const soundsBefore = test.sounds.length;

      test.page.holdGear();
      expect(test.session.shownMap(), `${label}: okno zmizí`).toBeNull();
      expect(test.session.tapMap(), `${label}: ťuknutí při nastavení`).toBe('ignored');
      tick(test, 1000);
      test.session.confirmSettings();
      tick(test, WATCH_MS - test.clock.nowMs);

      const shownLater = test.changes.filter(
        (change) => change.value === 'mapShown' && change.atMs > atMs,
      );
      expect(shownLater, `${label}: okno se už neukáže`).toHaveLength(0);
      expect(test.session.shownMap(), label).toBeNull();
      const later = test.sounds.slice(soundsBefore).map((sound) => sound.value);
      for (const tones of [SOUNDS.mapStep, SOUNDS.mapGoal, SOUNDS.keyReward]) {
        expect(later, `${label}: zvuk mapy nezazní`).not.toContain(tones);
      }
      expect(test.session.mapProgress(), `${label}: krok zůstane`).toEqual({
        step: MAP_STEPS,
        completedMaps: 1,
      });
      expect(keys.halves(), `${label}: půlka klíče zůstane`).toBe(1);
      expect(test.session.starCount(), `${label}: řada je prázdná`).toBe(0);
      expect(test.session.round().solved, `${label}: hraje se dál`).toBe(false);
    }
  });

  it('odchod domečkem během oslavy nebo letu: nic se nedohraje a příště se okno neukáže', () => {
    const probe = goalWithKeys();
    for (const { label, atMs } of interruptionMoments(probe.open)) {
      const page = openPage(new DeviceStorage());
      const storage = countingStorageOf(page, { step: MAP_STEPS - 1, completedMaps: 0 });
      const test = enterTimed(storage, keysOf(page));
      answerTenth(test);
      tick(test, atMs);
      const changesBefore = test.changes.length;
      const soundsBefore = test.sounds.length;

      test.session.leave();
      tick(test, WATCH_MS - test.clock.nowMs);

      expect(test.changes.length, `${label}: nic se nepřekreslí`).toBe(changesBefore);
      expect(test.sounds.length, `${label}: nic nezazní`).toBe(soundsBefore);
      expect(test.session.shownMap(), label).toBeNull();

      const next = enterTimed(storage, keysOf(page));
      expect(next.session.mapProgress(), `${label}: krok zůstane`).toEqual({
        step: MAP_STEPS,
        completedMaps: 1,
      });
      expect(next.session.starCount(), `${label}: řada začne od 0`).toBe(0);
      expect(keysOf(page).balance().halves, `${label}: půlka klíče zůstane`).toBe(1);
      tick(next, WATCH_MS);
      expect(firstChange(next, 'mapShown'), `${label}: okno se samo neukáže`).toBeNull();
    }
  });

  it('další plná řada průběh zopakuje: po zavření okna s oslavou oslava do 0,5 s, mapa do 1,5 s, příklad do 8,5 s', () => {
    const test = enterTimed(testDevice().storage);
    const steps: number[] = [];
    for (let row = 0; row < MAP_STEPS + 1; row += 1) {
      const timeline = watchRow(test);
      const where = `${row + 1}. řada`;
      expect(timeline.celebrationAt ?? Infinity, where).toBeLessThanOrEqual(
        CELEBRATION_START_LIMIT_MS,
      );
      expect(timeline.cardAt ?? Infinity, where).toBeLessThanOrEqual(CARD_LIMIT_MS);
      expect(timeline.rowEmptyAt ?? Infinity, where).toBeLessThanOrEqual(
        (timeline.cardAt ?? 0) + FLIGHT_LIMIT_MS,
      );
      expect(timeline.nextProblemAt ?? Infinity, where).toBeLessThanOrEqual(NEXT_PROBLEM_LIMIT_MS);
      steps.push(test.session.mapProgress().step);
      test.timers.runAll();
    }
    expect(steps, 'každá řada posune značku o krok, po cíli začne nová mapa').toEqual([1, 2, 3, 1]);
  });

  it('po přerušení nastavením během letu další plná řada průběh zopakuje', () => {
    const open = (): TimedCounting => enterTimed(testDevice().storage);
    const [, duringFlight] = interruptionMoments(open);
    const test = open();
    answerTenth(test);
    tick(test, duringFlight?.atMs ?? 0);
    test.page.holdGear();
    test.session.confirmSettings();
    test.timers.runAll();

    const timeline = watchRow(test);

    expect(timeline.celebrationAt ?? Infinity).toBeLessThanOrEqual(CELEBRATION_START_LIMIT_MS);
    expect(timeline.cardAt ?? Infinity).toBeLessThanOrEqual(CARD_LIMIT_MS);
    expect(timeline.nextProblemAt ?? Infinity).toBeLessThanOrEqual(NEXT_PROBLEM_LIMIT_MS);
    expect(test.session.mapProgress().step).toBe(2);
  });
});
