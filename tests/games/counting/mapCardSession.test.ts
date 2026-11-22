import { describe, expect, it } from 'vitest';

import { SOUNDS } from '../../../src/games/counting/logic/answerSounds';
import { MAP_CLOSE_ANSWER_PAUSE_MS } from '../../../src/games/counting/logic/countingSession';
import { mapClosableFromMs } from '../../../src/shared/logic/mapAnimation';
import { MAP_STEPS, serializeMapProgress } from '../../../src/shared/logic/progressMap';
import type { MapMove, MapProgress } from '../../../src/shared/logic/progressMap';
import { layoutProgressMapCard } from '../../../src/shared/logic/progressMapCard';
import { MAP_PROGRESS_KEY, loadMapProgress } from '../../../src/shared/storage/mapProgressStorage';
import { IPAD_WINDOWS, PHONE_PORTRAIT_WINDOWS, viewportOf } from '../../shared/viewportFixtures';
import { DeviceStorage } from '../../shared/profileFixtures';
import { enterCountingOn, fillRow, keysOf, openPage, waitForMap } from './keyRewardFakes';
import type { KeyedCounting } from './keyRewardFakes';
import { WRITING_SETTINGS, correctAnswerOf, enterCounting, testDevice } from './sessionFakes';
import type { TestDevice, TestSession } from './sessionFakes';

/**
 * Testy k #145 AC3–AC6 na úrovni sezení hry: karta s mapou po oslavě
 * zůstane otevřená 7 s (AC3), ťuknutí ji zavře až po doběhnutí animace
 * a dřívější ťuknutí nic nezmění ani netrestá (AC4), zavírací ťuknutí
 * nezadá odpověď a druhé nic nezdvojí (AC5), nastavení, domeček a další
 * plná řada (AC6). Falešné časovače, zvuky a stránka jsou ze
 * `sessionFakes.ts` a `keyRewardFakes.ts`, čas se posouvá po 1 ms.
 *
 * Navržené rozhraní `CountingSession` (navíc k dnešnímu):
 * - `tapMap(): MapTapOutcome`, `type MapTapOutcome = 'closed' | 'tooEarly'
 *   | 'ignored'`: dítě ťuklo kamkoli mimo kolečko a domeček, když je vidět
 *   karta. `'closed'` karta se zavřela a hra pokračuje jako po mapě,
 *   `'tooEarly'` animace ještě běží, karta zůstane a scéna ji jen zhoupne,
 *   `'ignored'` karta není vidět (nebo je otevřené nastavení či po odchodu).
 * Od kdy ťuknutí kartu zavře, říká `mapClosableFromMs` (`mapCardTiming.test.ts`).
 *
 * Ručně se kontroluje: zhoupnutí karty do 250 ms, že scéna zavírací
 * ťuknutí nepředá číselníku, tlačítku nápovědy ani okénku na psaní
 * (rozdělení dotyku je ve scéně) a že otočení zařízení nevynuluje odpočet
 * (scéna jen překreslí kartu, časy běží v sezení).
 */

/** Jak dlouho je karta otevřená, když na ni dítě neťukne (AC3). */
const CARD_OPEN_MS = 7000;

/** Posouvá čas po 1 ms, dokud neplatí `condition`; vrátí uběhlé ms, nebo `null`. */
function advanceUntil(test: TestSession, condition: () => boolean, limitMs: number): number | null {
  for (let elapsed = 0; elapsed <= limitMs; elapsed += 1) {
    if (condition()) {
      return elapsed;
    }
    test.timers.advance(1);
  }
  return null;
}

/** Zařízení s uloženou mapou (bez klíčů stránky). */
function deviceWithMap(map: MapProgress): TestDevice {
  const device = testDevice();
  device.storage.setItem(MAP_PROGRESS_KEY, serializeMapProgress(map));
  return device;
}

/** Ukázaná karta: co ukazuje a od kolika ms ji ťuknutí zavře. */
interface ShownCard {
  readonly move: MapMove;
  readonly closableMs: number;
}

/** Dítě zaplní řadu a počká, až se karta ukáže (čas stojí přesně v okamžiku ukázání). */
function showCard(test: TestSession): ShownCard {
  fillRow(test);
  waitForMap(test);
  const move = test.session.shownMap();
  if (move === null) {
    throw new Error('karta se neukázala');
  }
  return { move, closableMs: mapClosableFromMs(move, test.session.goalKeyReward()) };
}

/** Karta na zastávce (start → 1. zastávka), bez klíčů. */
function stopCard(): { test: TestSession; device: TestDevice; card: ShownCard } {
  const device = testDevice();
  const test = enterCounting(device);
  return { test, device, card: showCard(test) };
}

/** Karta v cíli s klíči stránky; `completedMaps` 0 dá půlku, 1 celý klíč. */
function goalCardWithKeys(completedMaps: number): { test: KeyedCounting; card: ShownCard } {
  const page = openPage(new DeviceStorage());
  const test = enterCountingOn(page, { step: MAP_STEPS - 1, completedMaps });
  return { test, card: showCard(test) };
}

/** Karta v cíli, za který se půlka nepřičte (hra bez klíčů stránky). */
function goalCardWithoutKey(): { test: TestSession; card: ShownCard } {
  const test = enterCounting(deviceWithMap({ step: MAP_STEPS - 1, completedMaps: 0 }));
  return { test, card: showCard(test) };
}

interface CardCase {
  readonly label: string;
  readonly open: () => { test: TestSession; card: ShownCard };
}

const CARD_CASES: readonly CardCase[] = [
  { label: 'krok na zastávku', open: stopCard },
  { label: 'cíl s půlkou klíče', open: () => goalCardWithKeys(0) },
  { label: 'cíl s celým klíčem', open: () => goalCardWithKeys(1) },
  { label: 'cíl bez půlky klíče', open: goalCardWithoutKey },
];

describe('#145 AC3: karta zůstane otevřená 7 s a pak se sama zavře', () => {
  for (const { label, open } of CARD_CASES) {
    it(`${label}: karta je vidět 7 s, pak se zavře a přijde nový příklad s prázdnou řadou`, () => {
      const { test } = open();
      test.timers.advance(CARD_OPEN_MS - 10);
      expect(test.session.shownMap(), 'těsně před 7 s je karta vidět').not.toBeNull();

      const closedAfter = advanceUntil(test, () => test.session.shownMap() === null, 20);
      expect(closedAfter, 'karta se zavře sama kolem 7 s').not.toBeNull();
      test.timers.runAll();
      expect(test.session.round().solved, 'nový příklad').toBe(false);
      expect(test.session.starCount(), 'prázdná řada').toBe(0);
    });
  }

  it('cíl s půlkou: půlka je u cíle vidět, dokud je karta otevřená', () => {
    const { test } = goalCardWithKeys(0);
    test.timers.advance(CARD_OPEN_MS - 10);
    expect(test.session.goalKeyReward()).toBe('half');
  });
});

describe('#145 AC4: ťuknutí kartu zavře až po doběhnutí animace', () => {
  for (const { label, open } of CARD_CASES) {
    it(`${label}: ťuknutí těsně před koncem animace kartu nezavře, ťuknutí po ní ano`, () => {
      const { test, card } = open();
      test.timers.advance(card.closableMs - 1);
      expect(test.session.tapMap(), 'ještě během animace').toBe('tooEarly');
      expect(test.session.shownMap(), 'karta zůstala otevřená').toEqual(card.move);

      test.timers.advance(1);
      expect(test.session.tapMap(), 'po doběhnutí animace').toBe('closed');
      expect(test.session.shownMap(), 'karta se zavřela').toBeNull();
    });
  }

  it('ťuknutí hned po ukázání karty nezavře a karta zůstane otevřená', () => {
    for (const { label, open } of CARD_CASES) {
      const { test, card } = open();
      expect(test.session.tapMap(), label).toBe('tooEarly');
      expect(test.session.shownMap(), label).toEqual(card.move);
    }
  });

  it('předčasné ťuknutí nevynuluje odpočet: karta se zavře sama v 7 s od ukázání, ne později', () => {
    for (const { label, open } of CARD_CASES) {
      const { test, card } = open();
      let elapsed = 0;
      while (elapsed + 250 < card.closableMs) {
        expect(test.session.tapMap(), `${label}, ${elapsed} ms`).toBe('tooEarly');
        test.timers.advance(250);
        elapsed += 250;
      }
      test.timers.advance(CARD_OPEN_MS - elapsed - 10);
      expect(test.session.shownMap(), `${label}: těsně před 7 s`).not.toBeNull();
      const closedAfter = advanceUntil(test, () => test.session.shownMap() === null, 20);
      expect(closedAfter, `${label}: zavře se kolem 7 s od ukázání`).not.toBeNull();
    }
  });

  it('předčasné ťuknutí netrestá: žádný zvuk chyby, krok, klíč ani příklad se nezmění', () => {
    const page = openPage(new DeviceStorage());
    const test = enterCountingOn(page, { step: MAP_STEPS - 1, completedMaps: 0 });
    showCard(test);
    const progress = test.session.mapProgress();
    const problem = test.session.problem();
    const reward = test.session.goalKeyReward();
    const soundsBefore = test.sounds.played.length;

    for (let tap = 0; tap < 5; tap += 1) {
      expect(test.session.tapMap()).toBe('tooEarly');
    }

    const newSounds = test.sounds.played.slice(soundsBefore);
    expect(newSounds, 'ťuknutí nezahraje zvuk chyby').not.toContain(SOUNDS.wrong);
    expect(test.session.wrongAnswers()).toBe(0);
    expect(test.session.mapProgress()).toEqual(progress);
    expect(test.session.problem()).toEqual(problem);
    expect(test.session.goalKeyReward()).toBe(reward);
    expect(keysOf(page).balance().halves).toBe(1);
  });

  it('ťuknutí, když karta není vidět, nic neudělá', () => {
    const test = enterCounting(testDevice());
    const problem = test.session.problem();
    const changes = test.changes();

    expect(test.session.tapMap()).toBe('ignored');

    expect(test.session.problem()).toEqual(problem);
    expect(test.changes()).toBe(changes);
  });

  it('po zavření ťuknutím hra pokračuje jako po mapě: nový příklad a prázdná řada', () => {
    for (const { label, open } of CARD_CASES) {
      const { test, card } = open();
      test.timers.advance(card.closableMs);
      expect(test.session.tapMap(), label).toBe('closed');
      test.timers.runAll();

      expect(test.session.shownMap(), label).toBeNull();
      expect(test.session.goalKeyReward(), label).toBeNull();
      expect(test.session.round().solved, label).toBe(false);
      expect(test.session.starCount(), label).toBe(0);
    }
  });
});

describe('#145 AC5: zavírací ťuknutí nezadá odpověď a druhé ťuknutí nic nezdvojí', () => {
  it('ťuknutí, které kartu zavře, nezadá odpověď, nepočítá chybu ani neukáže nápovědu', () => {
    const { test, device, card } = stopCard();
    test.timers.advance(card.closableMs);
    const soundsBefore = device.sounds.played.length;

    expect(test.session.tapMap()).toBe('closed');
    test.timers.runAll();

    expect(test.session.round().solved).toBe(false);
    expect(test.session.wrongAnswers()).toBe(0);
    expect(test.session.hintVisible()).toBe(false);
    expect(test.session.starCount()).toBe(0);
    const newSounds = device.sounds.played.slice(soundsBefore);
    expect(newSounds).not.toContain(SOUNDS.correct);
    expect(newSounds).not.toContain(SOUNDS.wrong);
    expect(newSounds).not.toContain(SOUNDS.hint);
  });

  it('číselník, nápověda ani okénko na psaní pod kartou nic nezadají, dokud je karta vidět', () => {
    const device = testDevice(WRITING_SETTINGS);
    const test = enterCounting(device);
    const card = showCard(test);
    test.timers.advance(card.closableMs);
    const round = test.session.round();

    expect(test.session.tapAnswer(round.problem.result), 'číselník').toBe('ignored');
    expect(test.session.answerWritten(round, 'correct'), 'okénko na psaní').toBe('ignored');
    expect(test.session.tapHintButton(), 'nápověda').toBe(false);
    expect(test.session.starCount()).toBe(0);
    expect(test.session.shownMap(), 'karta pořád čeká na ťuknutí').toEqual(card.move);
  });

  it('druhé ťuknutí při zavírání nic nezdvojí: nový příklad přijde jen jednou', () => {
    const { test, card } = stopCard();
    test.timers.advance(card.closableMs);
    expect(test.session.tapMap()).toBe('closed');
    test.timers.runAll();
    const problem = test.session.problem();
    const changes = test.changes();

    expect(test.session.tapMap(), 'druhé ťuknutí').toBe('ignored');
    test.timers.advance(CARD_OPEN_MS);
    test.timers.runAll();

    expect(test.session.problem(), 'žádný další příklad').toBe(problem);
    expect(test.changes(), 'nic dalšího se nepřekreslilo').toBe(changes);
    expect(test.session.shownMap()).toBeNull();
  });

  it('po zavření ťuknutím se karta po 7 s nezavře podruhé a krok se nepřičte znovu', () => {
    const { test, device, card } = stopCard();
    test.timers.advance(card.closableMs);
    test.session.tapMap();
    test.timers.advance(CARD_OPEN_MS);
    test.timers.runAll();

    expect(test.session.mapProgress().step).toBe(1);
    expect(loadMapProgress(device.storage).step).toBe(1);
  });
});

describe('#145 AC6: nastavení, domeček a další plná řada', () => {
  it('nastavení během karty: karta zmizí bez chyby, krok i klíč zůstanou a karta se už neukáže', () => {
    const page = openPage(new DeviceStorage());
    const test = enterCountingOn(page, { step: MAP_STEPS - 1, completedMaps: 0 });
    showCard(test);
    test.timers.advance(1000);

    test.page.holdGear();
    expect(test.session.shownMap(), 'nastavení kartu zavře').toBeNull();
    expect(test.session.tapMap(), 'ťuknutí při nastavení').toBe('ignored');
    test.session.confirmSettings();
    test.timers.advance(CARD_OPEN_MS);
    test.timers.runAll();

    expect(test.session.shownMap(), 'po zavření nastavení se karta neukáže').toBeNull();
    expect(test.session.mapProgress()).toEqual({ step: MAP_STEPS, completedMaps: 1 });
    expect(keysOf(page).balance().halves, 'půlka klíče zůstane').toBe(1);
  });

  it('odchod domečkem během karty: karta zmizí bez chyby, krok zůstane a karta se už neukáže', () => {
    const { test, device } = stopCard();
    test.timers.advance(500);

    test.session.leave();
    expect(() => test.session.tapMap()).not.toThrow();
    expect(test.session.tapMap()).toBe('ignored');
    expect(test.session.shownMap()).toBeNull();

    const next = enterCounting(device);
    expect(next.session.mapProgress().step).toBe(1);
    next.timers.advance(CARD_OPEN_MS * 2);
    expect(next.session.shownMap(), 'po návratu se karta sama neukáže').toBeNull();
  });

  it('další plná řada po zavření ťuknutím ukáže kartu znovu o krok dál', () => {
    const { test, card } = stopCard();
    test.timers.advance(card.closableMs);
    expect(test.session.tapMap()).toBe('closed');
    test.timers.runAll();

    const next = showCard(test);

    expect(next.move).toMatchObject({ from: 1, to: 2, reachedGoal: false });
    test.timers.advance(next.closableMs);
    expect(test.session.tapMap(), 'i druhá karta jde zavřít ťuknutím').toBe('closed');
  });
});

describe('#145 AC5: rychlé druhé ťuknutí po zavření karty nezadá odpověď', () => {
  it('ťuknutí na číslo hned po zavření karty se nezapočítá, o chvíli později už ano', () => {
    const { test, card } = stopCard();
    test.timers.advance(card.closableMs);
    expect(test.session.tapMap()).toBe('closed');
    const answer = correctAnswerOf(test.session);

    expect(test.session.tapAnswer(answer), 'hned po zavření').toBe('ignored');
    test.timers.advance(MAP_CLOSE_ANSWER_PAUSE_MS - 1);
    expect(test.session.tapAnswer(answer), 'těsně před koncem chvíle').toBe('ignored');
    expect(test.session.starCount()).toBe(0);
    expect(test.session.round().solved).toBe(false);

    test.timers.advance(1);
    expect(test.session.tapAnswer(answer), 'po chvíli se hraje dál').toBe('correct');
    expect(test.session.starCount()).toBe(1);
  });

  it('psaní hned po zavření karty také nic nezadá', () => {
    const device = testDevice(WRITING_SETTINGS);
    const test = enterCounting(device);
    const card = showCard(test);
    test.timers.advance(card.closableMs);
    expect(test.session.tapMap()).toBe('closed');

    expect(test.session.answerWritten(test.session.round(), 'correct')).toBe('ignored');
    expect(test.session.starCount()).toBe(0);
  });
});

describe('#145 AC6: otočení zařízení při otevřené kartě nevynuluje odpočet ani hranici zavření', () => {
  /** Otočení: scéna kartu rozloží pro nové okno a znovu se zeptá sezení, co ukazuje. */
  function rotate(test: TestSession, card: ShownCard): void {
    const landscape = layoutProgressMapCard(viewportOf(IPAD_WINDOWS[0] ?? PHONE_WINDOW_FALLBACK));
    const portrait = layoutProgressMapCard(
      viewportOf(PHONE_PORTRAIT_WINDOWS[0] ?? PHONE_WINDOW_FALLBACK),
    );
    expect(landscape.rect.width > landscape.rect.height).toBe(true);
    expect(portrait.rect.width > portrait.rect.height).toBe(false);
    expect(test.session.shownMap(), 'po otočení je vidět stejný krok').toEqual(card.move);
  }

  for (const { label, open } of CARD_CASES) {
    it(`${label}: po otočení jde kartu zavřít ťuknutím od stejné hranice jako před ním`, () => {
      const { test, card } = open();
      test.timers.advance(Math.floor(card.closableMs / 2));
      rotate(test, card);

      test.timers.advance(card.closableMs - Math.floor(card.closableMs / 2) - 1);
      expect(test.session.tapMap(), 'těsně před hranicí').toBe('tooEarly');
      test.timers.advance(1);
      expect(test.session.tapMap(), 'od hranice').toBe('closed');
    });

    it(`${label}: po otočení se karta bez ťuknutí zavře v 7 s od ukázání, ne později`, () => {
      const { test, card } = open();
      test.timers.advance(500);
      rotate(test, card);

      test.timers.advance(CARD_OPEN_MS - 500 - 10);
      expect(test.session.shownMap(), 'těsně před 7 s').not.toBeNull();
      const closedAfter = advanceUntil(test, () => test.session.shownMap() === null, 20);
      expect(closedAfter, 'zavře se kolem 7 s od ukázání').not.toBeNull();
    });
  }
});

/** Náhradní okno, kdyby seznam oken byl prázdný (nestane se). */
const PHONE_WINDOW_FALLBACK = {
  name: 'náhradní okno',
  width: 390,
  height: 844,
  safeArea: { top: 0, right: 0, bottom: 0, left: 0 },
};
