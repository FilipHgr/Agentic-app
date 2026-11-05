/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';

import { GAMES, GAME_METAS } from '../../src/gameList';
import { GAME_ACCESS_LEVELS } from '../../src/shared/logic/gameAccess';
import { gameEntry } from '../../src/shared/logic/gameRegistry';
import { GAME_CATEGORIES, findGame } from '../../src/shared/logic/gameRegistry';
import { ALL_CATEGORY } from '../../src/menu/logic/menuCategories';
import { menuText } from '../../src/menu/logic/menuTexts';
import { LANGUAGES } from '../../src/shared/texts/languages';
import { countingTexts } from '../../src/games/counting/texts/countingTexts';

/**
 * Testy k #67, poznámka k architektuře a AC3: registr her a seznam
 * kategorií. Ve sdílené části je tvar záznamu, seznam kategorií v pevném
 * pořadí a vyhledání hry podle id (`src/shared/logic/gameRegistry.ts`),
 * samotný seznam her leží vedle vstupu stránky (`src/gameList.ts`), protože
 * sdílená část nesmí importovat hry. Texty názvů se hledají podle klíče
 * (`menuText`), menu kvůli názvu hru nestahuje.
 *
 * Funkce `load` se tu nevolá: stáhla by celou hru i s Phaserem.
 */

/** Složky her podle vstupů `src/games/<hra>/index.ts`. */
const GAME_FOLDERS: string[] = Object.keys(import.meta.glob('../../src/games/*/index.ts'))
  .map((path) => /\/games\/([^/]+)\/index\.ts$/.exec(path)?.[1])
  .filter((folder): folder is string => folder !== undefined)
  .sort();

describe('#67 registr her: Počítání je v seznamu her', () => {
  it('seznam her obsahuje Počítání s id „counting“', () => {
    expect(GAMES.map((game) => game.id)).toContain('counting');
  });

  it('Počítání má na dlaždici symbol „2+3“', () => {
    expect(findGame(GAMES, 'counting')?.symbol).toBe('2+3');
  });

  it('Počítání má klíč názvu games.counting.title, ne český text', () => {
    expect(findGame(GAMES, 'counting')?.titleKey).toBe('games.counting.title');
  });

  it('dlaždice Počítání ukáže česky název hry z textů hry', () => {
    expect(menuText('games.counting.title', 'cs')).toBe('Počítání');
    expect(menuText('games.counting.title', 'cs')).toBe(countingTexts('cs').title);
  });

  it('každá hra se dá stáhnout svou funkcí', () => {
    for (const game of GAMES) {
      expect(typeof game.load, game.id).toBe('function');
    }
  });
});

describe('#67 registr her: id her', () => {
  it('id her jsou jedinečná', () => {
    const ids = GAMES.map((game) => game.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('id her odpovídají složkám v src/games/, žádná hra nechybí ani nepřebývá', () => {
    expect(GAME_FOLDERS.length).toBeGreaterThan(0);
    expect(GAMES.map((game) => game.id).sort()).toEqual(GAME_FOLDERS);
  });

  it('id každé hry jsou jen malá písmena bez diakritiky', () => {
    for (const game of GAMES) {
      expect(game.id, game.id).toMatch(/^[a-z]+$/);
    }
  });

  it('klíč názvu každé hry je games.<id>.title', () => {
    for (const game of GAMES) {
      expect(game.titleKey).toBe(`games.${game.id}.title`);
    }
  });

  it('každá hra má na dlaždici neprázdný symbol', () => {
    for (const game of GAMES) {
      expect(game.symbol.trim().length, game.id).toBeGreaterThan(0);
    }
  });
});

describe('#67 registr her: vyhledání podle id nic neshodí', () => {
  it('Počítání se najde podle id', () => {
    expect(findGame(GAMES, 'counting')?.id).toBe('counting');
  });

  it.each([
    ['neznámé id', 'xx'],
    ['prázdné id', ''],
    ['id jen z mezer', '   '],
    ['id velkými písmeny', 'COUNTING'],
    ['id s mezerou navíc', ' counting'],
  ])('%s nic nenajde a nespadne', (_name, id) => {
    expect(() => findGame(GAMES, id)).not.toThrow();
    expect(findGame(GAMES, id)).toBeUndefined();
  });

  it('chybějící id (null, undefined) nic nenajde a nespadne', () => {
    expect(findGame(GAMES, null)).toBeUndefined();
    expect(findGame(GAMES, undefined)).toBeUndefined();
  });

  it('v prázdném seznamu her se nic nenajde', () => {
    expect(findGame([], 'counting')).toBeUndefined();
  });
});

describe('#67 AC3: každá hra patří právě do jedné kategorie ze seznamu', () => {
  const categoryIds = GAME_CATEGORIES.map((category) => category.id);

  it('seznam kategorií ve sdílené části není prázdný a id kategorií jsou jedinečná', () => {
    expect(categoryIds.length).toBeGreaterThan(0);
    expect(new Set(categoryIds).size).toBe(categoryIds.length);
  });

  it('každá hra má kategorii ze seznamu kategorií (platí i pro hru přidanou později)', () => {
    for (const game of GAMES) {
      expect(categoryIds, game.id).toContain(game.categoryId);
    }
  });

  it('„Vše“ není kategorie ze seznamu, žádná hra do ní přímo nepatří', () => {
    expect(categoryIds).not.toContain(ALL_CATEGORY.id);
    for (const game of GAMES) {
      expect(game.categoryId).not.toBe(ALL_CATEGORY.id);
    }
  });

  it('Počítání je v kategorii „Sčítání a odčítání“', () => {
    const counting = findGame(GAMES, 'counting');
    const category = GAME_CATEGORIES.find((candidate) => candidate.id === counting?.categoryId);
    expect(category).toBeDefined();
    expect(menuText(category?.titleKey ?? '', 'cs')).toBe('Sčítání a odčítání');
  });

  it('první kategorie v menu se česky jmenuje „Vše“', () => {
    expect(menuText(ALL_CATEGORY.titleKey, 'cs')).toBe('Vše');
  });
});

describe('#67: názvy her a kategorií jsou v textech každého jazyka', () => {
  for (const language of LANGUAGES) {
    it(`jazyk ${language}: každá hra má neprázdný název`, () => {
      for (const game of GAMES) {
        expect(menuText(game.titleKey, language)?.trim(), game.id).toBeTruthy();
      }
    });

    it(`jazyk ${language}: každá kategorie i „Vše“ má neprázdný název`, () => {
      for (const category of [ALL_CATEGORY, ...GAME_CATEGORIES]) {
        expect(menuText(category.titleKey, language)?.trim(), category.id).toBeTruthy();
      }
    });
  }

  it('neznámý klíč nic nenajde a nespadne', () => {
    expect(() => menuText('games.xx.title', 'cs')).not.toThrow();
    expect(menuText('games.xx.title', 'cs')).toBeUndefined();
    expect(menuText('', 'cs')).toBeUndefined();
  });
});

describe('#74 AC1: každá hra je buď zdarma, nebo v předplatném, a Počítání je zdarma', () => {
  /** Úroveň hry tak, jak ji registr opravdu drží (i kdyby jí typ chyběl). */
  function accessOf(game: object): unknown {
    return (game as { access?: unknown }).access;
  }

  it('každá hra v registru má právě jednu úroveň: „zdarma“, nebo „v předplatném“ (i hra přidaná později)', () => {
    expect(GAMES.length).toBeGreaterThan(0);
    for (const game of GAMES) {
      expect(GAME_ACCESS_LEVELS, game.id).toContain(accessOf(game));
    }
  });

  it('úroveň má i údaj každé hry pro menu (meta.ts) a záznam registru ji přebírá beze změny', () => {
    expect(GAME_METAS.length).toBe(GAMES.length);
    for (const meta of GAME_METAS) {
      expect(GAME_ACCESS_LEVELS, meta.id).toContain(accessOf(meta));
      expect(findGame(GAMES, meta.id)?.access, meta.id).toBe(meta.access);
    }
  });

  it('kontrola úrovně selže u hry bez úrovně i u hry s jinou hodnotou', () => {
    const load = (): Promise<unknown> => Promise.resolve({});
    const base = {
      id: 'zkouska',
      categoryId: 'addingSubtracting',
      symbol: '?',
      titles: { cs: 'Zkouška' },
    };
    const withoutAccess = gameEntry(base as never, load);
    const withOtherAccess = gameEntry({ ...base, access: 'zdarma' } as never, load);
    expect(GAME_ACCESS_LEVELS).not.toContain(accessOf(withoutAccess));
    expect(GAME_ACCESS_LEVELS).not.toContain(accessOf(withOtherAccess));
  });

  it('Počítání je „zdarma“', () => {
    expect(findGame(GAMES, 'counting')?.access).toBe('free');
  });
});
