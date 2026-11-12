import { describe, expect, it } from 'vitest';

import { isGameHost } from '../../src/shared/logic/gameHost';
import { PROFILE_COLORS } from '../../src/shared/logic/profiles';
import { KEY_REWARDS_AREA, openKeyRewards } from '../../src/shared/storage/keyRewardsStorage';
import { openProfiles } from '../../src/shared/storage/profileStorage';
import { startGameSession } from '../../src/shared/ui/gameSession';
import { DeviceStorage } from './profileFixtures';

/**
 * Testy k #139 AC4 a AC6 (předání hře): stránka dá hře klíče aktivního
 * profilu jako volitelné pole hostitele `GameHost.keyRewards`
 * (`startGameSession({ keyRewards })`). Hra dostane jen hlášení
 * dokončených map a stav klíčů, ne označení profilu ani přezdívku.
 * Hostitel bez klíčů je dál platná stránka pro hru (AC6: hra jede dál).
 */

const BASE_HOST = {
  attachSettingsGear: () => () => undefined,
  setHomeAvailable: () => undefined,
  onLeave: () => undefined,
  storage: undefined,
};

type SessionKeys = Parameters<typeof startGameSession>[0]['keyRewards'];

function sessionWith(keyRewards: SessionKeys) {
  return startGameSession({
    homeButton: null,
    keyRewards,
    startScenes: () => () => undefined,
    onLeft: () => undefined,
  });
}

describe('#139 AC4: hra dostane klíče jen aktivního profilu', () => {
  it('půlka nahlášená hrou přes hostitele patří aktivnímu profilu i po obnovení stránky', () => {
    const storage = new DeviceStorage();
    const page = openProfiles(storage);
    const ema = page.createProfile({ nickname: 'EMA', color: PROFILE_COLORS[1] });
    page.selectProfile(ema.id);

    const keys = sessionWith(openKeyRewards(page.gameStorage(KEY_REWARDS_AREA))).host.keyRewards;
    if (keys === undefined) {
      throw new Error('hra nedostala klíče');
    }
    expect(keys.reportCompletedMaps(1)).toBe('half');

    const reloaded = openProfiles(storage);
    reloaded.selectProfile(ema.id);
    expect(openKeyRewards(reloaded.gameStorage(KEY_REWARDS_AREA)).balance().halves).toBe(1);
    reloaded.selectProfile(reloaded.profiles()[0]?.id ?? '');
    expect(openKeyRewards(reloaded.gameStorage(KEY_REWARDS_AREA)).balance().halves).toBe(0);
  });

  it('hra nedostane označení profilu ani přezdívku, jen operace s klíči', () => {
    const page = openProfiles(new DeviceStorage());
    const zuzanka = page.createProfile({ nickname: 'ZUZANKA', color: PROFILE_COLORS[2] });
    page.selectProfile(zuzanka.id);

    const keys = sessionWith(openKeyRewards(page.gameStorage(KEY_REWARDS_AREA))).host.keyRewards;

    expect(keys).toBeDefined();
    for (const [name, value] of Object.entries(keys ?? {})) {
      expect(typeof value, name).toBe('function');
    }
    const shown = JSON.stringify(keys);
    expect(shown).not.toContain(zuzanka.id);
    expect(shown).not.toContain('ZUZANKA');
  });
});

describe('#139 AC6: bez klíčů od stránky hra jede dál', () => {
  it('bez klíčů hostitel hře žádné nedá', () => {
    expect(sessionWith(undefined).host.keyRewards).toBeUndefined();
  });

  it('hostitel s klíči i bez nich je platná stránka pro hru, klíče bez operací ne', () => {
    const keys = openKeyRewards(undefined);
    const hosts: ReadonlyArray<readonly [string, unknown, boolean]> = [
      ['bez klíčů', BASE_HOST, true],
      ['s klíči', { ...BASE_HOST, keyRewards: keys }, true],
      ['klíče undefined', { ...BASE_HOST, keyRewards: undefined }, true],
      ['klíče nejsou objekt', { ...BASE_HOST, keyRewards: 3 }, false],
      ['klíče null', { ...BASE_HOST, keyRewards: null }, false],
      ['klíče bez hlášení map', { ...BASE_HOST, keyRewards: { balance: keys.balance } }, false],
      [
        'klíče bez stavu',
        { ...BASE_HOST, keyRewards: { reportCompletedMaps: keys.reportCompletedMaps } },
        false,
      ],
    ];

    for (const [name, host, valid] of hosts) {
      expect(isGameHost(host), name).toBe(valid);
    }
  });
});
