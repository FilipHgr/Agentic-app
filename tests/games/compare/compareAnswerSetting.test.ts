import { describe, expect, it } from 'vitest';

import {
  ANSWER_INPUT_OPTIONS,
  DEFAULT_COMPARE_SETTINGS,
} from '../../../src/games/compare/logic/compareSettings';
import { COMPARE_META } from '../../../src/games/compare/meta';
import { COMPARE_SETTINGS_KEY } from '../../../src/games/compare/storage/settingsStorage';
import { PROFILE_COLORS } from '../../../src/shared/logic/profiles';
import { openProfiles } from '../../../src/shared/storage/profileStorage';
import { DeviceStorage } from '../../shared/profileFixtures';
import { MemoryStorage, openCompare } from './compareFakes';

/**
 * Testy k #188 AC1: řada „Odpověď“ v nastavení Porovnávání pro rodiče:
 * ťuknutím (výchozí) nebo psaním, uložená podle profilu. Starší nebo
 * poškozená volba dá ťuknutí. Vzhled řady (stejné symboly „123“ a tužka
 * jako v Počítání) hlídá `compareSettingsLayout.test.ts`.
 */

describe('#188 AC1: rodič zvolí odpověď ťuknutím nebo psaním', () => {
  it('v nastavení jsou volby ťuknutím a psaním, výchozí je ťuknutí', () => {
    expect([...ANSWER_INPUT_OPTIONS]).toEqual(['tap', 'writing']);
    expect(DEFAULT_COMPARE_SETTINGS.answerInput).toBe('tap');
    expect(openCompare().session.settings().answerInput).toBe('tap');
  });

  it('po zvolení psaní a ✓ hra hned dá nový příklad na psaní a volba se uloží', () => {
    const storage = new MemoryStorage();
    const test = openCompare(storage);
    test.gear.hold();
    test.session.chooseSetting({ answerInput: 'writing' });
    expect(test.session.settingsChoice()?.answerInput).toBe('writing');
    test.changes.length = 0;
    test.session.confirmSettings();
    expect(test.session.settings().answerInput).toBe('writing');
    expect(test.changes.map((change) => change.kind)).toContain('problemStarted');
    expect(openCompare(storage).session.settings().answerInput, 'po novém otevření').toBe(
      'writing',
    );
  });

  it('volba odpovědi nezmění rozsah a změna rozsahu nezmění odpověď', () => {
    const storage = new MemoryStorage();
    const test = openCompare(storage);
    test.gear.hold();
    test.session.chooseSetting({ answerInput: 'writing' });
    test.session.chooseSetting({ maxNumber: 20 });
    test.session.confirmSettings();
    expect(openCompare(storage).session.settings()).toEqual({
      maxNumber: 20,
      answerInput: 'writing',
    });
  });

  it('každý profil má vlastní způsob odpovědi', () => {
    const device = new DeviceStorage();
    const store = openProfiles(device);
    const first = store.activeProfile();
    const second = store.createProfile({ nickname: 'EMA', color: PROFILE_COLORS[1] });
    const test = openCompare(store.gameStorage(COMPARE_META.id));
    test.gear.hold();
    test.session.chooseSetting({ answerInput: 'writing' });
    test.session.confirmSettings();

    store.selectProfile(second.id);
    expect(openCompare(store.gameStorage(COMPARE_META.id)).session.settings().answerInput).toBe(
      'tap',
    );
    store.selectProfile(first.id);
    expect(openCompare(store.gameStorage(COMPARE_META.id)).session.settings().answerInput).toBe(
      'writing',
    );
  });

  it('nastavení z doby před volbou odpovědi nebo s neznámou volbou dá ťuknutí a hra jde dál', () => {
    const saved = [
      '{"maxNumber":20}',
      '{"maxNumber":20,"answerInput":"keypad"}',
      '{"maxNumber":20,"answerInput":7}',
    ];
    for (const value of saved) {
      const storage = new MemoryStorage();
      storage.data.set(COMPARE_SETTINGS_KEY, value);
      expect(openCompare(storage).session.settings(), value).toEqual({
        maxNumber: 20,
        answerInput: 'tap',
      });
    }
  });

  it('bez ✓ (odchod z nastavení zavřením hry) se volba psaní neuloží', () => {
    const storage = new MemoryStorage();
    const test = openCompare(storage);
    test.gear.hold();
    test.session.chooseSetting({ answerInput: 'writing' });
    test.session.leave();
    expect(openCompare(storage).session.settings().answerInput).toBe('tap');
  });
});
