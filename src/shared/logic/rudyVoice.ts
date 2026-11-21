/**
 * Hlas pandy Rudyho v okně (#171), bez prohlížeče. Kdy se nahrávka repliky
 * stáhne, kdy na ni okno počká, jak dlouho bude okno otevřené a kdy hlas
 * zazní nebo zmlkne. Stažení a přehrání dělá přehrávač zvenku
 * (`audio/rudyVoicePlayer.ts`), tady se o něm jen rozhoduje.
 *
 * Pravidla:
 * - Nahrávka se stáhne, jen když je zvuk odemčený (Safari pustí zvuk až po
 *   dotyku). Bez odemčeného zvuku je okno bez hlasu (3,5 s z #169).
 * - Okno počká na stažení nahrávky stejně jako na obrázky pandy (limit
 *   čekání hlídá `rudyMoment.ts`); nepovedené stažení okno nezdrží.
 * - S nahrávkou dostane okno délku nahrávky (`lineMs`) a hlas začne
 *   s otevřením okna. Zavření okna (i ťuknutím) hlas zastaví.
 * - Nepovedená nahrávka se zkusí stáhnout znovu při další chvíli.
 * - Adresa nahrávky obsahuje jazyk; po změně jazyka v menu má další okno
 *   jinou adresu, a tedy nový jazyk.
 */

/** Přehrávač nahrávek: stáhne a připraví, pustí a zastaví. Nesmí vyhodit výjimku. */
export interface RudyVoicePlayer {
  /** Stáhne a dekóduje nahrávku; splní se délkou v ms, při chybě se zamítne. */
  load(url: string): Promise<number>;
  /** Pustí připravenou nahrávku od začátku. */
  play(url: string): void;
  /** Zastaví hrající nahrávku. */
  stop(): void;
}

export interface RudyVoiceOptions {
  readonly player: RudyVoicePlayer;
  /** Je zvuk prohlížeče odemčený (běží)? */
  readonly isUnlocked: () => boolean;
}

/** Replika, která zazní s otevřením okna, a její délka v ms. */
export interface RudyVoiceLine {
  readonly url: string;
  readonly lineMs: number;
}

export interface RudyVoice {
  /** Chvíle s replikou `url` se chystá: nahrávka se stáhne, když je zvuk odemčený. */
  request(url: string | undefined): void;
  /** Může se okno otevřít, aniž by přišlo o hlas (nahrávka se právě nestahuje)? */
  isSettled(url: string | undefined): boolean;
  /** Co zazní s otevřením okna; `null`, když okno bude bez hlasu. */
  lineFor(url: string | undefined): RudyVoiceLine | null;
  /** Okno se otevřelo: replika zazní. */
  play(line: RudyVoiceLine): void;
  /** Okno se zavřelo: hlas zmlkne. */
  stop(): void;
}

type VoiceLoad =
  | { readonly status: 'loading' }
  | { readonly status: 'loaded'; readonly lineMs: number }
  | { readonly status: 'failed' };

/** Délka nahrávky, jen když dává smysl (kladné konečné číslo). */
function validLineMs(value: number): number | null {
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function createRudyVoice(options: RudyVoiceOptions): RudyVoice {
  const loads = new Map<string, VoiceLoad>();

  function startLoad(url: string): void {
    loads.set(url, { status: 'loading' });
    let started: Promise<number>;
    try {
      started = options.player.load(url);
    } catch {
      // Přehrávač stažení ani nezačal: okno bude bez hlasu.
      loads.set(url, { status: 'failed' });
      return;
    }
    started.then(
      (durationMs) => {
        const lineMs = validLineMs(durationMs);
        loads.set(url, lineMs === null ? { status: 'failed' } : { status: 'loaded', lineMs });
      },
      () => loads.set(url, { status: 'failed' }),
    );
  }

  return {
    request(url) {
      if (url === undefined || !options.isUnlocked()) {
        return;
      }
      const load = loads.get(url);
      if (load === undefined || load.status === 'failed') {
        startLoad(url);
      }
    },

    isSettled(url) {
      if (url === undefined || !options.isUnlocked()) {
        return true;
      }
      return loads.get(url)?.status !== 'loading';
    },

    lineFor(url) {
      if (url === undefined || !options.isUnlocked()) {
        return null;
      }
      const load = loads.get(url);
      return load?.status === 'loaded' ? { url, lineMs: load.lineMs } : null;
    },

    play(line) {
      options.player.play(line.url);
    },

    stop() {
      options.player.stop();
    },
  };
}
