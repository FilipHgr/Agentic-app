import { describe, expect, it } from 'vitest';

import { MIN_EDGE_DISTANCE, MIN_TAP_GAP } from '../../shared/layoutRules';
import { boundsOf, gapBetween, heightOf, widthOf } from '../../shared/viewportFixtures';
import type { Box } from '../../shared/viewportFixtures';
import {
  HANDLE_NAME,
  HOME_NAME,
  PICTURE_EDGE_EXCEPTION,
  PICTURE_NAME,
  UNDO_NAME,
  coloringCases,
  isLandscapeArea,
  recentColorName,
} from './coloringLayoutScenes';
import type { ColoringCase } from './coloringLayoutScenes';

/**
 * Testy k #111 (obrázek v Omalovánkách přes celou výšku, na výšku otočený
 * bokem): AC1 na výšku otočený a větší obrázek, AC3 obrázek mezi lištami
 * a AC4 na šířku obrázek až k hornímu a dolnímu okraji. Každé pravidlo má
 * jeden test, který v cyklu projde všechna okna (`COLORING_WINDOWS`) se
 * zavřeným panelem i v obou krocích panelu, případ je popsaný ve zprávě
 * `expect`. Obrazovku skládá `coloringLayoutScenes.ts`, společná pravidla
 * (64 px, 8 px, nic se nepřekrývá, vejde se, aspoň 4 px od okraje se
 * schválenou výjimkou 0 px jen pro obrázek na šířku) běží
 * v `coloringLayoutRules.test.ts`.
 *
 * Nahrazují test #96 AC1 „obrázek je největší 4 : 3 v prostoru mimo pruh:
 * od dvou protilehlých hranic nejvýš 8 px“ (`toolPanelLayoutRules.test.ts`)
 * přesnými pravidly: na výšku šířka okna bez 8 px po stranách a na středu
 * mezi domečkem a lištou, na šířku celá výška volné plochy, nebo celá šířka
 * vedle pruhu bez 8 px, a na středu.
 *
 * Navržené rozhraní (`coloringLayout.ts`): `ColoringLayout` má navíc pole
 * `pictureTurn: PictureTurn` s `PictureTurn = 0 | 90`, otočení obrázku na
 * obrazovce ve stupních po směru hodinových ručiček. `picture` zůstává
 * obdélník, který obrázek zabírá na obrazovce.
 */

/** Poměr stran obrázku (1024 × 768). */
const PICTURE_ASPECT = 4 / 3;

/** Boční okraje obrázku na výšku a odstup od pruhu na šířku v CSS px (AC1, AC4). */
const PICTURE_SIDE_MARGIN = 8;

/** Tolerance na zaokrouhlení v CSS px. */
const TOLERANCE = 0.01;

/** Nejmenší strana obrázku (#88 AC1, #111 AC3). */
const MIN_PICTURE_SIDE = 240;

let cached: ColoringCase[] | undefined;

function cases(): ColoringCase[] {
  cached ??= coloringCases();
  return cached;
}

/** Na výšku a na šířku podle tvaru herní plochy, jako rozhoduje hra. */
function portraitCases(): ColoringCase[] {
  return cases().filter((testCase) => !isLandscapeArea(testCase.area));
}

function landscapeCases(): ColoringCase[] {
  return cases().filter((testCase) => isLandscapeArea(testCase.area));
}

/** Vršek spodní lišty na výšku: nedávné barvy, úchyt a Zpět. */
function stripTopOf(testCase: ColoringCase): number {
  return Math.min(...[testCase.handle, testCase.undo, ...testCase.recentColors].map((b) => b.top));
}

/** Volná výška pro obrázek na výšku: mezi domečkem a lištou bez 8 px z obou stran (AC1). */
function freePortraitHeightOf(testCase: ColoringCase): number {
  return stripTopOf(testCase) - testCase.home.bottom - 2 * MIN_TAP_GAP;
}

/** Vejde se na výšku obrázek přes šířku okna bez 8 px po stranách (AC1)? */
function fullWidthFits(testCase: ColoringCase): boolean {
  const fullWidth = widthOf(testCase.visible) - 2 * PICTURE_SIDE_MARGIN;
  return fullWidth * PICTURE_ASPECT <= freePortraitHeightOf(testCase) + TOLERANCE;
}

/** Pravý okraj pruhu na šířku: domeček, úchyt, Zpět a nedávné barvy. */
function stripRightOf(testCase: ColoringCase): number {
  return boundsOf([testCase.home, testCase.handle, testCase.undo, ...testCase.recentColors]).right;
}

/** Místo pro obrázek na šířku: od pruhu + 8 px po pravý okraj − 8 px, celá výška (AC4). */
function landscapeSpaceOf(testCase: ColoringCase): Box {
  return {
    left: stripRightOf(testCase) + PICTURE_SIDE_MARGIN,
    right: testCase.visible.right - PICTURE_SIDE_MARGIN,
    top: testCase.visible.top,
    bottom: testCase.visible.bottom,
  };
}

/** Dovolí šířka vedle pruhu obrázek přes celou výšku (AC4)? */
function fullHeightFits(testCase: ColoringCase): boolean {
  const space = landscapeSpaceOf(testCase);
  return heightOf(space) * PICTURE_ASPECT <= widthOf(space) + TOLERANCE;
}

function px(value: number): string {
  return `${String(Math.round(value * 100) / 100).replace('.', ',')} px`;
}

describe('#111 AC1: na výšku je obrázek otočený a větší', () => {
  it('zkouší se okna na výšku i na šířku, zavřený panel i oba kroky', () => {
    expect(portraitCases().length, 'okna na výšku').toBeGreaterThan(0);
    expect(landscapeCases().length, 'okna na šířku').toBeGreaterThan(0);
    const panels = new Set(cases().map((testCase) => testCase.panel));
    expect([...panels].sort()).toEqual(['closed', 'colors', 'tools']);
  });

  it('na výšku je obrázek v každém okně otočený o 90° po směru hodinových ručiček', () => {
    for (const testCase of portraitCases()) {
      expect(testCase.layout.pictureTurn, `${testCase.scene.label}: otočení obrázku`).toBe(90);
    }
  });

  it('na šířku obrázek nikdy otočený není', () => {
    for (const testCase of landscapeCases()) {
      expect(testCase.layout.pictureTurn, `${testCase.scene.label}: otočení obrázku`).toBe(0);
    }
  });

  it('zkouší se okna na výšku, kde se obrázek přes šířku okna vejde, i okna, kde ne', () => {
    const kinds = new Set(portraitCases().map(fullWidthFits));
    expect([...kinds].sort(), 'obě situace').toEqual([false, true]);
    const lowPhone = portraitCases().filter(
      (testCase) => testCase.window.width === 414 && testCase.window.height === 622,
    );
    expect(lowPhone.length, 'okno 414 × 622 se zkouší').toBeGreaterThan(0);
    for (const testCase of lowPhone) {
      expect(fullWidthFits(testCase), `${testCase.scene.label}: přes šířku se nevejde`).toBe(false);
    }
  });

  it('na výšku má obrázek šířku okna bez bočních okrajů 8 px, když se tak vejde mezi domeček a lištu', () => {
    for (const testCase of portraitCases().filter(fullWidthFits)) {
      const { label } = testCase.scene;
      const { picture, visible } = testCase;
      expect(picture.left - visible.left, `${label}: okraj vlevo`).toBeCloseTo(
        PICTURE_SIDE_MARGIN,
        2,
      );
      expect(visible.right - picture.right, `${label}: okraj vpravo`).toBeCloseTo(
        PICTURE_SIDE_MARGIN,
        2,
      );
    }
  });

  it('na výšku je obrázek celý a nezdeformovaný: výška je 4/3 šířky', () => {
    for (const testCase of portraitCases()) {
      const { picture } = testCase;
      expect(heightOf(picture), `${testCase.scene.label}: výška obrázku`).toBeCloseTo(
        (widthOf(picture) * 4) / 3,
        2,
      );
    }
  });

  it('v okně 390 × 844 má obrázek 374 × 498,7 px místo dnešních 374 × 281', () => {
    const phoneCases = portraitCases().filter(
      (testCase) => testCase.window.width === 390 && testCase.window.height === 844,
    );
    expect(phoneCases.length, 'okno 390 × 844 se zkouší').toBeGreaterThan(0);
    for (const testCase of phoneCases) {
      const { label } = testCase.scene;
      expect(widthOf(testCase.picture), `${label}: šířka obrázku`).toBeCloseTo(374, 2);
      expect(heightOf(testCase.picture), `${label}: výška obrázku`).toBeCloseTo(498.67, 1);
    }
  });

  it('když se obrázek přes šířku okna nevejde, zmenší se na volnou výšku mezi domečkem a lištou a je vodorovně na středu', () => {
    for (const testCase of portraitCases().filter((each) => !fullWidthFits(each))) {
      const { label } = testCase.scene;
      const { picture, visible } = testCase;
      const height = freePortraitHeightOf(testCase);
      expect(heightOf(picture), `${label}: výška obrázku`).toBeCloseTo(height, 2);
      expect(widthOf(picture), `${label}: šířka obrázku`).toBeCloseTo((height * 3) / 4, 2);
      const left = picture.left - visible.left;
      const right = visible.right - picture.right;
      expect(
        Math.abs(left - right),
        `${label}: vlevo ${px(left)}, vpravo ${px(right)}`,
      ).toBeLessThanOrEqual(TOLERANCE);
      expect(left, `${label}: okraj vlevo`).toBeGreaterThanOrEqual(PICTURE_SIDE_MARGIN - TOLERANCE);
    }
  });

  it('na výšku leží obrázek svisle na středu mezi spodkem domečku a vrškem spodní lišty', () => {
    for (const testCase of portraitCases()) {
      const above = testCase.picture.top - testCase.home.bottom;
      const below = stripTopOf(testCase) - testCase.picture.bottom;
      expect(
        Math.abs(above - below),
        `${testCase.scene.label}: nad obrázkem ${px(above)}, pod ním ${px(below)}`,
      ).toBeLessThanOrEqual(TOLERANCE);
    }
  });

  it('na výšku je obrázek od domečku i od spodní lišty aspoň 8 px', () => {
    for (const testCase of portraitCases()) {
      const { label } = testCase.scene;
      const above = testCase.picture.top - testCase.home.bottom;
      const below = stripTopOf(testCase) - testCase.picture.bottom;
      expect(above, `${label}: od domečku`).toBeGreaterThanOrEqual(MIN_TAP_GAP - TOLERANCE);
      expect(below, `${label}: od lišty`).toBeGreaterThanOrEqual(MIN_TAP_GAP - TOLERANCE);
    }
  });
});

describe('#111 AC3: obrázek leží mezi lištami, ne pod nimi', () => {
  it('domeček, úchyt, Zpět a obě nedávné barvy leží ve všech oknech mimo obrázek s mezerou aspoň 8 px', () => {
    for (const testCase of cases()) {
      const controls: Array<[string, Box]> = [
        [HOME_NAME, testCase.home],
        [HANDLE_NAME, testCase.handle],
        [UNDO_NAME, testCase.undo],
        ...testCase.recentColors.map((box, index): [string, Box] => [recentColorName(index), box]),
      ];
      expect(controls.length, `${testCase.scene.label}: ovládání v pruhu`).toBe(5);
      for (const [name, control] of controls) {
        const gap = gapBetween(control, testCase.picture);
        expect(
          gap,
          `${testCase.scene.label}: mezi ${name} a obrázkem ${px(gap)}`,
        ).toBeGreaterThanOrEqual(MIN_TAP_GAP - TOLERANCE);
      }
    }
  });

  it('kratší strana obrázku má ve všech oknech dál aspoň 240 px', () => {
    for (const testCase of cases()) {
      const shorter = Math.min(widthOf(testCase.picture), heightOf(testCase.picture));
      expect(shorter, `${testCase.scene.label}: kratší strana obrázku`).toBeGreaterThanOrEqual(
        MIN_PICTURE_SIDE,
      );
    }
  });
});

describe('#111 AC4: na šířku sahá obrázek až k hornímu a dolnímu okraji', () => {
  it('zkouší se okna, kde šířka obrázek přes celou výšku dovolí, i okna, kde nedovolí', () => {
    const kinds = new Set(landscapeCases().map(fullHeightFits));
    expect([...kinds].sort(), 'obě situace').toEqual([false, true]);
  });

  it('když to šířka vedle pruhu dovolí, sahá obrázek k hornímu i dolnímu okraji volné plochy', () => {
    for (const testCase of landscapeCases().filter(fullHeightFits)) {
      const { label } = testCase.scene;
      const { picture, visible } = testCase;
      expect(picture.top - visible.top, `${label}: od horního okraje`).toBeCloseTo(0, 2);
      expect(visible.bottom - picture.bottom, `${label}: od dolního okraje`).toBeCloseTo(0, 2);
    }
  });

  it('obrázek přes celou výšku leží vodorovně na středu mezi pruhem + 8 px a pravým okrajem − 8 px', () => {
    for (const testCase of landscapeCases().filter(fullHeightFits)) {
      const space = landscapeSpaceOf(testCase);
      const left = testCase.picture.left - space.left;
      const right = space.right - testCase.picture.right;
      const label = `${testCase.scene.label}: vlevo ${px(left)}, vpravo ${px(right)}`;
      expect(left, label).toBeGreaterThanOrEqual(-TOLERANCE);
      expect(Math.abs(left - right), label).toBeLessThanOrEqual(TOLERANCE);
    }
  });

  it('když šířka nestačí, je obrázek co nejširší (8 px od pruhu i od pravého okraje) a svisle na středu', () => {
    for (const testCase of landscapeCases().filter((each) => !fullHeightFits(each))) {
      const space = landscapeSpaceOf(testCase);
      const { picture } = testCase;
      const above = picture.top - space.top;
      const below = space.bottom - picture.bottom;
      const label = testCase.scene.label;
      expect(picture.left, `${label}: levý okraj obrázku`).toBeCloseTo(space.left, 2);
      expect(picture.right, `${label}: pravý okraj obrázku`).toBeCloseTo(space.right, 2);
      expect(
        Math.abs(above - below),
        `${label}: nad ${px(above)}, pod ${px(below)}`,
      ).toBeLessThanOrEqual(TOLERANCE);
    }
  });

  it('na šířku má obrázek poměr stran 4 : 3, nic se neořízne ani nezdeformuje', () => {
    for (const testCase of landscapeCases()) {
      const { picture } = testCase;
      expect(widthOf(picture), `${testCase.scene.label}: šířka obrázku`).toBeCloseTo(
        heightOf(picture) * PICTURE_ASPECT,
        2,
      );
    }
  });

  /** Okna z tabulky AC4: šířka a výška okna, očekávaná výška obrázku, případně šířka. */
  const AC4_TABLE: ReadonlyArray<{
    readonly what: string;
    readonly matches: (testCase: ColoringCase) => boolean;
    readonly height: number | 'celá výška';
    readonly width?: number;
    readonly centered?: boolean;
  }> = [
    {
      what: '1180 × 760',
      matches: (testCase) => testCase.window.width === 1180 && testCase.window.height === 760,
      height: 'celá výška',
    },
    {
      what: 'iPad z plochy (1180 × 776)',
      matches: (testCase) => testCase.window.width === 1180 && heightOf(testCase.visible) === 776,
      height: 'celá výška',
    },
    {
      what: 'telefon 932 × 430',
      matches: (testCase) => testCase.window.width === 932 && testCase.window.height === 430,
      height: 409,
    },
    {
      what: 'telefon 744 × 296',
      matches: (testCase) => testCase.window.width === 744 && testCase.window.height === 296,
      height: 296,
    },
    {
      what: 'iPad 1180 × 820',
      matches: (testCase) =>
        testCase.window.width === 1180 &&
        testCase.window.height === 820 &&
        heightOf(testCase.visible) === 820,
      height: 807,
      width: 1076,
      centered: true,
    },
  ];

  it('obrázek má v oknech z tabulky zadání předepsanou velikost', () => {
    for (const row of AC4_TABLE) {
      const rowCases = landscapeCases().filter(row.matches);
      expect(rowCases.length, `${row.what}: okno se zkouší`).toBeGreaterThan(0);
      for (const testCase of rowCases) {
        const { label } = testCase.scene;
        const { picture, visible } = testCase;
        const height = row.height === 'celá výška' ? heightOf(visible) : row.height;
        expect(heightOf(picture), `${row.what}, ${label}: výška obrázku`).toBeCloseTo(height, 1);
        if (row.width !== undefined) {
          expect(widthOf(picture), `${row.what}, ${label}: šířka obrázku`).toBeCloseTo(
            row.width,
            1,
          );
        }
        if (row.centered === true) {
          const above = picture.top - visible.top;
          const below = visible.bottom - picture.bottom;
          expect(
            Math.abs(above - below),
            `${row.what}, ${label}: nad ${px(above)}, pod ${px(below)}`,
          ).toBeLessThanOrEqual(TOLERANCE);
        }
      }
    }
  });

  it('výjimka 0 px od okraje platí jen pro obrázek na šířku, ostatní prvky mají dál aspoň 4 px', () => {
    // Rozhodnutí 2026-11-08: obrázek smí sahat k okraji volné plochy, ochrana
    // „aspoň 4 px od okraje“ se jinde nesnižuje.
    expect(PICTURE_EDGE_EXCEPTION, 'schválená výjimka').toBe(0);
    for (const testCase of cases()) {
      for (const item of testCase.scene.items) {
        const isLandscapePicture = item.name === PICTURE_NAME && isLandscapeArea(testCase.area);
        const minEdge = item.minEdge ?? MIN_EDGE_DISTANCE;
        expect(
          isLandscapePicture || minEdge >= MIN_EDGE_DISTANCE,
          `${testCase.scene.label}: ${item.name} má odstup od okraje ${px(minEdge)}`,
        ).toBe(true);
      }
    }
  });
});
