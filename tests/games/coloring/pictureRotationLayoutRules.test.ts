import { describe, expect, it } from 'vitest';

import { layoutColoring } from '../../../src/games/coloring/logic/coloringLayout';
import type { ColoringLayout } from '../../../src/games/coloring/logic/coloringLayout';
import { homeButtonInFreeArea } from '../../../src/shared/logic/homeButton';
import type { GameArea } from '../../../src/shared/logic/viewportLayout';
import { MIN_EDGE_DISTANCE, MIN_TAP_GAP } from '../../shared/layoutRules';
import { boundsOf, gapBetween, heightOf, toCss, widthOf } from '../../shared/viewportFixtures';
import type { Box } from '../../shared/viewportFixtures';
import {
  HANDLE_NAME,
  HOME_NAME,
  PICTURE_EDGE_EXCEPTION,
  PICTURE_NAME,
  UNDO_NAME,
  boxOfRect,
  coloringCases,
  isLandscapeArea,
  recentColorName,
} from './coloringLayoutScenes';
import type { ColoringCase } from './coloringLayoutScenes';
import { PICTURE_MAY_MOVE_IN } from './layoutBefore142Fixture';

/**
 * Testy k #127 (na výšku se omalovánka neotáčí) a k #111 AC3, AC4, které
 * platí dál: #127 AC1 na výšku obrázek rovně přes šířku okna, #127 AC3
 * (= #111 AC3) obrázek mezi lištami a #111 AC4 na šířku obrázek až
 * k hornímu a dolnímu okraji (beze změny). Každé pravidlo má jeden test,
 * který v cyklu projde všechna okna (`COLORING_WINDOWS`) se zavřeným
 * panelem i v obou krocích panelu, případ je popsaný ve zprávě `expect`.
 * Obrazovku skládá `coloringLayoutScenes.ts`, společná pravidla (64 px,
 * 8 px, nic se nepřekrývá, vejde se, aspoň 4 px od okraje se schválenou
 * výjimkou 0 px jen pro obrázek na šířku) běží v `coloringLayoutRules.test.ts`.
 *
 * Šířka obrázku na výšku se měří jako v #111: šířka volné plochy okna, kde
 * je hra vidět (`visible`), bez bočních okrajů 8 px (komentář k #127).
 *
 * Zmenšovací pravidlo #127 AC1 (výška 3/4 šířky se nevejde mezi domeček
 * a lištu) se v žádném okně z `COLORING_WINDOWS` neuplatní: rozložení P-A
 * dostane jen telefon na výšku (okno užší než 500 px s volnou výškou
 * aspoň 620 px) a tam je volná výška vždy aspoň 460 px, obrázek přes
 * šířku nejvýš 362,25 px. Pravidlo je pojistka pro neznámá okna (otázka 2)
 * a ověří se na jedné přidané téměř čtvercové herní ploše na výšku
 * 480 × 500 CSS px (`NEARLY_SQUARE_PORTRAIT_AREA`), kterou dostane přímo
 * `layoutColoring`. Že má jistě rozložení P-A, hlídá vlastní test.
 *
 * Nahrazené testy #111 na výšku (otočený obrázek, AC5 v #127):
 * - „na výšku otočený o 90°“ a „na šířku nikdy otočený není“ (pole
 *   `pictureTurn`) nahrazuje „na výšku i na šířku leží obrázek naležato“
 *   a v `pictureRotationTouch.test.ts` „levý horní roh obrázku je levý
 *   horní roh omalovánky“ ve všech oknech (chování, ne pole rozložení),
 * - „výška 4/3 šířky“ nahrazuje „výška 3/4 šířky“,
 * - „390 × 844 má 374 × 498,7 px“ nahrazuje „390 × 844 má 374 × 280,5 px
 *   a 360 × 620 má 344 × 258 px“,
 * - „okna, kde se vejde i kde ne (414 × 622)“ a „zmenší se na volnou výšku“
 *   nahrazují testy zmenšovacího pravidla na přidané téměř čtvercové ploše,
 * - šířka bez okrajů 8 px, svisle na středu a aspoň 8 px od domečku i lišty
 *   zůstávají a běží navíc i na přidané ploše.
 */

/** Poměr stran obrázku (1024 × 768). */
const PICTURE_ASPECT = 4 / 3;

/** Boční okraje obrázku na výšku a odstup od pruhu na šířku v CSS px (AC1, #111 AC4). */
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

/**
 * Přidaná téměř čtvercová herní plocha telefonu na výšku (#127, otázka 2):
 * 480 × 500 CSS px bez výřezu, 2 herní jednotky na CSS px jako u telefonu.
 * Mezi domečkem a lištou zbývá tak málo místa, že se obrázek přes šířku
 * nevejde.
 */
const NEARLY_SQUARE_PORTRAIT_AREA: GameArea = {
  mode: 'phonePortrait',
  width: 960,
  height: 1000,
  scale: 0.5,
  offsetX: 0,
  offsetY: 0,
};

/** Co pravidla obrázku na výšku potřebují, v CSS px okna. */
interface PortraitPicture {
  readonly label: string;
  readonly layout: ColoringLayout;
  /** Volná plocha, kde je hra vidět. */
  readonly visible: Box;
  readonly picture: Box;
  /** Plocha domečku pro prst. */
  readonly home: Box;
  readonly handle: Box;
  readonly undo: Box;
  readonly recentColors: readonly Box[];
}

function portraitPictureOf(testCase: ColoringCase): PortraitPicture {
  return { ...testCase, label: testCase.scene.label };
}

/** Přidaná plocha jako obrazovka pro pravidla (vidět je celá herní plocha). */
function nearlySquarePicture(): PortraitPicture {
  const area = NEARLY_SQUARE_PORTRAIT_AREA;
  const layout = layoutColoring(area);
  const css = (box: Box): Box => toCss(box, area);
  const home = homeButtonInFreeArea(area);
  return {
    label: 'přidaná téměř čtvercová plocha na výšku 480 × 500',
    layout,
    visible: css({ left: 0, right: area.width, top: 0, bottom: area.height }),
    picture: css(boxOfRect(layout.picture)),
    home: css({
      left: home.left,
      right: home.left + home.size,
      top: home.top,
      bottom: home.top + home.size,
    }),
    handle: css(boxOfRect(layout.handle)),
    undo: css(boxOfRect(layout.undoButton)),
    recentColors: layout.recentColors.map((rect) => css(boxOfRect(rect))),
  };
}

/** Všechna okna na výšku a přidaná plocha. */
function allPortraitPictures(): PortraitPicture[] {
  return [...portraitCases().map(portraitPictureOf), nearlySquarePicture()];
}

/** Vršek spodní lišty na výšku: nedávné barvy, úchyt a Zpět. */
function stripTopOf(portrait: PortraitPicture): number {
  return Math.min(...[portrait.handle, portrait.undo, ...portrait.recentColors].map((b) => b.top));
}

/** Volná výška pro obrázek na výšku: mezi domečkem a lištou bez 8 px z obou stran (AC1). */
function freePortraitHeightOf(portrait: PortraitPicture): number {
  return stripTopOf(portrait) - portrait.home.bottom - 2 * MIN_TAP_GAP;
}

/** Šířka obrázku přes šířku okna bez bočních okrajů 8 px (měřeno jako v #111). */
function fullWidthOf(portrait: PortraitPicture): number {
  return widthOf(portrait.visible) - 2 * PICTURE_SIDE_MARGIN;
}

/** Vejde se na výšku obrázek přes šířku okna s výškou 3/4 šířky (AC1)? */
function fullWidthFits(portrait: PortraitPicture): boolean {
  return fullWidthOf(portrait) / PICTURE_ASPECT <= freePortraitHeightOf(portrait) + TOLERANCE;
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

describe('#127 AC1: na výšku je obrázek rovně přes šířku okna', () => {
  it('zkouší se okna na výšku i na šířku, zavřený panel i oba kroky', () => {
    expect(portraitCases().length, 'okna na výšku').toBeGreaterThan(0);
    expect(landscapeCases().length, 'okna na šířku').toBeGreaterThan(0);
    const panels = new Set(cases().map((testCase) => testCase.panel));
    expect([...panels].sort()).toEqual(['closed', 'colors', 'tools']);
  });

  it('přidaná téměř čtvercová plocha má jistě rozložení na výšku (P-A): pruh dole, panel zdola', () => {
    const area = NEARLY_SQUARE_PORTRAIT_AREA;
    const portrait = nearlySquarePicture();
    const { label } = portrait;
    expect(area.width < area.height, `${label}: plocha je na výšku`).toBe(true);
    expect(area.mode, `${label}: telefon na výšku`).toBe('phonePortrait');
    expect(portrait.layout.panelSlidesFrom, `${label}: panel vyjíždí`).toBe('bottom');
    expect(stripTopOf(portrait), `${label}: lišta leží pod obrázkem`).toBeGreaterThanOrEqual(
      portrait.picture.bottom,
    );
    expect(portrait.handle.left, `${label}: úchyt je vpravo od nedávných barev`).toBeGreaterThan(
      Math.max(...portrait.recentColors.map((box) => box.left)),
    );
    expect(portrait.undo.left, `${label}: Zpět je vpravo od úchytu`).toBeGreaterThan(
      portrait.handle.left,
    );
  });

  it('zkouší se plochy na výšku, kde se obrázek přes šířku okna vejde, i plocha, kde ne', () => {
    const kinds = new Set(allPortraitPictures().map(fullWidthFits));
    expect([...kinds].sort(), 'obě situace').toEqual([false, true]);
    expect(fullWidthFits(nearlySquarePicture()), 'přidaná plocha: přes šířku se nevejde').toBe(
      false,
    );
  });

  it('na výšku i na šířku leží obrázek naležato a nezdeformovaný: šířka je 4/3 výšky', () => {
    const all = [...cases().map(portraitPictureOf), nearlySquarePicture()];
    for (const each of all) {
      const { picture } = each;
      expect(
        widthOf(picture) / heightOf(picture),
        `${each.label}: šířka ${px(widthOf(picture))}, výška ${px(heightOf(picture))}`,
      ).toBeCloseTo(PICTURE_ASPECT, 3);
    }
  });

  it('na výšku má obrázek šířku okna bez bočních okrajů 8 px, když se tak vejde mezi domeček a lištu', () => {
    const fitting = allPortraitPictures().filter(fullWidthFits);
    expect(fitting.length, 'takových oken je víc').toBeGreaterThan(0);
    for (const portrait of fitting) {
      const { label, picture, visible } = portrait;
      expect(picture.left - visible.left, `${label}: okraj vlevo`).toBeCloseTo(
        PICTURE_SIDE_MARGIN,
        2,
      );
      expect(visible.right - picture.right, `${label}: okraj vpravo`).toBeCloseTo(
        PICTURE_SIDE_MARGIN,
        2,
      );
      expect(heightOf(picture), `${label}: výška 3/4 šířky`).toBeCloseTo(
        fullWidthOf(portrait) / PICTURE_ASPECT,
        2,
      );
    }
  });

  /** Okna ze schválených obrázků (komentář k #127): šířka a výška obrázku v CSS px. */
  const AC1_TABLE: ReadonlyArray<readonly [number, number, number, number]> = [
    [390, 844, 374, 280.5],
    [360, 620, 344, 258],
  ];

  it('v okně 390 × 844 má obrázek 374 × 280,5 px a v okně 360 × 620 má 344 × 258 px', () => {
    for (const [windowWidth, windowHeight, width, height] of AC1_TABLE) {
      const rowCases = portraitCases().filter(
        (testCase) =>
          testCase.window.width === windowWidth && testCase.window.height === windowHeight,
      );
      const what = `${String(windowWidth)} × ${String(windowHeight)}`;
      expect(rowCases.length, `okno ${what} se zkouší`).toBeGreaterThan(0);
      for (const testCase of rowCases) {
        const { label } = testCase.scene;
        expect(widthOf(testCase.picture), `${label}: šířka obrázku`).toBeCloseTo(width, 2);
        expect(heightOf(testCase.picture), `${label}: výška obrázku`).toBeCloseTo(height, 2);
      }
    }
  });

  it('když se obrázek přes šířku okna nevejde, má volnou výšku mezi domečkem a lištou, šířku 4/3 výšky a je vodorovně na středu', () => {
    const shrunk = allPortraitPictures().filter((each) => !fullWidthFits(each));
    expect(shrunk.length, 'aspoň přidaná plocha').toBeGreaterThan(0);
    for (const portrait of shrunk) {
      const { label, picture, visible } = portrait;
      const height = freePortraitHeightOf(portrait);
      expect(heightOf(picture), `${label}: výška obrázku`).toBeCloseTo(height, 2);
      expect(widthOf(picture), `${label}: šířka obrázku`).toBeCloseTo(height * PICTURE_ASPECT, 2);
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
    for (const portrait of allPortraitPictures()) {
      const above = portrait.picture.top - portrait.home.bottom;
      const below = stripTopOf(portrait) - portrait.picture.bottom;
      expect(
        Math.abs(above - below),
        `${portrait.label}: nad obrázkem ${px(above)}, pod ním ${px(below)}`,
      ).toBeLessThanOrEqual(TOLERANCE);
    }
  });

  it('na výšku je obrázek od domečku i od spodní lišty aspoň 8 px', () => {
    for (const portrait of allPortraitPictures()) {
      const { label } = portrait;
      const above = portrait.picture.top - portrait.home.bottom;
      const below = stripTopOf(portrait) - portrait.picture.bottom;
      expect(above, `${label}: od domečku`).toBeGreaterThanOrEqual(MIN_TAP_GAP - TOLERANCE);
      expect(below, `${label}: od lišty`).toBeGreaterThanOrEqual(MIN_TAP_GAP - TOLERANCE);
    }
  });
});

describe('#127 AC3 (#111 AC3 beze změny): obrázek leží mezi lištami, ne pod nimi', () => {
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
    const all = [...cases().map(portraitPictureOf), nearlySquarePicture()];
    for (const each of all) {
      const shorter = Math.min(widthOf(each.picture), heightOf(each.picture));
      expect(shorter, `${each.label}: kratší strana obrázku`).toBeGreaterThanOrEqual(
        MIN_PICTURE_SIDE,
      );
    }
  });
});

describe('#111 AC4 (#127 AC1 na šířku beze změny): na šířku sahá obrázek až k hornímu a dolnímu okraji', () => {
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
    // V 932×499 s výřezem se obrázek od #142 AC6 posune doprava za koště
    // (hlídá broomLayoutRules.test.ts), jinde zůstává na středu.
    const centered = landscapeCases().filter(
      (each) => fullHeightFits(each) && each.window.name !== PICTURE_MAY_MOVE_IN,
    );
    for (const testCase of centered) {
      const space = landscapeSpaceOf(testCase);
      const left = testCase.picture.left - space.left;
      const right = space.right - testCase.picture.right;
      const label = `${testCase.scene.label}: vlevo ${px(left)}, vpravo ${px(right)}`;
      expect(left, label).toBeGreaterThanOrEqual(-TOLERANCE);
      expect(Math.abs(left - right), label).toBeLessThanOrEqual(TOLERANCE);
    }
  });

  it('v 932×499 s výřezem leží obrázek mezi koštětem + 8 px a pravým okrajem − 8 px (#142 AC6)', () => {
    // Náhrada za kontrolu na středu, která toto okno od #142 vynechává.
    const moved = landscapeCases().filter((each) => each.window.name === PICTURE_MAY_MOVE_IN);
    expect(moved.length, 'okno je mezi případy').toBeGreaterThan(0);
    for (const testCase of moved) {
      const broom = toCss(boxOfRect(testCase.layout.broomButton), testCase.area);
      const label = testCase.scene.label;
      expect(testCase.picture.left, `${label}: 8 px od koštěte`).toBeGreaterThanOrEqual(
        broom.right + PICTURE_SIDE_MARGIN - TOLERANCE,
      );
      expect(testCase.picture.right, `${label}: 8 px od pravého okraje`).toBeLessThanOrEqual(
        testCase.visible.right - PICTURE_SIDE_MARGIN + TOLERANCE,
      );
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
