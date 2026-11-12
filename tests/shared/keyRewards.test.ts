import { describe, expect, it } from 'vitest';

import type { KeyBalance, KeyReward } from '../../src/shared/logic/keyRewards';
import { PROFILE_COLORS } from '../../src/shared/logic/profiles';
import type { KeyValueStorage } from '../../src/shared/storage/keyValueStorage';
import { KEY_REWARDS_AREA, openKeyRewards } from '../../src/shared/storage/keyRewardsStorage';
import { openProfiles } from '../../src/shared/storage/profileStorage';
import type { ProfileStore } from '../../src/shared/storage/profileStorage';
import { DeviceStorage, forbiddenStorage, profileDataKeys } from './profileFixtures';

/**
 * Testy k #139 (sdílená část): klíče za dokončené mapy patří profilu
 * a ukládají se jen v zařízení pod předponou profilu. Hra nahlásí, kolik
 * map profil dokončil (`reportCompletedMaps`), a dozví se, jestli tím
 * dítě dostalo půlku, nebo dokončilo celý klíč. Uložený je jen nejvyšší
 * nahlášený počet map, půlky klíče jsou nejvyšší nahlášený počet, celé
 * klíče polovina půlek dolů.
 *
 * Stránka dá hře klíče aktivního profilu jako
 * `openKeyRewards(profiles.gameStorage(KEY_REWARDS_AREA))`: úložiště
 * profilu podrží v paměti, co se nepodařilo uložit, a smazáním profilu
 * klíče zmizí s ostatními daty profilu.
 *
 * Navržené rozhraní (viz výstup testů):
 * - `src/shared/logic/keyRewards.ts`: typy `KeyReward`, `KeyBalance`,
 *   `KeyRewards` (čistý TypeScript),
 * - `src/shared/storage/keyRewardsStorage.ts`: `KEY_REWARDS_AREA`,
 *   `KEY_REWARDS_KEY` a `openKeyRewards(storage)`.
 */

const NO_KEYS: KeyBalance = { halves: 0, wholeKeys: 0, hasHalf: false };

/** Stav klíčů po `halves` půlkách (AC1). */
function balanceAfter(halves: number): KeyBalance {
  return { halves, wholeKeys: Math.floor(halves / 2), hasHalf: halves % 2 === 1 };
}

/** Úložiště v paměti jako localStorage; přežije „obnovení stránky“. */
function memoryStorage(): KeyValueStorage & { readonly data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
}

/** Úložiště, které u každého klíče, který ještě nikdo nezapsal, vrátí `raw`. */
function storageReturning(raw: string): KeyValueStorage {
  const written = new Map<string, string>();
  return {
    getItem: (key) => written.get(key) ?? raw,
    setItem: (key, value) => {
      written.set(key, value);
    },
  };
}

/** Úložiště, které jde přečíst, ale ne zapsat (plné). */
function fullStorage(): KeyValueStorage {
  return {
    getItem: () => null,
    setItem: () => {
      throw new Error('úložiště plné');
    },
  };
}

/** Klíče aktivního profilu tak, jak je stránka předá hře. */
function keysOf(page: ProfileStore) {
  return openKeyRewards(page.gameStorage(KEY_REWARDS_AREA));
}

/** Dítě dokončí mapy `1` až `count`; vrátí, co dostalo po každé. */
function completeMaps(
  keys: ReturnType<typeof openKeyRewards>,
  count: number,
): (KeyReward | null)[] {
  const rewards: (KeyReward | null)[] = [];
  for (let completed = 1; completed <= count; completed += 1) {
    rewards.push(keys.reportCompletedMaps(completed));
  }
  return rewards;
}

describe('#139 AC1: za každou dokončenou mapu půl klíče', () => {
  it('bez dokončené mapy nemá dítě žádný klíč', () => {
    expect(openKeyRewards(memoryStorage()).balance()).toEqual(NO_KEYS);
  });

  it('po 1. mapě půl klíče, po 2. jeden celý, po 3. celý a půl a tak dál', () => {
    for (let maps = 1; maps <= 7; maps += 1) {
      const keys = openKeyRewards(memoryStorage());
      completeMaps(keys, maps);
      expect(keys.balance(), `po ${maps} mapách`).toEqual(balanceAfter(maps));
    }
  });

  it('lichá mapa dá půlku, sudá mapa dokončí celý klíč', () => {
    const keys = openKeyRewards(memoryStorage());

    const rewards = completeMaps(keys, 6);

    expect(rewards).toEqual(['half', 'wholeKey', 'half', 'wholeKey', 'half', 'wholeKey']);
  });

  it('nesmyslný počet map klíč nedá a nic nezmění', () => {
    const nonsense: readonly unknown[] = [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, '2', null];
    for (const count of nonsense) {
      const keys = openKeyRewards(memoryStorage());
      keys.reportCompletedMaps(1);
      const reward = keys.reportCompletedMaps(count as number);
      expect(reward, `počet ${String(count)}`).toBeNull();
      expect(keys.balance(), `počet ${String(count)}`).toEqual(balanceAfter(1));
    }
  });
});

describe('#139 AC3: za jednu dokončenou mapu je půl klíče jen jednou', () => {
  it('stejný počet map nahlášený znovu žádnou půlku nepřidá', () => {
    for (let maps = 1; maps <= 4; maps += 1) {
      const keys = openKeyRewards(memoryStorage());
      completeMaps(keys, maps);
      for (let repeat = 0; repeat < 3; repeat += 1) {
        expect(keys.reportCompletedMaps(maps), `${maps} map, opakování ${repeat}`).toBeNull();
      }
      expect(keys.balance(), `${maps} map`).toEqual(balanceAfter(maps));
    }
  });

  it('po obnovení stránky má dítě stejně klíčů a za stejné mapy nic nového', () => {
    const storage = new DeviceStorage();
    completeMaps(keysOf(openProfiles(storage)), 3);

    const reloaded = keysOf(openProfiles(storage));

    expect(reloaded.balance()).toEqual(balanceAfter(3));
    expect(reloaded.reportCompletedMaps(3)).toBeNull();
    expect(reloaded.balance()).toEqual(balanceAfter(3));
  });

  it('po poškozeném záznamu mapy (zase od 0 map) dítě o půlky nepřijde', () => {
    const keys = openKeyRewards(memoryStorage());
    completeMaps(keys, 3);

    for (let restarted = 0; restarted <= 3; restarted += 1) {
      expect(keys.reportCompletedMaps(restarted), `znovu ${restarted} map`).toBeNull();
      expect(keys.balance(), `znovu ${restarted} map`).toEqual(balanceAfter(3));
    }
  });

  it('nová půlka přibude, až počet map přesáhne dřív dosažený', () => {
    const keys = openKeyRewards(memoryStorage());
    completeMaps(keys, 3);
    keys.reportCompletedMaps(0);
    keys.reportCompletedMaps(2);

    expect(keys.reportCompletedMaps(4)).toBe('wholeKey');
    expect(keys.balance()).toEqual(balanceAfter(4));
  });

  it('ve dvou panelech je za stejnou mapu půlka jen jednou a oba panely vidí stejně', () => {
    const storage = new DeviceStorage();
    const first = keysOf(openProfiles(storage));
    const second = keysOf(openProfiles(storage));

    expect(first.reportCompletedMaps(1), '1. panel').toBe('half');
    expect(second.reportCompletedMaps(1), '2. panel, stejná mapa').toBeNull();
    expect(second.balance()).toEqual(balanceAfter(1));
    expect(second.reportCompletedMaps(2), '2. panel, další mapa').toBe('wholeKey');
    expect(first.balance(), '1. panel vidí klíč z 2. panelu').toEqual(balanceAfter(2));
    expect(first.reportCompletedMaps(2), '1. panel, stejná mapa').toBeNull();
    expect(keysOf(openProfiles(storage)).balance(), 'po obnovení').toEqual(balanceAfter(2));
  });
});

describe('#139 AC4: klíče patří profilu', () => {
  it('jiný profil klíče jiného profilu nevidí a nový profil začíná bez klíče', () => {
    const storage = new DeviceStorage();
    const page = openProfiles(storage);
    const ema = page.createProfile({ nickname: 'EMA', color: PROFILE_COLORS[1] });
    page.selectProfile(ema.id);
    completeMaps(keysOf(page), 3);

    const first = page.profiles()[0];
    if (first === undefined) {
      throw new Error('chybí výchozí profil');
    }
    page.selectProfile(first.id);
    expect(keysOf(page).balance(), 'výchozí profil').toEqual(NO_KEYS);

    const ota = page.createProfile({ nickname: 'OTA', color: PROFILE_COLORS[2] });
    page.selectProfile(ota.id);
    expect(keysOf(page).balance(), 'nový profil').toEqual(NO_KEYS);

    page.selectProfile(ema.id);
    expect(keysOf(page).balance(), 'profil EMA má svoje').toEqual(balanceAfter(3));
  });

  it('klíče se ukládají pod vnitřním označením profilu a nikde s přezdívkou', () => {
    const storage = new DeviceStorage();
    const page = openProfiles(storage);
    const zuzanka = page.createProfile({ nickname: 'ZUZANKA', color: PROFILE_COLORS[3] });
    page.selectProfile(zuzanka.id);
    const before = storage.snapshot();

    completeMaps(keysOf(page), 2);

    const added = storage.keysAddedSince(before);
    expect(added.length, 'klíče se uložily').toBeGreaterThan(0);
    for (const key of added) {
      expect(profileDataKeys(storage, zuzanka.id), key).toContain(key);
      expect(key, key).not.toContain('ZUZANKA');
      expect(storage.data.get(key), key).not.toContain('ZUZANKA');
    }
  });

  it('smazáním profilu jeho klíče zmizí', () => {
    const storage = new DeviceStorage();
    const page = openProfiles(storage);
    const ema = page.createProfile({ nickname: 'EMA', color: PROFILE_COLORS[1] });
    page.selectProfile(ema.id);
    completeMaps(keysOf(page), 2);
    expect(profileDataKeys(storage, ema.id).length, 'před smazáním').toBeGreaterThan(0);

    expect(page.deleteProfile(ema.id)).toBe(true);

    expect(profileDataKeys(storage, ema.id), 'po smazání').toEqual([]);
    const again = page.createProfile({ nickname: 'EMA', color: PROFILE_COLORS[1] });
    page.selectProfile(again.id);
    expect(keysOf(page).balance(), 'znovu založený profil').toEqual(NO_KEYS);
  });
});

describe('#139 AC6: chybějící nebo poškozený záznam klíčů dá nula klíčů', () => {
  const corrupt: readonly string[] = [
    '',
    '{',
    'nesmysl',
    'null',
    '42',
    '"text"',
    '[]',
    '[3]',
    '{}',
    '{"completedMaps":-1}',
    '{"completedMaps":1.5}',
    '{"completedMaps":"3"}',
    '{"completedMaps":null}',
  ];

  it('poškozený záznam dá nula klíčů a nové mapy se počítají od něj normálně', () => {
    for (const raw of corrupt) {
      const keys = openKeyRewards(storageReturning(raw));
      expect(keys.balance(), `záznam ${JSON.stringify(raw)}`).toEqual(NO_KEYS);
      expect(keys.reportCompletedMaps(3), `záznam ${JSON.stringify(raw)}`).toBe('half');
      expect(keys.balance(), `záznam ${JSON.stringify(raw)}`).toEqual(balanceAfter(3));
    }
  });

  it('bez úložiště nebo s nečitelným úložištěm hra jede dál bez chyby', () => {
    const storages: ReadonlyArray<readonly [string, KeyValueStorage | undefined]> = [
      ['bez úložiště', undefined],
      ['zakázané úložiště', forbiddenStorage()],
      ['nečitelný profil', keysStorageOf(openProfiles(forbiddenStorage()))],
    ];
    for (const [name, storage] of storages) {
      const keys = openKeyRewards(storage);
      expect(keys.balance(), name).toEqual(NO_KEYS);
      expect(keys.reportCompletedMaps(1), name).toBe('half');
      expect(keys.balance(), `${name}: platí do zavření stránky`).toEqual(balanceAfter(1));
    }
  });

  it('klíč, který se nepodaří uložit, platí do zavření stránky', () => {
    const keys = openKeyRewards(fullStorage());

    expect(keys.reportCompletedMaps(1)).toBe('half');
    expect(keys.reportCompletedMaps(2)).toBe('wholeKey');
    expect(keys.balance()).toEqual(balanceAfter(2));
    expect(keys.reportCompletedMaps(2), 'neuložená mapa se nezapočte znovu').toBeNull();
  });

  it('neuložený klíč profilu platí i při dalším spuštění hry, po obnovení stránky už ne', () => {
    const storage = new DeviceStorage();
    const page = openProfiles(storage);
    const before = storage.snapshot();
    storage.failWrite = (key) => !(key in before);

    completeMaps(keysOf(page), 1);

    expect(keysOf(page).balance(), 'další spuštění hry').toEqual(balanceAfter(1));
    storage.failWrite = () => false;
    expect(keysOf(openProfiles(storage)).balance(), 'po obnovení').toEqual(NO_KEYS);
  });
});

/** Úložiště klíčů aktivního profilu (pro případ nečitelného zařízení). */
function keysStorageOf(page: ProfileStore): KeyValueStorage {
  return page.gameStorage(KEY_REWARDS_AREA);
}
