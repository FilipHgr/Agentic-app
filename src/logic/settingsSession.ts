/**
 * Stav nastavení pro rodiče (#45): jestli je otevřené, co rodič zrovna
 * vybral a jak má vypadat stránka kolem. Čistý TypeScript bez Phaseru i DOM.
 */

import { nextCharacter } from './characters';
import type { GameProgress } from './progress';
import { answerInputOf } from './settings';
import type { AnswerInput, GameSettings, MaxNumber, OperationMode } from './settings';
import { STARS_PER_SET } from './stars';

export type SettingsSession =
  { readonly open: false } | { readonly open: true; readonly choice: GameSettings };

export const CLOSED_SETTINGS: SettingsSession = { open: false };

export interface SelectedOptions {
  readonly maxNumber: MaxNumber;
  readonly operations: OperationMode;
  readonly answerInput: AnswerInput;
}

export interface ConfirmedSettings {
  readonly session: SettingsSession;
  readonly settings: GameSettings;
  readonly progress: GameProgress;
  readonly startNewProblem: boolean;
}

export interface PageAppearance {
  readonly background: string;
  readonly gearOpacity: number;
  readonly transitionMs: number;
}

/** Barvy stránky: tmavá při otevřeném nastavení, jinak běžná zelená hry. */
const OPEN_PAGE: PageAppearance = { background: '#0f3d24', gearOpacity: 0.3, transitionMs: 150 };
const CLOSED_PAGE: PageAppearance = { background: '#1f6f43', gearOpacity: 1, transitionMs: 150 };

export function isSettingsOpen(session: SettingsSession): boolean {
  return session.open;
}

/** Podržení kolečka: otevře nastavení s uloženými volbami. Už otevřené nemění. */
export function openSettings(session: SettingsSession, saved: GameSettings): SettingsSession {
  return session.open ? session : { open: true, choice: saved };
}

/** Ťuknutí na volbu. Při zavřeném nastavení nic nezmění. */
export function chooseOption(
  session: SettingsSession,
  change: Partial<GameSettings>,
): SettingsSession {
  return session.open ? { open: true, choice: { ...session.choice, ...change } } : session;
}

/** Které volby jsou teď vybrané (žluté); při zavřeném nastavení `null`. */
export function selectedOptions(session: SettingsSession): SelectedOptions | null {
  if (!session.open) {
    return null;
  }
  const { maxNumber, operations } = session.choice;
  return { maxNumber, operations, answerInput: answerInputOf(session.choice) };
}

/**
 * Ťuknutí na ✓: nastavení se zavře, volby platí a přijde nový příklad.
 * Když právě běžela oslava (plná řada hvězdiček), přeruší se: řada se
 * vyprázdní a postavička se vystřídá jako po dokončené oslavě.
 */
export function confirmSettings(
  session: SettingsSession,
  saved: GameSettings,
  progress: GameProgress,
): ConfirmedSettings {
  if (!session.open) {
    return { session, settings: saved, progress, startNewProblem: false };
  }
  const celebrating = progress.earned >= STARS_PER_SET;
  return {
    session: CLOSED_SETTINGS,
    settings: session.choice,
    progress: celebrating ? { earned: 0, character: nextCharacter(progress.character) } : progress,
    startNewProblem: true,
  };
}

/** Jak má vypadat stránka kolem herní plochy a kolečko. */
export function pageAppearance(session: SettingsSession): PageAppearance {
  return session.open ? OPEN_PAGE : CLOSED_PAGE;
}
