import { describe, expect, it } from 'vitest';

import type { MenuBox, MenuLayout } from '../../src/menu/logic/menuLayout';
import { MIN_EDGE_DISTANCE } from '../shared/layoutRules';
import {
  boundsOf,
  freeAreaOf,
  gapBetween,
  heightOf,
  isInside,
  overlaps,
  widthOf,
} from '../shared/viewportFixtures';
import type { TestWindow } from '../shared/viewportFixtures';
import { FEW_GAME_COUNTS, FingerMenu, MANY_GAMES, fewGamesLayout } from './manyGamesFixtures';
import {
  FEW_GAMES_WINDOWS,
  describeLayoutRules,
  fewGamesContents,
  fewGamesScenes,
} from './menuLayoutScenes';
import { tileBefore156 } from './tilesBefore156';
import type { TileBefore156 } from './tilesBefore156';

/**
 * Testy k #156: při pár hrách jsou dlaždice v menu větší a uprostřed volné
 * plochy. Zkušební menu s 1 až 12 hrami (každá hra ve vlastní kategorii,
 * jen v testech) ve všech oknech menu a oknech z plochy.
 *
 * Rozhraní zůstává `menuLayoutFor` (`src/menu/logic/menuLayout.ts`), nic
 * nového nepřibývá: velikost dlaždic se dál řídí `MenuContent.allTileCount`
 * (počet her ve „Vše“), polohy jsou v `tiles` a `tileImages`, posouvání
 * v `gridScroll`.
 *
 * „Vejdou se bez posouvání“ znamená: mřížka se dnes (před #156)
 * neposouvala, `maxOffset` 0 v pevné tabulce `tilesBefore156.ts`. Ostatní
 * případy patří k AC2 a musí zůstat přesně jako dnes.
 *
 * Volná plocha pro dlaždice (AC1) je v těchto testech:
 * - se sloupcem kategorií (iPad, zmenšené zobrazení, telefon na šířku):
 *   od pravého okraje ťukacích ploch kategorií po pravý okraj volné plochy
 *   okna, od spodního okraje lišty po spodní okraj volné plochy,
 * - s výběrem kategorie (telefon na výšku): přes celou šířku volné plochy,
 *   od spodního okraje tlačítka výběru po spodní okraj volné plochy.
 */

const ROUNDING = 0.01;
/** Obrázek dlaždice nejvýš 256 CSS px, aby zůstal ostrý ze zdroje 512 px (AC1). */
const MAX_IMAGE = 256;
/** Okraje bloku se vodorovně i svisle liší nejvýš o 1 px (AC1). */
const CENTER_TOLERANCE = 1;
/** Mezi dlaždicemi aspoň 16 px (AC4). */
const MIN_TILE_GAP = 16;
/**
 * #156 upřesnění 1: v okně 932 × 499 bez výřezu se při 7 a 8 hrách
 * dlaždice s mezerou 16 px nevejdou (3 řady jsou moc vysoké, 4 sloupce moc
 * široké), zůstává dnešní mezera 12 px. Při 5 a 6 hrách už mezera 16 px je
 * (3 sloupce ve 2 řadách).
 */
const GAP_EXCEPTION_WINDOW = '932×499 těsně pod hranicí';
const GAP_EXCEPTION_GAMES = { fewest: 7, most: 8 } as const;
/**
 * Blok dlaždic, který už nejde zvětšit, sahá v aspoň jednom směru až
 * k nejmenšímu odstupu od okrajů volné plochy (#156 upřesnění 4). Svisle je
 * to 8 px (mezera od lišty a výběru kategorie), vodorovně podle zařízení:
 * na telefonu na výšku 16 px jako lišta, na iPadu 20 px jako dnešní mezera
 * od kategorií, na telefonu na šířku 8 px (okraj okna). Jinak už musí mít
 * obrázek největší povolenou velikost 256 px.
 */
const TIGHT_MARGIN_DOWN = 8;
const TIGHT_MARGIN_ACROSS: Readonly<Record<MenuLayout['mode'], number>> = {
  phonePortrait: 16,
  tablet: 20,
  scaled: 20,
  phoneLandscape: 8,
};

/**
 * Nejméně případů, na které se každé společné pravidlo použije: 21 oken
 * × 12 počtů her × 2 obsahy („Vše“ a vybraná kategorie), každý aspoň
 * jednou. Před #156 menu s 1 až 12 hrami nikdo nezkoušel.
 */
const FEW_GAMES_COMBINATIONS: Readonly<Record<string, number>> = {
  'vejde se do okna i mimo výřez': 504,
  'nic se nepřekrývá': 504,
  'ťukací plocha aspoň 64 px': 504,
  'mezera mezi plochami aspoň 8 px': 504,
  'aspoň 4 px od okraje': 504,
  'text se vejde do své plochy': 504,
};

describeLayoutRules('menu s 1 až 12 hrami (#156 AC4)', fewGamesScenes, FEW_GAMES_COMBINATIONS);

interface FewCase {
  readonly label: string;
  readonly window: TestWindow;
  readonly gameCount: number;
  /** Počet dlaždic vybrané kategorie (ve „Vše“ = `gameCount`). */
  readonly selectedCount: number;
  readonly layout: MenuLayout;
  readonly before: TileBefore156;
}

/** Každé okno × počet her × obsah („Vše“ a vybraná kategorie s jednou hrou). */
function allCases(): FewCase[] {
  return FEW_GAMES_WINDOWS.flatMap((window) =>
    FEW_GAME_COUNTS.flatMap((gameCount) =>
      fewGamesContents(gameCount).map(({ name, selectedCount }): FewCase => ({
        label: `${window.name}, ${name}`,
        window,
        gameCount,
        selectedCount,
        layout: fewGamesLayout(window, gameCount, selectedCount),
        before: tileBefore156(window.name, gameCount),
      })),
    ),
  );
}

const CASES = allCases();

/** Případy, ve kterých se dlaždice všech her dnes vešly bez posouvání (AC1). */
const FITTING = CASES.filter(({ before }) => before.maxOffset === 0);
/** Případy, ve kterých se dlaždice dnes nevešly a mřížka se posouvala (AC2). */
const SCROLLING = CASES.filter(({ before }) => before.maxOffset > 0);

const isAll = (item: FewCase): boolean => item.selectedCount === item.gameCount;

function barBoxes(layout: MenuLayout): MenuBox[] {
  return [layout.profileSlot, layout.languageSlot, ...layout.placeholders];
}

/** Lišta, ťukací plochy kategorií a tlačítko výběru kategorie. */
function surroundings(layout: MenuLayout): MenuBox[] {
  const picker = layout.categoryPicker;
  return [
    ...barBoxes(layout),
    ...layout.categories.map((category) => category.hit),
    ...(picker === null || picker === undefined ? [] : [picker.button]),
  ];
}

/** Volná plocha pro dlaždice podle AC1 (viz začátek souboru). */
function tileArea(item: FewCase): MenuBox {
  const free = freeAreaOf(item.window);
  const picker = item.layout.categoryPicker;
  if (picker !== null && picker !== undefined) {
    return { left: free.left, right: free.right, top: picker.button.bottom, bottom: free.bottom };
  }
  return {
    left: Math.max(...item.layout.categories.map((category) => category.hit.right)),
    right: free.right,
    top: Math.max(...barBoxes(item.layout).map((box) => box.bottom)),
    bottom: free.bottom,
  };
}

interface Margins {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

/** Okraje bloku dlaždic od volné plochy pro dlaždice. */
function marginsOf(item: FewCase): Margins {
  const block = boundsOf(item.layout.tiles);
  const area = tileArea(item);
  return {
    left: block.left - area.left,
    right: area.right - block.right,
    top: block.top - area.top,
    bottom: area.bottom - block.bottom,
  };
}

function imageSide(layout: MenuLayout, index = 0): number {
  const face = layout.tileImages[index];
  return face === undefined ? NaN : widthOf(face.image);
}

/** Všechny dvojice dlaždic. */
function tilePairs(tiles: readonly MenuBox[]): Array<[MenuBox, MenuBox]> {
  return tiles.flatMap((first, index) =>
    tiles.slice(index + 1).map((second): [MenuBox, MenuBox] => [first, second]),
  );
}

function expectCentered(item: FewCase): void {
  const margins = marginsOf(item);
  expect(Math.abs(margins.left - margins.right), `${item.label}: vodorovně`).toBeLessThanOrEqual(
    CENTER_TOLERANCE + ROUNDING,
  );
  expect(Math.abs(margins.top - margins.bottom), `${item.label}: svisle`).toBeLessThanOrEqual(
    CENTER_TOLERANCE + ROUNDING,
  );
}

describe('#156: zkoušené případy', () => {
  it('zkouší se pár her, které se vejdou, i tolik her, že se mřížka posouvá', () => {
    expect(FITTING.length).toBeGreaterThan(0);
    expect(SCROLLING.length).toBeGreaterThan(0);
  });
});

describe('#156 AC1: při pár hrách jsou dlaždice velké a uprostřed', () => {
  it('když se dlaždice všech her vešly bez posouvání, vejdou se bez posouvání i teď', () => {
    for (const item of FITTING) {
      expect(item.layout.gridScroll.maxOffset, item.label).toBe(0);
    }
  });

  it('dlaždice jsou co největší: blok sahá v aspoň jednom směru k okrajům volné plochy, nebo má obrázek už 256 px', () => {
    for (const item of FITTING.filter(isAll)) {
      const margins = marginsOf(item);
      const tightAcross =
        Math.max(margins.left, margins.right) <= TIGHT_MARGIN_ACROSS[item.layout.mode] + ROUNDING;
      const tightDown = Math.max(margins.top, margins.bottom) <= TIGHT_MARGIN_DOWN + ROUNDING;
      const imageAtMost = Math.abs(imageSide(item.layout) - MAX_IMAGE) <= ROUNDING;
      const message = `${item.label}: okraje ${JSON.stringify(margins)}, obrázek ${imageSide(item.layout)} px`;
      expect(tightAcross || tightDown || imageAtMost, message).toBe(true);
    }
  });

  it('obrázek na dlaždici má nejvýš 256 px, aby zůstal ostrý', () => {
    for (const item of CASES) {
      item.layout.tileImages.forEach((face, index) => {
        expect(widthOf(face.image), `${item.label}, dlaždice ${index + 1}`).toBeLessThanOrEqual(
          MAX_IMAGE + ROUNDING,
        );
      });
    }
  });

  it('po přepnutí kategorie mají dlaždice i obrázky stejnou velikost jako ve „Vše“', () => {
    for (const window of FEW_GAMES_WINDOWS) {
      for (const gameCount of FEW_GAME_COUNTS) {
        const all = fewGamesLayout(window, gameCount);
        const tile = all.tiles[0];
        expect(tile, window.name).toBeDefined();
        for (const selectedCount of new Set([1, Math.ceil(gameCount / 2)])) {
          const label = `${window.name}, ${gameCount} her, vybraná kategorie s ${selectedCount}`;
          const selected = fewGamesLayout(window, gameCount, selectedCount);
          const first = selected.tiles[0];
          expect(first, label).toBeDefined();
          expect(widthOf(first ?? all.gridScroll.viewport), label).toBeCloseTo(
            widthOf(tile ?? all.gridScroll.viewport),
            5,
          );
          expect(heightOf(first ?? all.gridScroll.viewport), label).toBeCloseTo(
            heightOf(tile ?? all.gridScroll.viewport),
            5,
          );
          expect(imageSide(selected), label).toBeCloseTo(imageSide(all), 5);
        }
      }
    }
  });

  it('dlaždice nikdy není užší ani nižší než dnes (pevná tabulka před #156)', () => {
    for (const item of CASES) {
      item.layout.tiles.forEach((tile, index) => {
        const label = `${item.label}, dlaždice ${index + 1}`;
        expect(widthOf(tile), label).toBeGreaterThanOrEqual(item.before.width - ROUNDING);
        expect(heightOf(tile), label).toBeGreaterThanOrEqual(item.before.height - ROUNDING);
      });
    }
  });

  it('blok dlaždic ve „Vše“ je uprostřed volné plochy vedle kategorií nebo pod výběrem kategorií (okraje se liší nejvýš o 1 px)', () => {
    for (const item of FITTING.filter(isAll)) {
      expectCentered(item);
    }
  });
});

describe('#156 AC2: když se dlaždice nevejdou, rozložení a posouvání zůstanou jako dnes (#69)', () => {
  it('mřížka má stejné sloupce, stejně velké dlaždice, první dlaždici na stejném místě a stejný posun jako dnes', () => {
    for (const item of SCROLLING.filter(isAll)) {
      const { layout, before, label } = item;
      const first = layout.tiles[0];
      expect(first, label).toBeDefined();
      const tile = first ?? layout.gridScroll.viewport;
      expect(layout.gridColumns, label).toBe(before.columns);
      expect(widthOf(tile), label).toBeCloseTo(before.width, 2);
      expect(heightOf(tile), label).toBeCloseTo(before.height, 2);
      expect(tile.left, label).toBeCloseTo(before.left, 2);
      expect(tile.top, label).toBeCloseTo(before.top, 2);
      expect(layout.gridScroll.maxOffset, label).toBeCloseTo(before.maxOffset, 2);
    }
  });

  it('mezera mezi dlaždicemi je stejná jako dnes', () => {
    for (const item of SCROLLING.filter(isAll)) {
      const [first, second] = item.layout.tiles;
      expect(first, item.label).toBeDefined();
      expect(second, item.label).toBeDefined();
      const gap = (second?.left ?? 0) - (first?.right ?? 0);
      expect(gap, item.label).toBeCloseTo(item.before.gap ?? NaN, 2);
    }
  });
});

/** Nechá doběhnout stahování a spuštění hry (sliby). */
async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

/** Vybere kategorii `index` (1 = první kategorie za „Vše“) jako prst dítěte. */
function selectCategory(finger: FingerMenu, index: number): void {
  if (finger.layout().categoryPicker !== null) {
    finger.tap(finger.categoryButtonCenter());
    finger.tap(finger.categoryRowCenter(index));
    return;
  }
  finger.tap(finger.categoryCenter(index));
}

describe('#156 AC3: po přepnutí kategorie', () => {
  it('blok dlaždic vybrané kategorie je znovu uprostřed volné plochy (okraje se liší nejvýš o 1 px)', () => {
    for (const item of FITTING.filter((candidate) => !isAll(candidate))) {
      expectCentered(item);
    }
    for (const window of FEW_GAMES_WINDOWS) {
      for (const gameCount of FEW_GAME_COUNTS) {
        const before = tileBefore156(window.name, gameCount);
        if (before.maxOffset > 0) {
          continue;
        }
        const selectedCount = Math.ceil(gameCount / 2);
        expectCentered({
          label: `${window.name}, ${gameCount} her, vybraná kategorie s ${selectedCount}`,
          window,
          gameCount,
          selectedCount,
          layout: fewGamesLayout(window, gameCount, selectedCount),
          before,
        });
      }
    }
  });

  it('ťuknutí na dlaždici ve „Vše“ i ve vybrané kategorii spustí hru jako dnes', async () => {
    for (const window of FEW_GAMES_WINDOWS) {
      for (const gameCount of FEW_GAME_COUNTS) {
        const label = `${window.name}, ${gameCount} her`;
        const games = MANY_GAMES.slice(0, gameCount);

        const inAll = new FingerMenu(window, games);
        inAll.tap(inAll.tileCenter(0));
        await settle();
        expect(inAll.started, `${label}, „Vše“`).toEqual(['game1']);

        const inCategory = new FingerMenu(window, games);
        selectCategory(inCategory, 1);
        expect(inCategory.selectedCategory(), label).toBe('category1');
        inCategory.tap(inCategory.tileCenter(0));
        await settle();
        expect(inCategory.started, `${label}, vybraná kategorie`).toEqual(['game1']);
      }
    }
  });
});

describe('#156 AC4: rozložení pro všechna okna menu a 1 až 12 her', () => {
  it('dlaždice nepřekrývají lištu ani kategorie (ani tlačítko výběru kategorie)', () => {
    for (const item of CASES) {
      // Posouvaná mřížka se kreslí jen v ořezu kamery (#69), ten hlídá AC2.
      const drawn = item.before.maxOffset > 0 ? [item.layout.gridScroll.clip] : item.layout.tiles;
      for (const box of drawn) {
        for (const other of surroundings(item.layout)) {
          expect(overlaps(box, other), item.label).toBe(false);
        }
      }
    }
  });

  // #156 upřesnění 1: 16 px tam, kde se to vejde, a nikdy méně než dnes.
  // V okně 932 × 499 bez výřezu se při 7 a 8 hrách mezera 16 px nevejde,
  // tam smí zůstat dnešní mezera (12 px).
  it('mezi dlaždicemi je aspoň 16 px (výjimka 932 × 499 bez výřezu při 7 a 8 hrách: dnešní mezera), nikdy méně než dnes, když se vejdou bez posouvání', () => {
    for (const item of FITTING) {
      const isNarrowException =
        item.window.name === GAP_EXCEPTION_WINDOW &&
        item.gameCount >= GAP_EXCEPTION_GAMES.fewest &&
        item.gameCount <= GAP_EXCEPTION_GAMES.most;
      const todayGap = item.before.gap ?? 0;
      const minGap = isNarrowException ? todayGap : Math.max(MIN_TILE_GAP, todayGap);
      for (const [first, second] of tilePairs(item.layout.tiles)) {
        expect(gapBetween(first, second), item.label).toBeGreaterThanOrEqual(minGap - ROUNDING);
      }
    }
  });

  it('název hry je uvnitř dlaždice', () => {
    for (const item of CASES) {
      item.layout.tiles.forEach((tile, index) => {
        const face = item.layout.tileImages[index];
        expect(face, `${item.label}, dlaždice ${index + 1}`).toBeDefined();
        expect(
          isInside(face?.title ?? item.layout.gridScroll.viewport, tile),
          `${item.label}, dlaždice ${index + 1}`,
        ).toBe(true);
      });
    }
  });

  it('dlaždice leží v bezpečné ploše aspoň 4 px od okraje (posouvaná mřížka se ořízne uvnitř bezpečné plochy)', () => {
    for (const item of CASES) {
      const free = freeAreaOf(item.window);
      const inner: MenuBox = {
        left: free.left + MIN_EDGE_DISTANCE,
        right: free.right - MIN_EDGE_DISTANCE,
        top: free.top + MIN_EDGE_DISTANCE,
        bottom: free.bottom - MIN_EDGE_DISTANCE,
      };
      if (item.before.maxOffset > 0) {
        expect(isInside(item.layout.gridScroll.clip, free), item.label).toBe(true);
        continue;
      }
      item.layout.tiles.forEach((tile, index) => {
        expect(isInside(tile, inner), `${item.label}, dlaždice ${index + 1}`).toBe(true);
      });
    }
  });
});
