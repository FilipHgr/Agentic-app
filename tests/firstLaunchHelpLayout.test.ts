import { describe, expect, it } from 'vitest';

import {
  SETTINGS_LABEL_COLOR,
  layoutFirstLaunchHelp,
  layoutSettingsPanel,
} from '../src/logic/settingsLayout';
import type { HelpTextBlock } from '../src/logic/settingsLayout';

/**
 * Testy k #48 AC2 a AC3: nápověda pro rodiče při prvním spuštění leží po
 * stranách ✓ na herní ploše 1024 × 768 a nic nepřekrývá. Že se text
 * v Safari ani v Chromu neořízne, nezalomí jinak a je čitelný na iPhonu,
 * se kontroluje ručně.
 */

const SCREEN_WIDTH = 1024;
const SCREEN_HEIGHT = 768;

const HELP_FONT_SIZE = 28;
const HELP_LINE_HEIGHT = 36;
const MAX_LINE_CHARACTERS = 22;
const EDGE_MARGIN = 24;
const GAP_TO_CONFIRM = 40;

interface Box {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

interface CenteredSlot {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

function centeredBox(slot: CenteredSlot): Box {
  return {
    left: slot.x - slot.width / 2,
    right: slot.x + slot.width / 2,
    top: slot.y - slot.height / 2,
    bottom: slot.y + slot.height / 2,
  };
}

function overlaps(first: Box, second: Box): boolean {
  return (
    first.left < second.right &&
    second.left < first.right &&
    first.top < second.bottom &&
    second.top < first.bottom
  );
}

const panel = layoutSettingsPanel(SCREEN_WIDTH, SCREEN_HEIGHT);
const help = layoutFirstLaunchHelp(SCREEN_WIDTH, SCREEN_HEIGHT);
const blocks: readonly HelpTextBlock[] = [help.left, help.right];

function confirmBox(): Box {
  const { x, y, size } = panel.confirm;
  return { left: x - size / 2, right: x + size / 2, top: y - size / 2, bottom: y + size / 2 };
}

/** Volby, popisky řad a ✓ z rozložení #47. */
function panelBoxes(): Box[] {
  const options = panel.rows.flatMap((row) => row.options.map(centeredBox));
  const labels = panel.rows.map((row) => centeredBox(row.label));
  return [...options, ...labels, confirmBox()];
}

describe('texty nápovědy pro rodiče (#48 AC2)', () => {
  it('vlevo od ✓ stojí „Nastavte hru pro dítě.“', () => {
    expect(help.left.lines).toEqual(['Nastavte hru pro dítě.']);
  });

  it('vpravo od ✓ jsou tři řádky o tom, jak se do nastavení vrátit', () => {
    expect(help.right.lines).toEqual([
      'Později se sem vrátíte',
      'podržením kolečka',
      'vpravo nahoře.',
    ]);
  });

  it('levý blok je zarovnaný doprava k ✓, pravý doleva k ✓', () => {
    expect(help.left.align).toBe('right');
    expect(help.right.align).toBe('left');
  });

  it('každý řádek má nejvýš 22 znaků', () => {
    for (const block of blocks) {
      for (const line of block.lines) {
        expect([...line].length, line).toBeLessThanOrEqual(MAX_LINE_CHARACTERS);
      }
    }
  });

  it('písmo má 28 px, řádek 36 px a barvu jako popisky řad', () => {
    for (const block of blocks) {
      expect(block.fontSize).toBe(HELP_FONT_SIZE);
      expect(block.lineHeight).toBe(HELP_LINE_HEIGHT);
      expect(block.color).toBe(SETTINGS_LABEL_COLOR);
    }
    expect(SETTINGS_LABEL_COLOR).toBe('#cfe8d6');
  });
});

describe('poloha nápovědy po stranách ✓ (#48 AC3)', () => {
  it('✓ zůstává na místě z #47: x 437–587, y 594–744', () => {
    expect(confirmBox()).toEqual({ left: 437, right: 587, top: 594, bottom: 744 });
  });

  it('levý blok leží v x 24–397 a y 651–687', () => {
    expect(centeredBox(help.left)).toEqual({ left: 24, right: 397, top: 651, bottom: 687 });
  });

  it('pravý blok leží v x 627–1000 a y 615–723', () => {
    expect(centeredBox(help.right)).toEqual({ left: 627, right: 1000, top: 615, bottom: 723 });
  });

  it('oba bloky jsou svisle na středu ✓', () => {
    for (const block of blocks) {
      expect(block.y).toBe(panel.confirm.y);
    }
    expect(panel.confirm.y).toBe(669);
  });

  it('výška bloku odpovídá počtu řádků po 36 px', () => {
    for (const block of blocks) {
      expect(block.height).toBe(block.lines.length * HELP_LINE_HEIGHT);
    }
  });

  it('oba bloky jsou v pásu ✓ y 594–744', () => {
    const confirm = confirmBox();
    for (const block of blocks) {
      const box = centeredBox(block);
      expect(box.top).toBeGreaterThanOrEqual(confirm.top);
      expect(box.bottom).toBeLessThanOrEqual(confirm.bottom);
    }
  });

  it('od ✓ dělí bloky 40 px a od okraje plochy 24 px', () => {
    const confirm = confirmBox();
    const left = centeredBox(help.left);
    const right = centeredBox(help.right);
    expect(confirm.left - left.right).toBe(GAP_TO_CONFIRM);
    expect(right.left - confirm.right).toBe(GAP_TO_CONFIRM);
    expect(left.left).toBe(EDGE_MARGIN);
    expect(SCREEN_WIDTH - right.right).toBe(EDGE_MARGIN);
  });

  it('nápověda nepřekrývá žádnou volbu, popisek ani ✓', () => {
    for (const block of blocks) {
      for (const other of panelBoxes()) {
        expect(overlaps(centeredBox(block), other)).toBe(false);
      }
    }
    expect(overlaps(centeredBox(help.left), centeredBox(help.right))).toBe(false);
  });

  it('celá nápověda je uvnitř herní plochy 1024 × 768', () => {
    for (const block of blocks) {
      const box = centeredBox(block);
      expect(box.left).toBeGreaterThanOrEqual(0);
      expect(box.top).toBeGreaterThanOrEqual(0);
      expect(box.right).toBeLessThanOrEqual(SCREEN_WIDTH);
      expect(box.bottom).toBeLessThanOrEqual(SCREEN_HEIGHT);
    }
  });

  it('ťuknutí na nápovědu nezasáhne volbu ani ✓', () => {
    // Na ťuknutí reagují jen volby a ✓; když se s nimi nápověda nepřekrývá,
    // ťuknutí na ni nic nezmění.
    const tappable = [...panel.rows.flatMap((row) => row.options.map(centeredBox)), confirmBox()];
    for (const block of blocks) {
      const box = centeredBox(block);
      const corners = [
        { x: box.left, y: box.top },
        { x: box.right - 0.5, y: box.bottom - 0.5 },
        { x: block.x, y: block.y },
      ];
      for (const point of corners) {
        for (const target of tappable) {
          const hit =
            point.x >= target.left &&
            point.x < target.right &&
            point.y >= target.top &&
            point.y < target.bottom;
          expect(hit).toBe(false);
        }
      }
    }
  });

  it('nápověda nemění rozložení řad, popisků ani ✓ z #47', () => {
    layoutFirstLaunchHelp(SCREEN_WIDTH, SCREEN_HEIGHT);
    expect(layoutSettingsPanel(SCREEN_WIDTH, SCREEN_HEIGHT)).toEqual(panel);
  });
});
