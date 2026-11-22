import { describe, expect, it } from 'vitest';

import {
  PAIRING_MAX_MS,
  PAIR_STEP_MIN_MS,
  lookWithHint,
  pairStartTimes,
  playHintPairing,
} from '../../../src/games/compare/logic/compareHint';
import { correctChoice } from '../../../src/games/compare/logic/compareProblems';
import type { CompareProblem } from '../../../src/games/compare/logic/compareProblems';
import { COMPARE_SOUNDS } from '../../../src/games/compare/logic/compareSounds';
import { FakeTimers, openCompare, solveProblem, wrongChoice } from './compareFakes';
import type { TestCompare } from './compareFakes';

/**
 * Testy k #180: nápověda párováním teček po 2. chybě v příkladu. Po dvou
 * špatných ťuknutích se tečky obou karet spojí do dvojic a tečky bez
 * dvojice se rozsvítí. Nápověda nic nebere, hvězdička se dá i po ní
 * a další příklad začíná bez nápovědy. Rozložení teček nápovědy je
 * v `compareHintLayout.test.ts`.
 */

/** Otevře hru a přetočí příklady, dokud nepřijde příklad, který test chce. */
function openWith(isWanted: (problem: CompareProblem) => boolean): TestCompare {
  const test = openCompare();
  for (let step = 0; step < 200 && !isWanted(test.session.problem()); step += 1) {
    solveProblem(test);
  }
  expect(isWanted(test.session.problem())).toBe(true);
  return test;
}

/** Dítě ťukne `count`krát špatně. */
function tapWrong(test: TestCompare, count: number): void {
  for (let index = 0; index < count; index += 1) {
    test.session.tap(wrongChoice(test));
  }
}

function hintAnnouncements(test: TestCompare): number {
  return test.changes.filter((change) => change.kind === 'hintShown').length;
}

describe('#180 AC5: po 1. chybě se nápověda neukáže', () => {
  it('na začátku příkladu žádná nápověda není', () => {
    const test = openCompare();
    expect(test.session.hintShown()).toBe(false);
    expect(hintAnnouncements(test)).toBe(0);
  });

  it('po jednom špatném ťuknutí dítě nápovědu nevidí', () => {
    const test = openCompare();
    tapWrong(test, 1);
    expect(test.session.hintShown()).toBe(false);
    expect(hintAnnouncements(test)).toBe(0);
  });
});

describe('#180 AC1: po 2. špatném ťuknutí se tečky spojí do dvojic', () => {
  it('po druhém špatném ťuknutí v příkladu se nápověda hned ukáže', () => {
    const test = openCompare();
    tapWrong(test, 2);
    expect(test.session.hintShown()).toBe(true);
    expect(hintAnnouncements(test)).toBe(1);
  });

  it('nápověda se ohlásí scéně hned po zatřesení druhé chyby, bez čekání', () => {
    const test = openCompare();
    tapWrong(test, 2);
    const kinds = test.changes.map((change) => change.kind);
    expect(kinds.slice(-2)).toEqual(['wrong', 'hintShown']);
  });

  it('chyby se sčítají, ať dítě ťukne na špatnou kartu nebo na „=“', () => {
    const test = openWith((problem) => problem.left !== problem.right);
    const right = correctChoice(test.session.problem());
    const wrongCard = right === 'left' ? 'right' : 'left';
    test.session.tap(wrongCard);
    test.session.tap('equal');
    expect(test.session.hintShown()).toBe(true);
  });

  it('další chyby nápovědu neopakují, zůstane jedna a dítě zkouší dál', () => {
    const test = openCompare();
    tapWrong(test, 5);
    expect(test.session.hintShown()).toBe(true);
    expect(hintAnnouncements(test)).toBe(1);
    expect(test.session.shownSign()).toBeNull();
  });

  it('nápověda nic nebere: hvězdičky zůstanou a obě chyby zazní jen tichým tónem chyby', () => {
    const test = openCompare();
    solveProblem(test);
    solveProblem(test);
    tapWrong(test, 2);
    expect(test.session.starCount()).toBe(2);
    expect(test.sounds.played.slice(-2)).toEqual(['wrong', 'wrong']);
  });

  it('dvojice se začnou spojovat hned a celé spárování trvá nejvýš 2 s i při 20 dvojicích', () => {
    for (let pairs = 0; pairs <= 20; pairs += 1) {
      const times = pairStartTimes(pairs);
      expect(times, `${pairs} dvojic`).toHaveLength(pairs);
      if (pairs > 0) {
        expect(times[0], `${pairs} dvojic`).toBe(0);
        expect(times[pairs - 1] ?? 0, `${pairs} dvojic`).toBeLessThanOrEqual(PAIRING_MAX_MS);
      }
    }
    expect(PAIRING_MAX_MS).toBeLessThanOrEqual(2000);
  });

  it('dítě stihne vidět každou dvojici zvlášť: dvojice jdou po sobě s odstupem', () => {
    for (let pairs = 2; pairs <= 20; pairs += 1) {
      const times = pairStartTimes(pairs);
      for (let index = 1; index < times.length; index += 1) {
        const step = (times[index] ?? 0) - (times[index - 1] ?? 0);
        expect(step, `${pairs} dvojic`).toBeGreaterThanOrEqual(PAIR_STEP_MIN_MS);
      }
    }
    expect(PAIR_STEP_MIN_MS).toBeGreaterThanOrEqual(80);
  });

  it('spojení dvojice zazní jemně, tišeji než veselá melodie za správnou odpověď', () => {
    const loudest = (tones: readonly { volume: number }[]): number =>
      Math.max(...tones.map((tone) => tone.volume));
    expect(COMPARE_SOUNDS.pair.length).toBeGreaterThan(0);
    expect(loudest(COMPARE_SOUNDS.pair)).toBeLessThan(loudest(COMPARE_SOUNDS.correct));
  });
});

describe('#180 AC3: v režimu „čísla“ se pod čísly objeví tečky', () => {
  it('s nápovědou karta s čísly ukáže i tečky pod číslem, ve stejném rozsahu', () => {
    for (const maxNumber of [5, 10, 20] as const) {
      expect(lookWithHint({ maxNumber, show: 'numbers' })).toEqual({ maxNumber, show: 'both' });
    }
  });

  it('s tečkami nebo tečkami s číslem zůstane karta, jak byla', () => {
    for (const maxNumber of [5, 10, 20] as const) {
      for (const show of ['dots', 'both'] as const) {
        expect(lookWithHint({ maxNumber, show })).toEqual({ maxNumber, show });
      }
    }
  });
});

describe('#180 AC4: hvězdička i po nápovědě, další příklad bez nápovědy', () => {
  it('po nápovědě dá správné ťuknutí hvězdičku a znak jako jindy', () => {
    const test = openCompare();
    tapWrong(test, 2);
    expect(test.session.tap(correctChoice(test.session.problem()))).toBe('correct');
    expect(test.session.starCount()).toBe(1);
    expect(test.session.shownSign()).not.toBeNull();
  });

  it('nápověda zůstane vidět až do konce vyřešeného příkladu', () => {
    const test = openCompare();
    tapWrong(test, 2);
    test.session.tap(correctChoice(test.session.problem()));
    expect(test.session.hintShown()).toBe(true);
  });

  it('další příklad začíná bez nápovědy', () => {
    const test = openCompare();
    tapWrong(test, 2);
    solveProblem(test);
    expect(test.session.hintShown()).toBe(false);
  });

  it('chyby se do dalšího příkladu nepřenáší: jedna chyba v každém ze dvou příkladů nápovědu neukáže', () => {
    const test = openCompare();
    tapWrong(test, 1);
    solveProblem(test);
    tapWrong(test, 1);
    expect(test.session.hintShown()).toBe(false);
    expect(hintAnnouncements(test)).toBe(0);
  });

  it('i po oslavě 10. hvězdičky začíná nový příklad bez nápovědy', () => {
    const test = openCompare();
    for (let index = 0; index < 9; index += 1) {
      solveProblem(test);
    }
    tapWrong(test, 2);
    solveProblem(test);
    expect(test.changes.some((change) => change.kind === 'celebrationEnded')).toBe(true);
    expect(test.session.hintShown()).toBe(false);
  });

  it('ťuknutí během přechodu na další příklad se nepočítá jako chyba ani do nápovědy', () => {
    const test = openWith((problem) => problem.left !== problem.right);
    test.session.tap(correctChoice(test.session.problem()));
    test.session.tap('equal');
    test.session.tap('equal');
    expect(test.session.hintShown()).toBe(false);
    test.timers.runAll();
    tapWrong(test, 1);
    expect(test.session.hintShown()).toBe(false);
  });

  it('po změně nastavení přijde nový příklad bez nápovědy', () => {
    const test = openCompare();
    tapWrong(test, 2);
    test.gear.hold();
    test.session.chooseSetting({ maxNumber: 20 });
    test.session.confirmSettings();
    expect(test.session.hintShown()).toBe(false);
  });

  it('při otevřeném nastavení se ťuknutí do hry nepočítají jako chyby', () => {
    const test = openCompare();
    test.gear.hold();
    tapWrong(test, 3);
    expect(test.session.hintShown()).toBe(false);
  });
});

/** Co dítě vidí a slyší při spojování dvojic: každé spojení a rozsvícení. */
function watchPairing(pairs: number, startMs = 0) {
  const timers = new FakeTimers();
  const pairedWithChime: number[] = [];
  const pairedQuietly: number[] = [];
  let lit = 0;
  const pairing = playHintPairing(pairs, startMs, timers, {
    pairUp: (pair, animate) => (animate ? pairedWithChime : pairedQuietly).push(pair),
    lightExtras: () => {
      lit += 1;
    },
  });
  return { timers, pairing, pairedWithChime, pairedQuietly, lit: () => lit };
}

describe('#180: spojování dvojic jde po jedné a dá se dokreslit hned', () => {
  it('bez ťuknutí se spojí každá dvojice jednou s cinknutím a pak se tečky bez dvojice rozsvítí', () => {
    const watch = watchPairing(6);
    expect(watch.pairedWithChime, 'hned po nápovědě').toEqual([0]);
    watch.timers.runAll();
    expect(watch.pairedWithChime).toEqual([0, 1, 2, 3, 4, 5]);
    expect(watch.pairedQuietly).toEqual([]);
    expect(watch.lit()).toBe(1);
  });

  it('když dítě ťukne správně během spojování, nápověda se hned dokreslí celá a už necinká', () => {
    const watch = watchPairing(8);
    watch.timers.advance(PAIR_STEP_MIN_MS);
    const chimedBefore = [...watch.pairedWithChime];
    expect(chimedBefore.length, 'část dvojic už je spojená').toBeLessThan(8);
    watch.pairing.finish();
    expect(watch.pairedQuietly).toEqual(
      Array.from({ length: 8 - chimedBefore.length }, (_, index) => chimedBefore.length + index),
    );
    expect(watch.lit(), 'tečky bez dvojice svítí hned').toBe(1);
    watch.timers.runAll();
    expect(watch.pairedWithChime, 'po dokreslení už nic necinká').toEqual(chimedBefore);
    expect(watch.lit()).toBe(1);
    expect(watch.timers.count).toBe(0);
  });

  it('dokreslení hotové nápovědy nic nezopakuje', () => {
    const watch = watchPairing(3);
    watch.timers.runAll();
    watch.pairing.finish();
    expect(watch.pairedQuietly).toEqual([]);
    expect(watch.lit()).toBe(1);
  });

  it('s novým příkladem se rozehrané spojování zastaví a nic dalšího se nespojí', () => {
    const watch = watchPairing(5);
    watch.pairing.cancel();
    watch.timers.runAll();
    expect(watch.pairedWithChime).toEqual([0]);
    expect(watch.pairedQuietly).toEqual([]);
    expect(watch.lit()).toBe(0);
  });

  it('tečky pod samotným číslem nejdřív naskočí a teprve pak se začnou spojovat', () => {
    const watch = watchPairing(2, 200);
    expect(watch.pairedWithChime).toEqual([]);
    watch.timers.advance(200);
    expect(watch.pairedWithChime).toEqual([0]);
  });
});
