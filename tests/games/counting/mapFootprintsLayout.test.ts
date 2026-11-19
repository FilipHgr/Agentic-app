import { describe, expect, it } from 'vitest';

import { layoutMapFootprints } from '../../../src/games/counting/logic/mapFootprints';
import { layoutMapScenery } from '../../../src/games/counting/logic/mapScenery';
import { MAP_STEPS } from '../../../src/games/counting/logic/progressMap';
import { layoutProgressMap } from '../../../src/games/counting/logic/progressMapLayout';
import { IPAD_WINDOWS } from '../../shared/viewportFixtures';
import { HOME_SCREEN_WINDOWS } from '../../shared/layoutRules';
import { cardBox } from './mapCardScenes';
import { placeName } from './mapLayoutScenes';
import { drawnMarkerSize, drawnPlaceSize } from './mapPictureLayoutScenes';
import {
  describePoint,
  footprintCases,
  longerSide,
  printBoxOverlap,
  printCircleOverlap,
  printCorners,
  printsOnArc,
} from './mapFootprintHelpers';
import type { FootprintCase, PrintOnArc } from './mapFootprintHelpers';
import {
  MAP_WINDOWS,
  SEGMENT_COUNT,
  denseArcOf,
  projectOntoArc,
  segmentName,
} from './mapPathHelpers';

/**
 * Testy k #144 AC2 (upravené podle #146 AC7): stopy na cestě leží
 * v kartě (#145) ve všech oknech mapy z #133 AC7 a na 5 mapách na oblouku
 * cesty (#146), mají správnou velikost a rovnoměrné rozestupy po délce
 * oblouku a nepřekrývají místa, značku, cíl, klíč ani prostředí.
 *
 * Kroky 0–3: rozložení stop na kroku značky nezávisí (kreslí se celá
 * cesta, mění se jen, které svítí), proto se každá mapa měří jednou a
 * značka stojí v pravidle nepřekrývání na každém místě 0 až 3 najednou.
 * Po otočení zařízení (AC5) se mapa rozloží v novém okně; ta okna jsou
 * v `MAP_WINDOWS` taky, takže tato pravidla platí i po otočení.
 *
 * Stopa je natočený obdélník `width × height` se středem `x`, `y`. Pruh
 * cesty je široký jako nakreslená značka (i s okrajem a poskočením, jako
 * #136 AC2 a #146 AC2). Rozestup je rozdíl ušlé délky po oblouku dvou
 * sousedních stop téhož úseku. Velikost: 18–30 % průměru značky, jen když
 * se pravidla nedají splnit všechna, smí klesnout na 15 %; na iPadu je
 * místa dost (AC2: nejkratší úsek se vejde i v okně 932 × 430), tam
 * platí 18 %.
 *
 * Každé pravidlo má jeden test, který v cyklu projde všechny případy;
 * popis případu je ve zprávě `expect`. Navržené rozhraní je
 * v `mapFootprintHelpers.ts`.
 */

/** Střed stopy je od oblouku nejvýš tento díl průměru značky. */
const MAX_OFF_ARC_SHARE = 0.15;

/** Delší strana stopy jako díl průměru značky. */
const MIN_PRINT_SHARE = 0.18;
const MAX_PRINT_SHARE = 0.3;
const MIN_TIGHT_PRINT_SHARE = 0.15;

/** O kolik se smějí lišit rozestupy na úseku a mezi úseky (od menšího). */
const MAX_SPACING_SPREAD_IN_SEGMENT = 0.1;
const MAX_SPACING_SPREAD_BETWEEN_SEGMENTS = 0.15;

/** Nejméně stop na úseku. */
const MIN_PRINTS_PER_SEGMENT = 3;

/** Tolerance na zaokrouhlení v CSS px. */
const TOLERANCE_CSS = 0.01;

/** Okna iPadu, kde je místa dost a stopa nesmí klesnout pod 18 %. */
const ROOMY_WINDOW_NAMES = new Set(
  [...IPAD_WINDOWS, ...HOME_SCREEN_WINDOWS.filter((window) => window.name.startsWith('iPad'))].map(
    (window) => window.name,
  ),
);

function tolerance(testCase: FootprintCase): number {
  return TOLERANCE_CSS / testCase.area.scale;
}

function printLabel(testCase: FootprintCase, each: PrintOnArc): string {
  return `${testCase.label}, stopa ${each.order + 1} v ${describePoint(each.print)}`;
}

function percent(value: number): string {
  return `${(value * 100).toFixed(1)} %`;
}

/** Rozestupy sousedních stop po délce oblouku podle úseku. */
function spacingsBySegment(prints: readonly PrintOnArc[]): number[][] {
  return Array.from({ length: SEGMENT_COUNT }, (_, segment) => {
    const onSegment = prints.filter((each) => each.segment === segment);
    return onSegment.slice(1).map((each, index) => each.along - (onSegment[index]?.along ?? 0));
  });
}

/** O kolik je největší hodnota větší než nejmenší, jako díl nejmenší. */
function spread(values: readonly number[]): number {
  if (values.length < 2) {
    return 0;
  }
  const smallest = Math.min(...values);
  return (Math.max(...values) - smallest) / smallest;
}

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

describe('#144 AC2: stopy leží na oblouku cesty v kartě, rovnoměrně a s ničím se nepřekrývají', () => {
  it('v kartě jsou všechna okna mapy a všech 5 map a každá mapa má stopy', () => {
    expect(footprintCases().length).toBe(MAP_WINDOWS.length * 5);
    for (const testCase of footprintCases()) {
      expect(testCase.footprints.prints.length, testCase.label).toBeGreaterThan(0);
    }
  });

  it('střed každé stopy je od oblouku cesty nejvýš 15 % průměru značky', () => {
    for (const testCase of footprintCases()) {
      const limit = testCase.layout.markerSize * MAX_OFF_ARC_SHARE + tolerance(testCase);
      for (const each of printsOnArc(testCase.layout, testCase.footprints)) {
        expect(
          each.offArc,
          `${printLabel(testCase, each)}: od oblouku ${percent(each.offArc / testCase.layout.markerSize)} značky`,
        ).toBeLessThanOrEqual(limit);
      }
    }
  });

  it('celá stopa leží v pruhu cesty širokém jako značka', () => {
    for (const testCase of footprintCases()) {
      const dense = denseArcOf(testCase.layout);
      const halfBand = drawnMarkerSize(testCase.layout) / 2 + tolerance(testCase);
      for (const each of printsOnArc(testCase.layout, testCase.footprints)) {
        for (const corner of printCorners(each.print)) {
          expect(
            projectOntoArc(dense, corner).distance,
            `${printLabel(testCase, each)}: roh ${describePoint(corner)} mimo pruh cesty`,
          ).toBeLessThanOrEqual(halfBand);
        }
      }
    }
  });

  it('delší strana stopy měří 15 až 30 % průměru značky, na iPadu aspoň 18 %', () => {
    for (const testCase of footprintCases()) {
      const roomy = ROOMY_WINDOW_NAMES.has(testCase.window.name);
      const minShare = roomy ? MIN_PRINT_SHARE : MIN_TIGHT_PRINT_SHARE;
      const { markerSize } = testCase.layout;
      const slack = tolerance(testCase);
      for (const each of printsOnArc(testCase.layout, testCase.footprints)) {
        const side = longerSide(each.print);
        const where = `${printLabel(testCase, each)}: delší strana ${percent(side / markerSize)} značky`;
        expect(side, where).toBeGreaterThanOrEqual(markerSize * minShare - slack);
        expect(side, where).toBeLessThanOrEqual(markerSize * MAX_PRINT_SHARE + slack);
      }
    }
  });

  it('každý úsek cesty má aspoň 3 stopy', () => {
    for (const testCase of footprintCases()) {
      const prints = printsOnArc(testCase.layout, testCase.footprints);
      for (let segment = 0; segment < SEGMENT_COUNT; segment += 1) {
        const count = prints.filter((each) => each.segment === segment).length;
        expect(count, `${testCase.label}, ${segmentName(segment)}`).toBeGreaterThanOrEqual(
          MIN_PRINTS_PER_SEGMENT,
        );
      }
    }
  });

  it('rozestupy stop po délce oblouku se na jednom úseku liší nejvýš o 10 %', () => {
    for (const testCase of footprintCases()) {
      const bySegment = spacingsBySegment(printsOnArc(testCase.layout, testCase.footprints));
      bySegment.forEach((spacings, segment) => {
        expect(
          spread(spacings),
          `${testCase.label}, ${segmentName(segment)}: rozestupy ${spacings.map((value) => value.toFixed(1)).join(', ')}`,
        ).toBeLessThanOrEqual(MAX_SPACING_SPREAD_IN_SEGMENT + 1e-6);
      });
    }
  });

  it('průměrné rozestupy stop se mezi úseky téže mapy liší nejvýš o 15 %', () => {
    for (const testCase of footprintCases()) {
      const means = spacingsBySegment(printsOnArc(testCase.layout, testCase.footprints))
        .filter((spacings) => spacings.length > 0)
        .map(mean);
      expect(means.length, testCase.label).toBe(SEGMENT_COUNT);
      expect(
        spread(means),
        `${testCase.label}: průměrné rozestupy úseků ${means.map((value) => value.toFixed(1)).join(', ')}`,
      ).toBeLessThanOrEqual(MAX_SPACING_SPREAD_BETWEEN_SEGMENTS + 1e-6);
    }
  });

  it('žádná stopa nepřekrývá start, zastávky ani cíl', () => {
    for (const testCase of footprintCases()) {
      const { layout } = testCase;
      for (const each of printsOnArc(layout, testCase.footprints)) {
        layout.places.forEach((place, step) => {
          expect(
            printCircleOverlap(each.print, place, drawnPlaceSize(layout, step) / 2),
            `${printLabel(testCase, each)} překrývá ${placeName(step)}`,
          ).toBeLessThanOrEqual(tolerance(testCase));
        });
      }
    }
  });

  it('žádná stopa nepřekrývá značku stojící na kterémkoli místě 0 až 3', () => {
    for (const testCase of footprintCases()) {
      const { layout } = testCase;
      const radius = drawnMarkerSize(layout) / 2;
      for (const each of printsOnArc(layout, testCase.footprints)) {
        for (let step = 0; step <= MAP_STEPS; step += 1) {
          const place = layout.places[step] ?? { x: Infinity, y: Infinity };
          expect(
            printCircleOverlap(each.print, place, radius),
            `${printLabel(testCase, each)} překrývá značku na místě ${placeName(step)}`,
          ).toBeLessThanOrEqual(tolerance(testCase));
        }
      }
    }
  });

  it('žádná stopa nepřekrývá symbol cíle ani slavící cíl se září (#135 AC3)', () => {
    for (const testCase of footprintCases()) {
      const { goalSymbol, goalCelebration } = testCase.layout;
      for (const each of printsOnArc(testCase.layout, testCase.footprints)) {
        for (const [name, circle] of [
          ['symbol cíle', goalSymbol],
          ['slavící cíl', goalCelebration],
        ] as const) {
          expect(
            printCircleOverlap(each.print, circle, circle.size / 2),
            `${printLabel(testCase, each)} překrývá ${name}`,
          ).toBeLessThanOrEqual(tolerance(testCase));
        }
      }
    }
  });

  it('žádná stopa nepřekrývá místo klíče u cíle (#139 AC2)', () => {
    for (const testCase of footprintCases()) {
      const key = testCase.layout.goalKey;
      const keyEdges = {
        left: key.x - key.width / 2,
        right: key.x + key.width / 2,
        top: key.y - key.height / 2,
        bottom: key.y + key.height / 2,
      };
      for (const each of printsOnArc(testCase.layout, testCase.footprints)) {
        expect(
          printBoxOverlap(each.print, keyEdges),
          `${printLabel(testCase, each)} překrývá štítek klíče`,
        ).toBeLessThanOrEqual(tolerance(testCase));
      }
    }
  });

  it('žádná stopa nepřekrývá plochu, kterou projde kousek prostředí, ani jeho pruh (#136 AC2)', () => {
    for (const testCase of footprintCases()) {
      const scenery = layoutMapScenery(testCase.area, testCase.theme, testCase.layout);
      expect(scenery.pieces.length, testCase.label).toBeGreaterThan(0);
      for (const each of printsOnArc(testCase.layout, testCase.footprints)) {
        scenery.pieces.forEach((piece, index) => {
          const name = `${piece.kind} ${index + 1}`;
          const areas = piece.lane ? [piece.sweep, piece.lane] : [piece.sweep];
          for (const area of areas) {
            expect(
              printBoxOverlap(each.print, area),
              `${printLabel(testCase, each)} překrývá plochu ${name}`,
            ).toBeLessThanOrEqual(tolerance(testCase));
          }
        });
      }
    }
  });

  it('žádná stopa nevyčnívá z plochy mapy v kartě', () => {
    for (const testCase of footprintCases()) {
      const card = cardBox(testCase.card);
      const { scale, offsetX, offsetY } = testCase.area;
      for (const each of printsOnArc(testCase.layout, testCase.footprints)) {
        for (const corner of printCorners(each.print)) {
          const css = { x: offsetX + corner.x * scale, y: offsetY + corner.y * scale };
          const where = `${printLabel(testCase, each)}: roh ${describePoint(css)} mimo kartu`;
          expect(css.x, where).toBeGreaterThanOrEqual(card.left - TOLERANCE_CSS);
          expect(css.x, where).toBeLessThanOrEqual(card.right + TOLERANCE_CSS);
          expect(css.y, where).toBeGreaterThanOrEqual(card.top - TOLERANCE_CSS);
          expect(css.y, where).toBeLessThanOrEqual(card.bottom + TOLERANCE_CSS);
        }
      }
    }
  });

  it('při stejném okně a mapě jsou stopy pokaždé na stejných místech', () => {
    for (const testCase of footprintCases()) {
      const again = layoutMapFootprints(
        testCase.area,
        testCase.theme,
        layoutProgressMap(testCase.area, testCase.theme),
      );
      expect(again, testCase.label).toEqual(testCase.footprints);
      expect(layoutMapFootprints(testCase.area, testCase.theme), testCase.label).toEqual(
        testCase.footprints,
      );
    }
  });
});
