import { describe, expect, it } from 'vitest';

import { COLORING_GAME_AREA_FIT } from '../../../src/games/coloring/logic/coloringLayout';
import {
  PICKER_PLACES,
  layoutPicker,
  previewAt,
} from '../../../src/games/coloring/logic/pickerLayout';
import {
  loadPicturePreview,
  previewCellHex,
} from '../../../src/games/coloring/logic/picturePreview';
import type { PicturePreview, PreviewCell } from '../../../src/games/coloring/logic/picturePreview';
import { COLORING_PICTURES } from '../../../src/games/coloring/logic/pictureSet';
import { buildRegionMap, outlineFromImage } from '../../../src/games/coloring/logic/regionMap';
import type { RegionMap } from '../../../src/games/coloring/logic/regionMap';
import type { PictureIdentity } from '../../../src/games/coloring/logic/savedPicture';
import { gameAreaFor } from '../../../src/shared/logic/viewportLayout';
import { openProfiles } from '../../../src/shared/storage/profileStorage';
import { DeviceStorage } from '../../shared/profileFixtures';
import { viewportOf } from '../../shared/viewportFixtures';
import {
  albumDevice,
  albumOf,
  fillAlbum,
  openWithAlbum,
  recordCount,
  watchRecords,
} from './albumHelpers';
import { COLORING_WINDOWS } from './coloringLayoutScenes';
import {
  CIRCLES,
  HOUSE,
  STAR,
  THREE_PICTURES,
  backToPicker,
  coloringStorage,
  enterPicker,
  openFromPicker,
} from './pictureChoiceHelpers';
import {
  EXPECTED_SET,
  NEW_PICTURE_IDS,
  OUTLINE_HEIGHT,
  OUTLINE_WIDTH,
  PICTURE_FILES,
  outlineFileName,
} from './realPicturesHelpers';
import {
  RecordingStorage,
  openOn,
  paint,
  paintedPixels,
  pixelsOf,
  twoHalves,
} from './savedPictureHelpers';
import { at } from './strokeHelpers';

/**
 * Testy k #128 AC1 (sada omalovánek) a AC4 (uložené obrázky kruhů a hvězdy,
 * výpadek stahování obrysu, opětovné otevření).
 *
 * Sada je `COLORING_PICTURES` v `logic/pictureSet.ts`. Logika výběru
 * a ukládání obrys nezná, testy výběru proto dávají všem omalovánkám
 * zkušební obrys `twoHalves()` jako v #124. Obrys, který se nenačte, dá
 * ve hře prázdné plátno: `outlineFromImage` nad úplně průhledným snímkem
 * 1024 × 768 (`scenes/pictureCanvas.ts` tak kreslí i bez obrázku).
 *
 * Záznamy kruhů a hvězdy vzniknou jako dnes: malováním omalovánky
 * s označením `circles` a `star` verze 1. Jejich úklid je mimo rozsah,
 * zůstanou v úložišti beze změny.
 */

const REMOVED_IDS = ['circles', 'star'];

/** Úplně průhledný snímek plátna, když se obrys nenačte. */
function blankSnapshot() {
  return {
    width: OUTLINE_WIDTH,
    height: OUTLINE_HEIGHT,
    data: new Uint8ClampedArray(OUTLINE_WIDTH * OUTLINE_HEIGHT * 4),
  };
}

/** Mapa oblastí omalovánky, jejíž obrys se nenačetl. */
function regionsWithoutOutline(): RegionMap {
  return buildRegionMap(outlineFromImage(blankSnapshot()));
}

function indexInSet(picture: PictureIdentity): number {
  return COLORING_PICTURES.findIndex(
    (each) => each.id === picture.id && each.version === picture.version,
  );
}

/** Úložiště hry, ve kterém dítě dřív namalovalo kruhy, hvězdu a domek. */
function storageWithOldPictures(): RecordingStorage {
  const storage = new RecordingStorage();
  const regions = twoHalves();
  [CIRCLES, STAR, HOUSE].forEach((picture, index) => {
    const game = openOn(storage, regions, picture);
    game.tapColor(index + 1);
    paint(game, [at(20, 100), at(140, 100)]);
    game.suspend();
  });
  return storage;
}

function cellsOf(preview: PicturePreview): PreviewCell[] {
  const cells: PreviewCell[] = [];
  for (let y = 0; y < preview.height; y += 1) {
    for (let x = 0; x < preview.width; x += 1) {
      cells.push(preview.cellAt(x, y));
    }
  }
  return cells;
}

describe('#128 AC1: na výběru je 6 skutečných omalovánek', () => {
  it('sada má 6 omalovánek ve stálém pořadí: domek, kočka, pejsek, auto, motýl, rybka', () => {
    expect(COLORING_PICTURES).toEqual(EXPECTED_SET);
  });

  it('výběr ve hře ukáže náhledy domku, kočky, pejska, auta, motýla a rybky v tomto pořadí', () => {
    const choice = enterPicker(COLORING_PICTURES);
    expect(choice.screen()).toEqual({ kind: 'picker' });
    expect(choice.previews()).toEqual(EXPECTED_SET);
  });

  it('kruhy a hvězda nejsou v sadě ani mezi obrázky omalovánek', () => {
    const ids = COLORING_PICTURES.map((picture) => picture.id);
    for (const removed of REMOVED_IDS) {
      expect(ids, removed).not.toContain(removed);
      const files = Object.keys(PICTURE_FILES).filter((name) => name.startsWith(`${removed}.`));
      expect(files, `soubor obrysu ${removed}`).toEqual([]);
    }
  });

  it('domek má dál označení house verze 1 a nové omalovánky mají vlastní označení s verzí 1', () => {
    expect(COLORING_PICTURES.find((picture) => picture.id === 'house')).toEqual(HOUSE);
    for (const id of NEW_PICTURE_IDS) {
      expect(
        COLORING_PICTURES.filter((picture) => picture.id === id),
        id,
      ).toEqual([{ id, version: 1 }]);
    }
    const ids = COLORING_PICTURES.map((picture) => picture.id);
    expect(new Set(ids).size, 'každá omalovánka má vlastní označení').toBe(ids.length);
  });

  it('každá omalovánka sady má obrys: domek house.svg, nové omalovánky <id>.png', () => {
    for (const picture of COLORING_PICTURES) {
      const file = picture.id === 'house' ? 'house.svg' : outlineFileName(picture.id);
      expect(PICTURE_FILES[file], `${picture.id}: ${file}`).toBeDefined();
    }
  });

  it('všech 6 omalovánek zaplní mřížku výběru z #124 bez posouvání', () => {
    expect(COLORING_PICTURES.length, 'míst v mřížce').toBe(PICKER_PLACES);
  });

  it('ťuknutí doprostřed náhledu otevře jeho omalovánku ve všech oknech', () => {
    for (const window of COLORING_WINDOWS) {
      const layout = layoutPicker(gameAreaFor(viewportOf(window), COLORING_GAME_AREA_FIT));
      COLORING_PICTURES.forEach((picture, index) => {
        const place = layout.previews[index];
        expect(place, `${window.name}: místo náhledu ${picture.id}`).toBeDefined();
        if (place === undefined) {
          return;
        }
        const tapped = previewAt(
          layout,
          place.left + place.width / 2,
          place.top + place.height / 2,
        );
        expect(tapped, `${window.name}: ${picture.id}`).toBe(index);
        const choice = enterPicker(COLORING_PICTURES);
        expect(choice.tapPreview(index), `${window.name}: ${picture.id}`).toMatchObject({
          kind: 'open',
          picture,
        });
      });
    }
  });
});

describe('#128 AC4: uložené obrázky kruhů a hvězdy', () => {
  it('uložené obrázky kruhů a hvězdy se na výběru neukážou', () => {
    const storage = storageWithOldPictures();
    expect(
      storage.keys().filter((key) => REMOVED_IDS.some((id) => key.includes(id))).length,
      'kruhy a hvězda mají uložený obrázek',
    ).toBeGreaterThan(0);
    const previews = enterPicker(COLORING_PICTURES).previews();
    const shown = previews.filter((picture) => REMOVED_IDS.includes(picture.id));
    expect(shown).toEqual([]);
  });

  it('kvůli uloženým kruhům a hvězdě se hra nezastaví: každá omalovánka sady se otevře z výběru', () => {
    const storage = storageWithOldPictures();
    const regions = twoHalves();
    COLORING_PICTURES.forEach((picture, index) => {
      const choice = enterPicker(COLORING_PICTURES);
      const game = openFromPicker(choice, index, storage, regions);
      const painted = paintedPixels(game, regions);
      if (picture.id === 'house') {
        expect(painted, 'domek ukáže svůj obrázek').toBeGreaterThan(0);
      } else {
        expect(painted, `${picture.id} začíná prázdná`).toBe(0);
      }
    });
  });

  it('otevření výběru, náhledů a všech omalovánek nic nesmaže ani nepřepíše, ani záznamy kruhů a hvězdy', () => {
    const storage = storageWithOldPictures();
    const before = new Map(storage.data);
    const regions = twoHalves();
    for (const picture of COLORING_PICTURES) {
      loadPicturePreview({ storage, picture, regions, width: 64, height: 48 });
    }
    COLORING_PICTURES.forEach((_, index) => {
      const choice = enterPicker(COLORING_PICTURES);
      const game = openFromPicker(choice, index, storage, regions);
      backToPicker(choice, game);
    });
    for (const [key, value] of before) {
      expect(storage.data.get(key), key).toBe(value);
    }
  });

  it('obrázky kruhů a hvězdy v albu se neukážou, album se přečte a nic se z něj nesmaže', async () => {
    const device = albumDevice();
    const records = watchRecords(device.page());
    await fillAlbum(records, 1, CIRCLES, THREE_PICTURES);
    await fillAlbum(records, 1, STAR, THREE_PICTURES);
    await fillAlbum(records, 1, HOUSE, THREE_PICTURES);
    const total = await recordCount(records);

    const album = await albumOf(records, COLORING_PICTURES);
    expect(album.status).toBe('read');
    const shown = album.status === 'read' ? album.entries.map((entry) => entry.picture.id) : [];
    expect(shown, 'v albu je jen domek').toEqual(['house']);

    for (const picture of COLORING_PICTURES) {
      await openWithAlbum({ storage: undefined, records, picture, pictures: COLORING_PICTURES });
    }
    expect(records.removes(), 'nic se nemazalo').toBe(0);
    expect(await recordCount(records), 'záznamy zůstaly').toBe(total);
  });
});

describe('#128 AC4: obrys se nenačte (výpadek stahování)', () => {
  it('bez obrysu je celá plocha 1024 × 768 jedna oblast', () => {
    const regions = regionsWithoutOutline();
    expect(regions.width).toBe(OUTLINE_WIDTH);
    expect(regions.height).toBe(OUTLINE_HEIGHT);
    expect(regions.regionCount).toBe(1);
    expect(regions.regionIds.every((region) => region === 1)).toBe(true);
  });

  it('bez obrysu jde malovat jako dnes: tah přes celou plochu barví všude, kudy prst jel', () => {
    const regions = regionsWithoutOutline();
    const game = openOn(new RecordingStorage(), regions, { id: 'cat', version: 1 });
    paint(game, [at(10, 10), at(1013, 757)]);
    expect(game.colorAt(10, 10), 'začátek tahu').not.toBeNull();
    expect(game.colorAt(512, 384), 'střed plochy').not.toBeNull();
    expect(game.colorAt(1013, 757), 'konec tahu').not.toBeNull();
  });

  it('náhled omalovánky bez obrysu ukáže uložené barvy a žádný obrys', () => {
    const regions = regionsWithoutOutline();
    const storage = new RecordingStorage();
    const picture: PictureIdentity = { id: 'cat', version: 1 };
    const game = openOn(storage, regions, picture);
    paint(game, [at(10, 10), at(1013, 757)]);
    game.suspend();

    const cells = cellsOf(
      loadPicturePreview({ storage, picture, regions, width: 171, height: 128 }),
    );
    expect(
      cells.filter((cell) => cell.kind === 'outline'),
      'žádný obrys',
    ).toEqual([]);
    expect(
      cells.some((cell) => cell.kind === 'color'),
      'uložené barvy jsou vidět',
    ).toBe(true);
  });

  it('nemalovaná omalovánka bez obrysu má bílý náhled', () => {
    const regions = regionsWithoutOutline();
    for (const picture of COLORING_PICTURES) {
      const preview = loadPicturePreview({
        storage: new RecordingStorage(),
        picture,
        regions,
        width: 64,
        height: 48,
      });
      const colors = new Set(cellsOf(preview).map(previewCellHex));
      expect([...colors], picture.id).toEqual(['#FFFFFF']);
    }
  });
});

describe('#128 AC4: opětovné otevření omalovánky ukáže její rozmalovaný stav', () => {
  it('každá nová omalovánka se po návratu na výběr a novém otevření ukáže stejně, jak ji dítě nechalo', () => {
    const storage = coloringStorage(openProfiles(new DeviceStorage()));
    const regions = twoHalves();
    for (const id of NEW_PICTURE_IDS) {
      const index = indexInSet({ id, version: 1 });
      expect(index, `${id} je v sadě`).toBeGreaterThanOrEqual(0);
      const choice = enterPicker(COLORING_PICTURES);
      const game = openFromPicker(choice, index, storage, regions);
      game.tapColor(2);
      paint(game, [at(20, 100), at(140, 100)]);
      const left = pixelsOf(game, regions);
      backToPicker(choice, game);

      const again = openFromPicker(choice, index, storage, regions);
      expect(paintedPixels(again, regions), `${id}: obrázek se uložil`).toBeGreaterThan(0);
      expect(pixelsOf(again, regions), `${id}: pixel po pixelu`).toEqual(left);
    }
  });

  it('rozmalování jedné nové omalovánky se neukáže v jiné', () => {
    const storage = coloringStorage(openProfiles(new DeviceStorage()));
    const regions = twoHalves();
    const catIndex = indexInSet({ id: 'cat', version: 1 });
    expect(catIndex, 'kočka je v sadě').toBeGreaterThanOrEqual(0);
    const choice = enterPicker(COLORING_PICTURES);
    const cat = openFromPicker(choice, catIndex, storage, regions);
    paint(cat, [at(20, 100), at(140, 100)]);
    backToPicker(choice, cat);

    for (const id of NEW_PICTURE_IDS.filter((each) => each !== 'cat')) {
      const other = openFromPicker(choice, indexInSet({ id, version: 1 }), storage, regions);
      expect(paintedPixels(other, regions), id).toBe(0);
      backToPicker(choice, other);
    }
  });
});
