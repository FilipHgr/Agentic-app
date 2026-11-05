import { describe, expect, it } from 'vitest';

import type { GameProgress } from '../src/logic/progress';
import { DEFAULT_SETTINGS, isFirstLaunch, parseSettings } from '../src/logic/settings';
import type { GameSettings } from '../src/logic/settings';
import { layoutSettingsPanel } from '../src/logic/settingsLayout';
import {
  CLOSED_SETTINGS,
  createLaunchState,
  isSettingsOpen,
  openSettings,
  pageAppearance,
  selectedOptions,
} from '../src/logic/settingsSession';
import type { LaunchState } from '../src/logic/settingsSession';
import {
  canOpenSettingsByHold,
  chooseOption,
  finishGuide,
  guideAtStart,
  guidePageAppearance,
  guideSelection,
  guideStep,
  launchAfterGuide,
  next,
} from '../src/logic/setupGuide';
import type { GuideState } from '../src/logic/setupGuide';
import { loadProgress, saveProgress } from '../src/storage/progressStorage';
import { loadSettingsState, saveSettings } from '../src/storage/settingsStorage';
import type { KeyValueStorage } from '../src/storage/settingsStorage';
import { SETTINGS_KEY, brokenStorage, memoryStorage, readOnlyStorage } from './storageFakes';

/**
 * Testy k prvnímu spuštění: co se počítá za první spuštění (#48 AC1), že se
 * místo nastavení s nápovědou otevře průvodce (#49 AC1), uložení po „Začít
 * hrát“ a další spuštění (#48 AC4, #49 AC4), otevření kolečkem bez průvodce
 * (#48 AC5, #49 AC6) a okrajové případy (#48 AC6, #49 AC6). Nápověda vedle ✓
 * z #48 AC2 a AC3 už neplatí, nahradil ji průvodce (#49). Průvodce je ve
 * znění bez otázky na třídu: začíná řadou „Do kolika“ a shrnutí je krok 4.
 * Samotné kroky průvodce jsou v `setupGuide.test.ts`.
 */

const START_LOCK_MS = 500;
const T0 = 50_000;
const SUMMARY_STEP = 4;

/** Výchozí volby, které průvodce při prvním spuštění předvyplní: „10“, „+“ a „123“. */
const FIRST_LAUNCH_CHOICE = { maxNumber: 10, operations: 'plus', answerInput: 'keypad' } as const;

const PROGRESS_MID_SET: GameProgress = { earned: 4 };
const PROGRESS_ALMOST_FULL: GameProgress = { earned: 9 };

interface Page {
  readonly launch: LaunchState;
  readonly settings: GameSettings;
  /** Průvodce, nebo `null`, když hra začíná hned příkladem. */
  readonly guide: GuideState | null;
}

/** Načtení stránky: přečte úložiště a rozhodne, jestli začne průvodce, nebo příklad. */
function loadPage(storage: KeyValueStorage | undefined): Page {
  const { settings, firstLaunch } = loadSettingsState(storage);
  const launch = createLaunchState(firstLaunch);
  return { launch, settings, guide: guideAtStart(launch) };
}

/** Průvodce, který na stránce musí být; jinak test selže se srozumitelnou zprávou. */
function guideOf(page: Page): GuideState {
  if (page.guide === null) {
    throw new Error('průvodce se neotevřel');
  }
  return page.guide;
}

/** Rodič projde „Další“ všechny kroky až na shrnutí a tam případně volby změní. */
function walkToSummary(guide: GuideState, change: Partial<GameSettings> = {}): GuideState {
  let state = guide;
  for (let tap = 0; tap < 3; tap += 1) {
    state = next(state, T0 + 1000);
  }
  return chooseOption(state, change);
}

/** Rodič ťukne na „Začít hrát“: nastavení se uloží, průvodce zavře a stránka si to pamatuje. */
function tapStartPlaying(page: Page, summary: GuideState, storage: KeyValueStorage | undefined) {
  const settings = finishGuide(summary, T0 + 1000 + START_LOCK_MS);
  if (settings === null) {
    throw new Error('„Začít hrát“ nezareagovalo');
  }
  const saved = saveSettings(storage, settings);
  return { settings, saved, launch: launchAfterGuide(page.launch) };
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

  it('neznámý způsob odpovědi se bere jako číselník a průvodce se neotevře', () => {
    const page = loadPage(memoryStorage('{"maxNumber":5,"operations":"minus","answerInput":"x"}'));
    expect(page.guide).toBeNull();
    expect(page.settings.maxNumber).toBe(5);
    expect(page.settings.operations).toBe('minus');
    expect(page.settings.answerInput ?? 'keypad').toBe('keypad');
  });

  it('když úložiště nejde vůbec přečíst, bere se to jako první spuštění', () => {
    expect(loadSettingsState(brokenStorage()).firstLaunch).toBe(true);
    expect(loadSettingsState(undefined).firstLaunch).toBe(true);
  });

  it('starý záznam bez způsobu odpovědi spustí hned příklad s číselníkem', () => {
    const page = loadPage(memoryStorage('{"maxNumber":20,"operations":"mixed"}'));
    expect(page.guide).toBeNull();
    expect(page.settings).toEqual({ maxNumber: 20, operations: 'mixed' });
    expect(page.settings.answerInput ?? 'keypad').toBe('keypad');
  });

  it('stránka a kolečko vypadají během průvodce jako při nastavení otevřeném kolečkem', () => {
    const byHold = openSettings(CLOSED_SETTINGS, DEFAULT_SETTINGS);
    expect(guidePageAppearance()).toEqual(pageAppearance(byHold));
  });
});

describe('při prvním spuštění se otevře průvodce (#49 AC1)', () => {
  it('při prvním spuštění se místo prvního příkladu otevře průvodce na kroku 1', () => {
    const guide = guideOf(loadPage(memoryStorage()));
    expect(guideStep(guide)).toBe(1);
  });

  it('průvodce při prvním spuštění předvyplní „10“, „+“ a „123“', () => {
    expect(guideSelection(guideOf(loadPage(memoryStorage())))).toEqual(FIRST_LAUNCH_CHOICE);
  });

  it('při každém druhu prvního spuštění začne průvodce na kroku 1', () => {
    for (const saved of FIRST_LAUNCH_RECORDS) {
      const storage =
        saved === null || saved === undefined ? memoryStorage() : memoryStorage(saved);
      const page = loadPage(storage);
      expect(page.guide && guideStep(page.guide), String(saved)).toBe(1);
    }
  });

  it('bez prvního spuštění se průvodce neotevře a hra začne příkladem', () => {
    for (const saved of NOT_FIRST_LAUNCH_RECORDS) {
      expect(loadPage(memoryStorage(saved)).guide, saved).toBeNull();
    }
  });

  it('předvyplněné je „10“, „+“ a „123“, i když byla část záznamu platná', () => {
    const partlyValid = [
      '{"maxNumber":5,"operations":"krat","answerInput":"writing"}',
      '{"maxNumber":7,"operations":"minus","answerInput":"writing"}',
      '{"maxNumber":20,"answerInput":"writing"}',
    ];
    for (const saved of partlyValid) {
      const guide = guideOf(loadPage(memoryStorage(saved)));
      expect(guideSelection(guide), saved).toEqual(FIRST_LAUNCH_CHOICE);
      expect(guideSelection(walkToSummary(guide)), saved).toEqual(FIRST_LAUNCH_CHOICE);
    }
  });

  it('průvodce uloží jen nastavení, nic dalšího', () => {
    const storage = memoryStorage();
    const page = loadPage(storage);
    tapStartPlaying(page, walkToSummary(guideOf(page)), storage);

    expect([...storage.data.keys()]).toEqual([SETTINGS_KEY]);
    const record = JSON.parse(storage.data.get(SETTINGS_KEY) ?? '{}') as Record<string, unknown>;
    expect(Object.keys(record).sort()).toEqual(['answerInput', 'maxNumber', 'operations']);
  });
});

describe('po „Začít hrát“ se nastavení uloží a příště začne hra příkladem (#48 AC4, #49 AC4)', () => {
  it('po „Začít hrát“ bez jakékoli změny se uloží předvyplněné volby', () => {
    const storage = memoryStorage();
    const page = loadPage(storage);
    const result = tapStartPlaying(page, walkToSummary(guideOf(page)), storage);

    expect(result.saved).toBe(true);
    expect(isFirstLaunch(storage.data.get(SETTINGS_KEY))).toBe(false);
    expect(parseSettings(storage.data.get(SETTINGS_KEY))).toEqual(FIRST_LAUNCH_CHOICE);
  });

  it('volba změněná v kroku průvodce se po „Začít hrát“ uloží', () => {
    const storage = memoryStorage();
    const page = loadPage(storage);
    const step1 = chooseOption(guideOf(page), { maxNumber: 5 });
    tapStartPlaying(page, walkToSummary(step1), storage);
    expect(parseSettings(storage.data.get(SETTINGS_KEY))).toEqual({
      ...FIRST_LAUNCH_CHOICE,
      maxNumber: 5,
    });
  });

  it('první příklad přijde podle voleb z průvodce', () => {
    const storage = memoryStorage();
    const page = loadPage(storage);
    const summary = walkToSummary(guideOf(page), { maxNumber: 20, operations: 'minus' });
    const result = tapStartPlaying(page, summary, storage);
    expect(result.settings).toEqual({ maxNumber: 20, operations: 'minus', answerInput: 'keypad' });
  });

  it('zvolené psaní se uloží a příště hra začne hned příkladem s psaním', () => {
    const storage = memoryStorage();
    const page = loadPage(storage);
    tapStartPlaying(page, walkToSummary(guideOf(page), { answerInput: 'writing' }), storage);

    const nextPage = loadPage(storage);
    expect(nextPage.guide).toBeNull();
    expect(nextPage.settings).toEqual({
      maxNumber: 10,
      operations: 'plus',
      answerInput: 'writing',
    });
  });

  it('při dalším spuštění se průvodce neotevře', () => {
    const storage = memoryStorage();
    const page = loadPage(storage);
    tapStartPlaying(page, walkToSummary(guideOf(page)), storage);

    expect(loadSettingsState(storage).firstLaunch).toBe(false);
    expect(loadPage(storage).guide).toBeNull();
  });

  it('dokud pojistka 500 ms běží, nic se neuloží', () => {
    const storage = memoryStorage();
    const summary = walkToSummary(guideOf(loadPage(storage)));
    expect(guideStep(summary)).toBe(SUMMARY_STEP);
    expect(finishGuide(summary, T0 + 1000 + START_LOCK_MS - 1)).toBeNull();
    expect(storage.data.size).toBe(0);
  });
});

describe('nastavení otevřené kolečkem je bez průvodce (#48 AC5, #49 AC6)', () => {
  it('po průvodci kolečko otevře nastavení z #47 s uloženými volbami', () => {
    const storage = memoryStorage();
    const page = loadPage(storage);
    const result = tapStartPlaying(page, walkToSummary(guideOf(page)), storage);

    expect(canOpenSettingsByHold(null)).toBe(true);
    const reopened = openSettings(CLOSED_SETTINGS, result.settings);
    expect(isSettingsOpen(reopened)).toBe(true);
    expect(selectedOptions(reopened)).toEqual(result.settings);
  });

  it('nastavení otevřené kolečkem má ✓ na místě z #47', () => {
    const { confirm } = layoutSettingsPanel(1024, 768);
    expect(confirm).toEqual({ x: 512, y: 669, size: 150 });
  });

  it('po průvodci se v témže načtení stránky průvodce neotevře ani po otevření kolečkem', () => {
    const storage = memoryStorage();
    const page = loadPage(storage);
    const result = tapStartPlaying(page, walkToSummary(guideOf(page)), storage);
    openSettings(CLOSED_SETTINGS, result.settings);
    expect(guideAtStart(result.launch)).toBeNull();
  });
});

describe('okrajové případy prvního spuštění (#48 AC6, #49 AC6)', () => {
  it('když se stránka zavře uprostřed průvodce, nic se neuloží a příště začne od kroku 1', () => {
    const storage = memoryStorage();
    let guide = chooseOption(guideOf(loadPage(storage)), { maxNumber: 20 });
    guide = chooseOption(next(guide, T0 + 1000), { operations: 'minus' });
    expect(guideStep(guide)).toBe(2);
    // Stránka se zavře nebo obnoví, „Začít hrát“ nepřišlo.

    expect(storage.data.size).toBe(0);
    const again = guideOf(loadPage(storage));
    expect(guideStep(again)).toBe(1);
    expect(guideSelection(again)).toEqual(FIRST_LAUNCH_CHOICE);
  });

  it('když se stránka zavře na shrnutí před „Začít hrát“, příště začne průvodce znovu', () => {
    const storage = memoryStorage();
    walkToSummary(guideOf(loadPage(storage)), { maxNumber: 5 });
    expect(guideStep(guideOf(loadPage(storage)))).toBe(1);
  });

  it('když nastavení nejde uložit, průvodce se otevře při každém načtení stránky', () => {
    for (const storage of [brokenStorage(), readOnlyStorage(), undefined]) {
      const page = loadPage(storage);
      const result = tapStartPlaying(page, walkToSummary(guideOf(page)), storage);
      expect(result.saved).toBe(false);

      for (let reload = 0; reload < 3; reload += 1) {
        expect(guideStep(guideOf(loadPage(storage)))).toBe(1);
      }
    }
  });

  it('když nastavení nejde uložit, po „Začít hrát“ se průvodce v témže načtení neotevře', () => {
    const storage = brokenStorage();
    const page = loadPage(storage);
    const result = tapStartPlaying(page, walkToSummary(guideOf(page)), storage);

    // Otočení zařízení nebo změna velikosti okna scénu postaví znovu.
    for (let rebuild = 0; rebuild < 3; rebuild += 1) {
      expect(guideAtStart(result.launch)).toBeNull();
    }
  });

  it('když nastavení nejde uložit, hra po „Začít hrát“ běží s vybranými volbami bez chyby', () => {
    const storage = brokenStorage();
    const page = loadPage(storage);
    const summary = walkToSummary(guideOf(page), { maxNumber: 5, operations: 'plus' });

    expect(() => tapStartPlaying(page, summary, storage)).not.toThrow();
    const result = tapStartPlaying(page, summary, storage);
    expect(result.settings).toEqual({ maxNumber: 5, operations: 'plus', answerInput: 'keypad' });
  });

  it('opakované dokončení v témže načtení stránky průvodce nevrátí', () => {
    let launch = createLaunchState(true);
    launch = launchAfterGuide(launch);
    launch = launchAfterGuide(launch);
    expect(guideAtStart(launch)).toBeNull();
  });

  it('bez prvního spuštění se průvodce neotevře v žádném načtení', () => {
    const launch = createLaunchState(false);
    expect(guideAtStart(launch)).toBeNull();
    expect(guideAtStart(launchAfterGuide(launch))).toBeNull();
  });

  it('hvězdičky uložené z dřívějška po průvodci zůstanou', () => {
    const storage = memoryStorage();
    saveProgress(storage, PROGRESS_MID_SET);

    const page = loadPage(storage);
    expect(page.guide).not.toBeNull();
    tapStartPlaying(page, walkToSummary(guideOf(page)), storage);
    expect(loadProgress(storage)).toEqual(PROGRESS_MID_SET);
  });

  it('průvodce nepřidá hvězdičku, takže nespustí oslavu', () => {
    const storage = memoryStorage();
    saveProgress(storage, PROGRESS_ALMOST_FULL);

    const page = loadPage(storage);
    tapStartPlaying(page, walkToSummary(guideOf(page)), storage);
    expect(loadProgress(storage)).toEqual(PROGRESS_ALMOST_FULL);
  });

  it('nečitelné uložené nastavení nesmaže uložené hvězdičky', () => {
    const storage = memoryStorage('nesmysl');
    saveProgress(storage, PROGRESS_MID_SET);
    loadPage(storage);
    expect(loadProgress(storage)).toEqual(PROGRESS_MID_SET);
  });
});
