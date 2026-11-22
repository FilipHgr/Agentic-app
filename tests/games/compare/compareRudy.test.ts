import { describe, expect, it } from 'vitest';

import {
  NEXT_PROBLEM_MS,
  PREPARE_CELEBRATION_FROM_STARS,
} from '../../../src/games/compare/logic/compareSession';
import { correctChoice } from '../../../src/games/compare/logic/compareProblems';
import { STARS_PER_SET } from '../../../src/shared/logic/stars';
import { FakeRudy, MemoryStorage, openCompare, wrongChoice } from './compareFakes';
import type { TestCompare } from './compareFakes';

/**
 * Testy k #181 AC1, AC2 a AC4 v sezení Porovnávání: po otevření hry Rudy
 * jednou pozdraví a odpovídat jde až po zavření okna (pozdrav se vynechá,
 * když dítě mezitím hraje). Po 10. hvězdičce se ukáže okno s oslavou
 * a konfety přijdou až po jeho zavření. Okno, které se nestáhne, hru ani
 * oslavu nezdrží. Okno s pandou je `FakeRudy` z `compareFakes.ts`.
 */

interface RudyCompare extends TestCompare {
  readonly rudy: FakeRudy;
}

/** Dítě otevře Porovnávání s oknem s pandou, které ukazuje a zavírá test. */
function openWithRudy(storage?: MemoryStorage): RudyCompare {
  const rudy = new FakeRudy();
  return { ...openCompare(storage, undefined, rudy), rudy };
}

/** Pozdrav se ukáže a zavře, hra je připravená na odpovědi. */
function closeGreeting(game: RudyCompare): void {
  game.rudy.openPending();
  game.rudy.close();
}

/** Dítě ťukne správně na kartu (nebo „=“). */
function tapCorrect(game: TestCompare) {
  return game.session.tap(correctChoice(game.session.problem()));
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
    game.session.tap(correctChoice(game.session.problem()));
    game.timers.advance(NEXT_PROBLEM_MS);
  }
  game.session.leave();
  return storage;
}

function kinds(game: TestCompare): string[] {
  return game.changes.map((change) => change.kind);
}

describe('#181 AC1: Rudy po otevření Porovnávání pozdraví', () => {
  it('po otevření hry se jednou ukáže okno s pozdravem', () => {
    const game = openWithRudy();
    expect(game.rudy.requested).toEqual(['wave']);
    closeGreeting(game);
    tapCorrect(game);
    game.timers.advance(NEXT_PROBLEM_MS);
    expect(game.rudy.requested, 'pozdrav jen jednou').toEqual(['wave']);
  });

  it('během okna s pozdravem nejde odpovídat, po zavření ano', () => {
    const game = openWithRudy();
    game.rudy.openPending();
    expect(tapCorrect(game)).toBe('ignored');
    expect(game.session.tap(wrongChoice(game))).toBe('ignored');
    expect(game.session.starCount()).toBe(0);
    expect(game.sounds.played, 'ťuknutí do okna nezazní jako odpověď').toEqual([]);
    game.rudy.close();
    expect(tapCorrect(game)).toBe('correct');
    expect(game.session.starCount()).toBe(1);
  });

  it('správné ťuknutí během stahování pozdrav vynechá a hvězdička se počítá', () => {
    const game = openWithRudy();
    expect(game.rudy.waitingMove()).toBe('wave');
    expect(tapCorrect(game)).toBe('correct');
    expect(game.session.starCount()).toBe(1);
    expect(game.rudy.waitingMove(), 'pozdrav už nečeká').toBeNull();
    game.rudy.openPending();
    expect(game.rudy.openMove(), 'pozdrav nevyskočí uprostřed hraní').toBeNull();
  });

  it('i špatné ťuknutí během stahování pozdrav vynechá', () => {
    const game = openWithRudy();
    expect(game.session.tap(wrongChoice(game))).toBe('wrong');
    expect(game.rudy.waitingMove()).toBeNull();
  });

  it('nastavení otevřené dřív, než se pozdrav ukáže, pozdrav zruší a po ✓ se neopakuje', () => {
    const game = openWithRudy();
    game.gear.hold();
    expect(game.rudy.waitingMove()).toBeNull();
    game.session.confirmSettings();
    expect(game.rudy.requested).toEqual(['wave']);
    expect(tapCorrect(game)).toBe('correct');
  });

  it('odchod domečkem okno zavře a nic dalšího se neukáže', () => {
    const game = openWithRudy();
    game.rudy.openPending();
    game.session.leave();
    expect(game.rudy.stopped).toBeGreaterThan(0);
    expect(game.rudy.openMove()).toBeNull();
  });
});

describe('#181 AC2: po 10. hvězdičce okno s oslavou, konfety až po jeho zavření', () => {
  it('po 10. hvězdičce se ukáže okno s oslavou, ještě bez konfet a melodie', () => {
    const game = openWithRudy();
    closeGreeting(game);
    fillRow(game);
    expect(game.rudy.waitingMove()).toBe('celebrate');
    game.rudy.openPending();
    game.timers.advance(10_000);
    expect(game.session.starCount(), 'hvězdičky svítí v řadě').toBe(STARS_PER_SET);
    expect(kinds(game)).not.toContain('celebrationStarted');
    expect(game.sounds.played).not.toContain('celebration');
  });

  it('po zavření okna začnou konfety s melodií hned a pak přijde prázdná řada', () => {
    const game = openWithRudy();
    closeGreeting(game);
    fillRow(game);
    game.rudy.openPending();
    game.rudy.close();
    expect(kinds(game)).toContain('celebrationStarted');
    expect(game.sounds.played).toContain('celebration');
    game.timers.runAll();
    expect(kinds(game)).toContain('celebrationEnded');
    expect(game.session.starCount()).toBe(0);
  });

  it('během okna s oslavou nejde odpovídat a hvězdička nepřibude', () => {
    const game = openWithRudy();
    closeGreeting(game);
    fillRow(game);
    game.rudy.openPending();
    expect(tapCorrect(game)).toBe('ignored');
    expect(game.session.starCount()).toBe(STARS_PER_SET);
  });

  it('každá plná řada má jedno okno s oslavou a pozdrav se neopakuje', () => {
    const game = openWithRudy();
    closeGreeting(game);
    for (let row = 0; row < 2; row += 1) {
      fillRow(game);
      game.rudy.openPending();
      game.rudy.close();
      game.timers.runAll();
    }
    expect(game.rudy.requested).toEqual(['wave', 'celebrate', 'celebrate']);
  });

  it('nastavení otevřené, než se okno s oslavou ukáže: po ✓ přijde okno a teprve pak konfety', () => {
    const game = openWithRudy();
    closeGreeting(game);
    fillRow(game);
    game.gear.hold();
    expect(game.rudy.waitingMove(), 'okno se během nastavení neukáže').toBeNull();
    game.session.confirmSettings();
    expect(game.rudy.waitingMove()).toBe('celebrate');
    expect(kinds(game)).not.toContain('celebrationStarted');
    game.rudy.openPending();
    game.rudy.close();
    expect(kinds(game)).toContain('celebrationStarted');
  });

  it('okno s oslavou, které už dítě vidělo, se po ✓ nastavení neopakuje: konfety hned', () => {
    const game = openWithRudy();
    closeGreeting(game);
    fillRow(game);
    game.rudy.openPending();
    game.gear.hold();
    game.session.confirmSettings();
    expect(game.rudy.requested).toEqual(['wave', 'celebrate']);
    expect(kinds(game)).toContain('celebrationStarted');
  });

  it('od 8. hvězdičky v řadě se oslava stahuje dopředu, dřív ne', () => {
    expect(PREPARE_CELEBRATION_FROM_STARS).toBe(8);
    const game = openWithRudy();
    closeGreeting(game);
    for (let star = 1; star < PREPARE_CELEBRATION_FROM_STARS; star += 1) {
      tapCorrect(game);
      game.timers.advance(NEXT_PROBLEM_MS);
    }
    expect(game.rudy.prepared, 'do 7. hvězdičky ne').toEqual([]);
    tapCorrect(game);
    expect(game.rudy.prepared).toContain('celebrate');
  });

  it('s 8 a více hvězdičkami po otevření se oslava stáhne až po pozdravu', () => {
    const game = openWithRudy(storageWithStars(9));
    expect(game.rudy.prepared, 'během pozdravu ne').toEqual([]);
    closeGreeting(game);
    expect(game.rudy.prepared).toEqual(['celebrate']);
  });
});

describe('#181 AC4: bez okna nebo hlasu hra pokračuje a hráč chybu nevidí', () => {
  it('pozdrav, který se nestáhne, hru nezdrží', () => {
    const game = openWithRudy();
    game.rudy.giveUp();
    expect(tapCorrect(game)).toBe('correct');
  });

  it('okno s oslavou, které se nestáhne, oslavu nezdrží: konfety přijdou hned', () => {
    const game = openWithRudy();
    closeGreeting(game);
    fillRow(game);
    game.rudy.giveUp();
    expect(kinds(game)).toContain('celebrationStarted');
    game.timers.runAll();
    expect(game.session.starCount()).toBe(0);
    expect(tapCorrect(game)).toBe('correct');
  });

  it('hra bez okna s pandou jde hrát hned a oslava přijde jako dřív', () => {
    const game = openCompare();
    fillRow(game);
    expect(kinds(game), 'oslava začne hned po 10. hvězdičce').toContain('celebrationStarted');
  });
});
