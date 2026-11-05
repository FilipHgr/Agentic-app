import { describe, expect, it } from 'vitest';

import type { GameProgress } from '../src/logic/progress';
import { DEFAULT_SETTINGS } from '../src/logic/settings';
import type { GameSettings } from '../src/logic/settings';
import { layoutSettingsPanel } from '../src/logic/settingsLayout';
import {
  CLOSED_SETTINGS,
  chooseOption,
  confirmSettings,
  isSettingsOpen,
  openSettings,
  pageAppearance,
  selectedOptions,
} from '../src/logic/settingsSession';
import type { SettingsSession } from '../src/logic/settingsSession';
import { STARS_PER_SET } from '../src/logic/stars';

/**
 * Testy k #45 (úprava nastavení pro rodiče): hra ví, kdy je nastavení
 * otevřené (AC6), podržení kolečka při otevřeném nastavení nic nezmění
 * (AC7), otevření během oslavy po 10. hvězdičce (AC8) a opakované otevření
 * a zavření (AC9). Otočení zařízení se kontroluje ručně na iPadu, iPhonu
 * a Samsungu.
 */

/** Stránka je světlá jako hra, i při otevřeném nastavení (#52 AC1, #53 AC1). */
const LIGHT_PAGE = '#F5F5F7';
const DIMMED_GEAR = 0.3;
const FADE_MS = 150;

const SAVED: GameSettings = { maxNumber: 20, operations: 'mixed', answerInput: 'writing' };

const PROGRESS_MID_SET: GameProgress = { earned: 4 };
const PROGRESS_CELEBRATING: GameProgress = { earned: STARS_PER_SET };

describe('hra ví, kdy je nastavení otevřené (#45 AC6)', () => {
  it('na začátku hry je nastavení zavřené', () => {
    expect(isSettingsOpen(CLOSED_SETTINGS)).toBe(false);
  });

  it('po podržení kolečka je nastavení otevřené', () => {
    expect(isSettingsOpen(openSettings(CLOSED_SETTINGS, SAVED))).toBe(true);
  });

  it('po ťuknutí na ✓ je nastavení zase zavřené', () => {
    const open = openSettings(CLOSED_SETTINGS, SAVED);
    const { session } = confirmSettings(open, SAVED, PROGRESS_MID_SET);
    expect(isSettingsOpen(session)).toBe(false);
  });

  it('při otevřeném nastavení zůstane stránka světlá a kolečko se ztlumí na 0,3', () => {
    const appearance = pageAppearance(openSettings(CLOSED_SETTINGS, SAVED));
    expect(appearance.background).toBe(LIGHT_PAGE);
    expect(appearance.gearOpacity).toBe(DIMMED_GEAR);
  });

  it('při zavřeném nastavení je stránka světlá a kolečko plně vidět', () => {
    const appearance = pageAppearance(CLOSED_SETTINGS);
    expect(appearance.background).toBe(LIGHT_PAGE);
    expect(appearance.gearOpacity).toBe(1);
  });

  it('kolečko se ztlumí i rozsvítí postupně za 150 ms jako panel', () => {
    const open = openSettings(CLOSED_SETTINGS, SAVED);
    expect(pageAppearance(open).transitionMs).toBe(FADE_MS);
    expect(pageAppearance(CLOSED_SETTINGS).transitionMs).toBe(FADE_MS);
  });

  it('po ✓ se uloží volby rodiče a přijde nový příklad podle nich', () => {
    let session = openSettings(CLOSED_SETTINGS, DEFAULT_SETTINGS);
    session = chooseOption(session, { maxNumber: 5 });
    session = chooseOption(session, { operations: 'minus' });
    const result = confirmSettings(session, DEFAULT_SETTINGS, PROGRESS_MID_SET);
    expect(result.settings).toEqual({ ...DEFAULT_SETTINGS, maxNumber: 5, operations: 'minus' });
    expect(result.startNewProblem).toBe(true);
  });

  it('během hry mimo oslavu zůstanou po ✓ hvězdičky', () => {
    const open = openSettings(CLOSED_SETTINGS, SAVED);
    const result = confirmSettings(open, SAVED, PROGRESS_MID_SET);
    expect(result.progress).toEqual(PROGRESS_MID_SET);
  });
});

describe('podržení kolečka při otevřeném nastavení nic neudělá (#45 AC7)', () => {
  it('druhé podržení kolečka nastavení nechá otevřené', () => {
    const open = openSettings(CLOSED_SETTINGS, SAVED);
    expect(isSettingsOpen(openSettings(open, SAVED))).toBe(true);
  });

  it('druhé podržení kolečka nezmění volby, které rodič právě vybral', () => {
    let session = openSettings(CLOSED_SETTINGS, SAVED);
    session = chooseOption(session, { maxNumber: 5, answerInput: 'keypad' });
    const before = selectedOptions(session);

    const afterSecondHold = openSettings(session, SAVED);
    expect(selectedOptions(afterSecondHold)).toEqual(before);
    expect(selectedOptions(afterSecondHold)).toEqual({
      maxNumber: 5,
      operations: 'mixed',
      answerInput: 'keypad',
    });
  });
});

describe('nastavení během oslavy po 10. hvězdičce (#45 AC8)', () => {
  it('nastavení jde otevřít i během oslavy', () => {
    expect(isSettingsOpen(openSettings(CLOSED_SETTINGS, SAVED))).toBe(true);
  });

  it('po ✓ se oslava přeruší: řada hvězdiček je zase prázdná', () => {
    const open = openSettings(CLOSED_SETTINGS, SAVED);
    const result = confirmSettings(open, SAVED, PROGRESS_CELEBRATING);
    expect(result.progress.earned).toBe(0);
  });

  it('po ✓ přijde prázdná řada hvězdiček stejně jako po dokončené oslavě, nic jiného se nevystřídá (#63 AC5)', () => {
    const open = openSettings(CLOSED_SETTINGS, SAVED);
    const result = confirmSettings(open, SAVED, PROGRESS_CELEBRATING);
    expect(result.progress).toEqual({ earned: 0 });
  });

  it('po ✓ během oslavy začne nový příklad a stránka je zase světlá', () => {
    const open = openSettings(CLOSED_SETTINGS, SAVED);
    const result = confirmSettings(open, SAVED, PROGRESS_CELEBRATING);
    expect(result.startNewProblem).toBe(true);
    expect(pageAppearance(result.session)).toEqual(pageAppearance(CLOSED_SETTINGS));
  });

  it('po ✓ při rozepsaném tahu začne nový příklad (tah se zahodí)', () => {
    // Rozepsaný tah patří ke starému příkladu; nový příklad ho zahodí (#41 AC1).
    const writing: GameSettings = { ...DEFAULT_SETTINGS, answerInput: 'writing' };
    const open = openSettings(CLOSED_SETTINGS, writing);
    const result = confirmSettings(open, writing, PROGRESS_MID_SET);
    expect(result.startNewProblem).toBe(true);
    expect(result.settings).toEqual(writing);
  });
});

describe('opakované otevření a zavření nastavení (#45 AC9)', () => {
  const REPEATS = 5;

  it('po pětinásobném otevření a zavření je stav vždy stejný', () => {
    let session: SettingsSession = CLOSED_SETTINGS;
    let settings = SAVED;
    let progress = PROGRESS_MID_SET;

    for (let round = 0; round < REPEATS; round += 1) {
      session = openSettings(session, settings);
      expect(isSettingsOpen(session)).toBe(true);
      expect(pageAppearance(session)).toEqual({
        background: LIGHT_PAGE,
        gearOpacity: DIMMED_GEAR,
        transitionMs: FADE_MS,
      });

      const result = confirmSettings(session, settings, progress);
      session = result.session;
      settings = result.settings;
      progress = result.progress;

      expect(isSettingsOpen(session)).toBe(false);
      expect(pageAppearance(session)).toEqual({
        background: LIGHT_PAGE,
        gearOpacity: 1,
        transitionMs: FADE_MS,
      });
    }

    expect(settings).toEqual(SAVED);
    expect(progress).toEqual(PROGRESS_MID_SET);
  });

  it('po každém otevření jsou vybrané volby podle uloženého nastavení', () => {
    let session: SettingsSession = CLOSED_SETTINGS;
    let saved: GameSettings = DEFAULT_SETTINGS;
    const choices: Partial<GameSettings>[] = [
      { maxNumber: 5 },
      { operations: 'minus' },
      { answerInput: 'writing' },
      { maxNumber: 20, operations: 'mixed' },
      { answerInput: 'keypad' },
    ];

    for (const change of choices) {
      session = openSettings(session, saved);
      expect(selectedOptions(session)).toEqual({
        maxNumber: saved.maxNumber,
        operations: saved.operations,
        answerInput: saved.answerInput ?? 'keypad',
      });

      session = chooseOption(session, change);
      const result = confirmSettings(session, saved, PROGRESS_MID_SET);
      session = result.session;
      saved = result.settings;
    }

    expect(saved).toEqual({ maxNumber: 20, operations: 'mixed', answerInput: 'keypad' });
  });

  it('starší uložené nastavení bez způsobu odpovědi otevře s vybraným číselníkem', () => {
    const session = openSettings(CLOSED_SETTINGS, DEFAULT_SETTINGS);
    expect(selectedOptions(session)?.answerInput).toBe('keypad');
  });

  it('rozložení nastavení je po opakovaném otevření pořád stejné', () => {
    const first = layoutSettingsPanel(1024, 768);
    for (let round = 0; round < REPEATS; round += 1) {
      expect(layoutSettingsPanel(1024, 768)).toEqual(first);
    }
  });

  it('ťuknutí na volbu při zavřeném nastavení nic nezmění', () => {
    const session = chooseOption(CLOSED_SETTINGS, { maxNumber: 5 });
    expect(isSettingsOpen(session)).toBe(false);
    expect(selectedOptions(session)).toBeNull();
  });
});
