import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ADD_PROFILE_HOLD_MS,
  MAX_PROFILES,
  suggestedProfileColor,
} from '../../src/menu/logic/profileScreens';
import { HOLD_TO_OPEN_SETTINGS_MS } from '../../src/shared/logic/settingsGear';
import { PROFILE_COLORS, makeProfile } from '../../src/shared/logic/profiles';
import { PROFILE_LIST_KEY, openProfiles } from '../../src/shared/storage/profileStorage';
import { CORRUPT_PROFILE_LISTS, DeviceStorage, forbiddenStorage } from '../shared/profileFixtures';
import {
  addProfile,
  deviceWithProfiles,
  holdAdd,
  pickerNicknames,
  testProfileScreens,
  typeNickname,
} from './profileScreenFixtures';

/**
 * Testy k #72 AC2 (nový profil jen pro rodiče, formulář ve dvou krocích),
 * AC4 (přezdívka, bez rozložení) a AC6 (okrajové případy).
 *
 * Navržené rozhraní (`src/menu/logic/profileScreens.ts`), navíc k AC1:
 * - `MAX_PROFILES` (6), `ADD_PROFILE_HOLD_MS` (stejně jako kolečko, 1 s),
 * - `canAddProfile()`: „+“ je vidět jen pod limitem,
 * - `addButton`: `HoldButton` ze sdílené části; ťuknutí dá odezvu
 *   `{ kind: 'wobble', target: 'add' }`, plnění kroužku
 *   `{ kind: 'addHolding', holding }`, podržení 1 s otevře 1. krok,
 * - 1. krok `'nickname'`: `nickname()`, `letterLayer()`, `canGoNext()`
 *   (→ ztlumené, když je `false`), `tapNext()`, `tapBack()`,
 * - 2. krok `'color'`: `palette()` (8 barev `{ color, selected }`),
 *   `selectedColor()`, `previewSymbol()`, `tapColor(color)`, `tapSave()`,
 *   `tapBack()`,
 * - zatřesení pole: `{ kind: 'shake', target: 'field' }`,
 * - `suggestedProfileColor(profiles)`: první barva palety, kterou žádný
 *   profil nemá, při obsazené celé paletě první barva.
 */

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

const FIELD_SHAKE = { kind: 'shake', target: 'field' } as const;

describe('#72 AC2: „+“ otevře formulář jen podržením 1 s', () => {
  it('podržení se počítá stejně dlouho jako u kolečka nastavení (1 s)', () => {
    expect(ADD_PROFILE_HOLD_MS).toBe(1000);
    expect(ADD_PROFILE_HOLD_MS).toBe(HOLD_TO_OPEN_SETTINGS_MS);
  });

  it('ťuknutí na „+“ ho jen zhoupne a formulář se neotevře', () => {
    const { screens, feedback } = testProfileScreens();

    screens.addButton.press(1);
    vi.advanceTimersByTime(200);
    screens.addButton.release(1);

    expect(feedback).toContainEqual({ kind: 'wobble', target: 'add' });
    expect(screens.screen()).toBe('picker');
  });

  it('kratší podržení než 1 s formulář neotevře', () => {
    const { screens } = testProfileScreens();

    screens.addButton.press(1);
    vi.advanceTimersByTime(ADD_PROFILE_HOLD_MS - 50);
    screens.addButton.release(1);

    expect(screens.screen()).toBe('picker');
  });

  it('během podržení se plní kroužek a po puštění zmizí', () => {
    const { screens, feedback } = testProfileScreens();

    screens.addButton.press(1);
    expect(feedback).toContainEqual({ kind: 'addHolding', holding: true });
    vi.advanceTimersByTime(300);
    screens.addButton.release(1);

    expect(feedback).toContainEqual({ kind: 'addHolding', holding: false });
  });

  it('podržení 1 s otevře 1. krok „Přezdívka“ s prázdným polem a základní vrstvou', () => {
    const { screens } = testProfileScreens();

    holdAdd(screens);

    expect(screens.screen()).toBe('nickname');
    expect(screens.nickname()).toBe('');
    expect(screens.letterLayer()).toBe('base');
  });
});

describe('#72 AC2: formulář ve dvou krocích, zpět a ✓', () => {
  it('→ s přezdívkou otevře 2. krok „Barva“ s náhledem kolečka a paletou 8 barev', () => {
    const { screens } = testProfileScreens();
    holdAdd(screens);
    typeNickname(screens, 'ČENĚK');

    screens.tapNext();

    expect(screens.screen()).toBe('color');
    expect(screens.previewSymbol()).toBe('Č');
    expect(screens.palette().map((swatch) => swatch.color)).toEqual([...PROFILE_COLORS]);
  });

  it('zpět v 1. kroku zavře formulář bez uložení', () => {
    const { screens, store } = testProfileScreens();
    holdAdd(screens);
    typeNickname(screens, 'EMA');

    screens.tapBack();

    expect(screens.screen()).toBe('picker');
    expect(store.profiles()).toHaveLength(1);
    expect(pickerNicknames(screens)).toEqual([null]);
  });

  it('po zpět z 1. kroku začne další formulář s prázdným polem', () => {
    const { screens } = testProfileScreens();
    holdAdd(screens);
    typeNickname(screens, 'EMA');
    screens.tapBack();

    holdAdd(screens);

    expect(screens.nickname()).toBe('');
  });

  it('zpět ve 2. kroku vrátí do 1. kroku a rozepsaná přezdívka zůstane', () => {
    const { screens, store } = testProfileScreens();
    holdAdd(screens);
    typeNickname(screens, 'ŽOFIE');
    screens.tapNext();

    screens.tapBack();

    expect(screens.screen()).toBe('nickname');
    expect(screens.nickname()).toBe('ŽOFIE');
    expect(store.profiles()).toHaveLength(1);
  });

  it('✓ profil uloží a vrátí se na výběr profilu s novým kolečkem na konci', () => {
    const { screens, store } = testProfileScreens(deviceWithProfiles([{ nickname: 'EMA' }]));

    addProfile(screens, 'TOM', PROFILE_COLORS[5]);

    expect(screens.screen()).toBe('picker');
    expect(pickerNicknames(screens)).toEqual([null, 'EMA', 'TOM']);
    expect(store.profiles()[2]).toMatchObject({ nickname: 'TOM', color: PROFILE_COLORS[5] });
  });

  it('nový profil se sám nevybere, aktivní zůstane dosavadní profil', () => {
    const test = testProfileScreens(deviceWithProfiles([{ nickname: 'EMA' }]));
    const before = test.store.activeProfile().id;

    addProfile(test.screens, 'TOM');

    expect(test.store.activeProfile().id).toBe(before);
    expect(test.chosen()).toBe(0);
  });

  it('nový profil zůstane i po dalším načtení stránky', () => {
    const test = testProfileScreens();

    addProfile(test.screens, 'ČENĚK');

    expect(
      openProfiles(test.storage)
        .profiles()
        .map((profile) => profile.nickname),
    ).toEqual([undefined, 'ČENĚK']);
  });
});

describe('#72 AC2: předvybraná barva', () => {
  it('předvybraná je první barva, kterou ještě žádný profil nemá', () => {
    const { screens } = testProfileScreens();
    holdAdd(screens);
    typeNickname(screens, 'EMA');
    screens.tapNext();

    // Výchozí profil má první barvu palety.
    expect(screens.selectedColor()).toBe(PROFILE_COLORS[1]);
    expect(screens.palette().filter((swatch) => swatch.selected)).toEqual([
      { color: PROFILE_COLORS[1], selected: true },
    ]);
  });

  it('předvýběr přeskočí jen obsazené barvy a vezme první volnou, ne další po poslední', () => {
    const storage = deviceWithProfiles([
      { nickname: 'EMA', color: PROFILE_COLORS[2] },
      { nickname: 'TOM', color: PROFILE_COLORS[3] },
    ]);
    const { screens } = testProfileScreens(storage);
    holdAdd(screens);
    typeNickname(screens, 'ANA');
    screens.tapNext();

    expect(screens.selectedColor()).toBe(PROFILE_COLORS[1]);
  });

  it('když jsou obsazené všechny barvy, předvybraná je první barva palety', () => {
    const everyColor = PROFILE_COLORS.map((color, index) => makeProfile(`p${index}`, color));

    expect(suggestedProfileColor(everyColor)).toBe(PROFILE_COLORS[0]);
  });

  it('bez obsazených barev je předvybraná první barva palety', () => {
    expect(suggestedProfileColor([])).toBe(PROFILE_COLORS[0]);
  });

  it('rodič může zvolit barvu, kterou už má jiný profil, a uloží se', () => {
    const { screens, store } = testProfileScreens(
      deviceWithProfiles([{ nickname: 'EMA', color: PROFILE_COLORS[2] }]),
    );

    addProfile(screens, 'TOM', PROFILE_COLORS[2]);

    expect(store.profiles().map((profile) => profile.color)).toEqual([
      PROFILE_COLORS[0],
      PROFILE_COLORS[2],
      PROFILE_COLORS[2],
    ]);
  });

  it('ťuknutí na barvu ji vybere a náhled kolečka ji ukáže', () => {
    const { screens } = testProfileScreens();
    holdAdd(screens);
    typeNickname(screens, 'EMA');
    screens.tapNext();

    screens.tapColor(PROFILE_COLORS[6]);

    expect(screens.selectedColor()).toBe(PROFILE_COLORS[6]);
    expect(
      screens
        .palette()
        .filter((swatch) => swatch.selected)
        .map((swatch) => swatch.color),
    ).toEqual([PROFILE_COLORS[6]]);
  });

  it('po zpět do 1. kroku a znovu → zůstane zvolená barva', () => {
    const { screens } = testProfileScreens();
    holdAdd(screens);
    typeNickname(screens, 'EMA');
    screens.tapNext();
    screens.tapColor(PROFILE_COLORS[7]);

    screens.tapBack();
    screens.tapNext();

    expect(screens.selectedColor()).toBe(PROFILE_COLORS[7]);
  });
});

describe('#72 AC2: nejvýš 6 profilů', () => {
  it('limit je 6 profilů', () => {
    expect(MAX_PROFILES).toBe(6);
  });

  it('s 6 profily se „+“ neukáže a podržení formulář neotevře', () => {
    const nicknames = ['EMA', 'TOM', 'ČENĚK', 'ŽOFIE', 'ANA'];
    const { screens } = testProfileScreens(
      deviceWithProfiles(nicknames.map((nickname) => ({ nickname }))),
    );

    expect(screens.pickerItems()).toHaveLength(6);
    expect(screens.canAddProfile()).toBe(false);
    holdAdd(screens);
    expect(screens.screen()).toBe('picker');
  });

  it('s 5 profily je „+“ vidět a po založení šestého zmizí', () => {
    const nicknames = ['EMA', 'TOM', 'ČENĚK', 'ŽOFIE'];
    const { screens } = testProfileScreens(
      deviceWithProfiles(nicknames.map((nickname) => ({ nickname }))),
    );
    expect(screens.canAddProfile()).toBe(true);

    addProfile(screens, 'ANA');

    expect(screens.pickerItems()).toHaveLength(6);
    expect(screens.canAddProfile()).toBe(false);
  });
});

describe('#72 AC4: přezdívka', () => {
  it('prázdnou přezdívku nejde uložit: → je ztlumené a ťuknutí na něj zatřese polem', () => {
    const { screens, feedback } = testProfileScreens();
    holdAdd(screens);

    expect(screens.canGoNext()).toBe(false);
    screens.tapNext();

    expect(screens.screen()).toBe('nickname');
    expect(feedback).toContainEqual(FIELD_SHAKE);
  });

  it('po smazání všech písmen je → zase ztlumené', () => {
    const { screens } = testProfileScreens();
    holdAdd(screens);
    typeNickname(screens, 'A');
    expect(screens.canGoNext()).toBe(true);

    screens.tapBackspace();

    expect(screens.canGoNext()).toBe(false);
  });

  it('stejnou přezdívku jako jiný profil nejde uložit a odezva je stejná jako u prázdné', () => {
    const { screens, feedback, store } = testProfileScreens(
      deviceWithProfiles([{ nickname: 'EMA' }]),
    );
    holdAdd(screens);
    typeNickname(screens, 'EMA');

    expect(screens.canGoNext()).toBe(false);
    screens.tapNext();

    expect(screens.screen()).toBe('nickname');
    expect(feedback).toContainEqual(FIELD_SHAKE);
    expect(store.profiles()).toHaveLength(2);
  });

  it('přezdívka, která je jen začátkem jiné, je povolená', () => {
    const { screens } = testProfileScreens(deviceWithProfiles([{ nickname: 'EMA' }]));
    holdAdd(screens);
    typeNickname(screens, 'EM');

    expect(screens.canGoNext()).toBe(true);
  });

  it('písmeno v kolečku je první písmeno přezdívky („ČENĚK“ → „Č“)', () => {
    const { screens } = testProfileScreens();

    addProfile(screens, 'ČENĚK');

    expect(screens.pickerItems()[1]).toMatchObject({ symbol: 'Č', nickname: 'ČENĚK' });
  });

  it('uložená přezdívka je jen z velkých písmen mřížky', () => {
    const { screens, store } = testProfileScreens();

    addProfile(screens, 'ŮŽĚ');

    expect(store.profiles()[1]?.nickname).toBe('ŮŽĚ');
  });
});

describe('#72 AC6: okrajové případy', () => {
  it('rychlé dvojí ťuknutí na ✓ založí jen jeden profil', () => {
    const { screens, store, storage } = testProfileScreens();
    holdAdd(screens);
    typeNickname(screens, 'EMA');
    screens.tapNext();

    screens.tapSave();
    screens.tapSave();

    expect(store.profiles()).toHaveLength(2);
    expect(openProfiles(storage).profiles()).toHaveLength(2);
  });

  it('otočení zařízení s otevřeným formulářem zachová krok, vrstvu, přezdívku i barvu', () => {
    // Stav formuláře nezávisí na okně: rozložení se po otočení jen spočítá
    // znovu ze stavu (testy rozložení), obrazovky profilů zůstanou stejné.
    const { screens } = testProfileScreens();
    holdAdd(screens);
    typeNickname(screens, 'ČEN');
    screens.tapLayerSwitch();
    const nicknameStep = {
      screen: screens.screen(),
      layer: screens.letterLayer(),
      nickname: screens.nickname(),
    };

    expect(nicknameStep).toEqual({ screen: 'nickname', layer: 'accents', nickname: 'ČEN' });
    typeNickname(screens, 'ĚK');
    screens.tapNext();
    screens.tapColor(PROFILE_COLORS[4]);
    expect({ screen: screens.screen(), color: screens.selectedColor() }).toEqual({
      screen: 'color',
      color: PROFILE_COLORS[4],
    });
  });

  it('když úložiště nejde zapsat, nový profil platí do zavření stránky a dítě nevidí chybu', () => {
    const storage = new DeviceStorage();
    const test = testProfileScreens(storage);
    storage.failWrite = () => true;

    expect(() => addProfile(test.screens, 'EMA')).not.toThrow();

    expect(pickerNicknames(test.screens)).toEqual([null, 'EMA']);
    expect(test.screens.screen()).toBe('picker');
    storage.failWrite = () => false;
    expect(openProfiles(storage).profiles()).toHaveLength(1);
  });

  it('se zakázaným úložištěm jde profil založit a vybrat bez chyby', () => {
    const test = testProfileScreens(forbiddenStorage());

    expect(() => addProfile(test.screens, 'TOM')).not.toThrow();
    const tom = test.store.profiles()[1];
    expect(() => test.screens.tapProfile(tom?.id ?? '')).not.toThrow();

    expect(test.store.activeProfile().nickname).toBe('TOM');
  });

  it('s poškozeným seznamem profilů platí nový profil jen do zavření stránky a seznam se nepřepíše', () => {
    for (const corrupt of CORRUPT_PROFILE_LISTS) {
      const storage = new DeviceStorage({ [PROFILE_LIST_KEY]: corrupt });
      const test = testProfileScreens(storage);

      expect(() => addProfile(test.screens, 'EMA'), corrupt).not.toThrow();

      expect(pickerNicknames(test.screens), corrupt).toEqual([null, 'EMA']);
      expect(storage.data.get(PROFILE_LIST_KEY), corrupt).toBe(corrupt);
    }
  });
});
