import { describe, expect, it } from 'vitest';

import { isGameHost } from '../../src/shared/logic/gameHost';
import type { GameHost, PageBackdrop } from '../../src/shared/logic/gameHost';
import { startGameSession } from '../../src/shared/ui/gameSession';

/**
 * Testy k #134 AC1 (sdílená část): mapa postupu má obrázek přes celé okno,
 * plátno hry ale leží jen v herní ploše. Hra proto stránce řekne, jaké
 * pozadí má být kolem plátna (`GameHost.setPageBackdrop`), a po odchodu
 * z hry má menu zase výchozí pozadí. Stránka je falešná, bez DOM.
 */

const MAP_BACKDROP: PageBackdrop = { color: '#FBEFCF', imageUrl: '/assets/island-landscape.webp' };

function startedGame(): { host: GameHost; leave: () => void; backdrops: (PageBackdrop | null)[] } {
  const backdrops: (PageBackdrop | null)[] = [];
  const started: { host: GameHost | null } = { host: null };
  const session = startGameSession({
    homeButton: null,
    pageBackdrop: (backdrop) => backdrops.push(backdrop),
    startScenes: (running) => {
      started.host = running.host;
      return () => undefined;
    },
    onLeft: () => undefined,
  });
  if (started.host === null) {
    throw new Error('scény nedostaly hostitele hry');
  }
  return { host: started.host, leave: () => session.leave(), backdrops };
}

describe('#134 AC1: kolem plátna je při mapě stejné pozadí a po hře zase výchozí', () => {
  it('pozadí, které hra ohlásí, dostane stránka beze změny', () => {
    const game = startedGame();
    game.host.setPageBackdrop?.(MAP_BACKDROP);
    game.host.setPageBackdrop?.(null);
    expect(game.backdrops).toEqual([MAP_BACKDROP, null]);
  });

  it('po odchodu z hry má stránka výchozí pozadí, i když hra mapu nezavřela', () => {
    const game = startedGame();
    game.host.setPageBackdrop?.(MAP_BACKDROP);
    game.leave();
    expect(game.backdrops.at(-1)).toBeNull();
  });

  it('hra po odchodu už pozadí stránky nezmění', () => {
    const game = startedGame();
    game.leave();
    game.host.setPageBackdrop?.(MAP_BACKDROP);
    expect(game.backdrops).toEqual([null]);
  });

  it('hostitel s nastavením pozadí je platný hostitel, s nefunkcí ne', () => {
    const game = startedGame();
    expect(isGameHost(game.host)).toBe(true);
    expect(isGameHost({ ...game.host, setPageBackdrop: 'modrá' })).toBe(false);
  });
});
