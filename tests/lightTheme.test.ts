import { describe, expect, it } from 'vitest';

import { tapAnswer } from '../src/logic/answerRound';
import type { AnswerRound } from '../src/logic/answerRound';
import { CHECK_BUTTON_COLOR, buttonCornerRadius, checkButtonStyle } from '../src/logic/checkButton';
import { START_PROGRESS, parseProgress, serializeProgress } from '../src/logic/progress';
import type { GameProgress } from '../src/logic/progress';
import {
  ANSWER_BUTTON_SIZE,
  HINT_DOT_HIT_SIZE,
  SMALL_ANSWER_BUTTON_SIZE,
  STAR_SIZE,
  TWO_BOX_AREA_SIZE,
  WRITING_AREA_SIZE,
  WRITING_BUTTON_SIZE,
  layoutScreen,
  layoutWritingScreen,
} from '../src/logic/screenLayout';
import type { MaxNumber } from '../src/logic/settings';
import { CLOSED_SETTINGS, openSettings, pageAppearance } from '../src/logic/settingsSession';
import { DEFAULT_SETTINGS } from '../src/logic/settings';
import { STARS_PER_SET } from '../src/logic/stars';
import {
  CLEAR_ICON_COLOR,
  CONFIRM_BUTTON_STYLE,
  FONT_FAMILY,
  HINT_DOT_STYLE,
  KEYPAD_BUTTON_STYLE,
  PAGE_BACKGROUND,
  PROBLEM_STYLE,
  SETTINGS_GEAR_STYLE,
  STAR_STYLE,
  WRITING_PAD_STYLE,
  answerButtonLook,
  colorNumber,
  contrastRatio,
  starLooks,
} from '../src/logic/theme';

/**
 * Testy k #52 (světlý vzhled hlavní obrazovky, varianta A3): pozadí a písmo
 * (AC1), příklad (AC2), číselník (AC3), odezva na odpověď (AC4), hvězdičky
 * (AC5), tečky v nápovědě (AC6), psaní prstem a ovládání (AC7).
 *
 * Ručně se kontroluje: světlý vzhled při načítání a kolem hry na iPadu
 * i telefonu (index.html), že hra kvůli písmu nic nestahuje, poskočení
 * a zatřesení tlačítka, poloha a velikost kolečka nastavení (index.html)
 * a čitelnost tenkého příkladu v Safari a Chromu.
 */

const SCREEN_WIDTH = 1024;
const SCREEN_HEIGHT = 768;

/** WCAG: běžný text 4.5 : 1, velký text a grafické prvky 3 : 1. */
const TEXT_CONTRAST = 4.5;
const GRAPHIC_CONTRAST = 3;

/** Dnešní zelené barvy pozadí, které na hlavní obrazovce už nesmí zůstat. */
const OLD_GREENS = ['#1f6f43', '#175a36', '#0f3d24'];

const RANGES: readonly MaxNumber[] = [5, 10, 20];

/** Barvy porovnáváme bez ohledu na velikost písmen (#f5f5f7 = #F5F5F7). */
function expectColor(actual: string, expected: string): void {
  expect(actual.toLowerCase()).toBe(expected.toLowerCase());
}

function isOldGreen(color: string): boolean {
  return OLD_GREENS.includes(color.toLowerCase());
}

/** Šedá barva má všechny tři složky skoro stejné. */
function isGray(color: string): boolean {
  const hex = color.replace('#', '');
  const channels = [0, 2, 4].map((start) => parseInt(hex.slice(start, start + 2), 16));
  return Math.max(...channels) - Math.min(...channels) <= 10;
}

/** Kolo s pevným příkladem 3 + 4, aby testy nezávisely na náhodě. */
function roundThreePlusFour(): AnswerRound {
  return {
    problem: { first: 3, second: 4, operation: 'plus', result: 7 },
    maxNumber: 10,
    wrongAnswers: 0,
    solved: false,
  };
}

describe('kontrastní poměr podle WCAG', () => {
  it('černá na bílé má největší kontrast 21 : 1', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
  });

  it('barva sama se sebou má kontrast 1 : 1', () => {
    expect(contrastRatio('#86868B', '#86868B')).toBeCloseTo(1, 5);
  });

  it('nezáleží na pořadí barev ani na velikosti písmen', () => {
    expect(contrastRatio('#f5f5f7', '#86868b')).toBeCloseTo(
      contrastRatio('#86868B', '#F5F5F7'),
      10,
    );
  });

  it('šedá #86868B na pozadí #F5F5F7 má 3,33 : 1 jako v zadání', () => {
    expect(contrastRatio('#86868B', '#F5F5F7')).toBeCloseTo(3.33, 2);
  });

  it('modrá #0062CC na pozadí #F5F5F7 má 5,3 : 1 jako v zadání', () => {
    expect(contrastRatio('#0062CC', '#F5F5F7')).toBeCloseTo(5.33, 1);
  });

  it('barvu z tématu jde předat Phaseru jako číslo', () => {
    expect(colorNumber('#F5F5F7')).toBe(0xf5f5f7);
    expect(colorNumber('#248a3d')).toBe(0x248a3d);
  });
});

describe('#52 AC1: světlé pozadí a systémové písmo', () => {
  it('stránka i herní plocha mají světlé pozadí #F5F5F7', () => {
    expectColor(PAGE_BACKGROUND, '#F5F5F7');
  });

  it('na začátku hry má stránka kolem herní plochy světlé pozadí, ne zelené', () => {
    expectColor(pageAppearance(CLOSED_SETTINGS).background, '#F5F5F7');
  });

  it('po zavření nastavení má stránka zase pozadí #F5F5F7, ne dnešní zelené', () => {
    const open = openSettings(CLOSED_SETTINGS, DEFAULT_SETTINGS);
    expect(pageAppearance(open).background.toLowerCase()).not.toBe('#f5f5f7');
    const closed = pageAppearance(CLOSED_SETTINGS);
    expectColor(closed.background, PAGE_BACKGROUND);
    expect(isOldGreen(closed.background)).toBe(false);
  });

  it('střed kolečka nastavení není zelený, má barvu pozadí #F5F5F7', () => {
    expectColor(SETTINGS_GEAR_STYLE.centerColor, '#F5F5F7');
    expect(isOldGreen(SETTINGS_GEAR_STYLE.centerColor)).toBe(false);
  });

  it('žádná plocha hlavní obrazovky nemá dnešní zelené pozadí', () => {
    const backgrounds = [
      PAGE_BACKGROUND,
      SETTINGS_GEAR_STYLE.centerColor,
      KEYPAD_BUTTON_STYLE.background,
      WRITING_PAD_STYLE.background,
      STAR_STYLE.emptyColor,
    ];
    for (const color of backgrounds) {
      expect(isOldGreen(color), color).toBe(false);
    }
  });

  it('texty mají systémové písmo ze zadání', () => {
    expect(FONT_FAMILY).toBe(
      '-apple-system, "SF Pro Rounded", "Helvetica Neue", system-ui, sans-serif',
    );
  });
});

describe('#52 AC2: příklad je tmavý, tenký a dobře čitelný', () => {
  it('příklad je tmavý #1D1D1F a tenký (font-weight 300)', () => {
    expectColor(PROBLEM_STYLE.color, '#1D1D1F');
    expect(PROBLEM_STYLE.fontWeight).toBe(300);
  });

  it('příklad má proti pozadí kontrast aspoň 4,5 : 1', () => {
    expect(contrastRatio(PROBLEM_STYLE.color, PAGE_BACKGROUND)).toBeGreaterThanOrEqual(
      TEXT_CONTRAST,
    );
  });

  it('otazník je šedý #86868B s kontrastem aspoň 3 : 1 (velký text)', () => {
    expectColor(PROBLEM_STYLE.questionMarkColor, '#86868B');
    expect(contrastRatio(PROBLEM_STYLE.questionMarkColor, PAGE_BACKGROUND)).toBeGreaterThanOrEqual(
      GRAPHIC_CONTRAST,
    );
  });

  it('po správné odpovědi se výsledek ukáže zeleně #248A3D s kontrastem aspoň 3 : 1', () => {
    expectColor(PROBLEM_STYLE.revealedAnswerColor, '#248A3D');
    expect(
      contrastRatio(PROBLEM_STYLE.revealedAnswerColor, PAGE_BACKGROUND),
    ).toBeGreaterThanOrEqual(GRAPHIC_CONTRAST);
  });

  it('rozpoznaná a ještě nepotvrzená číslice při psaní prstem je modrá #0062CC', () => {
    expectColor(PROBLEM_STYLE.writtenDigitColor, '#0062CC');
  });
});

describe('#52 AC3: světlý číselník', () => {
  it('tlačítka mají světle modré pozadí #E5F0FF a okraj 2 px #B8D6FF', () => {
    expectColor(KEYPAD_BUTTON_STYLE.background, '#E5F0FF');
    expectColor(KEYPAD_BUTTON_STYLE.borderColor, '#B8D6FF');
    expect(KEYPAD_BUTTON_STYLE.borderWidth).toBe(2);
  });

  it('číslice na tlačítku je tučná modrá #0062CC', () => {
    expectColor(KEYPAD_BUTTON_STYLE.digitColor, '#0062CC');
    expect(KEYPAD_BUTTON_STYLE.digitFontWeight).toBeGreaterThanOrEqual(700);
  });

  it('číslice má proti tlačítku kontrast aspoň 4,5 : 1', () => {
    expect(
      contrastRatio(KEYPAD_BUTTON_STYLE.digitColor, KEYPAD_BUTTON_STYLE.background),
    ).toBeGreaterThanOrEqual(TEXT_CONTRAST);
  });

  it('zaoblení je čtvrtina strany: tlačítko 112 px má roh 28 px', () => {
    expect(buttonCornerRadius(112)).toBe(28);
  });

  it('tlačítka číselníku 140 px mají roh 35 px a 116 px roh 29 px', () => {
    expect(buttonCornerRadius(ANSWER_BUTTON_SIZE)).toBe(35);
    expect(buttonCornerRadius(SMALL_ANSWER_BUTTON_SIZE)).toBe(29);
  });

  it('velikost tlačítek zůstává 140 px (do 5 a 10) a 116 px (do 20)', () => {
    expect(ANSWER_BUTTON_SIZE).toBe(140);
    expect(SMALL_ANSWER_BUTTON_SIZE).toBe(116);
  });

  it.each(RANGES)('do %i zůstávají tlačítka na místě i s mezerami jako dosud', (max) => {
    const buttons = layoutScreen(SCREEN_WIDTH, SCREEN_HEIGHT, max + 1, STARS_PER_SET).answerButtons;
    const size = max === 20 ? 116 : 140;
    const gap = max === 20 ? 20 : 24;
    const rowGap = max === 20 ? 14 : 20;

    const rowYs = [...new Set(buttons.map((button) => button.y))].sort((a, b) => a - b);
    const lastRowY = rowYs[rowYs.length - 1] ?? 0;
    expect(lastRowY + size / 2).toBe(SCREEN_HEIGHT - 24);
    for (let row = 1; row < rowYs.length; row += 1) {
      expect((rowYs[row] ?? 0) - (rowYs[row - 1] ?? 0)).toBe(size + rowGap);
    }

    for (const y of rowYs) {
      const row = buttons.filter((button) => button.y === y).sort((a, b) => a.x - b.x);
      const left = (row[0]?.x ?? 0) - size / 2;
      const right = (row[row.length - 1]?.x ?? 0) + size / 2;
      expect(left + right).toBe(SCREEN_WIDTH);
      for (let index = 1; index < row.length; index += 1) {
        expect((row[index]?.x ?? 0) - (row[index - 1]?.x ?? 0)).toBe(size + gap);
      }
    }
    for (const button of buttons) {
      expect(button.size).toBe(size);
    }
  });

  it.each(RANGES)('do %i nezávisí poloha tlačítek na menších hvězdičkách', (max) => {
    const withoutStars = layoutScreen(SCREEN_WIDTH, SCREEN_HEIGHT, max + 1, 0);
    const withStars = layoutScreen(SCREEN_WIDTH, SCREEN_HEIGHT, max + 1, STARS_PER_SET);
    expect(withStars.answerButtons).toEqual(withoutStars.answerButtons);
  });

  it('plocha pro ťuknutí na tečku nápovědy zůstává 64 px', () => {
    expect(HINT_DOT_HIT_SIZE).toBe(64);
  });
});

describe('#52 AC4: odezva tlačítka na odpověď', () => {
  it('nedotčené tlačítko vypadá jako číselník: světle modré s modrou číslicí', () => {
    const look = answerButtonLook('idle');
    expectColor(look.background, KEYPAD_BUTTON_STYLE.background);
    expectColor(look.digitColor, KEYPAD_BUTTON_STYLE.digitColor);
    expect(look.interactive).toBe(true);
  });

  it('po správném ťuknutí tlačítko zezelená na #248A3D s bílou číslicí', () => {
    const { outcome } = tapAnswer(roundThreePlusFour(), 7);
    expect(outcome).toBe('correct');
    const look = answerButtonLook(outcome);
    expectColor(look.background, '#248A3D');
    expectColor(look.digitColor, '#FFFFFF');
  });

  it('bílá číslice na zeleném tlačítku má kontrast aspoň 3 : 1', () => {
    const look = answerButtonLook('correct');
    expect(contrastRatio(look.digitColor, look.background)).toBeGreaterThanOrEqual(
      GRAPHIC_CONTRAST,
    );
  });

  it('zelená správné odpovědi je stejná na tlačítku, ve výsledku i na ✓', () => {
    expectColor(answerButtonLook('correct').background, PROBLEM_STYLE.revealedAnswerColor);
    expectColor(answerButtonLook('correct').background, CONFIRM_BUTTON_STYLE.background);
  });

  it('po špatném ťuknutí tlačítko nezčervená a nezamkne se', () => {
    const { outcome } = tapAnswer(roundThreePlusFour(), 2);
    expect(outcome).toBe('wrong');
    expect(answerButtonLook(outcome)).toEqual(answerButtonLook('idle'));
    expect(answerButtonLook(outcome).interactive).toBe(true);
  });

  it('ani po opakované chybě tlačítko nezčervená a jde na něj dál ťukat', () => {
    let round = roundThreePlusFour();
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const result = tapAnswer(round, 2);
      expect(result.outcome).toBe('wrong');
      expect(answerButtonLook(result.outcome)).toEqual(answerButtonLook('idle'));
      round = result.round;
    }
    expect(tapAnswer(round, 2).outcome).toBe('wrong');
    expect(tapAnswer(round, 7).outcome).toBe('correct');
  });
});

describe('#52 AC5: malé plné hvězdičky nahoře', () => {
  const layout = layoutScreen(SCREEN_WIDTH, SCREEN_HEIGHT, 11, STARS_PER_SET);

  it('hvězdička má 30 px', () => {
    expect(STAR_SIZE).toBe(30);
  });

  it('mezi okraji sousedních hvězdiček je 14 px', () => {
    for (let index = 1; index < layout.stars.length; index += 1) {
      const previous = layout.stars[index - 1];
      const current = layout.stars[index];
      const edgeGap = (current?.x ?? 0) - (previous?.x ?? 0) - STAR_SIZE;
      expect(edgeGap).toBe(14);
    }
  });

  it('řada zůstává na stejném místě: na středu obrazovky ve výšce 52 px', () => {
    for (let starCount = 1; starCount <= STARS_PER_SET; starCount += 1) {
      const stars = layoutScreen(SCREEN_WIDTH, SCREEN_HEIGHT, 11, starCount).stars;
      const first = stars[0];
      const last = stars[stars.length - 1];
      expect((first?.x ?? 0) + (last?.x ?? 0), `${starCount}`).toBe(SCREEN_WIDTH);
      for (const star of stars) {
        expect(star.y, `${starCount}`).toBe(52);
      }
    }
  });

  it('řada zůstává na stejném místě i při psaní prstem', () => {
    for (const max of RANGES) {
      const writing = layoutWritingScreen(SCREEN_WIDTH, SCREEN_HEIGHT, max, STARS_PER_SET);
      const keypad = layoutScreen(SCREEN_WIDTH, SCREEN_HEIGHT, max + 1, STARS_PER_SET);
      expect(writing.stars).toEqual(keypad.stars);
    }
  });

  it('získaná hvězdička je zlatá #FFCC00 s obrysem #A67C00 tlustým 1,5 px', () => {
    expectColor(STAR_STYLE.earnedColor, '#FFCC00');
    expectColor(STAR_STYLE.earnedOutlineColor, '#A67C00');
    expect(STAR_STYLE.earnedOutlineWidth).toBe(1.5);
  });

  it('obrys získané hvězdičky má proti pozadí kontrast aspoň 3 : 1 (asi 3,5 : 1)', () => {
    const ratio = contrastRatio(STAR_STYLE.earnedOutlineColor, PAGE_BACKGROUND);
    expect(ratio).toBeGreaterThanOrEqual(GRAPHIC_CONTRAST);
    expect(ratio).toBeCloseTo(3.5, 1);
  });

  it('nezískaná hvězdička je plná šedá #D2D2D7 bez obrysu', () => {
    expectColor(STAR_STYLE.emptyColor, '#D2D2D7');
    const [empty] = starLooks({ earned: 0 });
    expectColor(empty?.fill ?? '', '#D2D2D7');
    expect(empty?.outlineWidth).toBe(0);
  });

  it('po třech správných odpovědích jsou tři hvězdičky zleva zlaté s obrysem, zbytek šedý', () => {
    const looks = starLooks({ earned: 3 });
    expect(looks).toHaveLength(STARS_PER_SET);
    looks.forEach((look, index) => {
      if (index < 3) {
        expectColor(look.fill, '#FFCC00');
        expectColor(look.outlineColor ?? '', '#A67C00');
        expect(look.outlineWidth).toBe(1.5);
      } else {
        expectColor(look.fill, '#D2D2D7');
        expect(look.outlineWidth).toBe(0);
      }
    });
  });

  it('získaná a nezískaná hvězdička jdou rozlišit i bez barev, podle obrysu', () => {
    const [earned, empty] = starLooks({ earned: 1 });
    expect(earned?.outlineWidth).toBeGreaterThan(0);
    expect(empty?.outlineWidth).toBe(0);
  });

  it('po obnovení stránky mají hvězdičky stejný vzhled jako před ním', () => {
    const before: GameProgress = { ...START_PROGRESS, earned: 6 };
    const after = parseProgress(serializeProgress(before));
    expect(starLooks(after)).toEqual(starLooks(before));
  });
});

describe('#52 AC6: tečky v nápovědě ladí s paletou', () => {
  it('první číslo má tečky #FFCC00 a druhé #5AC8FA', () => {
    expect(HINT_DOT_STYLE.groupColors).toHaveLength(2);
    expectColor(HINT_DOT_STYLE.groupColors[0] ?? '', '#FFCC00');
    expectColor(HINT_DOT_STYLE.groupColors[1] ?? '', '#5AC8FA');
  });

  it('každé číslo má svou barvu', () => {
    const [first, second] = HINT_DOT_STYLE.groupColors;
    expect((first ?? '').toLowerCase()).not.toBe((second ?? '').toLowerCase());
  });

  it('odečítané tečky jsou šedé', () => {
    expect(isGray(HINT_DOT_STYLE.crossedOutColor)).toBe(true);
  });

  it('křížek přes odečítanou tečku má proti ní kontrast aspoň 3 : 1', () => {
    expect(
      contrastRatio(HINT_DOT_STYLE.crossColor, HINT_DOT_STYLE.crossedOutColor),
    ).toBeGreaterThanOrEqual(GRAPHIC_CONTRAST);
  });

  it('označení spočítané tečky má proti pozadí kontrast aspoň 3 : 1', () => {
    expect(contrastRatio(HINT_DOT_STYLE.countedRingColor, PAGE_BACKGROUND)).toBeGreaterThanOrEqual(
      GRAPHIC_CONTRAST,
    );
  });

  it('číslo spočítané tečky je #1D1D1F a čte se na obou barvách teček (aspoň 4,5 : 1)', () => {
    expectColor(HINT_DOT_STYLE.countedNumberColor, '#1D1D1F');
    for (const groupColor of HINT_DOT_STYLE.groupColors) {
      expect(
        contrastRatio(HINT_DOT_STYLE.countedNumberColor, groupColor),
        groupColor,
      ).toBeGreaterThanOrEqual(TEXT_CONTRAST);
    }
  });
});

describe('#52 AC7: psaní prstem a ovládání ve světlém vzhledu', () => {
  it('okénko na psaní je bílé s okrajem 2 px #86868B', () => {
    expectColor(WRITING_PAD_STYLE.background, '#FFFFFF');
    expectColor(WRITING_PAD_STYLE.borderColor, '#86868B');
    expect(WRITING_PAD_STYLE.borderWidth).toBe(2);
  });

  it('okraj okénka má proti pozadí kontrast aspoň 3 : 1 (asi 3,3 : 1)', () => {
    const ratio = contrastRatio(WRITING_PAD_STYLE.borderColor, PAGE_BACKGROUND);
    expect(ratio).toBeGreaterThanOrEqual(GRAPHIC_CONTRAST);
    expect(ratio).toBeCloseTo(3.3, 1);
  });

  it('tah prstem je tmavý #1D1D1F s kontrastem aspoň 4,5 : 1 proti okénku', () => {
    expectColor(WRITING_PAD_STYLE.inkColor, '#1D1D1F');
    expect(
      contrastRatio(WRITING_PAD_STYLE.inkColor, WRITING_PAD_STYLE.background),
    ).toBeGreaterThanOrEqual(TEXT_CONTRAST);
  });

  it('✓ je zelené #248A3D s bílou fajfkou s kontrastem aspoň 3 : 1', () => {
    expectColor(CONFIRM_BUTTON_STYLE.background, '#248A3D');
    expectColor(CONFIRM_BUTTON_STYLE.tickColor, '#FFFFFF');
    expect(
      contrastRatio(CONFIRM_BUTTON_STYLE.tickColor, CONFIRM_BUTTON_STYLE.background),
    ).toBeGreaterThanOrEqual(GRAPHIC_CONTRAST);
  });

  it('✓ ve hře i v nastavení má stejnou zelenou', () => {
    expect(CHECK_BUTTON_COLOR).toBe(colorNumber(CONFIRM_BUTTON_STYLE.background));
  });

  it('✓ v nastavení (150 px) má stejné zaoblení čtvrtinou strany jako tlačítka ve hře', () => {
    expect(checkButtonStyle(150).cornerRadius).toBe(buttonCornerRadius(150));
    expect(Math.abs(checkButtonStyle(150).cornerRadius - 37.5)).toBeLessThanOrEqual(0.5);
  });

  it('při prázdném okénku je ✓ neaktivní s průhledností 0,35 jako dnes', () => {
    expect(CONFIRM_BUTTON_STYLE.disabledAlpha).toBe(0.35);
  });

  it('ikona smazat je šedá #86868B s kontrastem aspoň 3 : 1', () => {
    expectColor(CLEAR_ICON_COLOR, '#86868B');
    expect(contrastRatio(CLEAR_ICON_COLOR, PAGE_BACKGROUND)).toBeGreaterThanOrEqual(
      GRAPHIC_CONTRAST,
    );
  });

  it('kolečko nastavení je plná šedá #86868B s kontrastem aspoň 3 : 1', () => {
    expectColor(SETTINGS_GEAR_STYLE.color, '#86868B');
    expect(contrastRatio(SETTINGS_GEAR_STYLE.color, PAGE_BACKGROUND)).toBeGreaterThanOrEqual(
      GRAPHIC_CONTRAST,
    );
    expect(pageAppearance(CLOSED_SETTINGS).gearOpacity).toBe(1);
  });

  it('kroužek, který se plní při podržení kolečka, je modrý #0062CC s kontrastem aspoň 3 : 1', () => {
    expectColor(SETTINGS_GEAR_STYLE.holdRingColor, '#0062CC');
    expect(
      contrastRatio(SETTINGS_GEAR_STYLE.holdRingColor, PAGE_BACKGROUND),
    ).toBeGreaterThanOrEqual(GRAPHIC_CONTRAST);
  });

  it('okénka na psaní a tlačítka vedle nich mají stejnou velikost jako dosud', () => {
    expect(WRITING_AREA_SIZE).toBe(320);
    expect(TWO_BOX_AREA_SIZE).toBe(280);
    expect(WRITING_BUTTON_SIZE).toBe(140);
    for (const max of RANGES) {
      const layout = layoutWritingScreen(SCREEN_WIDTH, SCREEN_HEIGHT, max, STARS_PER_SET);
      expect(layout.confirmButton.size).toBe(140);
      expect(layout.clearButton.size).toBe(140);
    }
  });
});
