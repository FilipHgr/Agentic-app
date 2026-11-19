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
  tapPrevious,
  tapQuickEraser,
} from './quickToolsHelpers';
import type { QuickButton } from './quickToolsHelpers';
import { RecordingStorage, openOn, pixelsOf, startStroke, twoHalves } from './savedPictureHelpers';
import { at } from './strokeHelpers';
import { GREEN, giveColor, pickTool } from './toolColorsHelpers';

/**
 * Testy k #148 AC6 (dotyky na tlačítka předchozího nástroje a gumy).
 * Rozhraní je v `quickToolsHelpers.ts`: dotyk prstu na tlačítko hlásí scéna
 * jako `pressQuickTool(tlačítko, prst)`, zvednutí jako
 * `releaseQuickTool(prst)`. Že tah začatý na tlačítku nemaluje, hlídá
 * `touchTargetAt` v `quickToolsLayoutRules.test.ts` (jako u fotoaparátu
 * a koštěte).
 *
 * „Nic nedělá“ znamená jako u fotoaparátu v #126 AC3: nástroj se nepřepne
 * a tlačítko se ani nezhoupne (`ignored`).
 */

const BUTTONS: readonly QuickButton[] = ['previousTool', 'eraser'];

const BUTTON_NAMES: Readonly<Record<QuickButton, string>> = {
  previousTool: 'první tlačítko',
  eraser: 'guma',
};

/** Prst, který maluje po obrázku. */
const PAINTING_FINGER = 2;

/** Hra s vybraným fixem (zelený) a štětcem na prvním tlačítku. */
function markerAfterBrush(): SavedColoring {
  const game = openOn(new RecordingStorage(), twoHalves());
  giveColor(game, 'marker', GREEN);
  expect(firstButton(game)?.tool, 'kontrola: štětec na prvním tlačítku').toBe('brush');
  return game;
}

/** Co se nesmí změnit: nástroj a první tlačítko. */
function toolState(game: SavedColoring): { selected: ToolId; first: unknown } {
  return { selected: game.selectedTool(), first: firstButton(game) };
}

describe('#148 AC6: když jiný prst maluje, nic se nepřepne', () => {
  it('ťuknutí na kterékoli tlačítko během tahu nic nepřepne a tah pokračuje stejným nástrojem', () => {
    for (const button of BUTTONS) {
      const game = markerAfterBrush();
      const untouched = markerAfterBrush();
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
    const game = markerAfterBrush();
    startStroke(game, [at(20, 100), at(60, 100)], PAINTING_FINGER);
    tapPrevious(game);
    game.pointerUp(PAINTING_FINGER);

    expect(tapPrevious(game).kind).toBe('picked');
    expect(game.selectedTool()).toBe('brush');
  });
});

describe('#148 AC6: dva prsty přepnou jen jednou a platí první dotyk', () => {
  it('dva prsty na stejném tlačítku přepnou jen jednou', () => {
    for (const button of BUTTONS) {
      const game = markerAfterBrush();

      const first = press(game, button, QUICK_FINGER);
      const second = press(game, button, OTHER_QUICK_FINGER);
      release(game, OTHER_QUICK_FINGER);
      release(game, QUICK_FINGER);

      const what = BUTTON_NAMES[button];
      expect(first.kind, `${what}: první prst`).toBe('picked');
      expect(second, `${what}: druhý prst`).toEqual({ kind: 'ignored' });
      expect(game.selectedTool(), what).toBe(button === 'eraser' ? 'eraser' : 'brush');
    }
  });

  it('každý prst na jiném tlačítku: platí jen první dotyk', () => {
    for (const [firstTouch, secondTouch] of [
      ['previousTool', 'eraser'],
      ['eraser', 'previousTool'],
    ] as const) {
      const game = markerAfterBrush();

      const first = press(game, firstTouch, QUICK_FINGER);
      const second = press(game, secondTouch, OTHER_QUICK_FINGER);
      release(game, QUICK_FINGER);
      release(game, OTHER_QUICK_FINGER);

      const what = `${BUTTON_NAMES[firstTouch]}, pak ${BUTTON_NAMES[secondTouch]}`;
      expect(first.kind, `${what}: první dotyk`).toBe('picked');
      expect(second, `${what}: druhý dotyk`).toEqual({ kind: 'ignored' });
      expect(game.selectedTool(), what).toBe(firstTouch === 'eraser' ? 'eraser' : 'brush');
    }
  });

  it('druhý prst se nepočítá, ani když se první prst zvedne dřív než druhý', () => {
    const game = markerAfterBrush();
    press(game, 'previousTool', QUICK_FINGER);
    press(game, 'previousTool', OTHER_QUICK_FINGER);
    release(game, QUICK_FINGER);
    release(game, OTHER_QUICK_FINGER);

    expect(game.selectedTool(), 'přepnuto jen jednou').toBe('brush');
    expect(firstButton(game)?.tool).toBe('marker');
  });

  it('po zvednutí obou prstů funguje další ťuknutí', () => {
    const game = markerAfterBrush();
    press(game, 'previousTool', QUICK_FINGER);
    press(game, 'eraser', OTHER_QUICK_FINGER);
    release(game, OTHER_QUICK_FINGER);
    release(game, QUICK_FINGER);

    expect(tapPrevious(game).kind, 'další ťuknutí').toBe('picked');
    expect(game.selectedTool()).toBe('marker');
  });

  it('rychlé dvojí ťuknutí jedním prstem přepne dvakrát (tam a zpátky)', () => {
    const game = markerAfterBrush();

    tapPrevious(game);
    tapPrevious(game);

    expect(game.selectedTool()).toBe('marker');
  });
});

describe('#148 AC6: během ukládání fotoaparátem tlačítka nic nedělají', () => {
  it('během ukládání do alba se nic nepřepne a po uložení tlačítka zase fungují', async () => {
    const records = watchRecords(albumDevice().page());
    const game = await openWithAlbum({ storage: new RecordingStorage(), records });
    pickTool(game, 'marker');
    pickTool(game, 'brush');
    paintLeft(game, GREEN);
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
    expect(tapPrevious(game).kind, 'po uložení').toBe('picked');
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

  /** Malování otevřené z výběru se štětcem a fixem na prvním tlačítku. */
  async function painting(): Promise<{ page: BroomPage; game: SavedColoring }> {
    const page = await enterGame(new SwapDevice());
    const game = await openFromPicker(page);
    pickTool(game, 'marker');
    pickTool(game, 'brush');
    if (game.panelOpen()) {
      game.tapHandle();
    }
    expect(firstButton(game)?.tool, 'kontrola: fix na prvním tlačítku').toBe('marker');
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
    expect(tapPrevious(game).kind, 'po puštění domečku').toBe('picked');
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

    expect(tapQuickEraser(game).kind, 'po puštění koštěte').toBe('picked');
    expect(game.selectedTool(), TOOL_NAMES.eraser).toBe('eraser');
  });
});
