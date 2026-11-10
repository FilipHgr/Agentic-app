import { describe, expect, it } from 'vitest';

import { createMenu } from '../../src/menu/logic/menu';
import type { MenuFeedback } from '../../src/menu/logic/menu';
import { startScreenFor } from '../../src/menu/logic/profileScreens';
import { PROFILE_COLORS } from '../../src/shared/logic/profiles';
import type { Profile } from '../../src/shared/logic/profiles';
import { PROFILE_LIST_KEY, openProfiles } from '../../src/shared/storage/profileStorage';
import { CORRUPT_PROFILE_LISTS, DeviceStorage, forbiddenStorage } from '../shared/profileFixtures';
import {
  FakeDownload,
  FakeGame,
  TEST_CATEGORIES,
  TEST_GAMES,
  TEST_TEXTS_CS,
  translatorOf,
} from './menuFixtures';
import { deviceWithProfiles, pickerNicknames, testProfileScreens } from './profileScreenFixtures';

/**
 * Testy k #72 AC1 (logika): obrazovka výběru profilu (obrázek P), kdy se
 * ukáže při startu, ťuknutí na profil v menu a výběr profilu.
 *
 * Navržené rozhraní (`src/menu/logic/profileScreens.ts`):
 * - `startScreenFor(profiles)`: `'profilePicker'` při dvou a více
 *   profilech, jinak `'menu'`,
 * - `createProfileScreens({ profiles, feedback, onProfileChosen })` vrátí
 *   `ProfileScreens`; `screen()` je `'closed'` (menu nebo hra),
 *   `'picker'`, `'nickname'` nebo `'color'`, `open()` ukáže výběr,
 *   `pickerItems()` kolečka `{ id, color, symbol, nickname }` v pořadí
 *   založení, `tapProfile(id)` profil vybere, zavře výběr a zavolá
 *   `onProfileChosen`,
 * - `createMenu({ …, onOpenProfilePicker })`: `menu.tapProfile()` místo
 *   zhoupnutí z #71 zavolá `onOpenProfilePicker`.
 *
 * Hvězdičky vybraného profilu v Počítání testuje
 * `tests/menu/chosenProfile.test.ts`.
 */

const STAR = '★';

describe('#72 AC1: při startu se výběr profilu ukáže jen při dvou a více profilech', () => {
  it('na novém zařízení (jen výchozí profil) jde stránka rovnou do menu', () => {
    const store = openProfiles(new DeviceStorage());

    expect(startScreenFor(store.profiles())).toBe('menu');
  });

  it('s jedním profilem jde stránka rovnou do menu', () => {
    const store = openProfiles(deviceWithProfiles([]));

    expect(store.profiles()).toHaveLength(1);
    expect(startScreenFor(store.profiles())).toBe('menu');
  });

  it('se dvěma profily se při startu ukáže výběr profilu', () => {
    const store = openProfiles(deviceWithProfiles([{ nickname: 'EMA' }]));

    expect(startScreenFor(store.profiles())).toBe('profilePicker');
  });

  it('se šesti profily se při startu ukáže výběr profilu', () => {
    const nicknames = ['EMA', 'TOM', 'ČENĚK', 'ŽOFIE', 'ANA'];
    const store = openProfiles(deviceWithProfiles(nicknames.map((nickname) => ({ nickname }))));

    expect(startScreenFor(store.profiles())).toBe('profilePicker');
  });

  it('s poškozeným seznamem profilů (dočasný profil) jde stránka do menu bez chyby', () => {
    for (const corrupt of CORRUPT_PROFILE_LISTS) {
      const store = openProfiles(new DeviceStorage({ [PROFILE_LIST_KEY]: corrupt }));

      expect(startScreenFor(store.profiles()), corrupt).toBe('menu');
    }
  });

  it('se zakázaným úložištěm jde stránka do menu bez chyby', () => {
    const store = openProfiles(forbiddenStorage());

    expect(startScreenFor(store.profiles())).toBe('menu');
  });
});

describe('#72 AC1: výběr profilu ukáže kolečka profilů v pořadí, v jakém vznikly', () => {
  it('každé kolečko má barvu profilu, první písmeno přezdívky a přezdívku', () => {
    const storage = deviceWithProfiles([
      { nickname: 'ČENĚK', color: PROFILE_COLORS[2] },
      { nickname: 'EMA', color: PROFILE_COLORS[5] },
    ]);
    const { screens, store } = testProfileScreens(storage);
    const [first, second, third] = store.profiles();

    expect(screens.pickerItems()).toEqual([
      { id: first?.id, color: PROFILE_COLORS[0], symbol: STAR, nickname: null },
      { id: second?.id, color: PROFILE_COLORS[2], symbol: 'Č', nickname: 'ČENĚK' },
      { id: third?.id, color: PROFILE_COLORS[5], symbol: 'E', nickname: 'EMA' },
    ]);
  });

  it('profily jsou v pořadí založení, ne podle abecedy', () => {
    const storage = deviceWithProfiles([
      { nickname: 'ZORA' },
      { nickname: 'ADAM' },
      { nickname: 'MÍŠA' },
    ]);

    expect(pickerNicknames(testProfileScreens(storage).screens)).toEqual([
      null,
      'ZORA',
      'ADAM',
      'MÍŠA',
    ]);
  });

  it('po otevření je vidět výběr profilu', () => {
    expect(testProfileScreens().screens.screen()).toBe('picker');
  });

  it('pod limitem 6 profilů je za kolečky „+“', () => {
    expect(
      testProfileScreens(deviceWithProfiles([{ nickname: 'EMA' }])).screens.canAddProfile(),
    ).toBe(true);
  });
});

describe('#72 AC1: ťuknutí na kolečko profilu ho vybere a otevře menu', () => {
  it('ťuknutí na jiný profil ho udělá aktivním a stránka ukáže menu', () => {
    const test = testProfileScreens(deviceWithProfiles([{ nickname: 'EMA' }, { nickname: 'TOM' }]));
    const tom = test.store.profiles()[2];

    test.screens.tapProfile(tom?.id ?? '');

    expect(test.store.activeProfile().nickname).toBe('TOM');
    expect(test.screens.screen()).toBe('closed');
    expect(test.chosen()).toBe(1);
  });

  it('vybraný profil platí i po dalším načtení stránky', () => {
    const storage = deviceWithProfiles([{ nickname: 'EMA' }, { nickname: 'TOM' }]);
    const test = testProfileScreens(storage);
    const ema = test.store.profiles()[1];

    test.screens.tapProfile(ema?.id ?? '');

    expect(openProfiles(storage).activeProfile().nickname).toBe('EMA');
  });

  it('ťuknutí na už aktivní profil jen otevře menu se stejným profilem', () => {
    const test = testProfileScreens(deviceWithProfiles([{ nickname: 'EMA' }]));
    const active = test.store.activeProfile();

    test.screens.tapProfile(active.id);

    expect(test.store.activeProfile().id).toBe(active.id);
    expect(test.chosen()).toBe(1);
  });

  it('po výběru ukáže kolečko v menu vybraný profil', () => {
    const test = testProfileScreens(
      deviceWithProfiles([{ nickname: 'ŽOFIE', color: PROFILE_COLORS[4] }]),
    );
    const menu = createMenu({
      games: TEST_GAMES,
      categories: TEST_CATEGORIES,
      translate: translatorOf(TEST_TEXTS_CS),
      start: () => undefined,
      feedback: () => undefined,
      profile: () => test.store.activeProfile(),
    });

    test.screens.tapProfile(test.store.profiles()[1]?.id ?? '');

    expect(menu.profileBadge()).toEqual({
      color: PROFILE_COLORS[4],
      symbol: 'Ž',
      nickname: 'ŽOFIE',
    });
  });

  it('neznámý profil nic nevybere a výběr zůstane otevřený', () => {
    const test = testProfileScreens(deviceWithProfiles([{ nickname: 'EMA' }]));
    const before = test.store.activeProfile().id;

    expect(() => test.screens.tapProfile('neexistuje')).not.toThrow();

    expect(test.store.activeProfile().id).toBe(before);
    expect(test.screens.screen()).toBe('picker');
    expect(test.chosen()).toBe(0);
  });
});

interface ProfileMenu {
  readonly menu: ReturnType<typeof createMenu>;
  readonly feedback: MenuFeedback[];
  readonly game: FakeGame;
  readonly download: FakeDownload;
  opened(): number;
}

function menuOpeningPicker(profile: () => Profile): ProfileMenu {
  const download = new FakeDownload();
  const game = new FakeGame();
  const feedback: MenuFeedback[] = [];
  let opened = 0;
  const menu = createMenu({
    games: TEST_GAMES.map((entry) => ({ ...entry, load: download.load })),
    categories: TEST_CATEGORIES,
    translate: translatorOf(TEST_TEXTS_CS),
    start: game.start,
    feedback: (event) => feedback.push(event),
    profile,
    onOpenProfilePicker: () => {
      opened += 1;
    },
  });
  return { menu, feedback, game, download, opened: () => opened };
}

describe('#72 AC1: ťuknutí na profil v menu otevře výběr profilu vždy', () => {
  it('i s jedním profilem otevře ťuknutí na profil výběr profilu, aby šel přidat další', () => {
    const store = openProfiles(new DeviceStorage());
    const test = menuOpeningPicker(() => store.activeProfile());

    test.menu.tapProfile();

    expect(test.opened()).toBe(1);
    expect(test.game.started).toEqual([]);
    expect(test.download.count).toBe(0);
  });

  it('ťuknutí na profil už profil jen nezhoupne (odezva z #71 se nahrazuje)', () => {
    const test = menuOpeningPicker(() => ({ id: 'p1', nickname: 'EMA', color: PROFILE_COLORS[1] }));

    test.menu.tapProfile();

    expect(test.feedback).not.toContainEqual({ kind: 'wobble', target: { kind: 'profile' } });
    expect(test.opened()).toBe(1);
  });

  it('obrazovka profilů otevřená z menu začíná výběrem profilu', () => {
    const test = testProfileScreens();
    test.screens.tapProfile(test.store.activeProfile().id);
    expect(test.screens.screen()).toBe('closed');

    test.screens.open();

    expect(test.screens.screen()).toBe('picker');
  });
});
