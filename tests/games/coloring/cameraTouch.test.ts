import { describe, expect, it } from 'vitest';

import { loadPicturePreview } from '../../../src/games/coloring/logic/picturePreview';
import type { PicturePreview } from '../../../src/games/coloring/logic/picturePreview';
import { HOLD_TO_GO_HOME_MS, HOME_WOBBLE_TONES } from '../../../src/shared/logic/homeButton';
import {
  HOUSE,
  albumDevice,
  openWithAlbum,
  paintLeft,
  shownCount,
  watchRecords,
} from './albumHelpers';
import { advancePickerClock, enterPicker } from './pictureChoiceHelpers';
import {
  RecordingStorage,
  paintedPixels,
  pixelsOf,
  startStroke,
  twoHalves,
} from './savedPictureHelpers';
import { at } from './strokeHelpers';

/**
 * Testy k #126 AC3 (dotyky na fotoaparát). Druhý prst, dvojí ťuknutí
 * a podržení domečku během ukládání hlásí scéna logice stejně jako
 * u ostatních tlačítek: `tapCamera()` během tahu jiného prstu vrátí
 * `{ kind: 'ignored' }` (nic, ani zhoupnutí). Že tah začatý na
 * fotoaparátu nemaluje, hlídá `touchTargetAt` v `cameraLayoutRules.test.ts`.
 *
 * Podržení domečku během ukládání: výběr vrátí dítě na výběr a scéna
 * malování uloží (`suspend`), ukládání do alba ale doběhne a náhled na
 * výběru (`loadPicturePreview` nad stejným úložištěm) ukáže výsledek.
 */

const ORANGE = 1;

/** Je v náhledu aspoň jeden pixel s barvou dítěte? */
function hasColors(preview: PicturePreview): boolean {
  for (let y = 0; y < preview.height; y += 1) {
    for (let x = 0; x < preview.width; x += 1) {
      if (preview.cellAt(x, y).kind === 'color') {
        return true;
      }
    }
  }
  return false;
}

describe('#126 AC3: fotoaparát a jiný prst, který maluje', () => {
  it('ťuknutí na fotoaparát, když jiný prst maluje, nic neuloží, nezhoupne se a tah pokračuje beze změny', async () => {
    const regions = twoHalves();
    const records = watchRecords(albumDevice().page());
    const game = await openWithAlbum({ storage: new RecordingStorage(), records, regions });
    const untouched = await openWithAlbum({ storage: new RecordingStorage(), records, regions });
    paintLeft(game, ORANGE);
    paintLeft(untouched, ORANGE);
    const path = [at(170, 30), at(280, 100)];
    startStroke(game, path, 2);
    startStroke(untouched, path, 2);

    expect(game.tapCamera(), 'fotoaparát během tahu').toEqual({ kind: 'ignored' });

    for (const each of [game, untouched]) {
      each.pointerMove({ id: 2, x: 280, y: 180, kind: 'touch' });
      each.pointerUp(2);
    }
    expect(records.adds(), 'nic se neuložilo').toBe(0);
    expect(pixelsOf(game, regions), 'tah dokončený stejně jako bez ťuknutí').toEqual(
      pixelsOf(untouched, regions),
    );
  });
});

describe('#126 AC3: dvojí ťuknutí a dva prsty uloží obrázek jen jednou', () => {
  it('rychlé dvojí ťuknutí uloží obrázek jen jednou, druhé ťuknutí fotoaparát jen zhoupne', async () => {
    const records = watchRecords(albumDevice().page());
    const game = await openWithAlbum({ storage: new RecordingStorage(), records });
    paintLeft(game, ORANGE);

    const first = game.tapCamera();
    const second = game.tapCamera();

    expect(first.kind).toBe('saving');
    expect(second, 'druhé ťuknutí během ukládání (AC2 c)').toEqual({
      kind: 'wobble',
      tones: HOME_WOBBLE_TONES,
    });
    if (first.kind === 'saving') {
      await first.done;
    }
    expect(records.adds()).toBe(1);
    expect(await shownCount(records)).toBe(1);
  });

  it('dva prsty na fotoaparátu naráz uloží obrázek jen jednou', async () => {
    const records = watchRecords(albumDevice().page());
    records.holdAdds();
    const game = await openWithAlbum({ storage: new RecordingStorage(), records });
    paintLeft(game, ORANGE);

    const taps = [game.tapCamera(), game.tapCamera()];

    expect(taps.map((tap) => tap.kind)).toEqual(['saving', 'wobble']);
    await records.releaseAdds();
    await Promise.all(taps.map((tap) => (tap.kind === 'saving' ? tap.done : undefined)));
    expect(records.adds()).toBe(1);
    expect(await shownCount(records)).toBe(1);
  });

  it('ťuknutí po dokončeném uložení platí podle AC2 (a): čistá stránka se jen zhoupne', async () => {
    const records = watchRecords(albumDevice().page());
    const game = await openWithAlbum({ storage: new RecordingStorage(), records });
    paintLeft(game, ORANGE);
    const first = game.tapCamera();
    if (first.kind === 'saving') {
      await first.done;
    }

    expect(game.tapCamera()).toEqual({ kind: 'wobble', tones: HOME_WOBBLE_TONES });
    expect(records.adds()).toBe(1);
  });
});

describe('#126 AC3: podržení domečku během ukládání', () => {
  /** Malování otevřené z výběru, ukládání do alba podržené. */
  async function savingWhenLeaving() {
    const storage = new RecordingStorage();
    const regions = twoHalves();
    const records = watchRecords(albumDevice().page());
    const choice = enterPicker();
    const tap = choice.tapPreview(0);
    expect(tap.kind === 'open' ? tap.picture : undefined).toEqual(HOUSE);
    choice.paintingShown();
    const game = await openWithAlbum({ storage, records, regions, picture: HOUSE });
    paintLeft(game, ORANGE);
    records.holdAdds();

    const camera = game.tapCamera();
    expect(camera.kind, 'ukládání začalo').toBe('saving');
    advancePickerClock(HOLD_TO_GO_HOME_MS);
    expect(choice.holdHome(), 'domeček vede na výběr').toBe('toPicker');
    game.suspend();
    const preview = (): PicturePreview =>
      loadPicturePreview({ storage, picture: HOUSE, regions, width: 60, height: 40 });
    return { records, camera, preview, game, regions };
  }

  it('po úspěšném uložení ukáže náhled na výběru čistý obrys', async () => {
    const { records, camera, preview } = await savingWhenLeaving();

    await records.releaseAdds();
    const result = camera.kind === 'saving' ? await camera.done : undefined;

    expect(result?.kind, 'ukládání se dokončilo').toBe('saved');
    expect(hasColors(preview()), 'náhled je čistý obrys').toBe(false);
    expect(await shownCount(records), 'obrázek je v albu').toBe(1);
  });

  it('po selhání uložení ukáže náhled na výběru barvy', async () => {
    const { records, camera, preview, game, regions } = await savingWhenLeaving();

    await records.releaseAdds('full');
    const result = camera.kind === 'saving' ? await camera.done : undefined;

    expect(result?.kind, 'ukládání skončilo selháním').toBe('failed');
    expect(hasColors(preview()), 'náhled ukazuje barvy').toBe(true);
    expect(paintedPixels(game, regions), 'obrázek zůstal').toBeGreaterThan(0);
  });
});
