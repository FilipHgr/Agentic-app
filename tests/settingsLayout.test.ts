import { describe, expect, it } from 'vitest';

import { CHECK_BUTTON_COLOR, checkButtonStyle } from '../src/logic/checkButton';
import { PENCIL_ICON, layoutSettingsPanel } from '../src/logic/settingsLayout';
import type { SettingsLayout } from '../src/logic/settingsLayout';

/**
 * Testy k #45 (úprava nastavení pro rodiče) na herní ploše 1024 × 768:
 * rovnoměrné rozložení tří řad voleb a ✓ (AC1–AC3), rozměry tužky (AC4)
 * a jednotné pravidlo pro tlačítka ✓ (AC5). Svislá čísla z AC1 a AC2 změnilo
 * #47 AC3 (popisky řad). Barvy, vzhled tužky v Safari
 * a v Chromu a tmavá stránka se kontrolují ručně.
 */

const SCREEN_WIDTH = 1024;
const SCREEN_HEIGHT = 768;

/** Nejmenší dotyková plocha pro dětský prst (CLAUDE.md). */
const MIN_TOUCH_SIZE = 64;

/** Tolerance ±1 px u zaoblení a tahu ✓ (AC5). */
const STYLE_TOLERANCE = 1;

interface Box {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

/** Prvek na daném místě; když chybí, test selže s jasnou zprávou. */
function itemAt<T>(items: readonly T[], index: number): T {
  const item = items[index];
  expect(item).toBeDefined();
  if (item === undefined) {
    throw new Error(`Na místě ${index} nic není`);
  }
  return item;
}

/** Poslední prvek; když je pole prázdné, test selže. */
function lastOf<T>(items: readonly T[]): T {
  return itemAt(items, items.length - 1);
}

function optionBox(option: { x: number; y: number; width: number; height: number }): Box {
  return {
    left: option.x - option.width / 2,
    right: option.x + option.width / 2,
    top: option.y - option.height / 2,
    bottom: option.y + option.height / 2,
  };
}

function confirmBox(layout: SettingsLayout): Box {
  const { x, y, size } = layout.confirm;
  return { left: x - size / 2, right: x + size / 2, top: y - size / 2, bottom: y + size / 2 };
}

function allBoxes(layout: SettingsLayout): Box[] {
  const options = layout.rows.flatMap((row) => row.options.map(optionBox));
  return [...options, confirmBox(layout)];
}

function overlaps(first: Box, second: Box): boolean {
  return (
    first.left < second.right &&
    second.left < first.right &&
    first.top < second.bottom &&
    second.top < first.bottom
  );
}

const layout = layoutSettingsPanel(SCREEN_WIDTH, SCREEN_HEIGHT);

describe('rozložení nastavení: tři řady voleb (#45 AC1)', () => {
  it('rodič vidí tři řady: rozsah 5/10/20, druh příkladů + − a způsob odpovědi 123/tužka', () => {
    expect(layout.rows.map((row) => row.kind)).toEqual(['maxNumber', 'operations', 'answerInput']);
    expect(layout.rows[0].options.map((option) => option.value)).toEqual([5, 10, 20]);
    expect(layout.rows[1].options.map((option) => option.value)).toEqual([
      'plus',
      'minus',
      'mixed',
    ]);
    expect(layout.rows[2].options.map((option) => option.value)).toEqual(['keypad', 'writing']);
  });

  // Čísla změnilo #47 AC3 (místo pro popisky řad), dřív 110, 280 a 450.
  it('řady voleb mají středy na y 117, 307 a 497', () => {
    expect(layout.rows.map((row) => row.y)).toEqual([117, 307, 497]);
    for (const row of layout.rows) {
      for (const option of row.options) {
        expect(option.y).toBe(row.y);
      }
    }
  });

  it('každá řada voleb je vysoká 130 px', () => {
    for (const row of layout.rows) {
      for (const option of row.options) {
        expect(option.height).toBe(130);
      }
    }
  });

  // Podle #47 AC3: nad řadou je popisek (12 + 32 + 8 px) a mezi řadami
  // 20 + 32 + 8 px, dřív 45 px a 40 px.
  it('nad první řadou je 52 px a mezi řadami 60 px pro popisek', () => {
    const firstBox = optionBox(itemAt(layout.rows[0].options, 0));
    const secondBox = optionBox(itemAt(layout.rows[1].options, 0));
    const thirdBox = optionBox(itemAt(layout.rows[2].options, 0));
    expect(firstBox.top).toBe(52);
    expect(secondBox.top - firstBox.bottom).toBe(60);
    expect(thirdBox.top - secondBox.bottom).toBe(60);
  });
});

describe('rozložení nastavení: tlačítko ✓ (#45 AC2)', () => {
  // Podle #47 AC3, dřív y 650.
  it('✓ má střed na y 669 a je vodorovně uprostřed', () => {
    expect(layout.confirm.y).toBe(669);
    expect(layout.confirm.x).toBe(SCREEN_WIDTH / 2);
  });

  it('✓ je velké 150 × 150 px', () => {
    expect(layout.confirm.size).toBe(150);
  });

  // Podle #47 AC3, dřív 60 px a 43 px.
  it('mezi poslední řadou voleb a ✓ je 32 px a pod ✓ zbývá 24 px', () => {
    const lastRow = optionBox(itemAt(layout.rows[2].options, 0));
    const confirm = confirmBox(layout);
    expect(confirm.top - lastRow.bottom).toBe(32);
    expect(SCREEN_HEIGHT - confirm.bottom).toBe(24);
  });
});

describe('rozložení nastavení: nic se nepřekrývá a vše se vejde (#45 AC3)', () => {
  it('každá volba je velká 220 × 130 px', () => {
    for (const row of layout.rows) {
      for (const option of row.options) {
        expect(option.width).toBe(220);
        expect(option.height).toBe(130);
      }
    }
  });

  it('žádná volba ani ✓ se nepřekrývá s jinou', () => {
    const boxes = allBoxes(layout);
    for (let first = 0; first < boxes.length; first += 1) {
      for (let second = first + 1; second < boxes.length; second += 1) {
        expect(overlaps(itemAt(boxes, first), itemAt(boxes, second))).toBe(false);
      }
    }
  });

  it('všechny volby i ✓ leží celé uvnitř herní plochy 1024 × 768', () => {
    for (const box of allBoxes(layout)) {
      expect(box.left).toBeGreaterThanOrEqual(0);
      expect(box.top).toBeGreaterThanOrEqual(0);
      expect(box.right).toBeLessThanOrEqual(SCREEN_WIDTH);
      expect(box.bottom).toBeLessThanOrEqual(SCREEN_HEIGHT);
    }
  });

  it('na každou volbu i ✓ se pohodlně trefí prst (aspoň 64 × 64 px)', () => {
    for (const box of allBoxes(layout)) {
      expect(box.right - box.left).toBeGreaterThanOrEqual(MIN_TOUCH_SIZE);
      expect(box.bottom - box.top).toBeGreaterThanOrEqual(MIN_TOUCH_SIZE);
    }
  });

  it('mezi sousedními volbami v řadě je vodorovně 40 px', () => {
    for (const row of layout.rows) {
      const boxes = row.options.map(optionBox);
      for (let index = 1; index < boxes.length; index += 1) {
        expect(itemAt(boxes, index).left - itemAt(boxes, index - 1).right).toBe(40);
      }
    }
  });

  it('každá řada voleb je vodorovně na středu', () => {
    for (const row of layout.rows) {
      const boxes = row.options.map(optionBox);
      const leftMargin = itemAt(boxes, 0).left;
      const rightMargin = SCREEN_WIDTH - lastOf(boxes).right;
      expect(leftMargin).toBe(rightMargin);
    }
  });

  it('řada se třemi volbami je široká 740 px', () => {
    const boxes = layout.rows[0].options.map(optionBox);
    expect(lastOf(boxes).right - itemAt(boxes, 0).left).toBe(740);
  });
});

describe('tužka ve volbě psaní (#45 AC4)', () => {
  it('tužka se vejde do čtverce 60–80 px a její delší strana má aspoň 60 px', () => {
    const longerSide = Math.max(PENCIL_ICON.width, PENCIL_ICON.height);
    expect(longerSide).toBeGreaterThanOrEqual(60);
    expect(longerSide).toBeLessThanOrEqual(80);
    expect(PENCIL_ICON.width).toBeLessThanOrEqual(80);
    expect(PENCIL_ICON.height).toBeLessThanOrEqual(80);
  });

  it('tah tužky je tlustý aspoň 8 px', () => {
    expect(PENCIL_ICON.strokeWidth).toBeGreaterThanOrEqual(8);
  });

  it('tužka leží šikmo s hrotem vlevo dole, jak se drží při psaní', () => {
    // Souřadnice jsou vůči středu volby, y roste dolů.
    expect(PENCIL_ICON.tip.x).toBeLessThan(PENCIL_ICON.tail.x);
    expect(PENCIL_ICON.tip.y).toBeGreaterThan(PENCIL_ICON.tail.y);
  });

  it('hrot i konec tužky leží uvnitř jejího čtverce', () => {
    for (const point of [PENCIL_ICON.tip, PENCIL_ICON.tail]) {
      expect(Math.abs(point.x)).toBeLessThanOrEqual(PENCIL_ICON.width / 2);
      expect(Math.abs(point.y)).toBeLessThanOrEqual(PENCIL_ICON.height / 2);
    }
  });

  it('tužka se i s tahem vejde do volby 220 × 130 px', () => {
    const option = itemAt(layout.rows[2].options, 1);
    expect(PENCIL_ICON.width + PENCIL_ICON.strokeWidth).toBeLessThanOrEqual(option.width);
    expect(PENCIL_ICON.height + PENCIL_ICON.strokeWidth).toBeLessThanOrEqual(option.height);
  });
});

describe('jednotné pravidlo pro tlačítka ✓ (#45 AC5)', () => {
  it('✓ v nastavení (150 px) má zaoblení rohu 27 px a fajfku tlustou 19,5 px', () => {
    const style = checkButtonStyle(layout.confirm.size);
    expect(Math.abs(style.cornerRadius - 27)).toBeLessThanOrEqual(STYLE_TOLERANCE);
    expect(Math.abs(style.tickWidth - 19.5)).toBeLessThanOrEqual(STYLE_TOLERANCE);
  });

  it('zaoblení je 0,18 a tah 0,13 velikosti tlačítka i u jiných velikostí', () => {
    for (const size of [64, 100, 140, 150, 200]) {
      const style = checkButtonStyle(size);
      expect(Math.abs(style.cornerRadius - 0.18 * size)).toBeLessThanOrEqual(STYLE_TOLERANCE);
      expect(Math.abs(style.tickWidth - 0.13 * size)).toBeLessThanOrEqual(STYLE_TOLERANCE);
    }
  });

  it('✓ v nastavení má stejnou zelenou jako ✓ ve hře', () => {
    expect(CHECK_BUTTON_COLOR).toBe(0x8be04e);
  });
});
