/**
 * Logika podržení tlačítka bez DOM (#68): domeček odejde do menu až po
 * podržení `holdMs`. Ťuknutí nebo kratší podržení jen zhoupne, sjetí prstu
 * z tlačítka podržení zruší a druhý prst ho nepřeruší ani neprodlouží.
 * Čas běží přes `setTimeout`. Když je stránka vytížená a časovač se
 * zpozdí, prst zvednutý až po celé době podržení se počítá jako podržení,
 * ne jako ťuknutí (#129). Čistý TypeScript bez Phaseru.
 */

export interface HoldButtonOptions {
  /** Jak dlouho se tlačítko drží. */
  readonly holdMs: number;
  /** Jde tlačítko teď použít? Ptá se při stisku i při dokončení držení. */
  readonly isEnabled?: () => boolean;
  /** Tlačítko se drželo dost dlouho. */
  readonly onHoldComplete: () => void;
  /** Ťuknutí nebo kratší podržení: tlačítko se jen zhoupne. */
  readonly onTap: () => void;
  /** Kroužek kolem tlačítka se začal plnit (`true`) nebo zmizel (`false`). */
  readonly onHoldingChange?: (holding: boolean) => void;
}

export interface HoldButton {
  /** Prst `pointerId` se dotkl tlačítka. */
  press(pointerId: number): void;
  /** Prst `pointerId` se zvedl. */
  release(pointerId: number): void;
  /** Prohlížeč dotyk přerušil (pointercancel), počítá se jako puštění bez zhoupnutí. */
  cancel(pointerId: number): void;
  /** Prst `pointerId` sjel z tlačítka. */
  leave(pointerId: number): void;
  /** Plní se teď kroužek? */
  isHolding(): boolean;
  /** Odpojí tlačítko: rozběhnuté držení nedoběhne a nové nezačne. */
  dispose(): void;
}

export function createHoldButton(options: HoldButtonOptions): HoldButton {
  const isEnabled = options.isEnabled ?? (() => true);
  /** Prst, který tlačítko drží (i po dokončení držení, dokud se nezvedne). */
  let activePointer: number | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  /** Kdy začalo rozběhnuté držení (ms podle `Date.now`). */
  let pressedAt = 0;
  let disposed = false;

  function setHolding(holding: boolean): void {
    options.onHoldingChange?.(holding);
  }

  function stopTimer(): boolean {
    if (timer === undefined) {
      return false;
    }
    clearTimeout(timer);
    timer = undefined;
    setHolding(false);
    return true;
  }

  function complete(): void {
    timer = undefined;
    setHolding(false);
    if (!disposed && isEnabled()) {
      options.onHoldComplete();
    }
  }

  /** Konec držení prstem `pointerId`; vrátí, jestli se tlačítko ještě drželo. */
  function end(pointerId: number): boolean {
    if (pointerId !== activePointer) {
      return false;
    }
    activePointer = null;
    return stopTimer();
  }

  return {
    press(pointerId: number): void {
      if (disposed || activePointer !== null || !isEnabled()) {
        return;
      }
      activePointer = pointerId;
      pressedAt = Date.now();
      setHolding(true);
      timer = setTimeout(complete, options.holdMs);
    },

    release(pointerId: number): void {
      const heldLongEnough = timer !== undefined && Date.now() - pressedAt >= options.holdMs;
      if (!end(pointerId)) {
        return;
      }
      if (heldLongEnough) {
        // Časovač se zpozdil (vytížená stránka), prst se ale držel celou dobu.
        if (!disposed && isEnabled()) {
          options.onHoldComplete();
        }
        return;
      }
      if (isEnabled()) {
        options.onTap();
      }
    },

    cancel(pointerId: number): void {
      end(pointerId);
    },

    leave(pointerId: number): void {
      end(pointerId);
    },

    isHolding(): boolean {
      return timer !== undefined;
    },

    dispose(): void {
      disposed = true;
      activePointer = null;
      stopTimer();
    },
  };
}
