import { describe, expect, it } from 'vitest';

import {
  MAP_GOAL_SHOW_MS,
  MAP_SHOW_MS,
  MAP_STEPS,
  MAP_THEMES,
  START_MAP,
  mapMarkerFor,
  mapShowMs,
  mapThemeFor,
  parseMapProgress,
  serializeMapProgress,
  stepOnMap,
} from '../../../src/games/counting/logic/progressMap';
import type { MapProgress } from '../../../src/games/counting/logic/progressMap';
import { PROFILE_COLORS } from '../../../src/shared/logic/profiles';

/**
 * Testy k #133 (mapa postupu na 3 kroky a 5 map), čistá logika mapy bez
 * sezení: krok za plnou řadu (AC1), pořadí map (AC2, AC3), převod záznamu
 * z #87 (AC4), čtení poškozeného záznamu (AC5). Nahrazují testy #87
 * (8 kroků) se stejnou ochranou: krok za řadu, jen dopředu, doby
 * zobrazení, uložení a nové načtení, poškozená data a značka hráče.
 *
 * Navržené rozhraní `src/games/counting/logic/progressMap.ts`:
 * - `MAP_STEPS = 3` (krok 0 start, 1 a 2 zastávky, 3 cíl),
 *   `MAP_SHOW_MS = 3000`, `MAP_GOAL_SHOW_MS = 5000` beze změny,
 * - `MapThemeId = 'island' | 'forest' | 'castle' | 'underwater' | 'space'`,
 *   `MAP_THEMES: readonly MapThemeId[]` ve stálém pořadí,
 * - `mapThemeFor(completedMaps): MapThemeId` mapa, která se hraje,
 * - `MapMove { from, to, reachedGoal, theme }`: `theme` je mapa, na které
 *   krok proběhl (v cíli ta právě dokončená),
 * - `serializeMapProgress(progress)` zapíše nový záznam, který se od
 *   záznamu z #87 pozná (navrženo pole `format: 2`; záznam bez něj je
 *   z #87 s kroky 0 až 8),
 * - `parseMapProgress(saved)` přečte nový záznam i záznam z #87 a ten
 *   převede (0 → 0, 1–2 → 1, 3–7 → 2, 8 → 3).
 */

/** Postup po `rows` plných řadách od `from`. */
function afterRows(rows: number, from: MapProgress = START_MAP): MapProgress {
  let progress = from;
  for (let row = 0; row < rows; row += 1) {
    progress = stepOnMap(progress).progress;
  }
  return progress;
}

/** Záznam v novém tvaru, ve kterém jsou pole přepsaná (třeba poškozená). */
function currentRecord(fields: Record<string, unknown>): string {
  const valid = JSON.parse(serializeMapProgress(START_MAP)) as Record<string, unknown>;
  return JSON.stringify({ ...valid, ...fields });
}

/** Záznam uložený hrou z #87 (bez označení nového tvaru). */
function legacyRecord(fields: Record<string, unknown>): string {
  return JSON.stringify(fields);
}

describe('#133 AC1: mapa má start, 2 zastávky a cíl, každá plná řada je jeden krok', () => {
  it('nový hráč stojí na startu a do cíle jsou 3 kroky', () => {
    expect(START_MAP).toEqual({ step: 0, completedMaps: 0 });
    expect(MAP_STEPS).toBe(3);
  });

  it('1. řada posune značku na 1. zastávku, 2. řada na 2. zastávku a 3. řada do cíle', () => {
    expect(stepOnMap(START_MAP).move).toMatchObject({ from: 0, to: 1, reachedGoal: false });
    expect(stepOnMap(afterRows(1)).move).toMatchObject({ from: 1, to: 2, reachedGoal: false });
    expect(stepOnMap(afterRows(2)).move).toMatchObject({ from: 2, to: 3, reachedGoal: true });
  });

  it('každá plná řada posune značku přesně o jeden krok dopředu', () => {
    for (let step = 0; step < MAP_STEPS; step += 1) {
      const { progress, move } = stepOnMap({ step, completedMaps: 2 });
      expect(move, `z kroku ${step}`).toMatchObject({ from: step, to: step + 1 });
      expect(progress.step, `z kroku ${step}`).toBe(step + 1);
    }
  });

  it('po 3. řadě značka dojde do cíle a dokončená mapa se přičte', () => {
    const { progress, move } = stepOnMap({ step: 2, completedMaps: 0 });
    expect(move).toMatchObject({ from: 2, to: 3, reachedGoal: true });
    expect(progress).toEqual({ step: 3, completedMaps: 1 });
  });

  it('před 3. řadou značka do cíle nedojde a počet map se nezmění', () => {
    for (let step = 0; step < MAP_STEPS - 1; step += 1) {
      const { progress, move } = stepOnMap({ step, completedMaps: 3 });
      expect(move.reachedGoal, `z kroku ${step}`).toBe(false);
      expect(progress.completedMaps, `z kroku ${step}`).toBe(3);
    }
  });

  it('další plná řada po cíli ukáže novou mapu se značkou na 1. zastávce', () => {
    const { progress, move } = stepOnMap({ step: MAP_STEPS, completedMaps: 1 });
    expect(move).toMatchObject({ from: 0, to: 1, reachedGoal: false });
    expect(progress).toEqual({ step: 1, completedMaps: 1 });
  });

  it('po 3 řadách je 1 hotová mapa, po 6 řadách 2 a po 7 řadách 1. zastávka třetí mapy', () => {
    expect(afterRows(3)).toEqual({ step: 3, completedMaps: 1 });
    expect(afterRows(6)).toEqual({ step: 3, completedMaps: 2 });
    expect(afterRows(7)).toEqual({ step: 1, completedMaps: 2 });
  });

  it('počet dokončených map nikdy neklesá a značka jde jen dopředu', () => {
    let progress = START_MAP;
    for (let row = 1; row <= 6 * MAP_STEPS + 2; row += 1) {
      const { progress: next, move } = stepOnMap(progress);
      expect(next.completedMaps, `řada ${row}`).toBeGreaterThanOrEqual(progress.completedMaps);
      expect(move.to, `řada ${row}`).toBe(move.from + 1);
      progress = next;
    }
  });
});

describe('#133 AC1: doby zobrazení mapy zůstávají 3 s po kroku a 5 s v cíli', () => {
  it('krok na 1. nebo 2. zastávku ukáže mapu na 3 s', () => {
    expect(MAP_SHOW_MS).toBe(3000);
    expect(mapShowMs(stepOnMap({ step: 0, completedMaps: 0 }).move)).toBe(3000);
    expect(mapShowMs(stepOnMap({ step: 1, completedMaps: 0 }).move)).toBe(3000);
  });

  it('při dojití do cíle zůstane mapa 5 s', () => {
    expect(MAP_GOAL_SHOW_MS).toBe(5000);
    expect(mapShowMs(stepOnMap({ step: 2, completedMaps: 0 }).move)).toBe(5000);
  });

  it('1. krok nové mapy po cíli je zase běžný krok na 3 s', () => {
    expect(mapShowMs(stepOnMap({ step: MAP_STEPS, completedMaps: 1 }).move)).toBe(3000);
  });
});

describe('#133 AC2: 5 map ve stálém pořadí, po páté zase první', () => {
  it('mapy jdou v pořadí ostrov s pokladem, les, hrad, podmořský svět, vesmír', () => {
    expect(MAP_THEMES).toEqual(['island', 'forest', 'castle', 'underwater', 'space']);
  });

  it('každá z 5 map je jiná', () => {
    expect(new Set(MAP_THEMES).size).toBe(5);
  });

  it('po dojití do cíle ukáže další plná řada další mapu v pořadí', () => {
    for (let completedMaps = 0; completedMaps < 10; completedMaps += 1) {
      const finished = stepOnMap({ step: 2, completedMaps }).move.theme;
      const next = stepOnMap({ step: MAP_STEPS, completedMaps: completedMaps + 1 }).move.theme;
      const finishedIndex = MAP_THEMES.indexOf(finished);
      expect(next, `po ${completedMaps + 1}. mapě`).toBe(MAP_THEMES[(finishedIndex + 1) % 5]);
    }
  });

  it('po páté mapě (vesmír) přijde znovu první mapa (ostrov)', () => {
    expect(stepOnMap({ step: 2, completedMaps: 4 }).move.theme).toBe('space');
    expect(stepOnMap({ step: MAP_STEPS, completedMaps: 5 }).move.theme).toBe('island');
  });

  it('za 16 řad od startu projde hráč mapy ostrov, les, hrad, podmoří, vesmír a znovu ostrov', () => {
    let progress = START_MAP;
    const themes: string[] = [];
    for (let row = 1; row <= 16; row += 1) {
      const { progress: next, move } = stepOnMap(progress);
      if (move.from === 0) {
        themes.push(move.theme);
      }
      progress = next;
    }
    expect(themes).toEqual(['island', 'forest', 'castle', 'underwater', 'space', 'island']);
  });
});

describe('#133 AC3: která mapa se hraje, plyne z počtu dokončených map', () => {
  it('nový profil začíná na první mapě (ostrov)', () => {
    expect(mapThemeFor(START_MAP.completedMaps)).toBe('island');
    expect(stepOnMap(START_MAP).move.theme).toBe('island');
  });

  it('profil se 7 dokončenými mapami hraje třetí mapu (hrad)', () => {
    expect(mapThemeFor(7)).toBe('castle');
    expect(stepOnMap({ step: 1, completedMaps: 7 }).move.theme).toBe('castle');
  });

  it('mapa se pro každý počet dokončených map opakuje po pěti', () => {
    for (let completedMaps = 0; completedMaps < 23; completedMaps += 1) {
      expect(mapThemeFor(completedMaps), `${completedMaps} map`).toBe(
        MAP_THEMES[completedMaps % 5],
      );
    }
  });

  it('i velký počet dokončených map dá jednu z 5 map', () => {
    expect(mapThemeFor(1_000_002)).toBe('castle');
  });

  it('v cíli je vidět mapa, kterou dítě právě dokončilo, ne ta další', () => {
    for (let completedMaps = 0; completedMaps < 6; completedMaps += 1) {
      const { move, progress } = stepOnMap({ step: 2, completedMaps });
      expect(move.reachedGoal).toBe(true);
      expect(move.theme, `${completedMaps + 1}. mapa`).toBe(mapThemeFor(completedMaps));
      expect(progress.completedMaps).toBe(completedMaps + 1);
    }
  });

  it('všechny kroky jedné mapy jsou na stejné mapě', () => {
    const themes = [0, 1, 2].map((step) => stepOnMap({ step, completedMaps: 3 }).move.theme);
    expect(themes).toEqual(['underwater', 'underwater', 'underwater']);
  });
});

describe('#133 AC1 a AC2: postup na mapě přežije uložení a nové načtení', () => {
  it('každý krok na každé mapě se po uložení načte stejně', () => {
    for (let completedMaps = 0; completedMaps <= 6; completedMaps += 1) {
      for (let step = 0; step <= MAP_STEPS; step += 1) {
        const saved: MapProgress = { step, completedMaps };
        expect(parseMapProgress(serializeMapProgress(saved)), JSON.stringify(saved)).toEqual(saved);
      }
    }
  });
});

describe('#133 AC4: záznam z #87 (kroky 0 až 8) se převede na 3 kroky', () => {
  const conversions: readonly (readonly [number, number])[] = [
    [0, 0],
    [1, 1],
    [2, 1],
    [3, 2],
    [4, 2],
    [5, 2],
    [6, 2],
    [7, 2],
    [8, 3],
  ];

  it('krok 0 zůstane 0, 1–2 se změní na 1, 3–7 na 2 a 8 (cíl) na cíl', () => {
    for (const [oldStep, newStep] of conversions) {
      const saved = legacyRecord({ step: oldStep, completedMaps: 4 });
      expect(parseMapProgress(saved), `starý krok ${oldStep}`).toEqual({
        step: newStep,
        completedMaps: 4,
      });
    }
  });

  it('počet dokončených map zůstane při každém převodu', () => {
    for (const completedMaps of [0, 1, 7, 42]) {
      for (const [oldStep] of conversions) {
        const saved = legacyRecord({ step: oldStep, completedMaps });
        expect(parseMapProgress(saved).completedMaps, saved).toBe(completedMaps);
      }
    }
  });

  it('profil ve starém cíli stojí po převodu v cíli a další řada mu ukáže další mapu na 1. zastávce', () => {
    const converted = parseMapProgress(legacyRecord({ step: 8, completedMaps: 2 }));
    expect(converted).toEqual({ step: MAP_STEPS, completedMaps: 2 });

    const { move, progress } = stepOnMap(converted);
    expect(move).toMatchObject({ from: 0, to: 1, reachedGoal: false, theme: 'castle' });
    expect(progress).toEqual({ step: 1, completedMaps: 2 });
  });

  it('převedený a znovu uložený záznam se při dalším čtení už nepřevádí', () => {
    for (const [oldStep, newStep] of conversions) {
      const converted = parseMapProgress(legacyRecord({ step: oldStep, completedMaps: 1 }));
      const reread = parseMapProgress(serializeMapProgress(converted));
      expect(reread, `starý krok ${oldStep}`).toEqual({ step: newStep, completedMaps: 1 });
    }
  });

  it('nový záznam s krokem 2 z 3 zůstane 2, i když by starý krok 2 dal 1', () => {
    expect(parseMapProgress(serializeMapProgress({ step: 2, completedMaps: 0 }))).toEqual({
      step: 2,
      completedMaps: 0,
    });
    expect(parseMapProgress(legacyRecord({ step: 2, completedMaps: 0 })).step).toBe(1);
  });

  it('nový záznam v cíli zůstane v cíli, i když by starý krok 3 dal 2', () => {
    expect(parseMapProgress(serializeMapProgress({ step: 3, completedMaps: 1 })).step).toBe(3);
    expect(parseMapProgress(legacyRecord({ step: 3, completedMaps: 1 })).step).toBe(2);
  });
});

describe('#133 AC5: poškozený nový záznam hru nezastaví', () => {
  it('bez záznamu (i první spuštění po aktualizaci) začne hráč na startu první mapy s 0 mapami', () => {
    for (const missing of [null, undefined, '']) {
      expect(parseMapProgress(missing), String(missing)).toEqual(START_MAP);
    }
  });

  it('záporný krok dá krok 0 a počet map zůstane', () => {
    for (const step of [-1, -3, -100]) {
      const saved = currentRecord({ step, completedMaps: 2 });
      expect(parseMapProgress(saved), saved).toEqual({ step: 0, completedMaps: 2 });
    }
  });

  it('krok za cílem (víc než 3) dá krok 0, mapa se za to nepřičte a počet map zůstane', () => {
    for (const step of [MAP_STEPS + 1, 5, 8, 50]) {
      const saved = currentRecord({ step, completedMaps: 2 });
      expect(parseMapProgress(saved), saved).toEqual({ step: 0, completedMaps: 2 });
    }
  });

  it('krok přesně v cíli je platný a zůstane', () => {
    const saved = currentRecord({ step: MAP_STEPS, completedMaps: 1 });
    expect(parseMapProgress(saved)).toEqual({ step: MAP_STEPS, completedMaps: 1 });
  });

  it('necelé číslo nebo jiný typ u kroku dá krok 0 a počet map zůstane', () => {
    for (const step of [1.5, '2', true, null, [2], { step: 2 }, Number.NaN]) {
      const saved = currentRecord({ step, completedMaps: 2 });
      expect(parseMapProgress(saved), saved).toEqual({ step: 0, completedMaps: 2 });
    }
  });

  it('chybějící krok dá krok 0 a počet map zůstane', () => {
    const record = JSON.parse(currentRecord({ completedMaps: 2 })) as Record<string, unknown>;
    delete record.step;
    expect(parseMapProgress(JSON.stringify(record))).toEqual({ step: 0, completedMaps: 2 });
  });

  it('chybějící nebo poškozený počet map dá 0 map a uložený krok zůstane', () => {
    for (const completedMaps of [-1, 1.5, '2', null, [2], true]) {
      const saved = currentRecord({ step: 2, completedMaps });
      expect(parseMapProgress(saved), saved).toEqual({ step: 2, completedMaps: 0 });
    }
    const record = JSON.parse(currentRecord({ step: 2 })) as Record<string, unknown>;
    delete record.completedMaps;
    expect(parseMapProgress(JSON.stringify(record))).toEqual({ step: 2, completedMaps: 0 });
  });

  it('poškozený krok i počet map dají start první mapy s 0 mapami', () => {
    expect(parseMapProgress(currentRecord({ step: -2, completedMaps: 'x' }))).toEqual(START_MAP);
  });

  it('záznam, který nejde přečíst, dá krok 0 a 0 map', () => {
    for (const unreadable of ['{', 'nesmysl', 'null', '42', '"text"', '[1,2]', 'true']) {
      expect(parseMapProgress(unreadable), unreadable).toEqual(START_MAP);
    }
  });

  it('pole navíc krok ani mapy nezmění', () => {
    const saved = currentRecord({ step: 2, completedMaps: 1, earned: 7, theme: 'space' });
    expect(parseMapProgress(saved)).toEqual({ step: 2, completedMaps: 1 });
  });

  it('poškozený počet map v cíli dá cíl první mapy a další řada začne první mapu znovu', () => {
    const damaged = parseMapProgress(currentRecord({ step: MAP_STEPS, completedMaps: -4 }));
    expect(damaged).toEqual({ step: MAP_STEPS, completedMaps: 0 });
    expect(stepOnMap(damaged).move).toMatchObject({ from: 0, to: 1, theme: 'island' });
  });
});

describe('#133 AC5: poškozený záznam z #87 hru nezastaví', () => {
  it('záporný, necelý nebo jiný krok dá krok 0 a počet map zůstane', () => {
    for (const step of [-1, 2.5, '4', true, null, [4]]) {
      const saved = legacyRecord({ step, completedMaps: 3 });
      expect(parseMapProgress(saved), saved).toEqual({ step: 0, completedMaps: 3 });
    }
  });

  it('krok za starým cílem (víc než 8) dá krok 0 a počet map zůstane', () => {
    for (const step of [9, 12, 100]) {
      const saved = legacyRecord({ step, completedMaps: 3 });
      expect(parseMapProgress(saved), saved).toEqual({ step: 0, completedMaps: 3 });
    }
  });

  it('starý krok 4 až 8 je platný, i když je víc než 3, a převede se', () => {
    expect(parseMapProgress(legacyRecord({ step: 4, completedMaps: 0 })).step).toBe(2);
    expect(parseMapProgress(legacyRecord({ step: 8, completedMaps: 0 })).step).toBe(3);
  });

  it('poškozený počet map dá 0 map a převedený krok zůstane', () => {
    for (const completedMaps of [-1, 1.5, '2', null, [2]]) {
      const saved = legacyRecord({ step: 5, completedMaps });
      expect(parseMapProgress(saved), saved).toEqual({ step: 2, completedMaps: 0 });
    }
    expect(parseMapProgress(legacyRecord({ step: 5 }))).toEqual({ step: 2, completedMaps: 0 });
  });

  it('chybějící krok dá krok 0 a počet map zůstane', () => {
    expect(parseMapProgress(legacyRecord({ completedMaps: 2 }))).toEqual({
      step: 0,
      completedMaps: 2,
    });
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
