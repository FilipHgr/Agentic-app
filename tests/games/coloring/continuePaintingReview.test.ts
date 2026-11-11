import { afterEach, describe, expect, it, vi } from 'vitest';

import { readAlbum } from '../../../src/games/coloring/logic/album';
import type { AlbumPicture } from '../../../src/games/coloring/logic/album';
import { settleAlbumSwap } from '../../../src/games/coloring/logic/albumSwap';
import { startPictureChoice } from '../../../src/games/coloring/logic/pictureChoice';
import { openColoring } from '../../../src/games/coloring/logic/savedPicture';
import { HOME_WOBBLE_TONES } from '../../../src/shared/logic/homeButton';
import { settle, takePhoto } from './albumHelpers';
import {
  HOUSE,
  albumPixels,
  pageOf,
  prepareSwap,
  reloadAndOpen,
  sameAlbum,
  showPainting,
  swapPictures,
  tapContinue,
  timesIn,
  wholeState,
} from './continuePaintingHelpers';
import type { PreparedSwap } from './continuePaintingHelpers';
import { pixelsOf } from './savedPictureHelpers';

/**
 * Testy k nálezům review #131. Označení podle issue: P je rozmalovaná
 * stránka omalovánky před ťuknutím, A obrázek z alba.
 * - Když je A z alba jistě pryč (P odložená podle AC4), nový snímek A ve
 *   fotoaparátu výměnu nevrátí a P se nikdy neztratí.
 * - Dokud se výměna může vrátit, fotoaparát obrázek A do alba nedá.
 * - Dokud scéna nepřipravila obrysy (`albumPictures` zpočátku prázdné),
 *   náhled omalovánky s odloženou výměnou se jen zhoupne (AC5).
 */

afterEach(() => {
  vi.useRealTimers();
});

/** Výměna se přeruší po 2 zápisech: P odložená, na stránce A, A dál v albu. */
async function swapCutAfterPageA(): Promise<PreparedSwap> {
  const prepared = await prepareSwap({ albumCount: 3, aIndex: 1 });
  prepared.device.cutAfterWrites(2);
  expect(prepared.page.choice.tapContinue().kind).toBe('swapping');
  await settle();
  expect(pageOf(prepared.device), 'na stránce je A').toEqual(prepared.a);
  expect(timesIn(await albumPixels(prepared.device), prepared.a), 'A je dál v albu').toBe(1);
  return prepared;
}

describe('#131 review: odložená P se neztratí ani po novém snímku A', () => {
  it('po odložení P dítě vyfotí nezměněné A, po obnovení je P v albu', async () => {
    const prepared = await prepareSwap({ albumCount: 3, aIndex: 1 });
    prepared.device.addFailure = 'full';
    expect((await tapContinue(prepared.page)).kind, 'dítě maluje A, P je odložená').toBe('opened');
    prepared.device.addFailure = null;

    const game = await showPainting(prepared.page);
    vi.useRealTimers();
    const photo = await takePhoto(game);
    expect(photo.kind, 'nezměněné A se vyfotí').toBe('saved');
    game.suspend();

    await reloadAndOpen(prepared.device);
    const album = await albumPixels(prepared.device);
    expect(timesIn(album, prepared.p), 'P je v albu').toBe(1);
    expect(timesIn(album, prepared.a), 'A je v albu jednou, jako nový snímek').toBe(1);
    expect(album.length, 'v albu přibyl jen nový snímek').toBe(prepared.albumBefore.length + 1);
  });

  it('dokud se výměna může vrátit, fotoaparát obrázek A do alba nedá a po obnovení je celý stav před', async () => {
    const prepared = await swapCutAfterPageA();
    const { device } = prepared;
    device.nextLoad();
    const pictures = swapPictures();
    const contents = await readAlbum(device.rawRecords(), pictures);
    const game = openColoring({
      regions: prepared.page.regions,
      picture: HOUSE,
      storage: device.storage(),
      album: { records: device.records(), contents },
    });
    expect(pixelsOf(game, prepared.page.regions), 'malování ukazuje A').toEqual(prepared.a);

    expect(game.tapCamera(), 'fotoaparát se jen zhoupne').toEqual({
      kind: 'wobble',
      tones: HOME_WOBBLE_TONES,
    });
    game.suspend();

    await reloadAndOpen(device);
    expect(await wholeState(prepared, true)).toBe('před');
    expect(sameAlbum(await albumPixels(device), prepared.albumBefore)).toBe(true);
  });
});

describe('#131 review: náhled s odloženou výměnou, než jsou připravené obrysy', () => {
  it('s ještě nepřipravenými obrysy se náhled té omalovánky jen zhoupne, po vrácení se otevře s P', async () => {
    const prepared = await swapCutAfterPageA();
    const { device } = prepared;
    device.nextLoad();
    const storage = device.storage();
    const records = device.records();
    let ready: readonly AlbumPicture[] = [];
    const choice = startPictureChoice(
      swapPictures().map((picture) => picture.identity),
      { now: () => Date.now(), records, storage, albumPictures: () => ready },
    );

    expect(choice.tapPreview(0), 'obrysy se chystají, náhled domku se zhoupne').toEqual({
      kind: 'wobble',
      tones: HOME_WOBBLE_TONES,
    });
    expect(choice.screen().kind).toBe('picker');

    ready = swapPictures();
    const settlement = await settleAlbumSwap({ storage, records, pictures: ready });
    expect(settlement.kind, 'výměna se vrátila').toBe('reverted');
    expect(choice.tapPreview(0).kind, 'po vrácení se náhled otevře').toBe('open');
    expect(pageOf(device), 'stránka je P').toEqual(prepared.p);
    expect(sameAlbum(await albumPixels(device), prepared.albumBefore), 'album jako před').toBe(
      true,
    );
  });
});
