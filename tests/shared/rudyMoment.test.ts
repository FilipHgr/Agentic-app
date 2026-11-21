import { describe, expect, it } from 'vitest';

import {
  RUDY_CELEBRATION_WAIT_MS,
  RUDY_WAIT_MS,
  createRudyMomentGate,
} from '../../src/shared/logic/rudyMoment';
import type { RudyMomentStep } from '../../src/shared/logic/rudyMoment';

/**
 * Testy k #170 AC2–AC4: chvíle s pandou (pozdrav, oslava) se ukáže, až je
 * okno připravené. Hra nebo menu chvíli počká, než se stáhne klid a pohyb
 * repliky; když se do `RUDY_WAIT_MS` stáhne aspoň klid, okno se ukáže
 * (nestažený pohyb nahradí klid), jinak se chvíle vynechá a hra jde dál.
 * Oslava čeká nejvýš `RUDY_CELEBRATION_WAIT_MS` (stahuje se dopředu).
 * Odchod stránky na pozadí čekání zruší. Čas (ms) dává test.
 */

const NOTHING = { idle: false, move: false } as const;
const IDLE_ONLY = { idle: true, move: false } as const;
const BOTH = { idle: true, move: true } as const;

describe('#170: chvíle s pandou počká na stažení okna', () => {
  it('bez požadavku se nic neukáže', () => {
    const gate = createRudyMomentGate();
    expect(gate.step(0, BOTH)).toEqual<RudyMomentStep>({ kind: 'none' });
    expect(gate.pending()).toBeNull();
  });

  it('stažený klid i pohyb: okno se ukáže hned a jen jednou', () => {
    const gate = createRudyMomentGate();
    gate.request('wave', 100);
    expect(gate.pending()).toBe('wave');
    expect(gate.step(100, BOTH)).toEqual<RudyMomentStep>({ kind: 'open', move: 'wave' });
    expect(gate.step(101, BOTH)).toEqual<RudyMomentStep>({ kind: 'none' });
    expect(gate.pending()).toBeNull();
  });

  it('dokud se nic nestáhlo, čeká se; po limitu bez klidu se chvíle vynechá', () => {
    const gate = createRudyMomentGate();
    gate.request('wave', 0);
    expect(gate.step(RUDY_WAIT_MS - 1, NOTHING)).toEqual<RudyMomentStep>({ kind: 'wait' });
    expect(gate.step(RUDY_WAIT_MS, NOTHING)).toEqual<RudyMomentStep>({ kind: 'giveUp' });
    expect(gate.step(RUDY_WAIT_MS + 1, BOTH)).toEqual<RudyMomentStep>({ kind: 'none' });
  });

  it('stažený jen klid: čeká se na pohyb, po limitu se okno ukáže s klidem', () => {
    const gate = createRudyMomentGate();
    gate.request('wave', 0);
    expect(gate.step(10, IDLE_ONLY)).toEqual<RudyMomentStep>({ kind: 'wait' });
    expect(gate.step(RUDY_WAIT_MS, IDLE_ONLY)).toEqual<RudyMomentStep>({
      kind: 'open',
      move: 'wave',
    });
  });

  it('čekání trvá nejvýš 4 s, aby dítě nečekalo dlouho', () => {
    expect(RUDY_WAIT_MS).toBeLessThanOrEqual(4000);
    expect(RUDY_WAIT_MS).toBeGreaterThan(0);
  });

  it('zrušená chvíle se už neukáže', () => {
    const gate = createRudyMomentGate();
    gate.request('wave', 0);
    gate.cancel();
    expect(gate.pending()).toBeNull();
    expect(gate.step(1, BOTH)).toEqual<RudyMomentStep>({ kind: 'none' });
  });

  it('nový požadavek nahradí čekající a čeká se znovu od začátku', () => {
    const gate = createRudyMomentGate();
    gate.request('celebrate', 0);
    gate.request('wave', 3000);
    expect(gate.pending()).toBe('wave');
    expect(gate.step(RUDY_WAIT_MS + 1, NOTHING)).toEqual<RudyMomentStep>({ kind: 'wait' });
    expect(gate.step(3000 + RUDY_WAIT_MS, NOTHING)).toEqual<RudyMomentStep>({ kind: 'giveUp' });
  });

  it('nesmyslný čas se nebere jako uplynulý limit', () => {
    const gate = createRudyMomentGate();
    gate.request('wave', 0);
    expect(gate.step(Number.NaN, NOTHING)).toEqual<RudyMomentStep>({ kind: 'wait' });
  });
});

describe('#170: oslava nečeká dlouho a pozadí čekání zruší', () => {
  it('oslava čeká na stažení nejvýš 1,5 s, pak se vynechá', () => {
    expect(RUDY_CELEBRATION_WAIT_MS).toBe(1500);
    const gate = createRudyMomentGate();
    gate.request('celebrate', 0);
    expect(gate.step(RUDY_CELEBRATION_WAIT_MS - 1, NOTHING)).toEqual<RudyMomentStep>({
      kind: 'wait',
    });
    expect(gate.step(RUDY_CELEBRATION_WAIT_MS, NOTHING)).toEqual<RudyMomentStep>({
      kind: 'giveUp',
    });
  });

  it('oslava se staženým jen klidem se po 1,5 s ukáže s klidem', () => {
    const gate = createRudyMomentGate();
    gate.request('celebrate', 0);
    expect(gate.step(RUDY_CELEBRATION_WAIT_MS, IDLE_ONLY)).toEqual<RudyMomentStep>({
      kind: 'open',
      move: 'celebrate',
    });
  });

  it('pozdrav čeká déle než oslava', () => {
    const gate = createRudyMomentGate();
    gate.request('wave', 0);
    expect(gate.step(RUDY_CELEBRATION_WAIT_MS, NOTHING)).toEqual<RudyMomentStep>({ kind: 'wait' });
  });

  it('stránka odešla na pozadí dřív, než se chvíle ukázala: čekání se zruší', () => {
    const gate = createRudyMomentGate();
    gate.request('wave', 0);
    expect(gate.pageHidden()).toBe(true);
    expect(gate.pending()).toBeNull();
    expect(gate.step(1, BOTH)).toEqual<RudyMomentStep>({ kind: 'none' });
  });

  it('pozadí bez čekající chvíle nic neruší', () => {
    const gate = createRudyMomentGate();
    expect(gate.pageHidden()).toBe(false);
  });
});

describe('#173: zopakovaný pozdrav čeká na stažení kratší dobu', () => {
  it('s kratším limitem se chvíle bez stažení vynechá po něm', () => {
    const gate = createRudyMomentGate();
    gate.request('wave', 0, 900);
    expect(gate.step(899, IDLE_ONLY)).toEqual<RudyMomentStep>({ kind: 'wait' });
    expect(gate.step(900, NOTHING)).toEqual<RudyMomentStep>({ kind: 'giveUp' });
  });

  it('stažené okno se v kratším limitu ukáže jako obvykle', () => {
    const gate = createRudyMomentGate();
    gate.request('wave', 0, 900);
    expect(gate.step(300, BOTH)).toEqual<RudyMomentStep>({ kind: 'open', move: 'wave' });
  });

  it('delší nebo nesmyslný limit běžné čekání neprodlouží', () => {
    for (const waitMs of [RUDY_WAIT_MS * 2, Number.NaN]) {
      const gate = createRudyMomentGate();
      gate.request('wave', 0, waitMs);
      expect(gate.step(RUDY_WAIT_MS, NOTHING), `limit ${waitMs}`).toEqual<RudyMomentStep>({
        kind: 'giveUp',
      });
    }
  });
});
