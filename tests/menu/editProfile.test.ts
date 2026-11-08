import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createMenu } from '../../src/menu/logic/menu';
import { HOLD_TO_OPEN_SETTINGS_MS } from '../../src/shared/logic/settingsGear';
import { PROFILE_COLORS } from '../../src/shared/logic/profiles';
import { PROFILE_LIST_KEY, openProfiles } from '../../src/shared/storage/profileStorage';
import {
  CORRUPT_PROFILE_LISTS,
  DeviceStorage,
  forbiddenStorage,
  profileDataKeys,
} from '../shared/profileFixtures';
import {
  FakeDownload,
  FakeGame,
  TEST_CATEGORIES,
  TEST_GAMES,
  TEST_TEXTS_CS,
  translatorOf,
} from './menuFixtures';
import {
  EDIT_PROFILE_HOLD_MS,
  addProfile,
  clearNickname,
  deviceWithProfiles,
  holdAdd,
  holdConfirmDelete,
  holdProfile,
  pickerNicknames,
  testProfileScreens,
  typeNickname,
} from './profileScreenFixtures';
import type { TestProfileScreens } from './profileScreenFixtures';

/**
 * Testy k #73 (úprava a smazání profilu) na obrazovkách profilů: AC1
 * (podržení kolečka otevře úpravu), AC2 (koš a potvrzení smazání), AC3
 * (nepovedené smazání, poškozený seznam) a AC4 (okrajové případy).
 * Úložiště profilů testuje `tests/shared/profileEditStorage.test.ts`,
 * rozložení koše a potvrzení `tests/menu/deleteProfileLayout.test.ts`.
 *
 * Navržené rozhraní (`src/menu/logic/profileScreens.ts`), navíc k #72:
 * - `profileButton(id): HoldButton` pro kolečko na výběru: ťuknutí profil
 *   vybere (jako `tapProfile(id)`), podržení 1 s otevře 1. krok úpravy,
 *   sjetí prstu podržení zruší; plnění kroužku hlásí odezva
 *   `{ kind: 'profileHolding', id, holding }`,
 * - `formMode(): 'new' | 'edit' | null` (`null` mimo formulář),
 * - úprava používá stejné kroky `'nickname'` a `'color'` jako nový profil,
 *   předvyplněné přezdívkou a barvou profilu; vlastní dosavadní přezdívka
 *   se při kontrole stejné přezdívky nepočítá; u profilu bez přezdívky je
 *   → aktivní i s prázdným polem; ✓ uloží přes
 *   `ProfileStore.updateProfile` a vrátí výběr,
 * - `canDeleteProfile()`: koš je vidět jen ve 2. kroku úpravy a jen když
 *   jsou aspoň dva profily,
 * - `tapDelete()` (koš) otevře potvrzení: obrazovka `'confirmDelete'`,
 *   `deleteConfirmProfile()` vrátí kolečko profilu
 *   (`ProfilePickerItem`, mimo potvrzení `null`),
 * - `tapCancelDelete()` („Zpět“) vrátí do 2. kroku s rozepsanou změnou,
 * - „Smazat“ smaže přes `ProfileStore.deleteProfile` (od #108 podržením
 *   `confirmDeleteButton` 1 s, viz `deleteProfileHold.test.ts`);
 *   aktivní je první zbývající profil; při dvou a více zbývajících se
 *   ukáže výběr (`'picker'`), jinak se obrazovky zavřou (`'closed'`)
 *   a zavolá se `onProfileChosen` (stránka ukáže menu).
 */

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

const STAR = '★';
const FIELD_SHAKE = { kind: 'shake', target: 'field' } as const;
const SAVE_TAP = { kind: 'tap', target: 'save' } as const;
const GAME = 'counting';
const STARS_KEY = 'agentic-app.progress';

/** Výběr s výchozím profilem (bez přezdívky), EMA a TOM. */
function threeProfiles(): TestProfileScreens {
  return testProfileScreens(deviceWithProfiles([{ nickname: 'EMA' }, { nickname: 'TOM' }]));
}

function profileId(test: TestProfileScreens, index: number): string {
  return test.store.profiles()[index]?.id ?? '';
}

/** Otevře úpravu profilu na pořadí `index` a přejde do 2. kroku. */
function openColorStep(test: TestProfileScreens, index: number): void {
  holdProfile(test.screens, profileId(test, index));
  test.screens.tapNext();
}

/** Smaže profil na pořadí `index`: podržet, →, koš, podržet „Smazat“ 1 s (#108). */
function deleteProfileAt(test: TestProfileScreens, index: number): void {
  openColorStep(test, index);
  test.screens.tapDelete();
  holdConfirmDelete(test.screens);
}

describe('#73 AC1: podržení kolečka profilu 1 s otevře úpravu', () => {
  it('podržení se počítá stejně dlouho jako u kolečka nastavení (1 s)', () => {
    expect(EDIT_PROFILE_HOLD_MS).toBe(HOLD_TO_OPEN_SETTINGS_MS);
  });

  it('podržení 0,99 s úpravu neotevře', () => {
    const test = threeProfiles();

    holdProfile(test.screens, profileId(test, 1), 990);

    expect(test.screens.screen()).not.toBe('nickname');
    expect(test.screens.formMode()).toBeNull();
  });

  it('podržení 1 s otevře 1. krok úpravy s přezdívkou profilu', () => {
    const test = threeProfiles();

    holdProfile(test.screens, profileId(test, 1));

    expect(test.screens.screen()).toBe('nickname');
    expect(test.screens.formMode()).toBe('edit');
    expect(test.screens.nickname()).toBe('EMA');
    expect(test.screens.letterLayer()).toBe('base');
  });

  it('úprava má předvybranou barvu profilu, ne první volnou barvu', () => {
    const test = testProfileScreens(
      deviceWithProfiles([{ nickname: 'EMA', color: PROFILE_COLORS[6] }]),
    );

    holdProfile(test.screens, profileId(test, 1));
    test.screens.tapNext();

    expect(test.screens.screen()).toBe('color');
    expect(test.screens.selectedColor()).toBe(PROFILE_COLORS[6]);
    expect(test.screens.previewSymbol()).toBe('E');
  });

  it('během podržení se kolem kolečka plní kroužek a po puštění zmizí', () => {
    const test = threeProfiles();
    const id = profileId(test, 1);
    const button = test.screens.profileButton(id);

    button.press(1);
    expect(test.feedback).toContainEqual({ kind: 'profileHolding', id, holding: true });
    vi.advanceTimersByTime(300);
    button.release(1);

    expect(test.feedback).toContainEqual({ kind: 'profileHolding', id, holding: false });
  });

  it('ťuknutí na kolečko profil dál jen vybere a stránka ukáže menu', () => {
    const test = threeProfiles();
    const id = profileId(test, 2);

    holdProfile(test.screens, id, 100);

    expect(test.screens.screen()).toBe('closed');
    expect(test.screens.formMode()).toBeNull();
    expect(test.store.activeProfile().id).toBe(id);
    expect(test.chosen()).toBe(1);
  });

  it('když prst sjede z kolečka dřív než za 1 s, nic se neotevře ani nevybere', () => {
    const test = threeProfiles();
    const before = test.store.activeProfile().id;
    const button = test.screens.profileButton(profileId(test, 1));

    button.press(1);
    vi.advanceTimersByTime(500);
    button.leave(1);
    vi.advanceTimersByTime(EDIT_PROFILE_HOLD_MS);
    button.release(1);

    expect(test.screens.screen()).toBe('picker');
    expect(test.store.activeProfile().id).toBe(before);
    expect(test.chosen()).toBe(0);
  });

  it('podržení kolečka úpravu otevře, jen když je vidět výběr profilu', () => {
    const test = threeProfiles();
    const id = profileId(test, 1);
    test.screens.tapProfile(id);
    expect(test.screens.screen()).toBe('closed');

    holdProfile(test.screens, id);

    expect(test.screens.screen()).toBe('closed');
  });
});

describe('#73 AC1: přezdívka v úpravě', () => {
  it('vlastní dosavadní přezdívka se nepočítá jako stejná, → je aktivní a jde uložit', () => {
    const test = threeProfiles();
    holdProfile(test.screens, profileId(test, 1));

    expect(test.screens.canGoNext()).toBe(true);
    test.screens.tapNext();
    test.screens.tapSave();

    expect(test.screens.screen()).toBe('picker');
    expect(pickerNicknames(test.screens)).toEqual([null, 'EMA', 'TOM']);
  });

  it('přezdívku jiného profilu nejde uložit: → je ztlumené a pole se zatřese', () => {
    const test = threeProfiles();
    holdProfile(test.screens, profileId(test, 1));
    clearNickname(test.screens);
    typeNickname(test.screens, 'TOM');

    expect(test.screens.canGoNext()).toBe(false);
    test.screens.tapNext();

    expect(test.screens.screen()).toBe('nickname');
    expect(test.feedback).toContainEqual(FIELD_SHAKE);
  });

  it('profilu s přezdívkou nejde přezdívku smazat: s prázdným polem je → ztlumené', () => {
    const test = threeProfiles();
    holdProfile(test.screens, profileId(test, 1));

    clearNickname(test.screens);

    expect(test.screens.nickname()).toBe('');
    expect(test.screens.canGoNext()).toBe(false);
  });

  it('profil bez přezdívky z přenosu dat má → aktivní i s prázdným polem', () => {
    const test = threeProfiles();

    holdProfile(test.screens, profileId(test, 0));

    expect(test.screens.nickname()).toBe('');
    expect(test.screens.canGoNext()).toBe(true);
  });

  it('profil bez přezdívky jde uložit dál bez přezdívky a na výběru má ★', () => {
    const test = threeProfiles();
    holdProfile(test.screens, profileId(test, 0));
    test.screens.tapNext();
    test.screens.tapColor(PROFILE_COLORS[4]);

    test.screens.tapSave();

    expect(test.screens.pickerItems()[0]).toMatchObject({
      color: PROFILE_COLORS[4],
      symbol: STAR,
      nickname: null,
    });
    expect(openProfiles(test.storage).profiles()[0]?.nickname).toBeUndefined();
  });

  it('profil bez přezdívky jde uložit s novou přezdívkou', () => {
    const test = threeProfiles();
    holdProfile(test.screens, profileId(test, 0));
    typeNickname(test.screens, 'ČENĚK');
    test.screens.tapNext();

    test.screens.tapSave();

    expect(test.screens.pickerItems()[0]).toMatchObject({ symbol: 'Č', nickname: 'ČENĚK' });
  });

  it('pro přezdívku v úpravě platí limit délky a plné pole se zatřese', () => {
    const test = threeProfiles();
    holdProfile(test.screens, profileId(test, 1));
    clearNickname(test.screens);
    typeNickname(test.screens, 'WWWWWWWWWWWW');

    test.screens.tapLetter('A');

    expect(test.screens.nickname()).toBe('WWWWWWWWWWWW');
    expect(test.feedback).toContainEqual(FIELD_SHAKE);
  });
});

describe('#73 AC1: ✓ uloží úpravu, zpět nic nezmění', () => {
  it('✓ uloží novou přezdívku a barvu a vrátí výběr s novým písmenem a barvou', () => {
    const test = threeProfiles();
    holdProfile(test.screens, profileId(test, 1));
    clearNickname(test.screens);
    typeNickname(test.screens, 'ŽOFKA');
    test.screens.tapNext();
    test.screens.tapColor(PROFILE_COLORS[7]);

    test.screens.tapSave();

    expect(test.screens.screen()).toBe('picker');
    expect(test.screens.pickerItems()[1]).toEqual({
      id: profileId(test, 1),
      color: PROFILE_COLORS[7],
      symbol: 'Ž',
      nickname: 'ŽOFKA',
    });
    expect(openProfiles(test.storage).profiles()[1]).toMatchObject({
      nickname: 'ŽOFKA',
      color: PROFILE_COLORS[7],
    });
  });

  it('po úpravě zůstanou profilu hvězdičky a profilů je stejně', () => {
    const test = threeProfiles();
    const id = profileId(test, 1);
    test.store.selectProfile(id);
    test.store.gameStorage(GAME).setItem(STARS_KEY, '{"earned":7}');
    holdProfile(test.screens, id);
    clearNickname(test.screens);
    typeNickname(test.screens, 'EMIL');
    test.screens.tapNext();

    test.screens.tapSave();

    expect(test.store.profiles()).toHaveLength(3);
    const reloaded = openProfiles(test.storage);
    expect(reloaded.activeProfile()).toMatchObject({ id, nickname: 'EMIL' });
    expect(reloaded.gameStorage(GAME).getItem(STARS_KEY)).toBe('{"earned":7}');
  });

  it('úprava profil nevybere, aktivní zůstane dosavadní profil', () => {
    const test = threeProfiles();
    const before = test.store.activeProfile().id;
    holdProfile(test.screens, profileId(test, 2));
    test.screens.tapNext();
    test.screens.tapColor(PROFILE_COLORS[3]);

    test.screens.tapSave();

    expect(test.store.activeProfile().id).toBe(before);
    expect(test.chosen()).toBe(0);
  });

  it('kolečko profilu v menu ukáže nové písmeno a barvu', () => {
    const test = threeProfiles();
    const id = profileId(test, 1);
    test.store.selectProfile(id);
    const menu = createMenu({
      games: TEST_GAMES.map((entry) => ({ ...entry, load: new FakeDownload().load })),
      categories: TEST_CATEGORIES,
      translate: translatorOf(TEST_TEXTS_CS),
      start: new FakeGame().start,
      feedback: () => undefined,
      profile: () => test.store.activeProfile(),
    });
    holdProfile(test.screens, id);
    clearNickname(test.screens);
    typeNickname(test.screens, 'ŽOFKA');
    test.screens.tapNext();
    test.screens.tapColor(PROFILE_COLORS[5]);

    test.screens.tapSave();

    expect(menu.profileBadge()).toEqual({
      color: PROFILE_COLORS[5],
      symbol: 'Ž',
      nickname: 'ŽOFKA',
    });
  });

  it('zpět z 1. kroku úpravy zavře formulář a nic nezmění', () => {
    const test = threeProfiles();
    const before = test.storage.snapshot();
    holdProfile(test.screens, profileId(test, 1));
    clearNickname(test.screens);
    typeNickname(test.screens, 'EMIL');

    test.screens.tapBack();

    expect(test.screens.screen()).toBe('picker');
    expect(pickerNicknames(test.screens)).toEqual([null, 'EMA', 'TOM']);
    expect(test.storage.snapshot()).toEqual(before);
  });

  it('zpět ze 2. kroku a pak z 1. kroku bez ✓ nezmění přezdívku ani barvu', () => {
    const test = threeProfiles();
    const original = test.store.profiles()[1];
    const before = test.storage.snapshot();
    holdProfile(test.screens, profileId(test, 1));
    clearNickname(test.screens);
    typeNickname(test.screens, 'EMIL');
    test.screens.tapNext();
    test.screens.tapColor(PROFILE_COLORS[7]);

    test.screens.tapBack();
    expect(test.screens.screen()).toBe('nickname');
    expect(test.screens.nickname()).toBe('EMIL');
    test.screens.tapBack();

    expect(test.store.profiles()[1]).toEqual(original);
    expect(test.storage.snapshot()).toEqual(before);
  });

  it('úprava jde uložit i při plném počtu 6 profilů a profil nepřibude', () => {
    const nicknames = ['EMA', 'TOM', 'ČENĚK', 'ŽOFIE', 'ANA'];
    const test = testProfileScreens(
      deviceWithProfiles(nicknames.map((nickname) => ({ nickname }))),
    );
    holdProfile(test.screens, profileId(test, 3));
    test.screens.tapNext();
    test.screens.tapColor(PROFILE_COLORS[0]);

    test.screens.tapSave();

    expect(test.store.profiles()).toHaveLength(6);
    expect(test.store.profiles()[3]?.color).toBe(PROFILE_COLORS[0]);
  });

  it('po úpravě začne nový profil přes „+“ s prázdným polem', () => {
    const test = threeProfiles();
    holdProfile(test.screens, profileId(test, 1));
    test.screens.tapNext();
    test.screens.tapSave();

    holdAdd(test.screens);

    expect(test.screens.formMode()).toBe('new');
    expect(test.screens.nickname()).toBe('');
  });
});

describe('#73 AC2: koš je jen v úpravě a ne u posledního profilu', () => {
  it('ve 2. kroku úpravy je koš, když jsou aspoň dva profily', () => {
    const test = testProfileScreens(deviceWithProfiles([{ nickname: 'EMA' }]));

    openColorStep(test, 1);

    expect(test.screens.canDeleteProfile()).toBe(true);
  });

  it('v 1. kroku úpravy koš není', () => {
    const test = threeProfiles();

    holdProfile(test.screens, profileId(test, 1));

    expect(test.screens.canDeleteProfile()).toBe(false);
  });

  it('u nového profilu koš není', () => {
    const test = threeProfiles();
    holdAdd(test.screens);
    typeNickname(test.screens, 'ANA');
    test.screens.tapNext();

    expect(test.screens.formMode()).toBe('new');
    expect(test.screens.canDeleteProfile()).toBe(false);
    test.screens.tapDelete();
    expect(test.screens.screen()).toBe('color');
  });

  it('u posledního zbývajícího profilu koš není a ťuknutí na jeho místo nic nesmaže', () => {
    const test = testProfileScreens();
    openColorStep(test, 0);

    expect(test.screens.canDeleteProfile()).toBe(false);
    test.screens.tapDelete();
    holdConfirmDelete(test.screens);

    expect(test.screens.screen()).toBe('color');
    expect(test.store.profiles()).toHaveLength(1);
  });
});

describe('#73 AC2: potvrzení smazání', () => {
  it('ťuknutí na koš ukáže potvrzení s kolečkem a přezdívkou profilu', () => {
    const test = threeProfiles();
    openColorStep(test, 1);

    test.screens.tapDelete();

    expect(test.screens.screen()).toBe('confirmDelete');
    expect(test.screens.deleteConfirmProfile()).toEqual({
      id: profileId(test, 1),
      color: PROFILE_COLORS[1],
      symbol: 'E',
      nickname: 'EMA',
    });
  });

  it('potvrzení u profilu bez přezdívky má v kolečku ★', () => {
    const test = threeProfiles();
    openColorStep(test, 0);

    test.screens.tapDelete();

    expect(test.screens.deleteConfirmProfile()).toMatchObject({ symbol: STAR, nickname: null });
  });

  it('mimo potvrzení žádné kolečko k smazání není', () => {
    const test = threeProfiles();

    expect(test.screens.deleteConfirmProfile()).toBeNull();
    openColorStep(test, 1);
    expect(test.screens.deleteConfirmProfile()).toBeNull();
  });

  it('„Zpět“ nic nesmaže a vrátí 2. krok s rozepsanou změnou', () => {
    const test = threeProfiles();
    const before = test.storage.snapshot();
    openColorStep(test, 1);
    test.screens.tapColor(PROFILE_COLORS[6]);
    test.screens.tapDelete();

    test.screens.tapCancelDelete();

    expect(test.screens.screen()).toBe('color');
    expect(test.screens.formMode()).toBe('edit');
    expect(test.screens.selectedColor()).toBe(PROFILE_COLORS[6]);
    expect(test.store.profiles()).toHaveLength(3);
    expect(test.storage.snapshot()).toEqual(before);
  });

  it('„Smazat“ smaže profil a jeho hvězdičky, ostatní profily zůstanou (tři profily)', () => {
    const test = threeProfiles();
    const [first, ema, tom] = test.store.profiles();
    for (const profile of [first, ema, tom]) {
      test.store.selectProfile(profile?.id ?? '');
      test.store.gameStorage(GAME).setItem(STARS_KEY, `{"for":"${profile?.id ?? ''}"}`);
    }

    deleteProfileAt(test, 1);

    expect(test.store.profiles()).toEqual([first, tom]);
    expect(profileDataKeys(test.storage, ema?.id ?? '')).toEqual([]);
    for (const profile of [first, tom]) {
      const reloaded = openProfiles(test.storage);
      reloaded.selectProfile(profile?.id ?? '');
      expect(reloaded.gameStorage(GAME).getItem(STARS_KEY)).toBe(`{"for":"${profile?.id ?? ''}"}`);
    }
  });

  it('po smazání se zbylými dvěma profily se ukáže výběr profilu', () => {
    const test = threeProfiles();

    deleteProfileAt(test, 2);

    expect(test.screens.screen()).toBe('picker');
    expect(pickerNicknames(test.screens)).toEqual([null, 'EMA']);
    expect(test.chosen()).toBe(0);
  });

  it('po smazání s jedním zbylým profilem se ukáže menu', () => {
    const test = testProfileScreens(deviceWithProfiles([{ nickname: 'EMA' }]));

    deleteProfileAt(test, 1);

    expect(test.screens.screen()).toBe('closed');
    expect(test.chosen()).toBe(1);
    expect(test.store.profiles()).toHaveLength(1);
  });

  it('po smazání neaktivního profilu je aktivní první zbývající profil', () => {
    const test = threeProfiles();
    const first = profileId(test, 0);
    test.store.selectProfile(profileId(test, 2));

    deleteProfileAt(test, 1);

    expect(test.store.activeProfile().id).toBe(first);
    expect(openProfiles(test.storage).activeProfile().id).toBe(first);
  });

  it('po smazání aktivního profilu je aktivní první zbývající profil', () => {
    const test = threeProfiles();
    const ema = profileId(test, 1);
    test.store.selectProfile(profileId(test, 0));

    deleteProfileAt(test, 0);

    expect(test.store.activeProfile().id).toBe(ema);
    expect(openProfiles(test.storage).activeProfile().id).toBe(ema);
  });

  it('po smazání jednoho ze 6 profilů se zase ukáže „+“', () => {
    const nicknames = ['EMA', 'TOM', 'ČENĚK', 'ŽOFIE', 'ANA'];
    const test = testProfileScreens(
      deviceWithProfiles(nicknames.map((nickname) => ({ nickname }))),
    );
    expect(test.screens.canAddProfile()).toBe(false);

    deleteProfileAt(test, 2);

    expect(test.screens.screen()).toBe('picker');
    expect(test.screens.canAddProfile()).toBe(true);
    addProfile(test.screens, 'IVA');
    expect(test.store.profiles()).toHaveLength(6);
  });
});

describe('#73 AC3: smazání se nepovede napůl', () => {
  it('když se seznam nepodaří uložit, profil zůstane a dítě nevidí chybu', () => {
    const test = threeProfiles();
    const before = test.storage.snapshot();
    test.storage.failWrite = (key) => key === PROFILE_LIST_KEY;

    expect(() => deleteProfileAt(test, 1)).not.toThrow();

    expect(pickerNicknames(test.screens)).toEqual([null, 'EMA', 'TOM']);
    expect(test.storage.snapshot()).toEqual(before);
  });

  it('s poškozeným seznamem nejde smazat ani profil přidaný do zavření stránky', () => {
    for (const corrupt of CORRUPT_PROFILE_LISTS) {
      const storage = new DeviceStorage({ [PROFILE_LIST_KEY]: corrupt });
      const test = testProfileScreens(storage);
      addProfile(test.screens, 'EMA');

      expect(() => deleteProfileAt(test, 1), corrupt).not.toThrow();

      expect(pickerNicknames(test.screens), corrupt).toEqual([null, 'EMA']);
      expect(storage.data.get(PROFILE_LIST_KEY), corrupt).toBe(corrupt);
    }
  });
});

describe('#73 AC4: okrajové případy', () => {
  it('podržení „Smazat“ těsně po smazání už nesmaže další profil', () => {
    const test = testProfileScreens(
      deviceWithProfiles([{ nickname: 'EMA' }, { nickname: 'TOM' }, { nickname: 'ANA' }]),
    );
    openColorStep(test, 1);
    test.screens.tapDelete();

    holdConfirmDelete(test.screens);
    holdConfirmDelete(test.screens);

    expect(pickerNicknames(test.screens)).toEqual([null, 'TOM', 'ANA']);
    expect(openProfiles(test.storage).profiles()).toHaveLength(3);
  });

  it('rychlé dvojí ťuknutí na ✓ uloží úpravu jednou', () => {
    const test = threeProfiles();
    holdProfile(test.screens, profileId(test, 1));
    clearNickname(test.screens);
    typeNickname(test.screens, 'EMIL');
    test.screens.tapNext();

    test.screens.tapSave();
    test.screens.tapSave();

    expect(
      test.feedback.filter((event) => event.kind === 'tap' && event.target === 'save'),
    ).toEqual([SAVE_TAP]);
    expect(test.screens.screen()).toBe('picker');
    expect(pickerNicknames(test.screens)).toEqual([null, 'EMIL', 'TOM']);
    expect(openProfiles(test.storage).profiles()).toHaveLength(3);
  });

  it('otočení zařízení s otevřenou úpravou zachová rozepsanou přezdívku a barvu', () => {
    // Stav úpravy nezávisí na okně: rozložení se po otočení jen spočítá
    // znovu ze stavu (`deleteProfileLayout.test.ts`), obrazovky zůstanou.
    const test = threeProfiles();
    holdProfile(test.screens, profileId(test, 1));
    clearNickname(test.screens);
    typeNickname(test.screens, 'EMIL');
    expect({ screen: test.screens.screen(), nickname: test.screens.nickname() }).toEqual({
      screen: 'nickname',
      nickname: 'EMIL',
    });

    test.screens.tapNext();
    test.screens.tapColor(PROFILE_COLORS[3]);

    expect({
      screen: test.screens.screen(),
      mode: test.screens.formMode(),
      color: test.screens.selectedColor(),
    }).toEqual({ screen: 'color', mode: 'edit', color: PROFILE_COLORS[3] });
  });

  it('otočení zařízení s otevřeným potvrzením zachová potvrzení i rozepsanou změnu', () => {
    const test = threeProfiles();
    openColorStep(test, 1);
    test.screens.tapColor(PROFILE_COLORS[3]);
    test.screens.tapDelete();

    expect(test.screens.screen()).toBe('confirmDelete');
    expect(test.screens.deleteConfirmProfile()?.id).toBe(profileId(test, 1));
    test.screens.tapCancelDelete();
    expect(test.screens.selectedColor()).toBe(PROFILE_COLORS[3]);
  });

  it('když úložiště nejde zapsat, upravený profil platí do zavření stránky a dítě nevidí chybu', () => {
    const test = threeProfiles();
    test.storage.failWrite = () => true;
    holdProfile(test.screens, profileId(test, 1));
    clearNickname(test.screens);
    typeNickname(test.screens, 'EMIL');
    test.screens.tapNext();

    expect(() => test.screens.tapSave()).not.toThrow();

    expect(pickerNicknames(test.screens)).toEqual([null, 'EMIL', 'TOM']);
    test.storage.failWrite = () => false;
    expect(
      openProfiles(test.storage)
        .profiles()
        .map((profile) => profile.nickname),
    ).toEqual([undefined, 'EMA', 'TOM']);
  });

  it('se zakázaným úložištěm jde profil upravit bez chyby', () => {
    const test = testProfileScreens(forbiddenStorage());
    addProfile(test.screens, 'TOM');

    holdProfile(test.screens, profileId(test, 1));
    clearNickname(test.screens);
    typeNickname(test.screens, 'TOMÁŠ');
    test.screens.tapNext();
    expect(() => test.screens.tapSave()).not.toThrow();

    expect(pickerNicknames(test.screens)).toEqual([null, 'TOMÁŠ']);
  });
});
