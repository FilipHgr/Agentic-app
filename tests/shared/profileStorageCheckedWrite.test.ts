import { describe, expect, it } from 'vitest';

import { PROFILE_COLORS } from '../../src/shared/logic/profiles';
import { setItemChecked } from '../../src/shared/storage/keyValueStorage';
import type { KeyValueStorage } from '../../src/shared/storage/keyValueStorage';
import { PROFILE_LIST_KEY, openProfiles } from '../../src/shared/storage/profileStorage';
import { DeviceStorage } from './profileFixtures';

/**
 * Testy k #131 (rozhodnutí koordinátora 1): zápis do úložiště hry
 * profilu, který řekne, jestli se hodnota opravdu uložila do zařízení.
 * Hra (Omalovánky při výměně obrázku z alba) tak pozná plné úložiště,
 * které běžný zápis jen podrží v paměti. Ostatní hry používají dál běžný
 * zápis beze změny.
 */

const GAME = 'coloring';

function storeWithProfile(storage: DeviceStorage): ReturnType<typeof openProfiles> {
  const store = openProfiles(storage);
  const profile = store.createProfile({ nickname: 'EMA', color: PROFILE_COLORS[1] });
  store.selectProfile(profile.id);
  return store;
}

describe('#131: zápis s výsledkem do úložiště hry profilu', () => {
  it('povedený zápis vrátí true a hodnota je v zařízení i po obnovení stránky', () => {
    const storage = new DeviceStorage();
    const store = storeWithProfile(storage);

    const saved = setItemChecked(store.gameStorage(GAME), 'page', 'A');

    expect(saved).toBe(true);
    const reloaded = openProfiles(storage);
    expect(reloaded.gameStorage(GAME).getItem('page')).toBe('A');
  });

  it('při plném úložišti vrátí false a hodnotu nepodrží ani v paměti', () => {
    const storage = new DeviceStorage();
    const store = storeWithProfile(storage);
    const game = store.gameStorage(GAME);
    game.setItem('page', 'P');
    storage.failWrite = () => true;

    const saved = setItemChecked(game, 'page', 'A');

    expect(saved, 'zápis se nepovedl').toBe(false);
    expect(game.getItem('page'), 'hra dál vidí uloženou hodnotu').toBe('P');
    storage.failWrite = () => false;
    expect(openProfiles(storage).gameStorage(GAME).getItem('page'), 'po obnovení').toBe('P');
  });

  it('povedený zápis nahradí hodnotu, kterou běžný zápis při plném úložišti držel v paměti', () => {
    const storage = new DeviceStorage();
    const store = storeWithProfile(storage);
    const game = store.gameStorage(GAME);
    storage.failWrite = () => true;
    game.setItem('page', 'v paměti');
    storage.failWrite = () => false;

    expect(setItemChecked(game, 'page', 'uloženo')).toBe(true);
    expect(game.getItem('page')).toBe('uloženo');
  });

  it('běžný zápis při plném úložišti dál podrží hodnotu v paměti jako dřív', () => {
    const storage = new DeviceStorage();
    const store = storeWithProfile(storage);
    const game = store.gameStorage(GAME);
    storage.failWrite = () => true;

    expect(() => game.setItem('page', 'A')).not.toThrow();
    expect(game.getItem('page')).toBe('A');
  });

  it('dočasný profil (poškozený seznam) do zařízení nic neuloží a zápis vrátí false', () => {
    const storage = new DeviceStorage({ [PROFILE_LIST_KEY]: 'nesmysl' });
    const store = openProfiles(storage);
    const before = [...storage.data.entries()];

    expect(setItemChecked(store.gameStorage(GAME), 'page', 'A')).toBe(false);
    expect([...storage.data.entries()]).toEqual(before);
  });

  it('hra s neplatným označením do zařízení nic neuloží a zápis vrátí false', () => {
    const storage = new DeviceStorage();
    const store = storeWithProfile(storage);
    const before = [...storage.data.entries()];

    expect(setItemChecked(store.gameStorage('Neplatná hra'), 'page', 'A')).toBe(false);
    expect([...storage.data.entries()]).toEqual(before);
  });

  it('úložiště bez zápisu s výsledkem: výjimka ze zápisu je „neuloženo“, jinak „uloženo“', () => {
    const data = new Map<string, string>();
    let full = false;
    const plain: KeyValueStorage = {
      getItem: (key) => data.get(key) ?? null,
      setItem: (key, value) => {
        if (full) {
          throw new Error('plné úložiště');
        }
        data.set(key, value);
      },
    };

    expect(setItemChecked(plain, 'page', 'A')).toBe(true);
    full = true;
    expect(setItemChecked(plain, 'page', 'B')).toBe(false);
    expect(plain.getItem('page')).toBe('A');
  });
});
