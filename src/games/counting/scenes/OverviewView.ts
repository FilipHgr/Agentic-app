import Phaser from 'phaser';

import { overviewBars, overviewTotalLine } from '../logic/overviewLayout';
import type {
  OverviewButtonSlot,
  OverviewLayout,
  OverviewRect,
  OverviewTextSlot,
} from '../logic/overviewLayout';
import { OVERVIEW_STYLE } from '../logic/theme';
import type { WeekOverview } from '../logic/weekActivity';
import type { OverviewTexts } from '../texts/countingTexts';
import { FONT_FAMILY, colorNumber } from '../../../shared/logic/theme';

/** Jak dlouho se tlačítko po ťuknutí zvětšuje (a stejně dlouho vrací). */
const TAP_ANIMATION_MS = 90;

/**
 * Tlačítko s nápisem ve vzhledu voleb nastavení (světle modré s okrajem,
 * modrý text): Přehled v nastavení a Zpět v přehledu (#183). Ťuknutí ho
 * krátce zvětší a `onTap` zavolá až po doběhnutí zvětšení.
 */
export function addTextButton(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  slot: OverviewButtonSlot,
  label: string,
  borderScale: number,
  onTap: () => void,
): void {
  const borderWidth = OVERVIEW_STYLE.buttonBorderWidth * borderScale;
  const inset = borderWidth / 2;
  const { width, height, cornerRadius } = slot;
  const background = scene.add
    .graphics()
    .fillStyle(colorNumber(OVERVIEW_STYLE.buttonBackground), 1)
    .fillRoundedRect(-width / 2, -height / 2, width, height, cornerRadius)
    .lineStyle(borderWidth, colorNumber(OVERVIEW_STYLE.buttonBorderColor), 1)
    .strokeRoundedRect(
      -width / 2 + inset,
      -height / 2 + inset,
      width - borderWidth,
      height - borderWidth,
      cornerRadius - inset,
    );
  const text = scene.add
    .text(0, 0, label, {
      fontFamily: FONT_FAMILY,
      fontSize: `${slot.fontSize}px`,
      fontStyle: 'bold',
      color: OVERVIEW_STYLE.buttonTextColor,
    })
    .setOrigin(0.5);
  const button = scene.add
    .container(slot.x, slot.y, [background, text])
    .setSize(width, height)
    .setInteractive();
  // Během zhoupnutí se další ťuknutí nepočítá; akce přijde až po něm, aby ho rodič viděl.
  let animating = false;
  button.on('pointerdown', () => {
    if (animating) {
      return;
    }
    animating = true;
    scene.tweens.add({
      targets: button,
      scale: { from: 1, to: 1.06 },
      duration: TAP_ANIMATION_MS,
      yoyo: true,
      onComplete: () => {
        animating = false;
        onTap();
      },
    });
  });
  container.add(button);
}

/**
 * Přehled pro rodiče (#183): kolik dítě vyřešilo za posledních 7 dní.
 * Sloupečky jsou tvary Phaseru: světlejší vyřešené, uvnitř tmavší
 * napoprvé, nad nimi počet a pod nimi zkratka dne (dnešek tmavší).
 * Bez dat je místo sloupečků nápis. Vedle Zpět je tlačítko Chyby (#184).
 * Rozměry jsou v `overviewLayout.ts`.
 */
export class OverviewView {
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly container: Phaser.GameObjects.Container,
    layout: OverviewLayout,
    overview: WeekOverview,
    texts: OverviewTexts,
    mistakesButton: string,
    onBack: () => void,
    onMistakes: () => void,
  ) {
    this.addText(layout.title, texts.title, OVERVIEW_STYLE.titleColor, true);
    layout.days.forEach((slot, index) => {
      const day = overview.days[index];
      if (day === undefined) {
        return;
      }
      const color = day.isToday ? OVERVIEW_STYLE.todayColor : OVERVIEW_STYLE.dayColor;
      this.addText(slot, texts.dayNames[day.weekday], color, day.isToday);
    });
    if (overview.isEmpty) {
      this.addText(layout.empty, texts.empty, OVERVIEW_STYLE.emptyColor, false);
    } else {
      this.addBars(layout, overview);
    }
    const [solvedLegend, firstTryLegend] = layout.legend;
    this.addRect(solvedLegend.swatch, OVERVIEW_STYLE.solvedColor);
    this.addText(solvedLegend.label, texts.legendNotFirstTry, OVERVIEW_STYLE.textColor, false);
    this.addRect(firstTryLegend.swatch, OVERVIEW_STYLE.firstTryColor);
    this.addText(firstTryLegend.label, texts.legendFirstTry, OVERVIEW_STYLE.textColor, false);
    const [solvedTotal, firstTryTotal] = layout.totals;
    this.addText(
      solvedTotal,
      overviewTotalLine(texts.totalSolved, overview.totalSolved),
      OVERVIEW_STYLE.textColor,
      true,
    );
    this.addText(
      firstTryTotal,
      overviewTotalLine(texts.totalFirstTry, overview.totalFirstTry),
      OVERVIEW_STYLE.textColor,
      false,
    );
    addTextButton(scene, container, layout.back, texts.back, layout.borderScale, onBack);
    addTextButton(
      scene,
      container,
      layout.mistakesButton,
      mistakesButton,
      layout.borderScale,
      onMistakes,
    );
  }

  private addBars(layout: OverviewLayout, overview: WeekOverview): void {
    overviewBars(layout, overview).forEach((bar, index) => {
      this.addRect(bar.solved, OVERVIEW_STYLE.solvedColor);
      this.addRect(bar.firstTry, OVERVIEW_STYLE.firstTryColor);
      const solved = overview.days[index]?.solved ?? 0;
      this.addText(bar.value, String(solved), OVERVIEW_STYLE.valueColor, false);
    });
  }

  /** Obdélník se středem `rect`; nulová výška se nekreslí. */
  private addRect(rect: OverviewRect, colorHex: string): void {
    if (rect.height <= 0 || rect.width <= 0) {
      return;
    }
    const shape = this.scene.add.rectangle(
      rect.x,
      rect.y,
      rect.width,
      rect.height,
      colorNumber(colorHex),
    );
    this.container.add(shape);
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
