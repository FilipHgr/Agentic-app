import { describe, expect, it } from 'vitest';

import { ACTION_BUTTONS, actionButtonLook } from '../../../src/games/coloring/logic/actionButtons';
import type { ActionButtonId } from '../../../src/games/coloring/logic/actionButtons';
import {
  BOOK_ICON_FILE,
  BROOM_ICON_FILE,
  CAMERA_ICON_FILE,
  CONTINUE_ICON_FILE,
  TRASH_ICON_FILE,
} from '../../../src/games/coloring/logic/toolIcons';
import { MIN_CONTRASTING_EDGE, contrastingEdgeShare } from './actionIconHelpers';
import { ACTION_ICON_MEASURES } from './actionIconMeasures';
import { limited, sameHex } from './toolIconHelpers';

/**
 * Testy k #153 AC2 (barvy podkladů): tlačítka, která obrázek odstraní
 * (koš, koště), mají červený podklad, tlačítka, která obrázek uchovají
 * (fotoaparát, album, malovat dál), zelený. Ikona má proti podkladu
 * kontrast aspoň 3 : 1.
 *
 * Kontrast ikony: ikona je vícebarevný obrázek, proto se měří na jejím
 * okraji, kde se ikona potkává s podkladem (`edgeColors` v
 * `actionIconMeasures.ts`). Okrajový bod se nejdřív složí se svou
 * průhledností na podklad tlačítka, jak ho nakreslí plátno, a teprve
 * složená barva se porovná s podkladem. Aspoň 90 % okraje musí mít proti podkladu
 * kontrast aspoň 3 : 1 (WCAG pro grafické prvky, jako u ovládacích prvků
 * jinde ve hře).
 *
 * Navržené rozhraní (`src/games/coloring/logic/actionButtons.ts`, čistý
 * TypeScript bez Phaseru):
 * - `type ActionButtonId = 'camera' | 'album' | 'continue' | 'trash' | 'broom'`,
 * - `ACTION_BUTTONS: readonly ActionButtonId[]` všech pět tlačítek,
 * - `interface ActionButtonLook { readonly iconFile: string;
 *    readonly background: string; readonly borderColor: string }`
 *   (barvy `#RRGGBB`),
 * - `actionButtonLook(id: ActionButtonId): ActionButtonLook`.
 * Scéna (`IconButtonView`) dostane vzhled tlačítka místo jména souboru
 * a kreslí podklad a okraj v jeho barvách; šipky alba (#149) a Zpět
 * zůstávají modré (mimo rozsah).
 */

/** Tlačítka, která obrázek odstraní: podklad a okraj (AC2). */
const REMOVE_BACKGROUND = '#FFE1DE';
const REMOVE_BORDER = '#F2A49A';

/** Tlačítka, která obrázek uchovají: podklad a okraj (AC2). */
const KEEP_BACKGROUND = '#E2F6E5';
const KEEP_BORDER = '#9FD8AB';

interface ExpectedButton {
  readonly id: ActionButtonId;
  readonly name: string;
  readonly iconFile: string;
  readonly removes: boolean;
}

const BUTTONS: readonly ExpectedButton[] = [
  { id: 'camera', name: 'fotoaparát', iconFile: CAMERA_ICON_FILE, removes: false },
  { id: 'album', name: 'album', iconFile: BOOK_ICON_FILE, removes: false },
  { id: 'continue', name: 'malovat dál', iconFile: CONTINUE_ICON_FILE, removes: false },
  { id: 'trash', name: 'koš', iconFile: TRASH_ICON_FILE, removes: true },
  { id: 'broom', name: 'koště', iconFile: BROOM_ICON_FILE, removes: true },
];

describe('#153 AC2: barva podkladu ukazuje, jestli tlačítko obrázek uchová, nebo odstraní', () => {
  it('všech pět tlačítek alba a malování má vlastní vzhled', () => {
    expect([...ACTION_BUTTONS].sort()).toEqual(BUTTONS.map((button) => button.id).sort());
  });

  it('každé tlačítko ukazuje svou novou ikonu', () => {
    for (const button of BUTTONS) {
      expect(actionButtonLook(button.id).iconFile, button.name).toBe(button.iconFile);
    }
  });

  it('koš a koště, které obrázek odstraní, mají světle červený podklad #FFE1DE s okrajem #F2A49A', () => {
    for (const button of BUTTONS.filter((candidate) => candidate.removes)) {
      const look = actionButtonLook(button.id);
      expect(
        sameHex(look.background, REMOVE_BACKGROUND),
        `${button.name}: podklad ${look.background}`,
      ).toBe(true);
      expect(
        sameHex(look.borderColor, REMOVE_BORDER),
        `${button.name}: okraj ${look.borderColor}`,
      ).toBe(true);
    }
  });

  it('fotoaparát, album a malovat dál, které obrázek uchovají, mají světle zelený podklad #E2F6E5 s okrajem #9FD8AB', () => {
    for (const button of BUTTONS.filter((candidate) => !candidate.removes)) {
      const look = actionButtonLook(button.id);
      expect(
        sameHex(look.background, KEEP_BACKGROUND),
        `${button.name}: podklad ${look.background}`,
      ).toBe(true);
      expect(
        sameHex(look.borderColor, KEEP_BORDER),
        `${button.name}: okraj ${look.borderColor}`,
      ).toBe(true);
    }
  });

  it('ikona každého tlačítka je proti jeho podkladu dobře vidět (kontrast aspoň 3 : 1)', () => {
    const problems: string[] = [];
    for (const button of BUTTONS) {
      const measure = ACTION_ICON_MEASURES[button.iconFile];
      if (measure === undefined) {
        problems.push(
          `${button.name}: chybí změřený okraj ${button.iconFile} v actionIconMeasures.ts`,
        );
        continue;
      }
      const background = actionButtonLook(button.id).background;
      const share = contrastingEdgeShare(measure.edgeColors, background);
      if (share < MIN_CONTRASTING_EDGE) {
        problems.push(
          `${button.name}: kontrast aspoň 3 : 1 proti ${background} má jen ${(share * 100).toFixed(1)} % okraje ikony`,
        );
      }
    }
    expect(limited(problems)).toEqual([]);
  });
});
