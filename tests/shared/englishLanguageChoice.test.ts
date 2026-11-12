import { afterEach, describe, expect, it, vi } from 'vitest';

import { LANGUAGE_STORAGE_KEY } from '../../src/shared/texts/languages';
import { openProfiles } from '../../src/shared/storage/profileStorage';
import {
  createMemoryRecordsShelf,
  memoryProfileRecords,
} from '../../src/shared/storage/profileRecords';
import type { MemoryRecordsShelf } from '../../src/shared/storage/profileRecords';
import { DeviceStorage } from './profileFixtures';

/**
 * Testy k #138 AC3 a AC5 pro sdílenou část: volba jazyka z #70 se skutečnou
 * angličtinou na skutečné stránce (modul jazyků čte úložiště prohlížeče
 * přes `window.localStorage`, v testu napodobené úložištěm v paměti)
 * a přepnutí jazyka tam a zpět nic nesmaže.
 *
 * Každý test je jedno nebo víc „načtení stránky“: moduly se načtou znovu
 * (`vi.resetModules`), aby se uložená volba opravdu přečetla.
 *
 * Rozhraní: žádné nové, jen `LANGUAGES = ['cs', 'en']` v
 * `src/shared/texts/languages.ts`.
 */

/** Zařízení s úložištěm `storage`; `undefined` = prohlížeč úložiště nepovolí. */
function deviceWith(storage: DeviceStorage | undefined): void {
  if (storage === undefined) {
    vi.stubGlobal('window', {
      get localStorage(): Storage {
        throw new Error('úložiště je zakázané');
      },
    });
    return;
  }
  vi.stubGlobal('window', { localStorage: storage });
  vi.stubGlobal('localStorage', storage);
}

/** Nové načtení stránky: moduly jazyků a textů znovu. */
async function pageLoad() {
  vi.resetModules();
  const languages = await import('../../src/shared/texts/languages');
  const shared = await import('../../src/shared/texts/sharedTexts');
  return { ...languages, sharedTexts: shared.sharedTexts };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('#138 AC3: volba angličtiny platí pro celé zařízení a všechny profily', () => {
  it('po výběru angličtiny v jednom profilu je angličtina i po přepnutí na jiný profil', async () => {
    const storage = new DeviceStorage();
    deviceWith(storage);
    const profiles = openProfiles(storage);
    const first = profiles.activeProfile();
    const second = profiles.createProfile({ nickname: 'ADA', color: first.color });

    const page = await pageLoad();
    expect(page.selectLanguage('en')).toBe(true);
    profiles.selectProfile(second.id);

    const reloaded = await pageLoad();
    expect(openProfiles(storage).activeProfile().id).toBe(second.id);
    expect(reloaded.currentLanguage()).toBe('en');
  });

  it('jazyk se ukládá jen pod jedním klíčem zařízení, ne do dat profilu', async () => {
    const storage = new DeviceStorage();
    deviceWith(storage);
    openProfiles(storage);
    const before = storage.snapshot();
    const page = await pageLoad();
    page.selectLanguage('en');
    expect(storage.keysAddedSince(before)).toEqual([LANGUAGE_STORAGE_KEY]);
    expect(storage.data.get(LANGUAGE_STORAGE_KEY)).toBe('en');
  });
});

describe('#138 AC3: angličtina po obnovení stránky zůstane', () => {
  it('po výběru angličtiny a obnovení stránky je jazyk angličtina a texty anglicky', async () => {
    const storage = new DeviceStorage();
    deviceWith(storage);
    (await pageLoad()).selectLanguage('en');
    const reloaded = await pageLoad();
    expect(reloaded.currentLanguage()).toBe('en');
    expect(reloaded.sharedTexts().pageTitle).toBe('Maths');
  });

  it('po návratu na češtinu a obnovení stránky je jazyk zase čeština', async () => {
    const storage = new DeviceStorage();
    deviceWith(storage);
    (await pageLoad()).selectLanguage('en');
    (await pageLoad()).selectLanguage('cs');
    const reloaded = await pageLoad();
    expect(reloaded.currentLanguage()).toBe('cs');
    expect(reloaded.sharedTexts().pageTitle).toBe('Matematika');
  });
});

describe('#138 AC3: neznámý nebo poškozený uložený jazyk znamená češtinu', () => {
  const broken = ['EN', 'en-GB', ' en ', 'english', '"en"', '{"language":"en"}', 'de', '', 'null'];

  for (const stored of broken) {
    it(`uložené ${JSON.stringify(stored)} dá po načtení stránky češtinu`, async () => {
      deviceWith(new DeviceStorage({ [LANGUAGE_STORAGE_KEY]: stored }));
      const page = await pageLoad();
      expect(page.currentLanguage()).toBe('cs');
      expect(page.sharedTexts().languageName).toBe('Čeština');
    });
  }

  it('přesně uložené „en“ dá angličtinu (kontrola, že se úložiště opravdu čte)', async () => {
    deviceWith(new DeviceStorage({ [LANGUAGE_STORAGE_KEY]: 'en' }));
    expect((await pageLoad()).currentLanguage()).toBe('en');
  });
});

describe('#138 AC3: výběr stejného jazyka nic nezmění', () => {
  it('výběr angličtiny podruhé vrátí, že se nic nezměnilo, a znovu nic neuloží', async () => {
    const storage = new DeviceStorage();
    deviceWith(storage);
    const page = await pageLoad();
    expect(page.selectLanguage('en')).toBe(true);
    const afterFirst = storage.snapshot();
    const writes = vi.spyOn(storage, 'setItem');
    expect(page.selectLanguage('en')).toBe(false);
    expect(writes).not.toHaveBeenCalled();
    expect(storage.snapshot()).toEqual(afterFirst);
  });

  it('s uloženou angličtinou výběr angličtiny nic nezmění ani neuloží', async () => {
    const storage = new DeviceStorage({ [LANGUAGE_STORAGE_KEY]: 'en' });
    deviceWith(storage);
    const writes = vi.spyOn(storage, 'setItem');
    const page = await pageLoad();
    expect(page.selectLanguage('en')).toBe(false);
    expect(page.currentLanguage()).toBe('en');
    expect(writes).not.toHaveBeenCalled();
  });
});

describe('#138 AC3: když úložiště nejde, angličtina platí aspoň do zavření stránky', () => {
  it('bez povoleného úložiště jde angličtinu vybrat a platí na této stránce', async () => {
    deviceWith(undefined);
    const page = await pageLoad();
    expect(page.currentLanguage()).toBe('cs');
    expect(() => page.selectLanguage('en')).not.toThrow();
    expect(page.currentLanguage()).toBe('en');
    expect(page.sharedTexts().pageTitle).toBe('Maths');
  });

  it('když se volba nedá uložit, platí na této stránce a po obnovení je čeština', async () => {
    const storage = new DeviceStorage();
    storage.failWrite = () => true;
    deviceWith(storage);
    const page = await pageLoad();
    expect(() => page.selectLanguage('en')).not.toThrow();
    expect(page.currentLanguage()).toBe('en');
    expect((await pageLoad()).currentLanguage()).toBe('cs');
  });

  it('když úložiště nejde číst, je jazyk čeština a angličtina jde přesto vybrat', async () => {
    const storage = new DeviceStorage({ [LANGUAGE_STORAGE_KEY]: 'en' });
    storage.failReads = true;
    deviceWith(storage);
    const page = await pageLoad();
    expect(page.currentLanguage()).toBe('cs');
    page.selectLanguage('en');
    expect(page.currentLanguage()).toBe('en');
  });
});

// ---------------------------------------------------------------------------
// AC5: přepnutí jazyka nic nesmaže
// ---------------------------------------------------------------------------

/** Hry, jejichž data profil v zařízení má. */
const GAME_DATA: ReadonlyArray<readonly [gameId: string, key: string, value: string]> = [
  ['counting', 'settings', '{"maxNumber":10,"operations":"both","answerInput":"pencil"}'],
  ['counting', 'progress', '{"stars":7,"map":2}'],
  ['coloring', 'pictures', '{"cat":"rozmalovaný obrázek"}'],
  ['coloring', 'toolColors', '{"brush":3}'],
];

interface FilledDevice {
  readonly storage: DeviceStorage;
  readonly shelf: MemoryRecordsShelf;
  readonly profileIds: readonly string[];
}

/** Zařízení se dvěma profily, nastavením a postupem her a obrázky v albu. */
async function filledDevice(): Promise<FilledDevice> {
  const storage = new DeviceStorage();
  const shelf = createMemoryRecordsShelf();
  const profiles = openProfiles(storage, memoryProfileRecords(shelf));
  const first = profiles.activeProfile();
  const second = profiles.createProfile({ nickname: 'BOB', color: first.color });
  for (const profile of [first, second]) {
    profiles.selectProfile(profile.id);
    for (const [gameId, key, value] of GAME_DATA) {
      profiles.gameStorage(gameId).setItem(key, `${profile.id}:${value}`);
    }
    await profiles.gameRecords('coloring').add({ picture: 'cat', owner: profile.id });
  }
  profiles.selectProfile(first.id);
  return { storage, shelf, profileIds: [first.id, second.id] };
}

/** Co profily v zařízení mají: seznam, aktivní profil, data her a album. */
async function profileContents(device: FilledDevice): Promise<unknown> {
  const profiles = openProfiles(device.storage, memoryProfileRecords(device.shelf));
  const activeId = profiles.activeProfile().id;
  const perProfile = [];
  for (const id of device.profileIds) {
    profiles.selectProfile(id);
    perProfile.push({
      id,
      data: GAME_DATA.map(([gameId, key]) => profiles.gameStorage(gameId).getItem(key)),
      album: await profiles.gameRecords('coloring').list(),
    });
  }
  profiles.selectProfile(activeId);
  return { list: profiles.profiles(), activeId, perProfile };
}

/** Všechno v úložišti kromě klíče jazyka. */
function withoutLanguage(snapshot: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(snapshot).filter(([key]) => key !== LANGUAGE_STORAGE_KEY),
  );
}

/** Napodobená IndexedDB, která si zapamatuje každé sáhnutí. */
function watchedIndexedDb(): { touched: string[] } {
  const touched: string[] = [];
  const indexedDb = new Proxy(
    {},
    {
      get: (_target, property) => {
        touched.push(String(property));
        return undefined;
      },
    },
  );
  vi.stubGlobal('indexedDB', indexedDb);
  return { touched };
}

describe('#138 AC5: přepnutí jazyka tam a zpět nic nesmaže', () => {
  const switches: ReadonlyArray<{ readonly name: string; readonly order: readonly string[] }> = [
    { name: 'na angličtinu', order: ['en'] },
    { name: 'na angličtinu a zpět na češtinu', order: ['en', 'cs'] },
    { name: 'třikrát tam a zpět', order: ['en', 'cs', 'en', 'cs', 'en', 'cs'] },
  ];

  it('profily, aktivní profil, hvězdičky, nastavení her, rozmalované obrázky i album zůstanou stejné', async () => {
    for (const { name, order } of switches) {
      const device = await filledDevice();
      deviceWith(device.storage);
      const before = await profileContents(device);
      for (const language of order) {
        (await pageLoad()).selectLanguage(language);
      }
      expect(await profileContents(device), `přepnutí ${name}`).toEqual(before);
    }
  });

  it('v úložišti zařízení se změní jen klíč jazyka, nic jiného nepřibude ani nezmizí', async () => {
    for (const { name, order } of switches) {
      const device = await filledDevice();
      deviceWith(device.storage);
      const before = device.storage.snapshot();
      const page = await pageLoad();
      for (const language of order) {
        page.selectLanguage(language);
      }
      expect(withoutLanguage(device.storage.snapshot()), `přepnutí ${name}`).toEqual(
        withoutLanguage(before),
      );
    }
  });

  it('přepnutí jazyka vůbec nesáhne na úložiště alba (IndexedDB)', async () => {
    const watched = watchedIndexedDb();
    deviceWith(new DeviceStorage());
    const page = await pageLoad();
    page.selectLanguage('en');
    page.selectLanguage('cs');
    expect(watched.touched).toEqual([]);
  });

  it('přepnutí jazyka nic nesmaže ani v zařízení, kde se volba nedá uložit', async () => {
    const device = await filledDevice();
    device.storage.failWrite = (key) => key === LANGUAGE_STORAGE_KEY;
    deviceWith(device.storage);
    const before = await profileContents(device);
    const page = await pageLoad();
    page.selectLanguage('en');
    page.selectLanguage('cs');
    expect(await profileContents(device)).toEqual(before);
  });
});
