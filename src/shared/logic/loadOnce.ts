/**
 * Stažení souboru jednou za načtení stránky (#193 AC5): obrázky map
 * postupu jsou společné všem hrám s hvězdičkami, a když se jeden stáhl
 * v Počítání, Znaménka (a další spuštění téže hry) ho dostanou bez
 * dalšího stahování. Souběžné žádosti o stejnou adresu čekají na jedno
 * stažení. Po výpadku se adresa zapomene, aby se dala zkusit znovu.
 * Čistý TypeScript bez prohlížeče; samotné stahování dodá volající.
 */

/** Stáhne soubor z adresy `url`; slib se splní staženým souborem. */
export type LoadFile<T> = (url: string) => Promise<T>;

/** Stejně jako `load`, ale každou adresu stáhne nejvýš jednou (dokud se nepovede). */
export function loadEachOnce<T>(load: LoadFile<T>): LoadFile<T> {
  const loads = new Map<string, Promise<T>>();
  return (url) => {
    const started = loads.get(url);
    if (started !== undefined) {
      return started;
    }
    let loading: Promise<T>;
    try {
      loading = load(url);
    } catch (error) {
      // Stahování, které ani nezačalo, je výpadek: zkusí se znovu příště.
      return Promise.reject(error instanceof Error ? error : new Error(String(error)));
    }
    const remembered = loading.catch((error: unknown) => {
      loads.delete(url);
      throw error;
    });
    loads.set(url, remembered);
    return remembered;
  };
}
