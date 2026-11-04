import { describe, expect, it } from 'vitest';

import { FIRST_CHARACTER, nextCharacter } from '../src/logic/characters';
import type { GameProgress } from '../src/logic/progress';
import { DEFAULT_SETTINGS, isFirstLaunch } from '../src/logic/settings';
import type { GameSettings } from '../src/logic/settings';
import {
  CLOSED_SETTINGS,
  chooseOption,
  confirmSettings,
  createLaunchState,
  isSettingsOpen,
  launchAfterConfirm,
  openSettings,
  pageAppearance,
  selectedOptions,
  sessionAtStart,
  showsHelp,
} from '../src/logic/settingsSession';
import type { LaunchState, SettingsSession } from '../src/logic/settingsSession';
import { loadProgress, saveProgress } from '../src/storage/progressStorage';
import { loadSettingsState, saveSettings } from '../src/storage/settingsStorage';
import type { KeyValueStorage } from '../src/storage/settingsStorage';

/**
 * Testy k #48 (nastavení s nápovědou při prvním spuštění): co se počítá za
 * první spuštění (AC1), uložení po ✓ a další spuštění (AC4), otevření
 * kolečkem bez nápovědy (AC5) a okrajové případy (AC6). Rozložení nápovědy
 * (AC2, AC3) je v `firstLaunchHelpLayout.test.ts`.
 */

const SETTINGS_KEY = 'agentic-app.settings';

/** Výběr, který rodič při prvním spuštění vždy uvidí: „10“, „+“ a „123“. */
const FIRST_LAUNCH_CHOICE = { maxNumber: 10, operations: 'plus', answerInput: 'keypad' } as const;

const PROGRESS_MID_SET: GameProgress = { earned: 4, character: nextCharacter(FIRST_CHARACTER) };

/** Úložiště v paměti, jako localStorage v prohlížeči. Přežije „zavření hry“. */
function memoryStorage(initial?: string): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  if (initial !== undefined) {
    data.set(SETTINGS_KEY, initial);
  }
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
}

/** Úložiště, které prohlížeč zakázal (soukromé okno): čtení i zápis selže. */
function brokenStorage(): KeyValueStorage {
  return {
    getItem: () => {
      throw new Error('úložiště zakázáno');
    },
    setItem: () => {
      throw new Error('úložiště zakázáno');
    },
  };
}

/** Úložiště, které jde přečíst, ale ne zapsat (plné). */
function readOnlyStorage(): KeyValueStorage {
  return {
    getItem: () => null,
    setItem: () => {
      throw new Error('úložiště plné');
    },
  };
}

interface Start {
  readonly launch: LaunchState;
  readonly settings: GameSettings;
  readonly session: SettingsSession;
}

/** Načtení stránky: přečte úložiště a rozhodne, jestli začne nastavení, nebo příklad. */
function loadPage(storage: KeyValueStorage | undefined): Start {
  const { settings, firstLaunch } = loadSettingsState(storage);
  const launch = createLaunchState(firstLaunch);
  return { launch, settings, session: sessionAtStart(launch, settings) };
}

/** Rodič ťukne na ✓: nastavení se uloží, zavře a stránka si pamatuje, že už bylo potvrzené. */
function tapConfirm(start: Start, storage: KeyValueStorage | undefined, progress: GameProgress) {
  const result = confirmSettings(start.session, start.settings, progress);
  const saved = saveSettings(storage, result.settings);
  return { ...result, saved, launch: launchAfterConfirm(start.launch) };
}

const FIRST_LAUNCH_RECORDS: readonly (string | null | undefined)[] = [
  null,
  undefined,
  '',
  'nesmysl',
  '{',
  'null',
  '42',
  'true',
  '"10"',
  '[]',
  '{}',
  '{"operations":"plus"}',
  '{"maxNumber":10}',
  '{"maxNumber":7,"operations":"plus"}',
  '{"maxNumber":"10","operations":"plus"}',
  '{"maxNumber":0,"operations":"minus"}',
  '{"maxNumber":10,"operations":"krat"}',
  '{"maxNumber":20,"operations":"−"}',
  '{"maxNumber":5,"operations":null,"answerInput":"writing"}',
];

const NOT_FIRST_LAUNCH_RECORDS: readonly string[] = [
  '{"maxNumber":10,"operations":"plus"}',
  '{"maxNumber":5,"operations":"minus"}',
  '{"maxNumber":20,"operations":"mixed","answerInput":"writing"}',
  '{"maxNumber":10,"operations":"plus","answerInput":"keypad"}',
  '{"maxNumber":5,"operations":"mixed","answerInput":"x"}',
];

describe('co se počítá za první spuštění (#48 AC1)', () => {
  it('chybějící, prázdné, nečitelné nebo neplatné nastavení je první spuštění', () => {
    for (const saved of FIRST_LAUNCH_RECORDS) {
      expect(isFirstLaunch(saved), String(saved)).toBe(true);
    }
  });

  it('platný rozsah a druh příkladů první spuštění není, i bez způsobu odpovědi', () => {
    for (const saved of NOT_FIRST_LAUNCH_RECORDS) {
      expect(isFirstLaunch(saved), saved).toBe(false);
    }
  });

  it('neznámý způsob odpovědi se bere jako číselník a nejde o první spuštění', () => {
    const storage = memoryStorage('{"maxNumber":5,"operations":"minus","answerInput":"x"}');
    const start = loadPage(storage);
    expect(start.session).toEqual(CLOSED_SETTINGS);
    expect(start.settings.maxNumber).toBe(5);
    expect(start.settings.operations).toBe('minus');
    expect(start.settings.answerInput ?? 'keypad').toBe('keypad');
  });

  it('když úložiště nejde vůbec přečíst, bere se to jako první spuštění', () => {
    expect(loadSettingsState(brokenStorage()).firstLaunch).toBe(true);
    expect(loadSettingsState(undefined).firstLaunch).toBe(true);
  });

  it('při prvním spuštění se místo prvního příkladu otevře nastavení s nápovědou', () => {
    const start = loadPage(memoryStorage());
    expect(isSettingsOpen(start.session)).toBe(true);
    expect(showsHelp(start.session)).toBe(true);
  });

  it('při prvním spuštění je vybráno „10“, „+“ a „123“', () => {
    expect(selectedOptions(loadPage(memoryStorage()).session)).toEqual(FIRST_LAUNCH_CHOICE);
  });

  it('i když byla část záznamu platná, při prvním spuštění je vybráno „10“, „+“ a „123“', () => {
    const partlyValid = [
      '{"maxNumber":5,"operations":"krat","answerInput":"writing"}',
      '{"maxNumber":7,"operations":"minus","answerInput":"writing"}',
      '{"maxNumber":20,"answerInput":"writing"}',
    ];
    for (const saved of partlyValid) {
      const start = loadPage(memoryStorage(saved));
      expect(selectedOptions(start.session), saved).toEqual(FIRST_LAUNCH_CHOICE);
    }
  });

  it('starý záznam bez způsobu odpovědi spustí hned příklad s číselníkem', () => {
    const start = loadPage(memoryStorage('{"maxNumber":20,"operations":"mixed"}'));
    expect(isSettingsOpen(start.session)).toBe(false);
    expect(start.settings).toEqual({ maxNumber: 20, operations: 'mixed' });
    expect(start.settings.answerInput ?? 'keypad').toBe('keypad');
  });

  it('stránka a kolečko vypadají jako při nastavení otevřeném kolečkem', () => {
    const firstLaunch = loadPage(memoryStorage()).session;
    const byHold = openSettings(CLOSED_SETTINGS, DEFAULT_SETTINGS);
    expect(pageAppearance(firstLaunch)).toEqual(pageAppearance(byHold));
  });

  it('podržení kolečka během prvního spuštění nic nezmění', () => {
    let session = loadPage(memoryStorage()).session;
    session = chooseOption(session, { maxNumber: 5 });
    const afterHold = openSettings(session, DEFAULT_SETTINGS);
    expect(afterHold).toEqual(session);
    expect(showsHelp(afterHold)).toBe(true);
    expect(selectedOptions(afterHold)?.maxNumber).toBe(5);
  });
});

describe('po ✓ se nastavení uloží a příště začne hra příkladem (#48 AC4)', () => {
  it('po ✓ bez jakékoli změny se uloží výchozí volby', () => {
    const storage = memoryStorage();
    const result = tapConfirm(loadPage(storage), storage, PROGRESS_MID_SET);
    expect(result.saved).toBe(true);
    expect(isFirstLaunch(storage.data.get(SETTINGS_KEY))).toBe(false);
    expect(loadSettingsState(storage).settings.maxNumber).toBe(10);
    expect(loadSettingsState(storage).settings.operations).toBe('plus');
  });

  it('po ✓ se nastavení zavře a přijde první příklad podle zvolených voleb', () => {
    const storage = memoryStorage();
    let start = loadPage(storage);
    start = {
      ...start,
      session: chooseOption(start.session, { maxNumber: 20, operations: 'minus' }),
    };
    const result = tapConfirm(start, storage, PROGRESS_MID_SET);

    expect(isSettingsOpen(result.session)).toBe(false);
    expect(result.startNewProblem).toBe(true);
    expect(result.settings.maxNumber).toBe(20);
    expect(result.settings.operations).toBe('minus');
    expect(pageAppearance(result.session)).toEqual(pageAppearance(CLOSED_SETTINGS));
  });

  it('po ✓ se zvolené psaní uloží a příště hra začne hned příkladem s psaním', () => {
    const storage = memoryStorage();
    let start = loadPage(storage);
    start = { ...start, session: chooseOption(start.session, { answerInput: 'writing' }) };
    tapConfirm(start, storage, PROGRESS_MID_SET);

    const next = loadPage(storage);
    expect(isSettingsOpen(next.session)).toBe(false);
    expect(next.settings).toEqual({ maxNumber: 10, operations: 'plus', answerInput: 'writing' });
  });

  it('při dalším spuštění se nastavení samo neotevře', () => {
    const storage = memoryStorage();
    tapConfirm(loadPage(storage), storage, PROGRESS_MID_SET);

    const next = loadPage(storage);
    expect(loadSettingsState(storage).firstLaunch).toBe(false);
    expect(next.session).toEqual(CLOSED_SETTINGS);
  });
});

describe('otevření kolečkem je bez nápovědy (#48 AC5)', () => {
  it('nastavení otevřené podržením kolečka nápovědu nemá', () => {
    const start = loadPage(memoryStorage('{"maxNumber":10,"operations":"plus"}'));
    expect(showsHelp(openSettings(start.session, start.settings))).toBe(false);
  });

  it('ani hned po prvním spuštění a ✓ nemá nastavení otevřené kolečkem nápovědu', () => {
    const storage = memoryStorage();
    const result = tapConfirm(loadPage(storage), storage, PROGRESS_MID_SET);
    const reopened = openSettings(result.session, result.settings);
    expect(isSettingsOpen(reopened)).toBe(true);
    expect(showsHelp(reopened)).toBe(false);
  });

  it('zavřené nastavení nápovědu neukazuje', () => {
    expect(showsHelp(CLOSED_SETTINGS)).toBe(false);
  });
});

describe('okrajové případy prvního spuštění (#48 AC6)', () => {
  it('když se hra zavře před ťuknutím na ✓, příště se nastavení otevře znovu s nápovědou', () => {
    const storage = memoryStorage();
    const first = loadPage(storage);
    chooseOption(first.session, { maxNumber: 5 });
    // Stránka se zavře nebo obnoví, ✓ nepřišlo, nic se neuložilo.

    const again = loadPage(storage);
    expect(showsHelp(again.session)).toBe(true);
    expect(selectedOptions(again.session)).toEqual(FIRST_LAUNCH_CHOICE);
  });

  it('když nastavení nejde uložit, otevře se s nápovědou při každém načtení stránky', () => {
    for (const storage of [brokenStorage(), readOnlyStorage(), undefined]) {
      const result = tapConfirm(loadPage(storage), storage, PROGRESS_MID_SET);
      expect(result.saved).toBe(false);

      const again = loadPage(storage);
      expect(showsHelp(again.session)).toBe(true);
    }
  });

  it('když nastavení nejde uložit, po ✓ se v témže načtení stránky znovu neotevře', () => {
    const storage = brokenStorage();
    const start = loadPage(storage);
    const result = tapConfirm(start, storage, PROGRESS_MID_SET);

    // Otočení zařízení nebo změna velikosti okna scénu postaví znovu.
    for (let rebuild = 0; rebuild < 3; rebuild += 1) {
      const session = sessionAtStart(result.launch, result.settings);
      expect(isSettingsOpen(session)).toBe(false);
    }
  });

  it('před ✓ otočení zařízení nebo změna velikosti nastavení s nápovědou nechá otevřené', () => {
    const start = loadPage(brokenStorage());
    const rebuilt = sessionAtStart(start.launch, start.settings);
    expect(isSettingsOpen(rebuilt)).toBe(true);
    expect(showsHelp(rebuilt)).toBe(true);
  });

  it('když nastavení nejde uložit, hra po ✓ běží s vybranými volbami', () => {
    const storage = brokenStorage();
    let start = loadPage(storage);
    start = {
      ...start,
      session: chooseOption(start.session, { maxNumber: 5, operations: 'mixed' }),
    };

    expect(() => tapConfirm(start, storage, PROGRESS_MID_SET)).not.toThrow();
    const result = tapConfirm(start, storage, PROGRESS_MID_SET);
    expect(result.startNewProblem).toBe(true);
    expect(result.settings.maxNumber).toBe(5);
    expect(result.settings.operations).toBe('mixed');
    expect(sessionAtStart(result.launch, result.settings)).toEqual(CLOSED_SETTINGS);
  });

  it('opakované potvrzení v témže načtení stránky už nápovědu nevrátí', () => {
    let launch = createLaunchState(true);
    launch = launchAfterConfirm(launch);
    launch = launchAfterConfirm(launch);
    expect(isSettingsOpen(sessionAtStart(launch, DEFAULT_SETTINGS))).toBe(false);
  });

  it('bez prvního spuštění se nastavení samo neotevře v žádném načtení', () => {
    const launch = createLaunchState(false);
    expect(sessionAtStart(launch, DEFAULT_SETTINGS)).toEqual(CLOSED_SETTINGS);
    expect(sessionAtStart(launchAfterConfirm(launch), DEFAULT_SETTINGS)).toEqual(CLOSED_SETTINGS);
  });

  it('hvězdičky a postavička uložené z dřívějška po prvním spuštění zůstanou', () => {
    const storage = memoryStorage();
    saveProgress(storage, PROGRESS_MID_SET);

    const start = loadPage(storage);
    expect(showsHelp(start.session)).toBe(true);
    const result = tapConfirm(start, storage, loadProgress(storage));
    expect(result.progress).toEqual(PROGRESS_MID_SET);
    expect(loadProgress(storage)).toEqual(PROGRESS_MID_SET);
  });

  it('nečitelné uložené nastavení nesmaže uložené hvězdičky', () => {
    const storage = memoryStorage('nesmysl');
    saveProgress(storage, PROGRESS_MID_SET);
    loadPage(storage);
    expect(loadProgress(storage)).toEqual(PROGRESS_MID_SET);
  });
});
