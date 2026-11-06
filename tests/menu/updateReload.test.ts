import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LOADING_TIMEOUT_MS, SLOW_LOADING_MS, createMenu } from '../../src/menu/logic/menu';
import type { Menu, MenuFeedback } from '../../src/menu/logic/menu';
import { createPageUpdate } from '../../src/menu/logic/pageUpdate';
import type { StartScreen } from '../../src/menu/logic/profileScreens';
import { LANGUAGE_STORAGE_KEY } from '../../src/shared/logic/languageChoice';
import { PROFILE_COLORS } from '../../src/shared/logic/profiles';
import type { Profile } from '../../src/shared/logic/profiles';
import type { KeyValueStorage } from '../../src/shared/storage/keyValueStorage';
import { openProfiles } from '../../src/shared/storage/profileStorage';
import { DeviceStorage, forbiddenStorage } from '../shared/profileFixtures';
import {
  FakeDownload,
  FakeGame,
  TEST_CATEGORIES,
  TEST_GAMES,
  TEST_TEXTS_CS,
  translatorOf,
} from './menuFixtures';
import { deviceWithProfiles } from './profileScreenFixtures';

/**
 * Testy k #76: po nasazení nové verze webu se v dlouho otevřeném menu hra
 * nestáhne (starý soubor na serveru už není). Když server odpovídá, stránka
 * se sama jednou obnoví a další ťuknutí hru spustí z nové verze.
 *
 * Jedno `openPage(device)` je jedno načtení stránky: logika obnovení
 * (`createPageUpdate`) nad úložištěm zařízení, rozhodnutí o výběru profilu
 * při startu a menu s falešným stahováním a falešnou hrou. Zařízení drží
 * úložiště, které přežije obnovení, falešný server („odpovídá“ / „neodpovídá“
 * / „dotaz selže“) a počítadlo obnovení stránky. Čas běží na falešných
 * hodinách Vitestu.
 */

type ServerState = 'responds' | 'silent' | 'error';

class Device {
  reloads = 0;
  serverChecks = 0;
  server: ServerState = 'responds';

  /** Bez úložiště (`undefined`) prohlížeč úložiště nedá. */
  constructor(readonly storage: KeyValueStorage | undefined) {}

  serverResponds(): Promise<boolean> {
    this.serverChecks += 1;
    if (this.server === 'error') {
      return Promise.reject(new Error('síť nefunguje'));
    }
    return Promise.resolve(this.server === 'responds');
  }
}

/** Zařízení s prázdným funkčním úložištěm. */
function freshDevice(): Device {
  return new Device(new DeviceStorage());
}

interface TestPage {
  readonly menu: Menu;
  readonly download: FakeDownload;
  readonly game: FakeGame;
  readonly feedback: MenuFeedback[];
  /** Co stránka ukázala při startu. */
  readonly startScreen: StartScreen;
  kinds(): string[];
}

const EMA: Profile = { id: 'ema', nickname: 'EMA', color: PROFILE_COLORS[0] };
const OLA: Profile = { id: 'ola', nickname: 'OLA', color: PROFILE_COLORS[1] };
const IVA: Profile = { id: 'iva', nickname: 'IVA', color: PROFILE_COLORS[2] };

interface PageProfiles {
  readonly profiles: readonly Profile[];
  readonly activeId: string;
}

const ONE_PROFILE: PageProfiles = { profiles: [EMA], activeId: EMA.id };

/** Otevře (nebo po obnovení znovu otevře) stránku menu na zařízení. */
function openPage(device: Device, pageProfiles: PageProfiles = ONE_PROFILE): TestPage {
  const pageUpdate = createPageUpdate({
    storage: device.storage,
    serverResponds: () => device.serverResponds(),
    reloadPage: () => {
      device.reloads += 1;
    },
    activeProfileId: () => pageProfiles.activeId,
  });
  const startScreen = pageUpdate.startScreen(pageProfiles.profiles);
  const download = new FakeDownload();
  const game = new FakeGame();
  const feedback: MenuFeedback[] = [];
  const menu = createMenu({
    games: TEST_GAMES.map((entry) => ({ ...entry, load: download.load })),
    categories: TEST_CATEGORIES,
    translate: translatorOf(TEST_TEXTS_CS),
    start: game.start,
    feedback: (event) => feedback.push(event),
    pageUpdate,
  });
  return {
    menu,
    download,
    game,
    feedback,
    startScreen,
    kinds: () => feedback.map((event) => event.kind),
  };
}

/** Nechá doběhnout sliby (stažení, dotaz na server) a posune hodiny o `ms`. */
async function wait(ms = 0): Promise<void> {
  await vi.advanceTimersByTimeAsync(ms);
}

/** Ťukne na dlaždici a stažení hry selže. */
async function tapAndFail(page: TestPage, gameId = 'zebra'): Promise<void> {
  page.menu.tapTile(gameId);
  page.download.fail();
  await wait();
}

/** Ťukne na dlaždici, hra se stáhne a naběhne; pak se dítě vrátí domečkem. */
async function tapAndPlay(page: TestPage, gameId = 'zebra'): Promise<void> {
  page.menu.tapTile(gameId);
  page.download.succeed();
  await wait();
  expect(page.menu.runningGame()?.id).toBe(gameId);
  page.menu.returnFromGame();
}

function shakes(page: TestPage): number {
  return page.kinds().filter((kind) => kind === 'shake').length;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('#76 AC1: nová verze webu při otevřeném menu', () => {
  it('ťuknutí na dlaždici dá stejnou odezvu jako dřív: zmáčknutí a po 300 ms pulzování', async () => {
    const page = openPage(freshDevice());
    page.menu.tapTile('zebra');
    expect(page.kinds()).toEqual(['press']);
    await wait(SLOW_LOADING_MS);
    expect(page.feedback).toContainEqual({ kind: 'pulse', gameId: 'zebra' });
  });

  it('hra se nestáhne a server odpovídá: stránka se sama jednou obnoví a dlaždice se nezatřese', async () => {
    const device = freshDevice();
    const page = openPage(device);
    await tapAndFail(page);
    expect(device.reloads).toBe(1);
    expect(shakes(page)).toBe(0);
    expect(page.menu.runningGame()).toBeNull();
  });

  it('stahování delší než 15 s: dlaždice se zatřese a stránka se neobnoví, ani když stažení pak selže', async () => {
    const device = freshDevice();
    const page = openPage(device);
    page.menu.tapTile('zebra');
    await wait(LOADING_TIMEOUT_MS);
    expect(page.feedback).toContainEqual({ kind: 'shake', gameId: 'zebra' });
    page.download.fail();
    await wait();
    expect(device.reloads).toBe(0);
  });

  it('stažená hra selže při spuštění: dlaždice se zatřese a stránka se neobnoví', async () => {
    const device = freshDevice();
    const page = openPage(device);
    page.game.failing = true;
    page.menu.tapTile('zebra');
    page.download.succeed();
    await wait();
    expect(page.feedback).toContainEqual({ kind: 'shake', gameId: 'zebra' });
    expect(device.reloads).toBe(0);
  });

  it('po obnovení je dítě v menu svého profilu, výběr profilu se neukáže ani při dvou profilech', async () => {
    const device = freshDevice();
    const profiles: PageProfiles = { profiles: [EMA, OLA], activeId: OLA.id };
    const before = openPage(device, profiles);
    expect(before.startScreen).toBe('profilePicker');
    await tapAndFail(before);
    expect(device.reloads).toBe(1);

    const after = openPage(device, profiles);
    expect(after.startScreen).toBe('menu');
  });

  it('po obnovení se hra sama nespustí, další ťuknutí ji stáhne z nové verze a spustí', async () => {
    const device = freshDevice();
    await tapAndFail(openPage(device));

    const after = openPage(device);
    expect(after.download.count).toBe(0);
    expect(after.game.started).toEqual([]);
    expect(after.menu.runningGame()).toBeNull();

    after.menu.tapTile('zebra');
    after.download.succeed();
    await wait();
    expect(after.game.started.map((started) => started.gameId)).toEqual(['zebra']);
  });
});

describe('#76 AC2: výpadek sítě se chová jako dřív', () => {
  it('hra se nestáhne a server neodpovídá: stránka se neobnoví a dlaždice se zatřese', async () => {
    const device = freshDevice();
    device.server = 'silent';
    const page = openPage(device);
    await tapAndFail(page);
    expect(device.reloads).toBe(0);
    expect(page.feedback).toContainEqual({ kind: 'shake', gameId: 'zebra' });
  });

  it('dotaz na server bez sítě selže: stránka se neobnoví a dlaždice se zatřese', async () => {
    const device = freshDevice();
    device.server = 'error';
    const page = openPage(device);
    await tapAndFail(page);
    expect(device.reloads).toBe(0);
    expect(page.feedback).toContainEqual({ kind: 'shake', gameId: 'zebra' });
  });

  it('po výpadku sítě zůstane obnovení k dispozici: když pak server odpovídá, stránka se obnoví', async () => {
    const device = freshDevice();
    device.server = 'silent';
    const page = openPage(device);
    await tapAndFail(page);
    device.server = 'responds';
    await tapAndFail(page);
    expect(device.reloads).toBe(1);
  });
});

describe('#76 AC3: stránka se nikdy neobnovuje dokola', () => {
  it('dvě selhání po sobě vedou na jediné obnovení, podruhé se dlaždice jen zatřese', async () => {
    const device = freshDevice();
    await tapAndFail(openPage(device));

    const after = openPage(device);
    await tapAndFail(after);
    expect(device.reloads).toBe(1);
    expect(after.feedback).toContainEqual({ kind: 'shake', gameId: 'zebra' });
  });

  it('obnovení kvůli hře A a pak selhání hry B vede jen na zatřesení hry B', async () => {
    const device = freshDevice();
    await tapAndFail(openPage(device), 'zebra');

    const after = openPage(device);
    await tapAndFail(after, 'auto');
    expect(device.reloads).toBe(1);
    expect(after.feedback).toContainEqual({ kind: 'shake', gameId: 'auto' });
  });

  it('úspěšné spuštění hry a pak nové selhání vedou na jedno další obnovení', async () => {
    const device = freshDevice();
    await tapAndFail(openPage(device));

    const second = openPage(device);
    await tapAndPlay(second, 'zebra');
    await tapAndFail(second, 'auto');
    expect(device.reloads).toBe(2);

    const third = openPage(device);
    await tapAndFail(third, 'auto');
    expect(device.reloads).toBe(2);
    expect(third.feedback).toContainEqual({ kind: 'shake', gameId: 'auto' });
  });

  it('druhé selhání ještě před obnovením stránky už další obnovení nespustí', async () => {
    const device = freshDevice();
    const page = openPage(device);
    await tapAndFail(page, 'zebra');
    await tapAndFail(page, 'auto');
    expect(device.reloads).toBe(1);
  });

  it('ochrana proti opakování nemá časový limit, platí i po dlouhé době', async () => {
    const device = freshDevice();
    await tapAndFail(openPage(device));
    await wait(7 * 24 * 60 * 60 * 1000);

    const muchLater = openPage(device);
    await tapAndFail(muchLater);
    expect(device.reloads).toBe(1);
  });
});

describe('#76 AC4: zařízení si nic nepamatuje, stránka se sama neobnoví', () => {
  /** Úložiště, které zápis tiše zahodí a vždy vrací „nic“. */
  function forgetfulStorage(): KeyValueStorage {
    return {
      getItem: () => null,
      setItem: () => undefined,
    };
  }

  function readOnlyStorage(): DeviceStorage {
    const storage = new DeviceStorage();
    storage.failWrite = () => true;
    return storage;
  }

  function unreadableStorage(): DeviceStorage {
    const storage = new DeviceStorage();
    storage.failReads = true;
    return storage;
  }

  const cases: ReadonlyArray<[string, () => KeyValueStorage | undefined]> = [
    ['úložiště není', () => undefined],
    ['prohlížeč úložiště zakázal', forbiddenStorage],
    ['do úložiště nejde zapsat', readOnlyStorage],
    ['z úložiště nejde číst', unreadableStorage],
    ['úložiště zápis tiše zahodí', forgetfulStorage],
  ];

  it.each(cases)(
    '%s: hra se nestáhne, dlaždice se zatřese a stránka se neobnoví',
    async (_, make) => {
      const device = new Device(make());
      const page = openPage(device);
      await tapAndFail(page);
      expect(device.reloads).toBe(0);
      expect(page.feedback).toContainEqual({ kind: 'shake', gameId: 'zebra' });
    },
  );

  it.each(cases)('%s: výběr profilu se při dvou profilech ukáže jako obvykle', (_, make) => {
    const page = openPage(new Device(make()), { profiles: [EMA, OLA], activeId: EMA.id });
    expect(page.startScreen).toBe('profilePicker');
  });
});

describe('#76 AC5: aktivní profil se po obnovení nenajde', () => {
  it('bez automatického obnovení se výběr profilu ukáže při dvou profilech a s jedním ne', () => {
    expect(openPage(freshDevice(), { profiles: [EMA, OLA], activeId: EMA.id }).startScreen).toBe(
      'profilePicker',
    );
    expect(openPage(freshDevice(), ONE_PROFILE).startScreen).toBe('menu');
  });

  it('aktivní profil po obnovení zmizel: při dvou zbylých profilech se ukáže výběr profilu', async () => {
    const device = freshDevice();
    await tapAndFail(openPage(device, { profiles: [EMA, OLA, IVA], activeId: IVA.id }));

    const after = openPage(device, { profiles: [EMA, OLA], activeId: EMA.id });
    expect(after.startScreen).toBe('profilePicker');
  });

  it('aktivní profil po obnovení zmizel a zbyl jeden profil: rovnou menu jako obvykle', async () => {
    const device = freshDevice();
    await tapAndFail(openPage(device, { profiles: [EMA, OLA], activeId: OLA.id }));

    const after = openPage(device, ONE_PROFILE);
    expect(after.startScreen).toBe('menu');
  });

  it('výběr profilu se přeskočí jen při prvním startu po obnovení, ruční otevření stránky ho ukáže', async () => {
    const device = freshDevice();
    const profiles: PageProfiles = { profiles: [EMA, OLA], activeId: OLA.id };
    await tapAndFail(openPage(device, profiles));

    expect(openPage(device, profiles).startScreen).toBe('menu');
    expect(openPage(device, profiles).startScreen).toBe('profilePicker');
  });
});

describe('#76 AC6: automatické obnovení nic neztratí', () => {
  /** Zařízení se dvěma profily, aktivní OLA s hvězdičkami a nastavením, uložený jazyk. */
  function deviceWithData(): { storage: DeviceStorage; pageProfiles: PageProfiles } {
    const storage = deviceWithProfiles([{ nickname: 'EMA' }, { nickname: 'OLA' }]);
    storage.setItem(LANGUAGE_STORAGE_KEY, 'cs');
    const store = openProfiles(storage);
    const ola = store.profiles().find((profile) => profile.nickname === 'OLA') as Profile;
    store.selectProfile(ola.id);
    store.gameStorage('counting').setItem('agentic-app.progress', '{"stars":7}');
    store.gameStorage('counting').setItem('agentic-app.settings', '{"range":10}');
    return { storage, pageProfiles: { profiles: store.profiles(), activeId: ola.id } };
  }

  /** Údaje, které byly v `before`, mají po obnovení stejnou hodnotu; přibude nejvýš značka. */
  function expectNothingLost(before: Record<string, string>, storage: DeviceStorage): void {
    const after = storage.snapshot();
    for (const [key, value] of Object.entries(before)) {
      expect(after[key], key).toBe(value);
    }
    expect(storage.keysAddedSince(before).length).toBeLessThanOrEqual(1);
  }

  it('hvězdičky, nastavení her, profily, jazyk i aktivní profil zůstanou po obnovení stejné', async () => {
    const { storage, pageProfiles } = deviceWithData();
    const before = storage.snapshot();
    const device = new Device(storage);

    await tapAndFail(openPage(device, pageProfiles));
    expect(device.reloads).toBe(1);
    expectNothingLost(before, storage);

    openPage(device, pageProfiles);
    expectNothingLost(before, storage);
    expect(openProfiles(storage).activeProfile().nickname).toBe('OLA');
  });

  it('ani úspěšné spuštění hry po obnovení nezmění uložené údaje', async () => {
    const { storage, pageProfiles } = deviceWithData();
    const before = storage.snapshot();
    const device = new Device(storage);

    await tapAndFail(openPage(device, pageProfiles));
    await tapAndPlay(openPage(device, pageProfiles));
    expectNothingLost(before, storage);
  });
});
