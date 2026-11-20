import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SavedColoring } from '../../../src/games/coloring/logic/savedPicture';
import type { ToolId } from '../../../src/games/coloring/logic/toolPanel';
import { albumDevice, openWithAlbum, paintLeft, watchRecords } from './albumHelpers';
import { BROOM_FINGER, BROOM_HOLD_MS, enterGame, openFromPicker } from './broomHelpers';
import type { BroomPage } from './broomHelpers';
import { SwapDevice } from './continuePaintingHelpers';
import { TOOL_NAMES } from './lineSizeHelpers';
import {
  OTHER_QUICK_FINGER,
  QUICK_FINGER,
  firstButton,
  press,
  release,
  tapFirstButton,
  tapQuickEraser,
} from './quickToolsHelpers';
import type { QuickButton } from './quickToolsHelpers';
import { RecordingStorage, openOn, pixelsOf, startStroke, twoHalves } from './savedPictureHelpers';
import { at } from './strokeHelpers';
import { GREEN, giveColor, pickTool } from './toolColorsHelpers';

/**
 * Testy k #148 AC6 (dotyky na tlačítka rychlého přepínání), od #163 AC6
 * beze změny chování, jen s prvním tlačítkem pro kreslicí nástroj.
 * Rozhraní je v `quickToolsHelpers.ts`: dotyk prstu na tlačítko hlásí scéna
 * jako `pressQuickTool(tlačítko, prst)`, zvednutí jako
 * `releaseQuickTool(prst)`. Že tah začatý na tlačítku nemaluje, hlídá
 * `touchTargetAt` v `quickToolsLayoutRules.test.ts` (jako u fotoaparátu
 * a koštěte).
 *
 * „Nic nedělá“ znamená jako u fotoaparátu v #126 AC3: nástroj se nepřepne
 * a tlačítko se ani nezhoupne (`ignored`).
 */

const BUTTONS: readonly QuickButton[] = ['drawingTool', 'eraser'];

const BUTTON_NAMES: Readonly<Record<QuickButton, string>> = {
  drawingTool: 'první tlačítko',
  eraser: 'guma',
};

/** Prst, který maluje po obrázku. */
const PAINTING_FINGER = 2;

/** Hra s vybraným fixem (zelený), fix je i na prvním tlačítku. */
function markerSelected(): SavedColoring {
  const game = openOn(new RecordingStorage(), twoHalves());
  giveColor(game, 'marker', GREEN);
  expect(firstButton(game).tool, 'kontrola: fix na prvním tlačítku').toBe('marker');
  return game;
}

/** Hra s vybranou gumou a zeleným fixem na prvním tlačítku. */
function eraserAfterMarker(): SavedColoring {
  const game = markerSelected();
  tapQuickEraser(game);
  expect(game.selectedTool(), 'kontrola: guma').toBe('eraser');
  return game;
}

/** Hra, ve které ťuknutí na `button` přepne nástroj (tlačítko není vybrané). */
function readyFor(button: QuickButton): SavedColoring {
  return button === 'eraser' ? markerSelected() : eraserAfterMarker();
}

/** Nástroj vybraný ťuknutím na `button` ve hře z `readyFor`. */
function pickedBy(button: QuickButton): ToolId {
  return button === 'eraser' ? 'eraser' : 'marker';
}

/** Co se nesmí změnit: nástroj a první tlačítko. */
function toolState(game: SavedColoring): { selected: ToolId; first: unknown } {
  return { selected: game.selectedTool(), first: firstButton(game) };
}

describe('#148 AC6: když jiný prst maluje, nic se nepřepne', () => {
  it('ťuknutí na kterékoli tlačítko během tahu nic nepřepne a tah pokračuje stejným nástrojem', () => {
    for (const button of BUTTONS) {
      const game = eraserAfterMarker();
      const untouched = eraserAfterMarker();
      const before = toolState(game);
      const path = [at(20, 100), at(60, 100)];
      startStroke(game, path, PAINTING_FINGER);
      startStroke(untouched, path, PAINTING_FINGER);

      const result = press(game, button);
      release(game);

      const what = BUTTON_NAMES[button];
      expect(result, what).toEqual({ kind: 'ignored' });
      expect(toolState(game), `${what}: nástroj a první tlačítko`).toEqual(before);
      for (const each of [game, untouched]) {
        each.pointerMove({ id: PAINTING_FINGER, x: 140, y: 100, kind: 'touch' });
        each.pointerUp(PAINTING_FINGER);
      }
      expect(pixelsOf(game, twoHalves()), `${what}: tah dokončený jako bez ťuknutí`).toEqual(
        pixelsOf(untouched, twoHalves()),
      );
    }
  });

  it('po zvednutí malujícího prstu tlačítka zase přepínají', () => {
    const game = eraserAfterMarker();
    startStroke(game, [at(20, 100), at(60, 100)], PAINTING_FINGER);
    tapFirstButton(game);
    game.pointerUp(PAINTING_FINGER);

    expect(tapFirstButton(game).kind).toBe('picked');
    expect(game.selectedTool()).toBe('marker');
  });
});

describe('#148 AC6: dva prsty přepnou jen jednou a platí první dotyk', () => {
  it('dva prsty na stejném tlačítku přepnou jen jednou', () => {
    for (const button of BUTTONS) {
      const game = readyFor(button);

      const first = press(game, button, QUICK_FINGER);
      const second = press(game, button, OTHER_QUICK_FINGER);
      release(game, OTHER_QUICK_FINGER);
      release(game, QUICK_FINGER);

      const what = BUTTON_NAMES[button];
      expect(first.kind, `${what}: první prst`).toBe('picked');
      expect(second, `${what}: druhý prst`).toEqual({ kind: 'ignored' });
      expect(game.selectedTool(), what).toBe(pickedBy(button));
    }
  });

  it('každý prst na jiném tlačítku: platí jen první dotyk', () => {
    for (const [firstTouch, secondTouch] of [
      ['drawingTool', 'eraser'],
      ['eraser', 'drawingTool'],
    ] as const) {
      const game = readyFor(firstTouch);

      const first = press(game, firstTouch, QUICK_FINGER);
      const second = press(game, secondTouch, OTHER_QUICK_FINGER);
      release(game, QUICK_FINGER);
      release(game, OTHER_QUICK_FINGER);

      const what = `${BUTTON_NAMES[firstTouch]}, pak ${BUTTON_NAMES[secondTouch]}`;
      expect(first.kind, `${what}: první dotyk`).toBe('picked');
      expect(second, `${what}: druhý dotyk`).toEqual({ kind: 'ignored' });
      expect(game.selectedTool(), what).toBe(pickedBy(firstTouch));
    }
  });

  it('druhý prst se nepočítá, ani když se první prst zvedne dřív než druhý', () => {
    const game = markerSelected();
    press(game, 'eraser', QUICK_FINGER);
    press(game, 'drawingTool', OTHER_QUICK_FINGER);
    release(game, QUICK_FINGER);
    release(game, OTHER_QUICK_FINGER);

    expect(game.selectedTool(), 'přepnuto jen jednou').toBe('eraser');
    expect(firstButton(game).tool).toBe('marker');
  });

  it('po zvednutí obou prstů funguje další ťuknutí', () => {
    const game = eraserAfterMarker();
    press(game, 'drawingTool', QUICK_FINGER);
    press(game, 'eraser', OTHER_QUICK_FINGER);
    release(game, OTHER_QUICK_FINGER);
    release(game, QUICK_FINGER);

    expect(tapQuickEraser(game).kind, 'další ťuknutí').toBe('picked');
    expect(game.selectedTool()).toBe('eraser');
  });

  // Upraveno k #163: dvojí ťuknutí na stejné tlačítko podruhé jen zhoupne
  // (AC3), tam a zpátky se přepíná gumou a prvním tlačítkem.
  it('rychlé ťuknutí na gumu a hned na první tlačítko jedním prstem přepne dvakrát (tam a zpátky)', () => {
    const game = markerSelected();

    expect(tapQuickEraser(game).kind, 'guma').toBe('picked');
    expect(tapFirstButton(game).kind, 'první tlačítko').toBe('picked');

    expect(game.selectedTool()).toBe('marker');
  });
});

describe('#148 AC6: během ukládání fotoaparátem tlačítka nic nedělají', () => {
  it('během ukládání do alba se nic nepřepne a po uložení tlačítka zase fungují', async () => {
    const records = watchRecords(albumDevice().page());
    const game = await openWithAlbum({ storage: new RecordingStorage(), records });
    pickTool(game, 'marker');
    paintLeft(game, GREEN);
    tapQuickEraser(game);
    records.holdAdds();
    const camera = game.tapCamera();
    expect(camera.kind, 'kontrola: ukládá se').toBe('saving');
    const before = toolState(game);

    for (const button of BUTTONS) {
      expect(press(game, button), BUTTON_NAMES[button]).toEqual({ kind: 'ignored' });
      release(game);
    }
    expect(toolState(game), 'nic se nepřepnulo').toEqual(before);

    await records.releaseAdds();
    if (camera.kind === 'saving') {
      await camera.done;
    }
    expect(tapFirstButton(game).kind, 'po uložení').toBe('picked');
    expect(game.selectedTool()).toBe('marker');
  });
});

describe('#148 AC6: během držení domečku nebo koštěte tlačítka nic nedělají', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** Malování otevřené z výběru s gumou a fixem na prvním tlačítku. */
  async function painting(): Promise<{ page: BroomPage; game: SavedColoring }> {
    const page = await enterGame(new SwapDevice());
    const game = await openFromPicker(page);
    pickTool(game, 'marker');
    tapQuickEraser(game);
    if (game.panelOpen()) {
      game.tapHandle();
    }
    expect(firstButton(game).tool, 'kontrola: fix na prvním tlačítku').toBe('marker');
    return { page, game };
  }

  it('když se drží domeček, nic se nepřepne; po puštění domečku zase funguje', async () => {
    const { page, game } = await painting();
    const before = toolState(game);

    page.choice.homeHolding(true);
    for (const button of BUTTONS) {
      expect(press(game, button), BUTTON_NAMES[button]).toEqual({ kind: 'ignored' });
      release(game);
    }
    expect(toolState(game), 'nic se nepřepnulo').toEqual(before);

    page.choice.homeHolding(false);
    expect(tapFirstButton(game).kind, 'po puštění domečku').toBe('picked');
    expect(game.selectedTool()).toBe('marker');
  });

  it('když se drží koště, nic se nepřepne; po puštění koštěte zase funguje', async () => {
    const { page, game } = await painting();
    const before = toolState(game);

    page.choice.broomButton.press(BROOM_FINGER);
    vi.advanceTimersByTime(BROOM_HOLD_MS / 2);
    for (const button of BUTTONS) {
      expect(press(game, button), BUTTON_NAMES[button]).toEqual({ kind: 'ignored' });
      release(game);
    }
    expect(toolState(game), 'nic se nepřepnulo').toEqual(before);
    page.choice.broomButton.release(BROOM_FINGER);

    expect(tapFirstButton(game).kind, 'po puštění koštěte').toBe('picked');
    expect(game.selectedTool(), TOOL_NAMES.marker).toBe('marker');
  });
});
