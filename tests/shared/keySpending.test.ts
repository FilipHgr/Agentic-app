import { describe, expect, it } from 'vitest';

import { isGameHost } from '../../src/shared/logic/gameHost';
import type { KeyBalance, KeyRewards } from '../../src/shared/logic/keyRewards';
import { PROFILE_COLORS } from '../../src/shared/logic/profiles';
import type { KeyValueStorage } from '../../src/shared/storage/keyValueStorage';
import {
  KEY_REWARDS_AREA,
  KEY_REWARDS_KEY,
  KEY_SPENDING_KEY,
  openKeyRewards,
} from '../../src/shared/storage/keyRewardsStorage';
import { openProfiles } from '../../src/shared/storage/profileStorage';
import type { ProfileStore } from '../../src/shared/storage/profileStorage';
import { DeviceStorage, forbiddenStorage, profileDataKeys } from './profileFixtures';

/**
 * Testy k #140 (sdílená část): celý klíč z Počítání (#139) jde utratit.
 * Omalovánky jím odemknou omalovánku, kterou si dítě vybere; tyto testy
 * hlídají jen klíče, zámky omalovánek testuje
 * `tests/games/coloring/pictureLocks*.test.ts`.
 *
 * Podle doporučení z kontrol #139 je utracení ODDĚLENÝ záznam ve stejné
 * oblasti profilu (`KEY_REWARDS_AREA`) pod klíčem `KEY_SPENDING_KEY`,
 * vedle získaných půlek (`KEY_REWARDS_KEY`). Poškození jednoho záznamu
 * tak neovlivní druhý. Celé klíče jsou
 * `max(0, floor(půlky / 2) − utracené)`, půlka zůstává podle půlek.
 *
 * Klíč se utrácí za věc (`itemId`, např. `coloring/car`): za stejnou věc
 * se klíč utratí jen jednou, i ze dvou panelů. Utracení se jedním zápisem
 * uloží spolu s tím, za co bylo, takže se nemůže stát, že by klíč zmizel
 * a věc zůstala zamčená, ani naopak (#140 AC7).
 *
 * Navržené rozhraní (viz výstup testů):
 * - `src/shared/logic/keyRewards.ts`: `KeySpend = 'spent' | 'alreadySpent' | 'noKey'`,
 *   `KeyRewards.spendKey(itemId: string): KeySpend`,
 *   `KeyRewards.spentItems(): readonly string[]`; `balance().wholeKeys`
 *   jsou od #140 celé klíče, které zbývají,
 * - `src/shared/storage/keyRewardsStorage.ts`: `KEY_SPENDING_KEY`.
 */

const CAR = 'coloring/car';
const BUTTERFLY = 'coloring/butterfly';
const FISH = 'coloring/fish';

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

/** Klíče aktivního profilu tak, jak je stránka předá hře. */
function keysOf(page: ProfileStore): KeyRewards {
  return openKeyRewards(page.gameStorage(KEY_REWARDS_AREA));
}

/** Klíče nad úložištěm, kde dítě dokončilo `maps` map v Počítání. */
function keysWithMaps(storage: KeyValueStorage, maps: number): KeyRewards {
  const keys = openKeyRewards(storage);
  for (let completed = 1; completed <= maps; completed += 1) {
    keys.reportCompletedMaps(completed);
  }
  return keys;
}

function balance(halves: number, spent: number): KeyBalance {
  return {
    halves,
    wholeKeys: Math.max(0, Math.floor(halves / 2) - spent),
    hasHalf: halves % 2 === 1,
  };
}

describe('#140 AC5: celý klíč jde utratit a utracený zůstane utracený', () => {
  it('s celým klíčem se utratí jeden klíč a půlka zůstane', () => {
    const keys = keysWithMaps(memoryStorage(), 3);

    expect(keys.spendKey(CAR)).toBe('spent');

    expect(keys.balance()).toEqual(balance(3, 1));
    expect(keys.spentItems()).toEqual([CAR]);
  });

  it('bez celého klíče se nic neutratí a nic se nezmění', () => {
    for (const maps of [0, 1]) {
      const storage = memoryStorage();
      const keys = keysWithMaps(storage, maps);
      const before = new Map(storage.data);

      expect(keys.spendKey(CAR), `${maps} map`).toBe('noKey');

      expect(keys.balance(), `${maps} map`).toEqual(balance(maps, 0));
      expect(keys.spentItems(), `${maps} map`).toEqual([]);
      expect(storage.data, `${maps} map: nic se nezapsalo`).toEqual(before);
    }
  });

  it('za stejnou věc se klíč neutratí dvakrát', () => {
    const keys = keysWithMaps(memoryStorage(), 4);

    expect(keys.spendKey(CAR), '1. ťuknutí').toBe('spent');
    expect(keys.spendKey(CAR), '2. ťuknutí').toBe('alreadySpent');

    expect(keys.balance()).toEqual(balance(4, 1));
    expect(keys.spentItems()).toEqual([CAR]);
  });

  it('klíče jde utratit postupně, dokud nějaký zbývá', () => {
    const keys = keysWithMaps(memoryStorage(), 5);

    expect(keys.spendKey(CAR)).toBe('spent');
    expect(keys.spendKey(BUTTERFLY)).toBe('spent');
    expect(keys.spendKey(FISH), 'třetí klíč dítě nemá').toBe('noKey');

    expect(keys.balance()).toEqual(balance(5, 2));
    expect([...keys.spentItems()].sort()).toEqual([BUTTERFLY, CAR].sort());
  });

  it('nová půlka po utracení klíče se počítá dál normálně', () => {
    const keys = keysWithMaps(memoryStorage(), 2);
    keys.spendKey(CAR);

    expect(keys.reportCompletedMaps(3)).toBe('half');
    expect(keys.balance()).toEqual(balance(3, 1));
    expect(keys.reportCompletedMaps(4)).toBe('wholeKey');
    expect(keys.balance()).toEqual(balance(4, 1));
  });

  it('utracený klíč platí při dalším spuštění hry i po obnovení stránky', () => {
    const storage = new DeviceStorage();
    keysWithMaps(openProfiles(storage).gameStorage(KEY_REWARDS_AREA), 4);
    expect(keysOf(openProfiles(storage)).spendKey(CAR)).toBe('spent');

    const page = openProfiles(storage);
    expect(keysOf(page).spentItems(), 'další spuštění hry').toEqual([CAR]);
    const reloaded = keysOf(openProfiles(storage));
    expect(reloaded.spentItems(), 'po obnovení').toEqual([CAR]);
    expect(reloaded.balance(), 'po obnovení').toEqual(balance(4, 1));
    expect(reloaded.spendKey(CAR), 'po obnovení za stejnou věc nic').toBe('alreadySpent');
  });

  it('věc bez označení klíč nespotřebuje', () => {
    const nonsense: readonly unknown[] = ['', null, undefined, 42, {}];
    for (const itemId of nonsense) {
      const keys = keysWithMaps(memoryStorage(), 2);
      expect(keys.spendKey(itemId as string), `věc ${String(itemId)}`).not.toBe('spent');
      expect(keys.balance(), `věc ${String(itemId)}`).toEqual(balance(2, 0));
      expect(keys.spentItems(), `věc ${String(itemId)}`).toEqual([]);
    }
  });
});

describe('#140: utracené klíče patří profilu', () => {
  it('utracení v jednom profilu nevezme klíč jinému profilu', () => {
    const storage = new DeviceStorage();
    const page = openProfiles(storage);
    const first = page.activeProfile();
    keysWithMaps(page.gameStorage(KEY_REWARDS_AREA), 2);
    const ema = page.createProfile({ nickname: 'EMA', color: PROFILE_COLORS[1] });
    page.selectProfile(ema.id);
    keysWithMaps(page.gameStorage(KEY_REWARDS_AREA), 2);

    expect(keysOf(page).spendKey(CAR), 'EMA utratí').toBe('spent');

    page.selectProfile(first.id);
    expect(keysOf(page).balance(), 'první profil má svůj klíč').toEqual(balance(2, 0));
    expect(keysOf(page).spentItems(), 'první profil nic neutratil').toEqual([]);
  });

  it('utracení se ukládá pod vnitřním označením profilu, nikdy s přezdívkou, a se smazáním profilu zmizí', () => {
    const storage = new DeviceStorage();
    const page = openProfiles(storage);
    const zuzanka = page.createProfile({ nickname: 'ZUZANKA', color: PROFILE_COLORS[3] });
    page.selectProfile(zuzanka.id);
    keysWithMaps(page.gameStorage(KEY_REWARDS_AREA), 2);
    const before = storage.snapshot();

    expect(keysOf(page).spendKey(CAR)).toBe('spent');

    const changed = [...storage.data.keys()].filter((key) => before[key] !== storage.data.get(key));
    expect(changed.length, 'utracení se uložilo').toBeGreaterThan(0);
    for (const key of changed) {
      expect(profileDataKeys(storage, zuzanka.id), key).toContain(key);
      expect(key, key).not.toContain('ZUZANKA');
      expect(storage.data.get(key), key).not.toContain('ZUZANKA');
    }

    expect(page.deleteProfile(zuzanka.id)).toBe(true);
    expect(profileDataKeys(storage, zuzanka.id), 'po smazání').toEqual([]);
  });
});

describe('#140 AC6: ve dvou panelech nejde utratit víc klíčů, než bylo', () => {
  it('s jedním klíčem utratí klíč jen jeden panel, druhý klíč nemá', () => {
    const storage = new DeviceStorage();
    keysWithMaps(openProfiles(storage).gameStorage(KEY_REWARDS_AREA), 2);
    const first = keysOf(openProfiles(storage));
    const second = keysOf(openProfiles(storage));

    expect(first.spendKey(CAR), '1. panel').toBe('spent');
    expect(second.spendKey(BUTTERFLY), '2. panel').toBe('noKey');

    expect(second.balance(), '2. panel vidí utracený klíč').toEqual(balance(2, 1));
    expect(second.spentItems(), '2. panel vidí, za co byl').toEqual([CAR]);
    expect(keysOf(openProfiles(storage)).spentItems(), 'po obnovení').toEqual([CAR]);
  });

  it('stejnou věc ze dvou panelů zaplatí jen jeden klíč', () => {
    const storage = new DeviceStorage();
    keysWithMaps(openProfiles(storage).gameStorage(KEY_REWARDS_AREA), 4);
    const first = keysOf(openProfiles(storage));
    const second = keysOf(openProfiles(storage));

    expect(first.spendKey(CAR), '1. panel').toBe('spent');
    expect(second.spendKey(CAR), '2. panel, stejná věc').toBe('alreadySpent');

    expect(first.balance()).toEqual(balance(4, 1));
    expect(second.balance()).toEqual(balance(4, 1));
  });

  it('počet celých klíčů nikdy není záporný', () => {
    const scenarios: ReadonlyArray<readonly [string, string | null]> = [
      ['záznam map poškozený', '{'],
      ['záznam map chybí', null],
      ['méně map než utracených klíčů', '{"completedMaps":1}'],
      ['přesně na utracené klíče', '{"completedMaps":4}'],
    ];
    for (const [name, earned] of scenarios) {
      const storage = memoryStorage();
      const keys = keysWithMaps(storage, 4);
      keys.spendKey(CAR);
      keys.spendKey(BUTTERFLY);
      if (earned === null) {
        storage.data.delete(KEY_REWARDS_KEY);
      } else {
        storage.data.set(KEY_REWARDS_KEY, earned);
      }

      const reopened = openKeyRewards(storage);
      expect(reopened.balance().wholeKeys, name).toBe(0);
      expect(reopened.spendKey(FISH), name).toBe('noKey');
      expect([...reopened.spentItems()].sort(), `${name}: utracené zůstává`).toEqual(
        [BUTTERFLY, CAR].sort(),
      );
    }
  });
});

describe('#140 AC7: utracení, které se nepodaří uložit, a nečitelný záznam', () => {
  it('utracení je oddělený záznam vedle získaných půlek', () => {
    expect(KEY_SPENDING_KEY).not.toBe(KEY_REWARDS_KEY);
    expect(KEY_SPENDING_KEY.length).toBeGreaterThan(0);
  });

  it('utracení, které se nepodaří uložit, platí do zavření stránky, po obnovení je klíč zpátky', () => {
    const storage = new DeviceStorage();
    keysWithMaps(openProfiles(storage).gameStorage(KEY_REWARDS_AREA), 2);
    const page = openProfiles(storage);
    const before = storage.snapshot();
    storage.failWrite = (key) => !(key in before);

    expect(keysOf(page).spendKey(CAR), 'dítě nevidí chybu').toBe('spent');

    expect(keysOf(page).spentItems(), 'další spuštění hry').toEqual([CAR]);
    expect(keysOf(page).balance(), 'další spuštění hry').toEqual(balance(2, 1));
    storage.failWrite = () => false;
    const reloaded = keysOf(openProfiles(storage));
    expect(reloaded.spentItems(), 'po obnovení').toEqual([]);
    expect(reloaded.balance(), 'po obnovení je klíč zpátky').toEqual(balance(2, 0));
  });

  it('úložiště, které zápis odmítne, nechá utracení platit v téže hře a druhý klíč nepřidá', () => {
    const earned = JSON.stringify({ completedMaps: 2 });
    const full: KeyValueStorage = {
      getItem: (key) => (key === KEY_REWARDS_KEY ? earned : null),
      setItem: () => {
        throw new Error('úložiště plné');
      },
    };
    const keys = openKeyRewards(full);

    expect(keys.spendKey(CAR)).toBe('spent');
    expect(keys.balance()).toEqual(balance(2, 1));
    expect(keys.spendKey(BUTTERFLY), 'neuložený klíč se neutratí znovu').toBe('noKey');
    expect(keys.spentItems()).toEqual([CAR]);
  });

  it('poškozený záznam utracení vrátí klíče a získané půlky nezmění', () => {
    const corrupt: readonly string[] = [
      '',
      '{',
      'nesmysl',
      'null',
      '42',
      '"text"',
      '{"spent":-1}',
      '[1,2]',
    ];
    for (const raw of corrupt) {
      const storage = memoryStorage();
      keysWithMaps(storage, 4);
      storage.data.set(KEY_SPENDING_KEY, raw);

      const keys = openKeyRewards(storage);
      expect(keys.spentItems(), `záznam ${JSON.stringify(raw)}`).toEqual([]);
      expect(keys.balance(), `záznam ${JSON.stringify(raw)}`).toEqual(balance(4, 0));
      expect(keys.spendKey(CAR), `záznam ${JSON.stringify(raw)}: dá se znovu utratit`).toBe(
        'spent',
      );
    }
  });

  it('poškozený záznam půlek utracené věci nezamkne', () => {
    const storage = memoryStorage();
    const keys = keysWithMaps(storage, 2);
    keys.spendKey(CAR);
    storage.data.set(KEY_REWARDS_KEY, 'nesmysl');

    const reopened = openKeyRewards(storage);
    expect(reopened.spentItems()).toEqual([CAR]);
    expect(reopened.balance()).toEqual(balance(0, 1));
  });

  it('bez úložiště nebo s nečitelným úložištěm utrácení hru nezastaví', () => {
    const storages: ReadonlyArray<readonly [string, KeyValueStorage | undefined]> = [
      ['bez úložiště', undefined],
      ['zakázané úložiště', forbiddenStorage()],
      ['nečitelný profil', openProfiles(forbiddenStorage()).gameStorage(KEY_REWARDS_AREA)],
    ];
    for (const [name, storage] of storages) {
      const keys = openKeyRewards(storage);
      expect(() => keys.spendKey(CAR), name).not.toThrow();
      expect(keys.spendKey(BUTTERFLY), `${name}: bez klíče`).toBe('noKey');
      expect(keys.balance().wholeKeys, name).toBe(0);
    }
  });
});

describe('#140: hra dostane klíče i s utrácením', () => {
  const BASE_HOST = {
    attachSettingsGear: () => () => undefined,
    setHomeAvailable: () => undefined,
    onLeave: () => undefined,
    storage: undefined,
  };

  it('klíče od stránky umí utrácet, klíče bez utrácení nejsou platná stránka pro hru', () => {
    const keys = openKeyRewards(undefined);
    const withoutSpending = {
      reportCompletedMaps: keys.reportCompletedMaps,
      balance: keys.balance,
    };
    const withoutList = { ...withoutSpending, spendKey: keys.spendKey };

    expect(isGameHost({ ...BASE_HOST, keyRewards: keys }), 's klíči').toBe(true);
    expect(isGameHost({ ...BASE_HOST, keyRewards: withoutSpending }), 'bez utrácení').toBe(false);
    expect(isGameHost({ ...BASE_HOST, keyRewards: withoutList }), 'bez seznamu utraceného').toBe(
      false,
    );
  });
});
