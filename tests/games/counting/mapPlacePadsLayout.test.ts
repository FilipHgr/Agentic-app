import { describe, expect, it } from 'vitest';

import { layoutMapFootprints } from '../../../src/games/counting/logic/mapFootprints';
import { layoutMapScenery } from '../../../src/games/counting/logic/mapScenery';
import { MAP_STEPS, MAP_THEMES } from '../../../src/games/counting/logic/progressMap';
import {
  MAP_PATH_WIDTH_SHARE,
  pathLinePoints,
} from '../../../src/games/counting/logic/progressMapLayout';
import { PROGRESS_MAP_CARD_STYLE } from '../../../src/games/counting/logic/theme';
import { fitViolations, overlapViolations } from '../../shared/layoutRules';
import type { LayoutItem, LayoutScene } from '../../shared/layoutRules';
import { box, toCss } from '../../shared/viewportFixtures';
import { isOwnSurrounding } from './layoutScenes';
import { describePoint, printBoxOverlap } from './mapFootprintHelpers';
import { cardBox, insideCard, roundedCornerViolations } from './mapCardScenes';
import { MAP_WINDOWS, MARKER_NAME, placeName } from './mapLayoutScenes';
import { GOAL_SYMBOL_NAME, drawnMarkerSize, drawnPlaceSize } from './mapPictureLayoutScenes';
import { padBox, padCases, padCssBox, padName, padsWithStep } from './mapPlacePadHelpers';
import type { PadCase } from './mapPlacePadHelpers';
import { segmentName } from './mapPathHelpers';
import { segmentToBoxDistance } from './mapSceneryScenes';

/**
 * Testy k #147 AC3: podložky míst nepřekrývají jinou podložku, symbol
 * cíle, slavící cíl, místo klíče, kousky prostředí (#136), roh kolečka
 * a domečku, výřez ani lištu a nevyčnívají z plochy mapy v kartě (#145,
 * i do jejích zaoblených rohů). Cesta (#146) a stopy (#144) smějí vést
 * pod podložku jen u krajních míst svého úseku: úsek ze startu na
 * 1. zastávku smí pod podložku startu a 1. zastávky, pod podložku
 * 2. zastávky ani cíle ne.
 *
 * Měří se ve všech oknech mapy z #133 AC7 a na 5 mapách, mapa v kartě.
 * Kroky 0–3: podložky, prostředí, stopy, symbol cíle, slavící cíl i místo
 * klíče na kroku značky nezávisí; značka po podložkách chodí (stojí na
 * místě, které na podložce leží), proto se smí podložky dotknout na
 * každém kroku. Každá mapa se tak měří jednou. Výřez a lišta jsou mimo
 * kartu (#145 AC1), proto podložka, která nevyčnívá z karty, do nich
 * nezasáhne. Po otočení (AC6) se mapa rozloží v novém okně; ta okna jsou
 * v `MAP_WINDOWS` taky.
 *
 * Podložka se měří jako svůj obdélník (`mapPlacePadHelpers.ts`).
 * Prostředí, stopy a klíč se smějí posunout; že pak dál platí jejich
 * pravidla, hlídají jejich testy (`mapCardLayout.test.ts`,
 * `mapFootprintsLayout.test.ts`, `mapGoalKeyLayout.test.ts`).
 *
 * Každé pravidlo má jeden test, který v cyklu projde všechny případy;
 * popis případu je ve zprávě `expect`.
 */

/** Tolerance na zaokrouhlení v CSS px. */
const TOLERANCE_CSS = 0.01;

const PAD_PREFIX = 'podložka';
const CELEBRATING_GOAL_NAME = 'slavící symbol cíle';
const KEY_NAME = 'štítek klíče';

function tolerance(testCase: PadCase): number {
  return TOLERANCE_CSS / testCase.area.scale;
}

function isPad(item: LayoutItem): boolean {
  return item.name.startsWith(PAD_PREFIX);
}

function padItems(testCase: PadCase): LayoutItem[] {
  return padsWithStep(testCase).map(({ pad, step }) => ({
    name: padName(step),
    box: padCssBox(testCase, pad),
  }));
}

/** Kousky prostředí a jejich pruhy v CSS px. */
function sceneryItems(testCase: PadCase): LayoutItem[] {
  const scenery = layoutMapScenery(testCase.area, testCase.theme, testCase.layout);
  return scenery.pieces.flatMap((piece, index) => {
    const name = `${piece.kind} ${index + 1}`;
    const sweep: LayoutItem = {
      name: `plocha ${name}`,
      box: toCss(piece.sweep, testCase.area),
    };
    if (!piece.lane) {
      return [sweep];
    }
    return [sweep, { name: `pruh ${name}`, box: toCss(piece.lane, testCase.area) }];
  });
}

/**
 * Mapa v kartě s podložkami, místy, značkou na startu, symbolem cíle,
 * slavícím cílem, místem klíče a plochami prostředí. Hlídají se jen
 * dvojice s podložkou; ostatní dvojice hlídají testy #133–#145.
 */
function padScene(testCase: PadCase): LayoutScene {
  const { area, layout } = testCase;
  const places: LayoutItem[] = layout.places.map((place, step) => {
    const size = drawnPlaceSize(layout, step);
    return { name: placeName(step), box: toCss(box(place.x, place.y, size, size), area) };
  });
  const start = layout.places[0] ?? { x: 0, y: 0 };
  const markerSize = drawnMarkerSize(layout);
  const { goalSymbol: symbol, goalCelebration: celebration, goalKey: key } = layout;
  const items: LayoutItem[] = [
    ...padItems(testCase),
    ...places,
    { name: MARKER_NAME, box: toCss(box(start.x, start.y, markerSize, markerSize), area) },
    {
      name: GOAL_SYMBOL_NAME,
      box: toCss(box(symbol.x, symbol.y, symbol.size, symbol.size), area),
    },
    {
      name: CELEBRATING_GOAL_NAME,
      box: toCss(box(celebration.x, celebration.y, celebration.size, celebration.size), area),
    },
    { name: KEY_NAME, box: toCss(box(key.x, key.y, key.width, key.height), area) },
    ...sceneryItems(testCase),
  ];
  const scene: LayoutScene = {
    label: testCase.label,
    free: cardBox(testCase.card),
    items,
    mayOverlap: (first, second) => {
      const names = [first.name, second.name];
      if (!isPad(first) && !isPad(second)) {
        return true;
      }
      // Místo leží na své podložce a značka po podložkách chodí.
      const ownPlace = layout.places.some(
        (_, step) => names.includes(padName(step)) && names.includes(placeName(step)),
      );
      // #147 upřesnění 1: podložka cíle leží pod symbolem cíle i pod slavícím
      // cílem, je to podložka právě toho místa. Jiné podložky je nepřekryjí.
      const goalOnOwnPad =
        names.includes(padName(MAP_STEPS)) &&
        (names.includes(GOAL_SYMBOL_NAME) || names.includes(CELEBRATING_GOAL_NAME));
      return (
        ownPlace ||
        goalOnOwnPad ||
        names.includes(MARKER_NAME) ||
        isOwnSurrounding(first, second) ||
        isOwnSurrounding(second, first)
      );
    },
  };
  return insideCard(scene, testCase.window);
}

let cachedScenes: LayoutScene[] | undefined;

function padScenes(): LayoutScene[] {
  cachedScenes ??= padCases().map(padScene);
  return cachedScenes;
}

/** Krajní místa úseku `segment`: pod jejich podložky úsek smí vést. */
function isSegmentEnd(segment: number, step: number): boolean {
  return step === segment || step === segment + 1;
}

describe('#147 AC3: podložky nic nepřekrývají a nevyčnívají z mapy v kartě', () => {
  it('v kartě jsou všechna okna mapy a všech 5 map', () => {
    expect(padScenes().length).toBe(MAP_WINDOWS.length * MAP_THEMES.length);
  });

  it('podložka nepřekrývá jinou podložku ani jiné místo, symbol cíle, slavící cíl, místo klíče, kousky prostředí ani roh kolečka a domečku', () => {
    for (const scene of padScenes()) {
      expect(overlapViolations(scene), scene.label).toEqual([]);
    }
  });

  it('podložka nevyčnívá z plochy mapy v kartě, a tak ani do výřezu a na lištu', () => {
    for (const testCase of padCases()) {
      const scene: LayoutScene = {
        label: testCase.label,
        free: cardBox(testCase.card),
        items: padItems(testCase),
      };
      expect(fitViolations(scene), testCase.label).toEqual([]);
    }
  });

  it('podložka nevyčnívá do zaoblených rohů karty, kde by se ořízla', () => {
    const radius = PROGRESS_MAP_CARD_STYLE.cornerRadiusCss;
    for (const testCase of padCases()) {
      const violations = padItems(testCase).flatMap((item) =>
        roundedCornerViolations(item, cardBox(testCase.card), radius),
      );
      expect(violations, testCase.label).toEqual([]);
    }
  });

  it('čára cesty vede pod podložku jen u krajních míst svého úseku', () => {
    for (const testCase of padCases()) {
      const { layout } = testCase;
      const halfLine = (layout.markerSize * MAP_PATH_WIDTH_SHARE) / 2;
      for (let segment = 0; segment < MAP_STEPS; segment += 1) {
        const line = pathLinePoints(layout, segment);
        for (const { pad, step } of padsWithStep(testCase)) {
          if (isSegmentEnd(segment, step)) {
            continue;
          }
          const area = padBox(pad);
          const nearest = Math.min(
            ...line
              .slice(1)
              .map((point, index) => segmentToBoxDistance(line[index] ?? point, point, area)),
          );
          expect(
            nearest - halfLine,
            `${testCase.label}, ${segmentName(segment)} vede pod ${padName(step)}`,
          ).toBeGreaterThanOrEqual(-tolerance(testCase));
        }
      }
    }
  });

  it('stopy vedou pod podložku jen u krajních míst svého úseku', () => {
    for (const testCase of padCases()) {
      const footprints = layoutMapFootprints(testCase.area, testCase.theme, testCase.layout);
      expect(footprints.prints.length, testCase.label).toBeGreaterThan(0);
      for (const print of footprints.prints) {
        for (const { pad, step } of padsWithStep(testCase)) {
          if (isSegmentEnd(print.segment, step)) {
            continue;
          }
          expect(
            printBoxOverlap(print, padBox(pad)),
            `${testCase.label}, stopa v ${describePoint(print)} (${segmentName(print.segment)}) pod ${padName(step)}`,
          ).toBeLessThanOrEqual(tolerance(testCase));
        }
      }
    }
  });
});
