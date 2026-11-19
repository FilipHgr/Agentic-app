import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { blankPaperRegions } from '../../../src/games/coloring/logic/blankPaper';
import { COLORING_PICTURES } from '../../../src/games/coloring/logic/pictureSet';
import { OUTLINE_REGION } from '../../../src/games/coloring/logic/regionMap';
import { openColoring } from '../../../src/games/coloring/logic/savedPicture';
import { COLORING_META } from '../../../src/games/coloring/meta';
import { openProfiles } from '../../../src/shared/storage/profileStorage';
import { DeviceStorage } from '../../shared/profileFixtures';
import {
  OTHER_COLOR,
  PAPER,
  PAPER_COLOR,
  PAPER_HEIGHT,
  PAPER_PLACE,
  PAPER_WIDTH,
  isBlank,
  paintAcrossPaper,
  paintedNear,
  paperPixels,
  paperRegions,
  previewColorsOfPaper,
  sameImage,
} from './blankPaperHelpers';
import { coloringCases } from './coloringLayoutScenes';
import { drawWith } from './drawingToolHelpers';
import { backToPicker, coloringStorage, enterPicker, openFromPicker } from './pictureChoiceHelpers';
import { LAYER, fingerStroke, lineOf, pictureBoxOf } from './pictureRotationHelpers';
import { paint, startStroke } from './savedPictureHelpers';
import { at } from './strokeHelpers';
import { PAINTING_TOOLS } from './tightStrokesHelpers';
import { TOOL_NAMES } from './lineSizeHelpers';
import type { Point } from './outlineFixtures';

/**
 * Testy k #151 AC1 (papír na výběru), AC2 (kreslení po papíře) a AC5
 * (plné úložiště, dva prsty, tah začatý mimo obrázek). Zámky papíru (AC1)
 * testuje `blankPaperLocks.test.ts`, album (AC3 a plné album z AC5)
 * `blankPaperAlbum.test.ts`, matici těsných tahů (AC4)
 * `blankPaperTightStrokes.slow.test.ts`.
 *
 * Navržené rozhraní (čistý TS bez Phaseru):
 * - `src/games/coloring/logic/blankPaper.ts`:
 *   `BLANK_PAPER: PictureIdentity` = `{ id: 'paper', version: 1 }`,
 *   `isBlankPaper(picture: PictureIdentity): boolean` a
 *   `blankPaperRegions(): RegionMap` mapa oblastí papíru 1024 × 768 (jako
 *   vrstva barev malování), celá plocha je jedna oblast, žádný pixel obrysu.
 *   Scéna ji dá malování, náhledu, albu a zámkům místo obrysu z obrázku.
 * - `COLORING_PICTURES` v `pictureSet.ts` začíná `BLANK_PAPER`, za ním
 *   dnešních 11 omalovánek ve stejném pořadí.
 * - Výběr, malování, ukládání a album papír nijak nerozlišují, papír je
 *   pro ně omalovánka jako ostatní.
 *
 * Bílý list se šedým ✎ na dlaždici a ostrost plochy jsou ruční kontrola (AC6).
 */

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

/** Dítě otevře papír (bez výběru) nad úložištěm `storage`. */
function openPaperOn(storage: Parameters<typeof openColoring>[0]['storage']) {
  return openColoring({ regions: paperRegions(), picture: PAPER, storage });
}

/** Body, kudy jde prst při tahu přes celý papír: kolem dokola u okrajů a přes střed. */
const ACROSS_PAPER: readonly Point[] = [
  at(12, 12),
  at(PAPER_WIDTH / 2, 12),
  at(PAPER_WIDTH - 12, 12),
  at(PAPER_WIDTH - 12, PAPER_HEIGHT / 2),
  at(PAPER_WIDTH - 12, PAPER_HEIGHT - 12),
  at(PAPER_WIDTH / 2, PAPER_HEIGHT - 12),
  at(12, PAPER_HEIGHT - 12),
  at(12, PAPER_HEIGHT / 2),
  at(PAPER_WIDTH / 2, PAPER_HEIGHT / 2),
];

/**
 * Jak blízko bodu dráhy musí být barva (px). Razítkový fix dělá razítka
 * s mezerami asi 40 px, sprej, puntíky a třpytky barví jen část stopy.
 */
const NEAR_STROKE = 40;

/** Hustá dráha prstu přes body `points` (krok asi 8 px). */
function densePath(points: readonly Point[]): Point[] {
  const path: Point[] = [];
  points.forEach((point, index) => {
    const next = points[index + 1];
    if (next === undefined) {
      path.push(point);
      return;
    }
    const steps = Math.max(1, Math.ceil(Math.hypot(next.x - point.x, next.y - point.y) / 8));
    path.push(...lineOf(point, next, steps).slice(0, -1));
  });
  return path;
}

describe('#151 AC1: papír je na výběru na 1. místě', () => {
  it('papír je v pořadí sady první, tedy první náhled na 1. stránce výběru', () => {
    expect(COLORING_PICTURES[0]).toEqual(PAPER);
    const choice = enterPicker(COLORING_PICTURES);
    expect(choice.pickerPage(), 'výběr se otevře na 1. stránce').toBe(0);
    expect(choice.pagePreviews()[PAPER_PLACE], 'první náhled').toEqual(PAPER);
  });

  // Upraveno k #152 AC1: za těmito 11 omalovánkami je navíc 5 nových
  // (realPictureSet.test.ts), proto se porovnávají místa 2–12.
  it('za papírem je dnešních 11 omalovánek posunutých o jedno místo ve stejném pořadí', () => {
    expect(COLORING_PICTURES.slice(1, 12).map((picture) => picture.id)).toEqual([
      'house',
      'cat',
      'dog',
      'car',
      'butterfly',
      'fish',
      'sea',
      'mermaid',
      'rainbow',
      'ornament',
      'unicorn',
    ]);
  });

  it('papír je v sadě jen jednou', () => {
    expect(COLORING_PICTURES.filter((picture) => picture.id === PAPER.id)).toEqual([PAPER]);
  });

  it('ťuknutí na papír otevře malování papíru', () => {
    const choice = enterPicker(COLORING_PICTURES);
    expect(choice.tapPreview(PAPER_PLACE)).toMatchObject({
      kind: 'open',
      index: PAPER_PLACE,
      picture: PAPER,
    });
    choice.paintingShown();
    expect(choice.screen()).toEqual({ kind: 'painting', picture: PAPER });
  });

  it('otevřený papír je čistý bílý: žádný pixel nemá barvu ani obrys', () => {
    const regions = paperRegions();
    const choice = enterPicker(COLORING_PICTURES);
    const storage = coloringStorage(openProfiles(new DeviceStorage()));
    const game = openFromPicker(choice, PAPER_PLACE, storage, regions);

    expect(isBlank(paperPixels(game)), 'žádná barva').toBe(true);
    expect(
      regions.regionIds.some((region) => region === OUTLINE_REGION),
      'žádný pixel obrysu',
    ).toBe(false);
  });

  it('náhled nepomalovaného papíru je celý bílý', () => {
    expect(previewColorsOfPaper(coloringStorage(openProfiles(new DeviceStorage())))).toEqual([
      '#FFFFFF',
    ]);
  });

  it('papír má rozměr vrstvy barev 1024 × 768 naležato, jako ostatní omalovánky', () => {
    const regions = paperRegions();
    expect({ width: regions.width, height: regions.height }).toEqual({
      width: PAPER_WIDTH,
      height: PAPER_HEIGHT,
    });
    expect(regions.width, 'naležato').toBeGreaterThan(regions.height);
    expect(blankPaperRegions(), 'mapa papíru je pokaždé stejná').toEqual(regions);
  });

  it('na výšku se papír neotáčí: tah u levého horního rohu obrazovky barví levý horní roh papíru', () => {
    const portrait = coloringCases().filter(
      (testCase) => testCase.panel === 'closed' && !testCase.landscape,
    );
    expect(portrait.length, 'okna na výšku').toBeGreaterThan(0);
    expect(paperRegions().width, 'vrstva papíru má rozměr vrstvy malování').toBe(LAYER.width);
    for (const testCase of portrait) {
      const game = openPaperOn(undefined);
      game.tapColor(PAPER_COLOR);
      const box = pictureBoxOf(testCase.layout);
      const width = box.right - box.left;
      const height = box.bottom - box.top;
      const nearCorner = { x: box.left + width * 0.02, y: box.top + height * 0.02 };
      const along = { x: box.left + width * 0.3, y: box.top + height * 0.02 };
      fingerStroke(game, testCase, lineOf(nearCorner, along, 20));

      const what = testCase.scene.label;
      expect(paintedNear(game, at(20, 15), 12), `${what}: levý horní roh papíru`).toBeGreaterThan(
        0,
      );
      expect(
        paintedNear(game, at(PAPER_WIDTH - 20, 15), 12),
        `${what}: pravý horní roh zůstal bílý`,
      ).toBe(0);
      expect(
        paintedNear(game, at(20, PAPER_HEIGHT - 15), 12),
        `${what}: levý dolní roh zůstal bílý`,
      ).toBe(0);
    }
  });
});

describe('#151 AC2: kreslení po celém papíře', () => {
  it('celý papír je jedna oblast bez obrysu', () => {
    const regions = paperRegions();
    expect(regions.regionCount).toBe(1);
    const [first] = regions.regionIds;
    expect(first, 'oblast papíru').not.toBe(OUTLINE_REGION);
    expect(
      regions.regionIds.every((region) => region === first),
      'každý pixel patří do stejné oblasti',
    ).toBe(true);
  });

  for (const tool of PAINTING_TOOLS) {
    it(`${TOOL_NAMES[tool]}: tah přes celý papír barví všude, kudy prst jel, u okrajů i uprostřed`, () => {
      const game = openPaperOn(undefined);
      // Prst jede kousek za střed: razítka se kladou s odstupem a poslední
      // razítko nemusí být přesně na konci tahu.
      drawWith(
        game,
        tool,
        PAPER_COLOR,
        densePath([...ACROSS_PAPER, at(PAPER_WIDTH / 2 + 120, PAPER_HEIGHT / 2)]),
      );
      for (const point of ACROSS_PAPER) {
        expect(
          paintedNear(game, point, NEAR_STROKE),
          `${TOOL_NAMES[tool]}: u bodu ${point.x}, ${point.y}`,
        ).toBeGreaterThan(0);
      }
    });
  }

  it('tah z jednoho okraje papíru na druhý se nikde neořízne (ořez do oblasti nic neubere)', () => {
    const game = openPaperOn(undefined);
    game.tapColor(PAPER_COLOR);
    paint(game, densePath([at(4, PAPER_HEIGHT / 2), at(PAPER_WIDTH - 4, PAPER_HEIGHT / 2)]));
    for (let x = 4; x < PAPER_WIDTH - 4; x += 1) {
      expect(game.colorAt(x, PAPER_HEIGHT / 2), `pixel ${x} na čáře tahu`).toBe(PAPER_COLOR);
    }
  });

  it('guma vrátí pomalovaná místa na bílou', () => {
    const game = openPaperOn(undefined);
    const path = densePath([at(100, 300), at(900, 300)]);
    drawWith(game, 'brush', PAPER_COLOR, path);
    expect(game.colorAt(500, 300), 'před gumou').toBe(PAPER_COLOR);

    drawWith(game, 'eraser', PAPER_COLOR, path);

    for (const point of path) {
      expect(game.colorAt(point.x, point.y), `bod ${point.x}, ${point.y}`).toBeNull();
    }
  });

  it('Zpět vrátí poslední tah a předchozí tah zůstane', () => {
    const game = openPaperOn(undefined);
    drawWith(game, 'brush', PAPER_COLOR, densePath([at(100, 200), at(900, 200)]));
    const afterFirst = paperPixels(game);
    drawWith(game, 'brush', OTHER_COLOR, densePath([at(100, 500), at(900, 500)]));

    expect(game.tapUndo().kind).toBe('undone');

    expect(sameImage(paperPixels(game), afterFirst), 'papír je jako po prvním tahu').toBe(true);
    expect(game.tapUndo().kind, 'vrátí i první tah').toBe('undone');
    expect(isBlank(paperPixels(game)), 'papír je zase bílý').toBe(true);
  });
});

describe('#151 AC5: okrajové případy', () => {
  it('dva prsty na papíru ho otevřou jen jednou', () => {
    const choice = enterPicker(COLORING_PICTURES);
    expect(choice.tapPreview(PAPER_PLACE)).toMatchObject({ kind: 'open', picture: PAPER });
    expect(choice.tapPreview(PAPER_PLACE), 'druhý prst na papíru').toEqual({ kind: 'ignored' });
    expect(choice.tapPreview(1), 'druhý prst na domku').toEqual({ kind: 'ignored' });
    expect(choice.screen()).toEqual({ kind: 'opening', picture: PAPER });
  });

  it('tah začatý mimo plochu obrázku (lišta, panel) papír nepomaluje, ani když prst sjede na papír', () => {
    const starts: ReadonlyArray<readonly [string, Point]> = [
      ['vlevo od papíru', at(-30, PAPER_HEIGHT / 2)],
      ['vpravo od papíru', at(PAPER_WIDTH + 30, PAPER_HEIGHT / 2)],
      ['nad papírem', at(PAPER_WIDTH / 2, -30)],
      ['pod papírem', at(PAPER_WIDTH / 2, PAPER_HEIGHT + 30)],
    ];
    for (const [where, start] of starts) {
      const game = openPaperOn(undefined);
      game.tapColor(PAPER_COLOR);
      startStroke(game, densePath([start, at(PAPER_WIDTH / 2, PAPER_HEIGHT / 2)]));
      game.pointerUp(1);
      expect(isBlank(paperPixels(game)), where).toBe(true);
    }
  });

  it('při plném úložišti jde na papíře malovat bez chyby a po návratu na výběr je obrázek na papíře dál', () => {
    const device = new DeviceStorage();
    const store = openProfiles(device);
    device.failWrite = (key) => key.includes(`.${COLORING_META.id}.`);
    const choice = enterPicker(COLORING_PICTURES);

    let painted: ReturnType<typeof paperPixels> = [];
    expect(() => {
      const game = openFromPicker(choice, PAPER_PLACE, coloringStorage(store), paperRegions());
      paintAcrossPaper(game);
      painted = paperPixels(game);
      backToPicker(choice, game);
    }).not.toThrow();

    const again = openFromPicker(choice, PAPER_PLACE, coloringStorage(store), paperRegions());
    expect(isBlank(painted), 'kontrola: papír byl pomalovaný').toBe(false);
    expect(sameImage(paperPixels(again), painted), 'obrázek na papíře zůstal').toBe(true);
  });
});
