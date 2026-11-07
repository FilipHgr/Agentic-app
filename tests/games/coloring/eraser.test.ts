import { describe, expect, it } from 'vitest';

import { brushWidthFor } from '../../../src/games/coloring/logic/coloring';
import { OUTLINE_REGION, regionAt } from '../../../src/games/coloring/logic/regionMap';
import type { RegionMap } from '../../../src/games/coloring/logic/regionMap';
import type { SavedColoring } from '../../../src/games/coloring/logic/savedPicture';
import { PANEL_TOOLS, markedTools } from '../../../src/games/coloring/logic/toolPanel';
import type { ToolId } from '../../../src/games/coloring/logic/toolPanel';
import type { Tone } from '../../../src/shared/audio/tonePlayer';
import { openProfiles } from '../../../src/shared/storage/profileStorage';
import { DeviceStorage } from '../../shared/profileFixtures';
import {
  INSIDE_TOLERANCE,
  OUTSIDE_TOLERANCE,
  TEST_HEIGHT,
  TEST_WIDTH,
  centerOf,
  distanceToPath,
} from './outlineFixtures';
import type { Point } from './outlineFixtures';
import { at } from './strokeHelpers';
import {
  RecordingStorage,
  enterColoring,
  openOn,
  paint,
  paintedPixels,
  pixelsOf,
  startStroke,
  twoHalves,
} from './savedPictureHelpers';

/**
 * Testy k #90 (guma v Omalovánkách) v upraveném znění AC1, AC3 a AC5
 * z komentáře k issue: AC1 volba nástroje v panelu z #96 a úchyt, AC2
 * stopa gumy, AC3 okrajové případy, AC4 Zpět a výběr barvy po gumě.
 * Rozložení (AC5) je v `eraserLayoutRules.test.ts`.
 *
 * Zkušební obrázek je `twoHalves()` 300 × 200 px: svislá čára x 150 a 151
 * dělí plochu na oblast A vlevo a B vpravo. Šířka stopy štětce je
 * W = 300 / 30 = 10 px, guma je široká 1,5 W = 15 px. Měří se jako u štětce
 * (#88): vygumuje se každý pixel oblasti tahu se středem nejvýš 1,5 W / 2
 * od čáry tahu (rezerva 0,5 px na pixely) a nic dál než 1,5 W / 2 + 1 px.
 *
 * Ťuknutí na místo nástroje v panelu hlásí scéna jako
 * `game.tapTool(index)`, kde `index` je `touchTargetAt(…).index` u
 * `{ kind: 'tool' }`, tedy pořadí místa v `toolSlots`. Druhý prst během
 * tahu je ťuknutí na ovládání, zatímco první prst ještě nezvedl
 * (`startStroke` bez `pointerUp`).
 *
 * Navržené rozhraní:
 * - `src/games/coloring/logic/toolPanel.ts`:
 *   - `ToolId = 'brush' | 'eraser'`,
 *   - `PANEL_TOOLS: readonly ToolId[]` nástroje podle míst v panelu
 *     (`['brush', 'eraser']`, místo `i` je `toolSlots[i]`),
 *   - `markedTools(selected: ToolId): readonly boolean[]` u každého
 *     nástroje z `PANEL_TOOLS`, jestli je označený,
 *   - `HandleView` u gumy `{ tool: 'eraser', color: null }`.
 * - `src/games/coloring/logic/savedPicture.ts`, nová pole `SavedColoring`:
 *   - `selectedTool(): ToolId` vybraný nástroj,
 *   - `tapTool(index: number): readonly Tone[]` ťuknutí na místo nástroje:
 *     vybere nástroj a vrátí tón; prázdné místo a ťuknutí během tahu nic
 *     nezmění a vrátí `[]`,
 *   - `tapColor` během tahu nic nezmění a vrátí `[]` (nově, AC3),
 *   - `tapColor` po gumě přepne na štětec (AC4),
 *   - `pointerDown`, `pointerMove` gumují, když je vybraná guma.
 */

const RED = 0;
const ORANGE = 1;
const BLUE = 4;
const BLACK = 7;

/** Šířka stopy štětce W na zkušebním obrázku (10 px). */
const BRUSH_WIDTH = brushWidthFor(TEST_WIDTH);

/** Guma má poloměr 1,5 W / 2 (7,5 px). */
const ERASER_RADIUS = (1.5 * BRUSH_WIDTH) / 2;

/** Nejvýš tolik problémů se vypíše, aby zpráva zůstala čitelná. */
const MAX_PROBLEMS = 5;

const BRUSH_SLOT = PANEL_TOOLS.indexOf('brush');
const ERASER_SLOT = PANEL_TOOLS.indexOf('eraser');

/** Kdy dozní poslední tón, v sekundách od ťuknutí. */
function endOf(tones: readonly Tone[]): number {
  return Math.max(...tones.map((tone) => tone.startSeconds + tone.durationSeconds));
}

function chooseEraser(game: SavedColoring): readonly Tone[] {
  return game.tapTool(ERASER_SLOT);
}

function chooseBrush(game: SavedColoring): readonly Tone[] {
  return game.tapTool(BRUSH_SLOT);
}

function limited(problems: string[]): string[] {
  return problems.length > MAX_PROBLEMS
    ? [...problems.slice(0, MAX_PROBLEMS), `… a dalších ${problems.length - MAX_PROBLEMS}`]
    : problems;
}

function* allPixels(regions: RegionMap): Generator<[number, number]> {
  for (let y = 0; y < regions.height; y += 1) {
    for (let x = 0; x < regions.width; x += 1) {
      yield [x, y];
    }
  }
}

/** Oblast A vlevo a B vpravo od čáry. */
function regionsOf(regions: RegionMap): { regionA: number; regionB: number } {
  return {
    regionA: regionAt(regions, 10, 10) as number,
    regionB: regionAt(regions, 290, 10) as number,
  };
}

/** Celou oblast A (vlevo) nebo B (vpravo) vybarví barvou `color` vodorovnými tahy. */
function fillHalf(game: SavedColoring, half: 'A' | 'B', color: number): void {
  game.tapColor(color);
  const [from, to] = half === 'A' ? [2, 148] : [154, 298];
  for (let y = 0; y < TEST_HEIGHT; y += 4) {
    paint(game, [at(from, y), at(to, y)]);
  }
}

/** Obrázek s vybarvenými oběma oblastmi: A oranžová, B modrá. */
function filledPicture(): { game: SavedColoring; regions: RegionMap; storage: RecordingStorage } {
  const storage = new RecordingStorage();
  const regions = twoHalves();
  const game = openOn(storage, regions);
  fillHalf(game, 'A', ORANGE);
  fillHalf(game, 'B', BLUE);
  return { game, regions, storage };
}

/** Pixely oblasti `region` u čáry `path` (do 1,5 W / 2), které nejsou prázdné. */
function notErased(
  game: SavedColoring,
  regions: RegionMap,
  path: readonly Point[],
  region: number,
): string[] {
  const reach = ERASER_RADIUS - INSIDE_TOLERANCE;
  const problems: string[] = [];
  for (const [x, y] of allPixels(regions)) {
    if (regionAt(regions, x, y) !== region) {
      continue;
    }
    const distance = distanceToPath(centerOf(x, y), path);
    if (distance <= reach && game.colorAt(x, y) !== null) {
      problems.push(
        `pixel (${x}, ${y}) ${distance.toFixed(2)} px od čáry má ${String(game.colorAt(x, y))}`,
      );
    }
  }
  return limited(problems);
}

/** Pixely dál než 1,5 W / 2 + 1 px od čáry, které guma vzala, ač byly vybarvené. */
function erasedTooFar(
  game: SavedColoring,
  regions: RegionMap,
  before: ReadonlyArray<number | null>,
  path: readonly Point[],
): string[] {
  const limit = ERASER_RADIUS + OUTSIDE_TOLERANCE;
  const problems: string[] = [];
  for (const [x, y] of allPixels(regions)) {
    const index = y * regions.width + x;
    if (before[index] === null || game.colorAt(x, y) !== null) {
      continue;
    }
    const distance = distanceToPath(centerOf(x, y), path);
    if (distance > limit) {
      problems.push(`pixel (${x}, ${y}) ${distance.toFixed(2)} px od čáry je vygumovaný`);
    }
  }
  return limited(problems);
}

/** Pixely oblasti `region`, které se proti `before` změnily. */
function changedInRegion(
  game: SavedColoring,
  regions: RegionMap,
  before: ReadonlyArray<number | null>,
  region: number,
): string[] {
  const problems: string[] = [];
  for (const [x, y] of allPixels(regions)) {
    if (regionAt(regions, x, y) !== region) {
      continue;
    }
    const was = before[y * regions.width + x] ?? null;
    if (game.colorAt(x, y) !== was) {
      problems.push(`pixel (${x}, ${y}) byl ${String(was)}, je ${String(game.colorAt(x, y))}`);
    }
  }
  return limited(problems);
}

/** Gumování: dotyk, pohyb po `path` a zvednutí prstu. */
function erase(game: SavedColoring, path: readonly Point[]): void {
  chooseEraser(game);
  paint(game, path);
}

describe('#90 AC1: volba nástroje v panelu', () => {
  it('v panelu je štětec na prvním místě nástrojů a guma hned za ním', () => {
    expect(PANEL_TOOLS[0]).toBe('brush');
    expect(PANEL_TOOLS[1]).toBe('eraser');
  });

  it('na začátku je vybraný štětec', () => {
    const game = openOn(new RecordingStorage(), twoHalves());
    expect(game.selectedTool()).toBe('brush');
  });

  it('ťuknutí na gumu ji hned vybere a zazní tón kratší než 1 s', () => {
    const game = openOn(new RecordingStorage(), twoHalves());

    const tones = chooseEraser(game);

    expect(game.selectedTool()).toBe('eraser');
    expect(tones.length, 'nějaký tón zazní').toBeGreaterThan(0);
    expect(endOf(tones), 'délka tónu v sekundách').toBeLessThan(1);
  });

  it('ťuknutí na štětec po gumě vybere zase štětec s tónem kratším než 1 s', () => {
    const game = openOn(new RecordingStorage(), twoHalves());
    chooseEraser(game);

    const tones = chooseBrush(game);

    expect(game.selectedTool()).toBe('brush');
    expect(tones.length, 'nějaký tón zazní').toBeGreaterThan(0);
    expect(endOf(tones), 'délka tónu v sekundách').toBeLessThan(1);
  });

  it('ťuknutí na už vybraný nástroj ho nechá vybraný a tón zazní taky', () => {
    const game = openOn(new RecordingStorage(), twoHalves());
    for (const tool of ['brush', 'eraser'] as const) {
      game.tapTool(PANEL_TOOLS.indexOf(tool));
      const tones = game.tapTool(PANEL_TOOLS.indexOf(tool));
      expect(game.selectedTool(), `${tool} podruhé`).toBe(tool);
      expect(tones.length, `${tool} podruhé: tón`).toBeGreaterThan(0);
      expect(endOf(tones), `${tool} podruhé: délka tónu`).toBeLessThan(1);
    }
  });

  it('označený je po každém ťuknutí právě jeden nástroj, ten vybraný', () => {
    const game = openOn(new RecordingStorage(), twoHalves());
    const taps: ToolId[] = ['eraser', 'eraser', 'brush', 'eraser', 'brush', 'brush'];
    const check = (step: string): void => {
      const marked = markedTools(game.selectedTool());
      expect(marked.length, `${step}: u každého nástroje údaj`).toBe(PANEL_TOOLS.length);
      expect(marked.filter(Boolean).length, `${step}: označených`).toBe(1);
      expect(marked[PANEL_TOOLS.indexOf(game.selectedTool())], `${step}: označený vybraný`).toBe(
        true,
      );
    };
    check('na začátku');
    taps.forEach((tool, step) => {
      game.tapTool(PANEL_TOOLS.indexOf(tool));
      expect(game.selectedTool(), `ťuknutí ${step + 1}`).toBe(tool);
      check(`ťuknutí ${step + 1} (${tool})`);
    });
  });

  it('ťuknutí na prázdné místo pro další nástroj nic nezmění a nezazní', () => {
    const game = openOn(new RecordingStorage(), twoHalves());
    chooseEraser(game);
    for (let slot = PANEL_TOOLS.length; slot < 10; slot += 1) {
      expect(game.tapTool(slot), `místo ${slot + 1}`).toEqual([]);
      expect(game.selectedTool(), `místo ${slot + 1}`).toBe('eraser');
    }
  });

  it('volba nástroje nezmění vybranou barvu', () => {
    const game = openOn(new RecordingStorage(), twoHalves());
    game.tapColor(BLUE);
    chooseEraser(game);
    expect(game.palette().selected, 's gumou').toBe(BLUE);
    chooseBrush(game);
    expect(game.palette().selected, 'zpátky se štětcem').toBe(BLUE);
  });

  it('po návratu z menu je vybraný štětec, i když dítě odešlo s gumou, a barva zůstane', () => {
    const storage = new RecordingStorage();
    const regions = twoHalves();
    const game = openOn(storage, regions);
    game.tapColor(BLACK);
    chooseEraser(game);
    game.suspend();

    const again = openOn(storage, regions);
    expect(again.selectedTool()).toBe('brush');
    expect(again.palette().selected, 'barva se pamatuje').toBe(BLACK);
    paint(again, [at(20, 100), at(130, 100)]);
    expect(again.colorAt(70, 100), 'první tah po návratu maluje').toBe(BLACK);
  });

  it('po obnovení stránky je vybraný štětec', () => {
    const storage = new DeviceStorage();
    const regions = twoHalves();
    const game = enterColoring(openProfiles(storage), regions);
    chooseEraser(game);
    paint(game, [at(20, 100)]);
    game.suspend();

    expect(enterColoring(openProfiles(storage), regions).selectedTool()).toBe('brush');
  });

  it('úchyt ukazuje gumu bez barvy a po návratu ke štětci štětec ve vybrané barvě', () => {
    const game = openOn(new RecordingStorage(), twoHalves());
    game.tapColor(BLUE);

    chooseEraser(game);
    expect(game.handleView(), 'guma').toEqual({ tool: 'eraser', color: null });

    chooseBrush(game);
    expect(game.handleView(), 'štětec').toEqual({ tool: 'brush', color: BLUE });
  });

  it('úchyt ukazuje gumu bez barvy i se zavřeným panelem', () => {
    const game = openOn(new RecordingStorage(), twoHalves());
    chooseEraser(game);
    game.tapHandle();
    expect(game.panelOpen()).toBe(false);
    expect(game.handleView()).toEqual({ tool: 'eraser', color: null });
  });
});

describe('#90 AC2: stopa gumy', () => {
  it('guma vrátí pixely u čáry do prázdna v šířce 1,5 W a dál nic nevezme', () => {
    const { game, regions } = filledPicture();
    const { regionA } = regionsOf(regions);
    const before = pixelsOf(game, regions);
    const path = [at(30, 40), at(110, 60), at(60, 150)];

    erase(game, path);

    expect(notErased(game, regions, path, regionA), 'nevygumované u čáry').toEqual([]);
    expect(erasedTooFar(game, regions, before, path), 'vygumované daleko').toEqual([]);
  });

  it('guma je širší než štětec: vezme i pixel, kam by stopa štětce nedosáhla', () => {
    const { game } = filledPicture();
    erase(game, [at(20, 100), at(130, 100)]);

    // Střed pixelu 6,5 px od čáry: štětec (W/2 = 5 px) sem nedosáhne, guma (7,5 px) ano.
    expect(game.colorAt(70, 106)).toBeNull();
    expect(game.colorAt(70, 93)).toBeNull();
  });

  it('ťuknutí gumou vygumuje kulatou tečku, ne čtverec', () => {
    const { game, regions } = filledPicture();
    const { regionA } = regionsOf(regions);
    const before = pixelsOf(game, regions);
    const tap = [at(70.5, 100.5)];

    erase(game, tap);

    expect(notErased(game, regions, tap, regionA), 'nevygumované v tečce').toEqual([]);
    expect(erasedTooFar(game, regions, before, tap), 'vygumované mimo tečku').toEqual([]);
    expect(game.colorAt(77, 107), 'roh čtverce kolem tečky zůstane').toBe(ORANGE);
    expect(game.colorAt(63, 93), 'roh čtverce kolem tečky zůstane').toBe(ORANGE);
  });

  it('i rychlý tah s body daleko od sebe gumuje souvisle bez mezer', () => {
    const { game, regions } = filledPicture();
    const { regionA } = regionsOf(regions);
    const path = [at(10, 10), at(140, 190)];

    erase(game, path);

    expect(notErased(game, regions, path, regionA)).toEqual([]);
  });

  it('guma dosáhne až k obrysu a vedlejší oblast nechá celou', () => {
    const { game, regions } = filledPicture();
    const { regionA, regionB } = regionsOf(regions);
    const before = pixelsOf(game, regions);
    const path = [at(145, 10), at(145, 190)];

    erase(game, path);

    expect(notErased(game, regions, path, regionA), 'u obrysu v oblasti A').toEqual([]);
    for (let y = 10; y <= 190; y += 10) {
      expect(game.colorAt(149, y), `pixel u obrysu (149, ${y})`).toBeNull();
    }
    expect(changedInRegion(game, regions, before, regionB), 'oblast B').toEqual([]);
  });

  it('guma tažená přes obrys do vedlejší oblasti gumuje dál jen oblast, kde tah začal', () => {
    const { game, regions } = filledPicture();
    const { regionA, regionB } = regionsOf(regions);
    const before = pixelsOf(game, regions);
    const path = [at(100, 100), at(250, 100), at(250, 40), at(60, 40)];

    erase(game, path);

    expect(changedInRegion(game, regions, before, regionB), 'oblast B').toEqual([]);
    expect(notErased(game, regions, [at(100, 100), at(148, 100)], regionA), 'začátek v A').toEqual(
      [],
    );
    expect(notErased(game, regions, [at(148, 40), at(60, 40)], regionA), 'návrat do A').toEqual([]);
  });

  it('obrys vygumovat nejde: po gumování přes obrys barva štětce dál nepřeteče', () => {
    const { game, regions } = filledPicture();
    const { regionB } = regionsOf(regions);
    erase(game, [at(150.5, 20), at(150.5, 180), at(100, 100), at(200, 100)]);
    for (let y = 0; y < TEST_HEIGHT; y += 10) {
      expect(regionAt(regions, 150, y), `obrys v (150, ${y})`).toBe(OUTLINE_REGION);
    }
    const afterEraser = pixelsOf(game, regions);

    game.tapColor(BLACK);
    paint(game, [at(100, 150), at(250, 150)]);

    expect(changedInRegion(game, regions, afterEraser, regionB), 'oblast B').toEqual([]);
  });

  it('vygumované místo je prázdné i po návratu do hry a jde na něj znovu malovat', () => {
    const { game, regions, storage } = filledPicture();
    erase(game, [at(20, 100), at(130, 100)]);
    const erased = pixelsOf(game, regions);
    game.suspend();

    const again = openOn(storage, regions);
    expect(pixelsOf(again, regions), 'obrázek po návratu').toEqual(erased);
    expect(again.colorAt(70, 100)).toBeNull();

    again.tapColor(RED);
    paint(again, [at(20, 100), at(130, 100)]);
    expect(again.colorAt(70, 100), 'znovu namalované').toBe(RED);
  });
});

describe('#90 AC3: okrajové případy gumy', () => {
  it('guma začatá na obrysu a tažená doprava gumuje jen oblast B', () => {
    const { game, regions } = filledPicture();
    const { regionA, regionB } = regionsOf(regions);
    const before = pixelsOf(game, regions);
    const path = [at(150.5, 100), at(200, 100), at(260, 60)];

    erase(game, path);

    expect(changedInRegion(game, regions, before, regionA), 'oblast A').toEqual([]);
    expect(notErased(game, regions, path, regionB), 'oblast B u čáry').toEqual([]);
  });

  it('guma začatá na obrysu a tažená doleva gumuje jen oblast A, i když pak přejede do B', () => {
    const { game, regions } = filledPicture();
    const { regionB } = regionsOf(regions);
    const before = pixelsOf(game, regions);

    erase(game, [at(150.5, 100), at(150.5, 140), at(90, 140), at(260, 60)]);

    expect(changedInRegion(game, regions, before, regionB), 'oblast B').toEqual([]);
    expect(game.colorAt(90, 140), 'oblast A').toBeNull();
  });

  it('guma na prázdném místě nic nezmění a Zpět pak vrátí předchozí tah štětcem', () => {
    const regions = twoHalves();
    const game = openOn(new RecordingStorage(), regions);
    paint(game, [at(20, 100), at(130, 100)]);
    const painted = pixelsOf(game, regions);

    erase(game, [at(170, 30), at(290, 170)]);
    expect(pixelsOf(game, regions), 'obrázek po gumě na prázdném místě').toEqual(painted);

    expect(game.tapUndo().kind).toBe('undone');
    expect(paintedPixels(game, regions), 'Zpět vrátil tah štětcem').toBe(0);
  });

  it('guma na prázdném obrázku se do historie nepočítá: Zpět se jen zhoupne', () => {
    const regions = twoHalves();
    const game = openOn(new RecordingStorage(), regions);

    erase(game, [at(20, 100), at(280, 100)]);
    erase(game, [at(70, 70)]);

    expect(game.tapUndo().kind).toBe('wobble');
  });

  it('guma jen po obrysu nebo začatá mimo obrázek nic nezmění a do historie se nepočítá', () => {
    const { game, regions } = filledPicture();
    const filled = pixelsOf(game, regions);
    expect(regionAt(regions, 150, 100), 'tah vede po obrysu').toBe(OUTLINE_REGION);

    erase(game, [at(150.5, 20), at(150.5, 180)]);
    erase(game, [at(-20, 100), at(100, 100), at(250, 100)]);
    expect(pixelsOf(game, regions), 'obrázek beze změny').toEqual(filled);

    expect(game.tapUndo().kind, 'Zpět vrátí poslední tah štětcem').toBe('undone');
    expect(pixelsOf(game, regions), 'Zpět vrátil štětec, ne gumu').not.toEqual(filled);
  });

  it('druhé gumování už vygumovaného místa se do historie nepočítá', () => {
    const { game, regions } = filledPicture();
    const filled = pixelsOf(game, regions);
    const path = [at(20, 100), at(130, 100)];
    erase(game, path);
    erase(game, path);

    expect(game.tapUndo().kind).toBe('undone');

    expect(pixelsOf(game, regions), 'jedno Zpět vrátí celé gumování').toEqual(filled);
  });

  it('ťuknutí druhým prstem na gumu během tahu štětcem se nepočítá a štětec maluje dál', () => {
    const regions = twoHalves();
    const game = openOn(new RecordingStorage(), regions);
    startStroke(game, [at(20, 40), at(60, 40)]);

    expect(chooseEraser(game), 'během tahu žádný tón').toEqual([]);
    expect(game.selectedTool()).toBe('brush');
    expect(game.handleView()).toEqual({ tool: 'brush', color: RED });

    game.pointerMove({ id: 1, x: 140, y: 40, kind: 'touch' });
    game.pointerUp(1);
    expect(game.colorAt(130, 40), 'tah pokračoval štětcem').toBe(RED);
  });

  it('ťuknutí druhým prstem na štětec během gumování se nepočítá a guma gumuje dál', () => {
    const { game } = filledPicture();
    chooseEraser(game);
    startStroke(game, [at(20, 40), at(60, 40)]);

    expect(chooseBrush(game), 'během tahu žádný tón').toEqual([]);
    expect(game.selectedTool()).toBe('eraser');

    game.pointerMove({ id: 1, x: 140, y: 40, kind: 'touch' });
    game.pointerUp(1);
    expect(game.colorAt(130, 40), 'tah pokračoval gumou').toBeNull();
  });

  it('ťuknutí druhým prstem na barvu během gumování se nepočítá: guma zůstane a barva taky', () => {
    const { game } = filledPicture();
    chooseEraser(game);
    const colorBefore = game.palette().selected;
    startStroke(game, [at(20, 40), at(60, 40)]);

    expect(game.tapColor(BLACK), 'během tahu žádný tón').toEqual([]);
    expect(game.palette().selected, 'barva se nezměnila').toBe(colorBefore);
    expect(game.selectedTool(), 'guma zůstala').toBe('eraser');

    game.pointerMove({ id: 1, x: 140, y: 40, kind: 'touch' });
    game.pointerUp(1);
    expect(game.colorAt(130, 40), 'tah pokračoval gumou').toBeNull();
    expect(game.handleView()).toEqual({ tool: 'eraser', color: null });
  });

  it('ťuknutí druhým prstem na barvu během tahu štětcem se nepočítá a barva zůstane', () => {
    const regions = twoHalves();
    const game = openOn(new RecordingStorage(), regions);
    startStroke(game, [at(20, 40), at(60, 40)]);

    expect(game.tapColor(BLUE), 'během tahu žádný tón').toEqual([]);
    expect(game.palette().selected).toBe(RED);

    game.pointerMove({ id: 1, x: 140, y: 40, kind: 'touch' });
    game.pointerUp(1);
    expect(game.colorAt(130, 40), 'tah pokračoval původní barvou').toBe(RED);
  });

  it('ťuknutí druhým prstem na úchyt během gumování se nepočítá a guma gumuje dál', () => {
    const { game } = filledPicture();
    chooseEraser(game);
    startStroke(game, [at(20, 40), at(60, 40)]);
    const panelOpen = game.panelOpen();

    expect(game.tapHandle(), 'během tahu žádný tón').toEqual([]);
    expect(game.panelOpen(), 'panel beze změny').toBe(panelOpen);

    game.pointerMove({ id: 1, x: 140, y: 40, kind: 'touch' });
    game.pointerUp(1);
    expect(game.colorAt(130, 40), 'tah pokračoval gumou').toBeNull();
  });

  it('ťuknutí druhým prstem na Zpět během gumování se nepočítá a guma gumuje dál', () => {
    const { game, regions } = filledPicture();
    const filled = pixelsOf(game, regions);
    chooseEraser(game);
    startStroke(game, [at(20, 40), at(60, 40)]);

    expect(game.tapUndo().kind).toBe('ignored');

    game.pointerMove({ id: 1, x: 140, y: 40, kind: 'touch' });
    game.pointerUp(1);
    expect(game.colorAt(130, 40), 'tah pokračoval gumou').toBeNull();
    expect(game.tapUndo().kind).toBe('undone');
    expect(pixelsOf(game, regions), 'Zpět vrátí celé gumování').toEqual(filled);
  });
});

describe('#90 AC4: Zpět po gumě a výběr barvy po gumě', () => {
  it('Zpět vrátí tah gumou pixel po pixelu, i přes několik barev', () => {
    const regions = twoHalves();
    const game = openOn(new RecordingStorage(), regions);
    fillHalf(game, 'A', ORANGE);
    game.tapColor(BLUE);
    paint(game, [at(70, 10), at(70, 190)]);
    game.tapColor(BLACK);
    paint(game, [at(10, 60), at(140, 120)]);
    const beforeEraser = pixelsOf(game, regions);

    erase(game, [at(20, 20), at(130, 180), at(130, 20), at(20, 180)]);
    expect(pixelsOf(game, regions), 'guma něco vzala').not.toEqual(beforeEraser);

    expect(game.tapUndo().kind).toBe('undone');
    expect(pixelsOf(game, regions)).toEqual(beforeEraser);
  });

  it('dvě gumování vrátí dvě Zpět postupně, každé do stavu před ním', () => {
    const { game, regions } = filledPicture();
    const filled = pixelsOf(game, regions);
    erase(game, [at(20, 50), at(130, 50)]);
    const afterFirst = pixelsOf(game, regions);
    erase(game, [at(200, 150), at(280, 150)]);

    game.tapUndo();
    expect(pixelsOf(game, regions), 'po prvním Zpět').toEqual(afterFirst);
    game.tapUndo();
    expect(pixelsOf(game, regions), 'po druhém Zpět').toEqual(filled);
  });

  it('výběr barvy po gumě přepne na štětec a další tah maluje vybranou barvou', () => {
    const regions = twoHalves();
    const game = openOn(new RecordingStorage(), regions);
    chooseEraser(game);

    const tones = game.tapColor(BLUE);

    expect(game.selectedTool()).toBe('brush');
    expect(game.palette().selected).toBe(BLUE);
    expect(tones.length, 'tón výběru barvy').toBeGreaterThan(0);
    expect(game.handleView()).toEqual({ tool: 'brush', color: BLUE });
    expect(markedTools(game.selectedTool())[BRUSH_SLOT], 'označený štětec').toBe(true);
    paint(game, [at(20, 100), at(130, 100)]);
    expect(game.colorAt(70, 100)).toBe(BLUE);
  });

  it('výběr už vybrané barvy po gumě taky přepne na štětec', () => {
    const regions = twoHalves();
    const game = openOn(new RecordingStorage(), regions);
    game.tapColor(BLUE);
    chooseEraser(game);

    game.tapColor(BLUE);

    expect(game.selectedTool()).toBe('brush');
    paint(game, [at(20, 100), at(130, 100)]);
    expect(game.colorAt(70, 100)).toBe(BLUE);
  });
});
