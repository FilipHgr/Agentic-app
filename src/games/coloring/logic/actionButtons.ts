/**
 * Vzhled tlačítek alba a malování v Omalovánkách (#153): každé má vlastní
 * ikonu z ElevenLabs a barva podkladu ukazuje, co tlačítko s obrázkem
 * udělá. Tlačítka, která obrázek uchovají (fotoaparát, album, malovat
 * dál), mají světle zelený podklad, tlačítka, která ho odstraní (koš,
 * koště), světle červený. Šipky alba a Zpět zůstávají modré. Čistý
 * TypeScript bez Phaseru.
 */

import {
  BOOK_ICON_FILE,
  BROOM_ICON_FILE,
  CAMERA_ICON_FILE,
  CONTINUE_ICON_FILE,
  TRASH_ICON_FILE,
} from './toolIcons';

export type ActionButtonId = 'camera' | 'album' | 'continue' | 'trash' | 'broom';

/** Všechna tlačítka alba a malování. */
export const ACTION_BUTTONS: readonly ActionButtonId[] = [
  'camera',
  'album',
  'continue',
  'trash',
  'broom',
];

/** Ikona tlačítka a barvy jeho podkladu a okraje (`#RRGGBB`). */
export interface ActionButtonLook {
  readonly iconFile: string;
  readonly background: string;
  readonly borderColor: string;
}

/** Podklad tlačítek, která obrázek uchovají. */
const KEEP_COLORS = { background: '#E2F6E5', borderColor: '#9FD8AB' } as const;

/** Podklad tlačítek, která obrázek odstraní. */
const REMOVE_COLORS = { background: '#FFE1DE', borderColor: '#F2A49A' } as const;

const LOOKS: Readonly<Record<ActionButtonId, ActionButtonLook>> = {
  camera: { iconFile: CAMERA_ICON_FILE, ...KEEP_COLORS },
  album: { iconFile: BOOK_ICON_FILE, ...KEEP_COLORS },
  continue: { iconFile: CONTINUE_ICON_FILE, ...KEEP_COLORS },
  trash: { iconFile: TRASH_ICON_FILE, ...REMOVE_COLORS },
  broom: { iconFile: BROOM_ICON_FILE, ...REMOVE_COLORS },
};

/** Vzhled tlačítka `id`: jeho ikona a barvy podkladu podle toho, co s obrázkem udělá. */
export function actionButtonLook(id: ActionButtonId): ActionButtonLook {
  return LOOKS[id];
}
