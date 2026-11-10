import { IDBFactory } from 'fake-indexeddb';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  browserIndexedDb,
  indexedDbProfileRecords,
} from '../../src/shared/storage/indexedDbRecords';
import type { ProfileRecords } from '../../src/shared/storage/profileRecords';
import {
  PICTURES,
  QUOTA_SHAPES,
  addSaved,
  blockedByOlderPanel,
  dataOf,
  failingOpenFactory,
  fillQuota,
  indexedDbDevice,
  loseConnection,
  persistenceSpy,
  pictureFor,
  securityErrorFactory,
  settle,
} from './profileRecordsFixtures';

/**
 * Testy k #125 AC2: selhání úložiště záznamů nad IndexedDB nikdy neshodí
 * hru. Plné úložiště skončí „plné“, nedostupné a zablokované „nedostupné“,
 * žádná operace nevyhodí výjimku ani neskončí zamítnutým slibem a nezdařený
 * zápis nezmění nic dřív uloženého. K AC5 patří, že po nezdařeném zápisu se
 * o trvalé úložiště nežádá.
 *
 * Selhání se simulují obalem nad `fake-indexeddb`
 * (`profileRecordsFixtures.ts`): kvóta, zakázané úložiště (SecurityError),
 * soukromý režim (chyba při otevření), ztracené spojení a druhý panel se
 * starší verzí, který databázi drží otevřenou.
 */

const COLORING = 'coloring';
const PROFILE = 'pa';

/** Do kdy musí zablokované úložiště skončit (AC2: do 2 s), s rezervou na plánování testu. */
const BLOCKED_LIMIT_MS = 2000;
const SCHEDULING_SLACK_MS = 250;

const restore: Array<() => void> = [];

afterEach(() => {
  for (const undo of restore.splice(0)) {
    undo();
  }
  vi.unstubAllGlobals();
});

/** Každá operace úložiště záznamů a výsledek, kterým má skončit, když úložiště nejde použít. */
const OPERATIONS: ReadonlyArray<
  readonly [string, (records: ProfileRecords) => Promise<unknown>, unknown]
> = [
  ['seznam', (records) => records.forGame(PROFILE, COLORING).list(), { status: 'unavailable' }],
  [
    'uložení',
    (records) => records.forGame(PROFILE, COLORING).add(pictureFor('nový')),
    { status: 'unavailable' },
  ],
  ['smazání záznamu', (records) => records.forGame(PROFILE, COLORING).remove('x'), 'unavailable'],
  ['smazání profilu', (records) => records.removeProfile(PROFILE), 'unavailable'],
  ['úklid zbytků', (records) => records.removeAllExcept(['pb']), 'unavailable'],
];

/** Spustí operaci; výjimka nebo zamítnutý slib je chyba, kterou by viděl hráč. */
async function outcomeOf(
  operation: (records: ProfileRecords) => Promise<unknown>,
  records: ProfileRecords,
): Promise<unknown> {
  let pending: Promise<unknown> | undefined;
  expect(() => {
    pending = operation(records);
  }).not.toThrow();
  return await (pending ?? Promise.reject(new Error('operace nic nevrátila')));
}

/** Prohlížeče a stavy, ve kterých IndexedDB nejde použít vůbec. */
const UNAVAILABLE_BROWSERS: ReadonlyArray<readonly [string, () => IDBFactory | undefined]> = [
  ['prohlížeč bez IndexedDB', () => undefined],
  ['zakázané úložiště (open vyhodí SecurityError)', securityErrorFactory],
  [
    'soukromý režim (otevření skončí InvalidStateError)',
    () => failingOpenFactory('InvalidStateError'),
  ],
  ['poškozené úložiště (otevření skončí UnknownError)', () => failingOpenFactory('UnknownError')],
  [
    'otevření zakázané po startu (SecurityError v chybě)',
    () => failingOpenFactory('SecurityError'),
  ],
];

describe('#125 AC2: plné úložiště skončí výsledkem „plné“', () => {
  it('uložení do plného úložiště skončí „plné“ a nevyhodí výjimku', async () => {
    for (const shape of QUOTA_SHAPES) {
      const device = indexedDbDevice();
      const records = device.open();
      restore.push(fillQuota(shape));

      expect(
        await outcomeOf((r) => r.forGame(PROFILE, COLORING).add(pictureFor('nový')), records),
        shape,
      ).toEqual({
        status: 'full',
      });

      for (const undo of restore.splice(0)) {
        undo();
      }
    }
  });

  it('nezdařený zápis do plného úložiště nezmění dřív uložené záznamy ani po obnovení stránky', async () => {
    for (const shape of QUOTA_SHAPES) {
      const device = indexedDbDevice();
      const records = device.open();
      for (const picture of PICTURES) {
        await addSaved(records.forGame(PROFILE, COLORING), picture);
      }
      restore.push(fillQuota(shape));

      expect((await records.forGame(PROFILE, COLORING).add(pictureFor('nový'))).status, shape).toBe(
        'full',
      );
      expect(await dataOf(records.forGame(PROFILE, COLORING)), shape).toEqual(PICTURES);

      for (const undo of restore.splice(0)) {
        undo();
      }
      expect(await dataOf(device.open().forGame(PROFILE, COLORING)), shape).toEqual(PICTURES);
    }
  });

  it('po uvolnění místa jde zase uložit a nic navíc se neobjeví', async () => {
    for (const shape of QUOTA_SHAPES) {
      const device = indexedDbDevice();
      const records = device.open().forGame(PROFILE, COLORING);
      const undo = fillQuota(shape);
      await records.add(pictureFor('neuložený'));
      undo();

      expect((await records.add(pictureFor('uložený'))).status, shape).toBe('saved');
      expect(await dataOf(device.open().forGame(PROFILE, COLORING)), shape).toEqual([
        pictureFor('uložený'),
      ]);
    }
  });
});

describe('#125 AC2: nedostupné úložiště skončí výsledkem „nedostupné“', () => {
  it('každá operace v prohlížeči bez použitelné IndexedDB skončí „nedostupné“ bez výjimky', async () => {
    for (const [browser, factory] of UNAVAILABLE_BROWSERS) {
      for (const [name, operation, expected] of OPERATIONS) {
        const records = indexedDbProfileRecords(factory());
        expect(await outcomeOf(operation, records), `${browser}: ${name}`).toEqual(expected);
      }
    }
  });

  it('ztracené spojení s úložištěm skončí „nedostupné“ a dřív uložené záznamy zůstanou', async () => {
    for (const [name, operation, expected] of OPERATIONS) {
      const device = indexedDbDevice();
      for (const picture of PICTURES) {
        await addSaved(device.open().forGame(PROFILE, COLORING), picture);
      }
      const records = device.open();
      restore.push(loseConnection());

      expect(await outcomeOf(operation, records), name).toEqual(expected);

      for (const undo of restore.splice(0)) {
        undo();
      }
      expect(await dataOf(device.open().forGame(PROFILE, COLORING)), name).toEqual(PICTURES);
    }
  });

  it('nedostupné úložiště nezmění záznamy uložené dřív v zařízení', async () => {
    const device = indexedDbDevice();
    for (const picture of PICTURES) {
      await addSaved(device.open().forGame(PROFILE, COLORING), picture);
    }

    const forbidden = indexedDbProfileRecords(securityErrorFactory());
    await forbidden.forGame(PROFILE, COLORING).add(pictureFor('nový'));
    await forbidden.removeProfile(PROFILE);
    await forbidden.removeAllExcept([]);

    expect(await dataOf(device.open().forGame(PROFILE, COLORING))).toEqual(PICTURES);
  });
});

describe('#125 AC2: zablokované úložiště nečeká donekonečna', () => {
  it('když databázi drží druhý panel se starší verzí, každá operace skončí do 2 s „nedostupné“', async () => {
    const device = indexedDbDevice();
    await addSaved(device.open().forGame(PROFILE, COLORING), pictureFor('dřív uložený'));
    const blocked = indexedDbProfileRecords(await blockedByOlderPanel(device.factory));

    const started = Date.now();
    const outcomes = await Promise.all(
      OPERATIONS.map(async ([name, operation, expected]) => ({
        name,
        expected,
        outcome: await outcomeOf(operation, blocked),
      })),
    );
    const elapsed = Date.now() - started;

    for (const { name, expected, outcome } of outcomes) {
      expect(outcome, name).toEqual(expected);
    }
    expect(elapsed).toBeLessThanOrEqual(BLOCKED_LIMIT_MS + SCHEDULING_SLACK_MS);
  });
});

describe('#125 AC5: po nezdařeném zápisu se o trvalé úložiště nežádá', () => {
  it('plné úložiště o trvalé úložiště nežádá, první úspěšný zápis potom ano', async () => {
    for (const shape of QUOTA_SHAPES) {
      const spy = persistenceSpy(false);
      const records = indexedDbDevice().open({ persistentStorage: spy.access });
      const undo = fillQuota(shape);

      await records.forGame(PROFILE, COLORING).add(pictureFor('neuložený'));
      await settle();
      expect(spy.persist, shape).not.toHaveBeenCalled();

      undo();
      await addSaved(records.forGame(PROFILE, COLORING), pictureFor('uložený'));
      await expect.poll(() => spy.persist.mock.calls.length, { message: shape }).toBe(1);
    }
  });

  it('po úspěšném zápisu se nezdařený zápis nežádá znovu', async () => {
    for (const shape of QUOTA_SHAPES) {
      const spy = persistenceSpy(false);
      const records = indexedDbDevice().open({ persistentStorage: spy.access });
      await addSaved(records.forGame(PROFILE, COLORING), pictureFor('uložený'));
      await expect.poll(() => spy.persist.mock.calls.length, { message: shape }).toBe(1);

      const undo = fillQuota(shape);
      await records.forGame(PROFILE, COLORING).add(pictureFor('neuložený'));
      await settle();
      undo();

      expect(spy.persist, shape).toHaveBeenCalledTimes(1);
    }
  });

  it('nedostupné úložiště o trvalé úložiště nežádá', async () => {
    for (const [browser, factory] of UNAVAILABLE_BROWSERS) {
      const spy = persistenceSpy(false);
      const records = indexedDbProfileRecords(factory(), { persistentStorage: spy.access });

      await records.forGame(PROFILE, COLORING).add(pictureFor('neuložený'));
      await settle();

      expect(spy.persist, browser).not.toHaveBeenCalled();
    }
  });
});

describe('#125 AC2: IndexedDB prohlížeče', () => {
  it('stránka najde IndexedDB prohlížeče, když ji prohlížeč má', () => {
    const factory = new IDBFactory();
    vi.stubGlobal('indexedDB', factory);
    expect(browserIndexedDb()).toBe(factory);
  });

  it('prohlížeč bez IndexedDB, s prázdnou nebo zakázanou IndexedDB nic nevrátí a nevyhodí výjimku', () => {
    const browsers: ReadonlyArray<readonly [string, () => void]> = [
      ['bez IndexedDB', () => vi.stubGlobal('indexedDB', undefined)],
      ['IndexedDB je null', () => vi.stubGlobal('indexedDB', null)],
      [
        'přístup k IndexedDB vyhodí SecurityError',
        () => {
          Object.defineProperty(globalThis, 'indexedDB', {
            configurable: true,
            get: () => {
              throw new DOMException('Úložiště je zakázané', 'SecurityError');
            },
          });
          restore.push(() => {
            Reflect.deleteProperty(globalThis, 'indexedDB');
          });
        },
      ],
    ];

    for (const [name, prepare] of browsers) {
      prepare();
      let found: IDBFactory | undefined;
      expect(() => {
        found = browserIndexedDb();
      }, name).not.toThrow();
      expect(found, name).toBeUndefined();
      for (const undo of restore.splice(0)) {
        undo();
      }
      vi.unstubAllGlobals();
    }
  });
});
