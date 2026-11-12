import { describe, expect, it } from 'vitest';

import { GAMES } from '../../src/gameList';
import { KEY_REWARDS_AREA } from '../../src/shared/storage/keyRewardsStorage';

/**
 * Test k #139 AC4: klíče leží v úložišti profilu v oblasti
 * `KEY_REWARDS_AREA` vedle dat her. Kdyby se tak jmenovala hra, četla by
 * a přepisovala klíče jako svá data.
 */
describe('#139 AC4: klíče nesplynou s daty žádné hry', () => {
  it('žádná hra v seznamu her nemá označení oblasti klíčů', () => {
    expect(GAMES.length).toBeGreaterThan(0);
    for (const game of GAMES) {
      expect(game.id, game.id).not.toBe(KEY_REWARDS_AREA);
    }
  });
});
