import type Phaser from 'phaser';

import { TABLET_GAME_HEIGHT, TABLET_GAME_WIDTH, panelPlacement } from '../logic/deviceLayout';
import type { GameSize } from '../logic/deviceLayout';

/** Nastavení a průvodce jsou navržené na plochu 1024 × 768 (jako na iPadu). */
export const PANEL_WIDTH = TABLET_GAME_WIDTH;
export const PANEL_HEIGHT = TABLET_GAME_HEIGHT;

/**
 * Zmenší panel tak, aby se celý vešel na herní plochu `area`, a pozadí
 * roztáhne přes celou plochu, aby ťuknutí nepropadla do hry (#54).
 * Na iPadu je měřítko 1 a nic se nemění.
 *
 * @param backdrop Pozadí panelu velké PANEL_WIDTH × PANEL_HEIGHT se středem uprostřed panelu.
 */
export function fitPanel(
  container: Phaser.GameObjects.Container,
  backdrop: Phaser.GameObjects.Rectangle,
  area: GameSize,
): void {
  const placement = panelPlacement(area);
  if (!Number.isFinite(placement.scale) || placement.scale <= 0) {
    return;
  }
  container.setPosition(placement.x, placement.y).setScale(placement.scale);
  backdrop.setScale(
    area.width / placement.scale / PANEL_WIDTH,
    area.height / placement.scale / PANEL_HEIGHT,
  );
}
