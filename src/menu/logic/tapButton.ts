/**
 * Tlačítko, které reaguje ťuknutím bez podržení (#107, tužka u profilu).
 * Akce proběhne, jen když se prst tlačítka dotkl a na něm se i zvedl.
 * Sjetí prstu z tlačítka nebo přerušený dotyk (pointercancel) ťuknutí
 * zruší, jiný prst ho nedokončí. Čistý TypeScript bez Phaseru.
 */

export interface TapButtonOptions {
  /** Jde tlačítko teď použít? Ptá se při dotyku i při zvednutí prstu. */
  readonly isEnabled?: () => boolean;
  /** Prst se tlačítka dotkl a zvedl se na něm. */
  readonly onTap: () => void;
}

export interface TapButton {
  /** Prst `pointerId` se dotkl tlačítka. */
  press(pointerId: number): void;
  /** Prst `pointerId` se zvedl na tlačítku. */
  release(pointerId: number): void;
  /** Prst `pointerId` sjel z tlačítka: ťuknutí se nepočítá. */
  leave(pointerId: number): void;
  /** Prohlížeč dotyk přerušil (pointercancel): ťuknutí se nepočítá. */
  cancel(pointerId: number): void;
}

export function createTapButton(options: TapButtonOptions): TapButton {
  const isEnabled = options.isEnabled ?? (() => true);
  /** Prst, který se tlačítka dotkl a ještě se nezvedl ani nesjel. */
  let activePointer: number | null = null;

  function forget(pointerId: number): void {
    if (pointerId === activePointer) {
      activePointer = null;
    }
  }

  return {
    press(pointerId: number): void {
      if (activePointer === null && isEnabled()) {
        activePointer = pointerId;
      }
    },

    release(pointerId: number): void {
      if (pointerId !== activePointer) {
        return;
      }
      activePointer = null;
      if (isEnabled()) {
        options.onTap();
      }
    },

    leave: forget,
    cancel: forget,
  };
}
