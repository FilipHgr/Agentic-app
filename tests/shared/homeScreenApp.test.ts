/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';

import { PAGE_BACKGROUND } from '../../src/shared/logic/theme';
import { sharedTexts } from '../../src/shared/texts/sharedTexts';
import indexHtml from '../../index.html?raw';

/**
 * Testy k #78 AC1, AC2 a AC6: hru jde přidat na plochu jako samostatnou
 * aplikaci. Popis aplikace je statický soubor `public/manifest.webmanifest`
 * (Vite ho zkopíruje do buildu beze změny) a stránka `index.html` na něj
 * odkazuje. Ikony jsou v `public/icons/` jako PNG.
 *
 * Název pod ikonou je v manifestu i v `index.html` napsaný stejně jako
 * `<title>` (#65): test ho porovná s `pageTitle` ve sdílených textech, takže
 * po změně názvu v `src/shared/texts/cs.ts` selže, dokud se nezmění i tady.
 * Názvy ve víc jazycích jsou mimo rozsah.
 *
 * Soubory se čtou přes `import.meta.glob` (texty jako `?raw`, obrázky jako
 * `?inline`, tj. data URL v base64), chybějící soubor se v testu ukáže jako
 * „chybí“. Vzhled ikony a záblesk při startu jsou ruční kontrola.
 */

const MANIFEST_PATH = '/manifest.webmanifest';

/** Textové soubory ve `public/` podle adresy na webu (`/manifest.webmanifest`). */
const PUBLIC_TEXTS: Record<string, string> = webPaths(
  import.meta.glob<string>('../../public/*.webmanifest', {
    query: '?raw',
    import: 'default',
    eager: true,
  }),
);

/** Obrázky PNG ve `public/` podle adresy na webu, jako bajty. */
const PUBLIC_IMAGES: Record<string, Uint8Array> = Object.fromEntries(
  Object.entries(
    webPaths(
      import.meta.glob<string>('../../public/**/*.png', {
        query: '?inline',
        import: 'default',
        eager: true,
      }),
    ),
  ).map(([path, dataUrl]) => [path, bytesOf(dataUrl)]),
);

/** Všechny soubory repozitáře, na které smí stránka odkazovat (kvůli kontrole, že existují). */
const REPO_FILES: ReadonlySet<string> = new Set([
  ...Object.keys(
    import.meta.glob('../../public/**/*', { query: '?url', import: 'default', eager: false }),
  ).map((path) => path.replace('../../public', '')),
  ...Object.keys(import.meta.glob('../../src/**/*.ts', { eager: false })).map((path) =>
    path.replace('../..', ''),
  ),
]);

/** Největší povolená velikost souboru ikony (AC1). */
const MAX_ICON_BYTES = 30 * 1024;

function webPaths<T>(files: Record<string, T>): Record<string, T> {
  return Object.fromEntries(
    Object.entries(files).map(([path, value]) => [path.replace('../../public', ''), value]),
  );
}

function bytesOf(dataUrl: string): Uint8Array {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** Šířka a výška obrázku PNG z hlavičky IHDR, `null` když to není PNG. */
function pngSize(bytes: Uint8Array): { width: number; height: number } | null {
  const isPng = PNG_SIGNATURE.every((value, index) => bytes[index] === value);
  if (!isPng || bytes.length < 24) {
    return null;
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

interface ManifestIcon {
  readonly src?: unknown;
  readonly sizes?: unknown;
  readonly type?: unknown;
}

type Manifest = Record<string, unknown> & { readonly icons?: readonly ManifestIcon[] };

function manifest(): Manifest {
  const text = PUBLIC_TEXTS[MANIFEST_PATH];
  expect(text, `chybí public${MANIFEST_PATH}`).toBeDefined();
  return JSON.parse(text ?? '{}') as Manifest;
}

/** Atributy všech značek `<tag …>` v `index.html`. */
function tagsOf(tag: string): Array<Record<string, string>> {
  const html = indexHtml.replace(/<!--[\s\S]*?-->/g, '');
  return [...html.matchAll(new RegExp(`<${tag}\\b([^>]*)>`, 'gi'))].map((match) =>
    Object.fromEntries(
      [...(match[1] ?? '').matchAll(/([a-z-]+)\s*=\s*"([^"]*)"/gi)].map((attribute) => [
        (attribute[1] ?? '').toLowerCase(),
        attribute[2] ?? '',
      ]),
    ),
  );
}

function metaContent(name: string): string | undefined {
  return tagsOf('meta').find((attributes) => attributes.name === name)?.content;
}

function linksWithRel(rel: string): Array<Record<string, string>> {
  return tagsOf('link').filter((attributes) => attributes.rel?.split(/\s+/).includes(rel));
}

/** Adresa na webu vůči manifestu (manifest leží v kořeni stránky). */
function resolvedFromManifest(path: string): URL {
  return new URL(path, `https://hra.example${MANIFEST_PATH}`);
}

function expectColor(actual: unknown, expected: string, what: string): void {
  expect(typeof actual, what).toBe('string');
  expect(String(actual).toLowerCase(), what).toBe(expected.toLowerCase());
}

// ---------------------------------------------------------------------------
// AC1: ikona a název na ploše
// ---------------------------------------------------------------------------

describe('#78 AC1: na ploše je ikona hry s názvem stránky', () => {
  const title = sharedTexts('cs').pageTitle;

  it('název pod ikonou je stejný jako název stránky v textech jazyka (dnes „Matematika“)', () => {
    const app = manifest();

    expect(app.name, 'name v manifestu').toBe(title);
    expect(app.short_name, 'short_name v manifestu').toBe(title);
  });

  it('i když rodič přidá hru na plochu uprostřed hry (jiný název záložky), Safari nabídne název stránky', () => {
    // Ve hře se název záložky mění na název hry (#67), Safari by ho jinak převzal.
    expect(metaContent('apple-mobile-web-app-title'), 'apple-mobile-web-app-title').toBe(title);
  });

  it('stránka odkazuje na popis aplikace pro plochu', () => {
    const hrefs = linksWithRel('manifest').map((link) => link.href);

    expect(hrefs).toEqual([MANIFEST_PATH]);
  });

  it('na ploše iPadu je ikona hry 180 × 180, ne snímek stránky', () => {
    const icons = linksWithRel('apple-touch-icon');
    expect(icons.length, 'odkaz <link rel="apple-touch-icon">').toBe(1);
    const href = icons[0]?.href ?? '';
    const bytes = PUBLIC_IMAGES[href];

    expect(bytes, `chybí soubor public${href}`).toBeDefined();
    expect(pngSize(bytes ?? new Uint8Array()), href).toEqual({ width: 180, height: 180 });
  });

  it('popis aplikace má ikony 192 × 192 a 512 × 512 a rozměry souborů sedí s udanými', () => {
    const icons = manifest().icons ?? [];
    const declared = icons.map((icon) => String(icon.sizes));

    expect(declared.sort(), 'velikosti ikon v manifestu').toEqual(['192x192', '512x512']);
    for (const icon of icons) {
      const src = String(icon.src);
      const bytes = PUBLIC_IMAGES[src];
      const [width, height] = String(icon.sizes).split('x').map(Number);
      expect(icon.type, `${src}: typ`).toBe('image/png');
      expect(bytes, `chybí soubor public${src}`).toBeDefined();
      expect(pngSize(bytes ?? new Uint8Array()), src).toEqual({ width, height });
    }
  });

  it('každý soubor ikony má nejvýš 30 kB', () => {
    const iconPaths = [
      ...linksWithRel('apple-touch-icon').map((link) => link.href ?? ''),
      ...(manifest().icons ?? []).map((icon) => String(icon.src)),
    ];

    expect(iconPaths.length, 'ikony 180, 192 a 512').toBe(3);
    for (const path of iconPaths) {
      const bytes = PUBLIC_IMAGES[path];
      expect(bytes, `chybí soubor public${path}`).toBeDefined();
      expect(bytes?.length ?? Infinity, `${path}: velikost v bajtech`).toBeLessThanOrEqual(
        MAX_ICON_BYTES,
      );
    }
  });
});

// ---------------------------------------------------------------------------
// AC2: start z plochy a barvy
// ---------------------------------------------------------------------------

describe('#78 AC2: aplikace z plochy začne jako nové načtení stránky', () => {
  it('úvodní adresa je kořen stránky bez parametrů, ne adresa hry', () => {
    const start = resolvedFromManifest(String(manifest().start_url));

    expect(start.origin, 'stejný server').toBe('https://hra.example');
    expect(start.pathname, 'kořen stránky').toBe('/');
    expect(start.search, 'bez parametrů').toBe('');
    expect(start.hash, 'bez kotvy').toBe('');
  });

  it('úvodní adresa leží v rozsahu aplikace, odkazy stránky se neotevřou v Safari', () => {
    const app = manifest();
    const start = resolvedFromManifest(String(app.start_url));
    const scope = resolvedFromManifest(String(app.scope));

    expect(scope.pathname, 'rozsah je celá stránka').toBe('/');
    expect(start.href.startsWith(scope.href), `${start.href} v ${scope.href}`).toBe(true);
  });

  it('aplikace z plochy běží bez lišty Safari', () => {
    expect(manifest().display, 'display v manifestu').toBe('standalone');
    expect(metaContent('apple-mobile-web-app-capable'), 'apple-mobile-web-app-capable').toBe('yes');
  });

  it('pozadí při spouštění a barva lišty jsou světlé #F5F5F7 jako pozadí stránky', () => {
    const app = manifest();

    expectColor(PAGE_BACKGROUND, '#F5F5F7', 'pozadí stránky');
    expectColor(app.background_color, PAGE_BACKGROUND, 'background_color v manifestu');
    expectColor(app.theme_color, PAGE_BACKGROUND, 'theme_color v manifestu');
    expectColor(metaContent('theme-color'), PAGE_BACKGROUND, 'meta theme-color');
  });

  it('stavový řádek má tmavé písmo na světlém pozadí', () => {
    // „default“ = tmavé písmo, „black-translucent“ a „black“ by měly světlé.
    expect(metaContent('apple-mobile-web-app-status-bar-style')).toBe('default');
  });
});

// ---------------------------------------------------------------------------
// AC6: všechno je v repozitáři, nic nevede na cizí servery
// ---------------------------------------------------------------------------

/** Odkaz mimo stránku: se schématem (`https:`, `data:` …) nebo bez něj (`//cdn…`). */
function isForeign(address: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(address) || address.startsWith('//');
}

/** Všechny řetězce v popisu aplikace i ve vnořených polích a objektech. */
function stringsOf(value: unknown, where: string): Array<{ where: string; text: string }> {
  if (typeof value === 'string') {
    return [{ where, text: value }];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => stringsOf(item, `${where}[${index}]`));
  }
  if (value !== null && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, item]) =>
      stringsOf(item, where === '' ? key : `${where}.${key}`),
    );
  }
  return [];
}

/** Odkazy v `index.html`: `href`, `src`, adresy ve stylech a v obsahu značek meta. */
function pageAddresses(): Array<{ where: string; address: string }> {
  const html = indexHtml.replace(/<!--[\s\S]*?-->/g, '');
  const attributes = [...html.matchAll(/\s(href|src|srcset|action|poster)\s*=\s*"([^"]*)"/gi)].map(
    (match) => ({ where: match[1] ?? '', address: match[2] ?? '' }),
  );
  const styles = [...html.matchAll(/url\(\s*['"]?([^'")]+)/gi)].map((match) => ({
    where: 'url() ve stylu',
    address: match[1] ?? '',
  }));
  return [...attributes, ...styles];
}

describe('#78 AC6: aplikace z plochy nic nestahuje z cizích serverů', () => {
  it('popis aplikace neodkazuje na žádný cizí server', () => {
    const foreign = stringsOf(manifest(), '')
      .filter(({ text }) => isForeign(text) || /\bwww\.|\.(com|net|org|io)\b/i.test(text))
      .map(({ where, text }) => `${where}: ${text}`);

    expect(foreign).toEqual([]);
  });

  it('popis aplikace nenabízí místo hry aplikace z obchodů', () => {
    const app = manifest();

    expect(app.related_applications ?? [], 'related_applications').toEqual([]);
    expect(app.prefer_related_applications ?? false, 'prefer_related_applications').toBe(false);
  });

  it('všechny soubory z popisu aplikace jsou v repozitáři', () => {
    const app = manifest();
    const paths = (app.icons ?? []).map((icon) => String(icon.src));

    expect(paths.length).toBeGreaterThan(0);
    for (const path of paths) {
      expect(isForeign(path), path).toBe(false);
      expect(REPO_FILES.has(resolvedFromManifest(path).pathname), `public${path}`).toBe(true);
    }
  });

  it('každý odkaz na stránce vede na soubor v repozitáři, žádný na cizí server', () => {
    const addresses = pageAddresses();

    expect(addresses.length, 'stránka má odkazy na manifest, ikonu a skript').toBeGreaterThan(2);
    for (const { where, address } of addresses) {
      expect(isForeign(address), `${where}="${address}"`).toBe(false);
      expect(REPO_FILES.has(resolvedFromManifest(address).pathname), `${where}="${address}"`).toBe(
        true,
      );
    }
  });

  it('obsah značek meta nevede na cizí server', () => {
    const foreign = tagsOf('meta')
      .filter((attributes) => /\bhttps?:|\/\//i.test(attributes.content ?? ''))
      .map(
        (attributes) => `${attributes.name ?? attributes.property ?? ''}: ${attributes.content}`,
      );

    expect(foreign).toEqual([]);
  });
});
