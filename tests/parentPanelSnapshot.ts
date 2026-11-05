/**
 * Velikosti a polohy prvků nastavení pro rodiče a průvodce nastavením
 * v CSS px okna (#59). Testy je porovnávají se zafixovanými hodnotami
 * z dnešního kódu, aby se iPad, zmenšená okna a průvodce nezměnili.
 */

import {
  TABLET_GAME_HEIGHT,
  TABLET_GAME_WIDTH,
  gameAreaFor,
  panelPlacement,
} from '../src/logic/deviceLayout';
import type { GameArea, PanelPlacement } from '../src/logic/deviceLayout';
import { layoutSettingsPanel } from '../src/logic/settingsLayout';
import type { SettingsLayout, SettingsRow } from '../src/logic/settingsLayout';
import { layoutGuideStep } from '../src/logic/setupGuide';
import type { GuideStep } from '../src/logic/setupGuide';
import { box, toCss, viewportOf } from './viewportFixtures';
import type { Box, Placement, TestWindow } from './viewportFixtures';

export const GUIDE_STEPS: readonly GuideStep[] = [1, 2, 3, 4];

/** Zaokrouhlení na tisíciny, aby snapshot nezávisel na drobných chybách v plovoucí čárce. */
function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function roundBox(b: Box): Box {
  return {
    left: round(b.left),
    right: round(b.right),
    top: round(b.top),
    bottom: round(b.bottom),
  };
}

/**
 * Jak je panel umístěný v okně v CSS px: herní plocha v okně a panel na
 * herní ploše (jednotky panelu → jednotky plochy) dohromady.
 */
export function panelCssPlacement(area: GameArea, placement: PanelPlacement): Placement {
  return {
    scale: placement.scale * area.scale,
    offsetX: area.offsetX + placement.x * area.scale,
    offsetY: area.offsetY + placement.y * area.scale,
  };
}

interface CenteredSlot {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export function cssBoxOf(slot: CenteredSlot, placement: Placement): Box {
  return roundBox(toCss(box(slot.x, slot.y, slot.width, slot.height), placement));
}

function cssSize(size: number, placement: Placement): number {
  return round(size * placement.scale);
}

function cssRow(row: SettingsRow, placement: Placement): object {
  return {
    kind: row.kind,
    label: {
      text: row.label.text,
      ...cssBoxOf(row.label, placement),
      fontSize: cssSize(row.label.fontSize, placement),
    },
    options: row.options.map((option) => ({
      value: option.value,
      ...cssBoxOf(option, placement),
    })),
  };
}

/** Řady a ✓ nastavení v CSS px okna. */
export function cssSettings(layout: SettingsLayout, placement: Placement): object {
  const { confirm } = layout;
  return {
    rows: layout.rows.map((row) => cssRow(row, placement)),
    confirm: cssBoxOf({ ...confirm, width: confirm.size, height: confirm.size }, placement),
  };
}

/** Dnešní umístění panelu v okně: plocha 1024 × 768 zmenšená na herní plochu (`panelFit`). */
export function todayPanelCssPlacement(window: TestWindow | undefined): Placement {
  const area = gameAreaFor(window ? viewportOf(window) : undefined);
  return panelCssPlacement(area, panelPlacement(area));
}

/** Nastavení otevřené kolečkem, jak ho dnes kreslí scéna, v CSS px okna. */
export function todaySettingsCss(window: TestWindow | undefined): object {
  const placement = todayPanelCssPlacement(window);
  return cssSettings(layoutSettingsPanel(TABLET_GAME_WIDTH, TABLET_GAME_HEIGHT), placement);
}

/** Všechny čtyři kroky průvodce, jak je dnes kreslí scéna, v CSS px okna. */
export function todayGuideCss(window: TestWindow): Record<string, object> {
  const placement = todayPanelCssPlacement(window);
  const settings = layoutSettingsPanel(TABLET_GAME_WIDTH, TABLET_GAME_HEIGHT);
  const steps: Record<string, object> = {};
  for (const step of GUIDE_STEPS) {
    const layout = layoutGuideStep(step, TABLET_GAME_WIDTH, TABLET_GAME_HEIGHT);
    const { message, frame } = layout;
    steps[`krok ${step}`] = {
      rows: settings.rows.map((row) => cssRow(row, placement)),
      message: {
        ...cssBoxOf(message, placement),
        fontSize: cssSize(message.fontSize, placement),
        lineHeight: cssSize(message.lineHeight, placement),
        lineCount: message.lineCount,
        align: message.align,
      },
      back: layout.back
        ? {
            ...cssBoxOf(layout.back, placement),
            fontSize: cssSize(layout.back.fontSize, placement),
          }
        : null,
      indicator: {
        ...cssBoxOf(layout.indicator, placement),
        fontSize: cssSize(layout.indicator.fontSize, placement),
      },
      right: {
        ...cssBoxOf(layout.right, placement),
        fontSize: cssSize(layout.right.fontSize, placement),
      },
      speaker: cssBoxOf(layout.speaker, placement),
      frame: frame
        ? { ...cssBoxOf(frame, placement), lineWidth: cssSize(frame.lineWidth, placement) }
        : null,
    };
  }
  return steps;
}
