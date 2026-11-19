import { afterEach, describe, expect, it, vi } from 'vitest';

import { readAlbum } from '../../../src/games/coloring/logic/album';
import type { BroomFeedback } from '../../../src/games/coloring/logic/pictureChoice';
import { startPictureChoice } from '../../../src/games/coloring/logic/pictureChoice';
import {
  openPictureLocks,
  unlockPaintedPictures,
} from '../../../src/games/coloring/logic/pictureLocks';
import type { PictureLocks } from '../../../src/games/coloring/logic/pictureLocks';
import { loadPicturePreview } from '../../../src/games/coloring/logic/picturePreview';
import type { PicturePreview } from '../../../src/games/coloring/logic/picturePreview';
import { COLORING_PICTURES } from '../../../src/games/coloring/logic/pictureSet';
import { openColoring } from '../../../src/games/coloring/logic/savedPicture';
import type { PictureIdentity } from '../../../src/games/coloring/logic/savedPicture';
import { HOLD_TO_GO_HOME_MS, HOME_WOBBLE_TONES } from '../../../src/shared/logic/homeButton';
import { openProfiles } from '../../../src/shared/storage/profileStorage';
import { DeviceStorage } from '../../shared/profileFixtures';
import {
  albumOf,
  albumPicturesOf,
  fillAlbum,
  openWithAlbum,
  paintLeft,
  takePhoto,
} from './albumHelpers';
import { holdTrash } from './bigPictureHelpers';
import {
  SwapDevice,
  albumOn,
  choiceOn,
  openBigPicture,
  showPainting,
  tapContinue,
} from './continuePaintingHelpers';
import {
  backToPicker,
  coloringStorage,
  enterPicker,
  openFromPicker,
  tapSetPreview,
} from './pictureChoiceHelpers';
import {
  LOCKED_IDS,
  choiceWith,
  completeMaps,
  enterColoring,
  loadPage,
  lockClock,
  lockDevice,
  lockedIdsOf,
  paintAndReturn,
  paintPage,
  pictureOf,
  snapshotOf,
  tapPicture,
  unlockByTap,
} from './pictureLocksHelpers';
import type { LockPage } from './pictureLocksHelpers';
import { EXPECTED_SET, SET_BEFORE_152, THIRD_SET, THIRD_SET_IDS } from './realPicturesHelpers';
import { paint, paintedPixels, pixelsOf, twoHalves } from './savedPictureHelpers';
import { at } from './strokeHelpers';
import { MARKER_BLUE, giveColor, toolColorsOf } from './toolColorsHelpers';

/**
 * Testy k #152: pět nových omalovánek (dinosaurus, raketa, traktor, hrad,
 * sova) na konci pořadí sady, zamčených jako v #140. Sada ve hře je
 * `COLORING_PICTURES`, sada před #152 je `SET_BEFORE_152` (papír a 11
 * omalovánek), schválně opsaná v `realPicturesHelpers.ts`.
 *
 * Se 17 náhledy má výběr 2 stránky po 12 (#150): nové omalovánky jsou na
 * 2. stránce na místech 1–5. Dítě se k nim dostane šipkou ▶
 * (`tapSetPreview`, `tapPicture`), `PreviewTap.index` je místo na stránce.
 *
 * Logika výběru, ukládání, alba a zámků obrys nezná, všechny omalovánky
 * mají proto zkušební obrys `twoHalves()` jako v #124, #128 a #132.
 * Obrysy PNG (AC2) a původ (AC5) testuje `realPictureOutlines.test.ts`,
 * stažení obrysů až s hrou `tests/shared/boundaries.test.ts`, pořadí sady
 * a nenačtený obrys (AC4) `realPictureSet.test.ts`.
 */

afterEach(() => {
  vi.useRealTimers();
});

/** Místo omalovánky v sadě ve hře (0 je papír). */
function indexInSet(picture: PictureIdentity): number {
  return COLORING_PICTURES.findIndex(
    (each) => each.id === picture.id && each.version === picture.version,
  );
}

/** Místo nové omalovánky na 2. stránce výběru (0–4), spočítané z pořadí v zadání. */
function placeOnSecondPage(id: string): number {
  return THIRD_SET_IDS.findIndex((each) => each === id);
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

/**
 * Dítě otevře Omalovánky ve verzi před #152: scéna jednou odemkne
 * rozmalované omalovánky a otevře zámky nad sadou papíru a 11 omalovánek
 * (jako `enterColoring`, jen se sadou před #152).
 */
async function enterColoringBefore152(page: LockPage): Promise<PictureLocks> {
  const pictures = albumPicturesOf(SET_BEFORE_152);
  const album = await readAlbum(page.records, pictures);
  unlockPaintedPictures({ storage: page.storage, pictures, album });
  return openPictureLocks({
    pictures: SET_BEFORE_152,
    storage: page.storage,
    keyRewards: page.keys,
  });
}

/** Dítě ve verzi před #152 odemkne klíči všech 8 tehdy zamčených omalovánek. */
async function unlockAllBefore152(page: LockPage): Promise<PictureLocks> {
  const locks = await enterColoringBefore152(page);
  const choice = startPictureChoice(SET_BEFORE_152, { now: lockClock, locks });
  for (const id of LOCKED_IDS.filter((each) => !THIRD_SET_IDS.some((added) => added === each))) {
    const index = SET_BEFORE_152.findIndex((picture) => picture.id === id);
    expect(choice.tapPreview(index).kind, `před #152: ${id} se odemkne`).toBe('unlocked');
    paintAndReturn(choice);
  }
  return locks;
}

describe('#152 AC1: pět nových omalovánek na konci sady', () => {
  it('na konci sady přibude dinosaurus, raketa, traktor, hrad a sova, každá s vlastním označením verze 1', () => {
    expect(COLORING_PICTURES).toEqual(EXPECTED_SET);
    expect(COLORING_PICTURES.slice(-5), 'posledních 5 omalovánek').toEqual(THIRD_SET);
    for (const picture of THIRD_SET) {
      expect(
        COLORING_PICTURES.filter((each) => each.id === picture.id),
        picture.id,
      ).toEqual([{ id: picture.id, version: 1 }]);
    }
  });

  it('dosavadní papír a 11 omalovánek zůstanou na začátku sady ve stejném pořadí se stejným označením', () => {
    expect(COLORING_PICTURES.slice(0, SET_BEFORE_152.length)).toEqual(SET_BEFORE_152);
    expect(enterPicker(COLORING_PICTURES).pagePreviews(), '1. stránka výběru').toEqual(
      SET_BEFORE_152,
    );
  });

  it('ťuknutí na náhled nové omalovánky na 2. stránce otevře právě tuto omalovánku', () => {
    for (const picture of THIRD_SET) {
      const choice = enterPicker(COLORING_PICTURES);
      expect(tapSetPreview(choice, indexInSet(picture)), picture.id).toMatchObject({
        kind: 'open',
        index: placeOnSecondPage(picture.id),
        picture,
      });
      choice.paintingShown();
      expect(choice.screen(), `malování ${picture.id}`).toEqual({ kind: 'painting', picture });
    }
  });
});

describe('#152 AC1: stránky, album a barvy dosavadních omalovánek se ukážou stejně', () => {
  it('rozmalované stránky a barvy nástrojů papíru a 11 omalovánek z doby před #152 se po rozšíření ukážou pixel po pixelu stejně', () => {
    const device = new DeviceStorage();
    const regions = twoHalves();
    const before = SET_BEFORE_152.map((_, index) => {
      const choice = enterPicker(SET_BEFORE_152);
      const game = openFromPicker(choice, index, coloringStorage(openProfiles(device)), regions);
      giveColor(game, 'marker', MARKER_BLUE);
      giveColor(game, 'brush', index % 12);
      paint(game, [at(20, 10 + index * 15), at(140, 10 + index * 15)]);
      const shown = { pixels: pixelsOf(game, regions), tools: toolColorsOf(game) };
      backToPicker(choice, game);
      return shown;
    });

    SET_BEFORE_152.forEach((picture, index) => {
      const place = indexInSet(picture);
      expect(place, `${picture.id} je na stejném místě sady`).toBe(index);
      const choice = enterPicker(COLORING_PICTURES);
      const game = openFromPicker(choice, place, coloringStorage(openProfiles(device)), regions);
      expect(pixelsOf(game, regions), `${picture.id}: stránka pixel po pixelu`).toEqual(
        before[index]?.pixels,
      );
      expect(toolColorsOf(game), `${picture.id}: barvy nástrojů`).toEqual(before[index]?.tools);
    });
  });

  it('náhledy dosavadních omalovánek na 1. stránce výběru ukazují po rozšíření stejné barvy', () => {
    const storage = coloringStorage(openProfiles(new DeviceStorage()));
    const regions = twoHalves();
    SET_BEFORE_152.forEach((_, index) => {
      const choice = enterPicker(SET_BEFORE_152);
      const game = openFromPicker(choice, index, storage, regions);
      game.tapColor(index % 12);
      paint(game, [at(20, 100), at(140, 100)]);
      backToPicker(choice, game);
    });
    const shownBefore = SET_BEFORE_152.map((picture) =>
      previewCells(loadPicturePreview({ storage, picture, regions, width: 40, height: 30 })),
    );

    enterPicker(COLORING_PICTURES)
      .pagePreviews()
      .forEach((picture, index) => {
        expect(
          previewCells(loadPicturePreview({ storage, picture, regions, width: 40, height: 30 })),
          `náhled ${picture.id}`,
        ).toEqual(shownBefore[index]);
      });
  });

  it('album s obrázky dosavadních omalovánek se po rozšíření ukáže celé, ve stejném pořadí a pixel po pixelu stejně', async () => {
    const device = new SwapDevice();
    const records = device.records();
    for (const picture of SET_BEFORE_152) {
      await fillAlbum(records, 1, picture, SET_BEFORE_152);
    }
    const regions = twoHalves();
    const before = await albumOf(records, SET_BEFORE_152);
    const after = await albumOf(records, COLORING_PICTURES);

    expect(before.status).toBe('read');
    expect(after.status).toBe('read');
    const entriesBefore = before.status === 'read' ? before.entries : [];
    const entriesAfter = after.status === 'read' ? after.entries : [];
    expect(entriesBefore.length, 'obrázků v albu před #152').toBe(SET_BEFORE_152.length);
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

  it('nové omalovánky začínají s prázdnou stránkou, i když dítě dosavadní omalovánky rozmalovalo', () => {
    const storage = coloringStorage(openProfiles(new DeviceStorage()));
    const regions = twoHalves();
    SET_BEFORE_152.forEach((_, index) => {
      const choice = enterPicker(SET_BEFORE_152);
      const game = openFromPicker(choice, index, storage, regions);
      paint(game, [at(20, 100), at(140, 100)]);
      backToPicker(choice, game);
    });

    for (const picture of THIRD_SET) {
      const game = openFromPicker(
        enterPicker(COLORING_PICTURES),
        indexInSet(picture),
        storage,
        regions,
      );
      expect(paintedPixels(game, regions), picture.id).toBe(0);
    }
  });
});

describe('#152 AC3: nové omalovánky jsou zamčené a odemkne je klíč (#140)', () => {
  it('nový profil má všech 5 nových omalovánek zamčených', async () => {
    const locks = await enterColoring(loadPage(lockDevice()));

    for (const id of THIRD_SET_IDS) {
      expect(locks.isLocked(pictureOf(id)), id).toBe(true);
    }
    expect(lockedIdsOf(locks).slice(-5), 'zamčené na konci sady').toEqual([...THIRD_SET_IDS]);
  });

  it('jeden klíč odemkne kteroukoli z 5 nových omalovánek, ta se hned otevře a ostatní zůstanou zamčené', async () => {
    for (const id of THIRD_SET_IDS) {
      const page = loadPage(lockDevice());
      completeMaps(page.keys, 2);
      const locks = await enterColoring(page);
      const choice = choiceWith(locks);

      const tap = tapPicture(choice, id);

      expect(tap, id).toMatchObject({
        kind: 'unlocked',
        index: placeOnSecondPage(id),
        picture: pictureOf(id),
      });
      expect(choice.screen(), `${id}: otevírá se`).toEqual({
        kind: 'opening',
        picture: pictureOf(id),
      });
      expect(page.keys.balance().wholeKeys, `${id}: klíč je spotřebovaný`).toBe(0);
      expect(lockedIdsOf(locks), id).toEqual(LOCKED_IDS.filter((each) => each !== id));
    }
  });

  it('odemčená nová omalovánka zůstane odemčená po obnovení stránky', async () => {
    const device = lockDevice();
    const page = loadPage(device);
    completeMaps(page.keys, 2);
    unlockByTap(choiceWith(await enterColoring(page)), 'owl');

    const reloaded = await enterColoring(loadPage(device));
    expect(reloaded.isLocked(pictureOf('owl')), 'sova po obnovení').toBe(false);
    expect(tapPicture(choiceWith(reloaded), 'owl').kind, 'otevře se bez klíče').toBe('open');
  });

  it('bez celého klíče se ťuknutím nová omalovánka jen zhoupne s tónem domečku a nic se nezmění', async () => {
    for (const maps of [0, 1]) {
      const device = lockDevice();
      const page = loadPage(device);
      completeMaps(page.keys, maps);
      const locks = await enterColoring(page);
      const choice = choiceWith(locks);
      const indicator = locks.keyIndicator();
      const before = snapshotOf(device);

      for (const id of THIRD_SET_IDS) {
        const what = `${maps} map, ${id}`;
        expect(tapPicture(choice, id), what).toEqual({
          kind: 'locked',
          index: placeOnSecondPage(id),
          tones: HOME_WOBBLE_TONES,
        });
        expect(choice.screen(), `${what}: zůstane výběr`).toEqual({ kind: 'picker' });
      }

      expect(lockedIdsOf(locks), `${maps} map`).toEqual(LOCKED_IDS);
      expect(locks.keyIndicator(), `${maps} map: ukazatel stejný`).toEqual(indicator);
      expect(snapshotOf(device), `${maps} map: nic se nezapsalo`).toEqual(before);
    }
  });

  it('profil, který měl klíči odemčené všechno, má po rozšíření zamčené jen nové omalovánky a ukazatel klíčů se znovu ukáže', async () => {
    const device = lockDevice();
    const page = loadPage(device);
    completeMaps(page.keys, 16);
    const before = await unlockAllBefore152(page);
    expect(before.keyIndicator(), 'před #152: všechno odemčené, ukazatel není').toBeNull();

    const after = await enterColoring(loadPage(device));

    expect(lockedIdsOf(after), 'zamčené jsou jen nové').toEqual([...THIRD_SET_IDS]);
    expect(after.keyIndicator(), 'ukazatel se znovu ukáže s 0 klíči').toEqual({
      wholeKeys: 0,
      hasHalf: false,
    });
  });

  it('profil, který měl všechno odemčené zdarma rozmalováním, má po rozšíření zamčené jen nové omalovánky a ukazatel se ukáže', async () => {
    const device = lockDevice();
    const page = loadPage(device);
    for (const id of LOCKED_IDS.filter((each) => !THIRD_SET_IDS.some((added) => added === each))) {
      paintPage(page, id);
    }
    completeMaps(page.keys, 3);
    const before = await enterColoringBefore152(page);
    expect(before.keyIndicator(), 'před #152: všechno odemčené, ukazatel není').toBeNull();

    const after = await enterColoring(loadPage(device));

    expect(lockedIdsOf(after), 'zamčené jsou jen nové').toEqual([...THIRD_SET_IDS]);
    expect(after.keyIndicator(), 'ukazatel s klíčem a půlkou').toEqual({
      wholeKeys: 1,
      hasHalf: true,
    });
  });

  it('klíč, který zbyl profilu se vším odemčeným, odemkne novou omalovánku', async () => {
    const device = lockDevice();
    const page = loadPage(device);
    completeMaps(page.keys, 18);
    await unlockAllBefore152(page);

    const after = await enterColoring(loadPage(device));
    expect(after.keyIndicator(), 'zbyl jeden klíč').toEqual({ wholeKeys: 1, hasHalf: false });
    unlockByTap(choiceWith(after), 'dinosaur');

    expect(lockedIdsOf(after)).toEqual(['rocket', 'tractor', 'castle', 'owl']);
  });

  it('dosavadní odemčení klíčem i zdarma po rozšíření zůstane a klíče se nezmění', async () => {
    const device = lockDevice();
    const page = loadPage(device);
    paintPage(page, 'fish');
    completeMaps(page.keys, 3);
    const locks = await enterColoringBefore152(page);
    const choice = startPictureChoice(SET_BEFORE_152, { now: lockClock, locks });
    const car = SET_BEFORE_152.findIndex((picture) => picture.id === 'car');
    expect(choice.tapPreview(car).kind, 'před #152: auto se odemkne klíčem').toBe('unlocked');
    const keysBefore = loadPage(device).keys.balance();

    const after = await enterColoring(loadPage(device));

    expect(lockedIdsOf(after)).toEqual(LOCKED_IDS.filter((id) => id !== 'car' && id !== 'fish'));
    expect(loadPage(device).keys.balance(), 'klíče beze změny').toEqual(keysBefore);
  });
});

describe('#152 AC4: nenačtený obrys nové omalovánky (#128 AC4, #140 AC2)', () => {
  it('když se obrys nové omalovánky nestáhne, klíč ji neodemkne a klíč zůstane; po stažení ji odemkne', async () => {
    const device = lockDevice();
    const page = loadPage(device);
    completeMaps(page.keys, 2);
    const locks = await enterColoring(page, { missingOutlines: [...THIRD_SET_IDS] });

    const tap = tapPicture(choiceWith(locks), 'dinosaur');

    expect(tap.kind, 'dinosaurus se klíčem neodemkne').not.toBe('unlocked');
    expect(page.keys.balance().wholeKeys, 'klíč zůstane').toBe(1);
    expect(page.keys.spentItems(), 'nic se neutratilo').toEqual([]);

    const reopened = await enterColoring(loadPage(device));
    unlockByTap(choiceWith(reopened), 'dinosaur');
    expect(reopened.isLocked(pictureOf('dinosaur')), 'po stažení obrysu odemčený').toBe(false);
  });
});

describe('#152 AC4: album, fotoaparát, koště a Malovat dál fungují i pro nové omalovánky', () => {
  it('obrázek nové omalovánky vyfocený fotoaparátem je v albu u své omalovánky', async () => {
    const device = new SwapDevice();
    const records = device.records();
    const regions = twoHalves();
    for (const [index, picture] of THIRD_SET.entries()) {
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
    for (const picture of THIRD_SET) {
      await fillAlbum(device.records(), 1, picture, COLORING_PICTURES);
    }
    vi.useFakeTimers();
    const page = choiceOn(device, { pictures: albumPicturesOf(COLORING_PICTURES) });
    const album = await albumOn(page);
    const shown = album.status === 'read' ? album.entries.map((entry) => entry.picture) : [];
    expect(shown, 'album od nejnovějšího').toEqual([...THIRD_SET].reverse());

    const entry = await openBigPicture(page, 0);
    expect(entry.picture, 'velký obrázek sovy').toEqual({ id: 'owl', version: 1 });
  });

  it('obrázek nové omalovánky jde v albu smazat podržením koše 1 s', async () => {
    const device = new SwapDevice();
    const castle: PictureIdentity = { id: 'castle', version: 1 };
    await fillAlbum(device.records(), 2, castle, COLORING_PICTURES);
    vi.useFakeTimers();
    const page = choiceOn(device, { pictures: albumPicturesOf(COLORING_PICTURES) });
    await openBigPicture(page, 0);

    const result = await holdTrash({
      choice: page.choice,
      records: page.records,
      feedback: page.trashFeedback,
    });
    expect(result, 'obrázek hradu se smazal').toEqual({ kind: 'deleted' });
    const album = await albumOn(page);
    expect(album.status === 'read' ? album.entries.length : -1, 'zbyl 1 obrázek').toBe(1);
  });

  it('štětec Malovat dál na velkém obrázku nové omalovánky otevře malování té omalovánky s obrázkem z alba', async () => {
    for (const picture of THIRD_SET) {
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

  it('podržení koštěte 1 s vymaže rozmalovanou stránku nové omalovánky otevřené z 2. stránky výběru', async () => {
    for (const picture of THIRD_SET) {
      vi.useFakeTimers();
      const device = new SwapDevice();
      const storage = device.storage();
      const records = device.records();
      const pictures = albumPicturesOf(COLORING_PICTURES);
      const regions = twoHalves();
      const feedback: BroomFeedback[] = [];
      const choice = startPictureChoice(COLORING_PICTURES, {
        now: () => Date.now(),
        records,
        storage,
        albumPictures: pictures,
        onBroom: (event) => {
          feedback.push(event);
        },
      });
      expect(tapSetPreview(choice, indexInSet(picture)).kind, picture.id).toBe('open');
      const contents = await readAlbum(records, pictures);
      const game = openColoring({
        regions,
        picture,
        storage,
        album: { records, contents },
        origin: 'picker',
      });
      choice.attachPainting(game);
      choice.paintingShown();
      vi.advanceTimersByTime(HOLD_TO_GO_HOME_MS);
      paintLeft(game, 3);
      expect(paintedPixels(game, regions), `${picture.id}: dítě malovalo`).toBeGreaterThan(0);

      choice.broomButton.press(1);
      vi.advanceTimersByTime(1000);
      choice.broomButton.release(1);

      expect(
        feedback.filter((event) => event.kind === 'cleared').length,
        `${picture.id}: koště stránku zrušilo`,
      ).toBe(1);
      expect(paintedPixels(game, regions), `${picture.id}: čistý obrys`).toBe(0);
      expect(choice.screen().kind, `${picture.id}: dítě zůstane v malování`).toBe('painting');
      vi.useRealTimers();
    }
  });
});
