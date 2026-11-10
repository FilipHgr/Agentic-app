/// <reference types="vite/client" />
import { describe, expect, it, vi } from 'vitest';

import { blockInstallOffer } from '../../src/shared/logic/installOffer';

/**
 * Testy k #78 AC5: na telefonu s Chromem (Samsung) hra sama nenabízí
 * instalaci. Chrome ohlásí, že by stránku mohl nainstalovat, událostí
 * `beforeinstallprompt`; když ji stránka nezruší (`preventDefault`), ukáže
 * pruh „Nainstalovat aplikaci“, který by dítě mohlo omylem ťuknout.
 * Nabídka prohlížeče je tu nasimulovaná: stránka je obyčejný `EventTarget`
 * a nabídka událost s vlastní funkcí `prompt`, která okno instalace otevře.
 *
 * Menu i hra běží na jedné stránce (#51, #67): hra se stáhne a spustí bez
 * načtení nové stránky. Blokování proto stačí zaregistrovat jednou při
 * startu stránky a musí platit pro každou nabídku, v menu i ve hře.
 */

interface SimulatedOffer {
  readonly event: Event;
  readonly prompt: ReturnType<typeof vi.fn>;
}

/** Nabídka instalace, jak ji pošle Chrome: zrušitelná událost s `prompt()`. */
function browserOffer(): SimulatedOffer {
  const event = new Event('beforeinstallprompt', { cancelable: true });
  const prompt = vi.fn(() => Promise.resolve());
  Object.defineProperty(event, 'prompt', { value: prompt });
  return { event, prompt };
}

/** Stránka, která při startu zablokovala nabídku instalace. */
function startedPage(): EventTarget {
  const page = new EventTarget();
  blockInstallOffer(page);
  return page;
}

describe('#78 AC5: hra sama nenabízí instalaci', () => {
  it('v menu: nabídka prohlížeče se zruší a okno instalace se neotevře', () => {
    const page = startedPage();
    const offer = browserOffer();

    page.dispatchEvent(offer.event);

    expect(offer.event.defaultPrevented, 'pruh „Nainstalovat aplikaci“ se neukáže').toBe(true);
    expect(offer.prompt, 'hra sama okno instalace neotevře').not.toHaveBeenCalled();
  });

  it('ve hře i po návratu do menu: každá další nabídka se zruší také', () => {
    const page = startedPage();
    // Chrome nabídku pošle znovu třeba po spuštění hry a po návratu do menu.
    const offers = ['v menu', 've hře', 'po návratu do menu'].map((when) => ({
      when,
      ...browserOffer(),
    }));

    for (const offer of offers) {
      page.dispatchEvent(offer.event);
    }

    for (const offer of offers) {
      expect(offer.event.defaultPrevented, offer.when).toBe(true);
      expect(offer.prompt, offer.when).not.toHaveBeenCalled();
    }
  });

  it('jiné události stránky (ťuknutí) blokování nezruší', () => {
    const page = startedPage();
    const tap = new Event('pointerdown', { cancelable: true });

    page.dispatchEvent(tap);

    expect(tap.defaultPrevented).toBe(false);
  });

  it('bez blokování by nabídka zůstala, simulace nabídky tedy opravdu něco měří', () => {
    const page = new EventTarget();
    const offer = browserOffer();

    page.dispatchEvent(offer.event);

    expect(offer.event.defaultPrevented).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Blokování se zaregistruje při startu stránky (menu i hra)
// ---------------------------------------------------------------------------

const SOURCES: Record<string, string> = Object.fromEntries(
  Object.entries(
    import.meta.glob<string>('../../src/**/*.ts', {
      query: '?raw',
      import: 'default',
      eager: true,
    }),
  ).map(([path, text]) => [path.replace('../../', ''), text]),
);

const ENTRY = 'src/main.ts';
const INSTALL_OFFER_FILE = 'src/shared/logic/installOffer.ts';

function withoutComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

function resolve(fromFile: string, specifier: string): string | null {
  const parts = fromFile.split('/').slice(0, -1);
  for (const part of specifier.split('/')) {
    if (part === '..') {
      parts.pop();
    } else if (part !== '.' && part !== '') {
      parts.push(part);
    }
  }
  const base = parts.join('/');
  for (const candidate of [base, `${base}.ts`, `${base}/index.ts`]) {
    if (SOURCES[candidate] !== undefined) {
      return candidate;
    }
  }
  return null;
}

/** Soubory, které stránka načte hned při startu (statické importy z `src/main.ts`). */
function startupFiles(): Set<string> {
  const reached = new Set<string>();
  const queue = [ENTRY];
  while (queue.length > 0) {
    const file = queue.pop();
    if (file === undefined || reached.has(file)) {
      continue;
    }
    reached.add(file);
    const code = withoutComments(SOURCES[file] ?? '');
    for (const match of code.matchAll(
      /^\s*import\s+(?!type\s)[\s\S]*?\s+from\s+['"]([^'"]+)['"]/gm,
    )) {
      const target = resolve(file, match[1] ?? '');
      if (target !== null) {
        queue.push(target);
      }
    }
  }
  return reached;
}

describe('#78 AC5: blokování platí od startu stránky, v menu i ve hře', () => {
  it('stránka při startu zablokuje nabídku instalace pro celé okno', () => {
    const callers = [...startupFiles()].filter(
      (file) =>
        file !== INSTALL_OFFER_FILE &&
        /\bblockInstallOffer\s*\(\s*window\s*\)/.test(withoutComments(SOURCES[file] ?? '')),
    );

    expect(callers, 'soubor stránky, který volá blockInstallOffer(window)').not.toEqual([]);
  });
});
