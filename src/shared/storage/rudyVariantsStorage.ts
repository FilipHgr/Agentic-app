/**
 * Poslední varianta repliky Rudyho (#176) v úložišti profilu. Stránka dá
 * úložiště hry aktivního profilu (`profiles.gameStorage(…)`), takže záznam
 * leží pod vnitřním označením profilu, nikdy s přezdívkou, a smazáním
 * profilu zmizí. Každá chvíle (pozdrav, oslava…) má vlastní klíč.
 *
 * Záznam je jen označení varianty, která naposledy zazněla. Čte se znovu
 * při každém výběru, takže dva panely se stejným profilem se střídají
 * spolu. Nečitelné úložiště je jako bez záznamu. Zapisuje se obyčejným
 * `setItem`: úložiště profilu nepovedený zápis (zakázané nebo plné
 * úložiště) samo podrží v paměti do zavření stránky, pro profil a hru
 * (i po dalším otevření hry). Úložiště, které zápis odmítne výjimkou,
 * podrží tahle instance v paměti. Nikdy nevyhodí výjimku.
 */

import { nextRudyVariant } from '../logic/rudyVariants';
import type { RudyVariantList } from '../logic/rudyVariants';
import type { KeyValueStorage } from './keyValueStorage';

export interface RudyVariants<L extends string> {
  /** Varianta, která zazní příště; nic nemění (i pro stažení dopředu). */
  upcoming(): L;
  /** Varianta `line` opravdu zazněla (okno se ukázalo): zapamatuje se. */
  said(line: L): void;
}

/** Střídání variant jedné chvíle pod klíčem `key` v úložišti profilu. */
export function openRudyVariants<L extends string>(
  storage: KeyValueStorage | undefined,
  key: string,
  variants: RudyVariantList<L>,
): RudyVariants<L> {
  let unsaved: L | null = null;

  function lastSaid(): string | null {
    if (unsaved !== null) {
      return unsaved;
    }
    if (storage === undefined) {
      return null;
    }
    try {
      return storage.getItem(key);
    } catch {
      // Zakázané úložiště (soukromý režim): jako bez záznamu, první varianta.
      return null;
    }
  }

  return {
    upcoming: () => nextRudyVariant(variants, lastSaid()),
    said(line) {
      unsaved = line;
      if (storage === undefined) {
        return;
      }
      try {
        storage.setItem(key, line);
        unsaved = null;
      } catch {
        // Plné nebo zakázané úložiště: varianta platí v paměti této instance.
      }
    },
  };
}
