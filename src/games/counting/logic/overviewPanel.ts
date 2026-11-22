/**
 * Co rodič v panelu za kolečkem vidí (#183 AC3): nastavení, přehled
 * vyřešených příkladů, nebo z přehledu stránku Chyby (#184). Přehled se
 * otevře tlačítkem Přehled a Zpět vrátí nastavení s rozehranými volbami;
 * Chyby se otevřou tlačítkem v přehledu a Zpět vrátí přehled. Hra pod
 * panelem mezitím stojí. Čistý TypeScript.
 */

import type { SettingsSession } from './settingsSession';

export type ParentPanelView = 'settings' | 'overview' | 'mistakes';

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

/** Ťuknutí na Chyby v přehledu (#184); odjinud nic nezmění. */
export function showMistakes(state: ParentPanelState): ParentPanelState {
  return state.view === 'overview' ? { ...state, view: 'mistakes' } : state;
}

/** Ťuknutí na Zpět na stránce Chyby: zase přehled. */
export function backToOverview(state: ParentPanelState): ParentPanelState {
  return state.view === 'mistakes' ? { ...state, view: 'overview' } : state;
}
