/**
 * Výběr profilu (obrázek P) a formulář nového profilu (#72). Čistý
 * TypeScript bez Phaseru; scéna jen kreslí stav a předává ťuknutí.
 *
 * - Při startu stránky se výběr ukáže jen při dvou a více profilech
 *   (`startScreenFor`), z menu ho otevře ťuknutí na kolečko profilu vždy.
 * - Ťuknutí na kolečko profil vybere, výběr se zavře a stránka ukáže menu.
 * - „+“ (jen pod limitem `MAX_PROFILES`) ťuknutím jen zhoupne, podržením
 *   1 s otevře formulář. Formulář má dva kroky: přezdívku z mřížky písmen
 *   a barvu. ✓ profil uloží a vrátí výběr; nový profil se sám nevybere.
 * - Fyzická klávesnice (`keyDown`) má účinek jen v 1. kroku.
 *
 * Odezvu (zmáčknutí, zhoupnutí, zatřesení, plnění kroužku) obrazovky hlásí
 * přes `feedback`, scéna ji zahraje. Žádná výjimka z úložiště neunikne,
 * o to se stará úložiště profilů.
 */

import { createHoldButton } from '../../shared/logic/holdButton';
import type { HoldButton } from '../../shared/logic/holdButton';
import { HOLD_TO_OPEN_SETTINGS_MS } from '../../shared/logic/settingsGear';
import { PROFILE_COLORS, isNickname } from '../../shared/logic/profiles';
import type { Profile, ProfileColor } from '../../shared/logic/profiles';
import type { ProfileStore } from '../../shared/storage/profileStorage';
import { MAX_NICKNAME_LENGTH, letterFromKey, lettersOf } from './letterGrid';
import type { LetterLayer } from './letterGrid';
import { PROFILE_WITHOUT_NICKNAME_SYMBOL } from './menu';

/** Nejvíc profilů v zařízení; s nimi se „+“ neukáže. */
export const MAX_PROFILES = 6;

/** Jak dlouho rodič drží „+“ (stejně jako kolečko nastavení, 1 s). */
export const ADD_PROFILE_HOLD_MS = HOLD_TO_OPEN_SETTINGS_MS;

/** Klávesa fyzické klávesnice, která smaže poslední písmeno. */
const BACKSPACE_KEY = 'Backspace';

/** Co stránka ukáže při startu. */
export type StartScreen = 'menu' | 'profilePicker';

/** Výběr profilu při startu jen při dvou a více profilech. */
export function startScreenFor(profiles: readonly Profile[]): StartScreen {
  return profiles.length >= 2 ? 'profilePicker' : 'menu';
}

/** První barva palety, kterou žádný profil nemá; při obsazené paletě první barva. */
export function suggestedProfileColor(profiles: readonly Profile[]): ProfileColor {
  const free = PROFILE_COLORS.find((color) => !profiles.some((profile) => profile.color === color));
  return free ?? PROFILE_COLORS[0];
}

/** Která obrazovka je vidět: `closed` je menu nebo hra. */
export type ProfileScreen = 'closed' | 'picker' | 'nickname' | 'color';

/** Ťuknutí, které se povedlo a dostane zmáčknutí. */
export type ProfileTapTarget =
  'profile' | 'switch' | 'backspace' | 'back' | 'next' | 'color' | 'save';

/**
 * Odezva obrazovek profilů:
 * - `press` písmeno se přidalo (zmáčknutí klávesy a tichý zvuk),
 * - `tap` ťuknutí na tlačítko se povedlo (zmáčknutí a zvuk),
 * - `wobble` „+“ po ťuknutí nebo ⌫ na prázdném poli se jen zhoupne,
 * - `addHolding` kroužek kolem „+“ se začal plnit nebo zmizel,
 * - `shake` pole s přezdívkou se jemně zatřese (plné, prázdné, stejná přezdívka).
 */
export type ProfileFeedback =
  | { readonly kind: 'press'; readonly key: string }
  | { readonly kind: 'tap'; readonly target: ProfileTapTarget }
  | { readonly kind: 'wobble'; readonly target: 'add' | 'backspace' }
  | { readonly kind: 'addHolding'; readonly holding: boolean }
  | { readonly kind: 'shake'; readonly target: 'field' };

/** Kolečko na výběru profilu. */
export interface ProfilePickerItem {
  readonly id: string;
  readonly color: ProfileColor;
  /** První písmeno přezdívky, bez přezdívky ★. */
  readonly symbol: string;
  /** Přezdívka pod kolečkem, `null` bez přezdívky. */
  readonly nickname: string | null;
}

export interface PaletteSwatch {
  readonly color: ProfileColor;
  readonly selected: boolean;
}

export interface ProfileScreensOptions {
  readonly profiles: ProfileStore;
  readonly feedback: (event: ProfileFeedback) => void;
  /** Dítě vybralo profil: výběr je zavřený, stránka ukáže menu. */
  readonly onProfileChosen: () => void;
}

export interface ProfileScreens {
  screen(): ProfileScreen;
  /** Ukáže výběr profilu (při startu nebo po ťuknutí na profil v menu). */
  open(): void;

  // Výběr profilu
  /** Kolečka profilů v pořadí založení. */
  pickerItems(): ProfilePickerItem[];
  /** Je vidět „+“ (pod limitem profilů)? */
  canAddProfile(): boolean;
  tapProfile(id: string): void;
  /** „+“: ťuknutí zhoupne, podržení 1 s otevře formulář. */
  readonly addButton: HoldButton;

  // 1. krok: přezdívka
  nickname(): string;
  letterLayer(): LetterLayer;
  tapLetter(letter: string): void;
  tapLayerSwitch(): void;
  tapBackspace(): void;
  /** Klávesa fyzické klávesnice (`KeyboardEvent.key`); mimo 1. krok nic. */
  keyDown(key: string): void;
  /** Jde dál? Jinak je → ztlumené. */
  canGoNext(): boolean;
  tapNext(): void;
  /** Zpět: z 1. kroku zavře formulář bez uložení, z 2. kroku vrátí do 1. kroku. */
  tapBack(): void;

  // 2. krok: barva
  palette(): PaletteSwatch[];
  selectedColor(): ProfileColor;
  /** Písmeno v náhledu kolečka (první písmeno přezdívky). */
  previewSymbol(): string;
  tapColor(color: ProfileColor): void;
  tapSave(): void;
}

/** Rozepsaný nový profil. */
interface Draft {
  letters: string[];
  layer: LetterLayer;
  /** Zvolená barva; `null`, dokud rodič nepřišel do 2. kroku. */
  color: ProfileColor | null;
}

function emptyDraft(): Draft {
  return { letters: [], layer: 'base', color: null };
}

function pickerItemOf(profile: Profile): ProfilePickerItem {
  const nickname = profile.nickname ?? '';
  const firstLetter = [...nickname][0];
  return {
    id: profile.id,
    color: profile.color,
    symbol: firstLetter ?? PROFILE_WITHOUT_NICKNAME_SYMBOL,
    nickname: firstLetter === undefined ? null : nickname,
  };
}

export function createProfileScreens(options: ProfileScreensOptions): ProfileScreens {
  const store = options.profiles;
  let screen: ProfileScreen = 'closed';
  let draft = emptyDraft();

  function emit(event: ProfileFeedback): void {
    options.feedback(event);
  }

  function canAddProfile(): boolean {
    return store.profiles().length < MAX_PROFILES;
  }

  function nicknameText(): string {
    return draft.letters.join('');
  }

  function isTaken(nickname: string): boolean {
    return store.profiles().some((profile) => profile.nickname === nickname);
  }

  function canGoNext(): boolean {
    const nickname = nicknameText();
    return isNickname(nickname) && !isTaken(nickname);
  }

  function selectedColor(): ProfileColor {
    return draft.color ?? suggestedProfileColor(store.profiles());
  }

  function openForm(): void {
    if (screen !== 'picker' || !canAddProfile()) {
      return;
    }
    draft = emptyDraft();
    screen = 'nickname';
  }

  /** Přidá písmeno na konec pole; plné pole se jen zatřese. */
  function addLetter(letter: string): boolean {
    if (draft.letters.length >= MAX_NICKNAME_LENGTH) {
      emit({ kind: 'shake', target: 'field' });
      return false;
    }
    draft.letters.push(letter);
    emit({ kind: 'press', key: letter });
    return true;
  }

  function deleteLetter(): void {
    if (draft.letters.length === 0) {
      emit({ kind: 'wobble', target: 'backspace' });
      return;
    }
    draft.letters.pop();
    emit({ kind: 'tap', target: 'backspace' });
  }

  const addButton = createHoldButton({
    holdMs: ADD_PROFILE_HOLD_MS,
    isEnabled: () => screen === 'picker' && canAddProfile(),
    onHoldComplete: openForm,
    onTap: () => emit({ kind: 'wobble', target: 'add' }),
    onHoldingChange: (holding) => emit({ kind: 'addHolding', holding }),
  });

  return {
    screen: () => screen,

    open(): void {
      draft = emptyDraft();
      screen = 'picker';
    },

    pickerItems: () => store.profiles().map(pickerItemOf),
    canAddProfile,

    tapProfile(id: string): void {
      if (screen !== 'picker' || !store.profiles().some((profile) => profile.id === id)) {
        return;
      }
      store.selectProfile(id);
      screen = 'closed';
      emit({ kind: 'tap', target: 'profile' });
      options.onProfileChosen();
    },

    addButton,

    nickname: nicknameText,
    letterLayer: () => draft.layer,

    tapLetter(letter: string): void {
      if (screen !== 'nickname' || !lettersOf(draft.layer).includes(letter)) {
        return;
      }
      if (addLetter(letter)) {
        // Diakritika bývá v přezdívce jednou, další písmeno je skoro vždy ze základní vrstvy.
        draft.layer = 'base';
      }
    },

    tapLayerSwitch(): void {
      if (screen !== 'nickname') {
        return;
      }
      draft.layer = draft.layer === 'base' ? 'accents' : 'base';
      emit({ kind: 'tap', target: 'switch' });
    },

    tapBackspace(): void {
      if (screen === 'nickname') {
        deleteLetter();
      }
    },

    keyDown(key: string): void {
      if (screen !== 'nickname') {
        return;
      }
      if (key === BACKSPACE_KEY) {
        deleteLetter();
        return;
      }
      const letter = letterFromKey(key);
      if (letter !== null) {
        addLetter(letter);
      }
    },

    canGoNext,

    tapNext(): void {
      if (screen !== 'nickname') {
        return;
      }
      if (!canGoNext()) {
        emit({ kind: 'shake', target: 'field' });
        return;
      }
      draft.color = selectedColor();
      screen = 'color';
      emit({ kind: 'tap', target: 'next' });
    },

    tapBack(): void {
      if (screen === 'nickname') {
        draft = emptyDraft();
        screen = 'picker';
        emit({ kind: 'tap', target: 'back' });
      } else if (screen === 'color') {
        screen = 'nickname';
        emit({ kind: 'tap', target: 'back' });
      }
    },

    palette: () => PROFILE_COLORS.map((color) => ({ color, selected: color === selectedColor() })),
    selectedColor,
    previewSymbol: () => draft.letters[0] ?? '',

    tapColor(color: ProfileColor): void {
      if (screen !== 'color' || !PROFILE_COLORS.includes(color)) {
        return;
      }
      draft.color = color;
      emit({ kind: 'tap', target: 'color' });
    },

    tapSave(): void {
      if (screen !== 'color' || !canGoNext() || !canAddProfile()) {
        return;
      }
      store.createProfile({ nickname: nicknameText(), color: selectedColor() });
      draft = emptyDraft();
      screen = 'picker';
      emit({ kind: 'tap', target: 'save' });
    },
  };
}
