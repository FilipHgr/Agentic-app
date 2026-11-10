import { describe, expect, it } from 'vitest';

import { openColoring } from '../../../src/games/coloring/logic/savedPicture';
import { HOUSE, albumDevice, albumOf, paintLeft, shownCount, watchRecords } from './albumHelpers';
import { RecordingStorage, twoHalves } from './savedPictureHelpers';

/**
 * Test k #126 (kontrola vzhledu): malování se otevře hned, nečeká na
 * přečtení alba. Fotoaparát se do přečtení alba jen zhoupne (jako kniha
 * před přečtením, rozhodnutí koordinátora 2), pak ukládá normálně.
 */

const ORANGE = 1;

describe('#126: malování nečeká na přečtení alba', () => {
  it('před přečtením alba se fotoaparát jen zhoupne a po přečtení obrázek uloží', async () => {
    const regions = twoHalves();
    const records = watchRecords(albumDevice().page());
    const game = openColoring({
      regions,
      picture: HOUSE,
      storage: new RecordingStorage(),
      album: { records, contents: { status: 'unavailable' } },
    });
    paintLeft(game, ORANGE);

    expect(game.tapCamera().kind, 'album se ještě čte').toBe('wobble');

    game.albumRead(await albumOf(records));
    const tap = game.tapCamera();
    expect(tap.kind, 'album přečtené').toBe('saving');
    const result = tap.kind === 'saving' ? await tap.done : undefined;
    expect(result?.kind).toBe('saved');
    expect(await shownCount(records)).toBe(1);
  });
});
