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
 * - Úprava profilu (#73): podržení kolečka profilu 1 s otevře stejný
 *   formulář předvyplněný přezdívkou a barvou, ťuknutí profil dál jen
 *   vybere. ✓ úpravu uloží a vrátí výběr; profil se tím nevybere.
 * - Smazání (#73): koš je jen ve 2. kroku úpravy a jen při dvou a více
 *   profilech. Koš otevře potvrzení, „Zpět“ vrátí rozepsanou úpravu,
 *   „Smazat“ profil smaže. Při dvou a více zbývajících profilech se ukáže
 *   výběr, jinak se obrazovky zavřou a stránka ukáže menu.
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

/** Jak dlouho rodič drží kolečko profilu, aby otevřel úpravu (#73, 1 s). */
export const EDIT_PROFILE_HOLD_MS = HOLD_TO_OPEN_SETTINGS_MS;

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

/**
 * Která obrazovka je vidět: `closed` je menu nebo hra, `confirmDelete`
 * potvrzení smazání nad 2. krokem úpravy.
 */
export type ProfileScreen = 'closed' | 'picker' | 'nickname' | 'color' | 'confirmDelete';

/** Formulář zakládá nový profil, nebo upravuje existující (#73). */
export type ProfileFormMode = 'new' | 'edit';

/** Ťuknutí, které se povedlo a dostane zmáčknutí. */
export type ProfileTapTarget =
  | 'profile'
  | 'switch'
  | 'backspace'
  | 'back'
  | 'next'
  | 'color'
  | 'save'
  | 'delete'
  | 'cancelDelete'
  | 'confirmDelete';

/**
 * Odezva obrazovek profilů:
 * - `press` písmeno se přidalo (zmáčknutí klávesy a tichý zvuk),
 * - `tap` ťuknutí na tlačítko se povedlo (zmáčknutí a zvuk),
 * - `wobble` „+“ po ťuknutí, ⌫ na prázdném poli nebo koš po smazání,
 *   které se nepovedlo, se jen zhoupne,
 * - `addHolding` kroužek kolem „+“ se začal plnit nebo zmizel,
 * - `profileHolding` kroužek kolem kolečka profilu `id` se začal plnit
 *   nebo zmizel (#73),
 * - `shake` pole s přezdívkou se jemně zatřese (plné, prázdné, stejná přezdívka).
 */
export type ProfileFeedback =
  | { readonly kind: 'press'; readonly key: string }
  | { readonly kind: 'tap'; readonly target: ProfileTapTarget }
  | { readonly kind: 'wobble'; readonly target: 'add' | 'backspace' | 'delete' }
  | { readonly kind: 'addHolding'; readonly holding: boolean }
  | { readonly kind: 'profileHolding'; readonly id: string; readonly holding: boolean }
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
  /** Kolečko profilu `id`: ťuknutí vybere, podržení 1 s otevře úpravu (#73). */
  profileButton(id: string): HoldButton;
  /** „+“: ťuknutí zhoupne, podržení 1 s otevře formulář. */
  readonly addButton: HoldButton;

  /** Nový profil, nebo úprava; mimo formulář `null`. */
  formMode(): ProfileFormMode | null;

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

  // Smazání (#73)
  /** Je ve 2. kroku úpravy vidět koš (aspoň dva profily)? */
  canDeleteProfile(): boolean;
  /** Koš: otevře potvrzení smazání. */
  tapDelete(): void;
  /** Kolečko profilu v potvrzení; mimo potvrzení `null`. */
  deleteConfirmProfile(): ProfilePickerItem | null;
  /** „Zpět“ v potvrzení: vrátí 2. krok s rozepsanou úpravou. */
  tapCancelDelete(): void;
  /** „Smazat“ v potvrzení. */
  tapConfirmDelete(): void;
}

/** Rozepsaný nový nebo upravovaný profil. */
interface Draft {
  letters: string[];
  layer: LetterLayer;
  /** Zvolená barva; `null`, dokud rodič nepřišel do 2. kroku. */
  color: ProfileColor | null;
  /** Upravovaný profil (#73); `null` u nového profilu. */
  readonly editing: Profile | null;
}

function emptyDraft(): Draft {
  return { letters: [], layer: 'base', color: null, editing: null };
}

/** Úprava začíná přezdívkou a barvou profilu. */
function editDraft(profile: Profile): Draft {
  return {
    letters: [...(profile.nickname ?? '')],
    layer: 'base',
    color: profile.color,
    editing: profile,
  };
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

  /** Má jiný profil stejnou přezdívku? Vlastní dosavadní přezdívka se nepočítá. */
  function isTaken(nickname: string): boolean {
    return store
      .profiles()
      .some((profile) => profile.id !== draft.editing?.id && profile.nickname === nickname);
  }

  function canGoNext(): boolean {
    const nickname = nicknameText();
    // Profil bez přezdívky (z přenosu dat) smí bez přezdívky i zůstat.
    const staysWithoutNickname =
      draft.editing !== null && draft.editing.nickname === undefined && nickname === '';
    return staysWithoutNickname || (isNickname(nickname) && !isTaken(nickname));
  }

  function findProfile(id: string): Profile | undefined {
    return store.profiles().find((profile) => profile.id === id);
  }

  /** Upravovaný profil, jak je teď uložený (`undefined` mimo úpravu). */
  function editedProfile(): Profile | undefined {
    return draft.editing === null ? undefined : findProfile(draft.editing.id);
  }

  function formMode(): ProfileFormMode | null {
    if (screen === 'closed' || screen === 'picker') {
      return null;
    }
    return draft.editing === null ? 'new' : 'edit';
  }

  function canDeleteProfile(): boolean {
    return screen === 'color' && editedProfile() !== undefined && store.profiles().length >= 2;
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

  function openEdit(id: string): void {
    const profile = findProfile(id);
    if (screen !== 'picker' || profile === undefined) {
      return;
    }
    draft = editDraft(profile);
    screen = 'nickname';
  }

  function tapProfile(id: string): void {
    if (screen !== 'picker' || findProfile(id) === undefined) {
      return;
    }
    store.selectProfile(id);
    screen = 'closed';
    emit({ kind: 'tap', target: 'profile' });
    options.onProfileChosen();
  }

  /** Tlačítka koleček profilů podle označení; vzniknou při prvním dotazu. */
  const profileButtons = new Map<string, HoldButton>();

  function profileButton(id: string): HoldButton {
    const existing = profileButtons.get(id);
    if (existing !== undefined) {
      return existing;
    }
    const button = createHoldButton({
      holdMs: EDIT_PROFILE_HOLD_MS,
      isEnabled: () => screen === 'picker' && findProfile(id) !== undefined,
      onHoldComplete: () => openEdit(id),
      onTap: () => tapProfile(id),
      onHoldingChange: (holding) => emit({ kind: 'profileHolding', id, holding }),
    });
    profileButtons.set(id, button);
    return button;
  }

  /** Uloží formulář: nový profil, nebo úpravu. */
  function saveDraft(): void {
    const nickname = nicknameText();
    const profile = { nickname: nickname === '' ? undefined : nickname, color: selectedColor() };
    if (draft.editing === null) {
      store.createProfile(profile);
    } else {
      store.updateProfile(draft.editing.id, profile);
    }
  }

  /** Po smazání: výběr při dvou a více profilech, jinak menu. */
  function closeAfterDelete(deletedId: string): void {
    // Tlačítko smazaného profilu už nikdo nepoužije.
    profileButtons.get(deletedId)?.dispose();
    profileButtons.delete(deletedId);
    draft = emptyDraft();
    if (store.profiles().length >= 2) {
      screen = 'picker';
      return;
    }
    screen = 'closed';
    options.onProfileChosen();
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

    tapProfile,
    profileButton,
    addButton,
    formMode,

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
    // Profil bez přezdívky má v náhledu ★ jako na výběru.
    previewSymbol: () => draft.letters[0] ?? PROFILE_WITHOUT_NICKNAME_SYMBOL,

    tapColor(color: ProfileColor): void {
      if (screen !== 'color' || !PROFILE_COLORS.includes(color)) {
        return;
      }
      draft.color = color;
      emit({ kind: 'tap', target: 'color' });
    },

    tapSave(): void {
      const isNew = draft.editing === null;
      if (screen !== 'color' || !canGoNext() || (isNew && !canAddProfile())) {
        return;
      }
      saveDraft();
      draft = emptyDraft();
      screen = 'picker';
      emit({ kind: 'tap', target: 'save' });
    },

    canDeleteProfile,

    tapDelete(): void {
      if (!canDeleteProfile()) {
        return;
      }
      screen = 'confirmDelete';
      emit({ kind: 'tap', target: 'delete' });
    },

    deleteConfirmProfile(): ProfilePickerItem | null {
      const profile = editedProfile();
      return screen === 'confirmDelete' && profile !== undefined ? pickerItemOf(profile) : null;
    },

    tapCancelDelete(): void {
      if (screen !== 'confirmDelete') {
        return;
      }
      screen = 'color';
      emit({ kind: 'tap', target: 'cancelDelete' });
    },

    tapConfirmDelete(): void {
      const profile = editedProfile();
      if (screen !== 'confirmDelete' || profile === undefined) {
        return;
      }
      if (!store.deleteProfile(profile.id)) {
        // Smazání se nepovedlo (úložiště): úprava zůstane, koš se jen zhoupne.
        screen = 'color';
        emit({ kind: 'wobble', target: 'delete' });
        return;
      }
      emit({ kind: 'tap', target: 'confirmDelete' });
      closeAfterDelete(profile.id);
    },
  };
}
