import { describe, expect, it } from 'vitest';

import { CHECK_BUTTON_COLOR } from '../src/logic/checkButton';
import { DEFAULT_SETTINGS, HOLD_TO_OPEN_SETTINGS_MS } from '../src/logic/settings';
import type { GameSettings } from '../src/logic/settings';
import { layoutSettingsPanel } from '../src/logic/settingsLayout';
import type { SettingsRow, SettingsRowKind } from '../src/logic/settingsLayout';
import {
  CLOSED_SETTINGS,
  chooseOption,
  confirmSettings,
  createLaunchState,
  openSettings,
  pageAppearance,
  selectedOptions,
} from '../src/logic/settingsSession';
import type { SettingsSession } from '../src/logic/settingsSession';
import {
  chooseOption as chooseGuideOption,
  finishGuide,
  guideAtStart,
  guidePageAppearance,
  guideRowStyle,
  guideSelection,
  layoutGuideStep,
  next,
  startGuide,
  stepIndicatorText,
} from '../src/logic/setupGuide';
import type { GuideState, GuideStep } from '../src/logic/setupGuide';
import {
  CONFETTI_COLORS,
  CONFIRM_BUTTON_STYLE,
  GUIDE_STYLE,
  KEYPAD_BUTTON_STYLE,
  PAGE_BACKGROUND,
  SETTINGS_LABEL_COLOR,
  SETTINGS_OPTION_STYLE,
  SETTINGS_PANEL_STYLE,
  colorNumber,
  contrastRatio,
  settingsOptionLook,
} from '../src/logic/theme';
import type { SettingsOptionLook } from '../src/logic/theme';
import { FIRST_CHARACTER } from '../src/logic/characters';

/**
 * Testy k #53 (světlý vzhled nastavení, průvodce a oslavy, dokončení A3):
 * stránka při otevřeném nastavení a průvodci (AC1), volby v nastavení (AC2),
 * texty a tlačítka průvodce (AC3), zvýrazněná a ztlumené řady (AC4),
 * konfety (AC5) a nic tmavě zeleného nezůstane (AC6).
 *
 * Ručně se kontroluje: ztlumení kolečka za 150 ms, že ťuknutí neprojdou
 * pod panel do hry, pulzování reproduktoru, počet konfet, délka oslavy
 * a střídání postaviček, čitelnost ztlumených řad a konfet v Safari na
 * iPadu a na telefonu.
 */

const SCREEN_WIDTH = 1024;
const SCREEN_HEIGHT = 768;

/** WCAG: běžný text 4.5 : 1, velký text a grafické prvky 3 : 1. */
const TEXT_CONTRAST = 4.5;
const GRAPHIC_CONTRAST = 3;
/** Ztlumená řada v průvodci: vybraná volba musí být poznat aspoň 2 : 1. */
const DIMMED_SELECTION_CONTRAST = 2;

const DIMMED_GEAR = 0.3;
const DIMMED_ROW = 0.5;

/** Barvy starého tmavě zeleného vzhledu nastavení, průvodce a oslavy. */
const OLD_SETTINGS_COLORS = ['#0f3d24', '#1f6f43', '#cfe8d6', '#ffd54f', '#8be04e'];
/** Dnešní barvy konfet, které na světlém pozadí splývají. */
const OLD_CONFETTI_COLORS = ['#ffd54f', '#81d4fa', '#ff8a80', '#b9f6ca', '#ce93d8', '#ffffff'];

const GUIDE_ROW_STEPS: readonly (1 | 2 | 3)[] = [1, 2, 3];
const ALL_STEPS: readonly GuideStep[] = [1, 2, 3, 4];
const SUMMARY_STEP: GuideStep = 4;
const ROW_OF_STEP: Record<1 | 2 | 3, SettingsRowKind> = {
  1: 'maxNumber',
  2: 'operations',
  3: 'answerInput',
};
const ROWS: readonly SettingsRowKind[] = ['maxNumber', 'operations', 'answerInput'];

const SAVED: GameSettings = { maxNumber: 20, operations: 'mixed', answerInput: 'writing' };

/** Barvy porovnáváme bez ohledu na velikost písmen (#f5f5f7 = #F5F5F7). */
function expectColor(actual: string, expected: string): void {
  expect(actual.toLowerCase()).toBe(expected.toLowerCase());
}

/** Jak barva s průhledností `opacity` vypadá na pozadí stránky. */
function seenOnPage(color: string, opacity: number, below: string = PAGE_BACKGROUND): string {
  const top = colorNumber(color);
  const bottom = colorNumber(below);
  const channels = [16, 8, 0].map((shift) => {
    const mixed = ((top >> shift) & 0xff) * opacity + ((bottom >> shift) & 0xff) * (1 - opacity);
    return Math.round(mixed).toString(16).padStart(2, '0');
  });
  return `#${channels.join('')}`;
}

/** Rodič ťuká na „Další“, dokud nedojde na krok `step`. */
function guideOnStep(step: GuideStep): GuideState {
  let guide = startGuide();
  for (let current = 1; current < step; current += 1) {
    guide = next(guide, 0);
  }
  return guide;
}

/** Hodnoty voleb řady, které teď vypadají jako vybrané (plná modrá). */
function valuesLookingSelected(row: SettingsRow, session: SettingsSession): unknown[] {
  const selected = selectedOptions(session);
  const selectedBackground = settingsOptionLook(true).background;
  return row.options
    .filter((option) => {
      const look = settingsOptionLook(selected?.[row.kind] === option.value);
      return look.background === selectedBackground;
    })
    .map((option) => option.value);
}

function lookColors(look: SettingsOptionLook): string[] {
  return [look.background, look.borderColor, look.textColor, look.iconColor];
}

describe('#53 AC1: stránka při otevřeném nastavení a průvodci je světlá', () => {
  it('při otevřeném nastavení má stránka kolem hry světlé pozadí #F5F5F7, ne tmavě zelené', () => {
    const appearance = pageAppearance(openSettings(CLOSED_SETTINGS, SAVED));
    expectColor(appearance.background, '#F5F5F7');
    expect(appearance.background.toLowerCase()).not.toBe('#0f3d24');
  });

  it('během průvodce má stránka kolem hry světlé pozadí #F5F5F7', () => {
    expectColor(guidePageAppearance().background, '#F5F5F7');
  });

  it('panel nastavení i průvodce mají pozadí #F5F5F7 jako hra', () => {
    expectColor(SETTINGS_PANEL_STYLE.background, '#F5F5F7');
    expectColor(SETTINGS_PANEL_STYLE.background, PAGE_BACKGROUND);
  });

  it('pozadí panelu je neprůhledné, hra pod ním není vidět', () => {
    expect(SETTINGS_PANEL_STYLE.backgroundAlpha).toBe(1);
  });

  it('při otevřeném nastavení je kolečko ztlumené na 0,3', () => {
    expect(pageAppearance(openSettings(CLOSED_SETTINGS, SAVED)).gearOpacity).toBe(DIMMED_GEAR);
  });

  it('během průvodce je kolečko ztlumené na 0,3', () => {
    expect(guidePageAppearance().gearOpacity).toBe(DIMMED_GEAR);
  });

  it('po zavření nastavení je stránka #F5F5F7 a kolečko plně vidět', () => {
    const open = openSettings(CLOSED_SETTINGS, SAVED);
    const { session } = confirmSettings(open, SAVED, { earned: 3, character: FIRST_CHARACTER });
    const appearance = pageAppearance(session);
    expectColor(appearance.background, '#F5F5F7');
    expect(appearance.gearOpacity).toBe(1);
  });

  it('po pětinásobném otevření a zavření nastavení je stránka pořád světlá a kolečko se vrátí na 1', () => {
    let session: SettingsSession = CLOSED_SETTINGS;
    const progress = { earned: 3, character: FIRST_CHARACTER };
    for (let round = 0; round < 5; round += 1) {
      session = openSettings(session, SAVED);
      expectColor(pageAppearance(session).background, '#F5F5F7');
      expect(pageAppearance(session).gearOpacity).toBe(DIMMED_GEAR);

      session = confirmSettings(session, SAVED, progress).session;
      expectColor(pageAppearance(session).background, '#F5F5F7');
      expect(pageAppearance(session).gearOpacity).toBe(1);
    }
  });

  it('po dokončení průvodce a pak opakovaném otevření nastavení je stránka světlá a kolečko na 1', () => {
    const summary = guideOnStep(SUMMARY_STEP);
    expect(finishGuide(summary, 10_000)).not.toBeNull();
    expectColor(pageAppearance(CLOSED_SETTINGS).background, '#F5F5F7');
    expect(pageAppearance(CLOSED_SETTINGS).gearOpacity).toBe(1);

    let session: SettingsSession = CLOSED_SETTINGS;
    for (let round = 0; round < 3; round += 1) {
      session = openSettings(session, DEFAULT_SETTINGS);
      session = confirmSettings(session, DEFAULT_SETTINGS, {
        earned: 0,
        character: FIRST_CHARACTER,
      }).session;
      expectColor(pageAppearance(session).background, '#F5F5F7');
      expect(pageAppearance(session).gearOpacity).toBe(1);
    }
  });
});

describe('#53 AC2: volby v nastavení', () => {
  it('nevybraná volba vypadá jako tlačítko číselníku: #E5F0FF, okraj 2 px #B8D6FF, text a tužka #0062CC', () => {
    const look = settingsOptionLook(false);
    expectColor(look.background, '#E5F0FF');
    expectColor(look.borderColor, '#B8D6FF');
    expect(look.borderWidth).toBe(2);
    expectColor(look.textColor, '#0062CC');
    expectColor(look.iconColor, '#0062CC');
    expect(SETTINGS_OPTION_STYLE.unselected).toEqual(look);
  });

  it('nevybraná volba má stejné barvy jako číselník ve hře', () => {
    const look = settingsOptionLook(false);
    expectColor(look.background, KEYPAD_BUTTON_STYLE.background);
    expectColor(look.borderColor, KEYPAD_BUTTON_STYLE.borderColor);
    expect(look.borderWidth).toBe(KEYPAD_BUTTON_STYLE.borderWidth);
    expectColor(look.textColor, KEYPAD_BUTTON_STYLE.digitColor);
  });

  it('text nevybrané volby má kontrast aspoň 4,5 : 1 (asi 5,04 : 1)', () => {
    const look = settingsOptionLook(false);
    const ratio = contrastRatio(look.textColor, look.background);
    expect(ratio).toBeGreaterThanOrEqual(TEXT_CONTRAST);
    expect(ratio).toBeCloseTo(5.04, 1);
  });

  it('vybraná volba je plná modrá #0062CC s bílým textem i tužkou', () => {
    const look = settingsOptionLook(true);
    expectColor(look.background, '#0062CC');
    expectColor(look.borderColor, '#0062CC');
    expectColor(look.textColor, '#FFFFFF');
    expectColor(look.iconColor, '#FFFFFF');
    expect(SETTINGS_OPTION_STYLE.selected).toEqual(look);
  });

  it('bílý text na vybrané volbě má kontrast aspoň 4,5 : 1 (asi 5,80 : 1)', () => {
    const look = settingsOptionLook(true);
    const ratio = contrastRatio(look.textColor, look.background);
    expect(ratio).toBeGreaterThanOrEqual(TEXT_CONTRAST);
    expect(ratio).toBeCloseTo(5.8, 1);
  });

  it('vybraná volba je poznat i černobíle: proti nevybrané asi 5,04 : 1 a proti pozadí 5,33 : 1', () => {
    const selected = settingsOptionLook(true).background;
    const unselected = settingsOptionLook(false).background;
    expect(contrastRatio(selected, unselected)).toBeGreaterThanOrEqual(GRAPHIC_CONTRAST);
    expect(contrastRatio(selected, unselected)).toBeCloseTo(5.04, 1);
    expect(contrastRatio(selected, PAGE_BACKGROUND)).toBeGreaterThanOrEqual(GRAPHIC_CONTRAST);
    expect(contrastRatio(selected, PAGE_BACKGROUND)).toBeCloseTo(5.33, 1);
  });

  it('po ťuknutí na jinou volbu se výběr hned přesune a v řadě je vybraná právě jedna', () => {
    const layout = layoutSettingsPanel(SCREEN_WIDTH, SCREEN_HEIGHT);
    let session = openSettings(CLOSED_SETTINGS, DEFAULT_SETTINGS);
    for (const row of layout.rows) {
      row.options.forEach((option) => {
        const change = { [row.kind]: option.value } as Partial<GameSettings>;
        session = chooseOption(session, change);
        expect(valuesLookingSelected(row, session), `${row.kind} ${String(option.value)}`).toEqual([
          option.value,
        ]);
      });
    }
  });

  it('hned po otevření je v každé řadě vybraná právě jedna volba podle uloženého nastavení', () => {
    const layout = layoutSettingsPanel(SCREEN_WIDTH, SCREEN_HEIGHT);
    const session = openSettings(CLOSED_SETTINGS, SAVED);
    for (const row of layout.rows) {
      expect(valuesLookingSelected(row, session), row.kind).toEqual([SAVED[row.kind]]);
    }
  });

  it('popisky řad jsou šedé #6E6E73 s kontrastem aspoň 4,5 : 1 (asi 4,66 : 1)', () => {
    expectColor(SETTINGS_LABEL_COLOR, '#6E6E73');
    const ratio = contrastRatio(SETTINGS_LABEL_COLOR, PAGE_BACKGROUND);
    expect(ratio).toBeGreaterThanOrEqual(TEXT_CONTRAST);
    expect(ratio).toBeCloseTo(4.66, 1);
  });

  it('popisky řad nevypadají jako volba: nejsou modré ani na modrém', () => {
    for (const look of [settingsOptionLook(true), settingsOptionLook(false)]) {
      expect(lookColors(look).map((color) => color.toLowerCase())).not.toContain(
        SETTINGS_LABEL_COLOR.toLowerCase(),
      );
    }
  });

  it('✓ zůstává zelené #248A3D s bílou fajfkou, proti pozadí aspoň 3 : 1 (asi 4,04 : 1)', () => {
    expectColor(CONFIRM_BUTTON_STYLE.background, '#248A3D');
    expectColor(CONFIRM_BUTTON_STYLE.tickColor, '#FFFFFF');
    expect(CHECK_BUTTON_COLOR).toBe(colorNumber('#248A3D'));
    const ratio = contrastRatio(CONFIRM_BUTTON_STYLE.background, PAGE_BACKGROUND);
    expect(ratio).toBeGreaterThanOrEqual(GRAPHIC_CONTRAST);
    expect(ratio).toBeCloseTo(4.04, 1);
  });
});

describe('#53 AC3: texty a tlačítka průvodce', () => {
  for (const step of ALL_STEPS) {
    it(`na kroku ${step} jsou rada i ukazatel kroku tmavé #1D1D1F`, () => {
      const layout = layoutGuideStep(step, SCREEN_WIDTH, SCREEN_HEIGHT);
      expectColor(layout.message.color, '#1D1D1F');
      expectColor(layout.indicator.color, '#1D1D1F');
    });
  }

  it('rady a ukazatel kroku mají proti pozadí kontrast aspoň 4,5 : 1 (asi 15,46 : 1)', () => {
    expectColor(GUIDE_STYLE.textColor, '#1D1D1F');
    const ratio = contrastRatio(GUIDE_STYLE.textColor, PAGE_BACKGROUND);
    expect(ratio).toBeGreaterThanOrEqual(TEXT_CONTRAST);
    expect(ratio).toBeCloseTo(15.46, 1);
  });

  it('„Zpět“ a „Další“ vypadají jako číselník: #E5F0FF, okraj 2 px #B8D6FF, text #0062CC', () => {
    expectColor(GUIDE_STYLE.buttonBackground, '#E5F0FF');
    expectColor(GUIDE_STYLE.buttonBorderColor, '#B8D6FF');
    expect(GUIDE_STYLE.buttonBorderWidth).toBe(2);
    expectColor(GUIDE_STYLE.buttonTextColor, '#0062CC');
    expectColor(GUIDE_STYLE.buttonBackground, KEYPAD_BUTTON_STYLE.background);
    expectColor(GUIDE_STYLE.buttonBorderColor, KEYPAD_BUTTON_STYLE.borderColor);
  });

  it('reproduktor má stejné světle modré pozadí a modrou ikonu #0062CC', () => {
    expectColor(GUIDE_STYLE.speakerIconColor, '#0062CC');
  });

  it('text „Zpět“ a „Další“ i ikona reproduktoru mají kontrast aspoň 4,5 : 1 (asi 5,04 : 1)', () => {
    for (const color of [GUIDE_STYLE.buttonTextColor, GUIDE_STYLE.speakerIconColor]) {
      const ratio = contrastRatio(color, GUIDE_STYLE.buttonBackground);
      expect(ratio).toBeGreaterThanOrEqual(TEXT_CONTRAST);
      expect(ratio).toBeCloseTo(5.04, 1);
    }
  });

  it('„Začít hrát“ má stejnou zelenou jako ✓ a bílý text', () => {
    expectColor(GUIDE_STYLE.startPlayingBackground, '#248A3D');
    expectColor(GUIDE_STYLE.startPlayingBackground, CONFIRM_BUTTON_STYLE.background);
    expectColor(GUIDE_STYLE.startPlayingTextColor, '#FFFFFF');
  });

  it('bílý text „Začít hrát“ (32 px, velký text) má kontrast aspoň 3 : 1 (asi 4,40 : 1)', () => {
    const ratio = contrastRatio(
      GUIDE_STYLE.startPlayingTextColor,
      GUIDE_STYLE.startPlayingBackground,
    );
    expect(ratio).toBeGreaterThanOrEqual(GRAPHIC_CONTRAST);
    expect(ratio).toBeCloseTo(4.4, 1);
    expect(layoutGuideStep(SUMMARY_STEP, SCREEN_WIDTH, SCREEN_HEIGHT).right.fontSize).toBe(32);
  });
});

describe('#53 AC4: zvýrazněná a ztlumené řady v průvodci', () => {
  for (const step of GUIDE_ROW_STEPS) {
    it(`na kroku ${step} je kolem zvýrazněné řady modrý rámeček #0062CC, 4 px`, () => {
      const { frame } = layoutGuideStep(step, SCREEN_WIDTH, SCREEN_HEIGHT);
      expect(frame).not.toBeNull();
      expectColor(frame?.color ?? '', '#0062CC');
      expect(frame?.lineWidth).toBe(4);
    });

    it(`na kroku ${step} mají ostatní řady i s popisky průhlednost 0,5 a zvýrazněná 1`, () => {
      const guide = guideOnStep(step);
      for (const row of ROWS) {
        const expected = row === ROW_OF_STEP[step] ? 1 : DIMMED_ROW;
        expect(guideRowStyle(guide, row).opacity, row).toBe(expected);
      }
    });
  }

  it('rámeček má proti pozadí kontrast aspoň 3 : 1 (asi 5,33 : 1)', () => {
    const ratio = contrastRatio(GUIDE_STYLE.frameColor, PAGE_BACKGROUND);
    expectColor(GUIDE_STYLE.frameColor, '#0062CC');
    expect(GUIDE_STYLE.frameLineWidth).toBe(4);
    expect(ratio).toBeGreaterThanOrEqual(GRAPHIC_CONTRAST);
    expect(ratio).toBeCloseTo(5.33, 1);
  });

  it('ve ztlumené řadě je vybraná volba proti pozadí i proti nevybrané poznat aspoň 2 : 1', () => {
    const guide = guideOnStep(1);
    const opacity = guideRowStyle(guide, 'operations').opacity;
    const selected = seenOnPage(settingsOptionLook(true).background, opacity);
    const unselected = seenOnPage(settingsOptionLook(false).background, opacity);
    expect(contrastRatio(selected, PAGE_BACKGROUND)).toBeGreaterThanOrEqual(
      DIMMED_SELECTION_CONTRAST,
    );
    expect(contrastRatio(selected, unselected)).toBeGreaterThanOrEqual(DIMMED_SELECTION_CONTRAST);
  });

  for (const step of GUIDE_ROW_STEPS) {
    it(`na kroku ${step} ťuknutí do ztlumené řady nic nezmění`, () => {
      const guide = guideOnStep(step);
      const before = guideSelection(guide);
      const dimmedChanges: Record<SettingsRowKind, Partial<GameSettings>> = {
        maxNumber: { maxNumber: 20 },
        operations: { operations: 'minus' },
        answerInput: { answerInput: 'writing' },
      };
      for (const row of ROWS.filter((kind) => kind !== ROW_OF_STEP[step])) {
        expect(guideRowStyle(guide, row).tappable, row).toBe(false);
        expect(guideSelection(chooseGuideOption(guide, dimmedChanges[row])), row).toEqual(before);
      }
    });
  }

  it('na shrnutí jsou všechny řady plné, bez rámečku a jde do nich ťuknout', () => {
    const summary = guideOnStep(SUMMARY_STEP);
    for (const row of ROWS) {
      expect(guideRowStyle(summary, row), row).toEqual({
        visible: true,
        opacity: 1,
        framed: false,
        tappable: true,
      });
    }
    const changed = chooseGuideOption(summary, { operations: 'minus' });
    expect(guideSelection(changed).operations).toBe('minus');
  });
});

describe('#53 AC5: konfety jsou na světlém pozadí vidět', () => {
  it('konfety mají modrou, zelenou, červenou, fialovou, oranžovou a zlatou ze zadání', () => {
    const colors = CONFETTI_COLORS.map((color) => color.toLowerCase()).sort();
    expect(colors).toEqual(
      ['#0062CC', '#248A3D', '#FF3B30', '#AF52DE', '#C93400', '#A67C00']
        .map((color) => color.toLowerCase())
        .sort(),
    );
  });

  it('každá konfeta má proti pozadí kontrast aspoň 3 : 1', () => {
    for (const color of CONFETTI_COLORS) {
      expect(contrastRatio(color, PAGE_BACKGROUND), color).toBeGreaterThanOrEqual(GRAPHIC_CONTRAST);
    }
  });

  it('žádná konfeta není bílá, žlutá #FFCC00 ani v barvě pozadí', () => {
    for (const color of CONFETTI_COLORS) {
      expect(['#ffffff', '#ffcc00', PAGE_BACKGROUND.toLowerCase()]).not.toContain(
        color.toLowerCase(),
      );
    }
  });

  it('žádná konfeta nemá dnešní bledou barvu', () => {
    for (const color of CONFETTI_COLORS) {
      expect(OLD_CONFETTI_COLORS, color).not.toContain(color.toLowerCase());
    }
  });

  it('každá konfeta má jinou barvu', () => {
    const colors = CONFETTI_COLORS.map((color) => color.toLowerCase());
    expect(new Set(colors).size).toBe(colors.length);
  });
});

describe('#53 AC6: nic tmavě zeleného nezůstane, chování beze změny', () => {
  function allNewColors(): string[] {
    const guideLayoutColors = ALL_STEPS.flatMap((step) => {
      const layout = layoutGuideStep(step, SCREEN_WIDTH, SCREEN_HEIGHT);
      return [layout.message.color, layout.indicator.color, layout.frame?.color ?? '#F5F5F7'];
    });
    return [
      pageAppearance(openSettings(CLOSED_SETTINGS, SAVED)).background,
      guidePageAppearance().background,
      SETTINGS_PANEL_STYLE.background,
      SETTINGS_LABEL_COLOR,
      ...lookColors(settingsOptionLook(true)),
      ...lookColors(settingsOptionLook(false)),
      GUIDE_STYLE.textColor,
      GUIDE_STYLE.buttonBackground,
      GUIDE_STYLE.buttonBorderColor,
      GUIDE_STYLE.buttonTextColor,
      GUIDE_STYLE.speakerIconColor,
      GUIDE_STYLE.startPlayingBackground,
      GUIDE_STYLE.startPlayingTextColor,
      GUIDE_STYLE.frameColor,
      ...guideLayoutColors,
      ...CONFETTI_COLORS,
    ];
  }

  it('žádná barva nastavení, průvodce ani oslavy není ze starého tmavě zeleného vzhledu', () => {
    for (const color of allNewColors()) {
      expect(OLD_SETTINGS_COLORS, color).not.toContain(color.toLowerCase());
    }
  });

  it('žádná konfeta nemá barvu ze staré oslavy ani bílou', () => {
    for (const color of CONFETTI_COLORS) {
      expect(OLD_CONFETTI_COLORS, color).not.toContain(color.toLowerCase());
    }
  });

  it('nastavení se dál otvírá podržením kolečka 1 s', () => {
    expect(HOLD_TO_OPEN_SETTINGS_MS).toBe(1000);
  });

  it('při prvním spuštění se samo otevře průvodce se čtyřmi kroky', () => {
    const guide = guideAtStart(createLaunchState(true));
    expect(guide).not.toBeNull();
    if (guide === null) return;
    expect(stepIndicatorText(guide)).toBe('1 / 4');
    expect(stepIndicatorText(next(next(next(guide, 0), 0), 0))).toBe('4 / 4');
  });

  it('vybraná a nevybraná volba mají stejně tlustý okraj, takže se nezvětší ani nezmenší', () => {
    expect(settingsOptionLook(true).borderWidth).toBe(settingsOptionLook(false).borderWidth);
  });

  it('volby v nastavení mají dál 220 × 130 px', () => {
    for (const row of layoutSettingsPanel(SCREEN_WIDTH, SCREEN_HEIGHT).rows) {
      for (const option of row.options) {
        expect([option.width, option.height]).toEqual([220, 130]);
      }
    }
  });
});
