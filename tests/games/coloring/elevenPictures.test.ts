import { afterEach, describe, expect, it, vi } from 'vitest';

import { loadPicturePreview } from '../../../src/games/coloring/logic/picturePreview';
import type { PicturePreview } from '../../../src/games/coloring/logic/picturePreview';
import { COLORING_PICTURES } from '../../../src/games/coloring/logic/pictureSet';
import type { PictureIdentity } from '../../../src/games/coloring/logic/savedPicture';
import { COLORING_META } from '../../../src/games/coloring/meta';
import { openProfiles } from '../../../src/shared/storage/profileStorage';
import { DeviceStorage } from '../../shared/profileFixtures';
import {
  albumOf,
  albumPicturesOf,
  fillAlbum,
  paintLeft,
  takePhoto,
  openWithAlbum,
} from './albumHelpers';
import {
  SwapDevice,
  albumOn,
  choiceOn,
  openBigPicture,
  showPainting,
  tapContinue,
} from './continuePaintingHelpers';
import { holdTrash } from './bigPictureHelpers';
import {
  HOUSE,
  backToPicker,
  coloringStorage,
  enterPicker,
  openFromPicker,
} from './pictureChoiceHelpers';
import { EXPECTED_SET, FIRST_SIX_SET, SECOND_SET_IDS } from './realPicturesHelpers';
import { paint, paintedPixels, pixelsOf, twoHalves } from './savedPictureHelpers';
import { at } from './strokeHelpers';
import { MARKER_BLUE, giveColor, toolColorsOf } from './toolColorsHelpers';

/**
 * Testy k #132 AC1 (prvních 6 omalovánek se po rozšíření sady ukáže stejně)
 * a AC5 (okrajové případy: ťuknutí na náhled, album, malovat dál a plné
 * úložiště pro nové omalovánky). Sada je `COLORING_PICTURES` (11 omalovánek),
 * sada před #132 je `FIRST_SIX_SET` (domek a 5 omalovánek z #128), schválně
 * opsaná v `realPicturesHelpers.ts`.
 *
 * Logika výběru, ukládání a alba obrys nezná, všechny omalovánky mají proto
 * zkušební obrys `twoHalves()` jako v #124 a #128. Nenačtený obrys nových
 * omalovánek (AC5) testuje `realPictureSet.test.ts`, rozložení výběru (AC4)
 * `pickerLayoutRules.test.ts` a `albumLayoutRules.test.ts`.
 */

afterEach(() => {
  vi.useRealTimers();
});

/** Zápis klíče Omalovánek selže (plné úložiště jako v #92 AC5), ostatní klíče projdou. */
function failColoringWrites(storage: DeviceStorage): void {
  storage.failWrite = (key) => key.includes(`.${COLORING_META.id}.`);
}

function indexInSet(picture: PictureIdentity): number {
  return COLORING_PICTURES.findIndex(
    (each) => each.id === picture.id && each.version === picture.version,
  );
}

function newPictures(): PictureIdentity[] {
  return SECOND_SET_IDS.map((id) => ({ id, version: 1 }));
}

function previewCells(preview: PicturePreview): string[] {
  const cells: string[] = [];
  for (let y = 0; y < preview.height; y += 1) {
    for (let x = 0; x < preview.width; x += 1) {
      cells.push(JSON.stringify(preview.cellAt(x, y)));
    }
  }
  return cells;
}

describe('#132 AC1: prvních 6 omalovánek se po rozšíření sady ukáže stejně', () => {
  it('rozmalované obrázky a barvy nástrojů prvních 6 omalovánek z doby 6 omalovánek se s 11 omalovánkami ukážou pixel po pixelu stejně', () => {
    const device = new DeviceStorage();
    const regions = twoHalves();
    const before = FIRST_SIX_SET.map((_, index) => {
      const choice = enterPicker(FIRST_SIX_SET);
      const game = openFromPicker(choice, index, coloringStorage(openProfiles(device)), regions);
      giveColor(game, 'marker', MARKER_BLUE);
      giveColor(game, 'brush', index + 1);
      paint(game, [at(20, 40 + index * 20), at(140, 40 + index * 20)]);
      const shown = { pixels: pixelsOf(game, regions), tools: toolColorsOf(game) };
      backToPicker(choice, game);
      return shown;
    });

    FIRST_SIX_SET.forEach((picture, index) => {
      expect(indexInSet(picture), `${picture.id} je na stejné pozici`).toBe(index);
      const choice = enterPicker(COLORING_PICTURES);
      const game = openFromPicker(choice, index, coloringStorage(openProfiles(device)), regions);
      expect(pixelsOf(game, regions), `${picture.id}: obrázek pixel po pixelu`).toEqual(
        before[index]?.pixels,
      );
      expect(toolColorsOf(game), `${picture.id}: barvy nástrojů`).toEqual(before[index]?.tools);
    });
  });

  it('náhledy prvních 6 omalovánek na výběru s 11 omalovánkami ukazují stejné barvy jako se 6', () => {
    const storage = coloringStorage(openProfiles(new DeviceStorage()));
    const regions = twoHalves();
    FIRST_SIX_SET.forEach((_, index) => {
      const choice = enterPicker(FIRST_SIX_SET);
      const game = openFromPicker(choice, index, storage, regions);
      game.tapColor(index + 1);
      paint(game, [at(20, 100), at(140, 100)]);
      backToPicker(choice, game);
    });

    const shownBefore = FIRST_SIX_SET.map((picture) =>
      previewCells(loadPicturePreview({ storage, picture, regions, width: 40, height: 30 })),
    );
    enterPicker(COLORING_PICTURES)
      .previews()
      .slice(0, 6)
      .forEach((picture, index) => {
        expect(
          previewCells(loadPicturePreview({ storage, picture, regions, width: 40, height: 30 })),
          `náhled ${picture.id}`,
        ).toEqual(shownBefore[index]);
      });
  });

  it('album s obrázky prvních 6 omalovánek se s 11 omalovánkami ukáže celé, ve stejném pořadí a pixel po pixelu stejně', async () => {
    const device = new SwapDevice();
    const records = device.records();
    for (const picture of FIRST_SIX_SET) {
      await fillAlbum(records, 1, picture, FIRST_SIX_SET);
    }
    const regions = twoHalves();
    const before = await albumOf(records, FIRST_SIX_SET);
    const after = await albumOf(records, COLORING_PICTURES);

    expect(before.status).toBe('read');
    expect(after.status).toBe('read');
    const entriesBefore = before.status === 'read' ? before.entries : [];
    const entriesAfter = after.status === 'read' ? after.entries : [];
    expect(entriesBefore.length, 'obrázků v albu před #132').toBe(6);
    expect(
      entriesAfter.map((entry) => entry.picture),
      'omalovánky obrázků alba od nejnovějšího',
    ).toEqual(entriesBefore.map((entry) => entry.picture));
    entriesAfter.forEach((entry, index) => {
      const old = entriesBefore[index];
      expect(
        pixelsOf(entry.colors, regions),
        `obrázek alba ${index + 1} (${entry.picture.id})`,
      ).toEqual(old === undefined ? [] : pixelsOf(old.colors, regions));
    });
  });
});

describe('#132 AC5: ťuknutí na náhled nové omalovánky', () => {
  it('ťuknutí na kterýkoli z 11 náhledů otevře právě tuto omalovánku', () => {
    expect(COLORING_PICTURES).toEqual(EXPECTED_SET);
    COLORING_PICTURES.forEach((picture, index) => {
      const choice = enterPicker(COLORING_PICTURES);
      expect(choice.tapPreview(index), `náhled ${index + 1}`).toMatchObject({
        kind: 'open',
        index,
        picture,
      });
      choice.paintingShown();
      expect(choice.screen(), `malování ${picture.id}`).toEqual({ kind: 'painting', picture });
    });
  });

  it('rychlé dvojí ťuknutí na náhled nové omalovánky ji otevře jen jednou', () => {
    for (const picture of newPictures()) {
      const index = indexInSet(picture);
      const choice = enterPicker(COLORING_PICTURES);
      const taps = [choice.tapPreview(index), choice.tapPreview(index)];
      expect(
        taps.filter((tap) => tap.kind === 'open'),
        picture.id,
      ).toHaveLength(1);
      expect(choice.screen(), picture.id).toEqual({ kind: 'opening', picture });
    }
  });

  it('dva prsty na dvou nových náhledech otevřou jen první omalovánku', () => {
    const [first, second] = newPictures();
    if (first === undefined || second === undefined) {
      throw new Error('chybí nové omalovánky');
    }
    const choice = enterPicker(COLORING_PICTURES);
    expect(choice.tapPreview(indexInSet(first))).toMatchObject({ kind: 'open', picture: first });
    expect(choice.tapPreview(indexInSet(second)), 'druhý prst').toEqual({ kind: 'ignored' });
    choice.paintingShown();
    expect(choice.screen()).toEqual({ kind: 'painting', picture: first });
  });
});

describe('#132 AC5: album funguje i pro nové omalovánky (#126, #129)', () => {
  it('obrázek nové omalovánky vyfocený fotoaparátem je v albu u své omalovánky', async () => {
    const device = new SwapDevice();
    const records = device.records();
    const regions = twoHalves();
    for (const [index, picture] of newPictures().entries()) {
      const game = await openWithAlbum({
        storage: undefined,
        records,
        picture,
        pictures: COLORING_PICTURES,
      });
      paintLeft(game, index + 1);
      const photographed = pixelsOf(game, regions);
      const result = await takePhoto(game);
      expect(result.kind, `${picture.id}: uložení do alba`).toBe('saved');

      const album = await albumOf(records, COLORING_PICTURES);
      const newest = album.status === 'read' ? album.entries[0] : undefined;
      expect(newest?.picture, `${picture.id}: nejnovější obrázek alba`).toEqual(picture);
      expect(
        newest === undefined ? [] : pixelsOf(newest.colors, regions),
        `${picture.id}: pixel po pixelu`,
      ).toEqual(photographed);
    }
  });

  it('kniha otevře album s obrázky nových omalovánek a ťuknutí na obrázek ukáže velký obrázek', async () => {
    const device = new SwapDevice();
    for (const picture of newPictures()) {
      await fillAlbum(device.records(), 1, picture, COLORING_PICTURES);
    }
    vi.useFakeTimers();
    const page = choiceOn(device, { pictures: albumPicturesOf(COLORING_PICTURES) });
    const album = await albumOn(page);
    const shown = album.status === 'read' ? album.entries.map((entry) => entry.picture) : [];
    expect(shown, 'album od nejnovějšího').toEqual(newPictures().reverse());

    const entry = await openBigPicture(page, 0);
    expect(entry.picture, 'velký obrázek nejnovější omalovánky').toEqual(
      newPictures()[newPictures().length - 1],
    );
  });

  it('obrázek nové omalovánky jde v albu smazat podržením koše 1 s', async () => {
    const device = new SwapDevice();
    const unicorn: PictureIdentity = { id: 'unicorn', version: 1 };
    await fillAlbum(device.records(), 2, unicorn, COLORING_PICTURES);
    vi.useFakeTimers();
    const page = choiceOn(device, { pictures: albumPicturesOf(COLORING_PICTURES) });
    await openBigPicture(page, 0);

    const result = await holdTrash({
      choice: page.choice,
      records: page.records,
      feedback: page.trashFeedback,
    });
    expect(result, 'obrázek jednorožce se smazal').toEqual({ kind: 'deleted' });
    const album = await albumOn(page);
    expect(album.status === 'read' ? album.entries.length : -1, 'zbyl 1 obrázek').toBe(1);
  });
});

describe('#132 AC5: malovat dál funguje i pro nové omalovánky (#131)', () => {
  it('štětec na velkém obrázku nové omalovánky otevře malování té omalovánky s obrázkem z alba', async () => {
    for (const picture of newPictures()) {
      vi.useRealTimers();
      const device = new SwapDevice();
      await fillAlbum(device.records(), 2, picture, COLORING_PICTURES);
      vi.useFakeTimers();
      const page = choiceOn(device, { pictures: albumPicturesOf(COLORING_PICTURES) });
      const entry = await openBigPicture(page, 1);
      const albumPicture = pixelsOf(entry.colors, page.regions);

      const outcome = await tapContinue(page);
      expect(outcome, `${picture.id}: štětec otevře malování`).toEqual({
        kind: 'opened',
        picture,
      });
      const game = await showPainting(page, picture);
      expect(pixelsOf(game, page.regions), `${picture.id}: obrázek z alba`).toEqual(albumPicture);
    }
  });

  it('malovat dál u nové omalovánky nezmění rozmalované stránky ostatních omalovánek', async () => {
    const device = new SwapDevice();
    const regions = twoHalves();
    const sea: PictureIdentity = { id: 'sea', version: 1 };
    await fillAlbum(device.records(), 1, sea, COLORING_PICTURES);
    const house = await openWithAlbum({
      storage: device.storage(),
      records: device.records(),
      picture: HOUSE,
      pictures: COLORING_PICTURES,
    });
    paintLeft(house, 7);
    house.suspend();
    const houseBefore = pixelsOf(house, regions);

    vi.useFakeTimers();
    const page = choiceOn(device, { pictures: albumPicturesOf(COLORING_PICTURES) });
    await openBigPicture(page, 0);
    expect(await tapContinue(page), 'otevře se moře').toEqual({ kind: 'opened', picture: sea });

    COLORING_PICTURES.filter((picture) => picture.id !== 'sea').forEach((picture) => {
      const index = indexInSet(picture);
      const choice = enterPicker(COLORING_PICTURES);
      const game = openFromPicker(choice, index, device.storage(), regions);
      if (picture.id === 'house') {
        expect(pixelsOf(game, regions), 'domek').toEqual(houseBefore);
      } else {
        expect(paintedPixels(game, regions), picture.id).toBe(0);
      }
    });
  });
});

describe('#132 AC5: plné úložiště platí pro každou z 11 omalovánek zvlášť (#92 AC5)', () => {
  it('při plném úložišti jde malovat v každé z 11 omalovánek bez chyby a po návratu má každá svůj obrázek', () => {
    const device = new DeviceStorage();
    const store = openProfiles(device);
    failColoringWrites(device);
    const regions = twoHalves();
    const choice = enterPicker(COLORING_PICTURES);

    const before: Array<Array<number | null>> = [];
    expect(() => {
      COLORING_PICTURES.forEach((_, index) => {
        const game = openFromPicker(choice, index, coloringStorage(store), regions);
        game.tapColor(index % 12);
        paint(game, [at(20, 10 + index * 16), at(140, 10 + index * 16)]);
        before.push(pixelsOf(game, regions));
        backToPicker(choice, game);
      });
    }).not.toThrow();

    COLORING_PICTURES.forEach((picture, index) => {
      const game = openFromPicker(choice, index, coloringStorage(store), regions);
      expect(pixelsOf(game, regions), picture.id).toEqual(before[index]);
      backToPicker(choice, game);
    });
  });

  it('nepodařené uložení nové omalovánky nezmění uložený obrázek jiné omalovánky', () => {
    const device = new DeviceStorage();
    const regions = twoHalves();
    const choice = enterPicker(COLORING_PICTURES);
    const cat = openFromPicker(choice, 1, coloringStorage(openProfiles(device)), regions);
    paint(cat, [at(20, 100), at(140, 100)]);
    const catPixels = pixelsOf(cat, regions);
    backToPicker(choice, cat);

    failColoringWrites(device);
    for (const picture of newPictures()) {
      const game = openFromPicker(
        choice,
        indexInSet(picture),
        coloringStorage(openProfiles(device)),
        regions,
      );
      paint(game, [at(200, 50), at(260, 50)]);
      backToPicker(choice, game);
    }

    device.failWrite = () => false;
    const reloaded = enterPicker(COLORING_PICTURES);
    const again = openFromPicker(reloaded, 1, coloringStorage(openProfiles(device)), regions);
    expect(pixelsOf(again, regions), 'kočka po obnovení').toEqual(catPixels);
    for (const picture of newPictures()) {
      const game = openFromPicker(
        enterPicker(COLORING_PICTURES),
        indexInSet(picture),
        coloringStorage(openProfiles(device)),
        regions,
      );
      expect(paintedPixels(game, regions), `${picture.id}: nic se neuložilo`).toBe(0);
    }
  });
});
