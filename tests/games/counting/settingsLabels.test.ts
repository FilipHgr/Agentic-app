import { describe, expect, it } from 'vitest';

import type { GameProgress } from '../../../src/games/counting/logic/progress';
import type { GameSettings } from '../../../src/games/counting/logic/settings';
import { layoutSettingsPanel } from '../../../src/games/counting/logic/settingsLayout';
import type { SettingsLayout, SettingsRow } from '../../../src/games/counting/logic/settingsLayout';
import {
  CLOSED_SETTINGS,
  chooseOption,
  confirmSettings,
  openSettings,
  pageAppearance,
  selectedOptions,
} from '../../../src/games/counting/logic/settingsSession';
import type { SettingsSession } from '../../../src/games/counting/logic/settingsSession';
import { STARS_PER_SET } from '../../../src/games/counting/logic/stars';
import { SETTINGS_LABEL_COLOR, settingsOptionLook } from '../../../src/games/counting/logic/theme';

/**
 * Testy k #47 (popisky řad v nastavení pro rodiče) na herní ploše 1024 × 768:
 * texty popisků (AC1), jejich pruhy (AC2), svislé rozložení (AC3), žádné
 * překrytí (AC4), ťuknutí mimo volby (AC5), barva a kontrast (AC6)
 * a stálost po opakovaném otevření (AC7). Že popisek na ťuknutí nereaguje,
 * diakritika v Safari a v Chromu a čitelnost na iPhonu se kontrolují ručně.
 */

const SCREEN_WIDTH = 1024;
const SCREEN_HEIGHT = 768;

const LABEL_HEIGHT = 32;
const LABEL_FONT_SIZE = 28;
const LABEL_TO_ROW_GAP = 8;
const MAX_LABEL_CHARACTERS = 12;

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

function confirmBox(layout: SettingsLayout): Box {
  const { x, y, size } = layout.confirm;
  return { left: x - size / 2, right: x + size / 2, top: y - size / 2, bottom: y + size / 2 };
}

/** Celá řada voleb od levé hrany první volby po pravou hranu poslední. */
function rowBox(row: SettingsRow): Box {
  const boxes = row.options.map(centeredBox);
  return {
    left: Math.min(...boxes.map((box) => box.left)),
    right: Math.max(...boxes.map((box) => box.right)),
    top: Math.min(...boxes.map((box) => box.top)),
    bottom: Math.max(...boxes.map((box) => box.bottom)),
  };
}

function labelBox(row: SettingsRow): Box {
  return centeredBox(row.label);
}

/** Pruh popisku i s mezerou 8 px pod ním (místo, kam se ťukne mimo volbu). */
function labelWithGapBox(row: SettingsRow): Box {
  const box = labelBox(row);
  return { ...box, bottom: box.bottom + LABEL_TO_ROW_GAP };
}

/** Na ťuknutí reagují jen volby a ✓. */
function tappableBoxes(layout: SettingsLayout): Box[] {
  const options = layout.rows.flatMap((row) => row.options.map(centeredBox));
  return [...options, confirmBox(layout)];
}

/** Bod uvnitř plochy; spodní a pravá hrana už patří sousedovi. */
function containsPoint(box: Box, x: number, y: number): boolean {
  return x >= box.left && x < box.right && y >= box.top && y < box.bottom;
}

function overlaps(first: Box, second: Box): boolean {
  return (
    first.left < second.right &&
    second.left < first.right &&
    first.top < second.bottom &&
    second.top < first.bottom
  );
}

/** Body po půl pixelu, aby test našel i úzký přesah. */
function pointsIn(box: Box): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  for (let y = box.top; y < box.bottom; y += 0.5) {
    for (let x = box.left; x < box.right; x += 0.5) {
      points.push({ x, y });
    }
  }
  return points;
}

/** Relativní jas barvy podle WCAG 2.x. */
function relativeLuminance(hexColor: string): number {
  const hex = hexColor.replace('#', '');
  const channels = [0, 2, 4].map((start) => parseInt(hex.slice(start, start + 2), 16) / 255);
  const [red, green, blue] = channels.map((channel) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * (red ?? 0) + 0.7152 * (green ?? 0) + 0.0722 * (blue ?? 0);
}

function contrastRatio(first: string, second: string): number {
  const lighter = Math.max(relativeLuminance(first), relativeLuminance(second));
  const darker = Math.min(relativeLuminance(first), relativeLuminance(second));
  return (lighter + 0.05) / (darker + 0.05);
}

const layout = layoutSettingsPanel(SCREEN_WIDTH, SCREEN_HEIGHT);
const EXPECTED_TEXTS = ['Do kolika', 'Příklady', 'Odpověď'];

describe('popisky řad v nastavení (#47 AC1)', () => {
  it('rodič vidí nad řadami shora dolů „Do kolika“, „Příklady“ a „Odpověď“', () => {
    expect(layout.rows.map((row) => row.kind)).toEqual(['maxNumber', 'operations', 'answerInput']);
    expect(layout.rows.map((row) => row.label.text)).toEqual(EXPECTED_TEXTS);
  });

  it('každý popisek je krátký, nejvýš 12 znaků', () => {
    for (const row of layout.rows) {
      expect([...row.label.text].length).toBeLessThanOrEqual(MAX_LABEL_CHARACTERS);
      expect(row.label.text.trim().length).toBeGreaterThan(0);
    }
  });

  it('popisek je nad svou řadou, ne pod ní', () => {
    for (const row of layout.rows) {
      expect(labelBox(row).bottom).toBeLessThanOrEqual(rowBox(row).top);
    }
  });
});

describe('pruh popisku (#47 AC2)', () => {
  it('pruh popisku je vysoký 32 px a písmo má 28 px', () => {
    for (const row of layout.rows) {
      expect(row.label.height).toBe(LABEL_HEIGHT);
      expect(row.label.fontSize).toBe(LABEL_FONT_SIZE);
    }
  });

  it('popisek je široký jako jeho řada: 740 px u rozsahu a příkladů, 480 px u odpovědi', () => {
    expect(layout.rows.map((row) => row.label.width)).toEqual([740, 740, 480]);
    for (const row of layout.rows) {
      const options = rowBox(row);
      expect(row.label.width).toBe(options.right - options.left);
    }
  });

  it('popisek je vodorovně na středu nad řadou', () => {
    for (const row of layout.rows) {
      const label = labelBox(row);
      const options = rowBox(row);
      expect(label.left).toBe(options.left);
      expect(label.right).toBe(options.right);
      expect(row.label.x).toBe(SCREEN_WIDTH / 2);
    }
  });

  it('od horní hrany řady dělí popisek 8 px', () => {
    for (const row of layout.rows) {
      expect(rowBox(row).top - labelBox(row).bottom).toBe(LABEL_TO_ROW_GAP);
    }
  });

  it('písmo 28 px se vejde do pruhu 32 px', () => {
    for (const row of layout.rows) {
      expect(row.label.fontSize).toBeLessThanOrEqual(row.label.height);
    }
  });
});

describe('svislé rozložení s popisky (#47 AC3)', () => {
  it('okraj nad prvním popiskem je 12 px', () => {
    expect(labelBox(layout.rows[0]).top).toBe(12);
  });

  it('popisky leží na y 12–44, 202–234 a 392–424', () => {
    expect(layout.rows.map((row) => [labelBox(row).top, labelBox(row).bottom])).toEqual([
      [12, 44],
      [202, 234],
      [392, 424],
    ]);
  });

  it('řady voleb mají středy na y 117, 307 a 497 a výšku 130 px', () => {
    expect(layout.rows.map((row) => row.y)).toEqual([117, 307, 497]);
    for (const row of layout.rows) {
      const box = rowBox(row);
      expect(box.bottom - box.top).toBe(130);
    }
  });

  it('od spodní hrany řady k dalšímu popisku je 20 px', () => {
    expect(labelBox(layout.rows[1]).top - rowBox(layout.rows[0]).bottom).toBe(20);
    expect(labelBox(layout.rows[2]).top - rowBox(layout.rows[1]).bottom).toBe(20);
  });

  it('✓ 150 × 150 px má střed na y 669, 32 px pod poslední řadou', () => {
    expect(layout.confirm.size).toBe(150);
    expect(layout.confirm.y).toBe(669);
    expect(confirmBox(layout).top - rowBox(layout.rows[2]).bottom).toBe(32);
  });

  it('pod ✓ zbývá 24 px a vše dohromady dá přesně 768 px', () => {
    expect(SCREEN_HEIGHT - confirmBox(layout).bottom).toBe(24);
    expect(12 + 3 * (32 + 8 + 130) + 2 * 20 + 32 + 150 + 24).toBe(SCREEN_HEIGHT);
  });
});

describe('popisky se s ničím nepřekrývají (#47 AC4)', () => {
  it('žádný popisek se nepřekrývá s volbou ani s ✓', () => {
    for (const row of layout.rows) {
      for (const box of tappableBoxes(layout)) {
        expect(overlaps(labelBox(row), box)).toBe(false);
      }
    }
  });

  it('žádný popisek se nepřekrývá s jiným popiskem', () => {
    const labels = layout.rows.map(labelBox);
    for (let first = 0; first < labels.length; first += 1) {
      for (let second = first + 1; second < labels.length; second += 1) {
        const firstLabel = labels[first];
        const secondLabel = labels[second];
        if (firstLabel === undefined || secondLabel === undefined) {
          throw new Error('Popisek chybí');
        }
        expect(overlaps(firstLabel, secondLabel)).toBe(false);
      }
    }
  });

  it('popisky, volby i ✓ leží celé uvnitř herní plochy 1024 × 768', () => {
    const boxes = [...layout.rows.map(labelBox), ...tappableBoxes(layout)];
    for (const box of boxes) {
      expect(box.left).toBeGreaterThanOrEqual(0);
      expect(box.top).toBeGreaterThanOrEqual(0);
      expect(box.right).toBeLessThanOrEqual(SCREEN_WIDTH);
      expect(box.bottom).toBeLessThanOrEqual(SCREEN_HEIGHT);
    }
  });

  it('volby mají dál 220 × 130 px a mezi sebou vodorovně 40 px', () => {
    for (const row of layout.rows) {
      const boxes = row.options.map(centeredBox);
      boxes.forEach((box, index) => {
        expect(box.right - box.left).toBe(220);
        expect(box.bottom - box.top).toBe(130);
        const previous = boxes[index - 1];
        if (previous !== undefined) {
          expect(box.left - previous.right).toBe(40);
        }
      });
    }
  });

  it('řady i ✓ zůstávají vodorovně na středu', () => {
    for (const row of layout.rows) {
      const box = rowBox(row);
      expect(box.left).toBe(SCREEN_WIDTH - box.right);
    }
    expect(layout.confirm.x).toBe(SCREEN_WIDTH / 2);
  });
});

describe('ťuknutí na popisek nic nezmění (#47 AC5)', () => {
  it('žádný bod pruhu popisku ani mezery 8 px pod ním neleží ve volbě ani v ✓', () => {
    const tappable = tappableBoxes(layout);
    for (const row of layout.rows) {
      for (const point of pointsIn(labelWithGapBox(row))) {
        const hit = tappable.some((box) => containsPoint(box, point.x, point.y));
        if (hit) {
          throw new Error(`Bod [${point.x}, ${point.y}] u popisku „${row.label.text}“ je ve volbě`);
        }
      }
    }
  });

  it('mezera pod popiskem končí přesně na horní hraně řady, volba se nezmenšila', () => {
    for (const row of layout.rows) {
      expect(labelWithGapBox(row).bottom).toBe(rowBox(row).top);
    }
  });
});

describe('barva popisků (#47 AC6, #53 AC2)', () => {
  const page = pageAppearance(
    openSettings(CLOSED_SETTINGS, { maxNumber: 10, operations: 'plus' }),
  ).background;

  it('popisky jsou šedé #6E6E73', () => {
    expect(SETTINGS_LABEL_COLOR.toLowerCase()).toBe('#6e6e73');
  });

  it('na světlém pozadí #F5F5F7 mají kontrast aspoň 4,5 : 1 (asi 4,66 : 1)', () => {
    expect(page.toLowerCase()).toBe('#f5f5f7');
    const ratio = contrastRatio(SETTINGS_LABEL_COLOR, page);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
    expect(Math.abs(ratio - 4.66)).toBeLessThan(0.1);
  });

  it('popisky nejsou modré jako vybraná volba', () => {
    expect(SETTINGS_LABEL_COLOR.toLowerCase()).not.toBe(
      settingsOptionLook(true).background.toLowerCase(),
    );
  });
});

describe('popisky jsou pořád na místě (#47 AC7)', () => {
  const REPEATS = 5;
  const SAVED: GameSettings = { maxNumber: 20, operations: 'mixed', answerInput: 'writing' };
  const PROGRESS_MID_SET: GameProgress = { earned: 4 };
  const PROGRESS_CELEBRATING: GameProgress = { earned: STARS_PER_SET };
  const expectedLabels = layout.rows.map((row) => row.label);

  /** Popisky v právě otevřeném nastavení; bez popisků test selže. */
  function currentLabels(): SettingsRow['label'][] {
    const labels = layoutSettingsPanel(SCREEN_WIDTH, SCREEN_HEIGHT).rows.map((row) => row.label);
    expect(labels.map((label) => label.text)).toEqual(EXPECTED_TEXTS);
    return labels;
  }

  it('po pětinásobném otevření a zavření jsou popisky na stejném místě', () => {
    let session: SettingsSession = CLOSED_SETTINGS;
    let settings = SAVED;
    let progress = PROGRESS_MID_SET;

    for (let round = 0; round < REPEATS; round += 1) {
      session = openSettings(session, settings);
      expect(currentLabels()).toEqual(expectedLabels);

      const result = confirmSettings(session, settings, progress);
      session = result.session;
      settings = result.settings;
      progress = result.progress;
    }
  });

  it('při otevření během oslavy jsou popisky na místě', () => {
    const session = openSettings(CLOSED_SETTINGS, SAVED);
    const result = confirmSettings(session, SAVED, PROGRESS_CELEBRATING);
    expect(result.progress.earned).toBe(0);
    expect(currentLabels()).toEqual(expectedLabels);
  });

  it('při rozepsaném tahu (psaní prstem) jsou popisky na místě', () => {
    const writing: GameSettings = { maxNumber: 10, operations: 'plus', answerInput: 'writing' };
    const session = openSettings(CLOSED_SETTINGS, writing);
    expect(selectedOptions(session)?.answerInput).toBe('writing');
    expect(currentLabels()).toEqual(expectedLabels);
  });

  it('popisky nezávisí na tom, co je vybrané', () => {
    const choices: Partial<GameSettings>[] = [
      { maxNumber: 5 },
      { operations: 'minus' },
      { answerInput: 'keypad' },
      { maxNumber: 20, operations: 'mixed', answerInput: 'writing' },
    ];
    let session = openSettings(CLOSED_SETTINGS, SAVED);
    for (const change of choices) {
      session = chooseOption(session, change);
      expect(currentLabels()).toEqual(expectedLabels);
    }
  });
});
