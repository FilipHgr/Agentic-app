import { describe, expect, it } from 'vitest';

import { isGameHost } from '../../src/shared/logic/gameHost';
import { PROFILE_COLORS } from '../../src/shared/logic/profiles';
import { openProfiles } from '../../src/shared/storage/profileStorage';
import { startGameSession } from '../../src/shared/ui/gameSession';
import { DeviceStorage } from './profileFixtures';
import { addSaved, dataOf, memoryDevice, pictureFor } from './profileRecordsFixtures';

/**
 * Testy k #125 AC1 (část hry): hra dostane záznamy aktivního profilu jen
 * přes `GameHost.records` (úzké rozhraní `list`, `add`, `remove`), bez
 * označení profilu a bez přístupu k jiným profilům. Spouštění her předá
 * `startGameSession({ records })` hostiteli hry.
 */

const COLORING = 'coloring';

const BASE_HOST = {
  attachSettingsGear: () => () => undefined,
  setHomeAvailable: () => undefined,
  onLeave: () => undefined,
  storage: undefined,
};

function sessionWith(records: Parameters<typeof startGameSession>[0]['records']) {
  return startGameSession({
    homeButton: null,
    records,
    startScenes: () => () => undefined,
    onLeft: () => undefined,
  });
}

describe('#125 AC1: hra dostane záznamy jen aktivního profilu', () => {
  it('co hra uloží přes hostitele, najde aktivní profil i po obnovení stránky', async () => {
    const storage = new DeviceStorage();
    const device = memoryDevice();
    const page = openProfiles(storage, device.open());
    const ema = page.createProfile({ nickname: 'EMA', color: PROFILE_COLORS[1] });
    page.selectProfile(ema.id);

    const records = sessionWith(page.gameRecords(COLORING)).host.records;
    if (records === undefined) {
      throw new Error('hra nedostala záznamy');
    }
    await addSaved(records, pictureFor('kočka'));

    const reloaded = openProfiles(storage, device.open());
    reloaded.selectProfile(ema.id);
    expect(await dataOf(reloaded.gameRecords(COLORING))).toEqual([pictureFor('kočka')]);
    reloaded.selectProfile(reloaded.profiles()[0]?.id ?? '');
    expect(await dataOf(reloaded.gameRecords(COLORING))).toEqual([]);
  });

  it('hra nedostane označení profilu ani přezdívku, jen operace se záznamy', () => {
    const page = openProfiles(new DeviceStorage(), memoryDevice().open());
    const zuzanka = page.createProfile({ nickname: 'ZUZANKA', color: PROFILE_COLORS[2] });
    page.selectProfile(zuzanka.id);

    const records = sessionWith(page.gameRecords(COLORING)).host.records;

    expect(records).toBeDefined();
    for (const [name, value] of Object.entries(records ?? {})) {
      expect(typeof value, name).toBe('function');
    }
    const shown = JSON.stringify(records);
    expect(shown).not.toContain(zuzanka.id);
    expect(shown).not.toContain('ZUZANKA');
  });

  it('bez úložiště záznamů hostitel hře žádné nedá', () => {
    expect(sessionWith(undefined).host.records).toBeUndefined();
  });

  it('hostitel se záznamy i bez nich je platná stránka pro hru, záznamy bez operací ne', () => {
    const records = openProfiles(new DeviceStorage()).gameRecords(COLORING);
    const hosts: ReadonlyArray<readonly [string, unknown, boolean]> = [
      ['bez záznamů', BASE_HOST, true],
      ['se záznamy', { ...BASE_HOST, records }, true],
      ['záznamy undefined', { ...BASE_HOST, records: undefined }, true],
      ['záznamy nejsou objekt', { ...BASE_HOST, records: 'album' }, false],
      ['záznamy bez list', { ...BASE_HOST, records: { ...records, list: undefined } }, false],
      ['záznamy bez add', { ...BASE_HOST, records: { ...records, add: 1 } }, false],
      [
        'záznamy bez remove',
        { ...BASE_HOST, records: { list: records.list, add: records.add } },
        false,
      ],
    ];

    for (const [name, host, valid] of hosts) {
      expect(isGameHost(host), name).toBe(valid);
    }
  });
});
