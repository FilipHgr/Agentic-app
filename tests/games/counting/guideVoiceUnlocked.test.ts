import { describe, expect, it } from 'vitest';

import { GUIDE_SCRIPT } from '../../../src/games/counting/logic/guideScript';
import type { GuideLineId } from '../../../src/games/counting/logic/guideScript';
import {
  createGuideVoice,
  handleGuideVoice,
  speakerPulses,
} from '../../../src/games/counting/logic/guideVoice';
import type {
  GuideVoiceCommand,
  GuideVoiceEvent,
  GuideVoiceState,
} from '../../../src/games/counting/logic/guideVoice';

/**
 * Testy k #67 AC6: zvuk se odemkne prvním ťuknutím v menu, takže když se
 * Počítání spustí poprvé a otevře se průvodce, věta 1. kroku zazní sama.
 * Menu předá hře, že je zvuk odemčený (`createGuideVoice({ audioUnlocked: true })`).
 * Bez odemčení se průvodce chová jako dnes (#51): mlčí a reproduktor pulzuje.
 */

function lineOfStep(step: number): GuideLineId {
  const line = GUIDE_SCRIPT.find((candidate) => candidate.step === step);
  if (line === undefined) {
    throw new Error(`ve scénáři chybí věta kroku ${step}`);
  }
  return line.id;
}

const STEP_1 = lineOfStep(1);
const STEP_2 = lineOfStep(2);

/** Pošle hlasu události po sobě a vrátí stav a všechny příkazy. */
function run(
  start: GuideVoiceState,
  events: readonly GuideVoiceEvent[],
): { state: GuideVoiceState; commands: GuideVoiceCommand[] } {
  let state = start;
  const commands: GuideVoiceCommand[] = [];
  for (const event of events) {
    const result = handleGuideVoice(state, event);
    state = result.state;
    commands.push(...result.commands);
  }
  return { state, commands };
}

function played(commands: readonly GuideVoiceCommand[]): GuideLineId[] {
  return commands.flatMap((command) => (command.kind === 'play' ? [command.id] : []));
}

describe('#67 AC6: se zvukem odemčeným v menu průvodce promluví sám', () => {
  it('věta 1. kroku se přehraje při otevření kroku, bez dalšího ťuknutí', () => {
    const { commands } = run(createGuideVoice({ audioUnlocked: true }), [
      { kind: 'opened' },
      { kind: 'loaded', id: STEP_1 },
    ]);
    expect(played(commands)).toEqual([STEP_1]);
  });

  it('při otevření se stáhne věta 1. kroku a přednačte věta 2. kroku', () => {
    const { commands } = run(createGuideVoice({ audioUnlocked: true }), [{ kind: 'opened' }]);
    expect(commands).toContainEqual({ kind: 'load', id: STEP_1 });
    expect(commands).toContainEqual({ kind: 'load', id: STEP_2 });
  });

  it('přednačtená věta 2. kroku sama nezazní', () => {
    const { commands } = run(createGuideVoice({ audioUnlocked: true }), [
      { kind: 'opened' },
      { kind: 'loaded', id: STEP_2 },
      { kind: 'loaded', id: STEP_1 },
    ]);
    expect(played(commands)).toEqual([STEP_1]);
  });

  it('věta 1. kroku nezazní, když rodič mezitím přešel na další krok', () => {
    const { commands } = run(createGuideVoice({ audioUnlocked: true }), [
      { kind: 'opened' },
      { kind: 'tapped', target: 'next', step: 2 },
      { kind: 'loaded', id: STEP_1 },
    ]);
    expect(played(commands)).not.toContain(STEP_1);
  });

  it('věta 1. kroku nezazní, když je stránka mezitím na pozadí', () => {
    const { commands } = run(createGuideVoice({ audioUnlocked: true }), [
      { kind: 'opened' },
      { kind: 'hidden' },
      { kind: 'loaded', id: STEP_1 },
    ]);
    expect(played(commands)).toEqual([]);
  });

  it('před otevřením průvodce se nic nestahuje ani nehraje', () => {
    const voice = createGuideVoice({ audioUnlocked: true });
    const { commands } = run(voice, [{ kind: 'loaded', id: STEP_1 }]);
    expect(commands).toEqual([]);
  });
});

describe('#67 AC6: bez odemčení je chování stejné jako dnes', () => {
  it.each([
    ['bez volby', () => createGuideVoice()],
    ['s volbou „zvuk neodemčený“', () => createGuideVoice({ audioUnlocked: false })],
  ])('%s: po otevření nic nezazní, ani když nahrávky dorazí', (_name, create) => {
    const { commands } = run(create(), [
      { kind: 'opened' },
      { kind: 'loaded', id: STEP_1 },
      { kind: 'loaded', id: STEP_2 },
    ]);
    expect(played(commands)).toEqual([]);
  });

  it.each([
    ['bez volby', () => createGuideVoice()],
    ['s volbou „zvuk neodemčený“', () => createGuideVoice({ audioUnlocked: false })],
  ])('%s: reproduktor po otevření pulzuje', (_name, create) => {
    const { state } = run(create(), [{ kind: 'opened' }]);
    expect(speakerPulses(state)).toBe(true);
  });

  it('volba „zvuk neodemčený“ dá úplně stejný hlas jako dnešní výchozí', () => {
    const events: GuideVoiceEvent[] = [
      { kind: 'opened' },
      { kind: 'loaded', id: STEP_1 },
      { kind: 'tapped', target: 'speaker', step: 1 },
    ];
    expect(run(createGuideVoice({ audioUnlocked: false }), events)).toEqual(
      run(createGuideVoice(), events),
    );
  });
});
