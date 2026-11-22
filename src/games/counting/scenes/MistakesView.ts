import type Phaser from 'phaser';

import type { MistakeLines, MistakesLayout } from '../logic/mistakesLayout';
import type { OverviewTextSlot } from '../logic/overviewLayout';
import { OVERVIEW_STYLE } from '../logic/theme';
import { FONT_FAMILY } from '../../../shared/logic/theme';
import { addTextButton } from './OverviewView';

/**
 * Stránka Chyby v přehledu pro rodiče (#184): podíl příkladů napoprvé pro
 * sčítání a odčítání, nejčastější chyby, nápověda za týden a Zpět do
 * přehledu. Texty řádků připraví `mistakeLines`, rozměry jsou
 * v `mistakesLayout.ts`.
 */
export class MistakesView {
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly container: Phaser.GameObjects.Container,
    layout: MistakesLayout,
    lines: MistakeLines,
    onBack: () => void,
  ) {
    this.addText(layout.title, lines.title, OVERVIEW_STYLE.titleColor, true);
    this.addText(layout.firstTryHeading, lines.firstTryHeading, OVERVIEW_STYLE.titleColor, true);
    this.addRows(layout.operations, lines.operations);
    this.addText(layout.frequentHeading, lines.frequentHeading, OVERVIEW_STYLE.titleColor, true);
    this.addRows(layout.frequent, lines.frequent);
    this.addText(layout.hints, lines.hints, OVERVIEW_STYLE.textColor, false);
    addTextButton(scene, container, layout.back, lines.back, layout.borderScale, onBack);
  }

  /** Řádky shora; řádků bez textu se nekreslí. */
  private addRows(slots: readonly OverviewTextSlot[], texts: readonly string[]): void {
    texts.forEach((text, index) => {
      const slot = slots[index];
      if (slot !== undefined) {
        this.addText(slot, text, OVERVIEW_STYLE.textColor, false);
      }
    });
  }

  private addText(slot: OverviewTextSlot, text: string, color: string, bold: boolean): void {
    const left = slot.align === 'left';
    const label = this.scene.add
      .text(left ? slot.x - slot.width / 2 : slot.x, slot.y, text, {
        fontFamily: FONT_FAMILY,
        fontSize: `${slot.fontSize}px`,
        fontStyle: bold ? 'bold' : 'normal',
        color,
      })
      .setOrigin(left ? 0 : 0.5, 0.5);
    this.container.add(label);
  }
}
