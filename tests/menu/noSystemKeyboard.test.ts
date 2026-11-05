/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';

import indexHtml from '../../index.html?raw';

/**
 * Testy k #72 AC5: systémová klávesnice se nikdy neukáže, ani při psaní
 * přezdívky. Test projde zdrojové texty `src/` a `index.html` (bez
 * komentářů) a hledá cokoli, co by klávesnici v Safari nebo Chromu mohlo
 * vyvolat: textové pole, upravitelný prvek, `inputmode`, zaměření prvku
 * nebo prvky DOM v Phaseru. Fyzická klávesnice má účinek jen v 1. kroku
 * formuláře (logika v `letterGrid.test.ts`); hry klávesnici neposlouchají
 * vůbec.
 *
 * Že se klávesnice opravdu neukáže, se ověří ručně na iPadu, iPhonu
 * a Samsungu, na šířku i na výšku.
 */

const SOURCES: Record<string, string> = Object.fromEntries(
  Object.entries(
    import.meta.glob<string>('../../src/**/*.ts', {
      query: '?raw',
      import: 'default',
      eager: true,
    }),
  ).map(([path, text]) => [path.replace('../../', ''), text]),
);

function withoutComments(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/<!--[\s\S]*?-->/g, '');
}

/** Co by mohlo ukázat systémovou klávesnici. */
const KEYBOARD_TRIGGERS: ReadonlyArray<{ readonly name: string; readonly pattern: RegExp }> = [
  { name: 'textové pole <input> nebo <textarea>', pattern: /<\s*(?:input|textarea|select)\b/i },
  {
    name: 'vytvoření textového pole',
    pattern: /createElement\s*\(\s*['"`](?:input|textarea|select)['"`]/i,
  },
  { name: 'upravitelný prvek', pattern: /contenteditable|contentEditable|isContentEditable\s*=/ },
  { name: 'inputmode', pattern: /inputmode|inputMode/ },
  { name: 'zaměření prvku', pattern: /\.focus\s*\(/ },
  { name: 'prvky DOM v Phaseru', pattern: /\.add\.dom\s*\(|createFromHTML|createContainer\s*:/ },
];

/** Poslouchání klávesnice. */
const KEYBOARD_LISTENERS =
  /['"`]key(?:down|up|press)['"`]|\.keyboard\b|addKey\s*\(|onkey(?:down|up|press)/;

describe('#72 AC5: v menu, výběru profilu ani formuláři není nic, co by vyvolalo systémovou klávesnici', () => {
  for (const { name, pattern } of KEYBOARD_TRIGGERS) {
    it(`v kódu src/ ani v index.html není ${name}`, () => {
      const found = [
        ...Object.entries(SOURCES)
          .filter(([, text]) => pattern.test(withoutComments(text)))
          .map(([path]) => path),
        ...(pattern.test(withoutComments(indexHtml)) ? ['index.html'] : []),
      ];
      expect(found).toEqual([]);
    });
  }

  it('kontrola opravdu pozná textové pole i zaměření', () => {
    const sample = "const box = document.createElement('input'); box.focus();";
    expect(KEYBOARD_TRIGGERS.some(({ pattern }) => pattern.test(sample))).toBe(true);
    expect(KEYBOARD_LISTENERS.test("window.addEventListener('keydown', onKey)")).toBe(true);
  });
});

describe('#72 AC5: ve hře nedělá fyzická klávesnice nic', () => {
  it('žádná hra neposlouchá klávesnici', () => {
    const listening = Object.entries(SOURCES)
      .filter(([path]) => path.startsWith('src/games/'))
      .filter(([, text]) => KEYBOARD_LISTENERS.test(withoutComments(text)))
      .map(([path]) => path);
    expect(listening).toEqual([]);
  });

  it('sdílená část (herní plocha, kolečko, domeček) klávesnici neposlouchá', () => {
    const listening = Object.entries(SOURCES)
      .filter(([path]) => path.startsWith('src/shared/'))
      .filter(([, text]) => KEYBOARD_LISTENERS.test(withoutComments(text)))
      .map(([path]) => path);
    expect(listening).toEqual([]);
  });
});
