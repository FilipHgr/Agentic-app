import { describe, expect, it } from 'vitest';

import { START_PROGRESS } from '../../../src/games/counting/logic/progress';
import { answerInputOf } from '../../../src/games/counting/logic/settings';
import { createLaunchState } from '../../../src/games/counting/logic/settingsSession';
import { guideAtStart } from '../../../src/games/counting/logic/setupGuide';
import { loadProgress, saveProgress } from '../../../src/games/counting/storage/progressStorage';
import {
  loadSettingsState,
  saveSettings,
} from '../../../src/games/counting/storage/settingsStorage';
import type { KeyValueStorage } from '../../../src/shared/storage/keyValueStorage';

/**
 * Testy k #64, AC5: po rozdělení na sdílenou část a Počítání dítě
 * pokračuje, kde skončilo. Hra čte stejné klíče úložiště jako ve sprintu 2
 * a záznamy uložené starší verzí hry načte beze změny.
 */

const SETTINGS_KEY = 'agentic-app.settings';
const PROGRESS_KEY = 'agentic-app.progress';

/** Úložiště v paměti se záznamy, které v zařízení nechala starší verze hry. */
function storageWith(saved: Record<string, string>): KeyValueStorage & {
  readonly data: Map<string, string>;
} {
  const data = new Map(Object.entries(saved));
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
}

/** Otevře se po spuštění hry sám průvodce nastavením (#48, #49)? */
function guideOpensAtStart(storage: KeyValueStorage): boolean {
  const { firstLaunch } = loadSettingsState(storage);
  return guideAtStart(createLaunchState(firstLaunch)) !== null;
}

describe('AC5: dítě po aktualizaci pokračuje, kde skončilo', () => {
  it('uložené nastavení se načte jako sčítání do 10 s číselníkem a průvodce se neotevře', () => {
    const storage = storageWith({
      [SETTINGS_KEY]: '{"maxNumber":10,"operations":"plus","answerInput":"keypad"}',
    });

    const { settings, firstLaunch } = loadSettingsState(storage);

    expect(settings.maxNumber).toBe(10);
    expect(settings.operations).toBe('plus');
    expect(answerInputOf(settings)).toBe('keypad');
    expect(firstLaunch).toBe(false);
    expect(guideOpensAtStart(storage)).toBe(false);
  });

  it('postup ze sprintu 2 s postavičkou se načte jako 7 hvězdiček a postavička se ignoruje', () => {
    const storage = storageWith({ [PROGRESS_KEY]: '{"earned":7,"character":"robik"}' });

    expect(loadProgress(storage)).toEqual({ earned: 7 });
  });

  it('uložený postup bez postavičky se načte jako 9 hvězdiček', () => {
    const storage = storageWith({ [PROGRESS_KEY]: '{"earned":9}' });

    expect(loadProgress(storage)).toEqual({ earned: 9 });
  });

  it('s prázdným úložištěm se otevře průvodce nastavením a hra začne bez hvězdiček', () => {
    const storage = storageWith({});

    expect(guideOpensAtStart(storage)).toBe(true);
    expect(loadProgress(storage)).toEqual(START_PROGRESS);
  });

  it('poškozený postup vrátí začátek hry bez chyby', () => {
    const storage = storageWith({ [PROGRESS_KEY]: '{"earned":' });

    expect(() => loadProgress(storage)).not.toThrow();
    expect(loadProgress(storage)).toEqual(START_PROGRESS);
  });

  it('nastavení i postup se ukládají pod stejné klíče jako dřív', () => {
    const storage = storageWith({});

    saveSettings(storage, { maxNumber: 20, operations: 'minus', answerInput: 'writing' });
    saveProgress(storage, { earned: 3 });

    expect([...storage.data.keys()].sort()).toEqual([PROGRESS_KEY, SETTINGS_KEY]);
    expect(loadSettingsState(storage).settings).toEqual({
      maxNumber: 20,
      operations: 'minus',
      answerInput: 'writing',
    });
    expect(loadProgress(storage)).toEqual({ earned: 3 });
  });
});
