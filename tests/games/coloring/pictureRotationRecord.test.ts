import { describe, expect, it } from 'vitest';

import type { RegionMap } from '../../../src/games/coloring/logic/regionMap';
import type { SavedColoring } from '../../../src/games/coloring/logic/savedPicture';
import { PANEL_TOOLS } from '../../../src/games/coloring/logic/toolPanel';
import type { PanelView, ToolId } from '../../../src/games/coloring/logic/toolPanel';
import { IPAD_WINDOWS, PHONE_PORTRAIT_WINDOWS } from '../../shared/viewportFixtures';
import { coloringCase } from './coloringLayoutScenes';
import type { ColoringCase } from './coloringLayoutScenes';
import { choose } from './drawingToolHelpers';
import {
  LEGACY_BEFORE_111_LINE_SIZE,
  LEGACY_BEFORE_111_RECENT_COLORS,
  LEGACY_BEFORE_111_STORAGE,
  LEGACY_BEFORE_111_TOOL_COLORS,
  legacyBefore111Pixels,
  legacyBefore111Regions,
} from './legacyBefore111RecordFixture';
import { drawing } from './outlineFixtures';
import type { Point } from './outlineFixtures';
import {
  LAYER,
  coloredCount,
  differingPixels,
  fingerDown,
  fingerStroke,
  lineOf,
  screenPointOf,
  touchedLayerPoint,
} from './pictureRotationHelpers';
import { RecordingStorage, openOn, paint, pixelsOf, startStroke } from './savedPictureHelpers';
import {
  BLUE,
  GREEN,
  PINK,
  PURPLE,
  YELLOW,
  giveColor,
  openToolStep,
  pickTool,
} from './toolColorsHelpers';

/**
 * Testy k #111 AC2 (vzorek tahu je v uloženém obrázku stejný na výšku i na
 * šířku) a AC5 (uložení a otočení zařízení). Logika malování pracuje jen
 * v pixelech vrstvy barev, dotyk na obrazovce do nich převádí
 * `pictureLayerPoint` (`pictureRotationHelpers.ts`). Na výšku se kreslí
 * v okně 390 × 844 (obrázek otočený o 90°), na šířku v okně iPadu
 * 1180 × 820. Stejný tah po stejném místě omalovánky musí dát stejný
 * uložený obrázek pixel po pixelu i stejný záznam v úložišti, jako kdyby se
 * kreslilo přímo v pixelech vrstvy (vzory se otáčejí s obrázkem, otevřená
 * otázka 4).
 *
 * Otočení zařízení hlásí scéna logice jako přerušení tahu
 * (`SavedColoring.interrupt()`, stejně jako #88 AC5) a pak přepočítá
 * rozložení (`layoutColoring`) pro nový tvar okna. Obrázek se neukládá
 * jinak (uložení beze změny, mimo rozsah je změna kódování).
 *
 * Obrázek uložený před #111 je pevný záznam
 * v `legacyBefore111RecordFixture.ts` (všechny vzorky nástrojů).
 */

const PORTRAIT_WINDOW = PHONE_PORTRAIT_WINDOWS.find(
  (window) => window.width === 390 && window.height === 844,
);
const LANDSCAPE_WINDOW = IPAD_WINDOWS.find(
  (window) => window.width === 1180 && window.height === 820,
);

function portraitCase(): ColoringCase {
  if (PORTRAIT_WINDOW === undefined) {
    throw new Error('chybí okno 390 × 844');
  }
  return coloringCase(PORTRAIT_WINDOW, 'closed');
}

function landscapeCase(): ColoringCase {
  if (LANDSCAPE_WINDOW === undefined) {
    throw new Error('chybí okno iPadu 1180 × 820');
  }
  return coloringCase(LANDSCAPE_WINDOW, 'closed');
}

/** Prázdná omalovánka 1024 × 768 rozdělená svislou čárou x 512 (vzorky se ořežou i na čáře). */
let cachedRegions: RegionMap | undefined;

function halves(): RegionMap {
  cachedRegions ??= drawing(LAYER.width, LAYER.height).verticalLine(512, 4).regions();
  return cachedRegions;
}

/** Tah po omalovánce v pixelech vrstvy: šikmo přes levou půlku a zpět k čáře. */
const LAYER_PATH: readonly Point[] = [
  { x: 120.5, y: 140.5 },
  { x: 260.5, y: 230.5 },
  { x: 380.5, y: 420.5 },
  { x: 300.5, y: 610.5 },
  { x: 470.5, y: 650.5 },
];

/** Nástroje se vzorkem z AC2 a barva, kterou malují (duha barvu nemá). */
const PATTERN_TOOLS: ReadonlyArray<{ readonly tool: ToolId; readonly color: number | null }> = [
  { tool: 'stripes', color: BLUE },
  { tool: 'dots', color: GREEN },
  { tool: 'spray', color: PURPLE },
  { tool: 'stamp', color: YELLOW },
  { tool: 'rainbow', color: null },
  { tool: 'glitter', color: PINK },
];

/** Dítě vybere nástroj (a jeho barvu) a velkou velikost čáry. */
function prepareTool(game: SavedColoring, tool: ToolId, color: number | null): void {
  openToolStep(game);
  game.tapSizeToggle();
  if (color === null) {
    pickTool(game, tool);
  } else {
    giveColor(game, tool, color);
  }
}

/** Jak se tah kreslí: přímo v pixelech vrstvy, nebo prstem v okně na výšku / na šířku. */
type Drawing = 'vrstva' | 'na výšku' | 'na šířku';

function drawOnce(tool: ToolId, color: number | null, how: Drawing): RecordingStorage {
  const storage = new RecordingStorage();
  const game = openOn(storage, halves());
  prepareTool(game, tool, color);
  if (how === 'vrstva') {
    paint(game, LAYER_PATH);
  } else {
    const testCase = how === 'na výšku' ? portraitCase() : landscapeCase();
    fingerStroke(
      game,
      testCase,
      LAYER_PATH.map((point) => screenPointOf(testCase, point)),
    );
  }
  game.suspend();
  return storage;
}

function picturePixels(storage: RecordingStorage): Array<number | null> {
  return pixelsOf(openOn(storage, halves()), halves());
}

describe('#111 AC2, AC5: vzorek tahu je v uloženém obrázku stejný na výšku i na šířku', () => {
  for (const { tool, color } of PATTERN_TOOLS) {
    it(`${tool}: tah na výšku i na šířku uloží stejný obrázek pixel po pixelu jako tah po omalovánce`, () => {
      const reference = picturePixels(drawOnce(tool, color, 'vrstva'));
      expect(coloredCount(reference), `${tool}: tah něco namaloval`).toBeGreaterThan(0);
      for (const how of ['na výšku', 'na šířku'] as const) {
        const pixels = picturePixels(drawOnce(tool, color, how));
        expect(differingPixels(pixels, reference), `${tool}, ${how}: jiných pixelů`).toBe(0);
      }
    });
  }

  it('záznam v úložišti po tahu na výšku je stejný jako po stejném tahu na šířku', () => {
    for (const { tool, color } of PATTERN_TOOLS) {
      const portrait = drawOnce(tool, color, 'na výšku');
      const landscape = drawOnce(tool, color, 'na šířku');
      expect([...portrait.data.entries()], `${tool}: úložiště`).toEqual([
        ...landscape.data.entries(),
      ]);
    }
  });

  it('co se namalovalo na výšku, je po otočení na šířku stejné a dá se v tom malovat dál', () => {
    const regions = halves();
    const turned = openOn(new RecordingStorage(), regions);
    prepareTool(turned, 'stripes', BLUE);
    const portrait = portraitCase();
    fingerStroke(
      turned,
      portrait,
      LAYER_PATH.map((point) => screenPointOf(portrait, point)),
    );
    const afterPortrait = pixelsOf(turned, regions);
    // Otočení: tah už skončil, scéna jen přepočítá rozložení. Obrázek se nezmění.
    turned.interrupt();
    expect(differingPixels(pixelsOf(turned, regions), afterPortrait), 'po otočení').toBe(0);

    const landscape = landscapeCase();
    const secondPath: Point[] = [
      { x: 620.5, y: 200.5 },
      { x: 900.5, y: 500.5 },
    ];
    fingerStroke(
      turned,
      landscape,
      secondPath.map((point) => screenPointOf(landscape, point)),
    );

    const direct = openOn(new RecordingStorage(), regions);
    prepareTool(direct, 'stripes', BLUE);
    paint(direct, LAYER_PATH);
    paint(direct, secondPath);
    expect(differingPixels(pixelsOf(turned, regions), pixelsOf(direct, regions))).toBe(0);
  });
});

describe('#111 AC5: otočení zařízení během malování', () => {
  it('otočení telefonu během tahu ukončí tah tam, kam došel, a namalované zůstane', () => {
    const regions = halves();
    const game = openOn(new RecordingStorage(), regions);
    const portrait = portraitCase();
    const before = lineOf(
      screenPointOf(portrait, { x: 100.5, y: 200.5 }),
      screenPointOf(portrait, { x: 300.5, y: 200.5 }),
      10,
    );
    fingerDown(game, portrait, before);
    const painted = pixelsOf(game, regions);
    expect(coloredCount(painted), 'tah před otočením něco namaloval').toBeGreaterThan(0);

    game.interrupt();
    // Po otočení má okno jiné rozložení, prst se dál pohne po obrazovce.
    const landscape = landscapeCase();
    const after = touchedLayerPoint(landscape, screenPointOf(landscape, { x: 300.5, y: 600.5 }));
    game.pointerMove({ id: 1, x: after.x, y: after.y, kind: 'touch' });
    game.pointerUp(1);

    expect(differingPixels(pixelsOf(game, regions), painted), 'tah po otočení nepokračuje').toBe(0);
  });

  it('po otočení během tahu vrátí Zpět právě ten přerušený tah', () => {
    const regions = halves();
    const game = openOn(new RecordingStorage(), regions);
    const portrait = portraitCase();
    paint(game, [
      { x: 600.5, y: 100.5 },
      { x: 900.5, y: 100.5 },
    ]);
    const beforeStroke = pixelsOf(game, regions);
    fingerDown(game, portrait, [
      screenPointOf(portrait, { x: 100.5, y: 400.5 }),
      screenPointOf(portrait, { x: 400.5, y: 400.5 }),
    ]);
    game.interrupt();
    expect(
      differingPixels(pixelsOf(game, regions), beforeStroke),
      'tah něco namaloval',
    ).toBeGreaterThan(0);

    expect(game.tapUndo().kind, 'Zpět').toBe('undone');
    expect(differingPixels(pixelsOf(game, regions), beforeStroke), 'po Zpět').toBe(0);
  });

  it('další tah po otočení jde zase přesně pod prstem', () => {
    const regions = halves();
    const game = openOn(new RecordingStorage(), regions);
    const portrait = portraitCase();
    startStroke(game, [
      touchedLayerPoint(portrait, screenPointOf(portrait, { x: 100.5, y: 100.5 })),
      touchedLayerPoint(portrait, screenPointOf(portrait, { x: 200.5, y: 100.5 })),
    ]);
    game.interrupt();

    const landscape = landscapeCase();
    const target: Point = { x: 800.5, y: 600.5 };
    expect(game.colorAt(800, 600), 'místo je před tahem prázdné').toBeNull();
    fingerStroke(game, landscape, [
      screenPointOf(landscape, target),
      screenPointOf(landscape, { x: 820.5, y: 600.5 }),
    ]);
    expect(game.colorAt(800, 600), 'tah na šířku zabarvil místo pod prstem').not.toBeNull();
    expect(game.colorAt(600, 600), 'stejně daleko vedle tahu nic').toBeNull();
  });

  it('panel zůstane po otočení zavřený, v kroku nástrojů nebo v kroku barev jako před ním', () => {
    const setups: ReadonlyArray<[PanelView, (game: SavedColoring) => void]> = [
      [
        'closed',
        (game) => {
          if (game.panelOpen()) {
            game.tapHandle();
          }
        },
      ],
      ['tools', (game) => openToolStep(game)],
      [
        'colors',
        (game) => {
          openToolStep(game);
          choose(game, 'brush');
        },
      ],
    ];
    for (const [view, open] of setups) {
      const game = openOn(new RecordingStorage(), halves());
      open(game);
      expect(game.panelView(), `${view}: před otočením`).toBe(view);
      game.interrupt();
      expect(game.panelView(), `${view}: po otočení`).toBe(view);
    }
  });
});

describe('#111 AC5: obrázek uložený před #111 se otevře beze změny', () => {
  function legacyStorage(): RecordingStorage {
    const storage = new RecordingStorage();
    for (const [key, value] of LEGACY_BEFORE_111_STORAGE) {
      storage.data.set(key, value);
    }
    return storage;
  }

  it('pevný záznam se otevře pixel po pixelu stejně, s nedávnými barvami, velikostí a barvami nástrojů', () => {
    const regions = legacyBefore111Regions();
    const game = openOn(legacyStorage(), regions);
    expect(differingPixels(pixelsOf(game, regions), legacyBefore111Pixels()), 'pixely').toBe(0);
    expect(game.recentColors(), 'nedávné barvy').toEqual(LEGACY_BEFORE_111_RECENT_COLORS);
    expect(game.lineSize(), 'velikost čáry').toBe(LEGACY_BEFORE_111_LINE_SIZE);
    for (const tool of PANEL_TOOLS) {
      expect(game.toolColor(tool), `barva nástroje ${tool}`).toBe(
        LEGACY_BEFORE_111_TOOL_COLORS[tool],
      );
    }
  });

  it('otevření a odchod bez malování uložený obrázek nezmění', () => {
    const regions = legacyBefore111Regions();
    const storage = legacyStorage();
    const game = openOn(storage, regions);
    game.suspend();
    expect([...storage.data.entries()].sort()).toEqual([...LEGACY_BEFORE_111_STORAGE].sort());
  });
});
