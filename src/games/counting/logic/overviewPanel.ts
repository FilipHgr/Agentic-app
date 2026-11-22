/**
 * Co rodič v panelu za kolečkem vidí (#183 AC3): nastavení, nebo přehled
 * vyřešených příkladů. Přehled se otevře tlačítkem Přehled a Zpět vrátí
 * nastavení s rozehranými volbami; hra pod panelem mezitím stojí. Čistý
 * TypeScript.
 */

import type { SettingsSession } from './settingsSession';

export type ParentPanelView = 'settings' | 'overview';

export interface ParentPanelState {
  readonly session: SettingsSession;
  readonly view: ParentPanelView;
}

/** Podržení kolečka otevře vždy nastavení. */
export function openParentPanel(session: SettingsSession): ParentPanelState {
  return { session, view: 'settings' };
}

/** Ťuknutí na Přehled; bez otevřeného nastavení nic nezmění. */
export function showOverview(state: ParentPanelState): ParentPanelState {
  return state.session.open ? { ...state, view: 'overview' } : state;
}

/** Ťuknutí na Zpět v přehledu: nastavení se stejnými volbami jako předtím. */
export function backToSettings(state: ParentPanelState): ParentPanelState {
  return { ...state, view: 'settings' };
}

/** ✓ je jen v nastavení, z přehledu se nastavení nepotvrdí. */
export function canConfirmSettings(state: ParentPanelState): boolean {
  return state.session.open && state.view === 'settings';
}
