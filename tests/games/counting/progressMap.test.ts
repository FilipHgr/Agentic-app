import { describe, expect, it } from 'vitest';

import {
  MAP_GOAL_SHOW_MS,
  MAP_SHOW_MS,
  MAP_STEPS,
  START_MAP,
  mapMarkerFor,
  mapShowMs,
  parseMapProgress,
  serializeMapProgress,
  stepOnMap,
} from '../../../src/games/counting/logic/progressMap';
import type { MapProgress } from '../../../src/games/counting/logic/progressMap';
import { PROFILE_COLORS } from '../../../src/shared/logic/profiles';

/**
 * Testy k #87 (mapa postupu v Počítání), čistá logika mapy bez sezení:
 * krok za plnou řadu (AC2, AC5), jak dlouho je mapa vidět (AC1), čtení
 * uloženého postupu (AC6) a značka hráče (AC7).
 *
 * Navržené rozhraní `src/games/counting/logic/progressMap.ts`:
 * - `MAP_STEPS = 8`, `MAP_SHOW_MS = 3000`, `MAP_GOAL_SHOW_MS = 5000`,
 * - `MapProgress { step, completedMaps }`, `START_MAP` (krok 0, 0 map),
 * - `stepOnMap(progress)` vrátí `{ progress, move: { from, to, reachedGoal } }`,
 * - `mapShowMs(move)` jak dlouho je mapa vidět,
 * - `serializeMapProgress(progress)` a `parseMapProgress(saved)`,
 * - `mapMarkerFor({ nickname?, color })` vrátí `{ color, letter }`.
 * Krok 0 je start, krok 8 je cíl (hotová mapa).
 */

/** Postup po `rows` plných řadách od startu. */
function afterRows(rows: number, from: MapProgress = START_MAP): MapProgress {
  let progress = from;
  for (let row = 0; row < rows; row += 1) {
    progress = stepOnMap(progress).progress;
  }
  return progress;
}

describe('#87 AC5: mapa má 8 kroků a každý je jedna plná řada', () => {
  it('nový hráč stojí na startu a nemá žádnou dokončenou mapu', () => {
    expect(START_MAP).toEqual({ step: 0, completedMaps: 0 });
    expect(MAP_STEPS).toBe(8);
  });

  it('každá plná řada posune značku přesně o jeden krok dopředu', () => {
    for (let step = 0; step < MAP_STEPS; step += 1) {
      const { progress, move } = stepOnMap({ step, completedMaps: 2 });
      expect(move, `z kroku ${step}`).toMatchObject({ from: step, to: step + 1 });
      expect(progress.step, `z kroku ${step}`).toBe(step + 1);
    }
  });

  it('po 8. řadě značka dojde do cíle a dokončená mapa se přičte', () => {
    const { progress, move } = stepOnMap({ step: MAP_STEPS - 1, completedMaps: 0 });
    expect(move).toEqual({ from: MAP_STEPS - 1, to: MAP_STEPS, reachedGoal: true });
    expect(progress).toEqual({ step: MAP_STEPS, completedMaps: 1 });
  });

  it('před 8. řadou značka do cíle nedojde a počet map se nezmění', () => {
    for (let step = 0; step < MAP_STEPS - 1; step += 1) {
      const { progress, move } = stepOnMap({ step, completedMaps: 3 });
      expect(move.reachedGoal, `z kroku ${step}`).toBe(false);
      expect(progress.completedMaps, `z kroku ${step}`).toBe(3);
    }
  });

  it('další plná řada po cíli ukáže novou mapu a značka udělá 1. krok ze startu', () => {
    const { progress, move } = stepOnMap({ step: MAP_STEPS, completedMaps: 1 });
    expect(move).toEqual({ from: 0, to: 1, reachedGoal: false });
    expect(progress).toEqual({ step: 1, completedMaps: 1 });
  });

  it('po 8 řadách je 1 hotová mapa, po 16 řadách 2 a po 17 řadách 1. krok třetí mapy', () => {
    expect(afterRows(8)).toEqual({ step: 8, completedMaps: 1 });
    expect(afterRows(16)).toEqual({ step: 8, completedMaps: 2 });
    expect(afterRows(17)).toEqual({ step: 1, completedMaps: 2 });
  });

  it('počet dokončených map nikdy neklesá a značka jde jen dopředu (AC2)', () => {
    let progress = START_MAP;
    for (let row = 1; row <= 3 * MAP_STEPS + 2; row += 1) {
      const { progress: next, move } = stepOnMap(progress);
      expect(next.completedMaps, `řada ${row}`).toBeGreaterThanOrEqual(progress.completedMaps);
      expect(move.to, `řada ${row}`).toBe(move.from + 1);
      progress = next;
    }
  });
});

describe('#87 AC1: jak dlouho je mapa vidět', () => {
  it('běžný krok ukáže mapu na 3 s', () => {
    expect(MAP_SHOW_MS).toBe(3000);
    expect(mapShowMs(stepOnMap({ step: 2, completedMaps: 0 }).move)).toBe(3000);
  });

  it('při dojití do cíle zůstane mapa 5 s', () => {
    expect(MAP_GOAL_SHOW_MS).toBe(5000);
    expect(mapShowMs(stepOnMap({ step: MAP_STEPS - 1, completedMaps: 0 }).move)).toBe(5000);
  });

  it('1. krok nové mapy po cíli je zase běžný krok na 3 s', () => {
    expect(mapShowMs(stepOnMap({ step: MAP_STEPS, completedMaps: 1 }).move)).toBe(3000);
  });
});

describe('#87 AC3 a AC5: postup na mapě přežije uložení a nové načtení', () => {
  it('každý krok na každé mapě se po uložení načte stejně', () => {
    for (let completedMaps = 0; completedMaps <= 3; completedMaps += 1) {
      for (let step = 0; step <= MAP_STEPS; step += 1) {
        const saved: MapProgress = { step, completedMaps };
        expect(parseMapProgress(serializeMapProgress(saved)), JSON.stringify(saved)).toEqual(saved);
      }
    }
  });
});

describe('#87 AC6: chybějící nebo nesmyslná uložená mapa hru nezastaví', () => {
  it('bez záznamu (i první spuštění po aktualizaci) začne hráč na startu s 0 mapami', () => {
    for (const missing of [null, undefined, '']) {
      expect(parseMapProgress(missing), String(missing)).toEqual(START_MAP);
    }
  });

  it('záporný krok dá krok 0 a počet map zůstane', () => {
    for (const step of [-1, -8, -100]) {
      const saved = JSON.stringify({ step, completedMaps: 2 });
      expect(parseMapProgress(saved), saved).toEqual({ step: 0, completedMaps: 2 });
    }
  });

  it('krok za cílem dá krok 0, mapa se za to nepřičte a počet map zůstane', () => {
    for (const step of [MAP_STEPS + 1, 9, 50]) {
      const saved = JSON.stringify({ step, completedMaps: 2 });
      expect(parseMapProgress(saved), saved).toEqual({ step: 0, completedMaps: 2 });
    }
  });

  it('krok přesně v cíli je platný a zůstane', () => {
    const saved = JSON.stringify({ step: MAP_STEPS, completedMaps: 1 });
    expect(parseMapProgress(saved)).toEqual({ step: MAP_STEPS, completedMaps: 1 });
  });

  it('necelé číslo nebo jiný typ u kroku dá krok 0 a počet map zůstane', () => {
    for (const step of [2.5, '3', true, null, [3], { step: 3 }, Number.NaN]) {
      const saved = JSON.stringify({ step, completedMaps: 2 });
      expect(parseMapProgress(saved), saved).toEqual({ step: 0, completedMaps: 2 });
    }
  });

  it('chybějící krok dá krok 0 a počet map zůstane', () => {
    expect(parseMapProgress(JSON.stringify({ completedMaps: 2 }))).toEqual({
      step: 0,
      completedMaps: 2,
    });
  });

  it('chybějící nebo poškozený počet map dá 0 map a uložený krok zůstane', () => {
    const records = [
      { step: 5 },
      { step: 5, completedMaps: -1 },
      { step: 5, completedMaps: 1.5 },
      { step: 5, completedMaps: '2' },
      { step: 5, completedMaps: null },
      { step: 5, completedMaps: [2] },
    ];
    for (const record of records) {
      const saved = JSON.stringify(record);
      expect(parseMapProgress(saved), saved).toEqual({ step: 5, completedMaps: 0 });
    }
  });

  it('poškozený krok i počet map dají start s 0 mapami', () => {
    const saved = JSON.stringify({ step: -2, completedMaps: 'x' });
    expect(parseMapProgress(saved)).toEqual(START_MAP);
  });

  it('záznam, který nejde přečíst, dá krok 0 a 0 map', () => {
    for (const unreadable of ['{', 'nesmysl', 'null', '42', '"text"', '[1,2]', 'true']) {
      expect(parseMapProgress(unreadable), unreadable).toEqual(START_MAP);
    }
  });

  it('pole navíc ze starších nebo novějších verzí hry krok ani mapy nezmění', () => {
    const saved = JSON.stringify({ step: 4, completedMaps: 1, earned: 7, theme: 'les' });
    expect(parseMapProgress(saved)).toEqual({ step: 4, completedMaps: 1 });
  });
});

describe('#87 AC7: značka hráče je kolečko v barvě profilu s prvním písmenem přezdívky', () => {
  it('značka má barvu profilu a první písmeno přezdívky', () => {
    expect(mapMarkerFor({ nickname: 'ALFA', color: PROFILE_COLORS[2] })).toEqual({
      color: PROFILE_COLORS[2],
      letter: 'A',
    });
  });

  it('přezdívka s diakritikou dá první písmeno i s háčkem', () => {
    expect(mapMarkerFor({ nickname: 'ŽOFKA', color: PROFILE_COLORS[0] }).letter).toBe('Ž');
  });

  it('jednopísmenná přezdívka dá to písmeno', () => {
    expect(mapMarkerFor({ nickname: 'Č', color: PROFILE_COLORS[5] }).letter).toBe('Č');
  });

  it('profil bez přezdívky má kolečko v barvě profilu bez písmene', () => {
    expect(mapMarkerFor({ color: PROFILE_COLORS[0] })).toEqual({
      color: PROFILE_COLORS[0],
      letter: null,
    });
  });

  it('každá barva palety se na značce použije beze změny', () => {
    for (const color of PROFILE_COLORS) {
      expect(mapMarkerFor({ nickname: 'BETA', color }).color, color).toBe(color);
    }
  });
});
