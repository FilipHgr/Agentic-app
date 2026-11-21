import { describe, expect, it } from 'vitest';

import type { MenuBox, MenuLayout } from '../../src/menu/logic/menuLayout';
import {
  MASCOT_FRAME_SIZE,
  MASCOT_MAX_HEIGHT_CSS_PX,
  MASCOT_MIN_HEIGHT_CSS_PX,
} from '../../src/shared/logic/mascot';
import {
  boundsOf,
  gapBetween,
  heightOf,
  isInside,
  overlaps,
  widthOf,
} from '../shared/viewportFixtures';
import type { TestWindow } from '../shared/viewportFixtures';
import {
  FEW_GAME_COUNTS,
  MANY_GAMES_COUNT,
  fewGamesLayout,
  manyGamesLayout,
} from './manyGamesFixtures';
import { FEW_GAMES_WINDOWS, fewGamesContents, todayLayout } from './menuLayoutScenes';

/**
 * Testy k #168 AC1 a AC2: kde v menu stojí panda.
 *
 * Rozhraní: `MenuLayout.mascot` z `menuLayoutFor` je obdélník pandy (snímek
 * i ťukací plocha) v CSS px okna, nebo `null`, když panda není vidět.
 *
 * AC1 pravidlo: panda je ve volné části posouvané plochy her (viditelná
 * plocha `gridScroll.viewport`, od jejího okraje 4 px) pod blokem dlaždic všech her („Vše“) nebo
 * vedle něj, jen když se mřížka neposouvá. Od dlaždic má aspoň 8 px a je
 * vysoká aspoň 96 px (nejvýš 180 px jako v Počítání). Blok „Vše“ se
 * bere proto, že po výběru jiné kategorie se menší blok jen znovu vystředí
 * (#156) a vždy leží uvnitř bloku „Vše“, takže panda nikam neuhýbá.
 * Když takové místo není, panda není vidět.
 */

const ROUNDING = 0.01;
/** Odstup pandy od dlaždic (AC1). */
const TILE_GAP = 8;
/**
 * Odstup pandy od okraje viditelné plochy mřížky. Viditelná plocha je od
 * lišty a kategorií 4 px, panda je tak od nich 8 px jako ostatní ťukací
 * plochy (#82).
 */
const VIEWPORT_INSET = 4;
/** Ťukací plocha pro dětský prst (AC4, CLAUDE.md). */
const MIN_TAP = 64;
const ASPECT = MASCOT_FRAME_SIZE.width / MASCOT_FRAME_SIZE.height;

/**
 * AC1 tabulka: kde je dnes (Počítání a Omalovánky) panda vidět. Na iPadu,
 * z plochy, ve zmenšeném zobrazení, v úzkém iPadu (Split View) a v okně
 * 499×932 ano, na telefonech ne (místo 8–71 px).
 */
const TODAY_SHOWN: Readonly<Record<string, boolean>> = {
  'iPad 1180×820': true,
  'iPad 1180×760': true,
  'zmenšené zobrazení 820×1180': true,
  '744×296 nejmenší telefon': false,
  '800×300 Samsung s Chromem': false,
  '844×340 iPhone se Safari': false,
  '932×430 iPhone Pro Max': false,
  '932×499 těsně pod hranicí': false,
  '932×499 těsně pod hranicí s výřezem': false,
  '390×844 iPhone 13–15 (výřez 47, lišta 34)': false,
  '390×664 iPhone v Safari s lištou': false,
  '360×780 Samsung s Chromem': false,
  '375×667 iPhone SE': false,
  '430×932 iPhone Pro Max (výřez 59, lišta 34)': false,
  '360×620 nejmenší telefon na výšku': false,
  '499×932 těsně pod hranicí šířky': true,
  '375×1180 úzký iPad (Split View)': true,
  'iPad na šířku z plochy (stavový řádek 24, lišta 20)': true,
  'iPhone 430×932 na výšku z plochy (výřez 59, lišta 34)': false,
  'iPhone 393×852 na výšku z plochy (výřez 59, lišta 34)': false,
  'iPhone 932×430 na šířku z plochy (výřez 59, lišta 21)': false,
};

/**
 * Volná místa pod blokem dlaždic a vedle něj (bez 8 px od dlaždic) ve
 * viditelné ploše mřížky. Vedle bloku jen v jeho výšce.
 */
function freeSpots(gridViewport: MenuBox, block: MenuBox): MenuBox[] {
  const viewport = insetOf(gridViewport);
  return [
    { ...viewport, top: block.bottom + TILE_GAP },
    { ...viewport, right: block.left - TILE_GAP, top: block.top, bottom: block.bottom },
    { ...viewport, left: block.right + TILE_GAP, top: block.top, bottom: block.bottom },
  ];
}

function insetOf(box: MenuBox): MenuBox {
  return {
    left: box.left + VIEWPORT_INSET,
    right: box.right - VIEWPORT_INSET,
    top: box.top + VIEWPORT_INSET,
    bottom: box.bottom - VIEWPORT_INSET,
  };
}

/** Nejvyšší panda (s poměrem stran snímku), která by se do místa vešla. */
function tallestPandaIn(spot: MenuBox): number {
  return Math.max(0, Math.min(heightOf(spot), widthOf(spot) / ASPECT));
}

interface PlaceCase {
  readonly label: string;
  readonly layout: MenuLayout;
  /** Dlaždice všech her („Vše“) ve stejném okně. */
  readonly allTiles: readonly MenuBox[];
}

/** Případy: okna z #156 × 1 až 12 her × „Vše“ i vybraná kategorie, a 40 her. */
function placeCases(windows: readonly TestWindow[] = FEW_GAMES_WINDOWS): PlaceCase[] {
  return windows.flatMap((window) => [
    ...FEW_GAME_COUNTS.flatMap((gameCount) =>
      fewGamesContents(gameCount).map(({ name, selectedCount }) => ({
        label: `${window.name}, ${name}`,
        layout: fewGamesLayout(window, gameCount, selectedCount),
        allTiles: fewGamesLayout(window, gameCount).tiles,
      })),
    ),
    {
      label: `${window.name}, ${MANY_GAMES_COUNT} her (mřížka se posouvá)`,
      layout: manyGamesLayout(window),
      allTiles: manyGamesLayout(window).tiles,
    },
  ]);
}

/** Porušení pravidla AC1 u viditelné pandy jako věty. */
function shownPandaProblems(item: PlaceCase, panda: MenuBox): string[] {
  const { layout, allTiles } = item;
  const problems: string[] = [];
  if (layout.gridScroll.maxOffset > 0) {
    problems.push('panda je vidět, i když se mřížka posouvá');
  }
  if (heightOf(panda) < MASCOT_MIN_HEIGHT_CSS_PX - ROUNDING) {
    problems.push(`panda je vysoká jen ${heightOf(panda)} px`);
  }
  if (heightOf(panda) > MASCOT_MAX_HEIGHT_CSS_PX + ROUNDING) {
    problems.push(`panda je vysoká ${heightOf(panda)} px, víc než 180 px`);
  }
  if (Math.abs(widthOf(panda) - heightOf(panda) * ASPECT) > ROUNDING) {
    problems.push('panda nemá poměr stran snímku');
  }
  if (!isInside(panda, insetOf(layout.gridScroll.viewport))) {
    problems.push('panda není celá ve viditelné ploše mřížky (4 px od okraje)');
  }
  for (const [index, tile] of [...allTiles, ...layout.tiles].entries()) {
    if (overlaps(panda, tile) || gapBetween(panda, tile) < TILE_GAP - ROUNDING) {
      problems.push(`panda je blíž než 8 px k dlaždici ${index + 1}`);
    }
  }
  const block = boundsOf(allTiles);
  const beside = panda.right <= block.left || panda.left >= block.right;
  if (!beside && panda.top < block.bottom) {
    problems.push('panda není pod blokem dlaždic ani vedle něj');
  }
  return problems;
}

/** Porušení pravidla AC1 u schované pandy: nikde nesmí být místo aspoň 96 px. */
function hiddenPandaProblems(item: PlaceCase): string[] {
  const { layout, allTiles } = item;
  if (layout.gridScroll.maxOffset > 0 || allTiles.length === 0) {
    return [];
  }
  const block = boundsOf(allTiles);
  return freeSpots(layout.gridScroll.viewport, block)
    .map(tallestPandaIn)
    .filter((height) => height >= MASCOT_MIN_HEIGHT_CSS_PX)
    .map((height) => `panda není vidět, i když se vejde ${height.toFixed(1)} px vysoká`);
}

describe('#168 AC1: panda stojí ve volném místě vedle dlaždic, nebo není vidět', () => {
  it('ve všech oknech a počtech her je panda jen ve volném místě aspoň 96 px a 8 px od dlaždic', () => {
    for (const item of placeCases()) {
      const panda = item.layout.mascot;
      const problems = panda === null ? hiddenPandaProblems(item) : shownPandaProblems(item, panda);
      expect(problems, item.label).toEqual([]);
    }
  });

  it('s mřížkou, která se posouvá (40 her), panda není vidět v žádném okně', () => {
    for (const window of FEW_GAMES_WINDOWS) {
      expect(manyGamesLayout(window).mascot, window.name).toBeNull();
      expect(manyGamesLayout(window, 1).mascot, `${window.name}, vybraná 1 hra`).toBeNull();
    }
  });

  it('po výběru jiné kategorie panda zůstane na stejném místě', () => {
    for (const window of FEW_GAMES_WINDOWS) {
      for (const gameCount of FEW_GAME_COUNTS) {
        const all = fewGamesLayout(window, gameCount).mascot;
        const one = fewGamesLayout(window, gameCount, 1).mascot;
        expect(one, `${window.name}, ${gameCount} her`).toEqual(all);
      }
    }
  });

  it('dnešní menu: panda je vidět na iPadu, z plochy, 820×1180, 375×1180 a 499×932, na telefonech ne', () => {
    expect(Object.keys(TODAY_SHOWN).sort()).toEqual(
      FEW_GAMES_WINDOWS.map((window) => window.name).sort(),
    );
    for (const window of FEW_GAMES_WINDOWS) {
      const panda = todayLayout(window).mascot;
      expect(panda !== null, window.name).toBe(TODAY_SHOWN[window.name]);
    }
  });

  it('ťukací plocha viditelné pandy má aspoň 64 × 64 px (AC4)', () => {
    for (const item of placeCases()) {
      const panda = item.layout.mascot;
      if (panda !== null) {
        expect(Math.min(widthOf(panda), heightOf(panda)), item.label).toBeGreaterThanOrEqual(
          MIN_TAP,
        );
      }
    }
  });
});

type Row = readonly [number, number, number, number];

/**
 * Dnešní rozložení menu před #168, spočítané jednorázově z `menuLayoutFor`
 * na commitu 289782c (zaokrouhleno na desetiny px): dlaždice, ťukací plochy
 * kategorií (na telefonu na výšku tlačítko výběru kategorie) a lišta
 * (profil, vyhrazená místa, jazyk) jako [vlevo, nahoře, vpravo, dole].
 */
interface TodayRows {
  readonly tiles: readonly Row[];
  readonly categories: readonly Row[];
  readonly bar: readonly Row[];
}

const IPAD_CATEGORIES: readonly Row[] = [
  [24, 104, 244, 168],
  [24, 176, 244, 240],
  [24, 248, 244, 312],
];
const PHONE_CATEGORIES: readonly Row[] = [
  [8, 80, 216, 144],
  [8, 152, 216, 216],
  [8, 224, 216, 288],
];
const NOTCH_CATEGORIES: readonly Row[] = [
  [67, 80, 275, 144],
  [67, 152, 275, 216],
  [67, 224, 275, 288],
];
const IPAD_BAR: readonly Row[] = [
  [24, 12, 264, 76],
  [932, 12, 996, 76],
  [1012, 12, 1076, 76],
  [1092, 12, 1156, 76],
];
const NOTCH_BAR: readonly Row[] = [
  [67, 8, 287, 72],
  [729, 8, 793, 72],
  [801, 8, 865, 72],
];
const PRO_MAX_PORTRAIT: TodayRows = {
  tiles: [
    [79, 250.1, 351, 544.5],
    [79, 564.5, 351, 858.9],
  ],
  categories: [[16, 147, 414, 211]],
  bar: [
    [16, 71, 92, 135],
    [270, 71, 334, 135],
    [350, 71, 414, 135],
  ],
};
const PRO_MAX_LANDSCAPE: TodayRows = {
  tiles: [
    [294, 94.5, 566, 386.5],
    [582, 94.5, 854, 386.5],
  ],
  categories: NOTCH_CATEGORIES,
  bar: NOTCH_BAR,
};

const TODAY_ROWS: Readonly<Record<string, TodayRows>> = {
  'iPad 1180×820': {
    tiles: [
      [418, 300.8, 702, 595.2],
      [722, 300.8, 1006, 595.2],
    ],
    categories: IPAD_CATEGORIES,
    bar: IPAD_BAR,
  },
  'iPad 1180×760': {
    tiles: [
      [418, 270.8, 702, 565.2],
      [722, 270.8, 1006, 565.2],
    ],
    categories: IPAD_CATEGORIES,
    bar: IPAD_BAR,
  },
  'zmenšené zobrazení 820×1180': {
    tiles: [
      [396, 323.6, 668, 618],
      [396, 638, 668, 932.4],
    ],
    categories: IPAD_CATEGORIES,
    bar: [
      [24, 12, 264, 76],
      [572, 12, 636, 76],
      [652, 12, 716, 76],
      [732, 12, 796, 76],
    ],
  },
  '744×296 nejmenší telefon': {
    tiles: [
      [224, 122, 472, 246],
      [488, 122, 736, 246],
    ],
    categories: PHONE_CATEGORIES,
    bar: [
      [8, 8, 228, 72],
      [600, 8, 664, 72],
      [672, 8, 736, 72],
    ],
  },
  '800×300 Samsung s Chromem': {
    tiles: [
      [228, 80, 500, 292],
      [516, 80, 788, 292],
    ],
    categories: PHONE_CATEGORIES,
    bar: [
      [8, 8, 228, 72],
      [656, 8, 720, 72],
      [728, 8, 792, 72],
    ],
  },
  '844×340 iPhone se Safari': {
    tiles: [
      [271, 132, 522, 259],
      [538, 132, 789, 259],
    ],
    categories: [
      [55, 80, 263, 144],
      [55, 152, 263, 216],
      [55, 224, 263, 288],
    ],
    bar: [
      [55, 8, 275, 72],
      [653, 8, 717, 72],
      [725, 8, 789, 72],
    ],
  },
  '932×430 iPhone Pro Max': PRO_MAX_LANDSCAPE,
  '932×499 těsně pod hranicí': {
    tiles: [
      [294, 139.5, 566, 431.5],
      [582, 139.5, 854, 431.5],
    ],
    categories: PHONE_CATEGORIES,
    bar: [
      [8, 8, 228, 72],
      [788, 8, 852, 72],
      [860, 8, 924, 72],
    ],
  },
  '932×499 těsně pod hranicí s výřezem': {
    tiles: [
      [294, 129, 566, 421],
      [582, 129, 854, 421],
    ],
    categories: NOTCH_CATEGORIES,
    bar: NOTCH_BAR,
  },
  '390×844 iPhone 13–15 (výřez 47, lišta 34)': {
    tiles: [
      [59, 207, 331, 494.5],
      [59, 514.5, 331, 802],
    ],
    categories: [[16, 135, 374, 199]],
    bar: [
      [16, 59, 92, 123],
      [230, 59, 294, 123],
      [310, 59, 374, 123],
    ],
  },
  '390×664 iPhone v Safari s lištou': {
    tiles: [
      [69.3, 160, 320.7, 398],
      [69.3, 418, 320.7, 656],
    ],
    categories: [[16, 88, 374, 152]],
    bar: [
      [16, 12, 92, 76],
      [230, 12, 294, 76],
      [310, 12, 374, 76],
    ],
  },
  '360×780 Samsung s Chromem': {
    tiles: [
      [44, 161.6, 316, 456],
      [44, 476, 316, 770.4],
    ],
    categories: [[16, 88, 344, 152]],
    bar: [
      [16, 12, 92, 76],
      [200, 12, 264, 76],
      [280, 12, 344, 76],
    ],
  },
  '375×667 iPhone SE': {
    tiles: [
      [66.6, 160, 308.4, 399.5],
      [66.6, 419.5, 308.4, 659],
    ],
    categories: [[16, 88, 359, 152]],
    bar: [
      [16, 12, 92, 76],
      [215, 12, 279, 76],
      [295, 12, 359, 76],
    ],
  },
  '430×932 iPhone Pro Max (výřez 59, lišta 34)': PRO_MAX_PORTRAIT,
  '360×620 nejmenší telefon na výšku': {
    tiles: [
      [76.1, 160, 284, 376],
      [76.1, 396, 284, 612],
    ],
    categories: [[16, 88, 344, 152]],
    bar: [
      [16, 12, 92, 76],
      [200, 12, 264, 76],
      [280, 12, 344, 76],
    ],
  },
  '499×932 těsně pod hranicí šířky': {
    tiles: [
      [113.5, 237.6, 385.5, 532],
      [113.5, 552, 385.5, 846.4],
    ],
    categories: [[16, 88, 483, 152]],
    bar: [
      [16, 12, 92, 76],
      [339, 12, 403, 76],
      [419, 12, 483, 76],
    ],
  },
  '375×1180 úzký iPad (Split View)': {
    tiles: [
      [51.5, 361.6, 323.5, 656],
      [51.5, 676, 323.5, 970.4],
    ],
    categories: [[16, 88, 359, 152]],
    bar: [
      [16, 12, 92, 76],
      [215, 12, 279, 76],
      [295, 12, 359, 76],
    ],
  },
  'iPad na šířku z plochy (stavový řádek 24, lišta 20)': {
    tiles: [
      [418, 302.8, 702, 597.2],
      [722, 302.8, 1006, 597.2],
    ],
    categories: [
      [24, 128, 244, 192],
      [24, 200, 244, 264],
      [24, 272, 244, 336],
    ],
    bar: [
      [24, 36, 264, 100],
      [932, 36, 996, 100],
      [1012, 36, 1076, 100],
      [1092, 36, 1156, 100],
    ],
  },
  'iPhone 430×932 na výšku z plochy (výřez 59, lišta 34)': PRO_MAX_PORTRAIT,
  'iPhone 393×852 na výšku z plochy (výřez 59, lišta 34)': {
    tiles: [
      [60.5, 219, 332.5, 504.5],
      [60.5, 524.5, 332.5, 810],
    ],
    categories: [[16, 147, 377, 211]],
    bar: [
      [16, 71, 92, 135],
      [233, 71, 297, 135],
      [313, 71, 377, 135],
    ],
  },
  'iPhone 932×430 na šířku z plochy (výřez 59, lišta 21)': PRO_MAX_LANDSCAPE,
};

function rowOf(box: MenuBox): Row {
  const round = (value: number): number => Math.round(value * 10) / 10;
  return [round(box.left), round(box.top), round(box.right), round(box.bottom)];
}

describe('#168 AC2: kvůli pandě se nic v menu nezmenší ani neposune', () => {
  it('dlaždice, kategorie a lišta mají ve všech oknech dnešní polohu a velikost', () => {
    expect(Object.keys(TODAY_ROWS).sort()).toEqual(
      FEW_GAMES_WINDOWS.map((window) => window.name).sort(),
    );
    for (const window of FEW_GAMES_WINDOWS) {
      const layout = todayLayout(window);
      const today = TODAY_ROWS[window.name];
      const categories =
        layout.categoryPicker === null
          ? layout.categories.map((category) => rowOf(category.hit))
          : [rowOf(layout.categoryPicker.button)];
      expect(layout.tiles.map(rowOf), `${window.name}: dlaždice`).toEqual(today?.tiles);
      expect(categories, `${window.name}: kategorie`).toEqual(today?.categories);
      expect(
        [layout.profileSlot, ...layout.reservedSlots, layout.languageSlot].map(rowOf),
        `${window.name}: lišta`,
      ).toEqual(today?.bar);
    }
  });

  it('panda se nepřekrývá s lištou ani kategoriemi a je od nich aspoň 8 px', () => {
    for (const window of FEW_GAMES_WINDOWS) {
      const layout = todayLayout(window);
      const panda = layout.mascot;
      if (panda === null) {
        continue;
      }
      const others = [
        layout.profileSlot,
        layout.languageSlot,
        ...layout.reservedSlots,
        ...layout.categories.map((category) => category.hit),
        ...(layout.categoryPicker === null ? [] : [layout.categoryPicker.button]),
      ];
      for (const other of others) {
        expect(gapBetween(panda, other), window.name).toBeGreaterThanOrEqual(TILE_GAP - ROUNDING);
      }
    }
  });
});
