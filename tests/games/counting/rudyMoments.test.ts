import { describe, expect, it } from 'vitest';

import {
  CELEBRATION_TO_MAP_MS,
  PREPARE_CELEBRATION_FROM_STARS,
  STAR_FLIGHT_MS,
  createCountingSession,
} from '../../../src/games/counting/logic/countingSession';
import type { SessionChange } from '../../../src/games/counting/logic/countingSession';
import { SOUNDS } from '../../../src/games/counting/logic/answerSounds';
import { STARS_PER_SET } from '../../../src/shared/logic/stars';
import { seededRandom } from './seededRandom';
import {
  FakeRecognizerLoader,
  FakeRudy,
  FakeTimers,
  KEYPAD_SETTINGS,
  correctAnswerOf,
  enterCounting,
  testDevice,
  wrongAnswerOf,
} from './sessionFakes';
import type { TestDevice } from './sessionFakes';

/**
 * Testy k #170 AC3 a #186 AC1, AC3, AC4 v sezení hry Počítání: Rudy se
 * ukazuje jen po 10. hvězdičce, po otevření hry ani po průvodci nepozdraví.
 * Po 10. hvězdičce nejdřív přiskočí Rudy s oslavou a teprve po jeho odchodu
 * začnou konfety s melodií a karta s mapou. Během Rudyho se neodpovídá.
 * Rudy je `FakeRudy` ze `sessionFakes.ts`; časy oslavy od odchodu Rudyho
 * hlídá `celebrationTiming.test.ts`.
 */

interface RudyGame {
  readonly device: TestDevice;
  readonly rudy: FakeRudy;
  readonly timers: FakeTimers;
  readonly changes: Array<SessionChange['kind']>;
  readonly session: ReturnType<typeof createCountingSession>;
}

/** Vstup do hry s Rudym, kterého ukazuje a posílá pryč test. */
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

describe('#186 AC1: Rudy se ukazuje jen po 10. hvězdičce', () => {
  it('po otevření hry Rudy nepozdraví a odpovídat jde hned', () => {
    const game = enterWithRudy();
    expect(game.rudy.requested).toBe(0);
    expect(game.rudy.isWaiting()).toBe(false);
    expect(game.session.tapAnswer(correctAnswerOf(game.session))).toBe('correct');
  });

  it('při prvním spuštění Rudy nepozdraví ani po zavření průvodce nastavením', () => {
    const game = enterWithRudy(testDevice(null));
    expect(game.session.guideOpen()).toBe(true);
    game.session.finishGuide(KEYPAD_SETTINGS);
    expect(game.rudy.requested).toBe(0);
    expect(game.session.tapAnswer(correctAnswerOf(game.session))).toBe('correct');
  });

  it('během řady (1. až 9. hvězdička) ani po chybách se Rudy neukáže', () => {
    const game = enterWithRudy();
    expect(game.session.tapAnswer(wrongAnswerOf(game.session))).toBe('wrong');
    expect(game.session.tapAnswer(wrongAnswerOf(game.session))).toBe('wrong');
    for (let star = 1; star < STARS_PER_SET; star += 1) {
      game.session.tapAnswer(correctAnswerOf(game.session));
      game.timers.runAll();
    }
    expect(game.session.starCount()).toBe(STARS_PER_SET - 1);
    expect(game.rudy.requested).toBe(0);
  });

  it('hra bez Rudyho jde hrát hned (Rudy nepatří k pravidlům hry)', () => {
    const test = enterCounting(testDevice());
    expect(test.session.tapAnswer(correctAnswerOf(test.session))).toBe('correct');
  });
});

describe('#170 AC3, #186 AC3: desátá hvězdička → Rudy → karta s mapou', () => {
  it('po doletu 10. hvězdičky přiskočí Rudy s oslavou, ještě bez konfet a mapy', () => {
    const game = enterWithRudy();
    fillRow(game);
    expect(game.rudy.isWaiting()).toBe(true);
    game.rudy.openPending();
    game.timers.advance(10_000);
    expect(game.session.starCount(), 'hvězdičky svítí v řadě').toBe(STARS_PER_SET);
    expect(game.changes).not.toContain('celebrationStarted');
    expect(game.changes).not.toContain('mapShown');
    expect(game.device.sounds.played).not.toContain(SOUNDS.celebration);
  });

  it('po odchodu Rudyho začnou konfety s melodií hned a karta s mapou přijde za nimi', () => {
    const game = enterWithRudy();
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

  it('během Rudyho nejde odpovídat a hvězdička nepřibude', () => {
    const game = enterWithRudy();
    fillRow(game);
    game.rudy.openPending();
    expect(game.session.rudyOpen()).toBe(true);
    expect(game.session.tapAnswer(correctAnswerOf(game.session))).toBe('ignored');
    expect(game.session.answerWritten(game.session.round(), 'correct')).toBe('ignored');
    expect(game.session.tapHintButton()).toBe(false);
    expect(game.session.tapDot(0)).toBeNull();
    expect(game.session.starCount()).toBe(STARS_PER_SET);
  });

  it('každá plná řada má jednoho Rudyho s oslavou', () => {
    const game = enterWithRudy();
    for (let row = 0; row < 2; row += 1) {
      fillRow(game);
      game.rudy.openPending();
      game.rudy.close();
      game.timers.runAll();
    }
    expect(game.rudy.requested).toBe(2);
  });

  it('nastavení otevřené, než se Rudy ukáže: oslava ani mapa se nedohrají', () => {
    const game = enterWithRudy();
    fillRow(game);
    game.device.page.holdGear();
    expect(game.rudy.isWaiting()).toBe(false);
    expect(game.changes).toContain('celebrationStopped');
    game.session.confirmSettings();
    game.timers.runAll();
    expect(game.changes).not.toContain('mapShown');
    expect(game.session.starCount()).toBe(0);
    expect(game.session.tapAnswer(correctAnswerOf(game.session))).toBe('correct');
  });

  it('odchod domečkem Rudyho pošle pryč a nic dalšího se neukáže', () => {
    const game = enterWithRudy();
    fillRow(game);
    game.rudy.openPending();
    game.session.leave();
    expect(game.rudy.stopped).toBeGreaterThan(0);
    expect(game.rudy.isShown()).toBe(false);
    game.timers.runAll();
    expect(game.changes).not.toContain('mapShown');
  });
});

describe('#186 AC4: bez staženého Rudyho oslava pokračuje hned', () => {
  it('Rudy, který se nestáhne, oslavu nezdrží: konfety a mapa přijdou jako dřív', () => {
    const game = enterWithRudy();
    fillRow(game);
    game.rudy.giveUp();
    expect(game.changes).toContain('celebrationStarted');
    game.timers.advance(CELEBRATION_TO_MAP_MS);
    expect(game.session.shownMap()).not.toBeNull();
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
    for (let star = 1; star < PREPARE_CELEBRATION_FROM_STARS; star += 1) {
      game.session.tapAnswer(correctAnswerOf(game.session));
      game.timers.runAll();
    }
    expect(game.rudy.prepared, 'do 7. hvězdičky ne').toBe(0);
    game.session.tapAnswer(correctAnswerOf(game.session));
    expect(game.rudy.prepared).toBeGreaterThan(0);
  });

  it('s 8 a více hvězdičkami po otevření hry se oslava stáhne hned', () => {
    expect(enterWithRudy(deviceWithStars(9)).rudy.prepared).toBeGreaterThan(0);
    expect(enterWithRudy(deviceWithStars(7)).rudy.prepared).toBe(0);
  });
});
