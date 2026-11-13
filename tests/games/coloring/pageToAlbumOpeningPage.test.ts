import { describe, expect, it } from 'vitest';

import { readAlbum } from '../../../src/games/coloring/logic/album';
import { openColoring } from '../../../src/games/coloring/logic/savedPicture';
import { HOLD_TO_GO_HOME_MS } from '../../../src/shared/logic/homeButton';
import type { GameRecords, RecordsAdd } from '../../../src/shared/storage/profileRecords';
import { timesIn } from './continuePaintingHelpers';
import {
  HOUSE,
  PAGE_COLOR,
  SECOND_COLOR,
  STAR,
  SwapDevice,
  THIRD_COLOR,
  albumPixels,
  beginOpening,
  isClean,
  loadGame,
  pageOf,
  paintPageDirectly,
  paintRightDot,
  picturePixels,
  previewIndexOf,
  settleLong,
  startLeaving,
} from './pageToAlbumHelpers';

/**
 * Test k #141 AC4: malování omalovánky X se otevírá, zatímco přesun při
 * otevření Omalovánek ukládá X do alba. Malování nesmí začít s rozmalovanou
 * stránkou, kterou přesun vzápětí vyčistí: pak by v albu skončil X i X
 * s dalším tahem.
 *
 * Navržené rozhraní (z kontroly kódu): `PictureChoice.pageSettled(picture):
 * Promise<void>` skončí, až přesun tu omalovánku vyřídí, nebo hned, když ji
 * přesun nezpracovává ani na ni nečeká. Scéna čte stránku (`openColoring`)
 * až po něm.
 */

/** Záznamy, které každé uložení podrží, dokud ho test nepustí (po jednom). */
function heldRecords(inner: GameRecords): GameRecords & {
  releaseNext(): Promise<void>;
  waiting(): number;
} {
  const queue: Array<() => void> = [];
  return {
    list: () => inner.list(),
    remove: (id) => inner.remove(id),
    add: (data) =>
      new Promise<RecordsAdd>((finish) => {
        queue.push(() => {
          void inner.add(data).then(finish);
        });
      }),
    releaseNext: async () => {
      queue.shift()?.();
      await settleLong();
    },
    waiting: () => queue.length,
  };
}

describe('#141 AC4: malování se otevírá během ukládání té omalovánky do alba', () => {
  it('malování X se ukáže, zatímco zápis X do alba ještě čeká: po tahu a odchodu je v albu jen hotový obrázek, jednou', async () => {
    const device = new SwapDevice();
    const house = paintPageDirectly(device, HOUSE, PAGE_COLOR);
    const x = paintPageDirectly(device, STAR, THIRD_COLOR);
    let held: ReturnType<typeof heldRecords> | undefined;
    const page = loadGame(device, {
      records: (inner) => {
        held = heldRecords(inner);
        return held;
      },
    });
    if (held === undefined) {
      throw new Error('záznamy se nepřipravily');
    }
    const records = held;

    const { moving } = await beginOpening(page);
    await settleLong();
    expect(records.waiting(), 'přesun ukládá domek').toBe(1);
    const tap = page.choice.tapPreview(previewIndexOf(STAR));
    expect(tap.kind, 'hvězda, ke které přesun ještě nedošel, se otevírá').toBe('open');
    await records.releaseNext();
    expect(records.waiting(), 'přesun došel k hvězdě a ukládá ji').toBe(1);

    let settled = false;
    const pageReady = page.choice.pageSettled(STAR).then(() => {
      settled = true;
    });
    await settleLong();
    expect(settled, 'malování na stránku hvězdy čeká, dokud se ukládá').toBe(false);
    await records.releaseNext();
    await pageReady;

    const game = openColoring({
      regions: page.regions,
      picture: STAR,
      storage: page.storage,
      album: { records: page.records, contents: await readAlbum(page.records, page.pictures) },
    });
    page.choice.paintingShown();
    page.clock.now += HOLD_TO_GO_HOME_MS;
    expect(isClean(picturePixels(game)), 'malování začne s čistou stránkou').toBe(true);
    paintRightDot(game, SECOND_COLOR);
    const finished = picturePixels(game);
    const leaving = startLeaving(page, game);
    await settleLong();
    await records.releaseNext();
    await Promise.all([moving, leaving]);
    await settleLong();

    const album = await albumPixels(device);
    const xPlusStroke = x.map((pixel, index) => finished[index] ?? pixel);
    expect(timesIn(album, x), 'X je v albu jednou').toBe(1);
    expect(timesIn(album, xPlusStroke), 'X s dalším tahem v albu není').toBe(0);
    expect(timesIn(album, finished), 'hotový obrázek je v albu jednou').toBe(1);
    expect(timesIn(album, house), 'domek je v albu jednou').toBe(1);
    expect(album.length, 'nic navíc').toBe(3);
    expect(isClean(pageOf(device, STAR)), 'stránka hvězdy je čistá').toBe(true);
  });
});
