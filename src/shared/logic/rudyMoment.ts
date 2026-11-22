/**
 * Kdy se Rudy s oslavou po 10. hvězdičce (#170 AC3, od #186 jediná chvíle
 * s Rudym) opravdu ukáže, bez Phaseru. Rudy potřebuje stažený klid (#169
 * AC5), oslavu je lepší mít taky. Hra o chvíli požádá a Rudy se ukáže, až
 * je stažený klid i oslava. Když se do `RUDY_CELEBRATION_WAIT_MS` stáhne
 * aspoň klid, Rudy se ukáže s klidem místo oslavy; bez klidu se chvíle
 * vynechá a oslava jde dál bez něj, dítě nic nečeká (#186 AC4). Oslava se
 * stahuje dopředu, a tak se čeká jen krátce. Odchod stránky na pozadí
 * čekání zruší. Čas (ms) dává volající.
 */

/** Oslava (stažená dopředu) čeká nejvýš tak dlouho, aby dítě po 10. hvězdičce nečekalo. */
export const RUDY_CELEBRATION_WAIT_MS = 1500;

/** Co má volající teď udělat: nic, čekat, ukázat Rudyho, nebo chvíli vynechat. */
export type RudyMomentStep =
  | { readonly kind: 'none' }
  | { readonly kind: 'wait' }
  | { readonly kind: 'open' }
  | { readonly kind: 'giveUp' };

/** Co je stažené: klid a oslava. */
export interface RudyLoaded {
  readonly idle: boolean;
  readonly move: boolean;
}

export interface RudyMomentGate {
  /** Požádá o Rudyho s oslavou v čase `now`; nahradí čekající. */
  request(now: number): void;
  /** Čekající chvíle se neukáže. */
  cancel(): void;
  /**
   * Stránka odešla na pozadí: čekající chvíle se zruší. Vrátí `true`,
   * když nějaká čekala (volající ohlásí, že skončila bez Rudyho).
   */
  pageHidden(): boolean;
  /** Čeká nějaká chvíle? */
  pending(): boolean;
  /** Posun času: rozhodne, jestli Rudyho ukázat, čekat dál, nebo chvíli vynechat. */
  step(now: number, loaded: RudyLoaded): RudyMomentStep;
}

/** Ms od požádání; nesmyslný čas je 0 (limit neuplynul). */
function elapsedSince(requestedAt: number, now: number): number {
  const elapsed = now - requestedAt;
  return Number.isFinite(elapsed) && elapsed > 0 ? elapsed : 0;
}

export function createRudyMomentGate(): RudyMomentGate {
  /** Kdy hra o čekající chvíli požádala; `null` bez ní. */
  let requestedAt: number | null = null;

  return {
    request(now: number): void {
      requestedAt = now;
    },

    cancel(): void {
      requestedAt = null;
    },

    pageHidden(): boolean {
      const wasWaiting = requestedAt !== null;
      requestedAt = null;
      return wasWaiting;
    },

    pending: () => requestedAt !== null,

    step(now: number, loaded: RudyLoaded): RudyMomentStep {
      if (requestedAt === null) {
        return { kind: 'none' };
      }
      const timedOut = elapsedSince(requestedAt, now) >= RUDY_CELEBRATION_WAIT_MS;
      if (loaded.idle && (loaded.move || timedOut)) {
        requestedAt = null;
        return { kind: 'open' };
      }
      if (timedOut) {
        requestedAt = null;
        return { kind: 'giveUp' };
      }
      return { kind: 'wait' };
    },
  };
}
