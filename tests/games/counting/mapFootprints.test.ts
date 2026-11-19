import { describe, expect, it } from 'vitest';

import {
  MARKER_START_MS,
  MARKER_WALK_MS,
  markerPointAt,
  markerTrailAt,
} from '../../../src/games/counting/logic/mapAnimation';
import {
  MAP_FOOTPRINT_KINDS,
  footprintMomentAt,
  layoutMapFootprints,
} from '../../../src/games/counting/logic/mapFootprints';
import type { FootprintKind, MapFootprint } from '../../../src/games/counting/logic/mapFootprints';
import { MAP_THEMES, mapShowMs } from '../../../src/games/counting/logic/progressMap';
import type { MapMove, MapThemeId } from '../../../src/games/counting/logic/progressMap';
import { layoutProgressMap } from '../../../src/games/counting/logic/progressMapLayout';
import type { ProgressMapLayout } from '../../../src/games/counting/logic/progressMapLayout';
import type { TestWindow } from '../../shared/viewportFixtures';
import { allMoves, sampleTimes } from './mapAnimationHelpers';
import type { MoveCase } from './mapAnimationHelpers';
import { cardWindowCase } from './mapCardScenes';
import { footprintCases, printsOnArc, turnDegrees } from './mapFootprintHelpers';
import type { FootprintCase, PrintOnArc } from './mapFootprintHelpers';
import {
  MAP_WINDOWS,
  SEGMENT_COUNT,
  arcShareOfStep,
  denseArcOf,
  projectOntoArc,
  segmentName,
} from './mapPathHelpers';

/**
 * Testy k #144 AC1, AC4 a AC5 (upravené podle #146 AC7 a #154): cesta na
 * každé z 5 map vede ze stop podle tématu po oblouku (#146), stopy se
 * rozsvěcují, jak k nim značka dojde (měřeno po oblouku), krátce
 * poskočí a nahrazují zlatou čáru za značkou; jiskřičky zůstávají. Po
 * otočení zařízení svítí stopy po stejný díl cesty.
 *
 * Mapa je v kartě (#145), měří se ve všech oknech mapy z #133 AC7 a na
 * 5 mapách. Časy se měří od vyražení značky (`MARKER_START_MS`, #154):
 * poskok skončí nejpozději 1,5 s od vyražení.
 *
 * Každé pravidlo má jeden test, který v cyklu projde všechny případy;
 * popis případu je ve zprávě `expect`. Navržené rozhraní je
 * v `mapFootprintHelpers.ts`.
 *
 * Ručně se kontroluje: výška poskoku (AC4), že nevznikl žádný nový text
 * (AC1, hlídá i `npm run test:whole`), 60 fps ve WebKitu (AC6).
 */

/** Druh stop každé mapy (AC1). */
const EXPECTED_KINDS: Readonly<Record<MapThemeId, FootprintKind>> = {
  forest: 'paw',
  island: 'bareFoot',
  castle: 'boot',
  underwater: 'bubble',
  space: 'star',
};

/** Stopy natočené po směru oblouku (tlapky, šlápoty, boty). */
const ORIENTED_KINDS: ReadonlySet<FootprintKind> = new Set<FootprintKind>([
  'paw',
  'bareFoot',
  'boot',
]);

/** Největší odchylka natočení stopy od směru oblouku (AC1). */
const MAX_TILT_DEGREES = 10;

/** Jak dlouho nejvýš trvá poskok stopy (AC4). */
const MAX_HOP_MS = 250;

/** Nejpozději po kolika ms od vyražení značky poskoky skončí (AC4). */
const HOPS_DONE_AFTER_START_MS = 1500;

/** Tolerance ušlé délky jako díl průměru značky (zaokrouhlení hustého oblouku). */
const ALONG_TOLERANCE_SHARE = 0.005;

/** Tolerance dílu úseku po otočení. */
const SHARE_TOLERANCE = 0.005;

/** Každé okno × 5 map × každý krok, mapa v kartě se stopami. */
interface PrintMoveCase extends MoveCase {
  readonly testCase: FootprintCase;
  readonly prints: readonly PrintOnArc[];
}

let cachedMoveCases: PrintMoveCase[] | undefined;

function printMoveCases(): PrintMoveCase[] {
  cachedMoveCases ??= footprintCases().flatMap((testCase) => {
    const prints = printsOnArc(testCase.layout, testCase.footprints);
    return allMoves()
      .filter(({ move }) => move.theme === testCase.theme)
      .map(({ label, move }) => ({
        label: `${testCase.window.name}, karta, ${label}`,
        move,
        testCase,
        prints,
      }));
  });
  return cachedMoveCases;
}

/** Časy po 10 ms od ukázání mapy do chvíle, kdy poskoky musejí skončit, a kousek dál. */
function walkTimes(): number[] {
  return sampleTimes(MARKER_START_MS + HOPS_DONE_AFTER_START_MS + 200);
}

/** Ušlá délka značky od startu po oblouku v čase `ms`. */
function markerAlong(layout: ProgressMapLayout, move: MapMove, ms: number): number {
  return projectOntoArc(denseArcOf(layout), markerPointAt(layout, move, ms)).along;
}

function printLabel(each: PrintOnArc): string {
  return `stopa ${each.order + 1} (${segmentName(each.segment)})`;
}

function isLit(layout: ProgressMapLayout, move: MapMove, print: MapFootprint, ms: number): boolean {
  return footprintMomentAt(layout, move, print, ms).lit;
}

describe('#144 AC1: cesta na každé mapě vede ze stop podle tématu', () => {
  it('každá mapa má svůj druh stop: les tlapky, ostrov šlápoty, hrad boty, podmoří bublinky, vesmír hvězdičky', () => {
    for (const theme of MAP_THEMES) {
      expect(MAP_FOOTPRINT_KINDS[theme], theme).toBe(EXPECTED_KINDS[theme]);
    }
    for (const testCase of footprintCases()) {
      expect(testCase.footprints.kind, testCase.label).toBe(EXPECTED_KINDS[testCase.theme]);
    }
  });

  it('dvě mapy nikdy nemají stejný druh stop', () => {
    const kinds = MAP_THEMES.map((theme) => MAP_FOOTPRINT_KINDS[theme]);
    expect(new Set(kinds).size).toBe(MAP_THEMES.length);
  });

  it('stopy vedou celou cestou od startu do cíle: na každém úseku nějaké', () => {
    for (const testCase of footprintCases()) {
      const prints = printsOnArc(testCase.layout, testCase.footprints);
      for (let segment = 0; segment < SEGMENT_COUNT; segment += 1) {
        expect(
          prints.some((each) => each.segment === segment),
          `${testCase.label}, ${segmentName(segment)}`,
        ).toBe(true);
      }
    }
  });

  it('tlapky, šlápoty a boty míří po směru oblouku s odchylkou nejvýš 10°', () => {
    for (const testCase of footprintCases()) {
      if (!ORIENTED_KINDS.has(testCase.footprints.kind)) {
        continue;
      }
      for (const each of printsOnArc(testCase.layout, testCase.footprints)) {
        const tilt = turnDegrees(each.print.angle, each.arcDegrees);
        expect(
          tilt,
          `${testCase.label}, ${printLabel(each)}: natočení ${each.print.angle.toFixed(1)}°, oblouk ${each.arcDegrees.toFixed(1)}°`,
        ).toBeLessThanOrEqual(MAX_TILT_DEGREES);
      }
    }
  });

  it('bublinky a hvězdičky leží bez natočení', () => {
    for (const testCase of footprintCases()) {
      if (ORIENTED_KINDS.has(testCase.footprints.kind)) {
        continue;
      }
      testCase.footprints.prints.forEach((print, index) => {
        expect(print.angle, `${testCase.label}, stopa ${index + 1}`).toBe(0);
      });
    }
  });

  it('sousední stopy na úseku se střídají na levé a pravé straně cesty', () => {
    for (const testCase of footprintCases()) {
      const prints = printsOnArc(testCase.layout, testCase.footprints);
      for (let segment = 0; segment < SEGMENT_COUNT; segment += 1) {
        const onSegment = prints.filter((each) => each.segment === segment);
        onSegment.forEach((each, index) => {
          const where = `${testCase.label}, ${printLabel(each)}`;
          expect(each.side, `${where}: leží přímo na oblouku`).not.toBe(0);
          const before = onSegment[index - 1];
          if (before) {
            expect(each.side, `${where}: stejná strana jako předchozí stopa`).toBe(-before.side);
          }
        });
      }
    }
  });
});

describe('#144 AC4: stopy se rozsvěcují, jak k nim značka po oblouku dojde', () => {
  it('stopa svítí, právě když značka měřeno po oblouku došla k jejímu středu, nikdy dřív', () => {
    for (const { label, move, testCase, prints } of printMoveCases()) {
      const { layout } = testCase;
      const tolerance = layout.markerSize * ALONG_TOLERANCE_SHARE;
      for (const ms of walkTimes()) {
        const marker = markerAlong(layout, move, ms);
        for (const each of prints) {
          const where = `${label}, ${ms} ms, ${printLabel(each)}`;
          const lit = isLit(layout, move, each.print, ms);
          if (marker < each.along - tolerance) {
            expect(lit, `${where}: svítí dřív, než k ní značka došla`).toBe(false);
          }
          if (marker > each.along + tolerance) {
            expect(lit, `${where}: značka ji minula a nesvítí`).toBe(true);
          }
        }
      }
    }
  });

  it('když značka stojí, svítí všechny stopy až k ní a žádná za ní', () => {
    for (const { label, move, testCase, prints } of printMoveCases()) {
      const { layout } = testCase;
      const { placeAlong } = denseArcOf(layout);
      const standing: Array<[number, number]> = [
        [0, placeAlong[move.from] ?? 0],
        [MARKER_START_MS, placeAlong[move.from] ?? 0],
        [MARKER_START_MS + MARKER_WALK_MS, placeAlong[move.to] ?? 0],
        [mapShowMs(move), placeAlong[move.to] ?? 0],
      ];
      for (const [ms, reached] of standing) {
        for (const each of prints) {
          expect(
            isLit(layout, move, each.print, ms),
            `${label}, ${ms} ms, ${printLabel(each)}`,
          ).toBe(each.along <= reached);
        }
      }
    }
  });

  it('na nové mapě po cíli jsou všechny stopy neprošlé, než značka vyrazí', () => {
    const fromStart = printMoveCases().filter(({ move }) => move.from === 0);
    expect(fromStart.length).toBeGreaterThan(0);
    for (const { label, move, testCase, prints } of fromStart) {
      for (const ms of [0, MARKER_START_MS]) {
        for (const each of prints) {
          expect(
            isLit(testCase.layout, move, each.print, ms),
            `${label}, ${ms} ms, ${printLabel(each)}`,
          ).toBe(false);
        }
      }
    }
  });

  it('stopa při rozsvícení poskočí nejvýš na 250 ms a stopa, která svítila už předtím, neposkočí', () => {
    for (const { label, move, testCase, prints } of printMoveCases()) {
      const { layout } = testCase;
      const times = walkTimes();
      for (const each of prints) {
        const moments = times.map((ms) => footprintMomentAt(layout, move, each.print, ms));
        const litIndex = moments.findIndex((moment) => moment.lit);
        const lightsUp = litIndex > 0;
        const litMs = lightsUp ? (times[litIndex] ?? 0) : Number.NaN;
        const where = `${label}, ${printLabel(each)}`;
        moments.forEach((moment, index) => {
          const ms = times[index] ?? 0;
          if (moment.hop === 0) {
            return;
          }
          expect(lightsUp, `${where}: poskočí v ${ms} ms, i když se nerozsvítila`).toBe(true);
          expect(
            ms,
            `${where}: poskočí dřív, než se rozsvítí v ${litMs} ms`,
          ).toBeGreaterThanOrEqual(litMs);
          expect(ms, `${where}: poskok rozsvícené v ${litMs} ms trvá dlouho`).toBeLessThanOrEqual(
            litMs + MAX_HOP_MS,
          );
        });
        if (lightsUp) {
          const hopped = moments.some(
            (moment, index) => moment.hop > 0 && (times[index] ?? 0) <= litMs + MAX_HOP_MS,
          );
          expect(hopped, `${where}: rozsvítí se v ${litMs} ms a neposkočí`).toBe(true);
        }
      }
    }
  });

  it('všechny poskoky skončí nejpozději 1,5 s od vyražení značky', () => {
    const latest = MARKER_START_MS + HOPS_DONE_AFTER_START_MS;
    for (const { label, move, testCase, prints } of printMoveCases()) {
      for (const ms of sampleTimes(mapShowMs(move), latest)) {
        for (const each of prints) {
          expect(
            footprintMomentAt(testCase.layout, move, each.print, ms).hop,
            `${label}, ${ms} ms, ${printLabel(each)}`,
          ).toBe(0);
        }
      }
    }
  });

  it('za jdoucí značkou už není zlatá čára, jiskřičky zůstávají', () => {
    for (const { label, move, testCase } of printMoveCases()) {
      let sparkles = 0;
      for (let ms = MARKER_START_MS + 1; ms < MARKER_START_MS + MARKER_WALK_MS; ms += 30) {
        const trail = markerTrailAt(testCase.layout, move, ms);
        expect(trail?.points ?? [], `${label}, ${ms} ms: zlatá čára`).toEqual([]);
        sparkles += trail?.sparkles.length ?? 0;
      }
      expect(sparkles, `${label}: jiskřičky během chůze`).toBeGreaterThan(0);
    }
  });
});

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

/** Okamžiky otočení: před vyražením, během chůze a po dojití (ms od ukázání mapy). */
const ROTATION_TIMES_MS = [
  0,
  MARKER_START_MS,
  MARKER_START_MS + 150,
  MARKER_START_MS + 300,
  MARKER_START_MS + 450,
  MARKER_START_MS + 600,
  MARKER_START_MS + 750,
  MARKER_START_MS + 900,
  MARKER_START_MS + 1200,
];

describe('#144 AC5: po otočení a při přerušení svítí stopy správně', () => {
  it('po otočení svítí stopy po stejný díl cesty jako před otočením', () => {
    const pairs = rotatedPairs();
    expect(pairs.length).toBeGreaterThan(0);
    for (const [before, after] of pairs) {
      const areaBefore = cardWindowCase(before).card.area;
      const areaAfter = cardWindowCase(after).card.area;
      for (const { label, move } of allMoves()) {
        const layoutBefore = layoutProgressMap(areaBefore, move.theme);
        const layoutAfter = layoutProgressMap(areaAfter, move.theme);
        const prints = printsOnArc(
          layoutAfter,
          layoutMapFootprints(areaAfter, move.theme, layoutAfter),
        );
        const { placeAlong } = denseArcOf(layoutAfter);
        for (const ms of ROTATION_TIMES_MS) {
          const walked = arcShareOfStep(
            layoutBefore,
            move.from,
            move.to,
            markerPointAt(layoutBefore, move, ms),
          );
          for (const each of prints) {
            const start = placeAlong[each.segment] ?? 0;
            const end = placeAlong[each.segment + 1] ?? start;
            const share = (each.along - start) / (end - start);
            const where = `${before.name} → ${after.name}, ${label}, otočení v ${ms} ms, ${printLabel(each)} v ${(share * 100).toFixed(1)} % úseku, značka ${(walked * 100).toFixed(1)} %`;
            const lit = isLit(layoutAfter, move, each.print, ms);
            if (each.segment < move.from) {
              expect(lit, where).toBe(true);
            } else if (each.segment > move.from) {
              expect(lit, where).toBe(false);
            } else if (share < walked - SHARE_TOLERANCE) {
              expect(lit, where).toBe(true);
            } else if (share > walked + SHARE_TOLERANCE) {
              expect(lit, where).toBe(false);
            }
          }
        }
      }
    }
  });

  it('přerušení mapy v jakémkoli okamžiku proběhne bez chyby: každá stopa má platný stav', () => {
    const odd = [-1000, -1, 0, MARKER_START_MS + 1, MARKER_START_MS + 450, 1e9];
    for (const { label, move, testCase } of printMoveCases()) {
      for (const print of testCase.footprints.prints) {
        for (const ms of odd) {
          const where = `${label}, ${ms} ms`;
          expect(() => footprintMomentAt(testCase.layout, move, print, ms), where).not.toThrow();
          const moment = footprintMomentAt(testCase.layout, move, print, ms);
          expect(typeof moment.lit, where).toBe('boolean');
          expect(Number.isFinite(moment.hop) && moment.hop >= 0, where).toBe(true);
        }
      }
    }
  });
});
