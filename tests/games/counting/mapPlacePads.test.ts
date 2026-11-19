import { describe, expect, it } from 'vitest';

import { isPlaceLitAt, markerShareAt } from '../../../src/games/counting/logic/mapAnimation';
import {
  MAP_PLACE_PAD_KINDS,
  layoutMapPlacePads,
  mapPlacePadStyleFor,
} from '../../../src/games/counting/logic/mapPlacePads';
import type { PlacePadKind } from '../../../src/games/counting/logic/mapPlacePads';
import type { MapLook } from '../../../src/games/counting/logic/mapPictureLoading';
import {
  MAP_STEPS,
  MAP_THEMES,
  mapShowMs,
  stepOnMap,
} from '../../../src/games/counting/logic/progressMap';
import type { MapThemeId } from '../../../src/games/counting/logic/progressMap';
import {
  layoutProgressMap,
  progressMapMarkerSize,
} from '../../../src/games/counting/logic/progressMapLayout';
import { PROGRESS_MAP_SHAPE } from '../../../src/games/counting/logic/theme';
import { HOME_SCREEN_WINDOWS } from '../../shared/layoutRules';
import { IPAD_WINDOWS } from '../../shared/viewportFixtures';
import type { TestWindow } from '../../shared/viewportFixtures';
import { sampleTimes } from './mapAnimationHelpers';
import { cardBox, cardWindowCase } from './mapCardScenes';
import { MAP_WINDOWS } from './mapLayoutScenes';
import { padCases, padName, padsWithStep } from './mapPlacePadHelpers';
import type { PadCase } from './mapPlacePadHelpers';

/**
 * Testy k #147 AC1, AC2, AC4 a AC6: pod každým ze 4 míst mapy postupu
 * leží podložka podle tématu (les pařez, ostrov písečný kopeček, hrad
 * kamenná dlaždice, podmoří kámen s řasou, vesmír planetka), je o něco
 * větší než kruh místa a se středem v jeho středu. Měří se v kartě (#145)
 * ve všech oknech mapy z #133 AC7 a na 5 mapách. Rozložení podložek na
 * kroku značky nezávisí, proto se kroky 0–3 měří jednou za mapu.
 *
 * Každé pravidlo má jeden test, který v cyklu projde všechny případy;
 * popis případu je ve zprávě `expect`. Navržené rozhraní je
 * v `mapPlacePadHelpers.ts`. Nepřekrývání (AC3) hlídá
 * `mapPlacePadsLayout.test.ts`, kontrast (AC5) `mapPlacePadsContrast.test.ts`.
 *
 * Po otočení (AC6) se mapa rozloží v novém okně; ta okna jsou
 * v `MAP_WINDOWS` taky, takže pravidla AC2–AC5 platí i po otočení. Že
 * podložky barvy nemění s rozsvícením (AC4), dává rozhraní: barvy
 * `mapPlacePadStyleFor` závisí jen na mapě a vzhledu.
 *
 * Ručně se kontroluje (AC7): tvar podložek (letokruhy, kořeny, řasa)
 * podle obrázků varianty D, 60 fps ve WebKitu na iPadu a iPhonu.
 */

/** Druh podložek podle mapy (AC1). */
const EXPECTED_KINDS: Readonly<Record<MapThemeId, PlacePadKind>> = {
  forest: 'stump',
  island: 'sandMound',
  castle: 'stoneTile',
  underwater: 'seaweedRock',
  space: 'planetoid',
};

/** Vnější rozměr podložky jako násobek průměru místa (AC2). */
const MIN_PAD_SCALE = 1.3;
const MAX_PAD_SCALE = 1.5;
const MIN_TIGHT_PAD_SCALE = 1.2;

/** Dnešní poměr průměru místa k průměru značky (#133), kruh se nezmenšuje. */
const PLACE_TO_MARKER = 0.7;

/** Tolerance na zaokrouhlení v CSS px. */
const TOLERANCE_CSS = 0.01;

const LOOKS: readonly MapLook[] = ['picture', 'placeholder'];

/**
 * Okna iPadu, kde je v kartě místa dost: tam podložka nesmí klesnout pod
 * 1,3× (stejný předpoklad jako u stop, #144 AC2).
 */
const ROOMY_WINDOW_NAMES = new Set(
  [...IPAD_WINDOWS, ...HOME_SCREEN_WINDOWS.filter((window) => window.name.startsWith('iPad'))].map(
    (window) => window.name,
  ),
);

function tolerance(testCase: PadCase): number {
  return TOLERANCE_CSS / testCase.area.scale;
}

function ratio(value: number): string {
  return `${value.toFixed(3)}×`;
}

/** Průměr kruhu místa i s okrajem, bez poskočení (cíl má silnější okraj). */
function placeCircleWithBorder(testCase: PadCase, step: number): number {
  const share =
    step === MAP_STEPS ? PROGRESS_MAP_SHAPE.goalBorderShare : PROGRESS_MAP_SHAPE.placeBorderShare;
  return testCase.layout.placeSize * (1 + share);
}

/** Nejmenší a největší vnější rozměr podložek případu jako násobek průměru místa. */
function padScales(testCase: PadCase): { smallest: number; largest: number } {
  const { placeSize } = testCase.layout;
  const sides = testCase.pads.pads.flatMap((pad) => [pad.width, pad.height]);
  return {
    smallest: Math.min(...sides) / placeSize,
    largest: Math.max(...sides) / placeSize,
  };
}

describe('#147 AC1: každé místo mapy má podložku podle tématu mapy', () => {
  it('les má pařezy, ostrov písečné kopečky, hrad kamenné dlaždice, podmoří kameny s řasou a vesmír planetky', () => {
    expect(MAP_PLACE_PAD_KINDS).toEqual(EXPECTED_KINDS);
    for (const testCase of padCases()) {
      expect(testCase.pads.kind, testCase.label).toBe(EXPECTED_KINDS[testCase.theme]);
    }
  });

  it('dvě mapy nikdy nemají stejný druh podložky', () => {
    const kinds = MAP_THEMES.map((theme) => MAP_PLACE_PAD_KINDS[theme]);
    expect(kinds.length).toBe(5);
    expect(new Set(kinds).size, kinds.join(', ')).toBe(kinds.length);
  });

  it('podložku má každé ze 4 míst: start, obě zastávky i cíl', () => {
    expect(padCases().length).toBe(MAP_WINDOWS.length * MAP_THEMES.length);
    for (const testCase of padCases()) {
      expect(testCase.pads.pads.length, testCase.label).toBe(MAP_STEPS + 1);
      for (const { pad, step } of padsWithStep(testCase)) {
        const where = `${testCase.label}, ${padName(step)}`;
        expect(pad.width, where).toBeGreaterThan(0);
        expect(pad.height, where).toBeGreaterThan(0);
      }
    }
  });

  it('symbol cíle u cíle zůstane i s podložkami (#134 AC2)', () => {
    for (const testCase of padCases()) {
      const { goalSymbol, markerSize } = testCase.layout;
      expect(goalSymbol.size, testCase.label).toBeGreaterThanOrEqual(markerSize);
    }
  });

  it('podložky mají barvy s obrázkem mapy i v zástupném vzhledu bez obrázku', () => {
    for (const theme of MAP_THEMES) {
      for (const look of LOOKS) {
        const style = mapPlacePadStyleFor(theme, look);
        const where = `${theme}, ${look}`;
        expect(style.fillColor, `${where}: plocha`).toMatch(/^#[0-9A-Fa-f]{6}$/);
        expect(style.outlineColor, `${where}: okraj`).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
    }
  });
});

describe('#147 AC2: podložka je o něco větší než kruh místa a se středem v jeho středu', () => {
  it('střed každé podložky je ve středu jejího místa', () => {
    for (const testCase of padCases()) {
      const slack = tolerance(testCase);
      for (const { pad, step } of padsWithStep(testCase)) {
        const place = testCase.layout.places[step] ?? { x: Infinity, y: Infinity };
        const where = `${testCase.label}, ${padName(step)}`;
        expect(Math.abs(pad.x - place.x), `${where}: vodorovně`).toBeLessThanOrEqual(slack);
        expect(Math.abs(pad.y - place.y), `${where}: svisle`).toBeLessThanOrEqual(slack);
      }
    }
  });

  it('podložka přesahuje kruh místa i s jeho okrajem na každé straně', () => {
    for (const testCase of padCases()) {
      for (const { pad, step } of padsWithStep(testCase)) {
        const circle = placeCircleWithBorder(testCase, step);
        const where = `${testCase.label}, ${padName(step)}: ${pad.width.toFixed(1)} × ${pad.height.toFixed(1)}, kruh ${circle.toFixed(1)}`;
        expect(pad.width, where).toBeGreaterThan(circle);
        expect(pad.height, where).toBeGreaterThan(circle);
      }
    }
  });

  it('vnější rozměr podložky je nejvýš 1,5× a nejméně 1,2× průměru místa', () => {
    for (const testCase of padCases()) {
      const { smallest, largest } = padScales(testCase);
      const where = `${testCase.label}: ${ratio(smallest)} až ${ratio(largest)}`;
      expect(smallest, where).toBeGreaterThanOrEqual(MIN_TIGHT_PAD_SCALE - 1e-6);
      expect(largest, where).toBeLessThanOrEqual(MAX_PAD_SCALE + 1e-6);
    }
  });

  it('pod 1,3× průměru místa klesne podložka jen v těsných oknech telefonu, nikdy na iPadu', () => {
    // Seznam těsných oken (AC2: „změří a vypíše“) je ve zprávě testu.
    const tight = padCases()
      .filter((testCase) => padScales(testCase).smallest < MIN_PAD_SCALE - 1e-6)
      .map((testCase) => `${testCase.label} (${ratio(padScales(testCase).smallest)})`);
    const tightOnIpad = padCases()
      .filter((testCase) => ROOMY_WINDOW_NAMES.has(testCase.window.name))
      .filter((testCase) => padScales(testCase).smallest < MIN_PAD_SCALE - 1e-6)
      .map((testCase) => testCase.label);
    expect(tightOnIpad, `těsná okna pod 1,3×: ${tight.join('; ') || 'žádná'}`).toEqual([]);
  });

  it('kruh místa se kvůli podložkám nezmenší: je dál 0,7 průměru značky a značka má plnou velikost', () => {
    for (const testCase of padCases()) {
      const { placeSize, markerSize } = testCase.layout;
      expect(placeSize / markerSize, testCase.label).toBeCloseTo(PLACE_TO_MARKER, 6);
      expect(markerSize, testCase.label).toBeCloseTo(progressMapMarkerSize(testCase.area), 6);
    }
  });

  it('při stejném okně a mapě vyjdou podložky pokaždé stejně', () => {
    for (const testCase of padCases()) {
      const again = layoutMapPlacePads(
        testCase.area,
        testCase.theme,
        layoutProgressMap(testCase.area, testCase.theme),
      );
      expect(again, testCase.label).toEqual(testCase.pads);
      expect(layoutMapPlacePads(testCase.area, testCase.theme), testCase.label).toEqual(
        testCase.pads,
      );
    }
  });
});

/** Nová mapa po cíli: hráč s `completedMaps` mapami stojí v cíli a udělá krok. */
function newMapMoves(): Array<{ label: string; move: ReturnType<typeof stepOnMap>['move'] }> {
  return MAP_THEMES.map((_, completedMaps) => {
    const { move } = stepOnMap({ step: MAP_STEPS, completedMaps });
    return { label: `nová mapa ${move.theme} po cíli`, move };
  });
}

describe('#147 AC4: rozsvícení míst se s podložkami nemění', () => {
  it('na nové mapě svítí jen start, dokud značka nedojde na 1. zastávku', () => {
    for (const { label, move } of newMapMoves()) {
      expect(move.from, label).toBe(0);
      for (const ms of sampleTimes(mapShowMs(move))) {
        if (markerShareAt(ms) >= 1) {
          continue;
        }
        expect(isPlaceLitAt(move, 0, ms), `${label}, start, ${ms} ms`).toBe(true);
        for (let step = 1; step <= MAP_STEPS; step += 1) {
          expect(isPlaceLitAt(move, step, ms), `${label}, místo ${step}, ${ms} ms`).toBe(false);
        }
      }
    }
  });
});

/** Okno po otočení zařízení: okna na šířku s okny na výšku a naopak. */
function rotatedPairs(): Array<[TestWindow, TestWindow]> {
  const landscape = MAP_WINDOWS.filter((window) => window.width > window.height);
  const portrait = MAP_WINDOWS.filter((window) => window.width <= window.height);
  return [
    ...landscape.flatMap((before) =>
      portrait.map((after): [TestWindow, TestWindow] => [before, after]),
    ),
    ...portrait.flatMap((before) =>
      landscape.map((after): [TestWindow, TestWindow] => [before, after]),
    ),
  ];
}

describe('#147 AC6: po otočení zařízení se podložky rozloží v nové kartě znovu', () => {
  it('po otočení leží každá podložka na svém místě v nové kartě a celá v ní', () => {
    const pairs = rotatedPairs();
    expect(pairs.length).toBeGreaterThan(0);
    for (const [before, after] of pairs) {
      const { card } = cardWindowCase(after);
      const inner = cardBox(card);
      for (const theme of MAP_THEMES) {
        const layout = layoutProgressMap(card.area, theme);
        const pads = layoutMapPlacePads(card.area, theme, layout);
        const slack = TOLERANCE_CSS / card.area.scale;
        pads.pads.forEach((pad, step) => {
          const where = `${before.name} → ${after.name}, mapa ${theme}, ${padName(step)}`;
          const place = layout.places[step] ?? { x: Infinity, y: Infinity };
          expect(Math.abs(pad.x - place.x), where).toBeLessThanOrEqual(slack);
          expect(Math.abs(pad.y - place.y), where).toBeLessThanOrEqual(slack);
          const left = card.area.offsetX + (pad.x - pad.width / 2) * card.area.scale;
          const right = card.area.offsetX + (pad.x + pad.width / 2) * card.area.scale;
          const top = card.area.offsetY + (pad.y - pad.height / 2) * card.area.scale;
          const bottom = card.area.offsetY + (pad.y + pad.height / 2) * card.area.scale;
          expect(left, where).toBeGreaterThanOrEqual(inner.left - TOLERANCE_CSS);
          expect(right, where).toBeLessThanOrEqual(inner.right + TOLERANCE_CSS);
          expect(top, where).toBeGreaterThanOrEqual(inner.top - TOLERANCE_CSS);
          expect(bottom, where).toBeLessThanOrEqual(inner.bottom + TOLERANCE_CSS);
        });
      }
    }
  });
});
