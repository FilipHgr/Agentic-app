import { describe, expect, it } from 'vitest';

import { TILE_IMAGE_WAIT_MS, createTileImages } from '../../src/menu/logic/tileImages';
import type { TileImageGame, TileImages } from '../../src/menu/logic/tileImages';
import type { GameAccess } from '../../src/shared/logic/gameAccess';
import type { GameEntry } from '../../src/shared/logic/gameRegistry';

/**
 * Testy k #122 AC1, AC2, AC3 a AC7: rozhodnutí, jestli dlaždice ukáže
 * obrázek hry, nebo dnešní symbol, podle toho, co se opravdu načetlo.
 *
 * Navržené rozhraní (`src/menu/logic/tileImages.ts`, čistý TypeScript bez
 * Phaseru). Objekt žije po celou dobu stránky (ne ve scéně), aby se po
 * návratu z hry nic nenačítalo znovu:
 * - `createTileImages(games)`: hry v pořadí menu, každá s `id`
 *   a nepovinnou adresou obrázku dlaždice `tile` (z `meta.ts`),
 * - `startShowing(nowMs)`: menu se začíná ukazovat; vrátí obrázky
 *   (`{ gameId, url }`), které má scéna teď načíst, jen ty, které se
 *   ještě nikdy nenačítaly,
 * - `settle(gameId, loaded, nowMs)`: obrázek se načetl (`true`) nebo
 *   skončil chybou (`false`) v čase `nowMs`,
 * - `isReady(nowMs)`: smí se menu ukázat (všechno vyřízené, nebo uplynulo
 *   `TILE_IMAGE_WAIT_MS` = 3 s od začátku zobrazení),
 * - `faceOf(gameId)`: `'image'`, nebo `'symbol'`.
 * Čas předává test, takže výsledek je pokaždé stejný.
 */

const COUNTING_URL = '/assets/counting-tile.webp';
const COLORING_URL = '/assets/coloring-tile.webp';

function game(id: string, tile?: string): TileImageGame {
  return tile === undefined ? { id } : { id, tile };
}

/** Záznam hry v registru bez obrázku (jako ve zkušebním seznamu her). */
function entry(id: string, access: GameAccess): GameEntry {
  return {
    id,
    titleKey: `games.${id}.title`,
    categoryId: 'addingSubtracting',
    symbol: '2+3',
    access,
    load: () => Promise.resolve({}),
  };
}

/** Dnešní dvě hry s obrázky. */
const TODAY: readonly TileImageGame[] = [
  game('counting', COUNTING_URL),
  game('coloring', COLORING_URL),
];

/** Začátek zobrazení menu jinde než v nule, aby se limit měřil od začátku. */
const START = 10_000;

/** Kolik obrázků scéna při zobrazení menu načte. */
function requestCount(images: TileImages, nowMs: number): number {
  return images.startShowing(nowMs).length;
}

describe('#122 AC1: obrázek hry na dlaždici', () => {
  it('po načtení obrázku ukáže dlaždice obrázek místo symbolu', () => {
    const images = createTileImages(TODAY);
    images.startShowing(START);
    images.settle('counting', true, START + 50);
    images.settle('coloring', true, START + 60);
    expect(images.faceOf('counting')).toBe('image');
    expect(images.faceOf('coloring')).toBe('image');
  });

  it('zamčená hra z předplatného ukáže obrázek stejně jako hra zdarma', () => {
    // O obrázku rozhoduje jen to, co se načetlo; přístup ke hře ho nemění.
    const free: GameEntry = { ...entry('zdarma', 'free'), tile: '/assets/zdarma.webp' };
    const paid: GameEntry = { ...entry('placena', 'subscription'), tile: '/assets/placena.webp' };
    const images = createTileImages([free, paid]);
    images.startShowing(START);
    images.settle('zdarma', true, START + 10);
    images.settle('placena', true, START + 10);
    expect(images.faceOf('placena')).toBe(images.faceOf('zdarma'));
    expect(images.faceOf('placena')).toBe('image');
  });

  it('menu načte obrázek každé hry z adresy, kterou hra uvádí', () => {
    const images = createTileImages(TODAY);
    expect(images.startShowing(START)).toEqual([
      { gameId: 'counting', url: COUNTING_URL },
      { gameId: 'coloring', url: COLORING_URL },
    ]);
  });
});

describe('#122 AC2: hra s nenačteným obrázkem ukáže symbol a název', () => {
  it('hra bez obrázku v seznamu ukáže symbol, menu se ji nesnaží načíst a nečeká na ni', () => {
    const images = createTileImages([game('bez-obrazku')]);
    expect(images.startShowing(START)).toEqual([]);
    expect(images.isReady(START)).toBe(true);
    expect(images.faceOf('bez-obrazku')).toBe('symbol');
  });

  it('když se obrázek jedné hry nenačte, ukáže ta dlaždice symbol a ostatní svůj obrázek dál', () => {
    const images = createTileImages(TODAY);
    images.startShowing(START);
    images.settle('counting', false, START + 40);
    images.settle('coloring', true, START + 80);
    expect(images.faceOf('counting')).toBe('symbol');
    expect(images.faceOf('coloring')).toBe('image');
  });

  it('v seznamu her s obrázky i bez nich má obrázek jen hra, jejíž obrázek se načetl', () => {
    const images = createTileImages([game('s-obrazkem', '/a.webp'), game('bez-obrazku')]);
    images.startShowing(START);
    images.settle('s-obrazkem', true, START + 5);
    expect(images.faceOf('s-obrazkem')).toBe('image');
    expect(images.faceOf('bez-obrazku')).toBe('symbol');
  });

  it('dokud se obrázek nenačetl, dlaždice nikdy neukáže obrázek (žádný zástupný obrázek ani prázdné místo)', () => {
    const images = createTileImages(TODAY);
    images.startShowing(START);
    expect(images.faceOf('counting')).toBe('symbol');
    expect(images.faceOf('coloring')).toBe('symbol');
  });

  it('hra, o které menu nic neví, ukáže symbol', () => {
    const images = createTileImages(TODAY);
    images.startShowing(START);
    images.settle('counting', true, START + 10);
    images.settle('coloring', true, START + 10);
    expect(images.faceOf('neznama')).toBe('symbol');
    expect(images.faceOf('')).toBe('symbol');
  });

  it('hlášení o hře, kterou menu nezná, nic nepokazí', () => {
    const images = createTileImages(TODAY);
    images.startShowing(START);
    images.settle('neznama', true, START + 10);
    images.settle('counting', true, START + 20);
    expect(images.faceOf('neznama')).toBe('symbol');
    expect(images.faceOf('counting')).toBe('image');
    expect(images.isReady(START + 20)).toBe(false);
  });
});

describe('#122 AC3: menu čeká na obrázky nejdéle 3 s', () => {
  it('limit čekání na obrázky jsou 3 s', () => {
    expect(TILE_IMAGE_WAIT_MS).toBe(3000);
  });

  it('dokud se obrázky načítají, menu se neukáže (je vidět jen pozadí stránky)', () => {
    const images = createTileImages(TODAY);
    images.startShowing(START);
    expect(images.isReady(START)).toBe(false);
    images.settle('counting', true, START + 100);
    expect(images.isReady(START + 100)).toBe(false);
    expect(images.isReady(START + TILE_IMAGE_WAIT_MS - 1)).toBe(false);
  });

  it('menu se ukáže hned, jak se načtou všechny obrázky, bez čekání na limit', () => {
    const images = createTileImages(TODAY);
    images.startShowing(START);
    images.settle('counting', true, START + 30);
    images.settle('coloring', true, START + 70);
    expect(images.isReady(START + 70)).toBe(true);
  });

  it('obrázek, který skončil chybou, menu nezdrží', () => {
    const images = createTileImages(TODAY);
    images.startShowing(START);
    images.settle('counting', false, START + 30);
    images.settle('coloring', true, START + 70);
    expect(images.isReady(START + 70)).toBe(true);
    expect(images.faceOf('counting')).toBe('symbol');
  });

  it('když obrázek nepřijde, menu se ukáže nejpozději po 3 s a dlaždice má symbol', () => {
    const images = createTileImages(TODAY);
    images.startShowing(START);
    images.settle('coloring', true, START + 70);
    expect(images.isReady(START + TILE_IMAGE_WAIT_MS)).toBe(true);
    expect(images.faceOf('counting')).toBe('symbol');
    expect(images.faceOf('coloring')).toBe('image');
  });

  it('obrázek načtený těsně před limitem se na dlaždici ukáže', () => {
    const images = createTileImages(TODAY);
    images.startShowing(START);
    images.settle('coloring', true, START + 70);
    images.settle('counting', true, START + TILE_IMAGE_WAIT_MS - 1);
    expect(images.faceOf('counting')).toBe('image');
  });

  it('dlaždice s obrázkem načteným až po limitu ukáže symbol a zůstane u něj', () => {
    const images = createTileImages(TODAY);
    images.startShowing(START);
    images.settle('coloring', true, START + 70);
    expect(images.isReady(START + TILE_IMAGE_WAIT_MS)).toBe(true);
    expect(images.faceOf('counting')).toBe('symbol');

    images.settle('counting', true, START + TILE_IMAGE_WAIT_MS + 500);
    expect(images.faceOf('counting')).toBe('symbol');
    expect(images.isReady(START + TILE_IMAGE_WAIT_MS + 500)).toBe(true);
  });
});

describe('#122 AC7: po návratu do menu se nic nenačítá znovu', () => {
  it('druhé zobrazení menu (návrat z hry domečkem) načte 0 obrázků a menu se ukáže hned', () => {
    const images = createTileImages(TODAY);
    expect(requestCount(images, START)).toBe(2);
    images.settle('counting', true, START + 30);
    images.settle('coloring', true, START + 40);

    const back = START + 60_000;
    expect(requestCount(images, back)).toBe(0);
    expect(images.isReady(back)).toBe(true);
  });

  it('po návratu mají dlaždice stejné obrázky i symboly jako předtím', () => {
    const images = createTileImages(TODAY);
    images.startShowing(START);
    images.settle('counting', false, START + 30);
    images.settle('coloring', true, START + 40);
    const before = [images.faceOf('counting'), images.faceOf('coloring')];

    images.startShowing(START + 60_000);
    expect([images.faceOf('counting'), images.faceOf('coloring')]).toEqual(before);
    expect(before).toEqual(['symbol', 'image']);
  });

  it('ani obrázek, který se poprvé nenačetl, se při dalším zobrazení menu nenačítá znovu', () => {
    const images = createTileImages(TODAY);
    images.startShowing(START);
    images.settle('counting', false, START + 30);
    images.settle('coloring', true, START + 40);
    expect(requestCount(images, START + 60_000)).toBe(0);
    expect(requestCount(images, START + 120_000)).toBe(0);
  });
});
