import { describe, expect, it } from 'vitest';

import { nextRudyVariant } from '../../src/shared/logic/rudyVariants';
import type { RudyVariantList } from '../../src/shared/logic/rudyVariants';
import { openRudyVariants } from '../../src/shared/storage/rudyVariantsStorage';
import { DeviceStorage, forbiddenStorage } from './profileFixtures';

/**
 * Testy k #176 AC2 (sdílená část): repliky Rudyho jedné chvíle se střídají,
 * stejná nikdy nezazní dvakrát po sobě, první v profilu je ta dnešní
 * a poslední varianta se pamatuje v úložišti profilu.
 */

const TWO: RudyVariantList<string> = ['greeting', 'greetingAgain'];
const THREE: RudyVariantList<string> = ['celebration', 'celebrationStars', 'celebrationStar'];
const KEY = 'rudyLine.greeting';

/** Repliky, které zazní za `count` chvil po sobě (každé okno se ukáže). */
function spokenLines(
  storage: DeviceStorage | undefined,
  variants: RudyVariantList<string>,
  count: number,
): string[] {
  const spoken: string[] = [];
  for (let index = 0; index < count; index += 1) {
    // Každá chvíle čte úložiště znovu, jako po novém otevření hry.
    const rotation = openRudyVariants(storage, KEY, variants);
    const line = rotation.upcoming();
    rotation.said(line);
    spoken.push(line);
  }
  return spoken;
}

describe('#176 AC2: Rudy neřekne stejnou repliku dvakrát po sobě', () => {
  it('první replika v profilu je ta dnešní (první varianta)', () => {
    for (const variants of [TWO, THREE]) {
      expect(nextRudyVariant(variants, null), variants.join()).toBe(variants[0]);
      expect(openRudyVariants(new DeviceStorage(), KEY, variants).upcoming()).toBe(variants[0]);
    }
  });

  it('za sebou jdoucí repliky se nikdy neopakují a vystřídají se všechny varianty', () => {
    for (const variants of [TWO, THREE]) {
      const spoken = spokenLines(new DeviceStorage(), variants, 12);
      for (let index = 1; index < spoken.length; index += 1) {
        expect(spoken[index], `${variants.join()}: chvíle ${index}`).not.toBe(spoken[index - 1]);
      }
      expect(new Set(spoken).size, variants.join()).toBe(variants.length);
    }
  });

  it('poslední varianta se pamatuje v úložišti, takže po novém načtení přijde další', () => {
    const storage = new DeviceStorage();
    spokenLines(storage, THREE, 1);
    expect(storage.getItem(KEY)).toBe('celebration');
    expect(openRudyVariants(storage, KEY, THREE).upcoming()).toBe('celebrationStars');
  });

  it('dokud se okno neukáže, varianta se nemění (stažení dopředu i okno řeknou totéž)', () => {
    const rotation = openRudyVariants(new DeviceStorage(), KEY, THREE);
    expect(rotation.upcoming()).toBe('celebration');
    expect(rotation.upcoming()).toBe('celebration');
  });

  it('poškozený záznam znamená první variantu', () => {
    for (const corrupt of ['', 'nesmysl', '{"line":"greetingAgain"}', 'GREETINGAGAIN', '1']) {
      const storage = new DeviceStorage({ [KEY]: corrupt });
      expect(
        openRudyVariants(storage, KEY, TWO).upcoming(),
        `záznam ${JSON.stringify(corrupt)}`,
      ).toBe('greeting');
    }
  });

  it('zakázané úložiště hru nezastaví: střídá se v paměti a nic nevyhodí', () => {
    const spoken = spokenLines(forbiddenStorage(), TWO, 1);
    expect(spoken).toEqual(['greeting']);
    const rotation = openRudyVariants(forbiddenStorage(), KEY, TWO);
    expect(() => rotation.said(rotation.upcoming())).not.toThrow();
    expect(rotation.upcoming()).toBe('greetingAgain');
  });

  it('plné úložiště: střídání platí v paměti do zavření stránky', () => {
    const storage = new DeviceStorage();
    storage.failWrite = () => true;
    const rotation = openRudyVariants(storage, KEY, TWO);
    rotation.said('greeting');
    expect(rotation.upcoming()).toBe('greetingAgain');
    expect(storage.getItem(KEY)).toBeNull();
  });

  it('bez úložiště (hra bez stránky) se střídá jen v paměti', () => {
    const rotation = openRudyVariants(undefined, KEY, TWO);
    rotation.said(rotation.upcoming());
    expect(rotation.upcoming()).toBe('greetingAgain');
  });
});
