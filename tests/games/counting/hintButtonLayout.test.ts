import { beforeAll, describe, expect, it } from 'vitest';

import {
  hintMovesLayout,
  layoutDeviceHintButton,
} from '../../../src/games/counting/logic/deviceLayout';
import {
  HOME_SCREEN_WINDOWS,
  LAYOUT_RULES,
  MIN_TAP_GAP,
  MIN_TAP_SIDE,
} from '../../shared/layoutRules';
import type { LayoutItem, LayoutScene } from '../../shared/layoutRules';
import {
  boundsOf,
  gapBetween,
  heightOf,
  isInside,
  overlaps,
  widthOf,
} from '../../shared/viewportFixtures';
import type { TestWindow } from '../../shared/viewportFixtures';
import {
  HINT_BUTTON_NAME,
  MODES,
  PLAY_WINDOWS,
  RANGES,
  STAR_COUNTS,
  gearHitOf,
  hintButtonScene,
  homeHitOf,
  isDot,
  minus,
  playCasesWithHint,
  playLabel,
  playLayoutOf,
  playScene,
  plus,
} from './layoutScenes';
import type { PlayCase } from './layoutScenes';

/**
 * Testy k #84 AC1, AC3, AC5 a AC7: rozložení tlačítka nápovědy jako
 * pravidla v cyklu (#81, rozhodnutí 2026-11-06). Každé pravidlo je jeden
 * test, který projde všechna okna (iPad, telefon na šířku a na výšku,
 * hranice, aplikace z plochy), rozsahy 5, 10, 20, číselník i psaní, počty
 * hvězdiček a příklady s nápovědou; popis případu je ve zprávě `expect`.
 *
 * Tlačítko má aspoň 64 px, jen v okně 932×500 u číselníku do 20 smí mít
 * 60 px (rozhodnutí 2026-11-07, `layoutScenes.ts`).
 *
 * Tlačítko je na místě teček a tečky ho po ťuknutí nahradí (otázka 2,
 * varianta a). Na telefonu na šířku má nápověda místo hned od začátku
 * (rozhodnutí 2026-11-07, varianta A), takže se po ťuknutí nic neposune.
 *
 * Navržené rozhraní `src/games/counting/logic/deviceLayout.ts`:
 * `layoutDeviceHintButton(layout, groups)` vrátí místo tlačítka
 * (`ButtonSlot`, herní jednotky jako ostatní tlačítka) v rozložení
 * počítaném pro skupinky teček `groups`, nebo `null`, když příklad tečky
 * nemá (0 + 0, 0 − 0). `hintMovesLayout(layout)` je všude `false`.
 */

const WINDOWS: readonly TestWindow[] = [...PLAY_WINDOWS, ...HOME_SCREEN_WINDOWS];

let cachedCases: PlayCase[] | undefined;
function cases(): PlayCase[] {
  cachedCases ??= playCasesWithHint(WINDOWS);
  return cachedCases;
}

let cachedButtonScenes: LayoutScene[] | undefined;
/** Nový příklad s tlačítkem nápovědy, ve stejném pořadí jako `cases()`. */
function buttonScenes(): LayoutScene[] {
  cachedButtonScenes ??= cases().map(hintButtonScene);
  return cachedButtonScenes;
}

let cachedDotScenes: LayoutScene[] | undefined;
/** Tentýž příklad po ťuknutí na tlačítko: tečky místo tlačítka. */
function dotScenes(): LayoutScene[] {
  cachedDotScenes ??= cases().map(playScene);
  return cachedDotScenes;
}

/** Spočítat všechny scény trvá pár sekund, déle než běžný test. */
const SCENES_TIMEOUT_MS = 60_000;

// Scény se spočítají jednou pro celý soubor, testy je pak jen čtou.
beforeAll(() => {
  buttonScenes();
  dotScenes();
}, SCENES_TIMEOUT_MS);

function buttonOf(scene: LayoutScene): LayoutItem | undefined {
  return scene.items.find((item) => item.name === HINT_BUTTON_NAME);
}

/** Ostatní ťukací plochy, od kterých má být tlačítko aspoň 8 px (AC7). */
function neighboursOf(scene: LayoutScene, window: TestWindow): LayoutItem[] {
  const inScene = scene.items.filter(
    (item) =>
      item.name !== HINT_BUTTON_NAME &&
      !item.reserved &&
      (item.tappable === true || item.name.startsWith('okénko')),
  );
  return [
    ...inScene,
    { name: 'plocha domečku', box: homeHitOf(window) },
    { name: 'plocha kolečka', box: gearHitOf(window) },
  ];
}

describe('AC1 a AC7: tlačítko nápovědy u nového příkladu dodrží společná pravidla', () => {
  it('tlačítko je u každého příkladu s tečkami ve všech oknech, rozsazích a ovládáních', () => {
    expect(buttonScenes().length).toBeGreaterThan(0);
    for (const scene of buttonScenes()) {
      expect(buttonOf(scene), scene.label).toBeDefined();
    }
  });

  for (const [ruleName, rule] of Object.entries(LAYOUT_RULES)) {
    it(`${ruleName} i s tlačítkem nápovědy ve všech oknech, rozsazích a ovládáních`, () => {
      for (const scene of buttonScenes()) {
        expect(rule(scene), scene.label).toEqual([]);
      }
    });
  }
});

describe('AC7: tlačítko nápovědy je dost velké, dost daleko a celé vidět', () => {
  // Výjimka 60 px v okně 932×500 u číselníku do 20 (#84, rozhodnutí
  // 2026-11-07) je u tlačítka v `layoutScenes.ts` (`minSide`).
  it('tlačítko má aspoň 64 × 64 px, v okně 932×500 u číselníku do 20 aspoň 60 px', () => {
    for (const scene of buttonScenes()) {
      const button = buttonOf(scene);
      const size = button ? `${widthOf(button.box)} × ${heightOf(button.box)}` : 'chybí';
      const minSide = button?.minSide ?? MIN_TAP_SIDE;
      expect(
        button !== undefined &&
          widthOf(button.box) >= minSide - 0.01 &&
          heightOf(button.box) >= minSide - 0.01,
        `${scene.label}: tlačítko ${size}`,
      ).toBe(true);
    }
  });

  it('tlačítko je aspoň 8 px od číselníku, okének, smazání, ✓, domečku i kolečka', () => {
    cases().forEach((testCase, index) => {
      const scene = buttonScenes()[index];
      const button = scene ? buttonOf(scene) : undefined;
      if (!scene || !button) {
        throw new Error(`${playLabel(testCase)}: chybí tlačítko nápovědy`);
      }
      for (const other of neighboursOf(scene, testCase.window)) {
        const gap = gapBetween(button.box, other.box);
        expect(gap, `${scene.label}: mezi tlačítkem a ${other.name}`).toBeGreaterThanOrEqual(
          MIN_TAP_GAP - 0.01,
        );
      }
    });
  });

  it('tlačítko je celé na obrazovce (ve volné ploše okna)', () => {
    for (const scene of buttonScenes()) {
      const button = buttonOf(scene);
      expect(button !== undefined && isInside(button.box, scene.free), scene.label).toBe(true);
    }
  });
});

describe('AC3 a AC7: po ukázání nápovědy se nic jiného neposune ani nepřekryje', () => {
  it('nápověda nikde nepřepočítá rozložení, ani na telefonu na šířku', () => {
    for (const testCase of cases()) {
      const { layout } = playLayoutOf(testCase);
      expect(hintMovesLayout(layout), playLabel(testCase)).toBe(false);
    }
  });

  it('všechno kromě tlačítka zůstane po ukázání teček na stejném místě', () => {
    buttonScenes().forEach((before, index) => {
      const after = dotScenes()[index];
      if (!after) {
        throw new Error(`${before.label}: chybí obrazovka s tečkami`);
      }
      const afterBoxes = new Map(after.items.map((item) => [item.name, item.box]));
      expect(afterBoxes.has(HINT_BUTTON_NAME), `${after.label}: tlačítko zmizí`).toBe(false);
      for (const item of before.items.filter((each) => each.name !== HINT_BUTTON_NAME)) {
        expect(afterBoxes.get(item.name), `${before.label}: ${item.name}`).toEqual(item.box);
      }
    });
  });

  it('tečky se ukážou na místě tlačítka', () => {
    buttonScenes().forEach((before, index) => {
      const after = dotScenes()[index];
      const button = buttonOf(before);
      const dots = after?.items.filter(isDot) ?? [];
      expect(dots.length, `${before.label}: tečky`).toBeGreaterThan(0);
      const dotArea = boundsOf(dots.map((dot) => dot.box));
      expect(button !== undefined && overlaps(button.box, dotArea), before.label).toBe(true);
    });
  });

  it('tečky po ťuknutí nepřekryjí nic jiného', () => {
    const overlap = LAYOUT_RULES['nic se nepřekrývá'];
    for (const scene of dotScenes()) {
      expect(overlap?.(scene), scene.label).toEqual([]);
    }
  });
});

describe('AC5: u 0 + 0 a 0 − 0 není tlačítko nápovědy v žádném rozložení', () => {
  it('rozložení pro 0 + 0 a 0 − 0 tlačítko nemá ve všech oknech, rozsazích a ovládáních', () => {
    for (const window of WINDOWS) {
      for (const maxNumber of RANGES) {
        for (const mode of MODES) {
          for (const starCount of STAR_COUNTS) {
            for (const problem of [plus(0, 0), minus(0, 0)]) {
              const testCase: PlayCase = {
                window,
                maxNumber,
                mode,
                operations: 'mixed',
                starCount,
                hint: problem,
              };
              const { layout } = playLayoutOf(testCase);
              expect(layoutDeviceHintButton(layout, []), playLabel(testCase)).toBeNull();
            }
          }
        }
      }
    }
  });
});
