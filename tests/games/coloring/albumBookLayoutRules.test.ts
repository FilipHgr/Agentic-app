import { describe, expect, it } from 'vitest';

import { ALBUM_PICTURE_LIMIT } from '../../../src/games/coloring/logic/album';
import { COLORING_GAME_AREA_FIT } from '../../../src/games/coloring/logic/coloringLayout';
import type { LayoutRect } from '../../../src/games/coloring/logic/coloringLayout';
import { layoutAlbum } from '../../../src/games/coloring/logic/pickerLayout';
import type { AlbumLayout } from '../../../src/games/coloring/logic/pickerLayout';
import { homeButtonFor } from '../../../src/shared/logic/homeButton';
import { gameAreaFor } from '../../../src/shared/logic/viewportLayout';
import type { GameArea } from '../../../src/shared/logic/viewportLayout';
import { LAYOUT_RULES, MIN_TAP_GAP } from '../../shared/layoutRules';
import type { LayoutItem, LayoutScene } from '../../shared/layoutRules';
import {
  boundsOf,
  freeAreaOf,
  gapBetween,
  heightOf,
  isInside,
  toCss,
  viewportOf,
  widthOf,
} from '../../shared/viewportFixtures';
import type { Box, TestWindow } from '../../shared/viewportFixtures';
import { COLORING_WINDOWS, HOME_NAME, boxOfRect } from './coloringLayoutScenes';
import { ALBUM_GRID_BEFORE_158 } from './layoutBefore158Fixture';
import type { AlbumPagesKind } from './layoutBefore158Fixture';

/**
 * Testy k #158 AC1 (stránka knihy: náhledy na stejném místě a stejně velké
 * jako po #149) a AC5 (rozložení karty stránky): pravidla v cyklu pro
 * všechna okna testů rozložení Omalovánek (`COLORING_WINDOWS`) a album
 * s 1 až 60 obrázky, jeden test na pravidlo.
 *
 * Na stránce alba je vždy 12 míst (`layout.previews`): na místech
 * s obrázkem náhledy, na volných místech do konce stránky prázdná okénka
 * (#158 AC2). Okénko se kreslí na místě náhledu, je proto stejně velké
 * jako náhledy. Karta stránky musí obsáhnout všech 12 míst.
 *
 * Domeček je prvek stránky, šipky ◀ ▶ jsou jen u alba s víc stránkami
 * (`layout.arrows`), jako v testech #149 (`albumPagesLayoutRules.test.ts`).
 *
 * #158 AC1 nahrazuje kontrolu „pixel po pixelu“ z #149 AC3: album s kartou
 * už vizuálně není stejné jako před #158, náhledy ale musí zůstat na stejném
 * místě a stejně velké (pevná tabulka `ALBUM_GRID_BEFORE_158`). Vzhled karty
 * (světlá, zaoblené rohy, jemný stín, liší se od pozadí) je ruční kontrola.
 *
 * Navržené rozšíření `pickerLayout.ts` (herní jednotky):
 * - `AlbumLayout.pageCard: LayoutRect` karta stránky knihy pod náhledy
 *   a okénky (scéna ji kreslí vždy, když je album vidět).
 */

/** Vnitřní okraj karty kolem náhledů a okének v CSS px, kde se vejde (AC5). */
const CARD_PADDING = 8;

/**
 * Upřesnění #158 (AC1 a AC5 jdou proti sobě, náhledy mají přednost):
 * vnitřní okraj karty je 8 px, kde se vejde, jinak nejméně 4 px, a karta
 * je od domečku a šipek aspoň 4 px a nepřekrývá je (dřív 8 px a 16 px).
 */
const MIN_CARD_PADDING = 4;

/** Nejmenší mezera karty od domečku a šipek v CSS px (upřesnění #158, dřív 16 px). */
const MIN_CARD_GAP = 4;

/** Tolerance na zaokrouhlení v CSS px. */
const TOLERANCE = 0.01;

/** Míst na stránce alba (12 obrázků na stránku, #149). */
const ALBUM_PLACES = 12;

const CARD_NAME = 'karta stránky';
const PREVIOUS_NAME = 'šipka ◀';
const NEXT_NAME = 'šipka ▶';

function placeName(index: number): string {
  return `místo alba ${index + 1}`;
}

/** Počty obrázků 1 až 60 (prázdné album je mimo rozsah #158). */
const PICTURE_COUNTS: readonly number[] = Array.from(
  { length: ALBUM_PICTURE_LIMIT },
  (_, index) => index + 1,
);

function visibleAreaOf(window: TestWindow, area: GameArea): Box {
  const free = freeAreaOf(window);
  const plane = toCss({ left: 0, right: area.width, top: 0, bottom: area.height }, area);
  return {
    left: Math.max(free.left, plane.left),
    right: Math.min(free.right, plane.right),
    top: Math.max(free.top, plane.top),
    bottom: Math.min(free.bottom, plane.bottom),
  };
}

function homeHitOf(window: TestWindow): Box {
  const home = homeButtonFor(viewportOf(window));
  return {
    left: home.left,
    right: home.left + home.hitSize,
    top: home.top,
    bottom: home.top + home.hitSize,
  };
}

interface BookCase {
  readonly window: TestWindow;
  readonly pictureCount: number;
  readonly layout: AlbumLayout;
  readonly visible: Box;
  readonly home: Box;
  readonly card: Box;
  readonly places: readonly Box[];
  /** Šipky ◀ ▶, jen když je album má (víc stránek). */
  readonly arrows: ReadonlyArray<readonly [string, Box]>;
  readonly scene: LayoutScene;
}

function bookCase(window: TestWindow, pictureCount: number): BookCase {
  const area = gameAreaFor(viewportOf(window), COLORING_GAME_AREA_FIT);
  const layout = layoutAlbum(area, { pictureCount });
  const css = (rect: LayoutRect): Box => toCss(boxOfRect(rect), area);
  const visible = visibleAreaOf(window, area);
  const home = homeHitOf(window);
  const card = css(layout.pageCard);
  const places = layout.previews.map(css);
  const arrows: ReadonlyArray<readonly [string, Box]> = layout.arrows
    ? [
        [PREVIOUS_NAME, css(layout.previousArrow)],
        [NEXT_NAME, css(layout.nextArrow)],
      ]
    : [];
  const items: LayoutItem[] = [
    {
      name: HOME_NAME,
      box: {
        left: home.left - MIN_TAP_GAP,
        right: home.right + MIN_TAP_GAP,
        top: home.top - MIN_TAP_GAP,
        bottom: home.bottom + MIN_TAP_GAP,
      },
      reserved: true,
    },
    // AC5 chce kartu jen v bezpečné ploše, ne 4 px od jejího okraje.
    { name: CARD_NAME, box: card, minEdge: 0 },
    ...places.map((box, index) => ({ name: placeName(index), box, tappable: true })),
    ...arrows.map(([name, box]) => ({ name, box, tappable: true })),
  ];
  return {
    window,
    pictureCount,
    layout,
    visible,
    home,
    card,
    places,
    arrows,
    scene: {
      label: `${window.name}, album s ${pictureCount} obrázky`,
      free: visible,
      items,
      // Náhledy a okénka leží na kartě, to není překryv.
      mayOverlap: (first, second) => first.name === CARD_NAME || second.name === CARD_NAME,
    },
  };
}

/** Vnitřní okraje karty kolem obdélníku `inner` po stranách v CSS px. */
function paddingsOf(card: Box, inner: Box): ReadonlyArray<readonly [keyof Box, number]> {
  return [
    ['left', inner.left - card.left],
    ['right', card.right - inner.right],
    ['top', inner.top - card.top],
    ['bottom', card.bottom - inner.bottom],
  ];
}

/** Leží překážka celá za stranou `side` obdélníku `inner` (vlevo, vpravo, nad, pod ním)? */
function isBeyondSide(inner: Box, obstacle: Box, side: keyof Box): boolean {
  switch (side) {
    case 'left':
      return obstacle.right <= inner.left + TOLERANCE;
    case 'right':
      return obstacle.left >= inner.right - TOLERANCE;
    case 'top':
      return obstacle.bottom <= inner.top + TOLERANCE;
    case 'bottom':
      return obstacle.top >= inner.bottom - TOLERANCE;
  }
}

/** Vzdálenost okraje `side` karty od překážky za touto stranou v CSS px. */
function distanceBeyondSide(card: Box, obstacle: Box, side: keyof Box): number {
  switch (side) {
    case 'left':
      return card.left - obstacle.right;
    case 'right':
      return obstacle.left - card.right;
    case 'top':
      return card.top - obstacle.bottom;
    case 'bottom':
      return obstacle.top - card.bottom;
  }
}

/** Domeček a šipky (když je album má), od kterých karta ustupuje. */
function obstaclesOf(testCase: BookCase): Box[] {
  return [testCase.home, ...testCase.arrows.map(([, box]) => box)];
}

let cached: BookCase[] | undefined;

/** Všechna okna a 1 až 60 obrázků. */
function bookCases(): BookCase[] {
  cached ??= COLORING_WINDOWS.flatMap((window) =>
    PICTURE_COUNTS.map((count) => bookCase(window, count)),
  );
  return cached;
}

describe('#158 AC5: album jako kniha dodrží společná pravidla rozložení', () => {
  for (const [ruleName, rule] of Object.entries(LAYOUT_RULES)) {
    it(`${ruleName} ve všech oknech s kartou stránky a 1 až 60 obrázky`, () => {
      for (const testCase of bookCases()) {
        expect(rule(testCase.scene), testCase.scene.label).toEqual([]);
      }
    });
  }
});

describe('#158 AC5: karta stránky knihy', () => {
  it('na stránce je vždy 12 míst pro náhledy a okénka', () => {
    for (const testCase of bookCases()) {
      expect(testCase.places.length, testCase.scene.label).toBe(ALBUM_PLACES);
    }
  });

  it('karta obsahuje všechny náhledy i okénka s vnitřním okrajem aspoň 4 px', () => {
    for (const testCase of bookCases()) {
      testCase.places.forEach((place, index) => {
        const what = `${testCase.scene.label}: ${placeName(index)}`;
        for (const [side, padding] of paddingsOf(testCase.card, place)) {
          expect(padding, `${what}, ${side}`).toBeGreaterThanOrEqual(MIN_CARD_PADDING - TOLERANCE);
        }
      });
    }
  });

  // Upřesnění #158: okraj 8 px ustoupí jen tam, kde by karta vyšla z okna
  // nebo se přiblížila domečku či šipce na méně než 4 px.
  it('vnitřní okraj karty je 8 px všude, kde se vejde', () => {
    for (const testCase of bookCases()) {
      const grid = boundsOf(testCase.places);
      for (const [side, padding] of paddingsOf(testCase.card, grid)) {
        if (padding >= CARD_PADDING - TOLERANCE) {
          continue;
        }
        const what = `${testCase.scene.label}: okraj ${side} ${padding} px`;
        const atWindowEdge = Math.abs(testCase.card[side] - testCase.visible[side]) <= TOLERANCE;
        // Okraj smí ustoupit jen kvůli překážce na stejné straně mřížky.
        const nearObstacle = obstaclesOf(testCase).some(
          (obstacle) =>
            isBeyondSide(grid, obstacle, side) &&
            distanceBeyondSide(testCase.card, obstacle, side) <= MIN_CARD_GAP + TOLERANCE,
        );
        expect(atWindowEdge || nearObstacle, `${what} je menší, i když se vejde`).toBe(true);
      }
    }
  });

  it('karta leží v bezpečné ploše', () => {
    for (const testCase of bookCases()) {
      expect(isInside(testCase.card, testCase.visible), testCase.scene.label).toBe(true);
    }
  });

  it('karta je od domečku aspoň 4 px a nepřekrývá ho', () => {
    for (const testCase of bookCases()) {
      expect(
        gapBetween(testCase.card, testCase.home),
        `${testCase.scene.label}: ${CARD_NAME} a domeček`,
      ).toBeGreaterThanOrEqual(MIN_CARD_GAP - TOLERANCE);
    }
  });

  it('karta je od šipek ◀ ▶ aspoň 4 px a nepřekrývá je, když album šipky má', () => {
    for (const testCase of bookCases()) {
      for (const [name, arrow] of testCase.arrows) {
        expect(
          gapBetween(testCase.card, arrow),
          `${testCase.scene.label}: ${CARD_NAME} a ${name}`,
        ).toBeGreaterThanOrEqual(MIN_CARD_GAP - TOLERANCE);
      }
    }
  });

  it('album s víc stránkami má šipky, album s jedinou stránkou ne (kontrola případů)', () => {
    for (const testCase of bookCases()) {
      expect(testCase.arrows.length > 0, testCase.scene.label).toBe(testCase.pictureCount > 12);
    }
  });
});

/**
 * Místa náhledů v CSS px bez karty stránky: kontrola AC1 tak nezávisí na
 * tom, jestli rozložení kartu už má.
 */
function placesOf(window: TestWindow, pictureCount: number): Box[] {
  const area = gameAreaFor(viewportOf(window), COLORING_GAME_AREA_FIT);
  return layoutAlbum(area, { pictureCount }).previews.map((rect) => toCss(boxOfRect(rect), area));
}

/** Druh alba podle počtu obrázků: do 12 jediná stránka, od 13 víc stránek. */
function pagesKindOf(pictureCount: number): AlbumPagesKind {
  return pictureCount > ALBUM_PLACES ? 'many' : 'one';
}

describe('#158 AC1: náhledy mají stejnou velikost i místo jako po #149', () => {
  it('pevná tabulka alba před #158 má všechna okna Omalovánek s jedinou i víc stránkami', () => {
    const expected = COLORING_WINDOWS.flatMap((window) => [
      `${window.name} one`,
      `${window.name} many`,
    ]);
    expect(ALBUM_GRID_BEFORE_158.map(([name, kind]) => `${name} ${kind}`)).toEqual(expected);
  });

  // Nahrazuje kontrolu „pixel po pixelu“ z #149 AC3 (dnešní album se ukáže
  // stejně): s kartou stránky album vizuálně stejné není, náhledy ale leží
  // na stejném místě a jsou stejně velké jako po #149. Obsah obrázku dál
  // hlídá test „obrázek uložený před #149 …“ v `albumLimit.test.ts`.
  it('s kartou stránky jsou náhledy na stejném místě a stejně velké jako po #149 pro 1 až 60 obrázků', () => {
    const before = new Map(ALBUM_GRID_BEFORE_158.map((row) => [`${row[0]} ${row[1]}`, row]));
    for (const window of COLORING_WINDOWS) {
      for (const pictureCount of PICTURE_COUNTS) {
        const what = `${window.name}, album s ${pictureCount} obrázky`;
        const row = before.get(`${window.name} ${pagesKindOf(pictureCount)}`);
        if (row === undefined) {
          throw new Error(`${what}: chybí míra alba`);
        }
        const [, , left, top, right, bottom, width, height] = row;
        const places = placesOf(window, pictureCount);
        const first = places[0];
        const last = places[ALBUM_PLACES - 1];
        if (first === undefined || last === undefined) {
          throw new Error(`${what}: chybí místa alba`);
        }
        expect(places.length, `${what}: míst`).toBe(ALBUM_PLACES);
        expect(first.left, `${what}: levý okraj`).toBeCloseTo(left, 2);
        expect(first.top, `${what}: horní okraj`).toBeCloseTo(top, 2);
        expect(last.right, `${what}: pravý okraj`).toBeCloseTo(right, 2);
        expect(last.bottom, `${what}: spodní okraj`).toBeCloseTo(bottom, 2);
        places.forEach((place, index) => {
          expect(widthOf(place), `${what}: ${placeName(index)}, šířka`).toBeCloseTo(width, 2);
          expect(heightOf(place), `${what}: ${placeName(index)}, výška`).toBeCloseTo(height, 2);
        });
      }
    }
  });
});
