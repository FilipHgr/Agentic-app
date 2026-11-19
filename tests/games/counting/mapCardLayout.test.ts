import { describe, expect, it } from 'vitest';

import { markerPointAt } from '../../../src/games/counting/logic/mapAnimation';
import { MAP_PICTURE_SIZE, mapOrientationOf } from '../../../src/games/counting/logic/mapPictures';
import { MAP_STEPS, MAP_THEMES } from '../../../src/games/counting/logic/progressMap';
import {
  mapCardPageBackdrop,
  mapCardPictureCover,
} from '../../../src/games/counting/logic/progressMapCard';
import { layoutProgressMap } from '../../../src/games/counting/logic/progressMapLayout';
import {
  PROGRESS_MAP_BACKGROUNDS,
  PROGRESS_MAP_CARD_STYLE,
} from '../../../src/games/counting/logic/theme';
import { PAGE_BACKGROUND, WHITE } from '../../../src/shared/logic/theme';
import { LAYOUT_RULES, MIN_TAP_SIDE } from '../../shared/layoutRules';
import type { LayoutItem, LayoutScene } from '../../shared/layoutRules';
import { box, heightOf, overlaps, toCss, widthOf } from '../../shared/viewportFixtures';
import type { Box, TestWindow } from '../../shared/viewportFixtures';
import { cornerItems, isOwnSurrounding, visibleAreaOf } from './layoutScenes';
import { allMoves, shareOfStep } from './mapAnimationHelpers';
import {
  MAP_STEP_LIST,
  MAP_WINDOWS,
  cardAreaBox,
  cardBox,
  cardPictureCases,
  cardSceneryCases,
  cardWindowCase,
  cardWindowCases,
  drawnCardBox,
  insideCard,
  isCornerItem,
  roundedCornerViolations,
} from './mapCardScenes';
import { MARKER_NAME, placeName } from './mapLayoutScenes';
import {
  drawnMarkerSize,
  drawnPlaceSize,
  goalSymbolBox,
  pictureMapScene,
} from './mapPictureLayoutScenes';
import type { PictureMapCase } from './mapPictureLayoutScenes';
import { pathViolations, sceneryScene } from './mapSceneryScenes';

/**
 * Testy k #145 AC1, AC2 a otočení z AC6 (rozložení): mapa postupu se po
 * oslavě ukáže jako karta se zaoblenými rohy a bílým okrajem nad
 * ztmavenou hrou (vybraná varianta V2) a celá mapa leží uvnitř karty.
 * Každé pravidlo má jeden test, který v cyklu projde všechna okna mapy
 * z #133 AC7 (`MAP_WINDOWS`), 5 map a kroky 0–3; popis případu je ve
 * zprávě `expect`. Pravidla #133 AC7, #134 AC1–AC2, #135 AC3, #136 AC2
 * a #139 AC2 se měří stejnými pomůckami jako dřív, jen v ploše karty.
 * Navržené rozhraní je v `mapCardScenes.ts`.
 *
 * Ručně se kontroluje: velikost karty asi 75 % plochy, stín a vzhled
 * podle varianty V2, kolečko a domeček jsou nad ztmavením vidět (kreslí
 * scéna), konfety cíle letí uvnitř karty a 60 fps ve WebKitu (AC7).
 */

/** Nejmenší odstup karty i s bílým okrajem od okraje viditelné plochy (AC1). */
const MIN_CARD_EDGE_CSS = 8;

/** Tolerance na zaokrouhlení v CSS px. */
const TOLERANCE = 0.01;

/** Jména vrstev v kartě pro zprávy. */
const KEY_NAME = 'štítek klíče';
const CELEBRATING_GOAL_NAME = 'slavící symbol cíle';

let cachedPictureCases: PictureMapCase[] | undefined;

function pictureCases(): PictureMapCase[] {
  cachedPictureCases ??= cardPictureCases();
  return cachedPictureCases;
}

let cachedMapScenes: LayoutScene[] | undefined;

/** Místa, symbol cíle a značka v kartě, každé okno × 5 map × kroky 0–3. */
function mapScenes(): LayoutScene[] {
  cachedMapScenes ??= pictureCases().flatMap((testCase) =>
    MAP_STEP_LIST.map((step) => insideCard(pictureMapScene(testCase, step), testCase.window)),
  );
  return cachedMapScenes;
}

let cachedSceneryScenes: LayoutScene[] | undefined;

/** Pohyby prostředí v kartě, každé okno × 5 map × kroky 0–3. */
function sceneryScenes(): LayoutScene[] {
  cachedSceneryScenes ??= cardSceneryCases().flatMap((testCase) =>
    MAP_STEP_LIST.map((step) => insideCard(sceneryScene(testCase, step), testCase.window)),
  );
  return cachedSceneryScenes;
}

/** Obrazovka cíle v kartě: místa, značka v cíli, slavící cíl a štítek klíče (#135 AC3, #139 AC2). */
function goalScene(testCase: PictureMapCase): LayoutScene {
  const { area, layout } = testCase;
  const places: LayoutItem[] = layout.places.map((place, step) => {
    const size = drawnPlaceSize(layout, step);
    return { name: placeName(step), box: toCss(box(place.x, place.y, size, size), area) };
  });
  const goal = layout.places[MAP_STEPS] ?? { x: 0, y: 0 };
  const markerSize = drawnMarkerSize(layout);
  const { goalCelebration: celebration, goalKey: key } = layout;
  const goalItems: LayoutItem[] = [
    { name: MARKER_NAME, box: toCss(box(goal.x, goal.y, markerSize, markerSize), area) },
    {
      name: CELEBRATING_GOAL_NAME,
      box: toCss(box(celebration.x, celebration.y, celebration.size, celebration.size), area),
    },
    { name: KEY_NAME, box: toCss(box(key.x, key.y, key.width, key.height), area) },
  ];
  // Značka stojí v cíli a smí překrýt cíl i záři kolem něj (#133, #135); klíč nic.
  const mayShare = new Set([MARKER_NAME, placeName(MAP_STEPS), CELEBRATING_GOAL_NAME]);
  const scene: LayoutScene = {
    label: `${testCase.label}, značka v cíli, slavící cíl a klíč`,
    free: visibleAreaOf(testCase.window, area),
    items: [...cornerItems(testCase.window, area), ...places, ...goalItems],
    mayOverlap: (first, second) =>
      (mayShare.has(first.name) && mayShare.has(second.name)) ||
      isOwnSurrounding(first, second) ||
      isOwnSurrounding(second, first),
  };
  return insideCard(scene, testCase.window);
}

let cachedGoalScenes: LayoutScene[] | undefined;

function goalScenes(): LayoutScene[] {
  cachedGoalScenes ??= pictureCases().map(goalScene);
  return cachedGoalScenes;
}

/** O kolik `inner` přesahuje `outer` zmenšený o `margin` ze všech stran (popis pro `expect`). */
function marginViolations(inner: Box, outer: Box, margin: number): string[] {
  const sides: Array<[string, number]> = [
    ['levý', outer.left + margin - inner.left],
    ['pravý', inner.right - (outer.right - margin)],
    ['horní', outer.top + margin - inner.top],
    ['spodní', inner.bottom - (outer.bottom - margin)],
  ];
  return sides
    .filter(([, overhang]) => overhang > TOLERANCE)
    .map(([side, overhang]) => `${side} okraj blíž o ${overhang.toFixed(2)} px`);
}

/** Barva `#RRGGBB` ztmavená černou s průhledností `alpha`, jako kanály 0–255. */
function dimmedChannels(color: string, alpha: number): number[] {
  return [1, 3, 5].map((start) =>
    Math.round(Number.parseInt(color.slice(start, start + 2), 16) * (1 - alpha)),
  );
}

function channelsOf(color: string): number[] {
  return [1, 3, 5].map((start) => Number.parseInt(color.slice(start, start + 2), 16));
}

function isLandscape(size: { width: number; height: number }): boolean {
  return size.width > size.height;
}

describe('#145 AC1: mapa je karta se zaoblenými rohy nad ztmavenou hrou', () => {
  it('hra pod kartou ztmavne na 40 % a karta má bílý okraj 6 px a zaoblené rohy (varianta V2)', () => {
    expect(PROGRESS_MAP_CARD_STYLE.dimAlpha).toBeCloseTo(0.4, 6);
    expect(PROGRESS_MAP_CARD_STYLE.borderCss).toBe(6);
    expect(PROGRESS_MAP_CARD_STYLE.borderColor.toUpperCase()).toBe(WHITE);
    expect(PROGRESS_MAP_CARD_STYLE.cornerRadiusCss).toBeGreaterThan(0);
  });

  it('karta i s bílým okrajem je ve všech oknech aspoň 8 px od okraje viditelné plochy', () => {
    const cases = cardWindowCases();
    expect(cases.length).toBeGreaterThan(0);
    for (const { label, window, gameArea, card } of cases) {
      const visible = visibleAreaOf(window, gameArea);
      expect(marginViolations(drawnCardBox(card), visible, MIN_CARD_EDGE_CSS), label).toEqual([]);
    }
  });

  it('karta i s bílým okrajem nezasahuje do rohu kolečka a domečku, do výřezu ani na lištu', () => {
    for (const { label, window, gameArea, card } of cardWindowCases()) {
      const drawn = drawnCardBox(card);
      const hits = cornerItems(window, gameArea)
        .filter((corner) => overlaps(drawn, corner.box))
        .map((corner) => corner.name);
      expect(hits, label).toEqual([]);
    }
  });

  it('karta má v každém okně nenulovou plochu a plocha mapy leží přesně na kartě', () => {
    for (const { label, card } of cardWindowCases()) {
      expect(widthOf(cardBox(card)), label).toBeGreaterThan(0);
      expect(heightOf(cardBox(card)), label).toBeGreaterThan(0);
      const areaBox = cardAreaBox(card);
      const inner = cardBox(card);
      expect(areaBox.left, label).toBeCloseTo(inner.left, 2);
      expect(areaBox.right, label).toBeCloseTo(inner.right, 2);
      expect(areaBox.top, label).toBeCloseTo(inner.top, 2);
      expect(areaBox.bottom, label).toBeCloseTo(inner.bottom, 2);
    }
  });
});

describe('#145 AC2: celá mapa leží uvnitř karty ve všech oknech, na 5 mapách a v krocích 0–3', () => {
  for (const [ruleName, rule] of Object.entries(LAYOUT_RULES)) {
    it(`${ruleName}: místa, symbol cíle a značka v kartě (#133 AC7, #134 AC2)`, () => {
      expect(mapScenes().length).toBe(MAP_WINDOWS.length * MAP_THEMES.length * (MAP_STEPS + 1));
      for (const scene of mapScenes()) {
        expect(rule(scene), scene.label).toEqual([]);
      }
    });
  }

  for (const [ruleName, rule] of Object.entries(LAYOUT_RULES)) {
    it(`${ruleName}: slavící cíl a klíč v kartě (#135 AC3, #139 AC2)`, () => {
      expect(goalScenes().length).toBe(MAP_WINDOWS.length * MAP_THEMES.length);
      for (const scene of goalScenes()) {
        expect(rule(scene), scene.label).toEqual([]);
      }
    });
  }

  for (const [ruleName, rule] of Object.entries(LAYOUT_RULES)) {
    it(`${ruleName}: pohyby prostředí v kartě (#136 AC2)`, () => {
      expect(sceneryScenes().length).toBeGreaterThan(0);
      for (const scene of sceneryScenes()) {
        expect(rule(scene), scene.label).toEqual([]);
      }
    });
  }

  it('žádný kousek prostředí v kartě nezasahuje do cesty široké jako značka (#136 AC2)', () => {
    for (const testCase of cardSceneryCases()) {
      expect(pathViolations(testCase), testCase.label).toEqual([]);
    }
  });

  it('nic z mapy nevyčnívá do zaoblených rohů karty, kde by se ořízlo', () => {
    const radius = PROGRESS_MAP_CARD_STYLE.cornerRadiusCss;
    const scenes = [...mapScenes(), ...goalScenes(), ...sceneryScenes()];
    for (const scene of scenes) {
      const { window } = cardWindowCaseOf(scene);
      const { card, gameArea } = cardWindowCase(window);
      const violations = scene.items
        .filter((item) => !isCornerItem(item, window, gameArea))
        .flatMap((item) => roundedCornerViolations(item, cardBox(card), radius));
      expect(violations, scene.label).toEqual([]);
    }
  });

  it('značka i symbol cíle mají v kartě v každém okně aspoň 64 px, i v těsném 932 × 430', () => {
    for (const testCase of pictureCases()) {
      const markerCss = testCase.layout.markerSize * testCase.area.scale;
      expect(markerCss, `${testCase.label}: značka`).toBeGreaterThanOrEqual(MIN_TAP_SIDE - 1e-6);
      const symbol = goalSymbolBox(testCase);
      expect(
        Math.min(widthOf(symbol), heightOf(symbol)),
        `${testCase.label}: symbol cíle`,
      ).toBeGreaterThanOrEqual(MIN_TAP_SIDE - 1e-6);
    }
  });

  it('cesta v kartě se řídí tvarem karty: na šířku zleva doprava, na výšku zdola nahoru', () => {
    for (const testCase of pictureCases()) {
      const { places } = testCase.layout;
      const landscape = isLandscape(testCase.area);
      for (let step = 1; step <= MAP_STEPS; step += 1) {
        const before = places[step - 1] ?? { x: 0, y: 0 };
        const place = places[step] ?? { x: 0, y: 0 };
        const where = `${testCase.label}, ${step - 1} → ${step}`;
        if (landscape) {
          expect(place.x, where).toBeGreaterThan(before.x);
        } else {
          expect(place.y, where).toBeLessThan(before.y);
        }
      }
    }
  });

  it('obrázek prostředí zakryje celou kartu, zachová poměr stran a jeho orientace se řídí tvarem karty', () => {
    for (const { label, card } of cardWindowCases()) {
      const size = { width: card.rect.width, height: card.rect.height };
      const { orientation, rect } = mapCardPictureCover(card);
      expect(orientation, label).toBe(mapOrientationOf(size));
      expect(rect.left, `${label}: vlevo`).toBeLessThanOrEqual(TOLERANCE);
      expect(rect.top, `${label}: nahoře`).toBeLessThanOrEqual(TOLERANCE);
      expect(rect.left + rect.width, `${label}: vpravo`).toBeGreaterThanOrEqual(
        size.width - TOLERANCE,
      );
      expect(rect.top + rect.height, `${label}: dole`).toBeGreaterThanOrEqual(
        size.height - TOLERANCE,
      );
      const picture = MAP_PICTURE_SIZE[orientation];
      expect(rect.width / rect.height, `${label}: poměr stran`).toBeCloseTo(
        picture.width / picture.height,
        4,
      );
      // Obrázek se zvětší jen tolik, aby přesně vyplnil šířku, nebo výšku karty.
      const fitsWidth = Math.abs(rect.width - size.width) <= TOLERANCE;
      const fitsHeight = Math.abs(rect.height - size.height) <= TOLERANCE;
      expect(fitsWidth || fitsHeight, `${label}: zbytečně zvětšený obrázek`).toBe(true);
    }
  });

  it('okraje stránky kolem hry mají během karty ztmavenou barvu hry, ne obrázek ani barvu mapy', () => {
    const backdrop = mapCardPageBackdrop();
    expect(backdrop.imageUrl).toBeUndefined();
    const expected = dimmedChannels(PAGE_BACKGROUND, PROGRESS_MAP_CARD_STYLE.dimAlpha);
    const actual = channelsOf(backdrop.color);
    actual.forEach((channel, index) => {
      expect(Math.abs(channel - (expected[index] ?? -10)), backdrop.color).toBeLessThanOrEqual(1);
    });
    for (const mapColor of Object.values(PROGRESS_MAP_BACKGROUNDS)) {
      expect(backdrop.color.toUpperCase()).not.toBe(mapColor.toUpperCase());
    }
  });

  it('každá kombinace okna, mapy a kroku je v kartě jiný případ', () => {
    const labels = mapScenes().map((scene) => scene.label);
    expect(new Set(labels).size).toBe(labels.length);
  });
});

/** Okna mapy podle jména, aby šlo k obrazovce najít její okno. */
const WINDOW_BY_LABEL: ReadonlyArray<readonly [string, TestWindow]> = [...MAP_WINDOWS]
  .sort((first, second) => second.name.length - first.name.length)
  .map((window) => [window.name, window] as const);

/** Okno, ze kterého obrazovka vznikla (popis začíná jménem okna). */
function cardWindowCaseOf(scene: LayoutScene): { window: TestWindow } {
  const found = WINDOW_BY_LABEL.find(([name]) => scene.label.startsWith(`${name},`));
  if (found === undefined) {
    throw new Error(`neznámé okno obrazovky: ${scene.label}`);
  }
  return { window: found[1] };
}

/** Okno po otočení zařízení: okna na šířku s okny na výšku a naopak. */
function rotatedPairs(): Array<[TestWindow, TestWindow]> {
  const landscape = MAP_WINDOWS.filter((window) => window.width > window.height);
  const portrait = MAP_WINDOWS.filter((window) => window.width <= window.height);
  const [firstLandscape] = landscape;
  const [firstPortrait] = portrait;
  const pairs: Array<[TestWindow, TestWindow]> = [];
  if (firstLandscape && firstPortrait) {
    landscape.forEach((window) => pairs.push([window, firstPortrait]));
    portrait.forEach((window) => pairs.push([window, firstLandscape]));
  }
  return pairs;
}

/** Okamžiky otočení během pohybu značky v ms od ukázání karty. */
// #154 AC3: značka vyrazí až po letu hvězdiček (nejvýš 0,6 s), proto
// i okamžiky 1700 a 2000 ms, kdy značka může být teprve na cestě.
const ROTATION_TIMES_MS = [0, 200, 500, 800, 1100, 1400, 1700, 2000];

describe('#145 AC6: po otočení zařízení se karta rozloží znovu a značka pokračuje', () => {
  it('po otočení stojí značka v nové kartě na stejném dílu cesty jako před ním (#135 AC4)', () => {
    const pairs = rotatedPairs();
    expect(pairs.length).toBeGreaterThan(0);
    for (const [before, after] of pairs) {
      const cardBefore = cardWindowCase(before).card;
      const cardAfter = cardWindowCase(after).card;
      for (const { label, move } of allMoves()) {
        const layoutBefore = layoutProgressMap(cardBefore.area, move.theme);
        const layoutAfter = layoutProgressMap(cardAfter.area, move.theme);
        for (const ms of ROTATION_TIMES_MS) {
          const where = `${before.name} → ${after.name}, ${label}, otočení v ${ms} ms`;
          const shareBefore = shareOfStep(
            layoutBefore.places,
            move,
            markerPointAt(layoutBefore, move, ms),
          );
          const shareAfter = shareOfStep(
            layoutAfter.places,
            move,
            markerPointAt(layoutAfter, move, ms),
          );
          expect(shareBefore, where).not.toBeNull();
          expect(shareAfter ?? -1, where).toBeCloseTo(shareBefore ?? -2, 3);
        }
      }
    }
  });
});
