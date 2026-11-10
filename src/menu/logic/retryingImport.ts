/**
 * Nový pokus o stažení hry po výpadku sítě (#67 AC5). Prohlížeč si
 * nepovedený dynamický `import()` pamatuje a stejnou adresu už znovu
 * nestáhne, dokud se stránka neobnoví. Po selhání se proto další pokus
 * stahuje s jinou adresou (`?pokus=<číslo>`); povedená adresa se pak
 * používá dál, aby hra nebyla v paměti dvakrát. Stahuje se jen ze stejného
 * původu jako stránka, adresa z cizího serveru se odmítne. Čistý TypeScript bez
 * prohlížeče, stahování dostane zvenku.
 */

export type ModuleImporter = (url: string) => Promise<unknown>;

/** Stáhne soubor podle cesty vůči `base` (adresa souboru, který stahuje). */
export type RetryingImport = (path: string, base: string) => Promise<unknown>;

/** Adresa pokusu: první je beze změny, další mají číslo pokusu. */
export function attemptUrl(url: string, failedAttempts: number): string {
  if (failedAttempts === 0) {
    return url;
  }
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}pokus=${failedAttempts}`;
}

export function createRetryingImport(importModule: ModuleImporter): RetryingImport {
  const failures = new Map<string, number>();
  return (path, base) => {
    const target = new URL(path, base);
    if (target.origin !== new URL(base).origin) {
      return Promise.reject(new Error('hra se stahuje jen ze stejného serveru jako stránka'));
    }
    const url = target.href;
    const failed = failures.get(url) ?? 0;
    return importModule(attemptUrl(url, failed)).catch((error: unknown) => {
      failures.set(url, failed + 1);
      throw error;
    });
  };
}
