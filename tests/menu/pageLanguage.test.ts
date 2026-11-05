import { describe, expect, it } from 'vitest';

import { showPageLanguage } from '../../src/menu/ui/pageLanguage';
import type { LanguagePage } from '../../src/menu/ui/pageLanguage';
import { currentLanguage } from '../../src/shared/texts/languages';
import { sharedTexts } from '../../src/shared/texts/sharedTexts';

/**
 * Testy k #70 AC3: jazyk stránky (atribut `lang`) odpovídá zvolenému
 * jazyku. Stránka je napodobená, testy běží bez prohlížeče.
 *
 * Navržené rozhraní (`src/menu/ui/pageLanguage.ts`):
 * `showPageLanguage(stránka, jazyk)` nastaví `lang` a popis kolečka pro
 * čtečku obrazovky v tom jazyce.
 */

function fakePage(): LanguagePage & { attributes: Map<string, string> } {
  const attributes = new Map<string, string>();
  return {
    attributes,
    documentElement: { lang: 'xx' },
    getElementById: (id: string) =>
      id === 'settings-button'
        ? { setAttribute: (name: string, value: string) => attributes.set(name, value) }
        : null,
  };
}

describe('#70 AC3: jazyk stránky odpovídá volbě', () => {
  it('stránka dostane atribut lang zvoleného jazyka', () => {
    const page = fakePage();
    showPageLanguage(page, 'cs');
    expect(page.documentElement.lang).toBe('cs');
  });

  it('kolečko nastavení má popis pro čtečku obrazovky ve zvoleném jazyce', () => {
    const page = fakePage();
    showPageLanguage(page, 'cs');
    expect(page.attributes.get('aria-label')).toBe(sharedTexts('cs').settingsButtonLabel);
  });

  it('stránka bez kolečka nastavení nespadne', () => {
    const page: LanguagePage = { documentElement: { lang: '' }, getElementById: () => null };
    expect(() => showPageLanguage(page, currentLanguage())).not.toThrow();
    expect(page.documentElement.lang).toBe('cs');
  });
});
