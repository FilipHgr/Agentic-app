import { describe, expect, it } from 'vitest';

import { CELEBRATION_MS, NEXT_PROBLEM_MS } from '../../../src/games/compare/logic/compareSession';
import { correctChoice } from '../../../src/games/compare/logic/compareProblems';
import type { CompareProblem } from '../../../src/games/compare/logic/compareProblems';
import { openCompare, wrongChoice } from './compareFakes';
import type { TestCompare } from './compareFakes';

/**
 * Testy k #178 AC1–AC4: příklad s tečkami na dvou kartách, správné
 * ťuknutí (hvězdička a znak mezi kartami), špatné ťuknutí (zatřesení,
 * tichý tón, nic se nebere) a ťuknutí, která se nezapočítají.
 */

/** Otevře hru a přetočí příklady, dokud nepřijde příklad, který test chce. */
function openWith(isWanted: (problem: CompareProblem) => boolean): TestCompare {
  const test = openCompare();
  for (let step = 0; step < 200 && !isWanted(test.session.problem()); step += 1) {
    test.session.tap(correctChoice(test.session.problem()));
    test.timers.runAll();
  }
  expect(isWanted(test.session.problem())).toBe(true);
  return test;
}

describe('#178 AC1: na obou kartách je 1 až 10 teček', () => {
  it('v žádném příkladu není prázdná karta ani víc než 10 teček', () => {
    const test = openCompare();
    for (let index = 0; index < 300; index += 1) {
      const { left, right } = test.session.problem();
      for (const count of [left, right]) {
        expect(Number.isInteger(count), `${left} : ${right}`).toBe(true);
        expect(count, `${left} : ${right}`).toBeGreaterThanOrEqual(1);
        expect(count, `${left} : ${right}`).toBeLessThanOrEqual(10);
      }
      test.session.tap(correctChoice(test.session.problem()));
      test.timers.runAll();
    }
  });

  it('na začátku hry nesvítí žádná hvězdička a příklad je hned připravený', () => {
    const test = openCompare();
    expect(test.session.starCount()).toBe(0);
    expect(test.session.shownSign()).toBeNull();
  });
});

describe('#178 AC2: správné ťuknutí rozsvítí hvězdičku a ukáže znak', () => {
  it('po ťuknutí na kartu s víc tečkami vlevo se přičte hvězdička a mezi kartami je „>“', () => {
    const test = openWith((problem) => problem.left > problem.right);
    expect(test.session.tap('left')).toBe('correct');
    expect(test.session.starCount()).toBe(1);
    expect(test.session.shownSign()).toBe('>');
    expect(test.sounds.played.at(-1)).toBe('correct');
  });

  it('po ťuknutí na kartu s víc tečkami vpravo je mezi kartami „<“', () => {
    const test = openWith((problem) => problem.left < problem.right);
    const before = test.session.starCount();
    expect(test.session.tap('right')).toBe('correct');
    expect(test.session.starCount()).toBe(before + 1);
    expect(test.session.shownSign()).toBe('<');
  });

  it('při stejném počtu teček ťuknutí na „=“ rozsvítí hvězdičku a ukáže „=“', () => {
    const test = openWith((problem) => problem.left === problem.right);
    const before = test.session.starCount();
    expect(test.session.tap('equal')).toBe('correct');
    expect(test.session.starCount()).toBe(before + 1);
    expect(test.session.shownSign()).toBe('=');
  });

  it('po správné odpovědi přijde chvíli potom nový příklad a znak zmizí', () => {
    const test = openCompare();
    const first = test.session.problem();
    test.session.tap(correctChoice(first));
    test.timers.advance(NEXT_PROBLEM_MS - 1);
    expect(test.session.problem()).toEqual(first);
    test.timers.advance(1);
    expect(test.session.problem()).not.toEqual(first);
    expect(test.session.shownSign()).toBeNull();
    expect(test.changes.at(-1)).toEqual({ kind: 'problemStarted' });
  });

  it('správná odpověď ohlásí scéně, kterou kartu nebo „=“ dítě ťuklo a jaký je znak', () => {
    const test = openWith((problem) => problem.left > problem.right);
    test.session.tap('left');
    expect(test.changes.at(-1)).toEqual({ kind: 'solved', choice: 'left', sign: '>' });
  });
});

describe('#178 AC3: špatné ťuknutí nic nebere, dítě zkouší dál', () => {
  it('ťuknutí na kartu s méně tečkami: karta se zatřese a zazní tichý tón', () => {
    const test = openWith((problem) => problem.left > problem.right);
    expect(test.session.tap('right')).toBe('wrong');
    expect(test.changes.at(-1)).toEqual({ kind: 'wrong', choice: 'right' });
    expect(test.sounds.played.at(-1)).toBe('wrong');
  });

  it('ťuknutí na „=“, když počty nejsou stejné, je špatně a „=“ se zatřese', () => {
    const test = openWith((problem) => problem.left !== problem.right);
    expect(test.session.tap('equal')).toBe('wrong');
    expect(test.changes.at(-1)).toEqual({ kind: 'wrong', choice: 'equal' });
  });

  it('ťuknutí na kartu při stejném počtu je špatně', () => {
    const test = openWith((problem) => problem.left === problem.right);
    expect(test.session.tap('left')).toBe('wrong');
    expect(test.session.tap('right')).toBe('wrong');
  });

  it('po chybě se hvězdička nebere, příklad zůstává a znak se neukáže', () => {
    const test = openCompare();
    test.session.tap(correctChoice(test.session.problem()));
    test.timers.runAll();
    const stars = test.session.starCount();
    const problem = test.session.problem();
    test.session.tap(wrongChoice(test));
    test.session.tap(wrongChoice(test));
    test.timers.runAll();
    expect(test.session.starCount()).toBe(stars);
    expect(test.session.problem()).toEqual(problem);
    expect(test.session.shownSign()).toBeNull();
  });

  it('za správnou odpověď po chybách je hvězdička jako jindy', () => {
    const test = openCompare();
    test.session.tap(wrongChoice(test));
    test.session.tap(wrongChoice(test));
    test.session.tap(wrongChoice(test));
    expect(test.session.tap(correctChoice(test.session.problem()))).toBe('correct');
    expect(test.session.starCount()).toBe(1);
  });
});

describe('#178 AC4: ťuknutí, která se nezapočítají', () => {
  it('druhé ťuknutí po správné odpovědi nedá další hvězdičku ani zvuk', () => {
    const test = openCompare();
    const choice = correctChoice(test.session.problem());
    test.session.tap(choice);
    const played = test.sounds.played.length;
    expect(test.session.tap(choice)).toBe('ignored');
    expect(test.session.starCount()).toBe(1);
    expect(test.sounds.played).toHaveLength(played);
  });

  it('ťuknutí na jinou kartu nebo „=“ během přechodu na nový příklad se nepočítá jako chyba', () => {
    const test = openCompare();
    test.session.tap(correctChoice(test.session.problem()));
    const changes = test.changes.length;
    test.timers.advance(NEXT_PROBLEM_MS / 2);
    for (const choice of ['left', 'right', 'equal'] as const) {
      expect(test.session.tap(choice)).toBe('ignored');
    }
    expect(test.changes).toHaveLength(changes);
    expect(test.session.starCount()).toBe(1);
  });

  it('po přechodu se v novém příkladu zase počítá', () => {
    const test = openCompare();
    test.session.tap(correctChoice(test.session.problem()));
    test.timers.advance(NEXT_PROBLEM_MS);
    expect(test.session.tap(correctChoice(test.session.problem()))).toBe('correct');
    expect(test.session.starCount()).toBe(2);
  });

  it('během oslavy se ťuknutí nepočítají', () => {
    const test = openCompare();
    for (let index = 0; index < 9; index += 1) {
      test.session.tap(correctChoice(test.session.problem()));
      test.timers.runAll();
    }
    test.session.tap(correctChoice(test.session.problem()));
    test.timers.advance(NEXT_PROBLEM_MS);
    expect(test.session.isCelebrating()).toBe(true);
    for (const choice of ['left', 'right', 'equal'] as const) {
      expect(test.session.tap(choice)).toBe('ignored');
    }
    test.timers.advance(CELEBRATION_MS);
    expect(test.session.isCelebrating()).toBe(false);
  });

  it('po odchodu z hry se nic nepočítá, nic nečeká a zvuky se ztiší', () => {
    const test = openCompare();
    test.session.tap(correctChoice(test.session.problem()));
    test.session.leave();
    expect(test.timers.count).toBe(0);
    expect(test.sounds.stopped).toBeGreaterThan(0);
    expect(test.session.tap(correctChoice(test.session.problem()))).toBe('ignored');
  });
});
