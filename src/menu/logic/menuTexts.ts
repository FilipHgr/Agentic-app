/**
 * Texty v menu podle klíče (#67): „Vše“ a kategorie z textů menu, názvy her
 * z jejich `meta.ts` (menu kvůli názvu hru nestahuje) a název stránky ze
 * sdílených textů. Neznámý klíč nic nenajde.
 */

import { GAME_METAS } from '../../gameList';
import { gameTitleKey } from '../../shared/logic/gameRegistry';
import type { Language } from '../../shared/texts/languages';
import { sharedTexts } from '../../shared/texts/sharedTexts';
import cs from '../texts/cs';
import type { MenuTexts } from '../texts/menuTextsTypes';
import { PAGE_TITLE_KEY } from './menuTextKeys';

const MENU_TEXTS: Record<Language, MenuTexts> = { cs };

/** Text podle klíče s tečkami (`categories.all.title`) v jednom jazyce. */
export function menuText(key: string, language: Language): string | undefined {
  if (key === PAGE_TITLE_KEY) {
    return sharedTexts(language).pageTitle;
  }
  const game = GAME_METAS.find((meta) => gameTitleKey(meta.id) === key);
  if (game !== undefined) {
    return game.titles[language];
  }
  return textAtPath(MENU_TEXTS[language], key);
}

function textAtPath(texts: MenuTexts, key: string): string | undefined {
  let current: unknown = texts;
  for (const part of key.split('.')) {
    if (
      typeof current !== 'object' ||
      current === null ||
      !Object.prototype.hasOwnProperty.call(current, part)
    ) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === 'string' ? current : undefined;
}
