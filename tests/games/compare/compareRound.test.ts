import { describe, expect, it } from 'vitest';

import { CELEBRATION_MS, NEXT_PROBLEM_MS } from '../../../src/games/compare/logic/compareSession';
import { holds } from '../../../src/games/compare/logic/compareProblems';
import type { CompareProblem } from '../../../src/games/compare/logic/compareProblems';
import { arithmeticOf, openCompare, rightSign, solveProblem, wrongSign } from './compareFakes';
import type { TestCompare } from './compareFakes';

/**
 * Testy k #187 AC1 a AC2: příklad „a ☐ b = c“, do okénka dítě doplní
 * + nebo − ťuknutím. Správně → hvězdička, znaménko v okénku a za chvíli
 * další příklad; špatně → tichý tón, zatřesení, okénko se vyprázdní a nic
 * se nebere. Ťuknutí během přechodu a oslavy se nepočítají.
 */

/** Otevře hru a řeší příklady, dokud nepřijde příklad, který test chce. */
function openWith(isWanted: (problem: CompareProblem) => boolean): TestCompare {
  const test = openCompare();
  for (let step = 0; step < 200 && !isWanted(test.session.problem()); step += 1) {
    solveProblem(test);
  }
  expect(isWanted(test.session.problem())).toBe(true);
  return test;
}

describe('#187 AC1: příklad „a ☐ b = c“ s jediným správným znaménkem', () => {
  it('v každém příkladu platí právě jedno znaménko a všechna čísla jsou 0 až 10', () => {
    const test = openCompare();
    for (let index = 0; index < 300; index += 1) {
      const problem = arithmeticOf(test.session.problem());
      const name = `${problem.a} ☐ ${problem.b} = ${problem.result}`;
      expect(holds(problem, '+') !== holds(problem, '−'), name).toBe(true);
      for (const number of [problem.a, problem.b, problem.result]) {
        expect(Number.isInteger(number), name).toBe(true);
        expect(number, name).toBeGreaterThanOrEqual(0);
        expect(number, name).toBeLessThanOrEqual(10);
      }
      solveProblem(test);
    }
  });

  it('na začátku hry nesvítí žádná hvězdička a okénko je prázdné', () => {
    const test = openCompare();
    expect(test.session.starCount()).toBe(0);
    expect(test.session.filledSign()).toBeNull();
  });
});

describe('#187 AC2: správné znaménko dá hvězdičku a okénko zezelená', () => {
  it('ťuknutí na + v příkladu se sčítáním přičte hvězdičku a + zůstane v okénku', () => {
    const test = openWith((problem) => holds(problem, '+'));
    const before = test.session.starCount();
    expect(test.session.tap('+')).toBe('correct');
    expect(test.session.starCount()).toBe(before + 1);
    expect(test.session.filledSign()).toBe('+');
    expect(test.sounds.played.at(-1)).toBe('correct');
    expect(test.changes.at(-1)).toEqual({ kind: 'solved', sign: '+' });
  });

  it('ťuknutí na − v příkladu s odčítáním přičte hvězdičku a − zůstane v okénku', () => {
    const test = openWith((problem) => holds(problem, '−'));
    const before = test.session.starCount();
    expect(test.session.tap('−')).toBe('correct');
    expect(test.session.starCount()).toBe(before + 1);
    expect(test.session.filledSign()).toBe('−');
  });

  it('po správné odpovědi přijde chvíli potom nový příklad s prázdným okénkem', () => {
    const test = openCompare();
    const first = test.session.problem();
    test.session.tap(rightSign(test));
    test.timers.advance(NEXT_PROBLEM_MS - 1);
    expect(test.session.problem()).toEqual(first);
    test.timers.advance(1);
    expect(test.session.problem()).not.toEqual(first);
    expect(test.session.filledSign()).toBeNull();
    expect(test.changes.at(-1)).toEqual({ kind: 'problemStarted' });
  });
});

describe('#187 AC2: špatné znaménko nic nebere, dítě zkouší dál', () => {
  it('po špatném znaménku zazní tichý tón a okénko se zatřese', () => {
    const test = openCompare();
    const sign = wrongSign(test);
    expect(test.session.tap(sign)).toBe('wrong');
    expect(test.sounds.played.at(-1)).toBe('wrong');
    expect(test.changes.at(-1)).toEqual({ kind: 'wrong', sign });
  });

  it('po chybě se okénko vyprázdní, hvězdička se nebere a příklad zůstává', () => {
    const test = openCompare();
    solveProblem(test);
    const stars = test.session.starCount();
    const problem = test.session.problem();
    test.session.tap(wrongSign(test));
    test.session.tap(wrongSign(test));
    test.timers.runAll();
    expect(test.session.starCount()).toBe(stars);
    expect(test.session.problem()).toEqual(problem);
    expect(test.session.filledSign()).toBeNull();
  });

  it('za správné znaménko po chybách je hvězdička jako jindy', () => {
    const test = openCompare();
    test.session.tap(wrongSign(test));
    test.session.tap(wrongSign(test));
    test.session.tap(wrongSign(test));
    expect(test.session.tap(rightSign(test))).toBe('correct');
    expect(test.session.starCount()).toBe(1);
  });
});

describe('#187 AC2: ťuknutí, která se nezapočítají', () => {
  it('druhé ťuknutí po správné odpovědi nedá další hvězdičku ani zvuk', () => {
    const test = openCompare();
    const sign = rightSign(test);
    test.session.tap(sign);
    const played = test.sounds.played.length;
    expect(test.session.tap(sign)).toBe('ignored');
    expect(test.session.starCount()).toBe(1);
    expect(test.sounds.played).toHaveLength(played);
  });

  it('ťuknutí na + i − během přechodu na nový příklad se nepočítá jako chyba', () => {
    const test = openCompare();
    test.session.tap(rightSign(test));
    const changes = test.changes.length;
    test.timers.advance(NEXT_PROBLEM_MS / 2);
    for (const sign of ['+', '−'] as const) {
      expect(test.session.tap(sign)).toBe('ignored');
    }
    expect(test.changes).toHaveLength(changes);
    expect(test.session.starCount()).toBe(1);
  });

  it('během oslavy se ťuknutí nepočítají', () => {
    const test = openCompare();
    for (let index = 0; index < 9; index += 1) {
      solveProblem(test);
    }
    test.session.tap(rightSign(test));
    test.timers.advance(NEXT_PROBLEM_MS);
    expect(test.session.isCelebrating()).toBe(true);
    for (const sign of ['+', '−'] as const) {
      expect(test.session.tap(sign)).toBe('ignored');
    }
    test.timers.advance(CELEBRATION_MS);
    expect(test.session.isCelebrating()).toBe(false);
  });

  it('po odchodu z hry se nic nepočítá, nic nečeká a zvuky se ztiší', () => {
    const test = openCompare();
    test.session.tap(rightSign(test));
    test.session.leave();
    expect(test.timers.count).toBe(0);
    expect(test.sounds.stopped).toBeGreaterThan(0);
    expect(test.session.tap(rightSign(test))).toBe('ignored');
  });
});

describe('#187: ťuknutí na okénko není odpověď', () => {
  it('po ťuknutí na prázdné okénko se okénko zhoupne s jemným tónem a tlačítka se rozsvítí, hvězdička ani chyba nepřibude', () => {
    const test = openCompare();
    const problem = test.session.problem();
    expect(test.session.tapBox()).toBe(true);
    expect(test.changes.at(-1)).toEqual({ kind: 'boxTapped' });
    expect(test.sounds.played).toEqual(['boxTap']);
    expect(test.sounds.played).not.toContain('wrong');
    expect(test.session.starCount()).toBe(0);
    expect(test.session.filledSign()).toBeNull();
    expect(test.session.problem()).toEqual(problem);
    expect(test.session.tap(rightSign(test))).toBe('correct');
  });

  it('opakované ťuknutí na okénko příklad nemění a dítě pak odpoví jako jindy', () => {
    const test = openCompare();
    const problem = test.session.problem();
    for (let tap = 0; tap < 5; tap += 1) {
      test.session.tapBox();
    }
    test.timers.runAll();
    expect(test.session.problem()).toEqual(problem);
    expect(test.session.tap(rightSign(test))).toBe('correct');
    expect(test.session.starCount()).toBe(1);
  });

  it('po správné odpovědi, během oslavy, s otevřeným nastavením a po odchodu ťuknutí na okénko nic neudělá', () => {
    const solved = openCompare();
    solved.session.tap(rightSign(solved));
    const played = solved.sounds.played.length;
    expect(solved.session.tapBox()).toBe(false);
    expect(solved.sounds.played).toHaveLength(played);

    const celebrating = openCompare();
    for (let index = 0; index < 9; index += 1) {
      solveProblem(celebrating);
    }
    celebrating.session.tap(rightSign(celebrating));
    celebrating.timers.advance(NEXT_PROBLEM_MS);
    expect(celebrating.session.isCelebrating()).toBe(true);
    expect(celebrating.session.tapBox()).toBe(false);

    const withSettings = openCompare();
    withSettings.gear.hold();
    expect(withSettings.session.tapBox()).toBe(false);

    const left = openCompare();
    left.session.leave();
    expect(left.session.tapBox()).toBe(false);
    expect(left.changes).not.toContainEqual({ kind: 'boxTapped' });
  });
});
