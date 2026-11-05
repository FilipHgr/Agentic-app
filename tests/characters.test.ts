/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';

import {
  CHARACTERS,
  CHARACTER_MOODS,
  FIRST_CHARACTER,
  characterImageKey,
  characterImagePath,
  nextCharacter,
} from '../src/logic/characters';
import { MASCOT_REACTIONS, moodForReaction } from '../src/logic/mascot';

/** Obsah všech obrázků postaviček, které jsou v projektu, podle cesty v `public/`. */
const IMAGE_FILES: Record<string, string> = Object.fromEntries(
  Object.entries(
    import.meta.glob<string>('../public/characters/*/*.svg', {
      query: '?raw',
      import: 'default',
      eager: true,
    }),
  ).map(([path, content]) => [path.replace('../public/', ''), content]),
);

describe('AC1: v projektu jsou tři hlavní postavičky se všemi náladami', () => {
  it('hlavní postavičky jsou Hvězdík, Robík a Plamínek', () => {
    expect(CHARACTERS).toEqual(['hvezdik', 'robik', 'plaminek']);
  });

  it('každá postavička má obrázek pro klid, mrknutí, radost, povzbuzení a oslavu', () => {
    for (const character of CHARACTERS) {
      for (const mood of CHARACTER_MOODS) {
        expect(Object.keys(IMAGE_FILES)).toContain(characterImagePath(character, mood));
      }
    }
  });

  it('každý obrázek je platné SVG se čtvercovým plátnem', () => {
    for (const character of CHARACTERS) {
      for (const mood of CHARACTER_MOODS) {
        const content = IMAGE_FILES[characterImagePath(character, mood)] ?? '';
        expect(content.startsWith('<svg')).toBe(true);
        expect(content).toContain('viewBox="0 0 240 240"');
        expect(content.trimEnd().endsWith('</svg>')).toBe(true);
      }
    }
  });

  it('v projektu nejsou žádné obrázky postaviček navíc', () => {
    expect(Object.keys(IMAGE_FILES)).toHaveLength(CHARACTERS.length * CHARACTER_MOODS.length);
  });

  it('každý obrázek má vlastní klíč, takže se při načtení nepřepíšou', () => {
    const keys = CHARACTERS.flatMap((character) =>
      CHARACTER_MOODS.map((mood) => characterImageKey(character, mood)),
    );

    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('AC3: výraz postavičky odpovídá náladě', () => {
  it('pro každou reakci má každá postavička odpovídající obrázek', () => {
    for (const character of CHARACTERS) {
      for (const reaction of MASCOT_REACTIONS) {
        const path = characterImagePath(character, moodForReaction(reaction));
        expect(Object.keys(IMAGE_FILES)).toContain(path);
      }
    }
  });
});

describe('AC4: po každé oslavě se postavičky vystřídají', () => {
  it('po Hvězdíkovi přijde Robík, po Robíkovi Plamínek a pak znovu Hvězdík', () => {
    expect(nextCharacter('hvezdik')).toBe('robik');
    expect(nextCharacter('robik')).toBe('plaminek');
    expect(nextCharacter('plaminek')).toBe('hvezdik');
  });

  it('po třech oslavách je zpátky první postavička', () => {
    let character = FIRST_CHARACTER;
    for (let celebration = 0; celebration < CHARACTERS.length; celebration += 1) {
      character = nextCharacter(character);
    }

    expect(character).toBe(FIRST_CHARACTER);
  });

  it('každá postavička se v jednom kole střídání objeví právě jednou', () => {
    const seen = [FIRST_CHARACTER];
    while (seen.length < CHARACTERS.length) {
      seen.push(nextCharacter(seen[seen.length - 1] ?? FIRST_CHARACTER));
    }

    expect(new Set(seen).size).toBe(CHARACTERS.length);
  });
});

describe('AC5: hra začíná Hvězdíkem', () => {
  it('první postavička je Hvězdík', () => {
    expect(FIRST_CHARACTER).toBe('hvezdik');
  });
});
