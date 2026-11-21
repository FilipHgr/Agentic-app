import { describe, expect, it } from 'vitest';

import { createMascotModel } from '../../src/shared/logic/mascot';
import type { MascotCommand, MascotModel, MascotMove } from '../../src/shared/logic/mascot';

/**
 * Testy k #167: pohyb, který už nebude potřeba (třeba vynechaný pozdrav),
 * se z paměti uvolní, i když se stáhl pozdě. Klid a právě hraný pohyb
 * zůstanou.
 */

/** Pohled pandy, který stažení vyřídí hned a drží, které textury jsou v paměti. */
function pandaView(textures: Set<string>): {
  panda: MascotModel;
  run: (commands: readonly MascotCommand[]) => void;
} {
  const panda = createMascotModel();
  const run = (commands: readonly MascotCommand[]): void => {
    for (const command of commands) {
      const key = `mascot:${command.move}`;
      if (command.type === 'download') {
        textures.add(key);
        run(panda.loaded(command.move));
      } else {
        textures.delete(key);
      }
    }
  };
  run(panda.use());
  return { panda, run };
}

function decoded(textures: Set<string>): MascotMove[] {
  return [...textures].map((key) => key.replace('mascot:', '') as MascotMove).sort();
}

describe('#167: nepotřebný pohyb se uvolní', () => {
  it('stažený pohyb, který už nebude potřeba, se uvolní hned', () => {
    const textures = new Set<string>();
    const view = pandaView(textures);
    view.run(view.panda.prepare('wave'));
    view.run(view.panda.discard('wave'));
    expect(decoded(textures)).toEqual(['idle']);
    expect(view.panda.isLoaded('wave')).toBe(false);
  });

  it('vynechaný pozdrav, který se stáhne pozdě, se po dočtení hned uvolní', () => {
    const panda = createMascotModel();
    panda.use();
    panda.loaded('idle');
    panda.prepare('wave');
    expect(panda.discard('wave')).toEqual([]);
    expect(panda.loaded('wave')).toEqual([{ type: 'release', move: 'wave' }]);
    expect(panda.isLoaded('wave')).toBe(false);
  });

  it('znovu vyžádaný pohyb se po dočtení neuvolní', () => {
    const panda = createMascotModel();
    panda.use();
    panda.loaded('idle');
    panda.prepare('think');
    panda.discard('think');
    panda.prepare('think');
    expect(panda.loaded('think')).toEqual([]);
    expect(panda.isLoaded('think')).toBe(true);
  });

  it('klid a právě hraný pohyb se neuvolní', () => {
    const panda = createMascotModel();
    panda.use();
    panda.loaded('idle');
    panda.prepare('joy');
    panda.loaded('joy');
    panda.play('joy', 0);
    expect(panda.discard('joy')).toEqual([]);
    expect(panda.discard('idle')).toEqual([]);
    expect(panda.currentMove(10)).toBe('joy');
  });
});
