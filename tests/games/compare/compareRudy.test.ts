import { describe, expect, it } from 'vitest';

import {
  NEXT_PROBLEM_MS,
  PREPARE_CELEBRATION_FROM_STARS,
} from '../../../src/games/compare/logic/compareSession';
import { correctSign } from '../../../src/games/compare/logic/compareProblems';
import { STARS_PER_SET } from '../../../src/shared/logic/stars';
import { FakeRudy, MemoryStorage, openCompare, wrongSign } from './compareFakes';
import type { TestCompare } from './compareFakes';

/**
 * Testy k #181 AC2, AC4 a #186 AC1, AC3, AC4 v sezení Porovnávání: Rudy
 * se ukazuje jen po 10. hvězdičce, po otevření hry nepozdraví. Po 10.
 * hvězdičce přiskočí Rudy s oslavou a konfety přijdou až po jeho odchodu.
 * Rudy, který se nestáhne, oslavu nezdrží. Rudy je `FakeRudy`
 * z `compareFakes.ts`.
 */

interface RudyCompare extends TestCompare {
  readonly rudy: FakeRudy;
}

/** Dítě otevře Porovnávání s Rudym, kterého ukazuje a posílá pryč test. */
function openWithRudy(storage?: MemoryStorage): RudyCompare {
  const rudy = new FakeRudy();
  return { ...openCompare(storage, undefined, rudy), rudy };
}

/** Dítě ťukne na správné znaménko. */
function tapCorrect(game: TestCompare) {
  return game.session.tap(correctSign(game.session.problem()));
}

/** Dítě vyřeší 9 příkladů a ťukne správně na 10.; řada se zaplní. */
function fillRow(game: TestCompare): void {
  for (let solved = 0; solved < STARS_PER_SET - 1; solved += 1) {
    tapCorrect(game);
    game.timers.advance(NEXT_PROBLEM_MS);
  }
  game.changes.length = 0;
  tapCorrect(game);
  game.timers.advance(NEXT_PROBLEM_MS);
}

/** Úložiště hry, ve kterém už je `earned` hvězdiček v řadě. */
function storageWithStars(earned: number): MemoryStorage {
  const storage = new MemoryStorage();
  const game = openCompare(storage);
  for (let star = 0; star < earned; star += 1) {
    game.session.tap(correctSign(game.session.problem()));
    game.timers.advance(NEXT_PROBLEM_MS);
  }
  game.session.leave();
  return storage;
}

function kinds(game: TestCompare): string[] {
  return game.changes.map((change) => change.kind);
}

describe('#186 AC1: Rudy se v Porovnávání ukazuje jen po 10. hvězdičce', () => {
  it('po otevření hry Rudy nepozdraví a odpovídat jde hned', () => {
    const game = openWithRudy();
    expect(game.rudy.requested).toBe(0);
    expect(game.rudy.isWaiting()).toBe(false);
    expect(tapCorrect(game)).toBe('correct');
    expect(game.session.starCount()).toBe(1);
  });

  it('během řady (1. až 9. hvězdička) ani po chybách se Rudy neukáže', () => {
    const game = openWithRudy();
    expect(game.session.tap(wrongSign(game))).toBe('wrong');
    for (let star = 1; star < STARS_PER_SET; star += 1) {
      tapCorrect(game);
      game.timers.advance(NEXT_PROBLEM_MS);
    }
    expect(game.session.starCount()).toBe(STARS_PER_SET - 1);
    expect(game.rudy.requested).toBe(0);
  });

  it('po ✓ nastavení bez plné řady se Rudy neukáže', () => {
    const game = openWithRudy();
    game.gear.hold();
    game.session.confirmSettings();
    expect(game.rudy.requested).toBe(0);
    expect(tapCorrect(game)).toBe('correct');
  });
});

describe('#181 AC2, #186 AC3, #187 AC4: po 10. hvězdičce Rudy, konfety až po jeho odchodu', () => {
  it('po 10. hvězdičce přiskočí Rudy s oslavou, ještě bez konfet a melodie', () => {
    const game = openWithRudy();
    fillRow(game);
    expect(game.rudy.isWaiting()).toBe(true);
    game.rudy.openPending();
    game.timers.advance(10_000);
    expect(game.session.starCount(), 'hvězdičky svítí v řadě').toBe(STARS_PER_SET);
    expect(kinds(game)).not.toContain('celebrationStarted');
    expect(game.sounds.played).not.toContain('celebration');
  });

  it('po odchodu Rudyho začnou konfety s melodií hned a pak přijde prázdná řada', () => {
    const game = openWithRudy();
    fillRow(game);
    game.rudy.openPending();
    game.rudy.close();
    expect(kinds(game)).toContain('celebrationStarted');
    expect(game.sounds.played).toContain('celebration');
    game.timers.runAll();
    expect(kinds(game)).toContain('celebrationEnded');
    expect(game.session.starCount()).toBe(0);
  });

  it('během Rudyho nejde odpovídat, hvězdička nepřibude a ťuknutí nezazní jako odpověď', () => {
    const game = openWithRudy();
    fillRow(game);
    game.rudy.openPending();
    const played = game.sounds.played.length;
    expect(tapCorrect(game)).toBe('ignored');
    expect(game.session.tap(wrongSign(game))).toBe('ignored');
    expect(game.session.starCount()).toBe(STARS_PER_SET);
    expect(game.sounds.played).toHaveLength(played);
  });

  it('každá plná řada má jednoho Rudyho s oslavou', () => {
    const game = openWithRudy();
    for (let row = 0; row < 2; row += 1) {
      fillRow(game);
      game.rudy.openPending();
      game.rudy.close();
      game.timers.runAll();
    }
    expect(game.rudy.requested).toBe(2);
  });

  it('nastavení otevřené, než se Rudy ukáže: po ✓ přijde Rudy a teprve pak konfety', () => {
    const game = openWithRudy();
    fillRow(game);
    game.gear.hold();
    expect(game.rudy.isWaiting(), 'Rudy se během nastavení neukáže').toBe(false);
    game.session.confirmSettings();
    expect(game.rudy.isWaiting()).toBe(true);
    expect(kinds(game)).not.toContain('celebrationStarted');
    game.rudy.openPending();
    game.rudy.close();
    expect(kinds(game)).toContain('celebrationStarted');
  });

  it('Rudy, kterého už dítě vidělo, se po ✓ nastavení neopakuje: konfety hned', () => {
    const game = openWithRudy();
    fillRow(game);
    game.rudy.openPending();
    game.gear.hold();
    game.session.confirmSettings();
    expect(game.rudy.requested).toBe(1);
    expect(kinds(game)).toContain('celebrationStarted');
  });

  it('odchod domečkem Rudyho pošle pryč a nic dalšího se neukáže', () => {
    const game = openWithRudy();
    fillRow(game);
    game.rudy.openPending();
    game.session.leave();
    expect(game.rudy.stopped).toBeGreaterThan(0);
    expect(game.rudy.isShown()).toBe(false);
  });

  it('od 8. hvězdičky v řadě se oslava stahuje dopředu, dřív ne', () => {
    expect(PREPARE_CELEBRATION_FROM_STARS).toBe(8);
    const game = openWithRudy();
    for (let star = 1; star < PREPARE_CELEBRATION_FROM_STARS; star += 1) {
      tapCorrect(game);
      game.timers.advance(NEXT_PROBLEM_MS);
    }
    expect(game.rudy.prepared, 'do 7. hvězdičky ne').toBe(0);
    tapCorrect(game);
    expect(game.rudy.prepared).toBeGreaterThan(0);
  });

  it('s 8 a více hvězdičkami po otevření hry se oslava stáhne hned', () => {
    expect(openWithRudy(storageWithStars(9)).rudy.prepared).toBeGreaterThan(0);
    expect(openWithRudy(storageWithStars(7)).rudy.prepared).toBe(0);
  });
});

describe('#181 AC4, #186 AC4: bez Rudyho hra pokračuje a hráč chybu nevidí', () => {
  it('Rudy, který se nestáhne, oslavu nezdrží: konfety přijdou hned', () => {
    const game = openWithRudy();
    fillRow(game);
    game.rudy.giveUp();
    expect(kinds(game)).toContain('celebrationStarted');
    game.timers.runAll();
    expect(game.session.starCount()).toBe(0);
    expect(tapCorrect(game)).toBe('correct');
  });

  it('hra bez Rudyho jde hrát hned a oslava přijde jako dřív', () => {
    const game = openCompare();
    fillRow(game);
    expect(kinds(game), 'oslava začne hned po 10. hvězdičce').toContain('celebrationStarted');
  });
});
