import { describe, expect, it } from 'vitest';

import type { PersistentStorageAccess } from '../../src/shared/storage/profileRecords';
import {
  PICTURES,
  RECORDS_DEVICES,
  addSaved,
  dataOf,
  persistenceSpy,
  pictureFor,
  settle,
} from './profileRecordsFixtures';

/**
 * Smluvní testy k #125: stejné chování úložiště záznamů her (`ProfileRecords`)
 * v paměti i nad IndexedDB. Každý test běží nad oběma implementacemi
 * (`RECORDS_DEVICES`). Nové `device.open()` je obnovení stránky.
 *
 * AC1: záznamy patří profilu a hře, přežijí obnovení stránky stejné a ve
 * stejném pořadí uložení a nikdo jiný je nevidí.
 * AC3/AC4 (část úložiště): smazání záznamů profilu a úklid všech kromě
 * vyjmenovaných profilů.
 * AC5: po prvním úspěšném zápisu od načtení stránky se jednou požádá
 * o trvalé úložiště, odmítnutí i chyba se přejdou.
 *
 * Selhání IndexedDB (AC2) jsou v `profileRecordsFailures.test.ts`, napojení
 * na profily v `profileRecordsProfiles.test.ts`.
 */

const COLORING = 'coloring';

/** Sousední místa v úložišti, která se nesmějí slít (podobná označení, oddělovač). */
const NEIGHBOURS: ReadonlyArray<
  readonly [string, readonly [string, string], readonly [string, string]]
> = [
  ['jiný profil', ['pa', COLORING], ['pb', COLORING]],
  ['profil s delším označením', ['p1', COLORING], ['p12', COLORING]],
  ['jiná hra', ['pa', COLORING], ['pa', 'counting']],
  ['hra s delším označením', ['pa', COLORING], ['pa', 'coloring2']],
  ['označení posunuté přes pomlčku', ['p-1', 'x'], ['p', '1-x']],
  ['výchozí profil a profil s podobným označením', ['default', COLORING], ['default1', COLORING]],
];

describe.each(RECORDS_DEVICES)('#125 smlouva úložiště záznamů (%s)', (_name, makeDevice) => {
  describe('AC1: záznamy patří profilu a hře', () => {
    it('co hra uloží, najde po obnovení stránky stejné a ve stejném pořadí uložení', async () => {
      const device = makeDevice();
      const page = device.open().forGame('pa', COLORING);
      const ids: string[] = [];
      for (const picture of PICTURES) {
        ids.push(await addSaved(page, picture));
      }

      const reloaded = await device.open().forGame('pa', COLORING).list();

      expect(new Set(ids).size, 'každý záznam má vlastní označení').toBe(PICTURES.length);
      expect(reloaded).toEqual({
        status: 'read',
        records: PICTURES.map((data, index) => ({ id: ids[index], data })),
      });
    });

    it('záznamy uložené rychle za sebou zůstanou v pořadí, v jakém je hra ukládala', async () => {
      const device = makeDevice();
      const page = device.open().forGame('pa', COLORING);

      const results = await Promise.all(PICTURES.map((picture) => page.add(picture)));

      expect(results.map((result) => result.status)).toEqual(PICTURES.map(() => 'saved'));
      expect(await dataOf(device.open().forGame('pa', COLORING))).toEqual(PICTURES);
    });

    it('uložený záznam se nezmění, když hra potom změní svá data v paměti', async () => {
      const device = makeDevice();
      const page = device.open().forGame('pa', COLORING);
      const pixels = new Uint8Array([1, 2, 3]);
      await addSaved(page, { title: 'kočka', pixels });

      pixels[0] = 99;

      expect(await dataOf(page)).toEqual([{ title: 'kočka', pixels: new Uint8Array([1, 2, 3]) }]);
      expect(await dataOf(device.open().forGame('pa', COLORING))).toEqual([
        { title: 'kočka', pixels: new Uint8Array([1, 2, 3]) },
      ]);
    });

    it('jiný profil ani jiná hra záznam nevidí, ani s podobným označením', async () => {
      for (const [name, [ownerProfile, ownerGame], [otherProfile, otherGame]] of NEIGHBOURS) {
        const device = makeDevice();
        await addSaved(device.open().forGame(ownerProfile, ownerGame), pictureFor('vlastník'));
        await addSaved(device.open().forGame(otherProfile, otherGame), pictureFor('soused'));

        const reloaded = device.open();
        expect(await dataOf(reloaded.forGame(ownerProfile, ownerGame)), name).toEqual([
          pictureFor('vlastník'),
        ]);
        expect(await dataOf(reloaded.forGame(otherProfile, otherGame)), name).toEqual([
          pictureFor('soused'),
        ]);
      }
    });

    it('profil, který ještě nic neuložil, má prázdný seznam', async () => {
      const device = makeDevice();
      expect(await device.open().forGame('pa', COLORING).list()).toEqual({
        status: 'read',
        records: [],
      });
    });

    it('smazaný záznam zmizí i po obnovení stránky, ostatní zůstanou v pořadí', async () => {
      const device = makeDevice();
      const page = device.open().forGame('pa', COLORING);
      const ids: string[] = [];
      for (const picture of PICTURES) {
        ids.push(await addSaved(page, picture));
      }

      expect(await page.remove(ids[1] ?? '')).toBe('saved');

      expect(await dataOf(device.open().forGame('pa', COLORING))).toEqual([
        PICTURES[0],
        PICTURES[2],
      ]);
    });

    it('smazání záznamu jiné hry nebo jiného profilu se stejným označením nic nezmění', async () => {
      const device = makeDevice();
      const records = device.open();
      const id = await addSaved(records.forGame('pa', COLORING), pictureFor('kočka'));

      await records.forGame('pb', COLORING).remove(id);
      await records.forGame('pa', 'counting').remove(id);

      expect(await dataOf(device.open().forGame('pa', COLORING))).toEqual([pictureFor('kočka')]);
    });
  });

  describe('AC3/AC4: smazání záznamů profilu a úklid zbytků', () => {
    it('smazání profilu smaže jeho záznamy ve všech hrách a nesáhne na jiné profily', async () => {
      for (const [name, [ownerProfile, ownerGame], [otherProfile, otherGame]] of NEIGHBOURS) {
        if (ownerProfile === otherProfile) {
          continue;
        }
        const device = makeDevice();
        const records = device.open();
        await addSaved(records.forGame(ownerProfile, ownerGame), pictureFor('vlastník'));
        await addSaved(records.forGame(ownerProfile, 'counting'), pictureFor('vlastník 2'));
        await addSaved(records.forGame(otherProfile, otherGame), pictureFor('soused'));

        expect(await records.removeProfile(ownerProfile), name).toBe('saved');

        const reloaded = device.open();
        expect(await dataOf(reloaded.forGame(ownerProfile, ownerGame)), name).toEqual([]);
        expect(await dataOf(reloaded.forGame(ownerProfile, 'counting')), name).toEqual([]);
        expect(await dataOf(reloaded.forGame(otherProfile, otherGame)), name).toEqual([
          pictureFor('soused'),
        ]);
      }
    });

    it('úklid smaže záznamy všech profilů kromě vyjmenovaných', async () => {
      const device = makeDevice();
      const records = device.open();
      for (const profile of ['p1', 'p12', 'p2', 'default']) {
        await addSaved(records.forGame(profile, COLORING), pictureFor(profile));
      }

      expect(await records.removeAllExcept(['p12', 'default'])).toBe('saved');

      const reloaded = device.open();
      expect(await dataOf(reloaded.forGame('p1', COLORING))).toEqual([]);
      expect(await dataOf(reloaded.forGame('p2', COLORING))).toEqual([]);
      expect(await dataOf(reloaded.forGame('p12', COLORING))).toEqual([pictureFor('p12')]);
      expect(await dataOf(reloaded.forGame('default', COLORING))).toEqual([pictureFor('default')]);
    });

    it('smazání profilu bez záznamů a úklid prázdného zařízení skončí bez chyby', async () => {
      const records = makeDevice().open();
      expect(await records.removeProfile('pa')).toBe('saved');
      expect(await records.removeAllExcept([])).toBe('saved');
    });
  });

  describe('AC5: trvalé úložiště', () => {
    it('po prvním uložení záznamu požádá hra prohlížeč o trvalé úložiště jednou', async () => {
      const spy = persistenceSpy(false);
      const records = makeDevice().open({ persistentStorage: spy.access });

      await addSaved(records.forGame('pa', COLORING), pictureFor('první'));

      await expect.poll(() => spy.persist.mock.calls.length).toBe(1);
    });

    it('další zápisy (i v jiné hře a jiném profilu) už o trvalé úložiště nežádají', async () => {
      const spy = persistenceSpy(false);
      const records = makeDevice().open({ persistentStorage: spy.access });
      await addSaved(records.forGame('pa', COLORING), pictureFor('první'));
      await expect.poll(() => spy.persist.mock.calls.length).toBe(1);

      await addSaved(records.forGame('pa', COLORING), pictureFor('druhý'));
      await addSaved(records.forGame('pb', 'counting'), pictureFor('třetí'));
      await settle();

      expect(spy.persist).toHaveBeenCalledTimes(1);
    });

    it('když stránka trvalé úložiště už má, hra o něj nežádá', async () => {
      const spy = persistenceSpy(true);
      const records = makeDevice().open({ persistentStorage: spy.access });

      await addSaved(records.forGame('pa', COLORING), pictureFor('první'));
      await settle();

      expect(spy.persist).not.toHaveBeenCalled();
    });

    it('čtení ani smazání bez uložení o trvalé úložiště nežádá', async () => {
      const spy = persistenceSpy(false);
      const records = makeDevice().open({ persistentStorage: spy.access });

      await records.forGame('pa', COLORING).list();
      await records.removeAllExcept(['pa']);
      await settle();

      expect(spy.persist).not.toHaveBeenCalled();
    });

    it('po obnovení stránky se po prvním uložení žádá znovu', async () => {
      const device = makeDevice();
      const before = persistenceSpy(false);
      await addSaved(
        device.open({ persistentStorage: before.access }).forGame('pa', COLORING),
        pictureFor('první'),
      );
      await expect.poll(() => before.persist.mock.calls.length).toBe(1);

      const after = persistenceSpy(false);
      await addSaved(
        device.open({ persistentStorage: after.access }).forGame('pa', COLORING),
        pictureFor('po obnovení'),
      );

      await expect.poll(() => after.persist.mock.calls.length).toBe(1);
    });

    it('odmítnutí, chybějící podpora i chyba prohlížeče se jen přejdou', async () => {
      const refusing: ReadonlyArray<readonly [string, PersistentStorageAccess | undefined]> = [
        ['prohlížeč žádost odmítne', { persisted: async () => false, persist: async () => false }],
        ['prohlížeč trvalé úložiště nezná', undefined],
        ['prohlížeč nemá persist', { persisted: async () => false }],
        ['prohlížeč nemá persisted', { persist: async () => true }],
        [
          'persisted skončí chybou',
          { persisted: () => Promise.reject(new Error('chyba')), persist: async () => true },
        ],
        [
          'persist skončí chybou',
          { persisted: async () => false, persist: () => Promise.reject(new Error('chyba')) },
        ],
        [
          'persisted vyhodí výjimku',
          {
            persisted: () => {
              throw new Error('chyba');
            },
            persist: async () => true,
          },
        ],
        [
          'persist vyhodí výjimku',
          {
            persisted: async () => false,
            persist: () => {
              throw new Error('chyba');
            },
          },
        ],
      ];

      for (const [name, access] of refusing) {
        const device = makeDevice();
        const records = device.open({ persistentStorage: access }).forGame('pa', COLORING);

        expect((await records.add(pictureFor('první'))).status, name).toBe('saved');
        await settle();
        expect((await records.add(pictureFor('druhý'))).status, name).toBe('saved');

        expect(await dataOf(device.open().forGame('pa', COLORING)), name).toEqual([
          pictureFor('první'),
          pictureFor('druhý'),
        ]);
      }
    });
  });
});
