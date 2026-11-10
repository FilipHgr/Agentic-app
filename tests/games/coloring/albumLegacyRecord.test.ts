import { describe, expect, it } from 'vitest';

import type { RecordData } from '../../../src/shared/storage/profileRecords';
import { HOME_WOBBLE_TONES } from '../../../src/shared/logic/homeButton';
import {
  THREE_PICTURES,
  addUnreadable,
  albumDevice,
  albumOf,
  openWithAlbum,
  paintLeft,
  recordCount,
  shownCount,
  watchRecords,
} from './albumHelpers';
import {
  LEGACY_ALBUM_PICTURE,
  legacyAlbumPixels,
  legacyAlbumRecord,
  legacyAlbumRegions,
} from './legacyAlbumRecordFixture';
import { pixelsOf } from './savedPictureHelpers';

/**
 * Testy k #126, rozhodnutí koordinátora 4: obrázek uložený do alba dnešní
 * verzí (pevný záznam v `legacyAlbumRecordFixture.ts`) se přečte beze
 * změny i po budoucích změnách formátu.
 *
 * A podle doporučení security k #125 album při čtení ověří obsah každého
 * záznamu: záznam, který se od platného liší tvarem nebo obsahem, se
 * v albu nezobrazí, nesmaže se a do limitu 24 záznamů se počítá.
 */

const ORANGE = 1;

/** Záznamy alba s jedním záznamem `data` uloženým rovnou do úložiště. */
async function recordsWith(data: RecordData) {
  const device = albumDevice();
  const records = device.page();
  const added = await records.add(data);
  expect(added.status, 'záznam je v úložišti').toBe('saved');
  return { device, records };
}

/** Kopie bajtů vrstvy pevného záznamu. */
function legacyLayer(): Uint8Array {
  const layer = legacyAlbumRecord()['layer'];
  if (!(layer instanceof Uint8Array)) {
    throw new Error('pevný záznam nemá bajty vrstvy');
  }
  return layer;
}

describe('#126: obrázek uložený do alba dnešní verzí se přečte beze změny', () => {
  it('pevný záznam alba se v albu ukáže pixel po pixelu jako v malování před vyfocením', async () => {
    const { records } = await recordsWith(legacyAlbumRecord());
    const regions = legacyAlbumRegions();

    const album = await albumOf(records, THREE_PICTURES, regions);

    expect(album.status).toBe('read');
    const entries = album.status === 'read' ? album.entries : [];
    expect(entries.length, 'v albu je jeden obrázek').toBe(1);
    expect(entries[0]?.picture, 'obrázek patří domku').toEqual(LEGACY_ALBUM_PICTURE);
    expect(
      entries[0] === undefined ? [] : pixelsOf(entries[0].colors, regions),
      'pixel po pixelu',
    ).toEqual(legacyAlbumPixels());
  });

  it('obrázek z pevného záznamu se počítá do alba: kniha album otevře a obrázek patří do limitu', async () => {
    const { records } = await recordsWith(legacyAlbumRecord());

    expect(await shownCount(records)).toBe(1);
    expect(await recordCount(records)).toBe(1);
  });
});

describe('#126 (doporučení security k #125): album při čtení ověří obsah záznamu', () => {
  const changed: ReadonlyArray<readonly [string, () => RecordData]> = [
    ['pole navíc', () => ({ ...legacyAlbumRecord(), nickname: 'EMA' })],
    [
      'chybí pole s verzí',
      () => {
        const { layerCode, pictureId, layer } = legacyAlbumRecord();
        return { layerCode, pictureId, layer };
      },
    ],
    ['neznámý formát vrstvy', () => ({ ...legacyAlbumRecord(), layerCode: 'p9' })],
    ['omalovánka jako číslo', () => ({ ...legacyAlbumRecord(), pictureId: 1 })],
    ['verze jako text', () => ({ ...legacyAlbumRecord(), pictureVersion: '1' })],
    ['vrstva jako seznam čísel', () => ({ ...legacyAlbumRecord(), layer: [...legacyLayer()] })],
    ['vrstva jako text', () => ({ ...legacyAlbumRecord(), layer: 'abc' })],
    [
      'vrstva bez posledního bajtu',
      () => ({ ...legacyAlbumRecord(), layer: legacyLayer().slice(0, -1) }),
    ],
    [
      'vrstva s bajtem navíc',
      () => {
        const layer = legacyLayer();
        const longer = new Uint8Array(layer.length + 1);
        longer.set(layer);
        return { ...legacyAlbumRecord(), layer: longer };
      },
    ],
    ['prázdná vrstva', () => ({ ...legacyAlbumRecord(), layer: new Uint8Array(0) })],
    ['vrstva delší než limit', () => ({ ...legacyAlbumRecord(), layer: new Uint8Array(200_000) })],
  ];

  for (const [name, make] of changed) {
    it(`záznam se změnou „${name}“ se v albu nezobrazí a nesmaže se`, async () => {
      const { device } = await recordsWith(make());
      const records = watchRecords(device.page());

      expect(await shownCount(records), name).toBe(0);
      expect(records.removes(), `${name}: nic se nemaže`).toBe(0);
      expect(await recordCount(records), `${name}: záznam zůstal`).toBe(1);
    });
  }

  it('záznam s porušenými bajty vrstvy se nezobrazí, i když má správný tvar', async () => {
    const layer = legacyLayer();
    // Každý desátý bajt převrácený: vrstva už nesedí na obrys, nebo dekodér nedojde přesně na konec.
    const broken = layer.map((byte, index) => (index % 10 === 5 ? 255 - byte : byte));
    const { records } = await recordsWith({ ...legacyAlbumRecord(), layer: broken });

    expect(await shownCount(records)).toBe(0);
  });

  it('nezobrazitelné záznamy se do limitu 24 záznamů počítají, fotoaparát se pak jen zhoupne', async () => {
    const { device } = await recordsWith({ ...legacyAlbumRecord(), layerCode: 'p9' });
    await addUnreadable(device.page(), 23);
    const records = watchRecords(device.page());
    const game = await openWithAlbum({ storage: undefined, records });
    paintLeft(game, ORANGE);

    expect(game.tapCamera()).toEqual({ kind: 'wobble', tones: HOME_WOBBLE_TONES });
    expect(records.adds()).toBe(0);
  });
});
