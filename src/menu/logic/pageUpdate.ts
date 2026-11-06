/**
 * Obnovení stránky po nasazení nové verze webu (#76). Čistý TypeScript bez
 * Phaseru a bez prohlížeče; dotaz na server a obnovení stránky dodá
 * stránka menu.
 *
 * V dlouho otevřeném menu se po nasazení hra nestáhne, protože starý soubor
 * hry na serveru už není. Když server přitom odpovídá, stránka se sama
 * jednou obnoví a další ťuknutí hru spustí z nové verze (AC1). Když server
 * neodpovídá, jde o výpadek sítě a dlaždice se jen zatřese (AC2).
 *
 * Značka obnovení v úložišti zařízení má tři stavy:
 * - volno (žádná značka nebo `idle`): automatické obnovení je možné,
 * - právě obnoveno (`reloaded` s id aktivního profilu): první start po
 *   obnovení přeskočí výběr profilu, když aktivní profil pořád je (AC1, AC5),
 * - použito (`used`): další obnovení až po prvním úspěšném spuštění
 *   kterékoli hry, bez časového limitu (AC3).
 * Bez úložiště, ve kterém jde značku zapsat a zpětně přečíst, se stránka
 * sama nikdy neobnoví (AC4). Mění se jen tato značka, jiné údaje ne (AC6).
 */

import type { Profile } from '../../shared/logic/profiles';
import type { KeyValueStorage } from '../../shared/storage/keyValueStorage';
import { startScreenFor } from './profileScreens';
import type { StartScreen } from './profileScreens';

/** Klíč značky obnovení; patří zařízení, ne profilu. */
export const PAGE_UPDATE_STORAGE_KEY = 'agentic-app.pageUpdate';

type Marker =
  | { readonly state: 'idle' }
  | { readonly state: 'reloaded'; readonly profileId: string }
  | { readonly state: 'used' };

const IDLE: Marker = { state: 'idle' };
const USED: Marker = { state: 'used' };

export interface PageUpdateOptions {
  /** Úložiště zařízení; `undefined`, když ho prohlížeč nedá. */
  readonly storage: KeyValueStorage | undefined;
  /** Odpovídá server stránky? Zamítnutý slib je „neodpovídá“. */
  readonly serverResponds: () => Promise<boolean>;
  /** Obnoví stránku. */
  readonly reloadPage: () => void;
  /** Id aktivního profilu, uloží se ke značce. */
  readonly activeProfileId: () => string;
}

export interface PageUpdate {
  /** Co stránka ukáže při startu; místo `startScreenFor`. */
  startScreen(profiles: readonly Profile[]): StartScreen;
  /**
   * Hra se nestáhla. Splní se `true`, když se stránka obnovuje (dlaždice
   * se nezatřese), jinak `false`. Nikdy se nezamítne. Když `stillWanted`
   * mezitím vrátí `false` (dítě ťuklo jinam, stahování vypršelo), stránka
   * se neobnoví.
   */
  downloadFailed(gameId: string, stillWanted?: () => boolean): Promise<boolean>;
  /** Hra se úspěšně spustila: automatické obnovení je zase možné. */
  gameStarted(): void;
}

/** Přečte značku; `undefined`, když z úložiště nejde číst. */
function readMarker(storage: KeyValueStorage | undefined): Marker | undefined {
  if (storage === undefined) {
    return undefined;
  }
  let raw: string | null;
  try {
    raw = storage.getItem(PAGE_UPDATE_STORAGE_KEY);
  } catch {
    // Úložiště zakázané: značku nejde přečíst, chová se jako bez úložiště.
    return undefined;
  }
  return parseMarker(raw);
}

/** Nečitelná značka se bere jako použitá, aby se stránka neobnovovala dokola. */
function parseMarker(raw: string | null): Marker {
  if (raw === null) {
    return IDLE;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Poškozený zápis: radši žádné další automatické obnovení.
    return USED;
  }
  if (typeof parsed !== 'object' || parsed === null) {
    return USED;
  }
  const record = parsed as Record<string, unknown>;
  if (record.state === 'idle') {
    return IDLE;
  }
  if (record.state === 'reloaded' && typeof record.profileId === 'string') {
    return { state: 'reloaded', profileId: record.profileId };
  }
  return USED;
}

/** Zapíše značku a ověří ji zpětným čtením; `true`, jen když opravdu platí. */
function writeMarker(storage: KeyValueStorage | undefined, marker: Marker): boolean {
  if (storage === undefined) {
    return false;
  }
  const raw = JSON.stringify(marker);
  try {
    storage.setItem(PAGE_UPDATE_STORAGE_KEY, raw);
    return storage.getItem(PAGE_UPDATE_STORAGE_KEY) === raw;
  } catch {
    // Plné nebo zakázané úložiště: značka neplatí, stránka se sama neobnoví.
    return false;
  }
}

async function askServer(serverResponds: () => Promise<boolean>): Promise<boolean> {
  try {
    return (await serverResponds()) === true;
  } catch {
    // Dotaz bez sítě selže: to je výpadek sítě, ne nová verze (AC2).
    return false;
  }
}

export function createPageUpdate(options: PageUpdateOptions): PageUpdate {
  const { storage } = options;

  /** Při startu po obnovení se značka změní na použitou; vrátí profil ze značky. */
  function takeReloadedProfile(): string | undefined {
    const marker = readMarker(storage);
    if (marker?.state !== 'reloaded') {
      return undefined;
    }
    // Jen ověřený zápis „použito“ dovolí přeskočit výběr, jinak by se
    // přeskakoval při každém startu (AC5).
    return writeMarker(storage, USED) ? marker.profileId : undefined;
  }

  return {
    startScreen(profiles: readonly Profile[]): StartScreen {
      const reloadedProfileId = takeReloadedProfile();
      const profileStillThere =
        reloadedProfileId !== undefined &&
        reloadedProfileId === options.activeProfileId() &&
        profiles.some((profile) => profile.id === reloadedProfileId);
      return profileStillThere ? 'menu' : startScreenFor(profiles);
    },

    async downloadFailed(_gameId: string, stillWanted = () => true): Promise<boolean> {
      if (readMarker(storage)?.state !== 'idle') {
        return false;
      }
      const responds = await askServer(options.serverResponds);
      if (!responds || !stillWanted() || readMarker(storage)?.state !== 'idle') {
        return false;
      }
      const reloaded: Marker = { state: 'reloaded', profileId: options.activeProfileId() };
      if (!writeMarker(storage, reloaded)) {
        return false;
      }
      options.reloadPage();
      return true;
    },

    gameStarted(): void {
      const marker = readMarker(storage);
      if (marker !== undefined && marker.state !== 'idle') {
        writeMarker(storage, IDLE);
      }
    },
  };
}
