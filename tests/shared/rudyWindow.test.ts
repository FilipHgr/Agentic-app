import { describe, expect, it } from 'vitest';

import { RUDY_MOVES, rudyMoveDurationMs } from '../../src/shared/logic/rudy';
import type { RudyMove } from '../../src/shared/logic/rudy';
import { createRudyWindowModel } from '../../src/shared/logic/rudyWindow';
import type { RudyCommand, RudyWindowModel } from '../../src/shared/logic/rudyWindow';

/**
 * Testy k #169 AC3–AC5 a #186 (Rudy jen po 10 hvězdičkách, přímo na
 * obrazovce bez okna): Rudy přehraje oslavu, pak mluví, dokud nedohraje
 * replika, a sám odskočí (nejvýš 0,3 s po konci repliky, nejpozději 6 s
 * od ukázání, bez délky repliky po 3,5 s). Ťuknutí v první 1 s ho nepošle
 * pryč, později ano. V paměti je najednou nejvýš klid a jeden další pohyb;
 * bez staženého klidu se Rudy neukáže.
 *
 * Model nečte čas ani nic nestahuje: čas (ms) mu dává test, příkazy ke
 * stažení a uvolnění vykoná zkušební pohled (`FakeView`) a dočtení ohlásí
 * zpátky, jako to dělá Phaser pohled.
 */

/** Zkušební pohled: drží, co je stažené a co se stahuje, a hlídá paměť. */
class FakeView {
  readonly inMemory = new Set<RudyMove>();
  readonly downloading = new Set<RudyMove>();
  readonly downloads: RudyMove[] = [];
  /** Nejvíc pohybů najednou v paměti kromě klidu za celý test. */
  mostOthersInMemory = 0;

  constructor(readonly model: RudyWindowModel) {}

  run(commands: readonly RudyCommand[]): void {
    for (const command of commands) {
      if (command.type === 'download') {
        this.downloading.add(command.move);
        this.downloads.push(command.move);
      } else {
        this.inMemory.delete(command.move);
      }
    }
  }

  /** Stažení pohybu doběhlo: pohled ho dekóduje a ohlásí modelu. */
  finish(move: RudyMove): void {
    expect(this.downloading.has(move), `${move} se nestahuje`).toBe(true);
    this.downloading.delete(move);
    this.inMemory.add(move);
    this.run(this.model.loaded(move));
    const others = [...this.inMemory].filter((each) => each !== 'idle').length;
    this.mostOthersInMemory = Math.max(this.mostOthersInMemory, others);
  }

  fail(move: RudyMove): void {
    this.downloading.delete(move);
    this.model.failed(move);
  }
}

/** Model s pohledem, ve kterém je stažený klid a pohyby `moves`. */
function readyWindow(moves: readonly RudyMove[] = []): FakeView {
  const view = new FakeView(createRudyWindowModel());
  view.run(view.model.use());
  view.finish('idle');
  for (const move of moves) {
    view.run(view.model.prepare(move));
    view.finish(move);
  }
  return view;
}

function open(view: FakeView, now: number, lineMs?: number) {
  const result = view.model.open(lineMs === undefined ? {} : { lineMs }, now);
  view.run(result.commands);
  return result.shown;
}

/** Posune čas po 1/60 s až do `until` a vrátí čas, kdy Rudy odešel (nebo `null`). */
function runUntil(view: FakeView, from: number, until: number): number | null {
  for (let now = from; now <= until; now += 1000 / 60) {
    const result = view.model.update(now);
    view.run(result.commands);
    if (result.closed) {
      return now;
    }
  }
  return null;
}

const OPENED_AT = 10_000;
const MOVE_MS = rudyMoveDurationMs();

describe('#169 AC3, #186: oslava, mluvení a jak dlouho je Rudy vidět', () => {
  it('pohyb trvá asi 3,1 s (37 snímků po 12 snímcích/s)', () => {
    expect(MOVE_MS).toBeCloseTo(3083.3, 0);
  });

  it('po 10. hvězdičce Rudy přehraje oslavu od 1. snímku', () => {
    const view = readyWindow(['celebrate']);
    expect(open(view, OPENED_AT, 5000)).toBe(true);
    expect(view.model.frame(OPENED_AT)).toEqual({ move: 'celebrate', frame: 0 });
    expect(view.model.frame(OPENED_AT + 1500)).toEqual({ move: 'celebrate', frame: 18 });
  });

  it('po pohybu repliky panda mluví dokola, dokud nevyprší délka repliky', () => {
    const view = readyWindow(['celebrate']);
    open(view, OPENED_AT, 5900);
    runUntil(view, OPENED_AT, OPENED_AT + MOVE_MS + 20);
    expect(view.downloads).toContain('talk');
    view.finish('talk');
    const talking = [MOVE_MS + 100, MOVE_MS + 1500, 5800].map(
      (elapsed) => view.model.frame(OPENED_AT + elapsed)?.move,
    );
    expect(talking).toEqual(['talk', 'talk', 'talk']);
    const loop = [MOVE_MS + 100, MOVE_MS + 100 + MOVE_MS / 2].map(
      (elapsed) => view.model.frame(OPENED_AT + elapsed)?.frame ?? -1,
    );
    expect(new Set(loop).size, 'mluvení se hýbe').toBe(2);
  });

  it('Rudy odskočí nejvýš 0,3 s po konci repliky', () => {
    for (const lineMs of [2000, 3500, 4200, 5000, 5700]) {
      const view = readyWindow(['celebrate']);
      open(view, OPENED_AT, lineMs);
      const closedAt = runUntil(view, OPENED_AT, OPENED_AT + 7000);
      expect(closedAt, `replika ${lineMs} ms`).not.toBeNull();
      const elapsed = (closedAt ?? 0) - OPENED_AT;
      expect(elapsed, `replika ${lineMs} ms: zavřeno po ${elapsed} ms`).toBeGreaterThanOrEqual(
        lineMs,
      );
      expect(elapsed, `replika ${lineMs} ms: zavřeno po ${elapsed} ms`).toBeLessThanOrEqual(
        lineMs + 300,
      );
    }
  });

  it('Rudy odskočí nejpozději 6 s od ukázání, i když je replika delší', () => {
    for (const lineMs of [5900, 6000, 8000, 60_000, Number.POSITIVE_INFINITY]) {
      const view = readyWindow(['celebrate']);
      open(view, OPENED_AT, lineMs);
      runUntil(view, OPENED_AT, OPENED_AT + 5990);
      expect(view.model.isOpen(), `replika ${lineMs} ms: po 5,99 s`).toBe(true);
      expect(view.model.update(OPENED_AT + 6000).closed, `replika ${lineMs} ms: po 6 s`).toBe(true);
    }
  });

  it('bez délky repliky (bez hlasu) je Rudy vidět 3,5 s a nemluví', () => {
    const view = readyWindow(['celebrate']);
    open(view, OPENED_AT);
    view.run(view.model.update(OPENED_AT + 3499).commands);
    expect(view.model.isOpen()).toBe(true);
    expect(view.model.frame(OPENED_AT + 3400)?.move).toBe('idle');
    expect(view.model.update(OPENED_AT + 3500).closed).toBe(true);
    expect(view.downloads).not.toContain('talk');
  });

  it('nesmyslná délka repliky se bere jako replika bez hlasu (3,5 s)', () => {
    for (const lineMs of [Number.NaN, -1, 0]) {
      const view = readyWindow(['celebrate']);
      open(view, OPENED_AT, lineMs);
      const closedAt = runUntil(view, OPENED_AT, OPENED_AT + 7000);
      expect(Math.round((closedAt ?? 0) - OPENED_AT), `replika ${lineMs}`).toBeGreaterThanOrEqual(
        3500,
      );
      expect((closedAt ?? 0) - OPENED_AT, `replika ${lineMs}`).toBeLessThan(3500 + 20);
    }
  });

  it('když Rudy odejde, panda už není vidět', () => {
    const view = readyWindow(['celebrate']);
    open(view, OPENED_AT);
    runUntil(view, OPENED_AT, OPENED_AT + 4000);
    expect(view.model.isOpen()).toBe(false);
    expect(view.model.frame(OPENED_AT + 4000)).toBeNull();
  });
});

describe('#169 AC4, #186 AC3: ťuknutí během Rudyho', () => {
  it('ťuknutí v první 1 s Rudyho nepošle pryč, Rudy se jen zhoupne', () => {
    const view = readyWindow(['celebrate']);
    open(view, OPENED_AT, 5000);
    for (const elapsed of [0, 300, 999]) {
      expect(view.model.tap(OPENED_AT + elapsed), `po ${elapsed} ms`).toBe('tooEarly');
      expect(view.model.isOpen(), `po ${elapsed} ms`).toBe(true);
    }
  });

  it('pozdější ťuknutí kamkoli pošle Rudyho hned pryč', () => {
    for (const elapsed of [1000, 2500, 5000]) {
      const view = readyWindow(['celebrate']);
      open(view, OPENED_AT, 5500);
      expect(view.model.tap(OPENED_AT + elapsed), `po ${elapsed} ms`).toBe('closed');
      expect(view.model.isOpen(), `po ${elapsed} ms`).toBe(false);
      expect(view.model.frame(OPENED_AT + elapsed)).toBeNull();
    }
  });

  it('ťuknutí, když Rudy není vidět, nic neudělá', () => {
    const view = readyWindow(['celebrate']);
    expect(view.model.tap(OPENED_AT)).toBe('none');
  });
});

describe('#169 AC5: paměť, nestažené pohyby a zavření zvenku', () => {
  it('v paměti je najednou nejvýš klid a jeden další pohyb', () => {
    const view = readyWindow();
    let now = OPENED_AT;
    for (const move of ['celebrate', 'talk', 'celebrate', 'talk'] as const) {
      view.run(view.model.prepare(move));
      view.finish(move);
    }
    for (let row = 0; row < 2; row += 1) {
      view.run(view.model.prepare('celebrate'));
      if (view.downloading.has('celebrate')) {
        view.finish('celebrate');
      }
      open(view, now, 5500);
      runUntil(view, now, now + MOVE_MS + 20);
      view.finish('talk');
      runUntil(view, now + MOVE_MS + 20, now + 7000);
      now += 10_000;
    }
    expect(view.mostOthersInMemory).toBe(1);
    expect([...view.inMemory].filter((move) => move !== 'idle').length).toBeLessThanOrEqual(1);
  });

  it('pohyb, který se ještě stahoval a byl vystřídán jiným, se po dočtení hned uvolní', () => {
    const view = readyWindow();
    view.run(view.model.prepare('talk'));
    view.run(view.model.prepare('celebrate'));
    view.finish('talk');
    view.finish('celebrate');
    expect([...view.inMemory].sort()).toEqual(['celebrate', 'idle']);
  });

  it('když oslava ještě není stažená, Rudy ukáže klid a nečeká', () => {
    const view = readyWindow();
    expect(open(view, OPENED_AT, 5000)).toBe(true);
    expect(view.model.frame(OPENED_AT)).toEqual({ move: 'idle', frame: 0 });
    expect(view.model.frame(OPENED_AT + 1000)?.move).toBe('idle');
    expect(view.downloads).toContain('celebrate');
  });

  it('když se nestáhne ani klid, Rudy se neukáže a nic nehlásí', () => {
    const view = new FakeView(createRudyWindowModel());
    view.run(view.model.use());
    view.fail('idle');
    expect(open(view, OPENED_AT, 5000)).toBe(false);
    expect(view.model.isOpen()).toBe(false);
    expect(view.model.frame(OPENED_AT)).toBeNull();
    expect(view.model.tap(OPENED_AT + 2000)).toBe('none');
  });

  it('dokud klid není stažený, Rudy se neukáže a klid se zkusí stáhnout znovu', () => {
    const view = new FakeView(createRudyWindowModel());
    view.run(view.model.use());
    view.fail('idle');
    open(view, OPENED_AT);
    expect(view.downloads.filter((move) => move === 'idle')).toHaveLength(2);
    view.finish('idle');
    expect(open(view, OPENED_AT + 100)).toBe(true);
  });

  it('odchod stránky na pozadí pošle Rudyho pryč hned, i v první 1 s', () => {
    const view = readyWindow(['celebrate']);
    open(view, OPENED_AT, 5000);
    expect(view.model.close()).toBe(true);
    expect(view.model.isOpen()).toBe(false);
    expect(view.model.close()).toBe(false);
  });

  it('druhý Rudy se během prvního neukáže', () => {
    const view = readyWindow(['celebrate']);
    open(view, OPENED_AT, 5000);
    expect(open(view, OPENED_AT + 100, 5000)).toBe(false);
    expect(view.model.frame(OPENED_AT + 200)).toEqual({ move: 'celebrate', frame: 2 });
  });

  it('konec scény uvolní z paměti všechno', () => {
    const view = readyWindow(['celebrate']);
    view.run(view.model.dispose());
    expect(view.inMemory.size).toBe(0);
    expect(RUDY_MOVES).toContain('idle');
  });
});
