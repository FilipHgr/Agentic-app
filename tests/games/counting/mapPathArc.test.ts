import { describe, expect, it } from 'vitest';

import {
  MARKER_START_MS,
  MARKER_WALK_MS,
  markerPointAt,
  markerShareAt,
  markerTrailAt,
} from '../../../src/shared/logic/mapAnimation';
import { mapCardPictureCover } from '../../../src/shared/logic/progressMapCard';
import { mapShowMs } from '../../../src/shared/logic/progressMap';
import type { MapMove } from '../../../src/shared/logic/progressMap';
import {
  layoutProgressMap,
  pathBandFits,
  pathLinePoints,
  pathPointAt,
} from '../../../src/shared/logic/progressMapLayout';
import type { MapPoint, ProgressMapLayout } from '../../../src/shared/logic/progressMapLayout';
import { PROGRESS_MAP_BACKGROUNDS, progressMapStyleFor } from '../../../src/shared/logic/mapTheme';
import { contrastRatio } from '../../../src/shared/logic/theme';
import { IPAD_WINDOWS } from '../../shared/viewportFixtures';
import type { TestWindow } from '../../shared/viewportFixtures';
import { HOME_SCREEN_WINDOWS } from '../../shared/layoutRules';
import { allMoves, sampleTimes } from './mapAnimationHelpers';
import type { MoveCase } from './mapAnimationHelpers';
import { cardWindowCase } from './mapCardScenes';
import { pictureFileName } from './mapPictureHelpers';
import { PICTURE_TONES, TONE_GRID } from './mapPictureTones';
import {
  MAP_WINDOWS,
  SEGMENT_COUNT,
  SMOOTHNESS_SAMPLES,
  arcCases,
  arcSamples,
  arcShareOfStep,
  denseArcOf,
  distance,
  distanceToPolyline,
  polylineCheckPoints,
  polylineLength,
  projectOntoArc,
  segmentName,
  segmentsCross,
  signedOffset,
} from './mapPathHelpers';
import type { ArcCase } from './mapPathHelpers';

/**
 * Testy k #146 AC1, AC3, AC4 a AC5: cesta na mapě postupu vede mezi
 * sousedními místy plynulými oblouky, které se střídavě prohýbají na
 * opačné strany, a značka, zlatá stopa a jiskřičky jdou po oblouku.
 * Zlatou stopu od #144 AC4 nahradily stopy na cestě (`mapFootprints*.test.ts`),
 * dva testy k ní jsou proto nahrazené (viz komentáře u nich).
 * Mapa je od #145 v kartě, proto se všechno měří v kartě ve všech oknech
 * mapy z #133 AC7 (`MAP_WINDOWS`) a na 5 mapách. Každé pravidlo má jeden
 * test, který projde všechny případy v cyklu; popis případu je ve zprávě
 * `expect`. Navržené rozhraní je v `mapPathHelpers.ts`.
 *
 * Časy (AC3): od #154 značka vyrazí až po doletu hvězdiček, v
 * `MARKER_START_MS` od ukázání mapy, a jde `MARKER_WALK_MS` (900 ms)
 * s rozjezdem a zpomalením (`markerShareAt`). „300 ms stání“ z #135 je
 * dnes stání do `MARKER_START_MS`; „čas 0“ a „1,5 s“ z AC3 se proto měří
 * od vyražení značky (`MARKER_START_MS`).
 *
 * Ručně se kontroluje (AC6): plynulost pohybu po oblouku a 60 fps ve
 * WebKitu na iPadu a iPhonu.
 */

/** Plynulost: největší změna směru mezi sousedními dílky po 1 % délky (AC1). */
const MAX_TURN_DEGREES = 6;

/** Prohnutí: největší vzdálenost oblouku od úsečky jako díl délky úsečky (AC1, AC2). */
const MIN_BEND_SHARE = 0.12;
const MAX_BEND_SHARE = 0.25;
const MIN_TIGHT_BEND_SHARE = 0.06;

/** Značka je od oblouku nejvýš 1 % svého průměru (AC3). */
const MARKER_OFF_ARC_SHARE = 0.01;

/** Díl ušlé délky oblouku se od dnešního průběhu chůze liší nejvýš o 1 procentní bod (AC3). */
const MAX_SHARE_DIFFERENCE = 0.01;

/** Nejpozději po kolika ms od vyražení stojí značka na novém místě (AC3). */
const LATEST_ARRIVAL_AFTER_START_MS = 1500;

/** Čára cesty a zlatá stopa jsou od oblouku nejvýš 1 CSS px (AC5). */
const MAX_LINE_OFF_ARC_CSS = 1;

/** Jak daleko za značkou nejvýš leží jiskřičky, v průměrech značky (délka zlaté stopy z #135). */
const SPARKLE_REACH_TO_MARKER = 3.2;

/** Body, ve kterých se měří kontrast cesty (AC5). */
const CONTRAST_SHARES = [0.25, 0.5, 0.75];
const MIN_CONTRAST = 3;

/** Tolerance na zaokrouhlení v herních jednotkách. */
const TOLERANCE = 0.01;

/** Okna iPadu, kde je místa dost a prohnutí nesmí klesnout pod 12 %. */
const ROOMY_WINDOWS: readonly TestWindow[] = [
  ...IPAD_WINDOWS,
  ...HOME_SCREEN_WINDOWS.filter((window) => window.name.startsWith('iPad')),
];

/** Směr dílku `a` → `b` ve stupních. */
function directionDegrees(a: MapPoint, b: MapPoint): number {
  return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
}

/** Rozdíl dvou směrů ve stupních (0 až 180). */
function turnDegrees(first: number, second: number): number {
  const raw = Math.abs(first - second) % 360;
  return raw > 180 ? 360 - raw : raw;
}

/** Úsečka úseku: minulé a další místo. */
function chordOf(layout: ProgressMapLayout, segment: number): [MapPoint, MapPoint] {
  const from = layout.places[segment] ?? { x: 0, y: 0 };
  const to = layout.places[segment + 1] ?? from;
  return [from, to];
}

/** Prohnutí úseku: největší vzdálenost oblouku od úsečky, se znaménkem strany, jako díl délky. */
function bendOf(layout: ProgressMapLayout, segment: number): number {
  const [from, to] = chordOf(layout, segment);
  const chord = distance(from, to);
  let bend = 0;
  for (const point of arcSamples(layout, segment, 1000)) {
    const offset = signedOffset(from, to, point);
    if (Math.abs(offset) > Math.abs(bend)) {
      bend = offset;
    }
  }
  return bend / chord;
}

function percent(value: number): string {
  return `${(value * 100).toFixed(1)} %`;
}

/** Každé okno × 5 map × každý krok, mapa v kartě. */
interface ArcMoveCase extends MoveCase {
  readonly arc: ArcCase;
}

let cachedMoveCases: ArcMoveCase[] | undefined;

function arcMoveCases(): ArcMoveCase[] {
  cachedMoveCases ??= arcCases().flatMap((arc) =>
    allMoves()
      .filter(({ move }) => move.theme === arc.theme)
      .map(({ label, move }) => ({ label: `${arc.window.name}, karta, ${label}`, move, arc })),
  );
  return cachedMoveCases;
}

/** Dnešní průběh chůze (#135, posunutý podle #154): stání, pak 900 ms s rozjezdem a zpomalením. */
function todayWalkShare(elapsedMs: number): number {
  const progress = Math.min(Math.max((elapsedMs - MARKER_START_MS) / MARKER_WALK_MS, 0), 1);
  return (1 - Math.cos(Math.PI * progress)) / 2;
}

function walkTimes(move: MapMove): number[] {
  return sampleTimes(mapShowMs(move));
}

/** Po kolika ms se kontrolují jiskřičky za značkou (dřív zlatá stopa, řidčeji než značka). */
const TRAIL_SAMPLE_MS = 30;

/** Okamžiky během chůze značky, kdy jsou vidět jiskřičky (dřív i zlatá stopa). */
function trailTimes(): number[] {
  const times: number[] = [];
  for (let ms = MARKER_START_MS + 1; ms < MARKER_START_MS + MARKER_WALK_MS; ms += TRAIL_SAMPLE_MS) {
    times.push(ms);
  }
  return times;
}

describe('#146 AC1: každý úsek cesty mezi sousedními místy vede plynulým obloukem', () => {
  it('oblouk úseku začíná na minulém místě a končí na dalším, na každé mapě a v každém okně', () => {
    expect(arcCases().length).toBe(MAP_WINDOWS.length * 5);
    for (const { label, layout } of arcCases()) {
      for (let segment = 0; segment < SEGMENT_COUNT; segment += 1) {
        const [from, to] = chordOf(layout, segment);
        const where = `${label}, ${segmentName(segment)}`;
        expect(distance(pathPointAt(layout, segment, 0), from), `${where}, začátek`).toBeLessThan(
          TOLERANCE,
        );
        expect(distance(pathPointAt(layout, segment, 1), to), `${where}, konec`).toBeLessThan(
          TOLERANCE,
        );
      }
    }
  });

  it('díl oblouku se měří po jeho délce: bod v půlce dílu leží v půlce délky oblouku', () => {
    for (const { label, layout } of arcCases()) {
      for (let segment = 0; segment < SEGMENT_COUNT; segment += 1) {
        const whole = polylineLength(arcSamples(layout, segment, 1000));
        for (const share of [0.1, 0.25, 0.5, 0.75, 0.9]) {
          const part = polylineLength(
            arcSamples(layout, segment, 1000).filter((_, index) => index <= share * 1000),
          );
          expect(
            Math.abs(part / whole - share),
            `${label}, ${segmentName(segment)}, díl ${share}`,
          ).toBeLessThanOrEqual(0.002);
        }
      }
    }
  });

  it('mezi sousedními body po 1 % délky úseku se směr oblouku mění nejvýš o 6°', () => {
    for (const { label, layout } of arcCases()) {
      for (let segment = 0; segment < SEGMENT_COUNT; segment += 1) {
        const points = arcSamples(layout, segment, SMOOTHNESS_SAMPLES);
        const directions = points
          .slice(1)
          .map((point, index) => directionDegrees(points[index] ?? point, point));
        directions.slice(1).forEach((direction, index) => {
          const turn = turnDegrees(directions[index] ?? direction, direction);
          expect(
            turn,
            `${label}, ${segmentName(segment)}, mezi ${index + 1} a ${index + 2} %`,
          ).toBeLessThanOrEqual(MAX_TURN_DEGREES);
        });
      }
    }
  });

  it('prohnutí úseku je nikde nad 25 % a nikde pod 6 % délky úsečky (6 % jen v těsném okně)', () => {
    for (const { label, layout } of arcCases()) {
      for (let segment = 0; segment < SEGMENT_COUNT; segment += 1) {
        const bend = Math.abs(bendOf(layout, segment));
        const where = `${label}, ${segmentName(segment)}: prohnutí ${percent(bend)}`;
        expect(bend, where).toBeGreaterThanOrEqual(MIN_TIGHT_BEND_SHARE);
        expect(bend, where).toBeLessThanOrEqual(MAX_BEND_SHARE + 1e-6);
      }
    }
  });

  it('na iPadu, kde je místa dost, je prohnutí každého úseku 12–25 % délky úsečky', () => {
    const roomy = arcCases().filter(({ window }) => ROOMY_WINDOWS.includes(window));
    expect(roomy.length).toBeGreaterThan(0);
    for (const { label, layout } of roomy) {
      for (let segment = 0; segment < SEGMENT_COUNT; segment += 1) {
        const bend = Math.abs(bendOf(layout, segment));
        const where = `${label}, ${segmentName(segment)}: prohnutí ${percent(bend)}`;
        expect(bend, where).toBeGreaterThanOrEqual(MIN_BEND_SHARE - 1e-6);
        expect(bend, where).toBeLessThanOrEqual(MAX_BEND_SHARE + 1e-6);
      }
    }
  });

  // Upřesnění 2: mimo iPad smí prohnutí klesnout pod 12 % jen tam, kde se pruh s 12 % nevejde.
  it('mimo iPad je prohnutí aspoň 12 %, kde se pruh cesty s 12 % vejde', () => {
    const others = arcCases().filter(({ window }) => !ROOMY_WINDOWS.includes(window));
    expect(others.length).toBeGreaterThan(0);
    for (const { label, area, layout } of others) {
      const roomFor12 = [1, -1].some((firstSide) =>
        pathBandFits(
          area,
          layout,
          Array.from({ length: SEGMENT_COUNT }, (_, segment) =>
            segment % 2 === 0 ? MIN_BEND_SHARE * firstSide : -MIN_BEND_SHARE * firstSide,
          ),
        ),
      );
      if (!roomFor12) {
        continue;
      }
      for (let segment = 0; segment < SEGMENT_COUNT; segment += 1) {
        const bend = Math.abs(bendOf(layout, segment));
        expect(
          bend,
          `${label}, ${segmentName(segment)}: prohnutí ${percent(bend)}, pruh s 12 % se vejde`,
        ).toBeGreaterThanOrEqual(MIN_BEND_SHARE - 1e-6);
      }
    }
  });

  it('sousední úseky se prohýbají na opačné strany', () => {
    for (const { label, layout } of arcCases()) {
      for (let segment = 1; segment < SEGMENT_COUNT; segment += 1) {
        const before = Math.sign(bendOf(layout, segment - 1));
        const after = Math.sign(bendOf(layout, segment));
        expect(
          before * after,
          `${label}, ${segmentName(segment - 1)} a ${segmentName(segment)}`,
        ).toBe(-1);
      }
    }
  });

  it('cesta z oblouků se nikde nekříží sama se sebou (#133 AC7)', () => {
    for (const { label, layout } of arcCases()) {
      const arcs = Array.from({ length: SEGMENT_COUNT }, (_, segment) =>
        arcSamples(layout, segment, SMOOTHNESS_SAMPLES),
      );
      const crossings: string[] = [];
      arcs.forEach((first, firstIndex) => {
        arcs.forEach((second, secondIndex) => {
          if (secondIndex < firstIndex) {
            return;
          }
          for (let a = 1; a < first.length; a += 1) {
            for (let b = 1; b < second.length; b += 1) {
              const same = firstIndex === secondIndex;
              // Dílky jednoho úseku vedle sebe a dílky u společného místa se jen dotýkají.
              if (same && Math.abs(a - b) <= 1) {
                continue;
              }
              if (secondIndex === firstIndex + 1 && a === first.length - 1 && b === 1) {
                continue;
              }
              const [p, q, r, s] = [first[a - 1], first[a], second[b - 1], second[b]];
              if (p && q && r && s && segmentsCross(p, q, r, s)) {
                crossings.push(`${segmentName(firstIndex)} kříží ${segmentName(secondIndex)}`);
              }
            }
          }
        });
      });
      expect([...new Set(crossings)], label).toEqual([]);
    }
  });

  it('oblouk vyjde pokaždé stejně: stejné okno a mapa dají stejný oblouk', () => {
    for (const { label, area, theme, layout } of arcCases()) {
      const again = layoutProgressMap(area, theme);
      for (let segment = 0; segment < SEGMENT_COUNT; segment += 1) {
        const first = arcSamples(layout, segment, 20);
        const second = arcSamples(again, segment, 20);
        expect(second, `${label}, ${segmentName(segment)}`).toEqual(first);
      }
    }
  });
});

describe('#146 AC3: značka jde po oblouku', () => {
  it('střed značky je v každém okamžiku od oblouku nejvýš 1 % jejího průměru', () => {
    for (const { label, move, arc } of arcMoveCases()) {
      const dense = denseArcOf(arc.layout);
      const limit = arc.layout.markerSize * MARKER_OFF_ARC_SHARE;
      for (const ms of walkTimes(move)) {
        const point = markerPointAt(arc.layout, move, ms);
        expect(projectOntoArc(dense, point).distance, `${label}, ${ms} ms`).toBeLessThanOrEqual(
          limit,
        );
      }
    }
  });

  it('vzdálenost značky od startu měřená po oblouku s časem nikdy neklesá', () => {
    for (const { label, move, arc } of arcMoveCases()) {
      const dense = denseArcOf(arc.layout);
      let before = Number.NEGATIVE_INFINITY;
      for (const ms of walkTimes(move)) {
        const walked = projectOntoArc(dense, markerPointAt(arc.layout, move, ms)).along;
        expect(walked, `${label}, ${ms} ms`).toBeGreaterThanOrEqual(before - TOLERANCE);
        before = walked;
      }
    }
  });

  it('až do vyražení stojí značka na minulém místě, u nové mapy na startu', () => {
    for (const { label, move, arc } of arcMoveCases()) {
      const previous = arc.layout.places[move.from] ?? { x: Infinity, y: Infinity };
      for (const ms of sampleTimes(MARKER_START_MS)) {
        expect(
          distance(markerPointAt(arc.layout, move, ms), previous),
          `${label}, ${ms} ms`,
        ).toBeLessThan(TOLERANCE);
      }
    }
  });

  it('nejpozději 1,5 s od vyražení stojí značka na novém místě a do zavření mapy se nehýbe', () => {
    for (const { label, move, arc } of arcMoveCases()) {
      const target = arc.layout.places[move.to] ?? { x: Infinity, y: Infinity };
      const latest = MARKER_START_MS + LATEST_ARRIVAL_AFTER_START_MS;
      for (const ms of sampleTimes(mapShowMs(move), latest)) {
        expect(
          distance(markerPointAt(arc.layout, move, ms), target),
          `${label}, ${ms} ms`,
        ).toBeLessThan(TOLERANCE);
      }
    }
  });

  it('díl ušlé délky oblouku se od dnešního průběhu chůze liší nejvýš o 1 procentní bod', () => {
    for (const { label, move, arc } of arcMoveCases()) {
      for (const ms of walkTimes(move)) {
        const point = markerPointAt(arc.layout, move, ms);
        const walked = arcShareOfStep(arc.layout, move.from, move.to, point);
        expect(
          Math.abs(walked - todayWalkShare(ms)),
          `${label}, ${ms} ms: ušlo ${percent(walked)}, má ${percent(todayWalkShare(ms))}`,
        ).toBeLessThanOrEqual(MAX_SHARE_DIFFERENCE + 1e-6);
      }
    }
  });

  it('průběh chůze zůstává dnešní: stání do vyražení, pak 900 ms s rozjezdem a zpomalením', () => {
    expect(MARKER_WALK_MS).toBe(900);
    for (const ms of sampleTimes(MARKER_START_MS + MARKER_WALK_MS + 500)) {
      expect(markerShareAt(ms), `${ms} ms`).toBeCloseTo(todayWalkShare(ms), 6);
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

/** Kdy značka poprvé stojí na novém místě (ms od ukázání), nebo `null`. */
function arrivalMsIn(layout: ProgressMapLayout, move: MapMove): number | null {
  const target = layout.places[move.to];
  if (!target) {
    return null;
  }
  const time = sampleTimes(mapShowMs(move)).find(
    (ms) => distance(markerPointAt(layout, move, ms), target) < TOLERANCE,
  );
  return time ?? null;
}

describe('#146 AC4: otočení zařízení během pohybu a přerušení', () => {
  it('po otočení pokračuje značka ze stejného dílu délky oblouku a dojde ve stejném čase', () => {
    const pairs = rotatedPairs();
    expect(pairs.length).toBeGreaterThan(0);
    for (const [before, after] of pairs) {
      const areaBefore = cardWindowCase(before).card.area;
      const areaAfter = cardWindowCase(after).card.area;
      for (const { label, move } of allMoves()) {
        const layoutBefore = layoutProgressMap(areaBefore, move.theme);
        const layoutAfter = layoutProgressMap(areaAfter, move.theme);
        const where = `${before.name} → ${after.name}, ${label}`;
        for (const ms of ROTATION_TIMES_MS) {
          const shareBefore = arcShareOfStep(
            layoutBefore,
            move.from,
            move.to,
            markerPointAt(layoutBefore, move, ms),
          );
          const shareAfter = arcShareOfStep(
            layoutAfter,
            move.from,
            move.to,
            markerPointAt(layoutAfter, move, ms),
          );
          expect(shareAfter, `${where}, otočení v ${ms} ms`).toBeCloseTo(shareBefore, 3);
        }
        expect(arrivalMsIn(layoutAfter, move), `${where}, dojití`).toBe(
          arrivalMsIn(layoutBefore, move),
        );
      }
    }
  });

  it('přerušení mapy v jakémkoli okamžiku proběhne bez chyby: značka i stopa mají vždy platnou polohu', () => {
    const odd = [-1000, -1, 0, MARKER_START_MS + 1, MARKER_START_MS + 450, 1e9];
    for (const { label, move, arc } of arcMoveCases()) {
      for (const ms of odd) {
        const where = `${label}, ${ms} ms`;
        expect(() => markerPointAt(arc.layout, move, ms), where).not.toThrow();
        expect(() => markerTrailAt(arc.layout, move, ms), where).not.toThrow();
        const point = markerPointAt(arc.layout, move, ms);
        expect(Number.isFinite(point.x) && Number.isFinite(point.y), where).toBe(true);
        const trail = markerTrailAt(arc.layout, move, ms);
        const trailPoints = [...(trail?.points ?? []), ...(trail?.sparkles ?? [])];
        expect(
          trailPoints.every((each) => Number.isFinite(each.x) && Number.isFinite(each.y)),
          where,
        ).toBe(true);
      }
    }
  });
});

/** Barva obrázku pod bodem mapy v kartě (obrázek zakrývá kartu, `mapCardPictureCover`). */
function toneUnder(arc: ArcCase, point: MapPoint): string {
  const { orientation, rect } = mapCardPictureCover(arc.card);
  // Plocha mapy začíná v levém horním rohu karty; obrázek je od něj v CSS px.
  const cssX = point.x * arc.area.scale;
  const cssY = point.y * arc.area.scale;
  const cell = (value: number, start: number, size: number): number =>
    Math.min(TONE_GRID - 1, Math.max(0, Math.floor(((value - start) / size) * TONE_GRID)));
  const column = cell(cssX, rect.left, rect.width);
  const row = cell(cssY, rect.top, rect.height);
  const tones = PICTURE_TONES[pictureFileName(arc.theme, orientation)]?.tones ?? [];
  return tones[row * TONE_GRID + column] ?? '#000000';
}

describe('#146 AC5: čára cesty a jiskřičky jsou po oblouku, zlatá stopa už ne (#144)', () => {
  // Od #144 tvoří cestu stopy; čára po `pathLinePoints` se kreslí jen
  // jemně pod nimi (krytí 20 %) a dál určuje, čemu se vyhýbá klíč a prostředí.
  // Kontrast jejích bodů hlídají testy barvy `pathColor` níž.
  it('jemná čára cesty pod stopami vede celým obloukem a její body jsou od oblouku nejvýš 1 CSS px', () => {
    for (const { label, area, layout } of arcCases()) {
      const limit = MAX_LINE_OFF_ARC_CSS / area.scale;
      const dense = denseArcOf(layout);
      for (let segment = 0; segment < SEGMENT_COUNT; segment += 1) {
        const where = `${label}, ${segmentName(segment)}`;
        const line = pathLinePoints(layout, segment);
        const [from, to] = chordOf(layout, segment);
        expect(distance(line[0] ?? { x: Infinity, y: 0 }, from), `${where}, začátek`).toBeLessThan(
          limit,
        );
        expect(
          distance(line[line.length - 1] ?? { x: Infinity, y: 0 }, to),
          `${where}, konec`,
        ).toBeLessThan(limit);
        for (const point of polylineCheckPoints(line)) {
          expect(projectOntoArc(dense, point).distance, where).toBeLessThanOrEqual(limit);
        }
        // Čára nevynechá kus oblouku: každý bod oblouku je u čáry.
        for (const point of arcSamples(layout, segment, SMOOTHNESS_SAMPLES)) {
          expect(distanceToPolyline(line, point), `${where}, oblouk u čáry`).toBeLessThanOrEqual(
            limit,
          );
        }
      }
    }
  });

  // #144 AC4 (upřesnění v issue): zlatou stopu za značkou nahradilo
  // rozsvěcování stop na cestě. Test „zlatá stopa jde po oblouku“ z #146
  // nahrazuje test „za jdoucí značkou už není zlatá čára, jiskřičky
  // zůstávají“ v `mapFootprints.test.ts` (je jen tam, aby nebyl dvakrát);
  // jak se stopy na oblouku rozsvěcují, hlídá tamtéž AC4.

  it('jiskřičky nejsou vidět, když značka stojí (zlatá stopa už není, #144)', () => {
    for (const { label, move, arc } of arcMoveCases()) {
      for (const ms of [0, MARKER_START_MS, MARKER_START_MS + MARKER_WALK_MS, mapShowMs(move)]) {
        expect(markerTrailAt(arc.layout, move, ms), `${label}, ${ms} ms`).toBeNull();
      }
    }
  });

  // #144 AC4 (upřesnění v issue): zlatá stopa, od které se jiskřičky měřily,
  // zmizela. Jiskřičky se teď měří od oblouku a od značky: leží na kusu
  // oblouku za značkou, dlouhém nejvýš 3,2 průměru značky, který začíná až
  // za okrajem minulého místa (jako dřív zlatá stopa).
  it('jiskřičky leží podél oblouku za jdoucí značkou, nejvýš půl značky od oblouku', () => {
    for (const { label, move, arc } of arcMoveCases()) {
      const { layout, area } = arc;
      const limit = MAX_LINE_OFF_ARC_CSS / area.scale;
      const dense = denseArcOf(layout);
      const from = dense.placeAlong[move.from] ?? 0;
      let seen = 0;
      for (const ms of trailTimes()) {
        const trail = markerTrailAt(layout, move, ms);
        if (trail === null) {
          continue;
        }
        const markerAlong = projectOntoArc(dense, markerPointAt(layout, move, ms)).along;
        const tail = Math.max(
          from + layout.placeSize / 2,
          markerAlong - SPARKLE_REACH_TO_MARKER * layout.markerSize,
        );
        for (const sparkle of trail.sparkles) {
          seen += 1;
          const projection = projectOntoArc(dense, sparkle);
          const where = `${label}, ${ms} ms`;
          expect(projection.distance, `${where}: jiskřička daleko od oblouku`).toBeLessThanOrEqual(
            layout.markerSize / 2,
          );
          expect(
            projection.along,
            `${where}: jiskřička dál za značkou než konec kusu oblouku`,
          ).toBeGreaterThanOrEqual(tail - limit);
          expect(projection.along, `${where}: jiskřička před značkou`).toBeLessThanOrEqual(
            markerAlong + limit,
          );
        }
      }
      expect(seen, `${label}: jiskřičky za značkou`).toBeGreaterThan(0);
    }
  });

  it('barva čáry cesty (pathColor, pod stopami jemně) má v kartě ve 25, 50 a 75 % oblouku vůči obrázku kontrast aspoň 3 : 1', () => {
    for (const arc of arcCases()) {
      const { pathColor } = progressMapStyleFor(arc.theme, 'picture');
      for (let segment = 0; segment < SEGMENT_COUNT; segment += 1) {
        for (const share of CONTRAST_SHARES) {
          const point = pathPointAt(arc.layout, segment, share);
          const tone = toneUnder(arc, point);
          expect(
            contrastRatio(pathColor, tone),
            `${arc.label}, ${segmentName(segment)} v ${share * 100} %: ${pathColor} na ${tone}`,
          ).toBeGreaterThanOrEqual(MIN_CONTRAST);
        }
      }
    }
  });

  it('bez obrázku má barva čáry cesty (pathColor) ve 25, 50 a 75 % oblouku vůči zástupné barvě kontrast aspoň 3 : 1', () => {
    for (const arc of arcCases()) {
      const { pathColor } = progressMapStyleFor(arc.theme, 'placeholder');
      const background = PROGRESS_MAP_BACKGROUNDS[arc.theme];
      for (let segment = 0; segment < SEGMENT_COUNT; segment += 1) {
        for (const share of CONTRAST_SHARES) {
          // Zástupné pozadí je jednobarevné, bod oblouku musí jen ležet v kartě.
          const point = pathPointAt(arc.layout, segment, share);
          const where = `${arc.label}, ${segmentName(segment)} v ${share * 100} %`;
          expect(point.x >= 0 && point.x <= arc.area.width, where).toBe(true);
          expect(point.y >= 0 && point.y <= arc.area.height, where).toBe(true);
          expect(
            contrastRatio(pathColor, background),
            `${where}: ${pathColor} na ${background}`,
          ).toBeGreaterThanOrEqual(MIN_CONTRAST);
        }
      }
    }
  });
});
