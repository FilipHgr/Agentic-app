/**
 * Vzhled výběru profilu v běžném režimu a v režimu úprav (#160, #197).
 * Čistý TypeScript bez Phaseru: scéna podle něj jen kreslí.
 *
 * V úpravách je jiné jemné modravé pozadí, každé kolečko má vpravo nahoře
 * odznak tužky a lehce se pohupuje, tužka v liště je zapnutá (plná modrá)
 * a „+“ je ztlumené (dál funguje, aby šlo i v úpravách přidat profil).
 */

import { PAGE_BACKGROUND } from '../../shared/logic/theme';
import { PROFILE_SCREEN_STYLE } from './menuTheme';

export interface ProfilePickerAppearance {
  /** Barva pozadí celé obrazovky výběru. */
  readonly background: string;
  /** Má každé kolečko odznak tužky? */
  readonly editBadges: boolean;
  /** Pohupují se kolečka (`PROFILE_EDIT_WOBBLE`)? */
  readonly wobble: boolean;
  /** Je tužka v liště zapnutá (plná modrá s bílou tužkou)? */
  readonly pencilSelected: boolean;
  /** Krytí „+“ (1 = plné). */
  readonly addAlpha: number;
}

/**
 * Jemné pohupování koleček v úpravách (#197): kolečko se otáčí kolem
 * svého středu o úhel na každou stranu, jeden kmit z jedné strany na
 * druhou trvá `swingMs`. Sousední kolečka se houpou proti sobě.
 */
export const PROFILE_EDIT_WOBBLE = { angleDegrees: 2.5, swingMs: 1100 } as const;

const NORMAL_APPEARANCE: ProfilePickerAppearance = {
  background: PAGE_BACKGROUND,
  editBadges: false,
  wobble: false,
  pencilSelected: false,
  addAlpha: 1,
};

const EDITING_APPEARANCE: ProfilePickerAppearance = {
  background: PROFILE_SCREEN_STYLE.editBackground,
  editBadges: true,
  wobble: true,
  pencilSelected: true,
  addAlpha: PROFILE_SCREEN_STYLE.addEditingAlpha,
};

export function profilePickerAppearance(editing: boolean): ProfilePickerAppearance {
  return editing ? EDITING_APPEARANCE : NORMAL_APPEARANCE;
}
