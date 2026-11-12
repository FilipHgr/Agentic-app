import { describe, expect, it } from 'vitest';

import { MAX_SCENERY_PIECES_PER_KIND } from '../../../src/games/counting/logic/mapScenery';
import { createMapPictureLoading } from '../../../src/games/counting/logic/mapPictureLoading';
import { mapOrientationOf } from '../../../src/games/counting/logic/mapPictures';
import { MAP_SHOW_MS, MAP_THEMES } from '../../../src/games/counting/logic/progressMap';
import { isInside } from '../../shared/viewportFixtures';
import type { TestWindow } from '../../shared/viewportFixtures';
import {
  EXPECTED_KINDS,
  KIND_NAMES,
  LANE_KINDS,
  MAP_SCENERY_KINDS,
  MAP_WINDOWS,
  pieceName,
  piecesOf,
  poseBox,
  sceneryCase,
  sceneryCases,
  sceneryPoseAt,
  sceneryTimes,
} from './mapSceneryScenes';
import type { SceneryCase, SceneryPose } from './mapSceneryScenes';

/**
 * Testy k #136 AC1–AC4: na každé z 5 map se jemně hýbe prostředí podle
 * tématu. Testuje se čistá logika `src/games/counting/logic/mapScenery.ts`
 * (druhy pohybu, rozložení kousků a kde je kousek v čase od ukázání mapy),
 * scéna ji jen kreslí. Každé pravidlo má jeden test, který v cyklu projde
 * všechna okna mapy (`MAP_WINDOWS`) a 5 map; popis případu je ve zprávě
 * `expect`. Překryvy s mapou hlídá `mapSceneryLayout.test.ts`.
 *
 * Ručně se kontroluje (AC5): pohyby jsou klidné, neodvádějí pozornost od
 * značky a mapa s nimi běží v 60 fps ve WebKitu na iPadu i iPhonu. Že se
 * pohyby po zavření nebo přerušení mapy zastaví, je věc scény (ruční
 * kontrola); že se mapa po přerušení zavře, hlídá `mapAnimationSession.test.ts`.
 * Prvky na dotyk nereagují (otázka 1, doporučení), nemají ťukací plochu.
 *
 * Navržené rozhraní viz `mapSceneryScenes.ts`.
 */

let cached: SceneryCase[] | undefined;

function cases(): SceneryCase[] {
  cached ??= sceneryCases();
  return cached;
}

describe('#136 AC1: každá mapa má 2–3 druhy pohybu podle tématu', () => {
  it('každá z 5 map má 2 až 3 druhy pohybu a mezi nimi ty ze zadání', () => {
    for (const theme of MAP_THEMES) {
      const kinds = MAP_SCENERY_KINDS[theme];
      expect(kinds.length, `mapa ${theme}`).toBeGreaterThanOrEqual(2);
      expect(kinds.length, `mapa ${theme}`).toBeLessThanOrEqual(3);
      expect(new Set(kinds).size, `mapa ${theme}: druhy se neopakují`).toBe(kinds.length);
      for (const kind of EXPECTED_KINDS[theme]) {
        expect(kinds, `mapa ${theme}: ${KIND_NAMES[kind]}`).toContain(kind);
      }
    }
  });

  it('každá mapa je jiná: žádný druh pohybu není na dvou mapách', () => {
    const seen = new Map<string, string>();
    for (const theme of MAP_THEMES) {
      for (const kind of MAP_SCENERY_KINDS[theme]) {
        expect(seen.get(kind), `${KIND_NAMES[kind]} na mapě ${theme}`).toBeUndefined();
        seen.set(kind, theme);
      }
    }
  });

  it('na mapě se v každém okně hýbe každý druh mapy a žádný cizí', () => {
    for (const testCase of cases()) {
      const kinds = MAP_SCENERY_KINDS[testCase.theme];
      for (const kind of kinds) {
        expect(
          piecesOf(testCase.scenery, kind).length,
          `${testCase.label}: ${KIND_NAMES[kind]}`,
        ).toBeGreaterThan(0);
      }
      for (const piece of testCase.scenery.pieces) {
        expect(kinds, `${testCase.label}: ${pieceName(testCase.scenery, piece)}`).toContain(
          piece.kind,
        );
      }
    }
  });

  it('každý druh pohybu má nejvýš 6 kousků', () => {
    expect(MAX_SCENERY_PIECES_PER_KIND).toBe(6);
    for (const testCase of cases()) {
      for (const kind of MAP_SCENERY_KINDS[testCase.theme]) {
        expect(
          piecesOf(testCase.scenery, kind).length,
          `${testCase.label}: ${KIND_NAMES[kind]}`,
        ).toBeLessThanOrEqual(MAX_SCENERY_PIECES_PER_KIND);
      }
    }
  });
});

/** Kousek ve všech kontrolovaných časech od ukázání mapy do jejího zavření. */
function posesOf(testCase: SceneryCase, pieceIndex: number): Array<[number, SceneryPose]> {
  const piece = testCase.scenery.pieces[pieceIndex];
  if (!piece) {
    return [];
  }
  return sceneryTimes().map((ms) => [ms, sceneryPoseAt(piece, ms)]);
}

describe('#136 AC2: kousky jsou malé a drží se své plochy', () => {
  it('žádný rozměr kousku není v žádném okamžiku větší než průměr značky', () => {
    for (const testCase of cases()) {
      testCase.scenery.pieces.forEach((piece, index) => {
        const name = `${testCase.label}: ${pieceName(testCase.scenery, piece)}`;
        for (const [ms, pose] of posesOf(testCase, index)) {
          const where = `${name} v ${ms} ms`;
          expect(pose.width, where).toBeGreaterThan(0);
          expect(pose.height, where).toBeGreaterThan(0);
          expect(pose.width, where).toBeLessThanOrEqual(testCase.map.markerSize + 1e-6);
          expect(pose.height, where).toBeLessThanOrEqual(testCase.map.markerSize + 1e-6);
        }
      });
    }
  });

  it('kousek během celého zobrazení mapy nevyjde ze své plochy pohybu', () => {
    for (const testCase of cases()) {
      testCase.scenery.pieces.forEach((piece, index) => {
        const name = `${testCase.label}: ${pieceName(testCase.scenery, piece)}`;
        for (const [ms, pose] of posesOf(testCase, index)) {
          expect(isInside(poseBox(pose), piece.sweep, 1e-6), `${name} v ${ms} ms`).toBe(true);
        }
      });
    }
  });

  it('padající listí a bublinky se pohybují jen ve svém pruhu', () => {
    for (const testCase of cases()) {
      for (const piece of testCase.scenery.pieces) {
        if (!LANE_KINDS.includes(piece.kind)) {
          continue;
        }
        const name = `${testCase.label}: ${pieceName(testCase.scenery, piece)}`;
        expect(piece.lane, `${name} má vymezený pruh`).toBeDefined();
        if (!piece.lane) {
          continue;
        }
        expect(isInside(piece.sweep, piece.lane, 1e-6), `${name} zůstane v pruhu`).toBe(true);
        const laneWidth = piece.lane.right - piece.lane.left;
        const laneHeight = piece.lane.bottom - piece.lane.top;
        expect(laneHeight, `${name}: pruh vede shora dolů`).toBeGreaterThan(laneWidth);
      }
    }
  });

  it('listí padá dolů a bublinky stoupají nahoru', () => {
    for (const testCase of cases()) {
      testCase.scenery.pieces.forEach((piece, index) => {
        if (!LANE_KINDS.includes(piece.kind)) {
          return;
        }
        const name = `${testCase.label}: ${pieceName(testCase.scenery, piece)}`;
        let down = 0;
        let up = 0;
        const poses = posesOf(testCase, index);
        poses.slice(1).forEach(([, pose], step) => {
          const before = poses[step]?.[1];
          if (!before) {
            return;
          }
          if (pose.y > before.y) {
            down += 1;
          } else if (pose.y < before.y) {
            up += 1;
          }
        });
        if (piece.kind === 'fallingLeaves') {
          expect(down, `${name}: list víc padá, než stoupá`).toBeGreaterThan(up);
        } else {
          expect(up, `${name}: bublinka víc stoupá, než klesá`).toBeGreaterThan(down);
        }
      });
    }
  });
});

/** Liší se dva okamžiky kousku tak, že to dítě uvidí (poloha, velikost, průhlednost, natočení)? */
function differs(first: SceneryPose, second: SceneryPose): boolean {
  const keys = ['x', 'y', 'width', 'height', 'alpha', 'angle'] as const;
  return keys.some((key) => Math.abs(first[key] - second[key]) > 1e-3);
}

describe('#136 AC3: pohyby běží celou dobu, co je mapa vidět', () => {
  it('každý kousek je vidět hned s ukázáním mapy a hýbe se, dokud se mapa nezavře', () => {
    for (const testCase of cases()) {
      testCase.scenery.pieces.forEach((piece, index) => {
        const name = `${testCase.label}: ${pieceName(testCase.scenery, piece)}`;
        const poses = posesOf(testCase, index).filter(([ms]) => ms <= MAP_SHOW_MS);
        const first = poses[0]?.[1];
        expect(first, name).toBeDefined();
        if (!first) {
          return;
        }
        expect(first.alpha, `${name}: vidět od ukázání mapy`).toBeGreaterThan(0);
        expect(
          poses.some(([, pose]) => differs(pose, first)),
          `${name}: během 3 s zobrazení mapy se pohne`,
        ).toBe(true);
      });
    }
  });

  it('průhlednost kousku je vždy mezi 0 a 1 a čísla dávají smysl', () => {
    for (const testCase of cases()) {
      testCase.scenery.pieces.forEach((piece, index) => {
        const name = `${testCase.label}: ${pieceName(testCase.scenery, piece)}`;
        for (const [ms, pose] of posesOf(testCase, index)) {
          const where = `${name} v ${ms} ms`;
          for (const value of [pose.x, pose.y, pose.width, pose.height, pose.alpha, pose.angle]) {
            expect(Number.isFinite(value), where).toBe(true);
          }
          expect(pose.alpha, where).toBeGreaterThanOrEqual(0);
          expect(pose.alpha, where).toBeLessThanOrEqual(1);
        }
      });
    }
  });

  it('pohyby dopadnou při každém ukázání mapy stejně (bez náhody)', () => {
    for (const window of MAP_WINDOWS) {
      for (const theme of MAP_THEMES) {
        const first = sceneryCase(window, theme);
        const again = sceneryCase(window, theme);
        expect(again.scenery, first.label).toEqual(first.scenery);
        first.scenery.pieces.forEach((piece, index) => {
          const twin = again.scenery.pieces[index];
          expect(twin, first.label).toBeDefined();
          if (twin) {
            for (const ms of [0, 750, MAP_SHOW_MS]) {
              expect(
                sceneryPoseAt(twin, ms),
                `${first.label}: ${pieceName(first.scenery, piece)} v ${ms} ms`,
              ).toEqual(sceneryPoseAt(piece, ms));
            }
          }
        });
      }
    }
  });
});

/**
 * Otočení zařízení: okno a stejné okno s prohozenou šířkou a výškou
 * (iPhone Pro Max na šířku ↔ na výšku, hranice 932 × 499 ↔ 499 × 932).
 */
function rotatedPairs(): Array<[TestWindow, TestWindow]> {
  const pairs: Array<[TestWindow, TestWindow]> = [];
  for (const before of MAP_WINDOWS) {
    for (const after of MAP_WINDOWS) {
      if (after.width === before.height && after.height === before.width) {
        pairs.push([before, after]);
      }
    }
  }
  return pairs;
}

/** Okamžiky otočení v ms od ukázání mapy. */
const ROTATION_TIMES_MS = [0, 400, 1200, 2500, 4000];

describe('#136 AC3: po otočení zařízení prvky pokračují v novém rozložení', () => {
  it('po otočení se na mapě hýbou stejné druhy se stejným počtem kousků', () => {
    const pairs = rotatedPairs();
    expect(pairs.length).toBeGreaterThan(0);
    for (const [before, after] of pairs) {
      for (const theme of MAP_THEMES) {
        const old = sceneryCase(before, theme);
        const rotated = sceneryCase(after, theme);
        for (const kind of MAP_SCENERY_KINDS[theme]) {
          expect(
            piecesOf(rotated.scenery, kind).length,
            `${before.name} → ${after.name}, mapa ${theme}: ${KIND_NAMES[kind]}`,
          ).toBe(piecesOf(old.scenery, kind).length);
        }
      }
    }
  });

  it('po otočení kousek pokračuje ze stejného okamžiku pohybu (průhlednost a natočení)', () => {
    for (const [before, after] of rotatedPairs()) {
      for (const theme of MAP_THEMES) {
        const old = sceneryCase(before, theme);
        const rotated = sceneryCase(after, theme);
        for (const kind of MAP_SCENERY_KINDS[theme]) {
          const oldPieces = piecesOf(old.scenery, kind);
          const newPieces = piecesOf(rotated.scenery, kind);
          oldPieces.forEach((piece, index) => {
            const twin = newPieces[index];
            const name = `${before.name} → ${after.name}, mapa ${theme}: ${KIND_NAMES[kind]} ${index + 1}`;
            expect(twin, name).toBeDefined();
            if (!twin) {
              return;
            }
            for (const ms of ROTATION_TIMES_MS) {
              const was = sceneryPoseAt(piece, ms);
              const now = sceneryPoseAt(twin, ms);
              expect(now.alpha, `${name}, otočení v ${ms} ms`).toBeCloseTo(was.alpha, 3);
              expect(now.angle, `${name}, otočení v ${ms} ms`).toBeCloseTo(was.angle, 3);
            }
          });
        }
      }
    }
  });
});

describe('#136 AC4: pohyby se ukážou i nad zástupným vzhledem mapy', () => {
  it('když se obrázek mapy nestáhl, mapa má zástupný vzhled a hýbou se na ní stejné kousky', async () => {
    for (const window of MAP_WINDOWS) {
      for (const theme of MAP_THEMES) {
        const picture = { theme, orientation: mapOrientationOf(window) };
        const loading = createMapPictureLoading(() => Promise.reject(new TypeError('offline')));
        loading.prepare(picture);
        await Promise.resolve();
        await Promise.resolve();
        const label = `${window.name}, mapa ${theme}, obrázek se nestáhl`;
        expect(loading.mapShown(picture), label).toBe('placeholder');

        const testCase = sceneryCase(window, theme);
        for (const kind of MAP_SCENERY_KINDS[theme]) {
          expect(
            piecesOf(testCase.scenery, kind).length,
            `${label}: ${KIND_NAMES[kind]}`,
          ).toBeGreaterThan(0);
        }
      }
    }
  });
});
