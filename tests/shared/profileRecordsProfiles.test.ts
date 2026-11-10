import { describe, expect, it } from 'vitest';

import { PROFILE_COLORS } from '../../src/shared/logic/profiles';
import type { Profile } from '../../src/shared/logic/profiles';
import type { RecordData } from '../../src/shared/storage/profileRecords';
import {
  ACTIVE_PROFILE_KEY,
  PROFILE_LIST_KEY,
  openProfiles,
} from '../../src/shared/storage/profileStorage';
import type { ProfileStore } from '../../src/shared/storage/profileStorage';
import {
  CORRUPT_PROFILE_LISTS,
  DeviceStorage,
  forbiddenStorage,
  profileDataKeys,
} from './profileFixtures';
import {
  RECORDS_DEVICES,
  addSaved,
  dataOf,
  pictureFor,
  removingCalls,
  spyOnRecords,
} from './profileRecordsFixtures';
import type { RecordsDevice } from './profileRecordsFixtures';

/**
 * Testy k #125: záznamy her (album Omalovánek) patří profilu dítěte. Jedno
 * načtení stránky je `openProfiles(storage, records)`, kde `storage` je
 * `localStorage` (seznam profilů, #71) a `records` úložiště záznamů
 * (`ProfileRecords`) nad stejným zařízením. Hra dostane jen
 * `store.gameRecords(gameId)` pro aktivní profil, bez označení profilu.
 *
 * Mazání záznamů po smazání profilu je asynchronní; `deleteProfile` dál
 * hned vrací, jestli se profil smazal (#73), a `whenRecordsCleaned()` počká,
 * až mazání záznamů doběhne.
 *
 * AC1: záznamy patří profilu a hře, bez přezdívky, dočasný profil dostane
 * u každé operace „nedostupné“.
 * AC3: smazání profilu smaže jeho záznamy, nepovedené smazání nic nezmění,
 * nedostupné úložiště záznamů smazání profilu nezastaví.
 * AC4: úklid zbytků jako v #75 AC5 a AC6.
 *
 * Každý test běží nad oběma implementacemi úložiště záznamů.
 */

const COLORING = 'coloring';
const OTHER_GAME = 'counting';

interface Family {
  readonly storage: DeviceStorage;
  readonly device: RecordsDevice;
  readonly first: Profile;
  readonly ema: Profile;
  readonly tom: Profile;
}

/** Obrázek profilu v jedné hře, aby šlo poznat, komu patří. */
function pictureOf(profile: Profile, gameId: string): RecordData {
  return pictureFor(`${profile.id} ${gameId}`);
}

/** Uloží obrázek profilu `profile` v obou hrách, aktivní profil vrátí zpět. */
async function saveRecordsOf(store: ProfileStore, profile: Profile): Promise<void> {
  const active = store.activeProfile().id;
  store.selectProfile(profile.id);
  const coloring = store.gameRecords(COLORING);
  const other = store.gameRecords(OTHER_GAME);
  await addSaved(coloring, pictureOf(profile, COLORING));
  await addSaved(other, pictureOf(profile, OTHER_GAME));
  store.selectProfile(active);
}

/** Zařízení s výchozím profilem, EMA a TOM, každý s obrázkem v obou hrách. */
async function family(
  makeDevice: () => RecordsDevice,
  storage: DeviceStorage = new DeviceStorage(),
): Promise<Family> {
  const device = makeDevice();
  const setup = openProfiles(storage, device.open());
  const first = setup.activeProfile();
  const ema = setup.createProfile({ nickname: 'EMA', color: PROFILE_COLORS[1] });
  const tom = setup.createProfile({ nickname: 'TOM', color: PROFILE_COLORS[2] });
  for (const profile of [first, ema, tom]) {
    await saveRecordsOf(setup, profile);
  }
  return { storage, device, first, ema, tom };
}

/** Co je v zařízení uložené pro profil (obě hry), přečtené novou stránkou. */
async function savedRecordsOf(
  device: RecordsDevice,
  profileId: string,
): Promise<(RecordData[] | undefined)[]> {
  const records = device.open();
  return [
    await dataOf(records.forGame(profileId, COLORING)),
    await dataOf(records.forGame(profileId, OTHER_GAME)),
  ];
}

/** Záznamy profilu, jak je má uložené rodina z `family`. */
function ownRecordsOf(profile: Profile): RecordData[][] {
  return [[pictureOf(profile, COLORING)], [pictureOf(profile, OTHER_GAME)]];
}

/**
 * Zařízení, kde po smazání EMY zůstaly její záznamy: smazání proběhlo na
 * stránce, které úložiště záznamů nešlo použít (AC3, třetí bod).
 */
async function familyWithLeftovers(
  makeDevice: () => RecordsDevice,
  storage?: DeviceStorage,
): Promise<Family> {
  const members = await family(makeDevice, storage);
  const page = openProfiles(members.storage, members.device.openUnavailable());
  expect(page.deleteProfile(members.ema.id), 'smazání EMY bez úložiště záznamů').toBe(true);
  await page.whenRecordsCleaned();
  expect(await savedRecordsOf(members.device, members.ema.id)).toEqual(ownRecordsOf(members.ema));
  return members;
}

describe.each(RECORDS_DEVICES)('#125 záznamy her podle profilu (%s)', (_name, makeDevice) => {
  describe('AC1: záznamy patří profilu a hře', () => {
    it('co dítě uloží ve hře, najde ve svém profilu i po obnovení stránky ve stejném pořadí', async () => {
      const { storage, device, ema } = await family(makeDevice);
      const page = openProfiles(storage, device.open());
      page.selectProfile(ema.id);
      await addSaved(page.gameRecords(COLORING), pictureFor('druhý obrázek'));
      await addSaved(page.gameRecords(COLORING), pictureFor('třetí obrázek'));

      const reloaded = openProfiles(storage, device.open());
      reloaded.selectProfile(ema.id);

      expect(await dataOf(reloaded.gameRecords(COLORING))).toEqual([
        pictureOf(ema, COLORING),
        pictureFor('druhý obrázek'),
        pictureFor('třetí obrázek'),
      ]);
    });

    it('jiný profil ani jiná hra záznam nevidí', async () => {
      const { storage, device, first, ema, tom } = await family(makeDevice);
      const page = openProfiles(storage, device.open());

      for (const profile of [first, ema, tom]) {
        page.selectProfile(profile.id);
        expect(await dataOf(page.gameRecords(COLORING)), profile.id).toEqual([
          pictureOf(profile, COLORING),
        ]);
        expect(await dataOf(page.gameRecords(OTHER_GAME)), profile.id).toEqual([
          pictureOf(profile, OTHER_GAME),
        ]);
        expect(await dataOf(page.gameRecords('jinahra')), profile.id).toEqual([]);
      }
    });

    it('hra spuštěná za profil ukládá dál jen jemu, i když se mezitím vybere jiný profil', async () => {
      const { storage, device, ema, tom } = await family(makeDevice);
      const page = openProfiles(storage, device.open());
      page.selectProfile(ema.id);
      const emaGame = page.gameRecords(COLORING);

      page.selectProfile(tom.id);
      await addSaved(emaGame, pictureFor('EMIN nový'));

      expect((await savedRecordsOf(device, ema.id))[0]).toEqual([
        pictureOf(ema, COLORING),
        pictureFor('EMIN nový'),
      ]);
      expect((await savedRecordsOf(device, tom.id))[0]).toEqual([pictureOf(tom, COLORING)]);
    });

    it('v záznamech ani v názvech úložiště není přezdívka, jen vnitřní označení profilu', async () => {
      const storage = new DeviceStorage();
      const device = makeDevice();
      const spy = spyOnRecords(device.open());
      const page = openProfiles(storage, spy.records);
      const zuzanka = page.createProfile({ nickname: 'ZUZANKA', color: PROFILE_COLORS[3] });
      const other = page.createProfile({ nickname: 'KAREL', color: PROFILE_COLORS[4] });
      page.selectProfile(zuzanka.id);
      await addSaved(page.gameRecords(COLORING), pictureFor('kočka'));
      page.updateProfile(zuzanka.id, { nickname: 'ZUZKA', color: PROFILE_COLORS[5] });
      await addSaved(page.gameRecords(COLORING), pictureFor('pejsek'));
      expect(page.deleteProfile(other.id)).toBe(true);
      await page.whenRecordsCleaned();

      const everything = [JSON.stringify(spy.calls), ...((await device.dump()) ?? [])].join('\n');
      for (const nickname of ['ZUZANKA', 'ZUZKA', 'KAREL']) {
        expect(everything, nickname).not.toContain(nickname);
      }
      const owners = spy.calls
        .filter((call) => call.operation === 'add')
        .map((call) => call.args[0]);
      expect(owners).toEqual([zuzanka.id, zuzanka.id]);
    });

    it('dočasný profil (nečitelný nebo poškozený seznam) dostane u každé operace „nedostupné“ a úložiště nedostane', async () => {
      const temporaryPages: ReadonlyArray<readonly [string, () => DeviceStorage | undefined]> = [
        ...CORRUPT_PROFILE_LISTS.map(
          (corrupt) =>
            [
              `poškozený seznam ${corrupt}`,
              () => new DeviceStorage({ [PROFILE_LIST_KEY]: corrupt }),
            ] as const,
        ),
        ['nečitelný seznam (zakázané úložiště)', forbiddenStorage],
        ['prohlížeč bez úložiště', () => undefined],
      ];

      for (const [name, makeStorage] of temporaryPages) {
        const device = makeDevice();
        const spy = spyOnRecords(device.open());
        const page = openProfiles(makeStorage(), spy.records);
        const records = page.gameRecords(COLORING);

        expect(await records.list(), name).toEqual({ status: 'unavailable' });
        expect(await records.add(pictureFor('kočka')), name).toEqual({ status: 'unavailable' });
        expect(await records.remove('x'), name).toBe('unavailable');
        expect(spy.calls, name).toEqual([]);
      }
    });

    it('stránka bez úložiště záznamů dá hře u každé operace „nedostupné“', async () => {
      const page = openProfiles(new DeviceStorage());
      const records = page.gameRecords(COLORING);

      expect(await records.list()).toEqual({ status: 'unavailable' });
      expect(await records.add(pictureFor('kočka'))).toEqual({ status: 'unavailable' });
      expect(await records.remove('x')).toBe('unavailable');
    });
  });

  describe('AC3: smazání profilu', () => {
    it('po úspěšném smazání profilu zmizí všechny jeho záznamy, ostatní zůstanou', async () => {
      const { storage, device, first, ema, tom } = await family(makeDevice);
      const page = openProfiles(storage, device.open());

      expect(page.deleteProfile(ema.id)).toBe(true);
      await page.whenRecordsCleaned();

      expect(await savedRecordsOf(device, ema.id)).toEqual([[], []]);
      expect(await savedRecordsOf(device, first.id)).toEqual(ownRecordsOf(first));
      expect(await savedRecordsOf(device, tom.id)).toEqual(ownRecordsOf(tom));
    });

    it('smazání, které se neprovede, záznamy nezmění', async () => {
      const failedDeletions: ReadonlyArray<
        readonly [string, () => Promise<{ members: Family; page: ProfileStore; id: string }>]
      > = [
        [
          'poslední profil',
          async () => {
            const members = await family(makeDevice);
            const page = openProfiles(members.storage, members.device.open());
            page.deleteProfile(members.ema.id);
            page.deleteProfile(members.tom.id);
            await page.whenRecordsCleaned();
            return { members, page, id: members.first.id };
          },
        ],
        [
          'seznam se nepodaří uložit',
          async () => {
            const members = await family(makeDevice);
            members.storage.failWrite = (key) => key === PROFILE_LIST_KEY;
            return {
              members,
              page: openProfiles(members.storage, members.device.open()),
              id: members.ema.id,
            };
          },
        ],
        [
          'seznam je mezitím poškozený',
          async () => {
            const members = await family(makeDevice);
            const page = openProfiles(members.storage, members.device.open());
            members.storage.data.set(PROFILE_LIST_KEY, '{');
            return { members, page, id: members.ema.id };
          },
        ],
        [
          'seznam mezitím nejde přečíst',
          async () => {
            const members = await family(makeDevice);
            const page = openProfiles(members.storage, members.device.open());
            members.storage.failReads = true;
            return { members, page, id: members.ema.id };
          },
        ],
        [
          'seznam mezitím chybí (rodič smazal data webu)',
          async () => {
            const members = await family(makeDevice);
            const page = openProfiles(members.storage, members.device.open());
            members.storage.data.delete(PROFILE_LIST_KEY);
            return { members, page, id: members.ema.id };
          },
        ],
        [
          'neznámý profil',
          async () => {
            const members = await family(makeDevice);
            return {
              members,
              page: openProfiles(members.storage, members.device.open()),
              id: 'pneznamy',
            };
          },
        ],
      ];

      for (const [name, prepare] of failedDeletions) {
        const { members, page, id } = await prepare();
        const profiles = [members.first, members.ema, members.tom];
        const before = await Promise.all(
          profiles.map((profile) => savedRecordsOf(members.device, profile.id)),
        );

        expect(page.deleteProfile(id), name).toBe(false);
        await page.whenRecordsCleaned();

        const after = await Promise.all(
          profiles.map((profile) => savedRecordsOf(members.device, profile.id)),
        );
        expect(after, name).toEqual(before);
      }
    });

    it('nepovedené smazání úložiště záznamů vůbec nezavolá mazání', async () => {
      const { storage, device, ema } = await family(makeDevice);
      const spy = spyOnRecords(device.open());
      const page = openProfiles(storage, spy.records);
      storage.failWrite = (key) => key === PROFILE_LIST_KEY;

      expect(page.deleteProfile(ema.id)).toBe(false);
      storage.failWrite = () => false;
      expect(page.deleteProfile('pneznamy')).toBe(false);
      await page.whenRecordsCleaned();

      expect(removingCalls(spy.calls)).toEqual([]);
    });

    it('když úložiště záznamů při smazání nejde použít, profil se smaže jako dnes a jeho záznamy nikdo neuvidí', async () => {
      const { storage, device, first, ema, tom } = await family(makeDevice);
      const page = openProfiles(storage, device.openUnavailable());
      page.selectProfile(ema.id);

      expect(page.deleteProfile(ema.id)).toBe(true);
      await page.whenRecordsCleaned();

      // Jako dnes (#73): profil zmizel ze seznamu i s daty her, aktivní je první profil.
      expect(page.profiles().map((profile) => profile.id)).toEqual([first.id, tom.id]);
      expect(page.activeProfile().id).toBe(first.id);
      expect(storage.data.get(ACTIVE_PROFILE_KEY)).toBe(first.id);
      expect(profileDataKeys(storage, ema.id)).toEqual([]);

      const reloaded = openProfiles(storage, device.open());
      const newcomer = reloaded.createProfile({ nickname: 'EMA', color: PROFILE_COLORS[1] });
      expect(reloaded.profiles().map((profile) => profile.id)).toEqual([
        first.id,
        tom.id,
        newcomer.id,
      ]);
      for (const profile of reloaded.profiles()) {
        reloaded.selectProfile(profile.id);
        for (const game of [COLORING, OTHER_GAME]) {
          expect(
            await dataOf(reloaded.gameRecords(game)),
            `${profile.id} ${game}`,
          ).not.toContainEqual(pictureOf(ema, game));
        }
      }
    });
  });

  describe('AC4: úklid zbytků podle #75', () => {
    it('načtení stránky ani spuštění hry nic nemaže, ani zbytky smazaného profilu', async () => {
      const { storage, device, first, ema, tom } = await familyWithLeftovers(makeDevice);
      const spy = spyOnRecords(device.open());

      for (let reload = 0; reload < 3; reload += 1) {
        const page = openProfiles(storage, spy.records);
        for (const profile of [first, tom]) {
          page.selectProfile(profile.id);
          await page.gameRecords(COLORING).list();
          await page.gameRecords(OTHER_GAME).list();
          await page.gameRecords('jinahra').list();
        }
        await page.whenRecordsCleaned();
      }

      expect(removingCalls(spy.calls)).toEqual([]);
      expect(await savedRecordsOf(device, ema.id)).toEqual(ownRecordsOf(ema));
      expect(await savedRecordsOf(device, first.id)).toEqual(ownRecordsOf(first));
      expect(await savedRecordsOf(device, tom.id)).toEqual(ownRecordsOf(tom));
    });

    it('zbytky smazaného profilu se smažou po úspěšném smazání jiného profilu', async () => {
      const { storage, device, first, ema, tom } = await familyWithLeftovers(makeDevice);
      const page = openProfiles(storage, device.open());

      expect(page.deleteProfile(tom.id)).toBe(true);
      await page.whenRecordsCleaned();

      expect(await savedRecordsOf(device, ema.id)).toEqual([[], []]);
      expect(await savedRecordsOf(device, tom.id)).toEqual([[], []]);
      expect(await savedRecordsOf(device, first.id)).toEqual(ownRecordsOf(first));
    });

    it('smazání, které se nepovede, zbytky neuklidí', async () => {
      const { storage, device, ema, tom } = await familyWithLeftovers(makeDevice);
      const page = openProfiles(storage, device.open());

      storage.failWrite = (key) => key === PROFILE_LIST_KEY;
      expect(page.deleteProfile(tom.id)).toBe(false);
      storage.failWrite = () => false;
      expect(page.deleteProfile('pneznamy')).toBe(false);
      await page.whenRecordsCleaned();

      expect(await savedRecordsOf(device, ema.id)).toEqual(ownRecordsOf(ema));
    });

    it('profil, který mezitím založil druhý panel, o záznamy nepřijde', async () => {
      const { storage, device, first, ema, tom } = await familyWithLeftovers(makeDevice);
      const panel1 = openProfiles(storage, device.open());
      const panel2 = openProfiles(storage, device.open());
      const ana = panel2.createProfile({ nickname: 'ANA', color: PROFILE_COLORS[3] });
      await saveRecordsOf(panel2, ana);

      expect(panel1.deleteProfile(tom.id)).toBe(true);
      await panel1.whenRecordsCleaned();

      expect(await savedRecordsOf(device, ana.id)).toEqual(ownRecordsOf(ana));
      expect(await savedRecordsOf(device, first.id)).toEqual(ownRecordsOf(first));
      expect(await savedRecordsOf(device, ema.id)).toEqual([[], []]);
    });

    it('profil, který druhý panel založí hned po smazání, dřív než doběhne úklid záznamů, o záznam nepřijde', async () => {
      // Mazání záznamů je asynchronní, seznam se má načíst až těsně před úklidem
      // záznamů, ne už při smazání profilu (otázka 4 přijímá jen krátké okno).
      const { storage, device, first, ema, tom } = await familyWithLeftovers(makeDevice);
      const panel1 = openProfiles(storage, device.open());
      const panel2 = openProfiles(storage, device.open());

      expect(panel1.deleteProfile(tom.id)).toBe(true);
      const ana = panel2.createProfile({ nickname: 'ANA', color: PROFILE_COLORS[3] });
      panel2.selectProfile(ana.id);
      const saving = panel2.gameRecords(COLORING).add(pictureOf(ana, COLORING));
      await panel1.whenRecordsCleaned();

      expect((await saving).status).toBe('saved');
      expect((await savedRecordsOf(device, ana.id))[0]).toEqual([pictureOf(ana, COLORING)]);
      expect(await savedRecordsOf(device, first.id)).toEqual(ownRecordsOf(first));
      expect(await savedRecordsOf(device, ema.id)).toEqual([[], []]);
    });

    it('profily, které panel drží jen v paměti, o záznamy nepřijdou', async () => {
      const memoryProfiles: ReadonlyArray<
        readonly [string, (storage: DeviceStorage) => () => void]
      > = [
        [
          'seznam se nepodařilo uložit (plné úložiště)',
          (storage) => {
            storage.failWrite = (key) => key === PROFILE_LIST_KEY;
            return () => {
              storage.failWrite = () => false;
            };
          },
        ],
        [
          'seznam nešel přečíst',
          (storage) => {
            storage.failReads = true;
            return () => {
              storage.failReads = false;
            };
          },
        ],
      ];

      for (const [name, spoil] of memoryProfiles) {
        const { storage, device, ema, tom } = await familyWithLeftovers(makeDevice);
        const panel = openProfiles(storage, device.open());
        const repair = spoil(storage);
        const bob = panel.createProfile({ nickname: 'BOB', color: PROFILE_COLORS[4] });
        repair();
        await saveRecordsOf(panel, bob);

        expect(panel.deleteProfile(tom.id), name).toBe(true);
        await panel.whenRecordsCleaned();

        expect(await savedRecordsOf(device, bob.id), name).toEqual(ownRecordsOf(bob));
        expect(await savedRecordsOf(device, ema.id), name).toEqual([[], []]);
      }
    });

    it('když seznam těsně před úklidem nejde přečíst, je poškozený nebo chybí, neuklízí se nic', async () => {
      const spoiledLists: ReadonlyArray<readonly [string, () => string | null]> = [
        ...CORRUPT_PROFILE_LISTS.map(
          (corrupt) => [`poškozený seznam ${corrupt}`, () => corrupt] as const,
        ),
        ['seznam chybí', () => null],
        ['seznam je prázdný', () => '[]'],
        [
          'seznam nejde přečíst',
          () => {
            throw new Error('úložiště nejde číst');
          },
        ],
      ];

      for (const [name, spoil] of spoiledLists) {
        const storage = new ListSpoiledAfterWrite(spoil);
        const { device, first, ema, tom } = await familyWithLeftovers(makeDevice, storage);
        const spy = spyOnRecords(device.open());
        const page = openProfiles(storage, spy.records);

        storage.armed = true;
        expect(page.deleteProfile(tom.id), name).toBe(true);
        await page.whenRecordsCleaned();

        expect(
          spy.calls.filter((call) => call.operation === 'removeAllExcept'),
          name,
        ).toEqual([]);
        expect(await savedRecordsOf(device, ema.id), name).toEqual(ownRecordsOf(ema));
        expect(await savedRecordsOf(device, first.id), name).toEqual(ownRecordsOf(first));
        expect(await savedRecordsOf(device, tom.id), name).toEqual([[], []]);
      }
    });
  });
});

/**
 * Úložiště, ve kterém se seznam profilů pokazí hned po zápisu nového
 * seznamu: každé další čtení seznamu (to těsně před úklidem) dostane
 * výsledek `spoil` (poškozený nebo chybějící seznam, nebo chybu čtení).
 * Pokazí se, až když je `armed`.
 */
class ListSpoiledAfterWrite extends DeviceStorage {
  armed = false;
  private spoiled = false;
  private readonly spoil: () => string | null;

  constructor(spoil: () => string | null) {
    super();
    this.spoil = spoil;
  }

  override setItem(key: string, value: string): void {
    super.setItem(key, value);
    if (this.armed && key === PROFILE_LIST_KEY) {
      this.spoiled = true;
    }
  }

  override getItem(key: string): string | null {
    if (this.spoiled && key === PROFILE_LIST_KEY) {
      return this.spoil();
    }
    return super.getItem(key);
  }
}
