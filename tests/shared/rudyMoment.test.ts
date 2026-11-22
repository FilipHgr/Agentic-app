import { describe, expect, it } from 'vitest';

import { RUDY_CELEBRATION_WAIT_MS, createRudyMomentGate } from '../../src/shared/logic/rudyMoment';
import type { RudyMomentStep } from '../../src/shared/logic/rudyMoment';

/**
 * Testy k #170 AC3 a #186 AC4: oslava s Rudym po 10. hvězdičce se ukáže,
 * až je Rudy připravený. Hra chvíli počká, než se stáhne klid a oslava;
 * když se do `RUDY_CELEBRATION_WAIT_MS` stáhne aspoň klid, Rudy se ukáže
 * (nestaženou oslavu nahradí klid), jinak se chvíle vynechá a oslava jde
 * dál bez něj. Odchod stránky na pozadí čekání zruší. Čas (ms) dává test.
 */

const NOTHING = { idle: false, move: false } as const;
const IDLE_ONLY = { idle: true, move: false } as const;
const BOTH = { idle: true, move: true } as const;

describe('#170, #186: Rudy počká na stažení, ale dítě po 10. hvězdičce nečeká', () => {
  it('bez požadavku se nic neukáže', () => {
    const gate = createRudyMomentGate();
    expect(gate.step(0, BOTH)).toEqual<RudyMomentStep>({ kind: 'none' });
    expect(gate.pending()).toBe(false);
  });

  it('stažený klid i oslava: Rudy se ukáže hned a jen jednou', () => {
    const gate = createRudyMomentGate();
    gate.request(100);
    expect(gate.pending()).toBe(true);
    expect(gate.step(100, BOTH)).toEqual<RudyMomentStep>({ kind: 'open' });
    expect(gate.step(101, BOTH)).toEqual<RudyMomentStep>({ kind: 'none' });
    expect(gate.pending()).toBe(false);
  });

  it('oslava čeká na stažení nejvýš 1,5 s, pak se Rudy vynechá', () => {
    expect(RUDY_CELEBRATION_WAIT_MS).toBe(1500);
    const gate = createRudyMomentGate();
    gate.request(0);
    expect(gate.step(RUDY_CELEBRATION_WAIT_MS - 1, NOTHING)).toEqual<RudyMomentStep>({
      kind: 'wait',
    });
    expect(gate.step(RUDY_CELEBRATION_WAIT_MS, NOTHING)).toEqual<RudyMomentStep>({
      kind: 'giveUp',
    });
    expect(gate.step(RUDY_CELEBRATION_WAIT_MS + 1, BOTH)).toEqual<RudyMomentStep>({
      kind: 'none',
    });
  });

  it('stažený jen klid: čeká se na oslavu, po 1,5 s se Rudy ukáže s klidem', () => {
    const gate = createRudyMomentGate();
    gate.request(0);
    expect(gate.step(10, IDLE_ONLY)).toEqual<RudyMomentStep>({ kind: 'wait' });
    expect(gate.step(RUDY_CELEBRATION_WAIT_MS, IDLE_ONLY)).toEqual<RudyMomentStep>({
      kind: 'open',
    });
  });

  it('zrušená chvíle se už neukáže', () => {
    const gate = createRudyMomentGate();
    gate.request(0);
    gate.cancel();
    expect(gate.pending()).toBe(false);
    expect(gate.step(1, BOTH)).toEqual<RudyMomentStep>({ kind: 'none' });
  });

  it('nový požadavek nahradí čekající a čeká se znovu od začátku', () => {
    const gate = createRudyMomentGate();
    gate.request(0);
    gate.request(1000);
    expect(gate.step(RUDY_CELEBRATION_WAIT_MS + 1, NOTHING)).toEqual<RudyMomentStep>({
      kind: 'wait',
    });
    expect(gate.step(1000 + RUDY_CELEBRATION_WAIT_MS, NOTHING)).toEqual<RudyMomentStep>({
      kind: 'giveUp',
    });
  });

  it('nesmyslný čas se nebere jako uplynulý limit', () => {
    const gate = createRudyMomentGate();
    gate.request(0);
    expect(gate.step(Number.NaN, NOTHING)).toEqual<RudyMomentStep>({ kind: 'wait' });
  });

  it('stránka odešla na pozadí dřív, než se Rudy ukázal: čekání se zruší', () => {
    const gate = createRudyMomentGate();
    gate.request(0);
    expect(gate.pageHidden()).toBe(true);
    expect(gate.pending()).toBe(false);
    expect(gate.step(1, BOTH)).toEqual<RudyMomentStep>({ kind: 'none' });
  });

  it('pozadí bez čekající chvíle nic neruší', () => {
    const gate = createRudyMomentGate();
    expect(gate.pageHidden()).toBe(false);
  });
});
