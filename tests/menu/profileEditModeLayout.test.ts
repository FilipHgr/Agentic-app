import { describe, expect, it } from 'vitest';

import type { MenuBox } from '../../src/menu/logic/menuLayout';
import type { ProfilePickerLayout } from '../../src/menu/logic/profileLayout';
import { PROFILE_EDIT_WOBBLE } from '../../src/menu/logic/profilePickerAppearance';
import { MAX_PROFILES } from '../../src/menu/logic/profileScreens';
import { LANGUAGES } from '../../src/shared/texts/languages';
import type { LayoutItem, LayoutScene } from '../shared/layoutRules';
import { freeAreaOf, gapBetween, heightOf, widthOf } from '../shared/viewportFixtures';
import type { TestWindow } from '../shared/viewportFixtures';
import { MENU_WINDOWS } from './manyGamesFixtures';
import { MENU_LAYOUT_RULES, WIDEST_NICKNAME, pickerLayout } from './menuLayoutScenes';

/**
 * Testy k #160 AC1 a AC4: rozložení jediné tužky v liště výběru profilu
 * (vlevo od tlačítka jazyka) a odznaků tužky na kolečkách v režimu úprav.
 * Nahrazují pravidla tužky u kolečka z #107 (`profilePencilLayout.test.ts`)
 * a mezery kolečko–tužka z #113 (`profilePencilGap.test.ts`).
 *
 * Každé pravidlo je jeden test, který v cyklu projde všechna zkušební okna
 * menu (iPad i telefon, na šířku i na výšku, s výřezem i bez) a 1 až 6
 * profilů bez „+“ i 1 až 5 profilů s „+“ (se 6 profily se „+“ neukáže);
 * zpráva při selhání řekne okno a počet profilů.
 *
 * Navržené rozhraní (`src/menu/logic/profileLayout.ts`), místo
 * `ProfilePickerSlot.pencil` z #107:
 * - `ProfilePickerLayout.editPencil: MenuBox`: ťukací plocha tužky v liště
 *   vlevo od `languageSlot`, je tam vždy (i s jediným profilem),
 * - `ProfilePickerSlot.editBadge: MenuBox`: čtverec, do kterého se vepíše
 *   kulatý odznak tužky na kolečku; v rozložení je vždy, scéna ho kreslí
 *   jen v režimu úprav. Odznak není samostatná ťukací plocha, ťuknutí na
 *   něj je ťuknutí na kolečko,
 * - `ProfilePickerSlot` už nemá `pencil`.
 * Vzhled označené tužky a odznaku se kontroluje ručně.
 *
 * #197 AC4 a AC5: odznak je vpravo nahoře na okraji kolečka a kolečka se
 * v úpravách pohupují (`PROFILE_EDIT_WOBBLE`). Odznak se proto měří i ve
 * krajních polohách pohupování a pravidla se v cyklu zkouší pro všechna
 * okna, 1–6 profilů, každý jazyk (zkratka na tlačítku) a běžný i upravovací
 * režim.
 */

const TOLERANCE = 0.01;
/** Tužka je velká aspoň jako ťukací plocha pro dětský prst (AC1). */
const MIN_PENCIL_SIZE = 64;
/** Tužka a jazyk jsou od sebe a od okraje bezpečné plochy aspoň 8 px (AC4). */
const BAR_GAP = 8;
const WIDE_LETTER = 1;
const NICKNAME_LINE_HEIGHT = 20;

interface PickerCase {
  readonly name: string;
  readonly count: number;
  readonly add: boolean;
}

/** 1 až 6 profilů bez „+“ a 1 až 5 profilů s „+“. */
const PICKER_CASES: readonly PickerCase[] = Array.from({ length: MAX_PROFILES }, (_, index) => {
  const count = index + 1;
  const cases: PickerCase[] = [{ name: `${count} bez „+“`, count, add: false }];
  if (count < MAX_PROFILES) {
    cases.push({ name: `${count} a „+“`, count, add: true });
  }
  return cases;
}).flat();

interface LayoutCase {
  readonly label: string;
  readonly window: TestWindow;
  readonly layout: ProfilePickerLayout;
}

function allCases(): LayoutCase[] {
  return PICKER_CASES.flatMap((pickerCase) =>
    MENU_WINDOWS.map((window) => ({
      label: `${window.name}, ${pickerCase.name}`,
      window,
      layout: pickerLayout(window, pickerCase.count, pickerCase.add),
    })),
  );
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Nejmenší odstup plochy od okraje bezpečné plochy okna (záporný = přesah). */
function edgeDistance(box: MenuBox, free: MenuBox): number {
  return Math.min(
    box.left - free.left,
    free.right - box.right,
    box.top - free.top,
    free.bottom - box.bottom,
  );
}

/** Kulatý odznak vepsaný do svého čtverce leží celý uvnitř kulatého kolečka? */
function badgeOutsideBy(badge: MenuBox, circle: MenuBox): number {
  const circleRadius = widthOf(circle) / 2;
  const badgeRadius = Math.min(widthOf(badge), heightOf(badge)) / 2;
  const dx = (badge.left + badge.right) / 2 - (circle.left + circle.right) / 2;
  const dy = (badge.top + badge.bottom) / 2 - (circle.top + circle.bottom) / 2;
  return Math.hypot(dx, dy) + badgeRadius - circleRadius;
}

/**
 * Přibližný box velkého tučného písmene v kolečku (#160, úprava odznaku):
 * široké W má šířku asi jako velikost písma, velké písmeno sahá asi 0,38
 * velikosti nad střed a 0,42 pod střed (scéna písmeno posouvá o 0,04 dolů).
 */
const LETTER_HALF_WIDTH = 0.5;
const LETTER_ABOVE_CENTER = 0.38;
const LETTER_BELOW_CENTER = 0.42;

function letterBoxOf(circle: MenuBox, fontSize: number): MenuBox {
  const centerX = (circle.left + circle.right) / 2;
  const centerY = (circle.top + circle.bottom) / 2;
  return {
    left: centerX - LETTER_HALF_WIDTH * fontSize,
    right: centerX + LETTER_HALF_WIDTH * fontSize,
    top: centerY - LETTER_ABOVE_CENTER * fontSize,
    bottom: centerY + LETTER_BELOW_CENTER * fontSize,
  };
}

/** Vzdálenost bodu od obdélníku (0 uvnitř). */
function circleToBoxDistance(x: number, y: number, box: MenuBox): number {
  const dx = Math.max(box.left - x, 0, x - box.right);
  const dy = Math.max(box.top - y, 0, y - box.bottom);
  return Math.hypot(dx, dy);
}

/** Výběr profilu s tužkou v liště pro společná pravidla (`tests/shared/layoutRules.ts`). */
function editModeScene({ label, window, layout }: LayoutCase): LayoutScene {
  const symbol = { text: 'W', fontSize: layout.symbolFontSize, charWidth: WIDE_LETTER };
  const items: LayoutItem[] = [
    {
      name: 'tlačítko jazyka',
      box: layout.languageSlot,
      tappable: true,
      minEdge: BAR_GAP,
      texts: LANGUAGES.map((code) => ({
        text: code.toUpperCase(),
        fontSize: layout.languageButtonFontSize,
      })),
    },
    // AC4: tužku dělí od okraje bezpečné plochy aspoň 8 px (ne jen 4 px jako ostatní).
    { name: 'tužka v liště', box: layout.editPencil, tappable: true, minEdge: BAR_GAP },
    ...layout.profiles.flatMap((slot, index): LayoutItem[] => [
      // Odznak leží v kolečku (pravidlo níž), proto se jako samostatný prvek nepřidává.
      { name: `kolečko ${index + 1}`, box: slot.circle, tappable: true, texts: [symbol] },
      {
        name: `přezdívka ${index + 1}`,
        box: slot.nickname,
        texts: [
          {
            text: WIDEST_NICKNAME,
            fontSize: layout.nicknameFontSize,
            charWidth: WIDE_LETTER,
            maxLines: layout.nicknameMaxLines,
            lineHeight: NICKNAME_LINE_HEIGHT,
            padding: 0,
          },
        ],
      },
    ]),
  ];
  if (layout.add !== null) {
    items.push({ name: '„+“', box: layout.add, tappable: true, texts: [symbol] });
  }
  return {
    label: `výběr profilu s tužkou v liště, ${label}`,
    free: freeAreaOf(window),
    items,
  };
}

describe('#160 AC1: jedna tužka v liště vlevo od jazyka, u koleček žádná', () => {
  it('u koleček profilů ani u „+“ není žádná tužka', () => {
    for (const { label, layout } of allCases()) {
      layout.profiles.forEach((slot, index) => {
        expect('pencil' in slot, `${label}: kolečko ${index + 1} má tužku`).toBe(false);
      });
    }
  });

  it(`tužka v liště je v každém okně a pro každý počet profilů, velká aspoň ${MIN_PENCIL_SIZE} × ${MIN_PENCIL_SIZE} px`, () => {
    for (const { label, layout } of allCases()) {
      const pencil = layout.editPencil;
      expect(pencil, label).toBeDefined();
      expect(widthOf(pencil), `${label}: šířka`).toBeGreaterThanOrEqual(
        MIN_PENCIL_SIZE - TOLERANCE,
      );
      expect(heightOf(pencil), `${label}: výška`).toBeGreaterThanOrEqual(
        MIN_PENCIL_SIZE - TOLERANCE,
      );
    }
  });

  it('tužka je v liště vlevo od tlačítka jazyka: celá vlevo od něj a ve stejné výšce', () => {
    for (const { label, layout } of allCases()) {
      const pencil = layout.editPencil;
      const language = layout.languageSlot;
      expect(pencil.right, `${label}: tužka vlevo od jazyka`).toBeLessThanOrEqual(
        language.left + TOLERANCE,
      );
      const pencilMiddle = (pencil.top + pencil.bottom) / 2;
      expect(
        pencilMiddle >= language.top - TOLERANCE && pencilMiddle <= language.bottom + TOLERANCE,
        `${label}: střed tužky (${round(pencilMiddle)} px) je ve výšce jazyka ${round(language.top)}–${round(language.bottom)} px`,
      ).toBe(true);
    }
  });
});

describe('#160 AC4: tužka a jazyk jsou od sebe a od okraje bezpečné plochy aspoň 8 px', () => {
  it('mezi tužkou a tlačítkem jazyka je aspoň 8 px', () => {
    for (const { label, layout } of allCases()) {
      const gap = gapBetween(layout.editPencil, layout.languageSlot);
      expect(gap, `${label}: mezera ${round(gap)} px`).toBeGreaterThanOrEqual(BAR_GAP - TOLERANCE);
    }
  });

  it('tužka i tlačítko jazyka jsou aspoň 8 px od okraje bezpečné plochy (výřez, lišta domů)', () => {
    for (const { label, window, layout } of allCases()) {
      const free = freeAreaOf(window);
      for (const [name, box] of [
        ['tužka', layout.editPencil],
        ['tlačítko jazyka', layout.languageSlot],
      ] as const) {
        const distance = edgeDistance(box, free);
        expect(
          distance,
          `${label}: ${name} je ${round(distance)} px od okraje`,
        ).toBeGreaterThanOrEqual(BAR_GAP - TOLERANCE);
      }
    }
  });

  it('tužka je aspoň 8 px od každého kolečka, přezdívky a „+“', () => {
    for (const scene of allCases().map(editModeScene)) {
      const pencil = scene.items.find((item) => item.name === 'tužka v liště');
      const tooClose = scene.items
        .filter((item) => item !== pencil && pencil !== undefined)
        .filter((item) => gapBetween(item.box, pencil?.box ?? item.box) < BAR_GAP - TOLERANCE)
        .map((item) => item.name);
      expect(tooClose, scene.label).toEqual([]);
    }
  });
});

describe('#160 AC4 a #197 AC1: odznak tužky na kolečku', () => {
  // #197 AC1 posunul odznak z vnitřku kolečka vpravo dole na okraj kolečka
  // vpravo nahoře („nad kolečkem“). Pravidlo „celý uvnitř kolečka“ z #160
  // nahrazuje #197 AC4 níž: odznak zůstává v ťukacím čtverci kolečka.
  it('každé kolečko má kulatý odznak vpravo nahoře, který přesahuje obvod kolečka (#197 AC1)', () => {
    for (const { label, layout } of allCases()) {
      layout.profiles.forEach((slot, index) => {
        const where = `${label}: kolečko ${index + 1}`;
        const badge = slot.editBadge;
        expect(badge, where).toBeDefined();
        expect(widthOf(badge), `${where}: odznak má velikost`).toBeGreaterThan(0);
        expect(heightOf(badge), `${where}: odznak je čtverec`).toBeCloseTo(widthOf(badge), 5);
        const dx = (badge.left + badge.right) / 2 - (slot.circle.left + slot.circle.right) / 2;
        const dy = (badge.top + badge.bottom) / 2 - (slot.circle.top + slot.circle.bottom) / 2;
        expect(dx, `${where}: střed odznaku vpravo od středu kolečka`).toBeGreaterThan(0);
        expect(dy, `${where}: střed odznaku nad středem kolečka`).toBeLessThan(0);
        const outside = badgeOutsideBy(badge, slot.circle);
        expect(outside, `${where}: odznak přesahuje obvod o ${round(outside)} px`).toBeGreaterThan(
          0,
        );
      });
    }
  });

  it('odznak nezakrývá písmeno profilu: kulatý odznak se nepřekrývá s přibližným boxem velkého písmene (i širokého W)', () => {
    for (const { label, layout } of allCases()) {
      layout.profiles.forEach((slot, index) => {
        const where = `${label}: kolečko ${index + 1}`;
        const letter = letterBoxOf(slot.circle, layout.symbolFontSize);
        const badge = slot.editBadge;
        const badgeRadius = widthOf(badge) / 2;
        const distance = circleToBoxDistance(
          (badge.left + badge.right) / 2,
          (badge.top + badge.bottom) / 2,
          letter,
        );
        expect(
          distance,
          `${where}: odznak (poloměr ${round(badgeRadius)} px) je ${round(distance)} px od písmene`,
        ).toBeGreaterThanOrEqual(badgeRadius - TOLERANCE);
      });
    }
  });

  it('„+“ odznak nemá: odznaků je stejně jako profilů', () => {
    for (const { label, layout } of allCases()) {
      const badges = layout.profiles.map((slot) => slot.editBadge);
      expect(badges, label).toHaveLength(layout.profiles.length);
      const plus = layout.add;
      if (plus !== null) {
        const onPlus = badges.filter((badge) => gapBetween(badge, plus) < 0);
        expect(onPlus, `${label}: odznak na „+“`).toHaveLength(0);
      }
    }
  });
});

describe('#160 AC4: výběr profilu s tužkou v liště dodrží společná pravidla v každém okně a pro 1–6 profilů', () => {
  for (const [ruleName, rule] of Object.entries(MENU_LAYOUT_RULES)) {
    it(`${ruleName}`, () => {
      for (const scene of allCases().map(editModeScene)) {
        expect(rule(scene), scene.label).toEqual([]);
      }
    });
  }

  it('případy pokrývají všechna okna menu a 11 kombinací počtu profilů a „+“', () => {
    expect(PICKER_CASES).toHaveLength(11);
    expect(allCases()).toHaveLength(PICKER_CASES.length * MENU_WINDOWS.length);
  });
});

// ---------------------------------------------------------------------------
// #197 AC4 a AC5: odznak vpravo nahoře a pohupování koleček
// ---------------------------------------------------------------------------

/** Bod otočený o `degrees` kolem středu. */
function rotatedAround(
  x: number,
  y: number,
  centerX: number,
  centerY: number,
  degrees: number,
): { x: number; y: number } {
  const angle = (degrees * Math.PI) / 180;
  const dx = x - centerX;
  const dy = y - centerY;
  return {
    x: centerX + dx * Math.cos(angle) - dy * Math.sin(angle),
    y: centerY + dx * Math.sin(angle) + dy * Math.cos(angle),
  };
}

/**
 * Plocha, kterou kulatý odznak zabere během pohupování kolečka (kolečko se
 * s odznakem otáčí kolem svého středu nejvýš o `PROFILE_EDIT_WOBBLE`).
 * Odznak je kulatý, jeho vlastní zhoupnutí po zapnutí úprav plochu nemění.
 */
function sweptBadge(badge: MenuBox, circle: MenuBox): MenuBox {
  const radius = widthOf(badge) / 2;
  const circleX = (circle.left + circle.right) / 2;
  const circleY = (circle.top + circle.bottom) / 2;
  const badgeX = (badge.left + badge.right) / 2;
  const badgeY = (badge.top + badge.bottom) / 2;
  const steps = 8;
  const angle = PROFILE_EDIT_WOBBLE.angleDegrees;
  const centers = Array.from({ length: 2 * steps + 1 }, (_, index) =>
    rotatedAround(badgeX, badgeY, circleX, circleY, -angle + (index * angle) / steps),
  );
  return {
    left: Math.min(...centers.map((point) => point.x)) - radius,
    right: Math.max(...centers.map((point) => point.x)) + radius,
    top: Math.min(...centers.map((point) => point.y)) - radius,
    bottom: Math.max(...centers.map((point) => point.y)) + radius,
  };
}

type PickerMode = 'běžný' | 'úpravy';
const PICKER_MODES: readonly PickerMode[] = ['běžný', 'úpravy'];

interface ModeCase extends LayoutCase {
  readonly mode: PickerMode;
  readonly language: string;
}

/** Všechna okna × 1–6 profilů (s „+“ i bez) × každý jazyk × běžný i upravovací režim. */
function modeCases(): ModeCase[] {
  return allCases().flatMap((layoutCase) =>
    LANGUAGES.flatMap((language) =>
      PICKER_MODES.map((mode) => ({
        ...layoutCase,
        label: `${layoutCase.label}, ${language}, ${mode}`,
        mode,
        language,
      })),
    ),
  );
}

/**
 * Výběr profilu pro společná pravidla: v režimu úprav i s odznaky v ploše,
 * kterou zaberou při pohupování. Odznak smí ležet jen na svém kolečku.
 */
function modeScene({ label, window, layout, mode, language }: ModeCase): LayoutScene {
  const symbol = { text: 'W', fontSize: layout.symbolFontSize, charWidth: WIDE_LETTER };
  const items: LayoutItem[] = [
    {
      name: 'tlačítko jazyka',
      box: layout.languageSlot,
      tappable: true,
      minEdge: BAR_GAP,
      texts: [{ text: language.toUpperCase(), fontSize: layout.languageButtonFontSize }],
    },
    { name: 'tužka v liště', box: layout.editPencil, tappable: true, minEdge: BAR_GAP },
    ...layout.profiles.flatMap((slot, index): LayoutItem[] => [
      { name: `kolečko ${index + 1}`, box: slot.circle, tappable: true, texts: [symbol] },
      {
        name: `přezdívka ${index + 1}`,
        box: slot.nickname,
        texts: [
          {
            text: WIDEST_NICKNAME,
            fontSize: layout.nicknameFontSize,
            charWidth: WIDE_LETTER,
            maxLines: layout.nicknameMaxLines,
            lineHeight: NICKNAME_LINE_HEIGHT,
            padding: 0,
          },
        ],
      },
      ...(mode === 'úpravy'
        ? [{ name: `odznak ${index + 1}`, box: sweptBadge(slot.editBadge, slot.circle) }]
        : []),
    ]),
  ];
  if (layout.add !== null) {
    // V úpravách je „+“ ztlumené (#197 AC2), ťukací plocha zůstává.
    items.push({ name: '„+“', box: layout.add, tappable: true, texts: [symbol] });
  }
  const ownBadge = (first: LayoutItem, second: LayoutItem): boolean => {
    const numberOf = (item: LayoutItem, prefix: string): string | null =>
      item.name.startsWith(prefix) ? item.name.slice(prefix.length) : null;
    const pairs: Array<[LayoutItem, LayoutItem]> = [
      [first, second],
      [second, first],
    ];
    return pairs.some(([badge, circle]) => {
      const badgeNumber = numberOf(badge, 'odznak ');
      return badgeNumber !== null && badgeNumber === numberOf(circle, 'kolečko ');
    });
  };
  return {
    label: `výběr profilu, ${label}`,
    free: freeAreaOf(window),
    items,
    mayOverlap: ownBadge,
  };
}

describe('#197 AC4: odznak tužky nezakrývá písmeno ani přezdívku a ťuká se jako kolečko', () => {
  it('odznak leží i při pohupování celý v ťukací ploše svého kolečka, a ta má aspoň 64 × 64 px', () => {
    for (const { label, layout } of allCases()) {
      layout.profiles.forEach((slot, index) => {
        const where = `${label}: kolečko ${index + 1}`;
        const swept = sweptBadge(slot.editBadge, slot.circle);
        const outside = -edgeDistance(swept, slot.circle);
        expect(
          outside,
          `${where}: odznak přesahuje ťukací plochu kolečka o ${round(outside)} px`,
        ).toBeLessThanOrEqual(TOLERANCE);
        expect(widthOf(slot.circle), `${where}: šířka kolečka`).toBeGreaterThanOrEqual(
          MIN_PENCIL_SIZE - TOLERANCE,
        );
        expect(heightOf(slot.circle), `${where}: výška kolečka`).toBeGreaterThanOrEqual(
          MIN_PENCIL_SIZE - TOLERANCE,
        );
      });
    }
  });

  it('odznak nezakrývá přezdívku: je nad ní a nedotkne se jí ani při pohupování', () => {
    for (const { label, layout } of allCases()) {
      layout.profiles.forEach((slot, index) => {
        const swept = sweptBadge(slot.editBadge, slot.circle);
        const gap = slot.nickname.top - swept.bottom;
        expect(
          gap,
          `${label}: odznak ${index + 1} je ${round(gap)} px nad přezdívkou`,
        ).toBeGreaterThan(0);
      });
    }
  });

  it('odznak nepřesahuje okraj obrazovky ani při pohupování (aspoň 4 px od okraje bezpečné plochy)', () => {
    for (const { label, window, layout } of allCases()) {
      const free = freeAreaOf(window);
      layout.profiles.forEach((slot, index) => {
        const distance = edgeDistance(sweptBadge(slot.editBadge, slot.circle), free);
        expect(
          distance,
          `${label}: odznak ${index + 1} je ${round(distance)} px od okraje`,
        ).toBeGreaterThanOrEqual(4 - TOLERANCE);
      });
    }
  });
});

describe('#197 AC5: výběr profilu v běžném i upravovacím režimu dodrží společná pravidla (iPad, telefon na šířku i na výšku, 1–6 profilů, cs i en)', () => {
  for (const [ruleName, rule] of Object.entries(MENU_LAYOUT_RULES)) {
    it(`${ruleName}`, () => {
      for (const scene of modeCases().map(modeScene)) {
        expect(rule(scene), scene.label).toEqual([]);
      }
    });
  }

  it('případy pokrývají všechna okna, 11 kombinací profilů a „+“, oba jazyky a oba režimy', () => {
    expect(LANGUAGES).toEqual(expect.arrayContaining(['cs', 'en']));
    expect(modeCases()).toHaveLength(
      PICKER_CASES.length * MENU_WINDOWS.length * LANGUAGES.length * PICKER_MODES.length,
    );
    const modes = new Set(MENU_WINDOWS.map((window) => pickerLayout(window, 1, true).mode));
    expect([...modes]).toEqual(
      expect.arrayContaining(['tablet', 'phoneLandscape', 'phonePortrait']),
    );
  });
});
