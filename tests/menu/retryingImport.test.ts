import { describe, expect, it } from 'vitest';

import { attemptUrl, createRetryingImport } from '../../src/menu/logic/retryingImport';

/**
 * Testy k #67 AC5: po výpadku sítě další ťuknutí hru opravdu stáhne znovu.
 * Prohlížeč si nepovedený `import()` pamatuje, proto další pokus jde na
 * jinou adresu. Stahování je tu falešné.
 */

const BASE = 'https://hra.example/assets/index-start.js';

function fakeImporter(failingUrls: Set<string>): {
  urls: string[];
  importer: (url: string) => Promise<unknown>;
} {
  const urls: string[] = [];
  return {
    urls,
    importer: (url) => {
      urls.push(url);
      return failingUrls.has(url)
        ? Promise.reject(new Error('síť nefunguje'))
        : Promise.resolve({ url });
    },
  };
}

describe('#67 AC5: nový pokus o stažení hry po výpadku sítě', () => {
  it('první pokus stahuje hru z její adresy beze změny', async () => {
    const fake = fakeImporter(new Set());
    await createRetryingImport(fake.importer)('./index-hra.js', BASE);
    expect(fake.urls).toEqual(['https://hra.example/assets/index-hra.js']);
  });

  it('po výpadku jde další pokus na jinou adresu a hra se stáhne', async () => {
    const fake = fakeImporter(new Set(['https://hra.example/assets/index-hra.js']));
    const load = createRetryingImport(fake.importer);
    await expect(load('./index-hra.js', BASE)).rejects.toThrow();
    await expect(load('./index-hra.js', BASE)).resolves.toBeDefined();
    expect(fake.urls[1]).not.toBe(fake.urls[0]);
    expect(fake.urls[1]).toBe(attemptUrl('https://hra.example/assets/index-hra.js', 1));
  });

  it('každý další výpadek posune pokus na novou adresu', async () => {
    const fake = fakeImporter(
      new Set([
        'https://hra.example/assets/index-hra.js',
        attemptUrl('https://hra.example/assets/index-hra.js', 1),
      ]),
    );
    const load = createRetryingImport(fake.importer);
    await expect(load('./index-hra.js', BASE)).rejects.toThrow();
    await expect(load('./index-hra.js', BASE)).rejects.toThrow();
    await expect(load('./index-hra.js', BASE)).resolves.toBeDefined();
    expect(new Set(fake.urls).size).toBe(3);
  });

  it('po povedeném stažení se používá stejná adresa, hra není v paměti dvakrát', async () => {
    const fake = fakeImporter(new Set(['https://hra.example/assets/index-hra.js']));
    const load = createRetryingImport(fake.importer);
    await expect(load('./index-hra.js', BASE)).rejects.toThrow();
    await load('./index-hra.js', BASE);
    await load('./index-hra.js', BASE);
    expect(fake.urls[2]).toBe(fake.urls[1]);
  });

  it('výpadek jedné hry nemění adresu jiné hry', async () => {
    const fake = fakeImporter(new Set(['https://hra.example/assets/index-hra.js']));
    const load = createRetryingImport(fake.importer);
    await expect(load('./index-hra.js', BASE)).rejects.toThrow();
    await load('./index-jina.js', BASE);
    expect(fake.urls[1]).toBe('https://hra.example/assets/index-jina.js');
  });

  it('adresa, která už otazník má, dostane číslo pokusu za &', () => {
    expect(attemptUrl('https://hra.example/a.js?x=1', 2)).toBe(
      'https://hra.example/a.js?x=1&pokus=2',
    );
  });

  it('adresu z cizího serveru odmítne a nic nestáhne', async () => {
    const fake = fakeImporter(new Set());
    const load = createRetryingImport(fake.importer);
    await expect(load('https://cizi.example/hra.js', BASE)).rejects.toThrow();
    await expect(load('//cizi.example/hra.js', BASE)).rejects.toThrow();
    expect(fake.urls).toEqual([]);
  });
});
