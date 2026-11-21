/**
 * Replika pandy Rudyho v menu (#171): pozdrav. Text je v textech menu
 * (`rudyLines`), zazní jen nahrávka hlasem postavičky v jazyce zvoleném
 * v menu.
 */

import { currentLanguage } from '../../shared/texts/languages';
import type { Language } from '../../shared/texts/languages';

export const MENU_RUDY_LINES = ['greeting'] as const;

export type MenuRudyLine = (typeof MENU_RUDY_LINES)[number];

/** Nahrávka repliky jako soubor stránky (`public/voice/<jazyk>/menu/rudy-<id>.mp3`). */
export function menuRudyVoiceUrl(
  line: MenuRudyLine,
  language: Language = currentLanguage(),
): string {
  return `voice/${language}/menu/rudy-${line}.mp3`;
}
