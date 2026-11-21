import { describe, expect, it } from 'vitest';

import {
  CELEBRATION_TO_MAP_MS,
  PREPARE_CELEBRATION_FROM_STARS,
  STAR_FLIGHT_MS,
  createCountingSession,
} from '../../../src/games/counting/logic/countingSession';
import type { SessionChange } from '../../../src/games/counting/logic/countingSession';
import { SOUNDS } from '../../../src/games/counting/logic/answerSounds';
import { STARS_PER_SET } from '../../../src/games/counting/logic/stars';
import { seededRandom } from './seededRandom';
import {
  FakeRecognizerLoader,
  FakeRudy,
  FakeTimers,
  KEYPAD_SETTINGS,
  WRITING_SETTINGS,
  correctAnswerOf,
  enterCounting,
  testDevice,
  wrongAnswerOf,
} from './sessionFakes';
import type { TestDevice } from './sessionFakes';

/**
 * Testy k #170 AC2 a AC3 v sezení hry Počítání: po otevření hry (po
 * zavření průvodce, pokud se ukazuje) Rudy jednou pozdraví a odpovídat jde
 * až po zavření okna. Při 10. hvězdičce se nejdřív ukáže okno s oslavou
 * a teprve po jeho zavření začnou konfety s melodií a karta s mapou.
 * Okno s pandou je `FakeRudy` ze `sessionFakes.ts`; časy oslavy od
 * zavření okna hlídá `celebrationTiming.test.ts`.
 */

interface RudyGame {
  readonly device: TestDevice;
  readonly rudy: FakeRudy;
  readonly timers: FakeTimers;
  readonly changes: Array<SessionChange['kind']>;
  readonly session: ReturnType<typeof createCountingSession>;
}

/** Vstup do hry s oknem s pandou, které ukazuje a zavírá test. */
function enterWithRudy(device: TestDevice = testDevice()): RudyGame {
  const rudy = new FakeRudy();
  const timers = new FakeTimers();
  const changes: Array<SessionChange['kind']> = [];
  const session = createCountingSession({
    storage: device.storage,
    random: seededRandom(170),
    sounds: device.sounds,
    voice: device.voice,
    timers,
    page: device.page,
    loadRecognizer: new FakeRecognizerLoader().load,
    rudy,
    onChange: (change) => changes.push(change.kind),
  });
  return { device, rudy, timers, changes, session };
}

/** Pozdrav se ukáže a zavře, hra je připravená na odpovědi. */
function closeGreeting(game: RudyGame): void {
  game.rudy.openPending();
  game.rudy.close();
}

/** Dítě vyřeší 9 příkladů a ťukne správně na 10.; hvězdička doletí do řady. */
function fillRow(game: RudyGame): void {
  for (let solved = 0; solved < STARS_PER_SET - 1; solved += 1) {
    game.session.tapAnswer(correctAnswerOf(game.session));
    game.timers.runAll();
  }
  game.changes.length = 0;
  game.session.tapAnswer(correctAnswerOf(game.session));
  game.timers.advance(STAR_FLIGHT_MS);
}

describe('#170 AC2: Rudy pozdraví po otevření hry', () => {
  it('po otevření hry s uloženým nastavením se jednou ukáže okno s pozdravem', () => {
    const game = enterWithRudy();
    expect(game.rudy.requested).toEqual(['wave']);
    closeGreeting(game);
    game.session.tapAnswer(correctAnswerOf(game.session));
    game.timers.runAll();
    expect(game.rudy.requested, 'pozdrav jen jednou').toEqual(['wave']);
  });

  it('při prvním spuštění pozdraví až po zavření průvodce nastavením', () => {
    const game = enterWithRudy(testDevice(null));
    expect(game.session.guideOpen()).toBe(true);
    expect(game.rudy.requested, 'během průvodce ne').toEqual([]);
    game.session.finishGuide(KEYPAD_SETTINGS);
    expect(game.rudy.requested).toEqual(['wave']);
  });

  it('během okna s pozdravem nejde odpovídat, po zavření ano', () => {
    const game = enterWithRudy();
    game.rudy.openPending();
    const answer = correctAnswerOf(game.session);
    expect(game.session.tapAnswer(answer)).toBe('ignored');
    expect(game.session.answerWritten(game.session.round(), 'correct')).toBe('ignored');
    expect(game.session.tapHintButton()).toBe(false);
    expect(game.session.tapDot(0)).toBeNull();
    expect(game.session.starCount()).toBe(0);
    game.rudy.close();
    expect(game.session.tapAnswer(answer)).toBe('correct');
    expect(game.session.starCount()).toBe(1);
  });

  it('dokud se okno stahuje, dítě může hrát; okno, které se nestáhne, hru nezdrží', () => {
    const game = enterWithRudy();
    expect(game.rudy.waitingMove()).toBe('wave');
    expect(game.session.tapAnswer(correctAnswerOf(game.session))).toBe('correct');
    game.timers.runAll();
    game.rudy.giveUp();
    expect(game.session.tapAnswer(correctAnswerOf(game.session))).toBe('correct');
  });

  it('nastavení otevřené dřív, než se pozdrav ukáže, pozdrav zruší', () => {
    const game = enterWithRudy();
    game.device.page.holdGear();
    expect(game.rudy.stopped).toBeGreaterThan(0);
    expect(game.rudy.waitingMove()).toBeNull();
    game.session.confirmSettings();
    expect(game.session.tapAnswer(correctAnswerOf(game.session))).toBe('correct');
  });

  it('odchod domečkem okno zavře a nic dalšího se neukáže', () => {
    const game = enterWithRudy();
    game.session.leave();
    expect(game.rudy.stopped).toBeGreaterThan(0);
    expect(game.rudy.openMove()).toBeNull();
  });

  it('hra bez okna s pandou jde hrát hned (okno nepatří k pravidlům hry)', () => {
    const test = enterCounting(testDevice());
    expect(test.session.tapAnswer(correctAnswerOf(test.session))).toBe('correct');
  });
});

describe('#170 AC3: desátá hvězdička → okno s oslavou → karta s mapou', () => {
  it('po doletu 10. hvězdičky se ukáže okno s oslavou, ještě bez konfet a mapy', () => {
    const game = enterWithRudy();
    closeGreeting(game);
    fillRow(game);
    expect(game.rudy.waitingMove()).toBe('celebrate');
    game.rudy.openPending();
    game.timers.advance(10_000);
    expect(game.session.starCount(), 'hvězdičky svítí v řadě').toBe(STARS_PER_SET);
    expect(game.changes).not.toContain('celebrationStarted');
    expect(game.changes).not.toContain('mapShown');
    expect(game.device.sounds.played).not.toContain(SOUNDS.celebration);
  });

  it('po zavření okna začnou konfety s melodií hned a karta s mapou přijde za nimi', () => {
    const game = enterWithRudy();
    closeGreeting(game);
    fillRow(game);
    game.rudy.openPending();
    game.timers.advance(3000);
    game.rudy.close();
    expect(game.changes).toContain('celebrationStarted');
    expect(game.device.sounds.played).toContain(SOUNDS.celebration);
    expect(game.session.shownMap()).toBeNull();
    game.timers.advance(CELEBRATION_TO_MAP_MS);
    expect(game.session.shownMap()).not.toBeNull();
    expect(game.changes.indexOf('celebrationStarted')).toBeLessThan(
      game.changes.indexOf('mapShown'),
    );
  });

  it('během okna s oslavou nejde odpovídat a hvězdička nepřibude', () => {
    const game = enterWithRudy();
    closeGreeting(game);
    fillRow(game);
    game.rudy.openPending();
    expect(game.session.tapAnswer(correctAnswerOf(game.session))).toBe('ignored');
    expect(game.session.starCount()).toBe(STARS_PER_SET);
  });

  it('okno, které se nestáhne, oslavu nezdrží: konfety a mapa přijdou jako dřív', () => {
    const game = enterWithRudy();
    closeGreeting(game);
    fillRow(game);
    game.rudy.giveUp();
    expect(game.changes).toContain('celebrationStarted');
    game.timers.advance(CELEBRATION_TO_MAP_MS);
    expect(game.session.shownMap()).not.toBeNull();
  });

  it('pozdrav se po oslavě neopakuje, každá plná řada má jedno okno s oslavou', () => {
    const game = enterWithRudy();
    closeGreeting(game);
    for (let row = 0; row < 2; row += 1) {
      fillRow(game);
      game.rudy.openPending();
      game.rudy.close();
      game.timers.runAll();
    }
    expect(game.rudy.requested).toEqual(['wave', 'celebrate', 'celebrate']);
  });

  it('nastavení otevřené, než se okno s oslavou ukáže: oslava ani mapa se nedohrají', () => {
    const game = enterWithRudy();
    closeGreeting(game);
    fillRow(game);
    game.device.page.holdGear();
    expect(game.rudy.waitingMove()).toBeNull();
    expect(game.changes).toContain('celebrationStopped');
    game.session.confirmSettings();
    game.timers.runAll();
    expect(game.changes).not.toContain('mapShown');
    expect(game.session.starCount()).toBe(0);
    expect(game.session.tapAnswer(correctAnswerOf(game.session))).toBe('correct');
  });
});

describe('#170: pozdrav nevyskočí, když už dítě hraje', () => {
  it('správná odpověď během stahování pozdravu pozdrav vynechá', () => {
    const game = enterWithRudy();
    expect(game.session.tapAnswer(correctAnswerOf(game.session))).toBe('correct');
    expect(game.rudy.waitingMove(), 'pozdrav už nečeká').toBeNull();
    game.rudy.openPending();
    expect(game.rudy.openMove(), 'pozdrav se neukáže').toBeNull();
  });

  it('i špatná odpověď během stahování pozdrav vynechá', () => {
    const game = enterWithRudy();
    expect(game.session.tapAnswer(wrongAnswerOf(game.session))).toBe('wrong');
    expect(game.rudy.waitingMove()).toBeNull();
  });

  it('začátek psaní prstem během stahování pozdrav vynechá', () => {
    const game = enterWithRudy(testDevice(WRITING_SETTINGS));
    game.session.writingStarted();
    expect(game.rudy.waitingMove()).toBeNull();
  });

  it('psaní po zavření pozdravu ani během něj nic nezruší', () => {
    const game = enterWithRudy(testDevice(WRITING_SETTINGS));
    game.rudy.openPending();
    game.session.writingStarted();
    expect(game.rudy.openMove(), 'otevřený pozdrav zůstane').toBe('wave');
    game.rudy.close();
    game.session.writingStarted();
    expect(game.rudy.stopped).toBe(0);
  });
});

describe('#170: oslava se stáhne dopředu', () => {
  /** Zařízení s uloženým nastavením a `earned` hvězdičkami v řadě. */
  function deviceWithStars(earned: number): TestDevice {
    const device = testDevice();
    device.storage.setItem('agentic-app.progress', JSON.stringify({ earned }));
    return device;
  }

  it('od 8. hvězdičky v řadě se oslava stahuje dopředu, dřív ne', () => {
    expect(PREPARE_CELEBRATION_FROM_STARS).toBe(8);
    const game = enterWithRudy();
    closeGreeting(game);
    for (let star = 1; star < PREPARE_CELEBRATION_FROM_STARS; star += 1) {
      game.session.tapAnswer(correctAnswerOf(game.session));
      game.timers.runAll();
    }
    expect(game.rudy.prepared, 'do 7. hvězdičky ne').toEqual([]);
    game.session.tapAnswer(correctAnswerOf(game.session));
    expect(game.rudy.prepared).toContain('celebrate');
  });

  it('s 8 a více hvězdičkami po otevření se oslava stáhne až po pozdravu (paměť klid + 1 pohyb)', () => {
    const game = enterWithRudy(deviceWithStars(9));
    expect(game.rudy.prepared, 'během pozdravu ne').toEqual([]);
    game.rudy.openPending();
    expect(game.rudy.prepared).toEqual([]);
    game.rudy.close();
    expect(game.rudy.prepared).toEqual(['celebrate']);
  });

  it('vynechaný pozdrav oslavu taky stáhne dopředu', () => {
    const game = enterWithRudy(deviceWithStars(8));
    game.rudy.giveUp();
    expect(game.rudy.prepared).toEqual(['celebrate']);
  });
});
