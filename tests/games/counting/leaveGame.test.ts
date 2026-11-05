import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SOUNDS } from '../../../src/games/counting/logic/answerSounds';
import { STARS_PER_SET } from '../../../src/games/counting/logic/stars';
import { loadProgress } from '../../../src/games/counting/storage/progressStorage';
import { loadSettings } from '../../../src/games/counting/storage/settingsStorage';
import { createHoldButton } from '../../../src/shared/logic/holdButton';
import type { HoldButton } from '../../../src/shared/logic/holdButton';
import { HOLD_TO_GO_HOME_MS } from '../../../src/shared/logic/homeButton';
import {
  KEYPAD_SETTINGS,
  WRITING_SETTINGS,
  correctAnswerOf,
  enterCounting,
  solveProblems,
  testDevice,
  wrongAnswerOf,
} from './sessionFakes';
import type { TestDevice, TestSession } from './sessionFakes';

/**
 * Testy k #68 (domeček ve hře, podržením 1 s zpět do menu), část Počítání:
 * AC2 (ťuknutí jen zhoupne, druhý prst během držení), AC3 (co se při
 * odchodu stane s hrou), AC4 (domeček při otevřeném nastavení a průvodci)
 * a AC5 (20 vstupů a odchodů). Test běží na úrovni logiky sezení hry
 * s falešnými časovači, zvuky, stránkou a stahováním (`sessionFakes.ts`).
 * Podržení domečku je skutečná sdílená logika `createHoldButton` na
 * falešných hodinách Vitestu.
 *
 * Navržené rozhraní `src/games/counting/logic/countingSession.ts`:
 * `createCountingSession(options)` je jeden vstup do Počítání. Scéna jen
 * kreslí podle něj a předává ťuknutí; časovače, zvuky a kolečko dostane
 * sezení zvenku, aby je při odchodu mohlo všechny zastavit a odpojit.
 * - `options`: `storage`, `random`, `sounds` (`play`, `stopAll`),
 *   `voice` (`stop`, věta průvodce), `timers` (`after(ms, callback)` vrátí
 *   zrušení), `page` (`attachSettingsGear(open)` vrátí odpojení),
 *   `loadRecognizer` a `onChange` (obrazovka se má překreslit).
 * - čtení: `problem()`, `wrongAnswers()`, `hintVisible()`, `starCount()`,
 *   `celebrating()`, `settings()`, `answerInput()`, `guideOpen()`,
 *   `settingsOpen()`, `homeAvailable()`, `hasLeft()`.
 * - akce: `tapAnswer(number)` vrátí `TapOutcome`, `problemDrawn()`,
 *   `confirmSettings()` (✓), `finishGuide(settings)` („Začít hrát“)
 *   a `leave()` (odchod do menu).
 *
 * Ručně se kontroluje: zhoupnutí domečku, kroužek, okamžité ztichnutí
 * melodie oslavy a věty průvodce v Safari a paměť po 20 vstupech
 * ve Web Inspectoru (AC5).
 */

const FINGER = 1;

/** Domeček napojený na odchod ze sezení, jak to udělá stránka. */
function homeFor(test: TestSession): { hold: HoldButton; wobbles: () => number } {
  let wobbles = 0;
  const hold = createHoldButton({
    holdMs: HOLD_TO_GO_HOME_MS,
    isEnabled: () => test.session.homeAvailable(),
    onHoldComplete: () => test.session.leave(),
    onTap: () => {
      wobbles += 1;
    },
  });
  return { hold, wobbles: () => wobbles };
}

/** Dítě se dvakrát splete, takže se ukáže nápověda. */
function makeTwoMistakes(test: TestSession): void {
  test.session.tapAnswer(wrongAnswerOf(test.session));
  test.session.tapAnswer(wrongAnswerOf(test.session));
}

function savedStars(device: TestDevice): number {
  return loadProgress(device.storage).earned;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('AC2: ťuknutí na domeček hru nepřeruší', () => {
  it('ťuknutí domeček zhoupne a příklad, chyby i nápověda zůstanou', () => {
    const test = enterCounting(testDevice());
    makeTwoMistakes(test);
    const problem = test.session.problem();
    const home = homeFor(test);

    home.hold.press(FINGER);
    vi.advanceTimersByTime(100);
    home.hold.release(FINGER);
    vi.advanceTimersByTime(5000);

    expect(home.wobbles()).toBe(1);
    expect(test.session.hasLeft()).toBe(false);
    expect(test.session.problem()).toEqual(problem);
    expect(test.session.wrongAnswers()).toBe(2);
    expect(test.session.hintVisible()).toBe(true);
  });

  it('podržení 0,99 s neodejde a hra pokračuje, 1 s odejde', () => {
    const test = enterCounting(testDevice());
    const home = homeFor(test);

    home.hold.press(FINGER);
    vi.advanceTimersByTime(990);
    expect(test.session.hasLeft()).toBe(false);

    vi.advanceTimersByTime(10);
    expect(test.session.hasLeft()).toBe(true);
  });

  it('když prst sjede z domečku, dítě zůstane ve hře u stejného příkladu', () => {
    const test = enterCounting(testDevice());
    const problem = test.session.problem();
    const home = homeFor(test);

    home.hold.press(FINGER);
    vi.advanceTimersByTime(600);
    home.hold.leave(FINGER);
    vi.advanceTimersByTime(5000);

    expect(test.session.hasLeft()).toBe(false);
    expect(test.session.problem()).toEqual(problem);
  });

  it('odpověď druhým prstem během držení se vyhodnotí (zvuk, hvězdička) a po 1 s se odejde', () => {
    const device = testDevice();
    const test = enterCounting(device);
    const home = homeFor(test);

    home.hold.press(FINGER);
    vi.advanceTimersByTime(400);
    const outcome = test.session.tapAnswer(correctAnswerOf(test.session));

    expect(outcome).toBe('correct');
    expect(device.sounds.played).toEqual([SOUNDS.correct]);
    expect(test.session.starCount()).toBe(1);
    expect(test.session.hasLeft()).toBe(false);

    vi.advanceTimersByTime(600);
    expect(test.session.hasLeft()).toBe(true);
    expect(savedStars(device)).toBe(1);
  });

  it('špatná odpověď druhým prstem během držení se vyhodnotí jako obvykle', () => {
    const device = testDevice();
    const test = enterCounting(device);
    const home = homeFor(test);

    home.hold.press(FINGER);
    vi.advanceTimersByTime(300);
    const outcome = test.session.tapAnswer(wrongAnswerOf(test.session));

    expect(outcome).toBe('wrong');
    expect(device.sounds.played).toEqual([SOUNDS.wrong]);
    expect(test.session.wrongAnswers()).toBe(1);
  });
});

describe('AC3: po odchodu zůstanou hvězdičky a nastavení, příště začne nové kolo', () => {
  it('po dalším spuštění je stejný počet hvězdiček', () => {
    const device = testDevice();
    const first = enterCounting(device);
    solveProblems(first, 3);

    first.session.leave();
    const next = enterCounting(device);

    expect(next.session.starCount()).toBe(3);
    expect(savedStars(device)).toBe(3);
  });

  it('nastavení rodiče zůstane uložené a další vstup ho použije bez průvodce', () => {
    const settings = { maxNumber: 20, operations: 'mixed', answerInput: 'keypad' } as const;
    const device = testDevice(settings);
    enterCounting(device).session.leave();

    const next = enterCounting(device);

    expect(loadSettings(device.storage)).toEqual(settings);
    expect(next.session.settings()).toEqual(settings);
    expect(next.session.guideOpen()).toBe(false);
  });

  it('po odchodu s chybami a nápovědou začne příště kolo bez chyb a bez nápovědy', () => {
    const device = testDevice();
    const first = enterCounting(device);
    makeTwoMistakes(first);
    expect(first.session.hintVisible()).toBe(true);

    first.session.leave();
    const next = enterCounting(device);

    expect(next.session.wrongAnswers()).toBe(0);
    expect(next.session.hintVisible()).toBe(false);
  });

  it('po odchodu sezení už nebere odpovědi a nic neuloží', () => {
    const device = testDevice();
    const test = enterCounting(device);
    solveProblems(test, 2);

    test.session.leave();
    const outcome = test.session.tapAnswer(correctAnswerOf(test.session));

    expect(outcome).toBe('ignored');
    expect(savedStars(device)).toBe(2);
  });
});

/**
 * Oslava začne po doletu hvězdičky do řady (dnes 450 + 120 ms) a trvá
 * 2,6 s, takže 1 s po desáté odpovědi oslava právě běží.
 */
describe('AC3: odchod během oslavy', () => {
  it('oslava i melodie hned skončí a po odchodu už nic nedoběhne', () => {
    const device = testDevice();
    const test = enterCounting(device);
    solveProblems(test, STARS_PER_SET - 1);
    test.session.tapAnswer(correctAnswerOf(test.session));
    test.timers.advance(1000);
    expect(test.session.celebrating()).toBe(true);
    expect(device.sounds.played).toContain(SOUNDS.celebration);
    const changesBefore = test.changes();
    const playedBefore = device.sounds.played.length;

    test.session.leave();

    expect(device.sounds.stopped).toBeGreaterThanOrEqual(1);
    expect(test.session.celebrating()).toBe(false);
    expect(test.timers.count).toBe(0);
    test.timers.runAll();
    expect(test.changes()).toBe(changesBefore);
    expect(device.sounds.played).toHaveLength(playedBefore);
  });

  it('příště začne prázdná řada bez opakování oslavy, jako po zavření hry (#38)', () => {
    const device = testDevice();
    const test = enterCounting(device);
    solveProblems(test, STARS_PER_SET - 1);
    test.session.tapAnswer(correctAnswerOf(test.session));
    test.timers.advance(1000);
    test.session.leave();
    const playedBefore = device.sounds.played.length;

    const next = enterCounting(device);
    next.timers.runAll();

    expect(next.session.starCount()).toBe(0);
    expect(next.session.celebrating()).toBe(false);
    expect(device.sounds.played.slice(playedBefore)).not.toContain(SOUNDS.celebration);
  });

  it('po návratu z oslavy dá další správná odpověď 1 hvězdičku a oslava přijde až po deseti', () => {
    const device = testDevice();
    const test = enterCounting(device);
    solveProblems(test, STARS_PER_SET - 1);
    test.session.tapAnswer(correctAnswerOf(test.session));
    test.session.leave();

    const next = enterCounting(device);
    solveProblems(next, 1);
    expect(next.session.starCount()).toBe(1);

    solveProblems(next, STARS_PER_SET - 2);
    next.session.tapAnswer(correctAnswerOf(next.session));
    expect(next.session.celebrating()).toBe(true);
  });
});

describe('AC3: odchod během animace odpovědi', () => {
  it('hvězdička za už vyhodnocenou odpověď zůstane uložená', () => {
    const device = testDevice();
    const test = enterCounting(device);
    solveProblems(test, 4);

    test.session.tapAnswer(correctAnswerOf(test.session));
    test.session.leave();

    expect(savedStars(device)).toBe(5);
    expect(enterCounting(device).session.starCount()).toBe(5);
  });

  it('žádná hvězdička se nepřidá dvakrát ani po doběhnutí času', () => {
    const device = testDevice();
    const test = enterCounting(device);

    test.session.tapAnswer(correctAnswerOf(test.session));
    test.session.leave();
    test.timers.runAll();

    expect(test.session.starCount()).toBe(1);
    expect(savedStars(device)).toBe(1);
  });

  it('po odchodu se nový příklad nenaplánuje ani nenakreslí', () => {
    const device = testDevice();
    const test = enterCounting(device);
    test.session.tapAnswer(correctAnswerOf(test.session));
    const problem = test.session.problem();
    const changesBefore = test.changes();

    test.session.leave();

    expect(test.timers.count).toBe(0);
    test.timers.runAll();
    expect(test.session.problem()).toEqual(problem);
    expect(test.changes()).toBe(changesBefore);
  });

  it('odchod po špatné odpovědi nic nedokončí a příště začne kolo bez chyb', () => {
    const device = testDevice();
    const test = enterCounting(device);
    test.session.tapAnswer(wrongAnswerOf(test.session));

    test.session.leave();
    test.timers.runAll();

    expect(savedStars(device)).toBe(0);
    expect(enterCounting(device).session.wrongAnswers()).toBe(0);
  });
});

describe('AC3: odchod během stahování rozpoznávání psaní (#58)', () => {
  function enterWritingAndStartDownload(device: TestDevice): TestSession {
    const test = enterCounting(device);
    test.session.problemDrawn();
    expect(test.recognizer.count).toBe(1);
    return test;
  }

  it('stahování, které doběhne po odchodu, nic nezobrazí ani nespustí', async () => {
    const device = testDevice(WRITING_SETTINGS);
    const test = enterWritingAndStartDownload(device);
    test.session.leave();
    const changesBefore = test.changes();
    const playedBefore = device.sounds.played.length;

    test.recognizer.last().succeed();
    await vi.advanceTimersByTimeAsync(0);

    expect(test.changes()).toBe(changesBefore);
    expect(device.sounds.played).toHaveLength(playedBefore);
    expect(test.timers.count).toBe(0);
  });

  it('stahování, které po odchodu selže, nic neshodí', async () => {
    const device = testDevice(WRITING_SETTINGS);
    const test = enterWritingAndStartDownload(device);
    test.session.leave();
    const changesBefore = test.changes();

    test.recognizer.last().fail();
    await vi.advanceTimersByTimeAsync(0);

    expect(test.changes()).toBe(changesBefore);
    expect(test.session.hasLeft()).toBe(true);
  });

  it('po odchodu se další stahování nespustí ani po nakreslení', async () => {
    const device = testDevice(WRITING_SETTINGS);
    const test = enterWritingAndStartDownload(device);
    test.recognizer.last().fail();
    await vi.advanceTimersByTimeAsync(0);
    test.session.leave();

    test.session.problemDrawn();

    expect(test.recognizer.count).toBe(1);
  });

  it('další vstup do hry dá okénko na psaní jako dnes (#58), ať stahování doběhlo jakkoli', async () => {
    const device = testDevice(WRITING_SETTINGS);
    const first = enterWritingAndStartDownload(device);
    first.session.leave();
    first.recognizer.last().fail();
    await vi.advanceTimersByTimeAsync(0);

    const next = enterCounting(device);

    expect(next.session.answerInput()).toBe('writing');
    next.session.problemDrawn();
    expect(next.recognizer.count).toBe(1);
  });

  it('s číselníkem se po odchodu a návratu nic nestahuje navíc', () => {
    const device = testDevice(KEYPAD_SETTINGS);
    const first = enterCounting(device);
    first.session.leave();

    const next = enterCounting(device);

    expect(next.session.answerInput()).toBe('keypad');
  });
});

describe('AC3: při odchodu hned zmlknou všechny zvuky hry', () => {
  it('odchod ztiší zvuky hry i větu průvodce', () => {
    const device = testDevice();
    const test = enterCounting(device);
    test.session.tapAnswer(correctAnswerOf(test.session));

    test.session.leave();

    expect(device.sounds.stopped).toBeGreaterThanOrEqual(1);
    expect(device.voice.stopped).toBeGreaterThanOrEqual(1);
  });

  it('odchod hned po „Začít hrát“ v průvodci ztiší i rozmluvenou větu průvodce', () => {
    const device = testDevice(null);
    const test = enterCounting(device);
    expect(test.session.guideOpen()).toBe(true);
    test.session.finishGuide(KEYPAD_SETTINGS);

    test.session.leave();

    expect(device.voice.stopped).toBeGreaterThanOrEqual(1);
  });

  it('po odchodu už žádný zvuk nezazní', () => {
    const device = testDevice();
    const test = enterCounting(device);
    test.session.leave();
    const playedBefore = device.sounds.played.length;

    test.session.tapAnswer(correctAnswerOf(test.session));
    test.session.tapAnswer(wrongAnswerOf(test.session));
    test.timers.runAll();

    expect(device.sounds.played).toHaveLength(playedBefore);
  });

  it('druhý odchod nic nerozbije', () => {
    const test = enterCounting(testDevice());
    test.session.leave();

    expect(() => test.session.leave()).not.toThrow();
    expect(test.session.hasLeft()).toBe(true);
  });
});

describe('AC4: domeček nepřekáží otevřenému nastavení ani průvodci', () => {
  it('při hře je domeček k dispozici', () => {
    const test = enterCounting(testDevice());

    expect(test.session.homeAvailable()).toBe(true);
  });

  it('při otevřeném nastavení domeček není vidět a nereaguje, ✓ ho vrátí', () => {
    const device = testDevice();
    const test = enterCounting(device);
    device.page.holdGear();
    expect(test.session.settingsOpen()).toBe(true);
    expect(test.session.homeAvailable()).toBe(false);

    const home = homeFor(test);
    home.hold.press(FINGER);
    vi.advanceTimersByTime(2000);
    home.hold.release(FINGER);
    expect(test.session.hasLeft()).toBe(false);
    expect(home.wobbles()).toBe(0);

    test.session.confirmSettings();
    expect(test.session.settingsOpen()).toBe(false);
    expect(test.session.homeAvailable()).toBe(true);
  });

  it('během průvodce při prvním spuštění domeček není vidět a nereaguje', () => {
    const test = enterCounting(testDevice(null));
    expect(test.session.guideOpen()).toBe(true);
    expect(test.session.homeAvailable()).toBe(false);

    const home = homeFor(test);
    home.hold.press(FINGER);
    vi.advanceTimersByTime(2000);

    expect(test.session.hasLeft()).toBe(false);
    expect(test.session.guideOpen()).toBe(true);
  });

  it('po „Začít hrát“ v průvodci je domeček zase k dispozici', () => {
    const test = enterCounting(testDevice(null));

    test.session.finishGuide(KEYPAD_SETTINGS);

    expect(test.session.guideOpen()).toBe(false);
    expect(test.session.homeAvailable()).toBe(true);
  });

  it('nastavení otevřené během držení domečku odchod zruší', () => {
    const device = testDevice();
    const test = enterCounting(device);
    const home = homeFor(test);

    home.hold.press(FINGER);
    vi.advanceTimersByTime(500);
    device.page.holdGear();
    vi.advanceTimersByTime(1000);

    expect(test.session.hasLeft()).toBe(false);
    expect(test.session.settingsOpen()).toBe(true);
  });
});

describe('AC5: po 20 vstupech a odchodech je hra stejná jako po prvním vstupu', () => {
  /** Dvacetkrát vstoupí do Počítání a hned odejde; vrátí sezení všech vstupů. */
  function enterAndLeaveTwentyTimes(device: TestDevice): TestSession[] {
    const sessions: TestSession[] = [];
    for (let entry = 0; entry < 20; entry += 1) {
      const test = enterCounting(device, entry + 1);
      test.session.tapAnswer(wrongAnswerOf(test.session));
      test.session.leave();
      sessions.push(test);
    }
    return sessions;
  }

  it('jedno ťuknutí na číslo je jedna odpověď, zvuk zazní jednou a hvězdička přibude jednou', () => {
    const device = testDevice();
    enterAndLeaveTwentyTimes(device);
    const test = enterCounting(device);
    const starsBefore = test.session.starCount();
    const playedBefore = device.sounds.played.length;

    const outcome = test.session.tapAnswer(correctAnswerOf(test.session));

    expect(outcome).toBe('correct');
    expect(device.sounds.played.slice(playedBefore)).toEqual([SOUNDS.correct]);
    expect(test.session.starCount()).toBe(starsBefore + 1);
    expect(savedStars(device)).toBe(starsBefore + 1);
  });

  it('kolečko se otevře jedním podržením a otevře nastavení jen v právě hrané hře', () => {
    const device = testDevice();
    const left = enterAndLeaveTwentyTimes(device);
    const test = enterCounting(device);

    expect(device.page.gearListeners).toBe(1);
    device.page.holdGear();

    expect(test.session.settingsOpen()).toBe(true);
    for (const old of left) {
      expect(old.session.settingsOpen()).toBe(false);
    }
  });

  it('po každém odchodu je kolečko odpojené a nic nečeká na časovačích', () => {
    const device = testDevice();
    for (let entry = 0; entry < 20; entry += 1) {
      const test = enterCounting(device);
      solveProblems(test, 1);
      test.session.tapAnswer(correctAnswerOf(test.session));
      test.session.leave();

      expect(device.page.gearListeners, `vstup ${entry + 1}`).toBe(0);
      expect(test.timers.count, `vstup ${entry + 1}`).toBe(0);
    }
  });

  it('hvězdičky přibývají stejně jako bez odchodů: 20 vstupů po jedné správné odpovědi dá 2 plné řady', () => {
    const device = testDevice();
    let celebrations = 0;
    for (let entry = 0; entry < 20; entry += 1) {
      const test = enterCounting(device);
      test.session.tapAnswer(correctAnswerOf(test.session));
      if (test.session.celebrating()) {
        celebrations += 1;
      }
      test.session.leave();
    }

    expect(celebrations).toBe(2);
    expect(savedStars(device)).toBe(0);
  });

  it('21. vstup začne jako první: bez chyb, bez nápovědy, bez oslavy a bez otevřeného nastavení', () => {
    const device = testDevice();
    const first = enterCounting(device);
    const firstState = {
      wrongAnswers: first.session.wrongAnswers(),
      hintVisible: first.session.hintVisible(),
      celebrating: first.session.celebrating(),
      settingsOpen: first.session.settingsOpen(),
      guideOpen: first.session.guideOpen(),
      homeAvailable: first.session.homeAvailable(),
      answerInput: first.session.answerInput(),
    };
    first.session.leave();
    enterAndLeaveTwentyTimes(device);

    const test = enterCounting(device);

    expect({
      wrongAnswers: test.session.wrongAnswers(),
      hintVisible: test.session.hintVisible(),
      celebrating: test.session.celebrating(),
      settingsOpen: test.session.settingsOpen(),
      guideOpen: test.session.guideOpen(),
      homeAvailable: test.session.homeAvailable(),
      answerInput: test.session.answerInput(),
    }).toEqual(firstState);
  });
});
