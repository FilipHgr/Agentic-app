/**
 * Řetězce v kódu TypeScriptu pro test „žádný text natvrdo“ (#65 AC1).
 * Projde zdroják znak po znaku a vrátí obsah řetězců v uvozovkách
 * ('…', "…") a v šablonách (`…`; u šablony s `${…}` každý pevný kus zvlášť).
 *
 * - Komentáře se přeskočí, text v nich se nekontroluje.
 * - Cesty v importech a exportech (`from '…'`, `import '…'`, `import('…')`)
 *   nejsou texty, vynechají se.
 * - Regulární výrazy (`/…/`) se přeskočí, aby uvozovka v nich nezmátla zbytek.
 */

export interface SourceString {
  readonly value: string;
  readonly line: number;
}

/** Po těchto znacích nebo slovech začíná `/` regulární výraz, ne dělení. */
const BEFORE_REGEX = new Set([
  '(',
  ',',
  '=',
  ':',
  '[',
  '!',
  '&',
  '|',
  '?',
  '{',
  '}',
  ';',
  '+',
  '-',
]);
const KEYWORDS_BEFORE_REGEX = new Set(['return', 'typeof', 'case', 'do', 'else', 'in', 'of']);

const SIMPLE_ESCAPES: Record<string, string> = {
  n: '\n',
  t: '\t',
  r: '\r',
  b: '\b',
  f: '\f',
  v: '\v',
  '0': '\0',
};

class Scanner {
  private index = 0;
  private line = 1;
  /** Poslední dva významné tokeny (slovo nebo znak), pro importy a regulární výrazy. */
  private previous: string[] = [];
  readonly found: SourceString[] = [];

  constructor(private readonly code: string) {}

  scanAll(): SourceString[] {
    this.scanUntil(null);
    return this.found;
  }

  /** Projde kód až po `}`, která uzavře výraz v šabloně (`stopAtBrace`), nebo do konce. */
  private scanUntil(stopAtBrace: { depth: number } | null): void {
    while (this.index < this.code.length) {
      const char = this.code[this.index] ?? '';
      const next = this.code[this.index + 1] ?? '';
      if (char === '\n') {
        this.line += 1;
        this.index += 1;
      } else if (char === '/' && next === '/') {
        this.skipLineComment();
      } else if (char === '/' && next === '*') {
        this.skipBlockComment();
      } else if (char === "'" || char === '"') {
        this.readQuoted(char);
      } else if (char === '`') {
        this.readTemplate();
      } else if (char === '/' && this.regexMayStart()) {
        this.skipRegex();
      } else if (/[A-Za-z_$]/.test(char)) {
        this.readWord();
      } else if (/\s/.test(char)) {
        this.index += 1;
      } else {
        if (stopAtBrace !== null) {
          if (char === '{') {
            stopAtBrace.depth += 1;
          } else if (char === '}') {
            if (stopAtBrace.depth === 0) {
              this.index += 1;
              return;
            }
            stopAtBrace.depth -= 1;
          }
        }
        this.remember(char);
        this.index += 1;
      }
    }
  }

  private remember(token: string): void {
    this.previous = [this.previous[this.previous.length - 1] ?? '', token];
  }

  private regexMayStart(): boolean {
    const last = this.previous[1] ?? '';
    return last === '' || BEFORE_REGEX.has(last) || KEYWORDS_BEFORE_REGEX.has(last);
  }

  /** Řetězec je cesta importu, ne text. */
  private isImportPath(): boolean {
    const [beforeLast, last] = this.previous;
    return last === 'from' || last === 'import' || (last === '(' && beforeLast === 'import');
  }

  private readWord(): void {
    const match = /^[A-Za-z0-9_$]+/.exec(this.code.slice(this.index));
    const word = match?.[0] ?? '';
    this.index += Math.max(word.length, 1);
    this.remember(word);
  }

  private skipLineComment(): void {
    while (this.index < this.code.length && this.code[this.index] !== '\n') {
      this.index += 1;
    }
  }

  private skipBlockComment(): void {
    const end = this.code.indexOf('*/', this.index + 2);
    const stop = end === -1 ? this.code.length : end + 2;
    this.line += (this.code.slice(this.index, stop).match(/\n/g) ?? []).length;
    this.index = stop;
  }

  private skipRegex(): void {
    let inClass = false;
    this.index += 1;
    while (this.index < this.code.length) {
      const char = this.code[this.index];
      if (char === '\\') {
        this.index += 2;
        continue;
      }
      if (char === '\n') {
        return;
      }
      this.index += 1;
      if (char === '[') {
        inClass = true;
      } else if (char === ']') {
        inClass = false;
      } else if (char === '/' && !inClass) {
        break;
      }
    }
    while (/[a-z]/.test(this.code[this.index] ?? '')) {
      this.index += 1;
    }
    this.remember('regex');
  }

  /** Jeden znak za zpětným lomítkem; vrátí jeho význam a posune se za něj. */
  private readEscape(): string {
    const char = this.code[this.index + 1] ?? '';
    if (char === 'u') {
      const braced = /^\{([0-9a-fA-F]+)\}/.exec(this.code.slice(this.index + 2));
      if (braced) {
        this.index += 2 + braced[0].length;
        return String.fromCodePoint(parseInt(braced[1] ?? '0', 16));
      }
      const hex = this.code.slice(this.index + 2, this.index + 6);
      this.index += 6;
      return String.fromCharCode(parseInt(hex, 16));
    }
    if (char === 'x') {
      const hex = this.code.slice(this.index + 2, this.index + 4);
      this.index += 4;
      return String.fromCharCode(parseInt(hex, 16));
    }
    this.index += 2;
    if (char === '\n') {
      this.line += 1;
      return '';
    }
    return SIMPLE_ESCAPES[char] ?? char;
  }

  private readQuoted(quote: string): void {
    const startLine = this.line;
    const importPath = this.isImportPath();
    let value = '';
    this.index += 1;
    while (this.index < this.code.length) {
      const char = this.code[this.index] ?? '';
      if (char === '\\') {
        value += this.readEscape();
      } else if (char === quote || char === '\n') {
        this.index += 1;
        break;
      } else {
        value += char;
        this.index += 1;
      }
    }
    if (!importPath) {
      this.found.push({ value, line: startLine });
    }
    this.remember('string');
  }

  private readTemplate(): void {
    let value = '';
    let startLine = this.line;
    const flush = (): void => {
      if (value !== '') {
        this.found.push({ value, line: startLine });
      }
      value = '';
    };
    this.index += 1;
    while (this.index < this.code.length) {
      const char = this.code[this.index] ?? '';
      const next = this.code[this.index + 1] ?? '';
      if (char === '\\') {
        value += this.readEscape();
      } else if (char === '`') {
        this.index += 1;
        break;
      } else if (char === '$' && next === '{') {
        flush();
        this.index += 2;
        this.remember('{');
        this.scanUntil({ depth: 0 });
        startLine = this.line;
      } else {
        if (char === '\n') {
          this.line += 1;
        }
        value += char;
        this.index += 1;
      }
    }
    flush();
    this.remember('string');
  }
}

/** Řetězce v kódu bez komentářů a cest importů, s číslem řádku. */
export function stringsInSource(code: string): SourceString[] {
  return new Scanner(code).scanAll();
}
