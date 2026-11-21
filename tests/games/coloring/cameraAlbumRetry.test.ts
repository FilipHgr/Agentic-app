import { describe, expect, it } from 'vitest';

import type { AlbumContents } from '../../../src/games/coloring/logic/album';
import { openColoring } from '../../../src/games/coloring/logic/savedPicture';
import type { GameRecords } from '../../../src/shared/storage/profileRecords';
import { HOUSE, albumDevice, albumOf, paintLeft, settle, shownCount } from './albumHelpers';
import { RecordingStorage, twoHalves } from './savedPictureHelpers';

/**
 * Testy k #185: na vytíženém zařízení se album napoprvé nepřečte (otevření
 * IndexedDB nestihne limit) a vrátí se jako nedostupné. Fotoaparát si pak
 * při ťuknutí vyžádá nové čtení alba; po přečtení další ťuknutí obrázek uloží.
 */

const ORANGE = 1;

/** Záznamy, jejichž prvních `failures` čtení skončí jako nedostupné (pomalé otevření). */
function recordsFailingFirstReads(failures: number): GameRecords {
  const inner = albumDevice().page();
  let failed = 0;
  return {
    ...inner,
    list: () => {
      if (failed < failures) {
        failed += 1;
        return Promise.resolve({ status: 'unavailable' });
      }
      return inner.list();
    },
  };
}

/** Čtení alba, které počítá vyžádání a dá se podržet, jako pomalé úložiště. */
function countedReading(records: GameRecords): {
  readonly readAgain: () => Promise<AlbumContents>;
  readonly requests: () => number;
  hold(): void;
  release(): Promise<void>;
} {
  let requests = 0;
  let holding = false;
  const waiting: Array<() => void> = [];
  return {
    readAgain: async () => {
      requests += 1;
      if (holding) {
        await new Promise<void>((resume) => waiting.push(resume));
      }
      return albumOf(records);
    },
    requests: () => requests,
    hold: () => {
      holding = true;
    },
    release: async () => {
      holding = false;
      for (const resume of waiting.splice(0)) {
        resume();
      }
      await settle();
    },
  };
}

describe('#185: fotoaparát uloží, i když se album napoprvé nepřečte', () => {
  it('po nepřečteném albu ťuknutí na fotoaparát zhoupne a vyžádá nové čtení, další ťuknutí obrázek uloží', async () => {
    const records = recordsFailingFirstReads(1);
    const reading = countedReading(records);
    const game = openColoring({
      regions: twoHalves(),
      picture: HOUSE,
      storage: new RecordingStorage(),
      album: {
        records,
        contents: { status: 'unavailable' },
        reading: albumOf(records),
        readAgain: reading.readAgain,
      },
    });
    await settle();
    paintLeft(game, ORANGE);

    expect(game.tapCamera().kind, 'první čtení alba se nepovedlo').toBe('wobble');
    expect(reading.requests(), 'ťuknutí si vyžádalo nové čtení').toBe(1);
    await settle();

    const tap = game.tapCamera();
    expect(tap.kind, 'album se mezitím přečetlo').toBe('saving');
    const result = tap.kind === 'saving' ? await tap.done : undefined;
    expect(result?.kind).toBe('saved');
    expect(await shownCount(records)).toBe(1);
  });

  it('během čtení alba se další ťuknutí jen zhoupnou a nové čtení nežádají', async () => {
    // Album z otevření se nepřečetlo, nové čtení se povede, ale je pomalé.
    const records = albumDevice().page();
    const reading = countedReading(records);
    reading.hold();
    const game = openColoring({
      regions: twoHalves(),
      picture: HOUSE,
      storage: new RecordingStorage(),
      album: { records, contents: { status: 'unavailable' }, readAgain: reading.readAgain },
    });
    paintLeft(game, ORANGE);

    expect(game.tapCamera().kind).toBe('wobble');
    expect(game.tapCamera().kind, 'čtení ještě běží').toBe('wobble');
    expect(game.tapCamera().kind, 'čtení ještě běží').toBe('wobble');
    expect(reading.requests(), 'nejvýš jedno čtení najednou').toBe(1);

    await reading.release();
    expect(game.tapCamera().kind, 'album se přečetlo').toBe('saving');
  });

  it('dokud běží čtení z otevření malování, ťuknutí nové čtení nežádá', async () => {
    const records = albumDevice().page();
    const reading = countedReading(records);
    let finishFirst: (contents: AlbumContents) => void = () => undefined;
    const firstReading = new Promise<AlbumContents>((finish) => {
      finishFirst = finish;
    });
    const game = openColoring({
      regions: twoHalves(),
      picture: HOUSE,
      storage: new RecordingStorage(),
      album: {
        records,
        contents: { status: 'unavailable' },
        reading: firstReading,
        readAgain: reading.readAgain,
      },
    });
    paintLeft(game, ORANGE);

    expect(game.tapCamera().kind, 'album se ještě čte').toBe('wobble');
    expect(reading.requests(), 'čte se album z otevření').toBe(0);

    finishFirst(await albumOf(records));
    await settle();
    expect(game.tapCamera().kind).toBe('saving');
    expect(reading.requests()).toBe(0);
  });

  it('když se album nepřečte ani podruhé, další ťuknutí ho zkusí přečíst znovu', async () => {
    const records = recordsFailingFirstReads(2);
    const reading = countedReading(records);
    const game = openColoring({
      regions: twoHalves(),
      picture: HOUSE,
      storage: new RecordingStorage(),
      album: {
        records,
        contents: { status: 'unavailable' },
        reading: albumOf(records),
        readAgain: reading.readAgain,
      },
    });
    await settle();
    paintLeft(game, ORANGE);

    expect(game.tapCamera().kind).toBe('wobble');
    await settle();
    expect(game.tapCamera().kind, 'ani druhé čtení se nepovedlo').toBe('wobble');
    expect(reading.requests(), 'druhé ťuknutí zkusilo čtení znovu').toBe(2);
    await settle();

    expect(game.tapCamera().kind, 'třetí čtení album přečetlo').toBe('saving');
  });

  it('přečtené album, které obrázek nepřijme (prázdný obrázek), se znovu nečte', async () => {
    const records = albumDevice().page();
    const reading = countedReading(records);
    const game = openColoring({
      regions: twoHalves(),
      picture: HOUSE,
      storage: new RecordingStorage(),
      album: { records, contents: await albumOf(records), readAgain: reading.readAgain },
    });

    expect(game.tapCamera().kind, 'prázdný obrázek').toBe('wobble');
    expect(reading.requests()).toBe(0);
  });

  it('dočasný profil bez záznamů album znovu nečte', () => {
    const reading = countedReading(albumDevice().page());
    const game = openColoring({
      regions: twoHalves(),
      picture: HOUSE,
      storage: new RecordingStorage(),
      album: {
        records: undefined,
        contents: { status: 'unavailable' },
        readAgain: reading.readAgain,
      },
    });
    paintLeft(game, ORANGE);

    expect(game.tapCamera().kind).toBe('wobble');
    expect(reading.requests()).toBe(0);
  });
});
