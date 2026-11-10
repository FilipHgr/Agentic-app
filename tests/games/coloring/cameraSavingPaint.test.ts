import { describe, expect, it } from 'vitest';

import { albumDevice, openWithAlbum, paintLeft, shownCount, watchRecords } from './albumHelpers';
import { RecordingStorage, paint, paintedPixels, pixelsOf, twoHalves } from './savedPictureHelpers';
import { at } from './strokeHelpers';

/**
 * Test k #126, rozhodnutí koordinátora 3: během ukládání do alba (od
 * cvaku po potvrzení) se nemaluje a dotyk na obrázku nic nezabarví.
 * Ukládání trvá jen pár desítek ms; kdyby se mezitím malovalo, nový tah
 * by se po úspěšném uložení ztratil spolu se stránkou.
 */

const ORANGE = 1;
const BLUE = 4;

/** Tah v pravé polovině zkušebního obrysu (levou maluje `paintLeft`). */
const RIGHT_STROKE = [at(170, 40), at(280, 160)];

/** Malování s namalovaným obrázkem a podrženým ukládáním do alba po ťuknutí na fotoaparát. */
async function savingPicture() {
  const regions = twoHalves();
  const records = watchRecords(albumDevice().page());
  const game = await openWithAlbum({ storage: new RecordingStorage(), records, regions });
  paintLeft(game, ORANGE);
  const painted = pixelsOf(game, regions);
  records.holdAdds();
  const tap = game.tapCamera();
  expect(tap.kind, 'ukládání začalo').toBe('saving');
  return { regions, records, game, painted, tap };
}

describe('#126: během ukládání do alba se nemaluje', () => {
  it('dotyk na obrázku během ukládání nic nezabarví', async () => {
    const { regions, game, painted } = await savingPicture();

    game.tapColor(BLUE);
    paint(game, RIGHT_STROKE, 2);

    expect(game.savingToAlbum(), 'pořád se ukládá').toBe(true);
    expect(pixelsOf(game, regions), 'obrázek beze změny').toEqual(painted);
  });

  it('po úspěšném uložení je stránka čistá a tah z doby ukládání se na ní neobjeví', async () => {
    const { regions, records, game, tap } = await savingPicture();
    paint(game, RIGHT_STROKE, 2);

    await records.releaseAdds();
    const result = tap.kind === 'saving' ? await tap.done : undefined;

    expect(result?.kind).toBe('saved');
    expect(paintedPixels(game, regions), 'čistá stránka').toBe(0);
    expect(await shownCount(records), 'v albu je obrázek bez tahu z doby ukládání').toBe(1);
  });

  it('po selhání uložení zůstane obrázek přesně jako před cvakem, bez tahu z doby ukládání', async () => {
    const { regions, records, game, painted, tap } = await savingPicture();
    paint(game, RIGHT_STROKE, 2);

    await records.releaseAdds('unavailable');
    const result = tap.kind === 'saving' ? await tap.done : undefined;

    expect(result?.kind).toBe('failed');
    expect(pixelsOf(game, regions)).toEqual(painted);
  });

  it('po dokončeném ukládání se maluje zase normálně', async () => {
    const { regions, records, game, tap } = await savingPicture();
    await records.releaseAdds();
    if (tap.kind === 'saving') {
      await tap.done;
    }

    expect(game.savingToAlbum(), 'ukládání skončilo').toBe(false);
    paintLeft(game, BLUE);
    expect(paintedPixels(game, regions), 'nový tah maluje').toBeGreaterThan(0);
  });
});
