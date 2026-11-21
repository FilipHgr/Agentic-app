/**
 * Repliky pandy Rudyho v menu (#171): pozdravy. Text je v textech menu
 * (`rudyLines`), zazní jen nahrávka hlasem postavičky v jazyce zvoleném
 * v menu. Pozdravy se v profilu střídají (#176), takže Rudy nikdy
 * nepozdraví stejně dvakrát po sobě; poslední je v úložišti profilu
 * v oblasti `MENU_RUDY_AREA`.
 */

import type { KeyValueStorage } from '../../shared/storage/keyValueStorage';
import type { ProfileStore } from '../../shared/storage/profileStorage';
import { openRudyVariants } from '../../shared/storage/rudyVariantsStorage';
import type { RudyVariants } from '../../shared/storage/rudyVariantsStorage';
import { currentLanguage } from '../../shared/texts/languages';
import type { Language } from '../../shared/texts/languages';

/** Pozdravy v pořadí střídání; první je ten z #171. */
export const MENU_RUDY_LINES = ['greeting', 'greetingWhat'] as const;

export type MenuRudyLine = (typeof MENU_RUDY_LINES)[number];

/** Oblast úložiště profilu pro menu (jako označení hry, žádná hra se tak nejmenuje). */
export const MENU_RUDY_AREA = 'menu';

/** Klíč posledního pozdravu v oblasti `MENU_RUDY_AREA`. */
export const MENU_RUDY_GREETING_KEY = 'rudyLine.greeting';

/** Střídání pozdravů menu v úložišti profilu (bez úložiště jen v paměti). */
export function menuRudyGreetings(
  storage: KeyValueStorage | undefined,
): RudyVariants<MenuRudyLine> {
  return openRudyVariants(storage, MENU_RUDY_GREETING_KEY, MENU_RUDY_LINES);
}

export interface MenuGreetingLines {
  /** Nový pozdrav: replika, která zazní příště; nic neukládá. */
  next(): MenuRudyLine;
  /**
   * Zopakovaný tichý pozdrav (#173) a stažení jeho nahrávky dopředu: stejná
   * replika jako poslední vyžádaný pozdrav (bez něj ta, která přijde).
   */
  replay(): MenuRudyLine;
  /** Okno s pozdravem `line` se ukázalo: příště zazní další varianta. */
  said(line: MenuRudyLine): void;
}

/** Profily stránky, jak je menu potřebuje: aktivní profil a jeho úložiště. */
export type MenuGreetingProfiles = Pick<ProfileStore, 'activeProfile' | 'gameStorage'>;

/**
 * Repliky pozdravů menu pro jedno načtení stránky. Každý profil má po celé
 * načtení jedno střídání (záložní paměť při zakázaném nebo plném úložišti
 * tak vydrží do zavření stránky); po výběru jiného profilu platí jeho.
 */
export function menuGreetingLines(profiles: MenuGreetingProfiles): MenuGreetingLines {
  const byProfile = new Map<string, RudyVariants<MenuRudyLine>>();
  let lastRequested: MenuRudyLine | null = null;

  function greetingsOfActiveProfile(): RudyVariants<MenuRudyLine> {
    const profileId = profiles.activeProfile().id;
    let greetings = byProfile.get(profileId);
    if (greetings === undefined) {
      greetings = menuRudyGreetings(profiles.gameStorage(MENU_RUDY_AREA));
      byProfile.set(profileId, greetings);
    }
    return greetings;
  }

  return {
    next() {
      lastRequested = greetingsOfActiveProfile().upcoming();
      return lastRequested;
    },
    replay: () => lastRequested ?? greetingsOfActiveProfile().upcoming(),
    said: (line) => greetingsOfActiveProfile().said(line),
  };
}

/** Nahrávka repliky jako soubor stránky (`public/voice/<jazyk>/menu/rudy-<id>.mp3`). */
export function menuRudyVoiceUrl(
  line: MenuRudyLine,
  language: Language = currentLanguage(),
): string {
  return `voice/${language}/menu/rudy-${line}.mp3`;
}
