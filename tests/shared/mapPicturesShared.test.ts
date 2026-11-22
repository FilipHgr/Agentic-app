/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';

import { loadEachOnce } from '../../src/shared/logic/loadOnce';
import { MAP_THEMES } from '../../src/shared/logic/progressMap';
import { mapPictureUrl } from '../../src/shared/logic/mapPictures';

/**
 * Testy k #193 AC5: obrázky map postupu jsou jen ve sdílené části, hry je
 * berou odtud a na stránce se každý stáhne nejvýš jednou pro všechny hry
 * (`loadEachOnce` v `src/shared/ui/mapPictureTextures.ts`). Že se stahuje
 * postupně jen obrázek příští mapy, hlídají testy #134
 * (`mapPictureLoading.test.ts`); že hra nesahá do jiné hry, test hranic.
 */

/** Soubory obrázků (webp, png, svg) ve složkách her. */
const GAME_PICTURES: string[] = Object.keys(
  import.meta.glob('../../src/games/**/*.{webp,png,svg}', { query: '?url', eager: false }),
);

/** Zdrojové texty her. */
const GAME_SOURCES: Record<string, string> = import.meta.glob<string>('../../src/games/**/*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
});

/** Stahování, které si pamatuje každou žádost a dokončí ji, až řekne test. */
function controlledDownload(): {
  readonly load: (url: string) => Promise<string>;
  readonly requests: string[];
  finish(index: number): void;
  fail(index: number): void;
} {
  const requests: string[] = [];
  const settles: Array<{ resolve: (value: string) => void; reject: (error: Error) => void }> = [];
  return {
    requests,
    load: (url) =>
      new Promise<string>((resolve, reject) => {
        requests.push(url);
        settles.push({ resolve, reject });
      }),
    finish: (index) => settles[index]?.resolve(`obrázek ${requests[index] ?? ''}`),
    fail: (index) => settles[index]?.reject(new Error('výpadek sítě')),
  };
}

describe('#193 AC5: obrázky map jsou jen ve sdílené části', () => {
  it('žádná hra nemá vlastní obrázky map a hry s hvězdičkami ani půlky klíče u cíle', () => {
    // Omalovánky mají vlastní klíč ukazatele klíčů (#140), mapu ne.
    const mapPictures = GAME_PICTURES.filter(
      (path) => /\/maps\//.test(path) || /\/(counting|compare)\/.*key-(head|blade)\./.test(path),
    );
    expect(mapPictures).toEqual([]);
  });

  it('žádná hra nemá vlastní kód mapy postupu, obě ji berou ze sdílené části', () => {
    const own = Object.keys(GAME_SOURCES).filter((path) =>
      /\/(progressMap\w*|map(Animation|Footprints|Pictures?\w*|PlacePads|Scenery\w*)|ProgressMapView|MapStarRow|mapStorage)\.ts$/.test(
        path,
      ),
    );
    expect(own).toEqual([]);
    for (const game of ['counting', 'compare']) {
      const sources = Object.entries(GAME_SOURCES)
        .filter(([path]) => path.includes(`/src/games/${game}/`))
        .map(([, text]) => text)
        .join('\n');
      expect(sources, game).toContain('shared/ui/MapCardScreen');
      expect(sources, game).toContain('shared/logic/mapCardFlow');
    }
  });

  it('každá mapa má jednu adresu obrázku na šířku i na výšku pro všechny hry', () => {
    for (const theme of MAP_THEMES) {
      for (const orientation of ['landscape', 'portrait'] as const) {
        expect(mapPictureUrl(theme, orientation), `${theme} ${orientation}`).toMatch(
          /src\/shared\/maps\/|\/assets\//,
        );
      }
    }
  });
});

describe('#193 AC5: obrázek mapy se na stránce stáhne jen jednou pro všechny hry', () => {
  it('obrázek stažený v Počítání dostanou Znaménka bez dalšího stahování', async () => {
    const download = controlledDownload();
    const pagePictures = loadEachOnce(download.load);
    const inCounting = pagePictures('island-landscape.webp');
    download.finish(0);
    await inCounting;

    const inCompare = await pagePictures('island-landscape.webp');
    expect(inCompare).toBe('obrázek island-landscape.webp');
    expect(download.requests).toEqual(['island-landscape.webp']);
  });

  it('dvě hry, které chtějí stejný obrázek zároveň, počkají na jedno stažení', async () => {
    const download = controlledDownload();
    const pagePictures = loadEachOnce(download.load);
    const first = pagePictures('forest-portrait.webp');
    const second = pagePictures('forest-portrait.webp');
    download.finish(0);
    expect(await first).toBe(await second);
    expect(download.requests).toHaveLength(1);
  });

  it('jiný obrázek se stahuje zvlášť, až když ho mapa potřebuje', async () => {
    const download = controlledDownload();
    const pagePictures = loadEachOnce(download.load);
    void pagePictures('island-landscape.webp');
    expect(download.requests).toEqual(['island-landscape.webp']);
    void pagePictures('forest-landscape.webp');
    expect(download.requests).toEqual(['island-landscape.webp', 'forest-landscape.webp']);
  });

  it('po výpadku sítě se obrázek při další žádosti stáhne znovu a dítě chybu nevidí', async () => {
    const download = controlledDownload();
    const pagePictures = loadEachOnce(download.load);
    const failed = pagePictures('space-landscape.webp');
    download.fail(0);
    await expect(failed).rejects.toThrow();

    const retried = pagePictures('space-landscape.webp');
    expect(download.requests).toHaveLength(2);
    download.finish(1);
    await expect(retried).resolves.toBe('obrázek space-landscape.webp');
  });

  it('stahování, které ani nezačne, se bere jako výpadek a zkusí se znovu', async () => {
    let attempts = 0;
    const pagePictures = loadEachOnce((url) => {
      attempts += 1;
      if (attempts === 1) {
        throw new Error('stahování nezačalo');
      }
      return Promise.resolve(url);
    });
    await expect(pagePictures('castle-landscape.webp')).rejects.toThrow();
    await expect(pagePictures('castle-landscape.webp')).resolves.toBe('castle-landscape.webp');
  });
});
