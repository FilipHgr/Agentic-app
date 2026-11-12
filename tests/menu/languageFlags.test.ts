/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';

import { LANGUAGES } from '../../src/shared/texts/languages';
import type { Language } from '../../src/shared/texts/languages';
import licenceText from '../../public/licence.txt?raw';

/**
 * Testy k #138 AC9 (komentář vlastníka „v nabídce jazyků u každého jazyka
 * vlajka“): u každého jazyka ze seznamu je plochá vlajka ze sady Noto Emoji
 * (noto-emoji `third_party/region-flags`, převzatá z balíčku `@svgmoji/noto`
 * 3.2.0), uložená v repozitáři jako obdélníkové SVG (ne čtverec 128 × 128,
 * ten pro vlajky v sadě není), původ v `public/licence.txt`.
 * Systémové emoji vlajek se nepoužijí (na Windows by byla jen písmena),
 * hra vlajky nikde nestahuje. Vlajka je vlevo od vlastního názvu jazyka,
 * rozložení řádku je v `languageFlagLayout.test.ts`.
 *
 * Navržené rozhraní (`src/menu/logic/languageFlags.ts`, čistý TypeScript):
 * - `interface LanguageFlag { readonly emoji: string; readonly file: string }`,
 *   `emoji` je jméno vlajky v sadě Noto (`flag-czechia`), `file` jméno souboru
 *   (`flag-czechia.svg`) ve složce `src/menu/flags/`,
 * - `languageFlag(language: Language): LanguageFlag`.
 * Scéna menu soubor načte jako součást balíčku menu (Vite import
 * z `src/menu/flags/`, např. `import.meta.glob` s `?url`), ne z cizího serveru.
 */

/** Složka vlajek v repozitáři (stahuje se s kódem menu). */
const FLAG_FOLDER = 'src/menu/flags';

/** Vlajka každého jazyka podle zadání: čeština 🇨🇿, angličtina 🇬🇧 (britská podle #137). */
const EXPECTED_FLAGS: Readonly<Record<string, string>> = {
  cs: 'flag-czechia',
  en: 'flag-united-kingdom',
};

/** Poměr stran vlajky (šířka : výška): od 3 : 2 (česká) do 2 : 1 (britská), žádný čtverec. */
const MIN_FLAG_RATIO = 3 / 2;
const MAX_FLAG_RATIO = 2;
const RATIO_ROUNDING = 1e-6;

/** Vlajka nesmí být zbytečně velký asset (CLAUDE.md, plynulost), stejně jako ikony nástrojů. */
const MAX_FLAG_BYTES = 20_000;

/** SVG soubory ve složce vlajek podle cesty od kořene repozitáře, přečtené při sestavení. */
const FLAG_FILES: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(
    import.meta.glob<string>('../../src/menu/flags/*', {
      query: '?raw',
      import: 'default',
      eager: true,
    }),
  ).map(([path, svg]) => [path.replace('../../', ''), svg]),
);

interface LanguageFlag {
  readonly emoji: string;
  readonly file: string;
}

/** Vlajka jazyka podle navrženého rozhraní; chybějící modul je chyba testu, ne pád souboru. */
async function flagOf(language: Language): Promise<LanguageFlag> {
  const module = (await import('../../src/menu/logic/languageFlags')) as {
    languageFlag?: (language: Language) => LanguageFlag;
  };
  if (module.languageFlag === undefined) {
    throw new Error('src/menu/logic/languageFlags.ts nevydává languageFlag');
  }
  return module.languageFlag(language);
}

function flagPath(file: string): string {
  return `${FLAG_FOLDER}/${file}`;
}

/** Adresy mimo soubor (http, https, //server); jmenné prostory XML se nepočítají. */
function externalReferences(svg: string): string[] {
  const withoutNamespaces = svg.replace(/\sxmlns(:[\w-]+)?\s*=\s*("[^"]*"|'[^']*')/g, '');
  return withoutNamespaces.match(/(https?:)?\/\/[^\s"')]+/g) ?? [];
}

/** Šířka a výška plochy SVG z atributu `viewBox`, nebo `null`, když chybí či je neplatný. */
function viewBoxSize(svg: string): { width: number; height: number } | null {
  const rootTag = /<svg\b[^>]*>/.exec(svg)?.[0] ?? '';
  const match = /\sviewBox\s*=\s*["']([^"']*)["']/.exec(rootTag);
  if (match === null) {
    return null;
  }
  const numbers = (match[1] ?? '')
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  const [, , width, height] = numbers;
  if (
    numbers.length !== 4 ||
    numbers.some((value) => !Number.isFinite(value)) ||
    width === undefined ||
    height === undefined ||
    width <= 0 ||
    height <= 0
  ) {
    return null;
  }
  return { width, height };
}

/** Odstavec `public/licence.txt`, který uvádí složku vlajek (mezery sjednocené). */
function flagLicenceParagraph(): string {
  return (
    licenceText
      .split(/\n\s*\n/)
      .map((paragraph) => paragraph.replace(/\s+/g, ' '))
      .find((paragraph) => paragraph.includes(FLAG_FOLDER)) ?? ''
  );
}

describe('#138 AC9: každý jazyk ze seznamu má vlajku a žádná není navíc', () => {
  it('každý jazyk v nabídce má vlajku podle zadání (Čeština 🇨🇿, English 🇬🇧)', async () => {
    for (const language of LANGUAGES) {
      expect(
        EXPECTED_FLAGS[language],
        `jazyk ${language} nemá v testu očekávanou vlajku`,
      ).toBeDefined();
      expect(await flagOf(language), `jazyk ${language}`).toEqual({
        emoji: EXPECTED_FLAGS[language],
        file: `${EXPECTED_FLAGS[language]}.svg`,
      });
    }
  });

  it('každý jazyk má jinou vlajku', async () => {
    const files = await Promise.all(
      LANGUAGES.map(async (language) => (await flagOf(language)).file),
    );
    expect(new Set(files).size, files.join(', ')).toBe(LANGUAGES.length);
    const contents = files.map((file) => FLAG_FILES[flagPath(file)]);
    expect(new Set(contents).size, 'obsah SVG je u každého jazyka jiný').toBe(LANGUAGES.length);
  });

  it('SVG vlajky každého jazyka je uložené v repozitáři a ve složce žádná vlajka navíc není', async () => {
    const wanted = (
      await Promise.all(LANGUAGES.map(async (language) => flagPath((await flagOf(language)).file)))
    ).sort();
    expect(Object.keys(FLAG_FILES).sort()).toEqual(wanted);
  });
});

describe('#138 AC9: vlajky jsou ploché SVG ze sady Noto Emoji a hra je nikde nestahuje', () => {
  it('ve složce vlajek jsou jen soubory SVG', () => {
    expect(Object.keys(FLAG_FILES).length, `složka ${FLAG_FOLDER} je prázdná`).toBeGreaterThan(0);
    for (const path of Object.keys(FLAG_FILES)) {
      expect(path.endsWith('.svg'), path).toBe(true);
    }
  });

  it('každá vlajka je platné SVG s atributem viewBox a uzavřeným kořenem', () => {
    for (const [path, svg] of Object.entries(FLAG_FILES)) {
      const text = svg.trim();
      expect(text.startsWith('<svg'), `${path} nezačíná <svg`).toBe(true);
      expect(text.endsWith('</svg>'), `${path} nekončí </svg>`).toBe(true);
      expect(
        /<svg\b[^>]*\sxmlns\s*=\s*["']http:\/\/www\.w3\.org\/2000\/svg["']/.test(text),
        path,
      ).toBe(true);
      expect(viewBoxSize(text), `${path} nemá platný viewBox`).not.toBeNull();
    }
  });

  it('každá vlajka je obdélník s poměrem stran mezi 3 : 2 a 2 : 1, ne čtverec', () => {
    const problems = Object.entries(FLAG_FILES).flatMap(([path, svg]) => {
      const size = viewBoxSize(svg);
      if (size === null) {
        return [`${path}: chybí platný viewBox`];
      }
      const ratio = size.width / size.height;
      return ratio >= MIN_FLAG_RATIO - RATIO_ROUNDING && ratio <= MAX_FLAG_RATIO + RATIO_ROUNDING
        ? []
        : [`${path}: viewBox ${size.width} × ${size.height} má poměr ${ratio.toFixed(2)}`];
    });
    expect(Object.keys(FLAG_FILES).length, `složka ${FLAG_FOLDER} je prázdná`).toBeGreaterThan(0);
    expect(problems).toEqual([]);
  });

  it('žádná vlajka neodkazuje na cizí server ani nemá skript', () => {
    for (const [path, svg] of Object.entries(FLAG_FILES)) {
      expect(externalReferences(svg), path).toEqual([]);
      expect(svg.toLowerCase(), path).not.toContain('<script');
      expect(svg.toLowerCase(), path).not.toContain('<image');
    }
  });

  it('žádná vlajka není zbytečně velká (nejvýš 20 000 B)', () => {
    for (const [path, svg] of Object.entries(FLAG_FILES)) {
      expect(new TextEncoder().encode(svg).byteLength, path).toBeLessThanOrEqual(MAX_FLAG_BYTES);
    }
  });

  it('vlajka není systémové emoji: soubor neobsahuje znaky regionálních písmen', () => {
    for (const [path, svg] of Object.entries(FLAG_FILES)) {
      expect(/[\u{1F1E6}-\u{1F1FF}]/u.test(svg), path).toBe(false);
    }
  });
});

describe('#138 AC9: původ vlajek je v public/licence.txt', () => {
  it('odstavec se složkou vlajek uvádí vlajku každého jazyka', async () => {
    const paragraph = flagLicenceParagraph();
    expect(paragraph, `v licence.txt chybí odstavec s ${FLAG_FOLDER}/`).not.toBe('');
    for (const language of LANGUAGES) {
      expect(paragraph, `jazyk ${language}`).toContain((await flagOf(language)).emoji);
    }
  });

  it('odstavec uvádí původ: noto-emoji region-flags převzaté z balíčku @svgmoji/noto', () => {
    const paragraph = flagLicenceParagraph();
    for (const origin of ['noto-emoji', 'region-flags', '@svgmoji/noto']) {
      expect(paragraph, origin).toContain(origin);
    }
  });

  it('odstavec uvádí licenci vlajek', () => {
    expect(flagLicenceParagraph()).toMatch(/Licence/);
  });
});
