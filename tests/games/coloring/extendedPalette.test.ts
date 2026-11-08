import { describe, expect, it } from 'vitest';

import {
  COLOR_PICK_TONES,
  PALETTE,
  initialPalette,
  markedColors,
  tapColor,
} from '../../../src/games/coloring/logic/palette';
import { PICTURE_STYLE } from '../../../src/games/coloring/logic/theme';
import type { ToolId } from '../../../src/games/coloring/logic/toolPanel';
import { PROFILE_COLORS } from '../../../src/shared/logic/profiles';
import { openProfiles } from '../../../src/shared/storage/profileStorage';
import type { Tone } from '../../../src/shared/audio/tonePlayer';
import { DeviceStorage } from '../../shared/profileFixtures';
import { choose, drawWith } from './drawingToolHelpers';
import {
  COLOR_COUNT,
  GRAY,
  LIGHT_BLUE,
  NEW_COLORS,
  NEW_COLOR_IDS,
  NEW_COLOR_NAMES,
  ORIGINAL_COLOR_IDS,
  PINK,
  SKIN,
  usedColors,
} from './extendedPaletteHelpers';
import { RAINBOW } from './rainbowHelpers';
import { at } from './strokeHelpers';
import {
  RecordingStorage,
  enterColoring,
  openOn,
  paint,
  paintedPixels,
  pixelsOf,
  twoHalves,
} from './savedPictureHelpers';

/**
 * Testy k #100 AC1 (nové barvy), AC2 (všechny nástroje) a AC5 druhá část
 * (nová barva se pamatuje podle profilu). Schválená je varianta A: za
 * původních 8 barev z #88 přibude růžová, tělová, šedá a světle modrá,
 * bílá ne (prázdné místo omalovánky je bílé, tah by nebyl vidět).
 *
 * Odstíny nových barev se netestují (jako u #88 se doladí se vzhledem),
 * jen to, že jsou platné, navzájem různé a žádná není bílá ani barva
 * pozadí omalovánky. Že je každá barva na první pohled odlišná od sousedních
 * a od bílého pozadí, je ruční kontrola (#100 AC6).
 *
 * Nástroje, které vybranou barvu používají, jsou štětec, fix, pastelka
 * a razítkový fix. Guma barvu nemá a duha používá jen svých 6 barev (#97).
 *
 * Navržené rozhraní (`src/games/coloring/logic/palette.ts`):
 * - `PaletteColorId` rozšířený o `'pink' | 'skin' | 'gray' | 'lightBlue'`,
 * - `PALETTE` má 12 barev: původních 8 beze změny pořadí, pak nové 4
 *   v pořadí ze zadání (indexy 8 až 11),
 * - `RAINBOW_COLORS` beze změny (6 barev duhy).
 */

/** Kdy dozní poslední tón, v sekundách od ťuknutí. */
function endOf(tones: readonly Tone[]): number {
  return Math.max(...tones.map((tone) => tone.startSeconds + tone.durationSeconds));
}

function nameOf(color: number): string {
  return NEW_COLOR_NAMES[color] ?? `barva ${color}`;
}

/** Nástroje, které malují barvou vybranou v paletě. */
const COLOR_TOOLS: readonly ToolId[] = ['brush', 'marker', 'crayon', 'stamp'];

const TOOL_NAMES: Readonly<Record<ToolId, string>> = {
  brush: 'štětec',
  eraser: 'guma',
  marker: 'fix',
  crayon: 'pastelka',
  rainbow: 'duha',
  stamp: 'razítkový fix',
  dots: 'puntíkový fix',
  stripes: 'proužkový fix',
  glitter: 'třpytky',
};

/** Šikmý tah v levé oblasti zkušebního obrázku `twoHalves()`. */
const STROKE = [at(30, 40), at(75, 100), at(120, 160)];

describe('#100 AC1: v panelu je 12 barev ve schválené variantě', () => {
  it('paleta má 12 barev: původních 8 na stejném místě a ve stejném pořadí, 4 nové za nimi', () => {
    expect(PALETTE.map((color) => color.id)).toEqual([...ORIGINAL_COLOR_IDS, ...NEW_COLOR_IDS]);
  });

  it('nové barvy jsou růžová, tělová, šedá a světle modrá na místech 9 až 12', () => {
    NEW_COLORS.forEach((color, order) => {
      expect(PALETTE[color]?.id, nameOf(color)).toBe(NEW_COLOR_IDS[order]);
    });
  });

  it('každá z 12 barev má platný odstín a žádné dvě nejsou stejné', () => {
    expect(PALETTE.length).toBe(COLOR_COUNT);
    for (const color of PALETTE) {
      expect(color.hex, color.id).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
    const hexes = PALETTE.map((color) => color.hex.toUpperCase());
    expect(new Set(hexes).size).toBe(COLOR_COUNT);
  });

  it('v paletě není bílá ani barva pozadí omalovánky, tah by nebyl vidět', () => {
    expect(PALETTE.length).toBe(COLOR_COUNT);
    const background = PICTURE_STYLE.background.toUpperCase();
    for (const color of PALETTE) {
      expect(color.hex.toUpperCase(), `${color.id} není bílá`).not.toBe('#FFFFFF');
      expect(color.hex.toUpperCase(), `${color.id} není pozadí`).not.toBe(background);
    }
  });
});

describe('#100 AC1: nová barva se vybírá stejně jako ostatní', () => {
  it.each(NEW_COLORS)('ťuknutí na novou barvu %i ji vybere a označená je právě ona', (color) => {
    const { state, tones } = tapColor(initialPalette(), color);

    expect(state.selected, nameOf(color)).toBe(color);
    const marks = markedColors(state);
    expect(marks.length, nameOf(color)).toBe(COLOR_COUNT);
    expect(marks.filter(Boolean).length, nameOf(color)).toBe(1);
    expect(marks[color], nameOf(color)).toBe(true);
    expect(tones, nameOf(color)).toEqual(COLOR_PICK_TONES);
  });

  it('po každém ťuknutí na starou i novou barvu je označená právě jedna, ta ťuknutá', () => {
    let state = initialPalette();
    for (const color of [PINK, 3, LIGHT_BLUE, SKIN, 7, GRAY, GRAY, 0, LIGHT_BLUE]) {
      state = tapColor(state, color).state;
      const marks = markedColors(state);
      expect(marks.filter(Boolean).length, `po ťuknutí na ${nameOf(color)}`).toBe(1);
      expect(marks[color], `po ťuknutí na ${nameOf(color)}`).toBe(true);
    }
  });

  it('ve hře ťuknutí na novou barvu zahraje tón kratší než 1 s a barvu vybere', () => {
    for (const color of NEW_COLORS) {
      const game = openOn(new RecordingStorage(), twoHalves());

      const tones = game.tapColor(color);

      expect(tones.length, nameOf(color)).toBeGreaterThan(0);
      expect(endOf(tones), nameOf(color)).toBeLessThan(1);
      expect(game.palette().selected, nameOf(color)).toBe(color);
      expect(markedColors(game.palette()).filter(Boolean).length, nameOf(color)).toBe(1);
    }
  });

  it('úchyt po výběru nové barvy ukazuje štětec v nové barvě', () => {
    for (const color of NEW_COLORS) {
      const game = openOn(new RecordingStorage(), twoHalves());
      game.tapColor(color);
      expect(game.handleView().color, nameOf(color)).toBe(color);
    }
  });

  it('nová barva se objeví mezi nedávnými barvami a jde z pruhu znovu vybrat', () => {
    const game = openOn(new RecordingStorage(), twoHalves());
    game.tapColor(PINK);
    game.tapColor(GRAY);
    game.tapColor(LIGHT_BLUE);
    expect(game.recentColors(), 'nedávné po výběru tří nových barev').toEqual([GRAY, PINK]);

    const tap = game.tapRecentColor(1);

    expect(tap.kind).toBe('picked');
    expect(game.palette().selected, 'z pruhu se vybrala růžová').toBe(PINK);
    expect(game.recentColors()).toEqual([LIGHT_BLUE, GRAY]);
  });

  it('index za 12 barvami barvu nezmění, nezahraje tón a nic neshodí', () => {
    const before = tapColor(initialPalette(), SKIN).state;
    for (const index of [COLOR_COUNT, COLOR_COUNT + 1, 255]) {
      expect(() => tapColor(before, index), `index ${index}`).not.toThrow();
      const { state, tones } = tapColor(before, index);
      expect(state.selected, `index ${index}`).toBe(SKIN);
      expect(tones, `index ${index}`).toEqual([]);
    }
  });
});

describe('#100 AC2: nové barvy fungují se všemi nástroji, které vybranou barvu používají', () => {
  for (const tool of COLOR_TOOLS) {
    it(`${TOOL_NAMES[tool]} maluje každou novou barvou a jen jí`, () => {
      for (const color of NEW_COLORS) {
        const regions = twoHalves();
        const game = openOn(new RecordingStorage(), regions);

        drawWith(game, tool, color, STROKE);

        const what = `${TOOL_NAMES[tool]}, ${nameOf(color)}`;
        expect(paintedPixels(game, regions), `${what}: tah něco namaloval`).toBeGreaterThan(0);
        expect(usedColors(pixelsOf(game, regions)), `${what}: jen vybraná barva`).toEqual([color]);
      }
    });
  }

  it('výběr nové barvy po gumě maluje naposledy vybraným nástrojem v nové barvě', () => {
    for (const tool of COLOR_TOOLS) {
      const regions = twoHalves();
      const game = openOn(new RecordingStorage(), regions);
      choose(game, tool);
      choose(game, 'eraser');

      game.tapColor(GRAY);
      paint(game, STROKE);

      expect(game.selectedTool(), TOOL_NAMES[tool]).toBe(tool);
      expect(usedColors(pixelsOf(game, regions)), TOOL_NAMES[tool]).toEqual([GRAY]);
    }
  });

  it('guma smaže tah v nové barvě', () => {
    for (const color of NEW_COLORS) {
      const regions = twoHalves();
      const game = openOn(new RecordingStorage(), regions);
      drawWith(game, 'brush', color, STROKE);

      choose(game, 'eraser');
      paint(game, STROKE);

      for (const point of STROKE) {
        expect(
          game.colorAt(point.x, point.y),
          `${nameOf(color)} v bodě ${point.x}, ${point.y}`,
        ).toBe(null);
      }
    }
  });

  it('duha s vybranou novou barvou maluje dál jen svými 6 barvami', () => {
    for (const color of NEW_COLORS) {
      const regions = twoHalves();
      const game = openOn(new RecordingStorage(), regions);
      game.tapColor(color);
      choose(game, 'rainbow');

      // Dráha 440 px, delší než celá duha (6 úseků po 2 W = 120 px).
      paint(game, [at(10, 10), at(140, 10), at(140, 190), at(10, 190)]);

      const used = usedColors(pixelsOf(game, regions));
      expect(used, `${nameOf(color)}: všech 6 barev duhy a nic jiného`).toEqual(
        [...RAINBOW].sort((first, second) => first - second),
      );
      expect(game.handleView().color, `${nameOf(color)}: úchyt duhy je bez barvy`).toBe(null);
    }
  });

  it('výběr nové barvy při duze přepne na štětec a maluje novou barvou', () => {
    const regions = twoHalves();
    const game = openOn(new RecordingStorage(), regions);
    choose(game, 'rainbow');

    game.tapColor(SKIN);
    paint(game, STROKE);

    expect(game.selectedTool()).toBe('brush');
    expect(usedColors(pixelsOf(game, regions))).toEqual([SKIN]);
  });
});

describe('#100 AC5: vybraná nová barva se pamatuje podle profilu', () => {
  it('po návratu do hry je vybraná naposledy vybraná nová barva, i bez tahu', () => {
    for (const color of NEW_COLORS) {
      const storage = new RecordingStorage();
      const game = openOn(storage, twoHalves());
      game.tapColor(color);
      game.suspend();

      expect(openOn(storage, twoHalves()).palette().selected, nameOf(color)).toBe(color);
    }
  });

  it('nová barva se pamatuje i po obnovení stránky a jiný profil má svou barvu', () => {
    const storage = new DeviceStorage();
    const store = openProfiles(storage);
    const regions = twoHalves();
    const first = store.activeProfile();
    const second = store.createProfile({ nickname: 'BETA', color: PROFILE_COLORS[1] });

    const firstGame = enterColoring(store, regions);
    firstGame.tapColor(LIGHT_BLUE);
    firstGame.suspend();

    store.selectProfile(second.id);
    const secondGame = enterColoring(store, regions);
    expect(secondGame.palette().selected, 'nový profil začíná první barvou').toBe(0);
    secondGame.tapColor(PINK);
    secondGame.suspend();

    const reloaded = openProfiles(storage);
    reloaded.selectProfile(first.id);
    expect(enterColoring(reloaded, regions).palette().selected, 'první profil').toBe(LIGHT_BLUE);
    reloaded.selectProfile(second.id);
    expect(enterColoring(reloaded, regions).palette().selected, 'druhý profil').toBe(PINK);
  });

  it('nové barvy mezi nedávnými barvami se pamatují po obnovení stránky', () => {
    const storage = new DeviceStorage();
    const regions = twoHalves();
    const game = enterColoring(openProfiles(storage), regions);
    game.tapColor(SKIN);
    game.tapColor(GRAY);
    game.tapColor(PINK);
    game.suspend();

    const again = enterColoring(openProfiles(storage), regions);

    expect(again.palette().selected).toBe(PINK);
    expect(again.recentColors()).toEqual([GRAY, SKIN]);
  });
});
