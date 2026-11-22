import { describe, expect, it } from 'vitest';

import { layoutCompareScreen } from '../../../src/games/compare/logic/compareLayout';
import type { CompareLayout, Dot, Rect } from '../../../src/games/compare/logic/compareLayout';
import { questionPicture } from '../../../src/games/compare/logic/compareQuestion';
import { QUESTION_OPTIONS } from '../../../src/games/compare/logic/compareSettings';
import type {
  CompareQuestion,
  QuestionPicture,
} from '../../../src/games/compare/logic/compareQuestion';
import {
  layoutCompareSettings,
  questionOptionIcon,
} from '../../../src/games/compare/logic/compareSettingsLayout';
import { DOT_COLORS, QUESTION_STYLE } from '../../../src/games/compare/logic/theme';
import { homeButtonFor } from '../../../src/shared/logic/homeButton';
import { settingsGearFor } from '../../../src/shared/logic/settingsGear';
import { gameAreaFor } from '../../../src/shared/logic/viewportLayout';
import type { GameArea } from '../../../src/shared/logic/viewportLayout';
import {
  IPAD_WINDOWS,
  JUST_ABOVE_LIMIT,
  NO_NOTCH,
  gapBetween,
  PHONE_PORTRAIT_EDGE_WINDOWS,
  PHONE_PORTRAIT_WINDOWS,
  PHONE_WINDOWS,
  isInside,
  overlaps,
  viewportOf,
} from '../../shared/viewportFixtures';
import type { Box, TestWindow } from '../../shared/viewportFixtures';

/**
 * Testy k #182 AC3 a AC5: symbol otázky nad kartami (velká hromádka = „kde
 * je víc“, malá hromádka = „kde je míň“) jako pravidla v cyklu přes
 * zkušební okna iPadu, telefonu na šířku i na výšku, měřené v CSS px okna.
 * Symbol je celý na obrazovce nad kartami, nic nepřekrývá a je dost velký,
 * aby ho dítě poznalo i bez čtení a bez zvuku. Stejný symbol je ve volbě
 * „Otázka“ v nastavení pro rodiče.
 */

const SCALED_WINDOW: TestWindow = {
  name: '600×400 zmenšené zobrazení',
  width: 600,
  height: 400,
  safeArea: NO_NOTCH,
};
const DEVICE_WINDOWS: readonly TestWindow[] = [
  ...IPAD_WINDOWS,
  JUST_ABOVE_LIMIT,
  ...PHONE_WINDOWS,
  ...PHONE_PORTRAIT_WINDOWS,
  ...PHONE_PORTRAIT_EDGE_WINDOWS,
];
const ALL_WINDOWS = [...DEVICE_WINDOWS, SCALED_WINDOW];
const QUESTIONS: readonly CompareQuestion[] = ['more', 'less'];

/** Symbol aspoň takhle vysoký (CSS px), v malém zmenšeném zobrazení menší. */
const MIN_SYMBOL_HEIGHT_CSS = 44;
const MIN_SCALED_SYMBOL_HEIGHT_CSS = 28;
/** Tečka hromádky aspoň takhle velká (CSS px). */
const MIN_PILE_DOT_CSS = 6;
/** Ťukací plocha pro dětský prst a mezera mezi ťukacími plochami (CSS px). */
const MIN_TOUCH_CSS = 64;
const MIN_TARGET_GAP_CSS = 8;
/** Symbol „víc“ s podložkou a samotná pyramida „víc“ jako díl vyhrazené výšky. */
const MIN_SYMBOL_FILL = 0.75;
const MIN_BIG_PILE_FILL = 0.8;
/** Velká hromádka je proti malé aspoň takhle vyšší i širší. */
const MIN_PILE_RATIO = 1.5;

function areaOf(window: TestWindow): GameArea {
  return gameAreaFor(viewportOf(window), 'fullWindow');
}

function cssOf(rect: Rect, area: GameArea): Box {
  return {
    left: area.offsetX + rect.left * area.scale,
    right: area.offsetX + (rect.left + rect.width) * area.scale,
    top: area.offsetY + rect.top * area.scale,
    bottom: area.offsetY + (rect.top + rect.height) * area.scale,
  };
}

function dotRect(dot: Dot): Rect {
  return {
    left: dot.x - dot.radius,
    top: dot.y - dot.radius,
    width: 2 * dot.radius,
    height: 2 * dot.radius,
  };
}

function pileBox(picture: QuestionPicture): Box {
  const boxes = picture.dots.map((dot) => ({
    left: dot.x - dot.radius,
    right: dot.x + dot.radius,
    top: dot.y - dot.radius,
    bottom: dot.y + dot.radius,
  }));
  return {
    left: Math.min(...boxes.map((b) => b.left)),
    right: Math.max(...boxes.map((b) => b.right)),
    top: Math.min(...boxes.map((b) => b.top)),
    bottom: Math.max(...boxes.map((b) => b.bottom)),
  };
}

/** Plocha pro prst u domečku a u kolečka v CSS px okna. */
function cornerButtons(window: TestWindow): Box[] {
  const home = homeButtonFor(viewportOf(window));
  const gear = settingsGearFor(viewportOf(window));
  return [
    {
      left: home.left,
      right: home.left + home.hitSize,
      top: home.top,
      bottom: home.top + home.hitSize,
    },
    {
      left: window.width - gear.right - gear.hitSize,
      right: window.width - gear.right,
      top: gear.top,
      bottom: gear.top + gear.hitSize,
    },
  ];
}

function starBoxes(layout: CompareLayout, area: GameArea): Box[] {
  const size = layout.stars.starSize;
  return layout.stars.stars.map((star) =>
    cssOf({ left: star.x - size / 2, top: star.y - size / 2, width: size, height: size }, area),
  );
}

/** Tečky a podložka obrázku se navzájem nepřekrývají a jsou celé v `outer`. */
function expectPictureInside(
  picture: QuestionPicture,
  outer: Box,
  area: GameArea,
  name: string,
): void {
  const pieces = [...picture.dots.map(dotRect), ...picture.grounds].map((rect) =>
    cssOf(rect, area),
  );
  for (const [index, piece] of pieces.entries()) {
    expect(isInside(piece, outer), name).toBe(true);
    for (const other of pieces.slice(index + 1)) {
      expect(overlaps(piece, other), name).toBe(false);
    }
  }
}

describe('#182 AC3: nad kartami je stálý symbol otázky', () => {
  it('symbol je celý na obrazovce nad oběma kartami, uprostřed mezi nimi', () => {
    for (const window of ALL_WINDOWS) {
      const area = areaOf(window);
      const layout = layoutCompareScreen(area);
      const symbol = cssOf(layout.question, area);
      const [left, right] = layout.cards.map((card) => cssOf(card, area)) as [Box, Box];
      const whole = cssOf({ left: 0, top: 0, width: area.width, height: area.height }, area);
      expect(isInside(symbol, whole), window.name).toBe(true);
      expect(symbol.bottom, window.name).toBeLessThanOrEqual(left.top);
      expect(symbol.bottom, window.name).toBeLessThanOrEqual(right.top);
      const center = (symbol.left + symbol.right) / 2;
      expect(center, window.name).toBeCloseTo((left.left + right.right) / 2, 1);
    }
  });

  it('symbol nepřekrývá karty, „=“, hvězdičky, domeček ani kolečko', () => {
    for (const window of ALL_WINDOWS) {
      const area = areaOf(window);
      const layout = layoutCompareScreen(area);
      const symbol = cssOf(layout.question, area);
      const others: Array<{ name: string; box: Box }> = [
        { name: 'levá karta', box: cssOf(layout.cards[0], area) },
        { name: 'pravá karta', box: cssOf(layout.cards[1], area) },
        { name: '„=“', box: cssOf(layout.equalButton, area) },
        ...starBoxes(layout, area).map((box, index) => ({ name: `hvězdička ${index + 1}`, box })),
        ...cornerButtons(window).map((box, index) => ({ name: `roh ${index + 1}`, box })),
      ];
      for (const other of others) {
        expect(overlaps(symbol, other.box), `${window.name}: ${other.name}`).toBe(false);
      }
    }
  });

  it('symbol je dost velký, aby ho dítě poznalo (aspoň 44 px, v malém zmenšeném zobrazení 28 px)', () => {
    for (const window of ALL_WINDOWS) {
      const area = areaOf(window);
      const symbol = cssOf(layoutCompareScreen(area).question, area);
      const min = window === SCALED_WINDOW ? MIN_SCALED_SYMBOL_HEIGHT_CSS : MIN_SYMBOL_HEIGHT_CSS;
      expect(symbol.bottom - symbol.top, window.name).toBeGreaterThanOrEqual(min);
    }
  });

  it('hromádka otázky „víc“ i „míň“ je celá v symbolu a její tečky se nepřekrývají', () => {
    for (const window of ALL_WINDOWS) {
      const area = areaOf(window);
      const layout = layoutCompareScreen(area);
      for (const question of QUESTIONS) {
        const picture = questionPicture(question, layout.question);
        expectPictureInside(
          picture,
          cssOf(layout.question, area),
          area,
          `${window.name}: ${question}`,
        );
        for (const dot of picture.dots) {
          expect(2 * dot.radius * area.scale, window.name).toBeGreaterThanOrEqual(MIN_PILE_DOT_CSS);
        }
      }
    }
  });
});

describe('#182 AC3: symbol vyplní místo, které má nad kartami', () => {
  it('symbol „víc“ (hromádka s podložkou) zabere v každém okně aspoň 75 % vyhrazené výšky', () => {
    for (const window of ALL_WINDOWS) {
      const area = areaOf(window);
      const box = layoutCompareScreen(area).question;
      const picture = questionPicture('more', box);
      const top = Math.min(...picture.dots.map((dot) => dot.y - dot.radius));
      const bottom = Math.max(...picture.grounds.map((ground) => ground.top + ground.height));
      expect((bottom - top) / box.height, window.name).toBeGreaterThanOrEqual(MIN_SYMBOL_FILL);
    }
  });

  it('pyramida „víc“ je v každém okně vysoká aspoň 80 % vyhrazené výšky', () => {
    for (const window of ALL_WINDOWS) {
      const box = layoutCompareScreen(areaOf(window)).question;
      const pile = pileBox(questionPicture('more', box));
      expect((pile.bottom - pile.top) / box.height, window.name).toBeGreaterThanOrEqual(
        MIN_BIG_PILE_FILL,
      );
    }
  });

  it('„míň“ jsou jen 2 až 3 tečky stejně velké jako ve „víc“, takže je hromádka zřetelně malá', () => {
    for (const window of ALL_WINDOWS) {
      const box = layoutCompareScreen(areaOf(window)).question;
      const small = questionPicture('less', box);
      const big = questionPicture('more', box);
      expect(small.dots.length, window.name).toBeGreaterThanOrEqual(2);
      expect(small.dots.length, window.name).toBeLessThanOrEqual(3);
      expect(small.dots[0]?.radius, window.name).toBeCloseTo(big.dots[0]?.radius ?? 0, 6);
    }
  });
});

describe('#182: dítě trefí symbol otázky prstem', () => {
  it('ťukací plocha symbolu má v každém okně aspoň 64 × 64 px a celý symbol je v ní', () => {
    for (const window of ALL_WINDOWS) {
      const area = areaOf(window);
      const layout = layoutCompareScreen(area);
      const hit = cssOf(layout.questionHit, area);
      expect(hit.right - hit.left, window.name).toBeGreaterThanOrEqual(MIN_TOUCH_CSS - 0.01);
      expect(hit.bottom - hit.top, window.name).toBeGreaterThanOrEqual(MIN_TOUCH_CSS - 0.01);
      expect(isInside(cssOf(layout.question, area), hit), window.name).toBe(true);
      const whole = cssOf({ left: 0, top: 0, width: area.width, height: area.height }, area);
      expect(isInside(hit, whole), window.name).toBe(true);
    }
  });

  it('ťukací plocha symbolu je aspoň 8 px od karet, „=“, domečku i kolečka', () => {
    for (const window of ALL_WINDOWS) {
      const area = areaOf(window);
      const layout = layoutCompareScreen(area);
      const hit = cssOf(layout.questionHit, area);
      const targets: Array<{ name: string; box: Box }> = [
        { name: 'levá karta', box: cssOf(layout.cards[0], area) },
        { name: 'pravá karta', box: cssOf(layout.cards[1], area) },
        { name: '„=“', box: cssOf(layout.equalButton, area) },
        ...cornerButtons(window).map((box, index) => ({ name: `roh ${index + 1}`, box })),
      ];
      for (const target of targets) {
        expect(
          gapBetween(hit, target.box),
          `${window.name}: ${target.name}`,
        ).toBeGreaterThanOrEqual(MIN_TARGET_GAP_CSS - 0.01);
      }
    }
  });
});

describe('#182 AC3 a AC5: velká hromádka je „víc“, malá „míň“, pozná to i dítě, které neumí číst', () => {
  it('velká hromádka má víc teček a je aspoň 1,5× vyšší i širší než malá', () => {
    for (const window of ALL_WINDOWS) {
      const area = areaOf(window);
      const box = layoutCompareScreen(area).question;
      const big = questionPicture('more', box);
      const small = questionPicture('less', box);
      expect(big.dots.length, window.name).toBeGreaterThan(small.dots.length);
      const bigBox = pileBox(big);
      const smallBox = pileBox(small);
      expect(bigBox.right - bigBox.left, window.name).toBeGreaterThanOrEqual(
        MIN_PILE_RATIO * (smallBox.right - smallBox.left),
      );
      expect(bigBox.bottom - bigBox.top, window.name).toBeGreaterThanOrEqual(
        MIN_PILE_RATIO * (smallBox.bottom - smallBox.top),
      );
    }
  });

  it('obě hromádky mají stejně velké tečky a stojí na stejné podložce: liší se jen velikostí hromádky', () => {
    for (const window of ALL_WINDOWS) {
      const box = layoutCompareScreen(areaOf(window)).question;
      const big = questionPicture('more', box);
      const small = questionPicture('less', box);
      expect(new Set([...big.dots, ...small.dots].map((dot) => dot.radius.toFixed(6))).size).toBe(
        1,
      );
      expect(big.grounds).toEqual(small.grounds);
      expect(pileBox(big).bottom, window.name).toBeCloseTo(pileBox(small).bottom, 6);
    }
  });

  it('hromádka je ve tvaru kopečku: v každé řadě je o tečku míň než pod ní', () => {
    for (const question of QUESTIONS) {
      const picture = questionPicture(question, { left: 0, top: 0, width: 120, height: 90 });
      const rows = new Map<string, number>();
      for (const dot of picture.dots) {
        const key = dot.y.toFixed(3);
        rows.set(key, (rows.get(key) ?? 0) + 1);
      }
      const counts = [...rows.entries()]
        .sort((a, b) => Number(b[0]) - Number(a[0]))
        .map(([, count]) => count);
      expect(counts.at(-1), question).toBe(1);
      for (let index = 1; index < counts.length; index += 1) {
        expect(counts[index], question).toBe((counts[index - 1] ?? 0) - 1);
      }
    }
  });

  it('tečky symbolu mají jinou barvu než tečky na kartách, dítě je nepočítá s kartami', () => {
    expect(DOT_COLORS.map((color) => color.toLowerCase())).not.toContain(
      QUESTION_STYLE.dot.toLowerCase(),
    );
  });
});

describe('#182 AC1: v nastavení je řada „Otázka“ se stejnými symboly', () => {
  it('rodič vidí řadu otázky víc, míň, střídat jako třetí řadu', () => {
    for (const window of ALL_WINDOWS) {
      const layout = layoutCompareSettings(areaOf(window));
      expect(
        layout.rows.map((row) => row.kind),
        window.name,
      ).toEqual(['maxNumber', 'show', 'question']);
      expect(
        layout.rows[2].options.map((option) => option.value),
        window.name,
      ).toEqual([...QUESTION_OPTIONS]);
    }
  });

  it('volba „víc“ ukazuje velkou hromádku, „míň“ malou a „střídat“ obě vedle sebe, celé ve volbě', () => {
    for (const window of ALL_WINDOWS) {
      const area = areaOf(window);
      const [more, less, alternate] = layoutCompareSettings(area).rows[2].options;
      for (const option of [more, less, alternate]) {
        if (!option) {
          throw new Error(`${window.name}: chybí volba otázky`);
        }
        const outer = cssOf(
          {
            left: option.x - option.width / 2,
            top: option.y - option.height / 2,
            width: option.width,
            height: option.height,
          },
          area,
        );
        const icon = questionOptionIcon(option, option.value as (typeof QUESTION_OPTIONS)[number]);
        expectPictureInside(icon, outer, area, `${window.name}: ${String(option.value)}`);
      }
      if (!more || !less || !alternate) {
        continue;
      }
      const moreIcon = questionOptionIcon(more, 'more');
      const lessIcon = questionOptionIcon(less, 'less');
      const bothIcon = questionOptionIcon(alternate, 'alternate');
      expect(moreIcon.dots.length, window.name).toBeGreaterThan(lessIcon.dots.length);
      expect(bothIcon.dots.length, window.name).toBe(moreIcon.dots.length + lessIcon.dots.length);
      expect(bothIcon.grounds.length, window.name).toBe(2);
    }
  });
});
