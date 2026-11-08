import { describe, expect, it } from 'vitest';

import { decodePicture } from '../../../src/games/coloring/logic/savedPicture';
import type { SavedColoring } from '../../../src/games/coloring/logic/savedPicture';
import { markedColors } from '../../../src/games/coloring/logic/palette';
import { PANEL_TOOLS, markedTools } from '../../../src/games/coloring/logic/toolPanel';
import type { PanelView, ToolId } from '../../../src/games/coloring/logic/toolPanel';
import type { Tone } from '../../../src/shared/audio/tonePlayer';
import { openProfiles } from '../../../src/shared/storage/profileStorage';
import { DeviceStorage } from '../../shared/profileFixtures';
import { choose, slotOf } from './drawingToolHelpers';
import {
  LEGACY_P3_GLITTER_LINE_SIZE,
  LEGACY_P3_GLITTER_RECENT_COLORS,
  LEGACY_P3_GLITTER_SELECTED_COLOR,
  LEGACY_P3_GLITTER_STORAGE,
  legacyP3GlitterPixels,
  legacyP3GlitterRegions,
} from './legacyP3GlitterRecordFixture';
import { TOOL_NAMES } from './lineSizeHelpers';
import { DEFAULT_TOOL_COLORS, defaultsWithBrush, isColorTool } from './toolColorsHelpers';
import { choiceOf, expectedAfterPick, pick, seededRandom } from './recentColorsHelpers';
import { at } from './strokeHelpers';
import {
  PICTURE,
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
 * Testy chování k #105 (panel Omalovánek ve dvou krocích: nejdřív nástroj,
 * pak barva) z pohledu hráče, AC1 až AC5. Rozložení obou kroků a to, kam
 * v kterém kroku patří dotyk (AC6, prázdná místa a mezery z AC5), jsou
 * v `panelStepsLayoutRules.test.ts`. AC7 je ruční kontrola.
 *
 * Doporučení story-revieweru z komentáře k issue jsou zohledněná takto:
 * - guma a duha: tón kratší než 1 s a úchyt bez barvy (AC4),
 * - už vybraná barva: tón, panel se zavře, barva ani nedávné barvy se
 *   nezmění (AC3),
 * - jedno ťuknutí udělá jen jednu věc: ťuknutí na nástroj nevybere barvu
 *   a návrat k nástrojům nezmění nástroj, barvu ani velikost (AC5);
 *   že scéna nepošle tentýž dotyk ještě do nově ukázaného kroku, je
 *   ruční kontrola,
 * - zavření úchytem nebo tahem platí stejně v obou krocích (AC4).
 *
 * Jedno „otevření hry“ je `openOn(…)` nad úložištěm hry profilu, „obnovení
 * stránky“ nové `openProfiles(storage)` (`savedPictureHelpers.ts`).
 * Ťuknutí scéna hlásí podle `touchTargetAt(…)`: úchyt `tapHandle()`,
 * nástroj `tapTool(i)`, barva `tapColor(i)`, vybraný nástroj v kroku
 * barev `tapBackToTools()`, nedávná barva `tapRecentColor(i)`, Zpět
 * `tapUndo()`, schování stránky a domeček `suspend()`.
 *
 * Navržené rozhraní (`SavedColoring` v `savedPicture.ts`, `toolPanel.ts`):
 * - `PanelView = 'closed' | 'tools' | 'colors'` (`toolPanel.ts`),
 * - `panelView(): PanelView` krok panelu; `panelOpen()` zůstává
 *   (`panelView() !== 'closed'`),
 * - `tapHandle()` zavřený panel otevře vždy na kroku nástrojů, otevřený
 *   (v kterémkoli kroku) zavře,
 * - `tapTool(i)` nástroj hned vybere a vrátí tón; nástroj s barvou
 *   přepne panel na krok barev, guma a duha panel zavřou,
 * - `tapColor(i)` barvu vybere, vrátí tón a panel zavře (i u už vybrané
 *   barvy, ta nic jiného nezmění),
 * - `tapBackToTools(): readonly Tone[]` nové: ťuknutí na vybraný nástroj
 *   na prvním místě kroku barev vrátí panel na krok nástrojů; nástroj,
 *   barva ani velikost se nezmění. Během tahu se nepočítá a vrátí `[]`.
 * Krok panelu se neukládá, záznamy v úložišti zůstávají beze změny.
 */

const RED = 0;
const YELLOW = 2;
const GREEN = 3;
const BLUE = 4;
const BLACK = 7;
const PINK = 8;

/** Nástroje, které malují vybranou barvou a mají krok barev (AC2). */
const COLOR_TOOLS: readonly ToolId[] = [
  'brush',
  'marker',
  'crayon',
  'stamp',
  'dots',
  'stripes',
  'glitter',
  'spray',
];

/** Nástroje bez kroku barev (AC4). */
const TOOLS_WITHOUT_COLOR: readonly ToolId[] = ['eraser', 'rainbow'];

/** Kdy dozní poslední tón, v sekundách od ťuknutí. */
function endOf(tones: readonly Tone[]): number {
  return Math.max(...tones.map((tone) => tone.startSeconds + tone.durationSeconds));
}

function expectShortTone(tones: readonly Tone[], what: string): void {
  expect(tones.length, `${what}: zazní tón`).toBeGreaterThan(0);
  expect(endOf(tones), `${what}: tón kratší než 1 s`).toBeLessThan(1);
}

/** Hra, kterou profil už otevřel: panel začíná zavřený. */
function returningGame(storage = new RecordingStorage()): SavedColoring {
  openOn(storage, twoHalves()).suspend();
  return openOn(storage, twoHalves());
}

/** Hra se zavřeným panelem a vybranou barvou `color`. */
function gameWithColor(color: number): SavedColoring {
  const game = returningGame();
  game.tapColor(color);
  return game;
}

/** Hra se zavřeným panelem otevřeným úchytem na krok nástrojů. */
function onToolStep(game: SavedColoring = returningGame()): SavedColoring {
  if (game.panelView() !== 'closed') {
    game.tapHandle();
  }
  game.tapHandle();
  expect(game.panelView(), 'panel připravený na kroku nástrojů').toBe('tools');
  return game;
}

/** Hra v kroku barev nástroje `tool`. */
function onColorStep(tool: ToolId = 'stamp', game: SavedColoring = onToolStep()): SavedColoring {
  choose(game, tool);
  expect(game.panelView(), `krok barev nástroje ${TOOL_NAMES[tool]}`).toBe('colors');
  return game;
}

/** Hra s panelem v kroku `step`. */
function inStep(step: PanelView, game: SavedColoring = returningGame()): SavedColoring {
  if (step === 'tools') {
    return onToolStep(game);
  }
  if (step === 'colors') {
    return onColorStep('stamp', onToolStep(game));
  }
  if (game.panelView() !== 'closed') {
    game.tapHandle();
  }
  return game;
}

/** Co dítě vidí z výběru: nástroj, barva, nedávné barvy a velikost. */
function selectionOf(game: SavedColoring): {
  tool: ToolId;
  color: number;
  recent: readonly (number | null)[];
  size: string;
} {
  return {
    tool: game.selectedTool(),
    color: game.palette().selected,
    recent: [...game.recentColors()],
    size: game.lineSize(),
  };
}

describe('#105 AC1: otevření panelu ukáže nástroje', () => {
  it('ťuknutí na úchyt otevře panel na kroku nástrojů s tónem kratším než 1 s', () => {
    const game = returningGame();
    expect(game.panelView(), 'po návratu zavřený').toBe('closed');

    const tones = game.tapHandle();

    expect(game.panelView()).toBe('tools');
    expect(game.panelOpen()).toBe(true);
    expectShortTone(tones, 'otevření');
  });

  it('panel se otevře na nástrojích, i když se naposledy zavřel v kroku barev', () => {
    const closings: Array<[string, (game: SavedColoring) => void]> = [
      ['úchytem', (game) => game.tapHandle()],
      ['výběrem barvy', (game) => game.tapColor(BLUE)],
      ['tahem po obrázku', (game) => paint(game, [at(20, 100), at(60, 100)])],
    ];
    for (const [how, close] of closings) {
      const game = onColorStep('marker');
      close(game);
      expect(game.panelView(), `zavřeno ${how}`).toBe('closed');

      game.tapHandle();

      expect(game.panelView(), `po zavření ${how}`).toBe('tools');
    }
  });

  it('v kroku nástrojů je označený právě vybraný nástroj', () => {
    for (const tool of PANEL_TOOLS) {
      const game = onToolStep();
      choose(game, tool);
      onToolStep(game);

      const marked = markedTools(game.selectedTool());
      expect(game.selectedTool(), TOOL_NAMES[tool]).toBe(tool);
      expect(
        marked.map((isMarked, index) => (isMarked ? index : -1)).filter((index) => index >= 0),
        `${TOOL_NAMES[tool]}: označené místo`,
      ).toEqual([slotOf(tool)]);
    }
  });

  it('při úplně prvním otevření hry v profilu je panel otevřený na kroku nástrojů', () => {
    const game = openOn(new RecordingStorage(), twoHalves());
    expect(game.panelView()).toBe('tools');
  });

  it('po návratu z menu začíná panel zavřený a úchyt ho otevře na nástrojích, i když dítě odešlo z kroku barev', () => {
    const storage = new RecordingStorage();
    const first = openOn(storage, twoHalves());
    onColorStep('crayon', first);
    first.suspend();

    const again = openOn(storage, twoHalves());
    expect(again.panelView(), 'po návratu').toBe('closed');
    again.tapHandle();
    expect(again.panelView(), 'po ťuknutí na úchyt').toBe('tools');
  });

  it('po obnovení stránky začíná panel zavřený a úchyt ho otevře na nástrojích', () => {
    const device = new DeviceStorage();
    const regions = twoHalves();
    const first = enterColoring(openProfiles(device), regions);
    onColorStep('glitter', first);
    first.suspend();

    const reloaded = enterColoring(openProfiles(device), regions);
    expect(reloaded.panelView(), 'po obnovení').toBe('closed');
    reloaded.tapHandle();
    expect(reloaded.panelView(), 'po ťuknutí na úchyt').toBe('tools');
  });
});

describe('#105 AC2: nástroj s barvou otevře krok barev', () => {
  // Upraveno k #110 AC1: dřív měl úchyt u každého nástroje barvu vybranou
  // u štětce. Od #110 má každý nástroj svou barvu (výchozí podle #110 AC5).
  it('ťuknutí na štětec, fix, pastelku, razítkový, puntíkový i proužkový fix, třpytky a sprej otevře krok barev', () => {
    const colors = defaultsWithBrush(GREEN);
    for (const tool of COLOR_TOOLS) {
      const game = onToolStep(gameWithColor(GREEN));

      const tones = game.tapTool(slotOf(tool));

      const name = TOOL_NAMES[tool];
      expect(game.selectedTool(), `${name}: vybraný hned`).toBe(tool);
      expectShortTone(tones, name);
      expect(game.handleView(), `${name}: úchyt v barvě nástroje`).toMatchObject({
        tool,
        color: isColorTool(tool) ? colors[tool] : null,
      });
      expect(game.panelView(), `${name}: krok barev`).toBe('colors');
    }
  });

  // Upraveno k #110 AC2: označená je barva nástroje, ke kterému se barva
  // vybírá, proto se barva dává puntíkovému fixu, ne štětci.
  it('v kroku barev je označená vybraná barva a na prvním místě vybraný nástroj', () => {
    for (const color of [RED, BLUE, PINK]) {
      const game = onColorStep('dots', onToolStep());
      game.tapColor(color);
      onColorStep('dots', onToolStep(game));

      expect(game.selectedTool(), 'nástroj na prvním místě').toBe('dots');
      const marked = markedColors(game.palette());
      expect(
        marked.map((isMarked, index) => (isMarked ? index : -1)).filter((index) => index >= 0),
        `označená barva ${color}`,
      ).toEqual([color]);
    }
  });

  it('ťuknutí na nástroj, který už vybraný je, také otevře krok barev s tónem', () => {
    for (const tool of COLOR_TOOLS) {
      const game = onColorStep(tool);
      game.tapBackToTools();
      expect(game.panelView(), `${TOOL_NAMES[tool]}: zpět na nástrojích`).toBe('tools');

      const tones = game.tapTool(slotOf(tool));

      expectShortTone(tones, `${TOOL_NAMES[tool]} znovu`);
      expect(game.selectedTool(), TOOL_NAMES[tool]).toBe(tool);
      expect(game.panelView(), `${TOOL_NAMES[tool]}: krok barev`).toBe('colors');
    }
  });

  it('štětec, který je vybraný od začátku, otevře krok barev', () => {
    const game = onToolStep();
    expect(game.selectedTool(), 'na začátku štětec').toBe('brush');

    expectShortTone(choose(game, 'brush'), 'štětec');
    expect(game.panelView()).toBe('colors');
  });
});

describe('#105 AC3: výběr barvy panel zavře', () => {
  it('ťuknutí na barvu v kroku barev ji vybere, zazní tón, nedávné barvy se změní podle #99 a panel se zavře', () => {
    for (const color of [BLUE, BLACK, YELLOW, PINK]) {
      const game = onColorStep('marker');
      const before = choiceOf(game);

      const tones = game.tapColor(color);

      expectShortTone(tones, `barva ${color}`);
      expect(choiceOf(game), `barva ${color}: vybraná a nedávné`).toEqual(
        expectedAfterPick(before, color),
      );
      expect(game.panelView(), `barva ${color}: panel zavřený`).toBe('closed');
      expect(game.handleView(), `barva ${color}: úchyt`).toMatchObject({ tool: 'marker', color });
    }
  });

  it('po výběru barvy se hned maluje vybraným nástrojem a novou barvou', () => {
    const regions = twoHalves();
    const game = onColorStep('brush');
    game.tapColor(BLUE);

    paint(game, [at(20, 100), at(140, 100)]);

    expect(game.colorAt(20, 100)).toBe(BLUE);
    expect(game.colorAt(140, 100)).toBe(BLUE);
    expect(paintedPixels(game, regions)).toBeGreaterThan(0);
  });

  // Upraveno k #110 AC7: modrou dostane razítkový fix ve svém kroku barev,
  // pak se mu znovu vybere tatáž barva.
  it('ťuknutí na už vybranou barvu panel zavře s tónem a barvu ani nedávné barvy nezmění', () => {
    const game = gameWithColor(PINK);
    onColorStep('stamp', onToolStep(game));
    game.tapColor(BLUE);
    onColorStep('stamp', onToolStep(game));
    expect(game.handleView(), 'razítkový fix je modrý').toMatchObject({
      tool: 'stamp',
      color: BLUE,
    });
    const before = selectionOf(game);

    const tones = game.tapColor(BLUE);

    expectShortTone(tones, 'už vybraná barva');
    expect(game.panelView()).toBe('closed');
    expect(selectionOf(game)).toEqual(before);
  });
});

describe('#105 AC4: návrat k nástrojům a nástroje bez barvy', () => {
  // Upraveno k #110 AC1: černou dostane každý nástroj ve svém kroku barev.
  it('ťuknutí na vybraný nástroj v kroku barev vrátí panel na nástroje a nástroj ani barva se nezmění', () => {
    for (const tool of COLOR_TOOLS) {
      const game = onColorStep(tool, onToolStep());
      game.tapColor(BLACK);
      onColorStep(tool, onToolStep(game));
      const before = selectionOf(game);

      const tones = game.tapBackToTools();

      expect(game.panelView(), `${TOOL_NAMES[tool]}: krok nástrojů`).toBe('tools');
      expect(selectionOf(game), `${TOOL_NAMES[tool]}: výběr beze změny`).toEqual(before);
      expect(game.handleView(), `${TOOL_NAMES[tool]}: úchyt`).toMatchObject({
        tool,
        color: BLACK,
      });
      expectShortTone(tones, `${TOOL_NAMES[tool]}: návrat`);
    }
  });

  it('guma a duha se vyberou samotným ťuknutím s tónem a panel se zavře bez kroku barev', () => {
    for (const tool of TOOLS_WITHOUT_COLOR) {
      const game = onToolStep(gameWithColor(BLUE));

      const tones = game.tapTool(slotOf(tool));

      const name = TOOL_NAMES[tool];
      expectShortTone(tones, name);
      expect(game.selectedTool(), name).toBe(tool);
      expect(game.panelView(), `${name}: panel zavřený`).toBe('closed');
      expect(game.palette().selected, `${name}: barva beze změny`).toBe(BLUE);
    }
  });

  it('úchyt ukáže gumu i duhu bez barvy', () => {
    for (const tool of TOOLS_WITHOUT_COLOR) {
      const game = onToolStep(gameWithColor(BLUE));
      choose(game, tool);

      expect(game.handleView(), TOOL_NAMES[tool]).toMatchObject({ tool, color: null });
    }
  });

  it('výběr barvy po gumě vrátí naposledy vybraný malovací nástroj a po duze štětec (#90, #93, #97)', () => {
    const afterEraser = onColorStep('crayon');
    afterEraser.tapColor(GREEN);
    choose(onToolStep(afterEraser), 'eraser');
    afterEraser.tapColor(BLUE);
    expect(afterEraser.selectedTool(), 'po gumě pastelka').toBe('crayon');

    const afterRainbow = onColorStep('stamp');
    afterRainbow.tapColor(GREEN);
    choose(onToolStep(afterRainbow), 'rainbow');
    afterRainbow.tapColor(BLUE);
    expect(afterRainbow.selectedTool(), 'po duze štětec').toBe('brush');
  });

  it('zavření úchytem v kroku nástrojů i v kroku barev nechá nástroj i barvu a příště se otevře na nástrojích', () => {
    for (const step of ['tools', 'colors'] as const) {
      const game = inStep(step);
      const before = selectionOf(game);

      const tones = game.tapHandle();

      expectShortTone(tones, `zavření v kroku ${step}`);
      expect(game.panelView(), `zavřeno v kroku ${step}`).toBe('closed');
      expect(selectionOf(game), `výběr po zavření v kroku ${step}`).toEqual(before);
      game.tapHandle();
      expect(game.panelView(), `další otevření po kroku ${step}`).toBe('tools');
    }
  });

  it('tah po obrázku v kroku nástrojů i v kroku barev panel zavře, maluje vybraným nástrojem a barvou a výběr nechá', () => {
    for (const step of ['tools', 'colors'] as const) {
      const regions = twoHalves();
      const game = returningGame();
      game.tapColor(BLUE);
      inStep(step, game);
      const before = selectionOf(game);

      const changed = game.pointerDown({ id: 1, x: 20, y: 100, kind: 'touch' });

      expect(game.panelView(), `tah v kroku ${step}: panel zavřený hned`).toBe('closed');
      expect(changed, `tah v kroku ${step}: první dotyk maluje`).not.toBeNull();
      game.pointerMove({ id: 1, x: 140, y: 100, kind: 'touch' });
      game.pointerUp(1);
      expect(paintedPixels(game, regions), `tah v kroku ${step}`).toBeGreaterThan(0);
      expect(selectionOf(game), `výběr po tahu v kroku ${step}`).toEqual(before);
      game.tapHandle();
      expect(game.panelView(), `další otevření po tahu v kroku ${step}`).toBe('tools');
    }
  });

  it('když dítě zavře krok barev bez výběru barvy, maluje novým nástrojem a dosavadní barvou', () => {
    const game = onColorStep('marker', onToolStep(gameWithColor(BLUE)));
    game.tapHandle();

    expect(game.handleView()).toMatchObject({ tool: 'marker', color: BLUE });
    paint(game, [at(20, 100), at(140, 100)]);
    expect(game.colorAt(20, 100)).toBe(BLUE);
  });
});

describe('#105 AC5: okrajové případy', () => {
  it('ťuknutí druhým prstem během tahu na nástroj, barvu nebo návratový nástroj se nepočítá a tah pokračuje', () => {
    const taps: Array<[string, (game: SavedColoring) => readonly Tone[]]> = [
      ['nástroj s barvou', (game) => game.tapTool(slotOf('spray'))],
      ['guma', (game) => game.tapTool(slotOf('eraser'))],
      ['barva', (game) => game.tapColor(BLACK)],
      ['návratový nástroj', (game) => game.tapBackToTools()],
    ];
    for (const [what, tap] of taps) {
      const regions = twoHalves();
      const game = returningGame();
      game.tapColor(BLUE);
      inStep('closed', game);
      startStroke(game, [at(20, 40), at(60, 40)]);
      const painted = paintedPixels(game, regions);
      const before = selectionOf(game);
      const step = game.panelView();

      expect(tap(game), `${what}: během tahu žádný tón`).toEqual([]);
      expect(selectionOf(game), `${what}: výběr beze změny`).toEqual(before);
      expect(game.panelView(), `${what}: krok beze změny`).toBe(step);

      game.pointerMove({ id: 1, x: 140, y: 40, kind: 'touch' });
      game.pointerUp(1);
      expect(paintedPixels(game, regions), `${what}: tah pokračoval`).toBeGreaterThan(painted);
      expect(game.colorAt(130, 40), `${what}: konec tahu původní barvou`).toBe(BLUE);
    }
  });

  // Upraveno k #110: dřív se po ťuknutí na nástroj čekala stejná barva jako
  // u štětce. Od #110 ukáže nástroj svou barvu (proužkový fix výchozí
  // růžovou), ale žádnou barvu nevybere: štětec i nedávné barvy zůstanou.
  it('jedno ťuknutí udělá jen jednu věc: nástroj nevybere barvu a návrat nic nevybere', () => {
    const game = gameWithColor(PINK);
    game.tapColor(GREEN);
    onToolStep(game);
    const before = selectionOf(game);

    choose(game, 'stripes');
    expect(
      { ...selectionOf(game), tool: before.tool, color: before.color },
      'ťuknutí na nástroj změní jen nástroj',
    ).toEqual(before);
    expect(game.handleView().color, 'proužkový fix ve své barvě').toBe(DEFAULT_TOOL_COLORS.stripes);

    const afterTool = selectionOf(game);
    game.tapBackToTools();
    expect(selectionOf(game), 'návrat nic nevybere').toEqual(afterTool);
    expect(game.panelView(), 'návrat jen přepne krok').toBe('tools');
    choose(game, 'brush');
    expect(game.handleView(), 'štětec si nechal zelenou').toMatchObject({
      tool: 'brush',
      color: GREEN,
    });
  });

  it('ťuknutí na prázdné místo nástrojů v kroku nástrojů nic nevybere a krok nezmění', () => {
    for (const index of [PANEL_TOOLS.length, PANEL_TOOLS.length + 1, -1]) {
      const game = onToolStep();
      const before = selectionOf(game);

      expect(game.tapTool(index), `místo ${index}: bez tónu`).toEqual([]);
      expect(selectionOf(game), `místo ${index}: výběr`).toEqual(before);
      expect(game.panelView(), `místo ${index}: krok`).toBe('tools');
    }
  });

  it('domeček (odchod) v obou krocích obrázek uloží a krok panelu nezmění', () => {
    for (const step of ['tools', 'colors'] as const) {
      const storage = new RecordingStorage();
      const game = returningGame(storage);
      game.tapColor(BLACK);
      paint(game, [at(20, 100), at(60, 100)]);
      inStep(step, game);

      game.suspend();

      expect(game.panelView(), `odchod v kroku ${step}`).toBe(step);
      const again = openOn(storage, twoHalves());
      expect(again.colorAt(20, 100), `odchod v kroku ${step}: obrázek uložený`).toBe(BLACK);
    }
  });

  it('Zpět v obou krocích vrátí tah a krok panelu nezmění', () => {
    for (const step of ['tools', 'colors'] as const) {
      const regions = twoHalves();
      const game = returningGame();
      paint(game, [at(20, 100), at(140, 100)]);
      inStep(step, game);

      expect(game.tapUndo().kind, `Zpět v kroku ${step}`).toBe('undone');
      expect(paintedPixels(game, regions), `Zpět v kroku ${step}: tah je pryč`).toBe(0);
      expect(game.panelView(), `Zpět v kroku ${step}`).toBe(step);
      expect(game.tapUndo().kind, `Zpět bez tahu v kroku ${step}`).toBe('wobble');
      expect(game.panelView(), `zhoupnutí Zpět v kroku ${step}`).toBe(step);
    }
  });

  it('nedávná barva v obou krocích barvu vybere a krok panelu nezmění', () => {
    for (const step of ['tools', 'colors'] as const) {
      const game = returningGame();
      game.tapColor(PINK);
      game.tapColor(BLUE);
      inStep(step, game);
      const recent = game.recentColors()[0];

      const result = game.tapRecentColor(0);

      expect(result.kind, `nedávná barva v kroku ${step}`).toBe('picked');
      expect(game.palette().selected, `nedávná barva v kroku ${step}`).toBe(recent);
      expect(game.panelView(), `krok ${step} po nedávné barvě`).toBe(step);
    }
  });

  it('prázdné místo nedávné barvy se v obou krocích jen zhoupne a krok nezmění', () => {
    for (const step of ['tools', 'colors'] as const) {
      const game = inStep(step, openOn(new RecordingStorage(), twoHalves()));

      expect(game.tapRecentColor(1).kind, `prázdné místo v kroku ${step}`).toBe('wobble');
      expect(game.panelView(), `krok ${step}`).toBe(step);
    }
  });

  it('po schování stránky zůstane panel zavřený, nebo otevřený ve stejném kroku', () => {
    for (const step of ['closed', 'tools', 'colors'] as const) {
      const game = inStep(step);

      game.suspend();

      expect(game.panelView(), `schováno v kroku ${step}`).toBe(step);
    }
  });

  it('náhodná řada ťuknutí z pevného seedu mění krok panelu přesně podle zadání', () => {
    const random = seededRandom(105);
    const game = returningGame();
    let expected: PanelView = 'closed';
    let expectedTool: ToolId = 'brush';
    const history: string[] = [];
    for (let tap = 0; tap < 400; tap += 1) {
      const actions = availableActions(expected);
      const action = actions[pick(random, actions.length)] ?? 'handle';
      history.push(action);
      const label = `ťuknutí ${tap + 1} (${history.slice(-4).join(' → ')})`;
      if (action === 'handle') {
        game.tapHandle();
        expected = expected === 'closed' ? 'tools' : 'closed';
      } else if (action === 'tool') {
        const tool = PANEL_TOOLS[pick(random, PANEL_TOOLS.length)] ?? 'brush';
        choose(game, tool);
        expectedTool = tool;
        expected = TOOLS_WITHOUT_COLOR.includes(tool) ? 'closed' : 'colors';
      } else if (action === 'color') {
        game.tapColor(pick(random, 12));
        expected = 'closed';
      } else if (action === 'back') {
        game.tapBackToTools();
        expected = 'tools';
      } else if (action === 'recent') {
        game.tapRecentColor(pick(random, 2));
      } else if (action === 'undo') {
        game.tapUndo();
      } else if (action === 'paint') {
        paint(game, [at(20 + pick(random, 100), 100)]);
        expected = 'closed';
      } else {
        game.suspend();
      }
      expect(game.panelView(), label).toBe(expected);
      if (action === 'tool') {
        expect(game.selectedTool(), label).toBe(expectedTool);
      }
    }
  });
});

describe('#105 AC5: záznamy se ukládají beze změny', () => {
  it('pevný záznam uložený před tímto úkolem se po práci s panelem otevře stejně pixel po pixelu', () => {
    const regions = legacyP3GlitterRegions();
    const storage = storageWith(LEGACY_P3_GLITTER_STORAGE);
    const keysBefore = storage.keys().sort();

    const game = openOn(storage, regions);
    expect(pixelsOf(game, regions), 'obrázek po otevření').toEqual(legacyP3GlitterPixels());
    expect(game.palette().selected, 'vybraná barva').toBe(LEGACY_P3_GLITTER_SELECTED_COLOR);
    expect(game.recentColors(), 'nedávné barvy').toEqual(LEGACY_P3_GLITTER_RECENT_COLORS);
    expect(game.lineSize(), 'velikost').toBe(LEGACY_P3_GLITTER_LINE_SIZE);

    game.tapHandle();
    choose(game, 'stamp');
    game.tapBackToTools();
    choose(game, 'stamp');
    game.tapColor(LEGACY_P3_GLITTER_SELECTED_COLOR);
    game.tapHandle();
    game.suspend();

    const reopened = openOn(storage, regions);
    expect(pixelsOf(reopened, regions), 'obrázek po návratu').toEqual(legacyP3GlitterPixels());
    expect(reopened.palette().selected, 'vybraná barva').toBe(LEGACY_P3_GLITTER_SELECTED_COLOR);
    expect(reopened.recentColors(), 'nedávné barvy').toEqual(LEGACY_P3_GLITTER_RECENT_COLORS);
    expect(reopened.lineSize(), 'velikost').toBe(LEGACY_P3_GLITTER_LINE_SIZE);
    expect(storage.keys().sort(), 'žádný nový záznam, krok panelu se neukládá').toEqual(keysBefore);
    const picture = storage.data.get(`picture.${PICTURE.id}`) ?? '';
    expect(decodePicture(picture, PICTURE, regions), 'záznam obrázku jde přečíst').not.toBeNull();
  });

  it('výběr přes oba kroky uloží obrázek, barvu, velikost a nedávné barvy stejně jako dosud', () => {
    const viaSteps = new RecordingStorage();
    const direct = new RecordingStorage();
    for (const storage of [viaSteps, direct]) {
      openOn(storage, twoHalves()).suspend();
    }

    const stepped = openOn(viaSteps, twoHalves());
    stepped.tapHandle();
    stepped.tapSizeToggle();
    choose(stepped, 'marker');
    stepped.tapColor(BLUE);
    paint(stepped, [at(20, 100), at(140, 100)]);
    stepped.tapHandle();
    choose(stepped, 'eraser');
    stepped.tapHandle();
    choose(stepped, 'marker');
    stepped.tapColor(PINK);
    stepped.suspend();

    const plain = openOn(direct, twoHalves());
    plain.tapSizeToggle();
    choose(plain, 'marker');
    plain.tapColor(BLUE);
    paint(plain, [at(20, 100), at(140, 100)]);
    choose(plain, 'eraser');
    choose(plain, 'marker');
    plain.tapColor(PINK);
    plain.suspend();

    expect([...viaSteps.data.entries()].sort(), 'stejné záznamy v úložišti').toEqual(
      [...direct.data.entries()].sort(),
    );
  });
});

/** Ťuknutí, která dítě v daném kroku panelu může udělat. */
function availableActions(step: PanelView): readonly string[] {
  const always = ['handle', 'recent', 'undo', 'paint', 'suspend'];
  if (step === 'tools') {
    return [...always, 'tool', 'tool', 'tool'];
  }
  if (step === 'colors') {
    return [...always, 'color', 'color', 'back'];
  }
  return always;
}

/** Úložiště hry se stavem `entries`, jak ho zapsala starší verze. */
function storageWith(entries: ReadonlyArray<readonly [string, string]>): RecordingStorage {
  const storage = new RecordingStorage();
  for (const [key, value] of entries) {
    storage.data.set(key, value);
  }
  return storage;
}
