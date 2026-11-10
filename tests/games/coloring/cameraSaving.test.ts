import { describe, expect, it } from 'vitest';

import { CAMERA_CLICK_TONES } from '../../../src/games/coloring/logic/album';
import { PREVIEW_TAP_TONES } from '../../../src/games/coloring/logic/pictureChoice';
import { loadPicturePreview } from '../../../src/games/coloring/logic/picturePreview';
import type { SavedColoring } from '../../../src/games/coloring/logic/savedPicture';
import { COLOR_TOOLS } from '../../../src/games/coloring/logic/toolColors';
import { HOME_WOBBLE_TONES } from '../../../src/shared/logic/homeButton';
import { PROFILE_LIST_KEY, openProfiles } from '../../../src/shared/storage/profileStorage';
import { DeviceStorage } from '../../shared/profileFixtures';
import { memoryDevice } from '../../shared/profileRecordsFixtures';
import {
  CIRCLES,
  COLORING_GAME_ID,
  HOUSE,
  STAR,
  addUnreadable,
  albumDevice,
  albumOf,
  damageAlbum,
  fillAlbum,
  openWithAlbum,
  paintLeft,
  recordCount,
  shownCount,
  takePhoto,
  watchRecords,
} from './albumHelpers';
import { choose, endOf } from './drawingToolHelpers';
import { RecordingStorage, paint, paintedPixels, pixelsOf, twoHalves } from './savedPictureHelpers';
import { at } from './strokeHelpers';

/**
 * Testy k #126 AC1 (uložení do alba) a AC2 (kdy se neuloží). Fotoaparát
 * je v malování (`SavedColoring.tapCamera`), album v záznamech hry
 * aktivního profilu z #125. Hra album přečte při otevření omalovánky
 * (`readAlbum`), takže po ťuknutí hned ví, jestli se obrázek uloží:
 * - (a) neuloží se: fotoaparát se jen zhoupne s tónem domečku
 *   (`{ kind: 'wobble' }`), bez cvaku a animace,
 * - (b) uloží se: hned cvak a animace (`{ kind: 'saving', tones, done }`),
 *   omalovánka se vyčistí až po potvrzeném uložení (`done` skončí
 *   `{ kind: 'saved' }`), při „plné“ nebo „nedostupné“ zůstane beze změny
 *   a fotoaparát se zhoupne (`{ kind: 'failed', tones }`),
 * - (c) během ukládání se fotoaparát jen zhoupne a nic dalšího neuloží.
 *
 * Animace (záblesk, stisknutí, odlet fotky) a zvuk jsou ruční kontrola
 * (AC1); logika vrací jen tóny a výsledek, podle kterého scéna animuje.
 * Cvak je podle doporučení k otázce 7 krátký dvojtón z přehrávače tónů.
 */

const ORANGE = 1;
const BLUE = 4;
/** Barva z konce sad nástrojů (#116), aby album hlídalo i vysoká čísla barev. */
const LAST_SET_COLOR = 45;

/** Celý obrázek po pixelech. */
function picturePixels(game: { colorAt(x: number, y: number): number | null }) {
  return pixelsOf(game, twoHalves());
}

/** Omalovánka s obrázkem ve dvou barvách v obou polovinách. */
function paintTwoColors(game: SavedColoring): void {
  paintLeft(game, ORANGE);
  game.tapColor(LAST_SET_COLOR);
  paint(game, [at(170, 40), at(280, 160)]);
}

/** Nový zápis do alba: zařízení se záznamy a hlídaný přístup hry k nim. */
function watchedAlbum() {
  const device = albumDevice();
  return { device, records: watchRecords(device.page()) };
}

describe('#126 AC1: ťuknutí na fotoaparát uloží hotový obrázek do alba', () => {
  it('ťuknutí na fotoaparát u namalovaného obrázku hned zahraje cvak a začne ukládat', async () => {
    const { records } = watchedAlbum();
    const game = await openWithAlbum({ storage: new RecordingStorage(), records });
    paintLeft(game, ORANGE);

    const tap = game.tapCamera();

    expect(tap.kind, 'cvak a animace').toBe('saving');
    expect(tap.kind === 'saving' ? tap.tones : [], 'tón cvaku').toEqual(CAMERA_CLICK_TONES);
    expect(records.adds(), 'ukládá se hned po ťuknutí').toBe(1);
  });

  it('cvak je nový krátký dvojtón, jiný než tón domečku a tón náhledu (otázka 7)', () => {
    expect(CAMERA_CLICK_TONES.length, 'dva tóny').toBe(2);
    expect(endOf(CAMERA_CLICK_TONES), 'krátký, dozní do 0,3 s').toBeLessThanOrEqual(0.3);
    expect(CAMERA_CLICK_TONES).not.toEqual(HOME_WOBBLE_TONES);
    expect(CAMERA_CLICK_TONES).not.toEqual(PREVIEW_TAP_TONES);
  });

  it('obrázek v albu aktivního profilu je pixel po pixelu stejný jako v malování', async () => {
    const { records } = watchedAlbum();
    const game = await openWithAlbum({ storage: new RecordingStorage(), records });
    paintTwoColors(game);
    const painted = picturePixels(game);

    expect((await takePhoto(game)).kind).toBe('saved');

    const album = await albumOf(records);
    expect(album.status).toBe('read');
    const entries = album.status === 'read' ? album.entries : [];
    expect(entries.length, 'v albu je jeden obrázek').toBe(1);
    expect(entries[0]?.picture, 'obrázek patří vyfocené omalovánce').toEqual(HOUSE);
    expect(picturePixels(entries[0]?.colors ?? game), 'pixel po pixelu').toEqual(painted);
  });

  it('obrázek v albu je pixel po pixelu stejný i po obnovení stránky', async () => {
    const device = albumDevice();
    const game = await openWithAlbum({ storage: new RecordingStorage(), records: device.page() });
    paintTwoColors(game);
    const painted = picturePixels(game);
    await takePhoto(game);

    const reloaded = await albumOf(device.page());

    const entries = reloaded.status === 'read' ? reloaded.entries : [];
    expect(entries.length).toBe(1);
    expect(picturePixels(entries[0]?.colors ?? game)).toEqual(painted);
  });

  it('omalovánka je čistá jako nová stránka teprve po potvrzeném uložení', async () => {
    const { records } = watchedAlbum();
    const game = await openWithAlbum({ storage: new RecordingStorage(), records });
    paintTwoColors(game);
    const painted = picturePixels(game);
    records.holdAdds();

    const tap = game.tapCamera();
    await Promise.resolve();
    expect(picturePixels(game), 'během ukládání zůstává obrázek').toEqual(painted);

    await records.releaseAdds();
    const result = tap.kind === 'saving' ? await tap.done : undefined;
    expect(result?.kind, 'uložení potvrzené').toBe('saved');
    expect(paintedPixels(game, twoHalves()), 'po uložení čistá stránka').toBe(0);
  });

  it('po uložení je omalovánka čistá i po návratu a její náhled na výběru ukazuje jen obrys', async () => {
    const storage = new RecordingStorage();
    const regions = twoHalves();
    const game = await openWithAlbum({ storage, records: albumDevice().page(), regions });
    paintTwoColors(game);

    await takePhoto(game);
    game.suspend();

    const reopened = await openWithAlbum({ storage, records: albumDevice().page(), regions });
    expect(paintedPixels(reopened, regions), 'znovu otevřená omalovánka').toBe(0);
    const preview = loadPicturePreview({ storage, picture: HOUSE, regions, width: 60, height: 40 });
    const kinds = new Set<string>();
    for (let y = 0; y < preview.height; y += 1) {
      for (let x = 0; x < preview.width; x += 1) {
        kinds.add(preview.cellAt(x, y).kind);
      }
    }
    expect([...kinds], 'náhled nemá žádnou barvu dítěte, jen pozadí a obrys').not.toContain(
      'color',
    );
  });

  it('po uložení zůstanou barvy nástrojů, nedávné barvy a tloušťka čáry, i po novém otevření', async () => {
    const storage = new RecordingStorage();
    const records = albumDevice().page();
    const game = await openWithAlbum({ storage, records });
    choose(game, 'marker');
    game.tapColor(BLUE);
    game.tapLineSize('large');
    paintLeft(game, LAST_SET_COLOR);
    const toolColors = COLOR_TOOLS.map((tool) => game.toolColor(tool));
    const recent = game.recentColors();

    await takePhoto(game);

    expect(
      COLOR_TOOLS.map((tool) => game.toolColor(tool)),
      'barvy nástrojů',
    ).toEqual(toolColors);
    expect(game.recentColors(), 'nedávné barvy').toEqual(recent);
    expect(game.lineSize(), 'tloušťka čáry').toBe('large');

    game.suspend();
    const reopened = await openWithAlbum({ storage, records });
    expect(
      COLOR_TOOLS.map((tool) => reopened.toolColor(tool)),
      'po otevření',
    ).toEqual(toolColors);
    expect(reopened.recentColors(), 'nedávné barvy po otevření').toEqual(recent);
    expect(reopened.lineSize(), 'tloušťka po otevření').toBe('large');
  });

  it('Zpět po uložení se jen zhoupne se stejným tónem jako domeček a uložený obrázek nevrátí', async () => {
    const records = albumDevice().page();
    const game = await openWithAlbum({ storage: new RecordingStorage(), records });
    paintTwoColors(game);
    await takePhoto(game);

    const undo = game.tapUndo();

    expect(undo).toEqual({ kind: 'wobble', tones: HOME_WOBBLE_TONES });
    expect(paintedPixels(game, twoHalves()), 'stránka zůstane čistá').toBe(0);
    expect(await shownCount(records), 'obrázek v albu zůstane').toBe(1);
  });

  it('dítě zůstane v malování na čisté stránce, může malovat dál a vyfotit další obrázek (otázka 6)', async () => {
    const records = albumDevice().page();
    const game = await openWithAlbum({ storage: new RecordingStorage(), records });
    paintLeft(game, ORANGE);
    await takePhoto(game);

    paintLeft(game, BLUE);
    const second = picturePixels(game);
    expect((await takePhoto(game)).kind, 'druhý obrázek se uloží').toBe('saved');

    const album = await albumOf(records);
    const entries = album.status === 'read' ? album.entries : [];
    expect(entries.length).toBe(2);
    expect(picturePixels(entries[0]?.colors ?? game), 'nejnovější první').toEqual(second);
  });
});

describe('#126 AC2 (a): hra pozná hned, že se obrázek neuloží', () => {
  /** Ťuknutí, které se jen zhoupne: tón domečku, bez cvaku a bez ukládání. */
  function expectWobbleOnly(game: SavedColoring, adds: () => number, what: string): void {
    const before = adds();
    expect(game.tapCamera(), what).toEqual({ kind: 'wobble', tones: HOME_WOBBLE_TONES });
    expect(adds(), `${what}: nic se neukládá`).toBe(before);
  }

  it('prázdná omalovánka hned po otevření se neuloží, fotoaparát se jen zhoupne', async () => {
    const { records } = watchedAlbum();
    const game = await openWithAlbum({ storage: new RecordingStorage(), records });

    expectWobbleOnly(game, records.adds, 'prázdná omalovánka');
    expect(await shownCount(records)).toBe(0);
  });

  it('vygumovaný obrázek je pixel po pixelu jako čistá omalovánka a neuloží se', async () => {
    const { records } = watchedAlbum();
    const game = await openWithAlbum({ storage: new RecordingStorage(), records });
    game.tapColor(ORANGE);
    paint(game, [at(60, 60), at(70, 70)]);
    game.tapLineSize('large');
    choose(game, 'eraser');
    const zigzag = Array.from({ length: 21 }, (_, row) =>
      row % 2 === 0 ? [at(0, row * 10), at(148, row * 10)] : [at(148, row * 10), at(0, row * 10)],
    ).flat();
    paint(game, zigzag);
    expect(paintedPixels(game, twoHalves()), 'předpoklad: vše vygumované').toBe(0);

    expectWobbleOnly(game, records.adds, 'vygumovaný obrázek');
  });

  it('obrázek vrácený tlačítkem Zpět až do čisté omalovánky se neuloží', async () => {
    const { records } = watchedAlbum();
    const game = await openWithAlbum({ storage: new RecordingStorage(), records });
    paintLeft(game, ORANGE);
    game.tapUndo();
    expect(paintedPixels(game, twoHalves()), 'předpoklad: tah vrácený').toBe(0);

    expectWobbleOnly(game, records.adds, 'vrácený obrázek');
  });

  it('obrázek pixel po pixelu stejný jako obrázek té omalovánky v albu se neuloží podruhé', async () => {
    const { records } = watchedAlbum();
    const game = await openWithAlbum({ storage: new RecordingStorage(), records });
    paintLeft(game, ORANGE);
    await takePhoto(game);

    paintLeft(game, ORANGE);
    expectWobbleOnly(game, records.adds, 'stejný obrázek jako v albu');
    expect(await shownCount(records)).toBe(1);
  });

  it('stejný obrázek po novém otevření omalovánky se také neuloží podruhé', async () => {
    const { records } = watchedAlbum();
    const first = await openWithAlbum({ storage: new RecordingStorage(), records });
    paintLeft(first, BLUE);
    await takePhoto(first);

    const second = await openWithAlbum({ storage: new RecordingStorage(), records });
    paintLeft(second, BLUE);

    expectWobbleOnly(second, records.adds, 'stejný obrázek po novém otevření');
  });

  it('stejně vymalovaná jiná omalovánka se uloží, porovnává se jen s obrázky té omalovánky', async () => {
    const records = albumDevice().page();
    const circles = await openWithAlbum({ storage: undefined, records, picture: CIRCLES });
    paintLeft(circles, ORANGE);
    await takePhoto(circles);

    const house = await openWithAlbum({ storage: undefined, records, picture: HOUSE });
    paintLeft(house, ORANGE);

    expect((await takePhoto(house)).kind).toBe('saved');
    expect(await shownCount(records)).toBe(2);
  });

  it('obrázek, který se od obrázku v albu liší jedinou barvou, se uloží', async () => {
    const records = albumDevice().page();
    const game = await openWithAlbum({ storage: undefined, records });
    paintLeft(game, ORANGE);
    await takePhoto(game);

    paintLeft(game, ORANGE + 1);

    expect((await takePhoto(game)).kind).toBe('saved');
  });

  it('s 12 zobrazitelnými obrázky v albu se další obrázek neuloží', async () => {
    const { records } = watchedAlbum();
    await fillAlbum(records, 6, HOUSE);
    await fillAlbum(records, 6, CIRCLES);
    expect(await shownCount(records), 'předpoklad: plné album').toBe(12);
    const game = await openWithAlbum({ storage: undefined, records, picture: STAR });
    paintLeft(game, ORANGE);

    expectWobbleOnly(game, records.adds, 'plné album');
    expect(await shownCount(records)).toBe(12);
  });

  it('s 11 zobrazitelnými obrázky se 12. obrázek ještě uloží a další už ne', async () => {
    const { records } = watchedAlbum();
    await fillAlbum(records, 11, CIRCLES);
    const game = await openWithAlbum({ storage: undefined, records });
    paintLeft(game, ORANGE);

    expect((await takePhoto(game)).kind, '12. obrázek').toBe('saved');
    paintLeft(game, BLUE);
    expectWobbleOnly(game, records.adds, '13. obrázek ve stejném malování');
    expect(await shownCount(records)).toBe(12);
  });

  it('s 24 záznamy v profilu včetně nečitelných se obrázek neuloží', async () => {
    const { records } = watchedAlbum();
    await fillAlbum(records, 11, CIRCLES);
    await addUnreadable(records, 13);
    expect(await recordCount(records), 'předpoklad: 24 záznamů').toBe(24);
    const game = await openWithAlbum({ storage: undefined, records });
    paintLeft(game, ORANGE);

    expectWobbleOnly(game, records.adds, '24 záznamů');
    expect(await recordCount(records)).toBe(24);
  });

  it('s 23 záznamy v profilu včetně nečitelných se obrázek ještě uloží', async () => {
    const { records } = watchedAlbum();
    await fillAlbum(records, 11, CIRCLES);
    await addUnreadable(records, 12);
    const game = await openWithAlbum({ storage: undefined, records });
    paintLeft(game, ORANGE);

    expect((await takePhoto(game)).kind).toBe('saved');
    expect(await recordCount(records)).toBe(24);
  });

  it('v dočasném profilu se obrázek neuloží, fotoaparát se jen zhoupne', async () => {
    const device = memoryDevice();
    const page = openProfiles(new DeviceStorage({ [PROFILE_LIST_KEY]: '{' }), device.open());
    const records = watchRecords(page.gameRecords(COLORING_GAME_ID));
    const game = await openWithAlbum({
      storage: page.gameStorage(COLORING_GAME_ID),
      records,
    });
    paintLeft(game, ORANGE);

    expectWobbleOnly(game, records.adds, 'dočasný profil');
    expect(paintedPixels(game, twoHalves()), 'obrázek zůstane').toBeGreaterThan(0);
  });
});

describe('#126 AC2 (b): úložiště po cvaku vrátí „plné“ nebo „nedostupné“', () => {
  for (const failure of ['full', 'unavailable'] as const) {
    it(`po „${failure === 'full' ? 'plné' : 'nedostupné'}“ zůstane obrázek beze změny a fotoaparát se zhoupne s tónem domečku`, async () => {
      const storage = new RecordingStorage();
      const { records } = watchedAlbum();
      const game = await openWithAlbum({ storage, records });
      paintTwoColors(game);
      const painted = picturePixels(game);
      records.failAdds(failure);

      const tap = game.tapCamera();
      expect(tap.kind, 'hned cvak a animace').toBe('saving');
      const result = tap.kind === 'saving' ? await tap.done : undefined;

      expect(result).toEqual({ kind: 'failed', tones: HOME_WOBBLE_TONES });
      expect(picturePixels(game), 'obrázek v malování beze změny').toEqual(painted);
      game.suspend();
      const reopened = await openWithAlbum({ storage, records });
      expect(picturePixels(reopened), 'uložená omalovánka beze změny').toEqual(painted);
      expect(await shownCount(records), 'album beze změny').toBe(0);
    });
  }
});

describe('#126 AC2 (c): ťuknutí během ukládání', () => {
  it('ťuknutí na fotoaparát během ukládání ho jen zhoupne a nic dalšího neuloží', async () => {
    const { records } = watchedAlbum();
    const game = await openWithAlbum({ storage: new RecordingStorage(), records });
    paintLeft(game, ORANGE);
    records.holdAdds();

    const first = game.tapCamera();
    const second = game.tapCamera();
    const third = game.tapCamera();

    expect(first.kind).toBe('saving');
    expect(second, 'druhé ťuknutí').toEqual({ kind: 'wobble', tones: HOME_WOBBLE_TONES });
    expect(third, 'třetí ťuknutí').toEqual({ kind: 'wobble', tones: HOME_WOBBLE_TONES });
    await records.releaseAdds();
    if (first.kind === 'saving') {
      await first.done;
    }
    expect(records.adds(), 'uložilo se jen jednou').toBe(1);
    expect(await shownCount(records)).toBe(1);
  });
});

describe('#126 AC2: nečitelné záznamy se nemažou', () => {
  it('uložení ani plné album nečitelné a poškozené záznamy nesmaže', async () => {
    const device = albumDevice();
    const setup = device.page();
    await fillAlbum(setup, 2, CIRCLES);
    damageAlbum(device.shelf);
    await addUnreadable(setup, 3);
    const before = device.shelf.records.map((record) => record.id);
    const records = watchRecords(device.page());

    const game = await openWithAlbum({ storage: undefined, records });
    paintLeft(game, ORANGE);
    await takePhoto(game);
    await fillAlbum(records, 11, STAR);
    const full = await openWithAlbum({ storage: undefined, records });
    paintLeft(full, BLUE);
    expect(full.tapCamera().kind, 'plné album').toBe('wobble');

    expect(records.removes(), 'hra nic nemazala').toBe(0);
    const after = device.shelf.records.map((record) => record.id);
    expect(after.slice(0, before.length), 'staré záznamy zůstaly').toEqual(before);
  });
});
