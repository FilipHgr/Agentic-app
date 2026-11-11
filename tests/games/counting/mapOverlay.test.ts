import { describe, expect, it } from 'vitest';

import { CELEBRATION_MS, STAR_FLIGHT_MS } from '../../../src/games/counting/logic/countingSession';
import {
  START_MAP,
  parseMapProgress,
  readMapRecord,
  serializeMapProgress,
} from '../../../src/games/counting/logic/progressMap';
import type { MapMove } from '../../../src/games/counting/logic/progressMap';
import { STARS_PER_SET } from '../../../src/games/counting/logic/stars';
import { MAP_PROGRESS_KEY } from '../../../src/games/counting/storage/mapStorage';
import { correctAnswerOf, enterCounting, solveProblems, testDevice } from './sessionFakes';
import type { TestSession } from './sessionFakes';

/**
 * Testy k #134 AC3: mapa je dočasná vrstva nad hrou bez ťukací plochy.
 * Ťuknutí během mapy (na číselník pod ní, na tlačítko nápovědy nebo na
 * tečku) nic nezmění: mapa ani krok se nepohnou, hvězdičky ani příklad se
 * nezmění a mapa se zavře sama jako bez ťuknutí. Kolečko a domeček během
 * mapy hlídají testy #87 AC4 v `progressMapSession.test.ts`.
 *
 * A test z kontroly #133: záznam mapy s neznámým `format` (třeba z novější
 * verze hry) hru nezastaví, dá start mapy, počet map zůstane a záznam se
 * nepovažuje za starý záznam z #87.
 *
 * Ručně se kontroluje: kolečko a domeček jsou nad obrázkem mapy vidět
 * a fungují (kreslí scéna).
 */

function fillRow(test: TestSession): void {
  solveProblems(test, STARS_PER_SET - 1);
  test.session.tapAnswer(correctAnswerOf(test.session));
}

/** Posune čas, dokud se neukáže mapa, a vrátí, co ukazuje. */
function waitForMap(test: TestSession): MapMove {
  const limit = STAR_FLIGHT_MS + CELEBRATION_MS + 1000;
  for (let elapsed = 0; elapsed <= limit; elapsed += 10) {
    const shown = test.session.shownMap();
    if (shown !== null) {
      return shown;
    }
    test.timers.advance(10);
  }
  throw new Error('mapa se po oslavě neukázala');
}

describe('#134 AC3: ťuknutí na mapu nic nezmění', () => {
  it('ťuknutí na čísla pod mapou nic nezmění: krok, hvězdičky ani příklad', () => {
    const test = enterCounting(testDevice());
    fillRow(test);
    const shown = waitForMap(test);
    const progress = test.session.mapProgress();
    const stars = test.session.starCount();
    const problem = test.session.problem();

    for (let number = 0; number <= 10; number += 1) {
      expect(test.session.tapAnswer(number), `číslo ${number}`).toBe('ignored');
    }

    expect(test.session.shownMap()).toEqual(shown);
    expect(test.session.mapProgress()).toEqual(progress);
    expect(test.session.starCount()).toBe(stars);
    expect(test.session.problem()).toEqual(problem);
  });

  it('ťuknutí na tlačítko nápovědy nebo tečku během mapy nic neukáže ani nezmění', () => {
    const test = enterCounting(testDevice());
    fillRow(test);
    const shown = waitForMap(test);

    expect(test.session.tapHintButton()).toBe(false);
    expect(test.session.tapDot(0)).toBeNull();
    expect(test.session.hintVisible()).toBe(false);
    expect(test.session.shownMap()).toEqual(shown);
  });

  it('po ťukání během mapy se mapa zavře sama a přijde nový příklad jako bez ťuknutí', () => {
    const test = enterCounting(testDevice());
    fillRow(test);
    waitForMap(test);
    test.session.tapAnswer(1);
    test.session.tapHintButton();

    test.timers.runAll();

    expect(test.session.shownMap()).toBeNull();
    expect(test.session.round().solved).toBe(false);
    expect(test.session.starCount()).toBe(0);
    expect(test.session.mapProgress()).toEqual({ step: 1, completedMaps: 0 });
  });
});

describe('#134 (kontrola #133): záznam mapy s neznámým tvarem', () => {
  function recordWithFormat(format: unknown, step: number, completedMaps: number): string {
    const valid = JSON.parse(serializeMapProgress(START_MAP)) as Record<string, unknown>;
    return JSON.stringify({ ...valid, format, step, completedMaps });
  }

  it('záznam z novější verze hry (neznámé číslo tvaru) dá start mapy a počet map zůstane', () => {
    expect(parseMapProgress(recordWithFormat(99, 2, 4))).toEqual({ step: 0, completedMaps: 4 });
  });

  it('neznámý tvar se nepřevádí jako starý záznam z #87', () => {
    for (const format of [99, 1, '2', null, true]) {
      const record = readMapRecord(recordWithFormat(format, 2, 3));
      expect(record.legacy, JSON.stringify(format)).toBe(false);
      expect(record.progress, JSON.stringify(format)).toEqual({ step: 0, completedMaps: 3 });
    }
  });

  it('i krok v cíli v neznámém tvaru dá start, a tedy se za něj nepřičte mapa', () => {
    expect(parseMapProgress(recordWithFormat(3, 3, 0))).toEqual({ step: 0, completedMaps: 0 });
  });

  it('hra s neznámým tvarem záznamu začne bez chyby a plná řada dá 1. krok', () => {
    const device = testDevice();
    device.storage.setItem(MAP_PROGRESS_KEY, recordWithFormat(99, 2, 1));
    const test = enterCounting(device);
    fillRow(test);
    expect(waitForMap(test)).toMatchObject({ from: 0, to: 1 });
    expect(test.session.mapProgress()).toEqual({ step: 1, completedMaps: 1 });
  });
});
