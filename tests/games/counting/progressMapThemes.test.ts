import { describe, expect, it } from 'vitest';

import { MAP_THEMES } from '../../../src/games/counting/logic/progressMap';
import { PROGRESS_MAP_BACKGROUNDS } from '../../../src/games/counting/logic/theme';

/**
 * Testy k #133 AC6: dokud nejsou hotové obrázky map, má každá z 5 map
 * zástupný vzhled s vlastní barvou pozadí, aby dítě poznalo, že přišla
 * jiná mapa.
 *
 * Navržené rozhraní `src/games/counting/logic/theme.ts`:
 * `PROGRESS_MAP_BACKGROUNDS: Readonly<Record<MapThemeId, string>>` barva
 * pozadí mapy jako `#RRGGBB` (scéna ji kreslí místo dnešního
 * `PROGRESS_MAP_STYLE.background`).
 *
 * Ručně se kontroluje: kontrast značky a míst vůči pozadí každé mapy.
 */

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

describe('#133 AC6: každá z 5 map má jinou barvu pozadí', () => {
  it('každá mapa má barvu pozadí', () => {
    for (const theme of MAP_THEMES) {
      expect(PROGRESS_MAP_BACKGROUNDS[theme], theme).toMatch(HEX_COLOR);
    }
  });

  it('barvy pozadí všech 5 map jsou navzájem různé', () => {
    const colors = MAP_THEMES.map((theme) => PROGRESS_MAP_BACKGROUNDS[theme].toUpperCase());
    expect(colors).toHaveLength(5);
    expect(new Set(colors).size, colors.join(', ')).toBe(5);
  });

  it('sousední mapy v pořadí (i vesmír a znovu ostrov) mají jiné pozadí', () => {
    MAP_THEMES.forEach((theme, index) => {
      const next = MAP_THEMES[(index + 1) % MAP_THEMES.length] ?? theme;
      expect(PROGRESS_MAP_BACKGROUNDS[theme].toUpperCase(), `${theme} → ${next}`).not.toBe(
        PROGRESS_MAP_BACKGROUNDS[next].toUpperCase(),
      );
    });
  });
});
