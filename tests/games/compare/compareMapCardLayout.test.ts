import { describe, expect, it } from 'vitest';

import { COMPARE_GAME_AREA_FIT } from '../../../src/games/compare/logic/compareLayout';
import { homeButtonFor } from '../../../src/shared/logic/homeButton';
import { markerPointAt } from '../../../src/shared/logic/mapAnimation';
import { mapOrientationOf } from '../../../src/shared/logic/mapPictures';
import { PROGRESS_MAP_CARD_STYLE, PROGRESS_MAP_SHAPE } from '../../../src/shared/logic/mapTheme';
import { MAP_STEPS, MAP_THEMES } from '../../../src/shared/logic/progressMap';
import type { MapMove } from '../../../src/shared/logic/progressMap';
import {
  layoutProgressMapCard,
  mapCardPictureCover,
} from '../../../src/shared/logic/progressMapCard';
import type { ProgressMapCard } from '../../../src/shared/logic/progressMapCard';
import {
  DRAWN_MARKER_SCALE,
  MAP_ARRIVAL_PULSE_SCALE,
  layoutProgressMap,
} from '../../../src/shared/logic/progressMapLayout';
import type { ProgressMapLayout } from '../../../src/shared/logic/progressMapLayout';
import { settingsGearFor } from '../../../src/shared/logic/settingsGear';
import { gameAreaFor, safeAreaOrNone } from '../../../src/shared/logic/viewportLayout';
import type { GameArea } from '../../../src/shared/logic/viewportLayout';
import { HOME_SCREEN_WINDOWS, LAYOUT_RULES, MIN_TAP_SIDE } from '../../shared/layoutRules';
import type { LayoutItem, LayoutScene } from '../../shared/layoutRules';
import {
  IPAD_WINDOWS,
  JUST_ABOVE_LIMIT,
  NO_NOTCH,
  PHONE_PORTRAIT_EDGE_WINDOWS,
  PHONE_PORTRAIT_WINDOWS,
  PHONE_WINDOWS,
  box,
  overlaps,
  toCss,
  viewportOf,
} from '../../shared/viewportFixtures';
import type { Box, TestWindow } from '../../shared/viewportFixtures';

/**
 * Testy k #193 AC6: karta s mapou ve Znaménkách leží na iPadu i na
 * telefonech na šířku i na výšku podle stejných pravidel jako v Počítání
 * (#145 AC1, AC2, #133 AC7, #139 AC2). Znaménka kreslí herní plochu přes
 * celé okno (`COMPARE_GAME_AREA_FIT`), karta se proto počítá ve stejné
 * ploše a míře jako hra pod ní. Každé pravidlo je jeden test, který
 * v cyklu projde všechna okna, 5 map a kroky 0–3; popis případu je ve
 * zprávě `expect`.
 */

/** Nejmenší odstup karty i s bílým okrajem od okraje viditelné plochy (#145 AC1). */
const MIN_CARD_EDGE_CSS = 8;
const TOLERANCE = 0.01;

const SCALED_WINDOW: TestWindow = {
  name: '600×400 zmenšené zobrazení',
  width: 600,
  height: 400,
  safeArea: NO_NOTCH,
};

/** Všechna okna, na kterých se Znaménka hrají (jako v testech rozložení Znamének) a z plochy. */
const WINDOWS: readonly TestWindow[] = [
  ...IPAD_WINDOWS,
  JUST_ABOVE_LIMIT,
  ...PHONE_WINDOWS,
  SCALED_WINDOW,
  ...PHONE_PORTRAIT_WINDOWS,
  ...PHONE_PORTRAIT_EDGE_WINDOWS,
  ...HOME_SCREEN_WINDOWS,
];

interface CardCase {
  readonly label: string;
  readonly window: TestWindow;
  /** Herní plocha Znamének pod kartou. */
  readonly gameArea: GameArea;
  readonly card: ProgressMapCard;
}

function cardCase(window: TestWindow): CardCase {
  const viewport = viewportOf(window);
  return {
    label: window.name,
    window,
    gameArea: gameAreaFor(viewport, COMPARE_GAME_AREA_FIT),
    card: layoutProgressMapCard(viewport, COMPARE_GAME_AREA_FIT),
  };
}

const CASES: readonly CardCase[] = WINDOWS.map(cardCase);

function rectBox(rect: { left: number; top: number; width: number; height: number }): Box {
  return {
    left: rect.left,
    right: rect.left + rect.width,
    top: rect.top,
    bottom: rect.top + rect.height,
  };
}

/** Karta, jak ji dítě vidí: i s bílým okrajem, v CSS px okna. */
function drawnCardBox(card: ProgressMapCard): Box {
  const border = PROGRESS_MAP_CARD_STYLE.borderCss;
  const inner = rectBox(card.rect);
  return {
    left: inner.left - border,
    right: inner.right + border,
    top: inner.top - border,
    bottom: inner.bottom + border,
  };
}

/** Kde je vidět hra: volná plocha okna (bez výřezu a lišty) a zároveň plátno hry. */
function visibleAreaOf(window: TestWindow, area: GameArea): Box {
  const safe = safeAreaOrNone(viewportOf(window).safeArea);
  return {
    left: Math.max(safe.left, area.offsetX),
    right: Math.min(window.width - safe.right, area.offsetX + area.width * area.scale),
    top: Math.max(safe.top, area.offsetY),
    bottom: Math.min(window.height - safe.bottom, area.offsetY + area.height * area.scale),
  };
}

/** Kolečko a domeček v rozích okna (ťukací plochy v CSS px). */
function cornerItems(window: TestWindow): LayoutItem[] {
  const viewport = viewportOf(window);
  const gear = settingsGearFor(viewport);
  const home = homeButtonFor(viewport);
  const gearLeft = window.width - gear.right - gear.hitSize;
  return [
    {
      name: 'kolečko nastavení',
      box: {
        left: gearLeft,
        right: gearLeft + gear.hitSize,
        top: gear.top,
        bottom: gear.top + gear.hitSize,
      },
      reserved: true,
    },
    {
      name: 'domeček',
      box: {
        left: home.left,
        right: home.left + home.hitSize,
        top: home.top,
        bottom: home.top + home.hitSize,
      },
      reserved: true,
    },
  ];
}

function placeName(step: number): string {
  if (step === 0) {
    return 'start';
  }
  return step === MAP_STEPS ? 'cíl' : `zastávka ${step}`;
}

/** Průměr místa i s okrajem a poskočením po dojití (jako v Počítání). */
function drawnPlaceSize(layout: ProgressMapLayout, step: number): number {
  const share =
    step === MAP_STEPS ? PROGRESS_MAP_SHAPE.goalBorderShare : PROGRESS_MAP_SHAPE.placeBorderShare;
  const pulse = step === 0 ? 1 : MAP_ARRIVAL_PULSE_SCALE;
  return layout.placeSize * (1 + share) * pulse;
}

/** Značka stojí na kroku `step` (krok mapy z `step - 1`, po doběhnutí animace). */
function markerOn(layout: ProgressMapLayout, step: number): { x: number; y: number } {
  if (step === 0) {
    return layout.places[0] ?? { x: 0, y: 0 };
  }
  const move: MapMove = {
    from: step - 1,
    to: step,
    reachedGoal: step === MAP_STEPS,
    theme: 'island',
  };
  return markerPointAt(layout, move, Number.MAX_SAFE_INTEGER);
}

/** Mapa `theme` v kartě se značkou na kroku `step`; v cíli i slavící cíl a klíč. */
function mapScene(testCase: CardCase, themeIndex: number, step: number): LayoutScene {
  const theme = MAP_THEMES[themeIndex] ?? MAP_THEMES[0];
  const { card } = testCase;
  const area = card.area;
  const layout = layoutProgressMap(area, theme);
  const places: LayoutItem[] = layout.places.map((place, index) => {
    const size = drawnPlaceSize(layout, index);
    return { name: placeName(index), box: toCss(box(place.x, place.y, size, size), area) };
  });
  const marker = markerOn(layout, step);
  const markerSize = layout.markerSize * DRAWN_MARKER_SCALE;
  const { goalSymbol, goalCelebration, goalKey } = layout;
  const items: LayoutItem[] = [
    ...cornerItems(testCase.window),
    ...places,
    {
      name: 'symbol cíle',
      box: toCss(box(goalSymbol.x, goalSymbol.y, goalSymbol.size, goalSymbol.size), area),
    },
    { name: 'značka', box: toCss(box(marker.x, marker.y, markerSize, markerSize), area) },
  ];
  if (step === MAP_STEPS) {
    items.push(
      {
        name: 'slavící cíl',
        box: toCss(
          box(goalCelebration.x, goalCelebration.y, goalCelebration.size, goalCelebration.size),
          area,
        ),
      },
      {
        name: 'štítek klíče',
        box: toCss(box(goalKey.x, goalKey.y, goalKey.width, goalKey.height), area),
      },
    );
  }
  const own = placeName(step);
  // Značka stojí na svém místě; v cíli smí překrýt i symbol a záři cíle (#133, #135).
  const shared = new Set(
    step === MAP_STEPS ? ['značka', 'cíl', 'symbol cíle', 'slavící cíl'] : ['značka', own],
  );
  const goalParts = new Set(['cíl', 'symbol cíle', 'slavící cíl']);
  return {
    label: `${testCase.label}, mapa ${theme}, značka na kroku ${step}`,
    free: rectBox(card.rect),
    items,
    mayOverlap: (first, second) =>
      (shared.has(first.name) && shared.has(second.name)) ||
      (goalParts.has(first.name) && goalParts.has(second.name)),
  };
}

const SCENES: readonly LayoutScene[] = CASES.flatMap((testCase) =>
  MAP_THEMES.flatMap((_, themeIndex) =>
    Array.from({ length: MAP_STEPS + 1 }, (__, step) => mapScene(testCase, themeIndex, step)),
  ),
);

describe('#193 AC6: karta s mapou ve Znaménkách leží podle pravidel z Počítání (#145 AC1)', () => {
  it('karta i s bílým okrajem je ve všech oknech aspoň 8 px od okraje viditelné plochy', () => {
    for (const { label, window, gameArea, card } of CASES) {
      const visible = visibleAreaOf(window, gameArea);
      const drawn = drawnCardBox(card);
      const overhangs = [
        visible.left + MIN_CARD_EDGE_CSS - drawn.left,
        drawn.right - (visible.right - MIN_CARD_EDGE_CSS),
        visible.top + MIN_CARD_EDGE_CSS - drawn.top,
        drawn.bottom - (visible.bottom - MIN_CARD_EDGE_CSS),
      ].filter((overhang) => overhang > TOLERANCE);
      expect(overhangs, label).toEqual([]);
    }
  });

  it('karta i s bílým okrajem nezasahuje do kolečka ani domečku', () => {
    for (const { label, window, card } of CASES) {
      const drawn = drawnCardBox(card);
      const hits = cornerItems(window)
        .filter((corner) => overlaps(drawn, corner.box))
        .map((corner) => corner.name);
      expect(hits, label).toEqual([]);
    }
  });

  it('karta má nenulovou plochu, leží v herní ploše Znamének a má stejnou míru jako hra', () => {
    for (const { label, gameArea, card } of CASES) {
      expect(card.rect.width, label).toBeGreaterThan(0);
      expect(card.rect.height, label).toBeGreaterThan(0);
      expect(card.area.scale, `${label}: míra`).toBeCloseTo(gameArea.scale, 6);
      expect(card.area.width * card.area.scale, `${label}: šířka`).toBeCloseTo(card.rect.width, 2);
      expect(card.area.height * card.area.scale, `${label}: výška`).toBeCloseTo(
        card.rect.height,
        2,
      );
      expect(card.area.offsetX, `${label}: vlevo`).toBeCloseTo(card.rect.left, 2);
      expect(card.area.offsetY, `${label}: nahoře`).toBeCloseTo(card.rect.top, 2);
    }
  });

  it('obrázek mapy má orientaci podle tvaru karty a zakryje celou kartu', () => {
    for (const { label, card } of CASES) {
      const cover = mapCardPictureCover(card);
      expect(cover.orientation, label).toBe(mapOrientationOf(card.rect));
      expect(cover.rect.left, label).toBeLessThanOrEqual(TOLERANCE);
      expect(cover.rect.top, label).toBeLessThanOrEqual(TOLERANCE);
      expect(cover.rect.left + cover.rect.width, label).toBeGreaterThanOrEqual(
        card.rect.width - TOLERANCE,
      );
      expect(cover.rect.top + cover.rect.height, label).toBeGreaterThanOrEqual(
        card.rect.height - TOLERANCE,
      );
    }
  });
});

describe('#193 AC6: celá mapa leží uvnitř karty ve všech oknech, na 5 mapách a v krocích 0–3', () => {
  for (const [ruleName, rule] of Object.entries(LAYOUT_RULES)) {
    it(`${ruleName}: místa, symbol cíle, značka, slavící cíl a klíč v kartě`, () => {
      expect(SCENES.length).toBe(WINDOWS.length * MAP_THEMES.length * (MAP_STEPS + 1));
      for (const scene of SCENES) {
        expect(rule(scene), scene.label).toEqual([]);
      }
    });
  }

  it('značka i symbol cíle mají v kartě v každém okně aspoň 64 px', () => {
    for (const testCase of CASES) {
      for (const theme of MAP_THEMES) {
        const area = testCase.card.area;
        const layout = layoutProgressMap(area, theme);
        const label = `${testCase.label}, mapa ${theme}`;
        expect(layout.markerSize * area.scale, `${label}: značka`).toBeGreaterThanOrEqual(
          MIN_TAP_SIDE - 1e-6,
        );
        expect(layout.goalSymbol.size * area.scale, `${label}: symbol cíle`).toBeGreaterThanOrEqual(
          MIN_TAP_SIDE - 1e-6,
        );
      }
    }
  });
});
