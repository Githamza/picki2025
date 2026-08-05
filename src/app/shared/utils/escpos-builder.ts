/**
 * Minimal, dependency-free ESC/POS command builder for 58mm / 80mm thermal
 * printers.
 *
 * The only subtle part is character encoding: ESC/POS printers do not speak
 * UTF-8. Text is encoded to a single-byte code page (CP858 by default, which
 * covers French accents plus the Euro sign) and anything unmapped degrades to
 * its unaccented ASCII equivalent rather than printing as garbage.
 */

const ESC = 0x1b;
const GS = 0x1d;

/** Epson code page identifiers used with `ESC t n`. */
export const CODE_PAGE_PC858 = 19; // Latin-1 + Euro. Correct for most printers.
export const CODE_PAGE_WPC1252 = 16; // Fallback for printers that lack PC858.
export const CODE_PAGE_PC437 = 0; // US/Europe, no accents; last resort.

/** Printable columns per paper width, at font A. */
export const COLUMNS_58MM = 32;
export const COLUMNS_80MM = 48;

export type Alignment = 'left' | 'center' | 'right';

/**
 * Unicode -> CP858 byte. CP858 is CP850 with the Euro sign at 0xD5.
 * Only characters that can actually appear on a French ticket are listed.
 */
const CP858_MAP: Record<string, number> = {
  'Ç': 0x80, 'ü': 0x81, 'é': 0x82, 'â': 0x83, 'ä': 0x84, 'à': 0x85, 'å': 0x86,
  'ç': 0x87, 'ê': 0x88, 'ë': 0x89, 'è': 0x8a, 'ï': 0x8b, 'î': 0x8c, 'ì': 0x8d,
  'Ä': 0x8e, 'Å': 0x8f, 'É': 0x90, 'æ': 0x91, 'Æ': 0x92, 'ô': 0x93, 'ö': 0x94,
  'ò': 0x95, 'û': 0x96, 'ù': 0x97, 'ÿ': 0x98, 'Ö': 0x99, 'Ü': 0x9a, 'ø': 0x9b,
  '£': 0x9c, 'Ø': 0x9d, 'ƒ': 0x9f,
  'á': 0xa0, 'í': 0xa1, 'ó': 0xa2, 'ú': 0xa3, 'ñ': 0xa4, 'Ñ': 0xa5, 'ª': 0xa6,
  'º': 0xa7, '¿': 0xa8, '®': 0xa9, '¬': 0xaa, '½': 0xab, '¼': 0xac, '¡': 0xad,
  '«': 0xae, '»': 0xaf,
  'Á': 0xb5, 'Â': 0xb6, 'À': 0xb7, '©': 0xb8,
  'Ã': 0xc6, 'ã': 0xc7,
  'Ê': 0xd2, 'Ë': 0xd3, 'È': 0xd4, '€': 0xd5, 'Í': 0xd6, 'Î': 0xd7,
  'Ï': 0xd8, 'Ì': 0xde,
  'Ó': 0xe0, 'ß': 0xe1, 'Ô': 0xe2, 'Ò': 0xe3, 'õ': 0xe4, 'Õ': 0xe5, 'µ': 0xe6,
  'þ': 0xe7, 'Þ': 0xe8, 'Ú': 0xe9, 'Û': 0xea, 'Ù': 0xeb, 'ý': 0xec, 'Ý': 0xed,
  '´': 0xef,
  '±': 0xf1, '¾': 0xf2, '¶': 0xf4, '§': 0xf5, '÷': 0xf6, '°': 0xf8, '¨': 0xf9,
  '·': 0xfa, '¹': 0xfb, '³': 0xfc, '²': 0xfd,
};

/**
 * Characters with no code-page byte but a sensible ASCII stand-in.
 *
 * The space variants matter: `Intl.NumberFormat('fr-FR')` puts a non-breaking
 * or narrow no-break space before the currency symbol, and U+00A0 is 'a' with
 * an acute accent in CP858 - so they must be normalised to a plain space
 * before the code-page lookup ever sees them.
 */
const ASCII_SUBSTITUTIONS: Record<string, string> = {
  ' ': ' ', // no-break space
  ' ': ' ', // narrow no-break space
  ' ': ' ', // thin space
  '€': 'EUR', // only reached when the code page has no Euro sign
  '’': "'",
  '‘': "'",
  '“': '"',
  '”': '"',
  '–': '-',
  '—': '-',
  '…': '...',
};

/** Whitespace variants normalised before anything else. */
const SPACE_VARIANTS = new Set([' ', ' ', ' ']);

/** Unicode combining diacritical marks, stripped as a last resort. */
const COMBINING_MARKS = /[̀-ͯ]/g;

/**
 * Encode a string to single-byte printer bytes.
 *
 * Order of attempts per character: space normalisation -> direct ASCII ->
 * code page byte -> ASCII substitution -> diacritic stripping -> '?'.
 */
export function encodeText(text: string, codePage: number = CODE_PAGE_PC858): number[] {
  const bytes: number[] = [];
  const useCodePage = codePage === CODE_PAGE_PC858;

  for (const char of text) {
    if (SPACE_VARIANTS.has(char)) {
      bytes.push(0x20);
      continue;
    }

    const code = char.charCodeAt(0);

    if (code >= 0x20 && code <= 0x7e) {
      bytes.push(code);
      continue;
    }
    if (char === '\n') {
      bytes.push(0x0a);
      continue;
    }

    if (useCodePage) {
      const mapped = CP858_MAP[char];
      if (mapped !== undefined) {
        bytes.push(mapped);
        continue;
      }
    }

    const substitute = ASCII_SUBSTITUTIONS[char];
    if (substitute) {
      for (const substituteChar of substitute) {
        bytes.push(substituteChar.charCodeAt(0));
      }
      continue;
    }

    // Strip diacritics: e-acute -> e. Better a plain letter than a wrong glyph.
    const stripped = char.normalize('NFD').replace(COMBINING_MARKS, '');
    if (stripped && stripped !== char) {
      bytes.push(...encodeText(stripped, codePage));
      continue;
    }

    bytes.push(0x3f); // '?'
  }

  return bytes;
}

/** Wrap text to `width` columns, breaking on words where possible. */
export function wrapText(text: string, width: number): string[] {
  if (width <= 0) {
    return [text];
  }

  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    if (paragraph.length === 0) {
      lines.push('');
      continue;
    }

    let current = '';
    for (const word of paragraph.split(' ')) {
      if (word.length > width) {
        // A single word longer than the paper: hard-break it.
        if (current) {
          lines.push(current);
          current = '';
        }
        let rest = word;
        while (rest.length > width) {
          lines.push(rest.slice(0, width));
          rest = rest.slice(width);
        }
        current = rest;
        continue;
      }

      if (!current) {
        current = word;
      } else if (current.length + 1 + word.length <= width) {
        current += ' ' + word;
      } else {
        lines.push(current);
        current = word;
      }
    }
    if (current) {
      lines.push(current);
    }
  }

  return lines.length ? lines : [''];
}

export interface EscPosBuilderOptions {
  columns?: number;
  codePage?: number;
}

export class EscPosBuilder {
  private readonly bytes: number[] = [];
  private readonly columns: number;
  private readonly codePage: number;

  constructor(options: EscPosBuilderOptions = {}) {
    this.columns = options.columns ?? COLUMNS_58MM;
    this.codePage = options.codePage ?? CODE_PAGE_PC858;
  }

  get width(): number {
    return this.columns;
  }

  /** Reset the printer and select the code page. Always call first. */
  init(): this {
    this.bytes.push(ESC, 0x40); // ESC @
    this.bytes.push(ESC, 0x74, this.codePage); // ESC t n
    return this;
  }

  align(alignment: Alignment): this {
    const value = alignment === 'center' ? 1 : alignment === 'right' ? 2 : 0;
    this.bytes.push(ESC, 0x61, value); // ESC a n
    return this;
  }

  bold(enabled: boolean): this {
    this.bytes.push(ESC, 0x45, enabled ? 1 : 0); // ESC E n
    return this;
  }

  underline(enabled: boolean): this {
    this.bytes.push(ESC, 0x2d, enabled ? 1 : 0); // ESC - n
    return this;
  }

  /** Character magnification, 1-8 in each axis. */
  size(widthScale: number, heightScale: number): this {
    const w = Math.min(8, Math.max(1, Math.round(widthScale))) - 1;
    const h = Math.min(8, Math.max(1, Math.round(heightScale))) - 1;
    this.bytes.push(GS, 0x21, (w << 4) | h); // GS ! n
    return this;
  }

  /** Raw text, no trailing newline. */
  text(value: string): this {
    this.bytes.push(...encodeText(value, this.codePage));
    return this;
  }

  /**
   * Text followed by a newline, wrapped to the paper width.
   *
   * `columns` overrides the wrap width - pass a halved width while double-width
   * characters are active. `indent` is applied to every wrapped line, since
   * leading spaces in `value` would be swallowed by the word wrapper.
   */
  line(
    value = '',
    options: { wrap?: boolean; columns?: number; indent?: number } = {}
  ): this {
    const indent = options.indent ?? 0;
    const pad = ' '.repeat(indent);
    const width = (options.columns ?? this.columns) - indent;
    const lines = options.wrap === false ? [value] : wrapText(value, width);
    for (const wrapped of lines) {
      this.text(pad + wrapped);
      this.bytes.push(0x0a);
    }
    return this;
  }

  /**
   * A label on the left and a value flush right on the same line. If they do
   * not fit together, the value goes on its own line underneath.
   */
  columnsLine(left: string, right: string, options: { indent?: number } = {}): this {
    const indent = options.indent ?? 0;
    const pad = ' '.repeat(indent);
    const available = this.columns - indent;

    if (right.length + 1 >= available) {
      return this.line(pad + left).line(pad + right);
    }

    const leftLines = wrapText(left, available - right.length - 1);
    for (let i = 0; i < leftLines.length - 1; i++) {
      this.line(pad + leftLines[i]);
    }

    const last = leftLines[leftLines.length - 1];
    const gap = this.columns - indent - last.length - right.length;
    this.line(pad + last + ' '.repeat(Math.max(1, gap)) + right, { wrap: false });
    return this;
  }

  divider(char = '-'): this {
    return this.line(char.repeat(this.columns), { wrap: false });
  }

  feed(lines = 1): this {
    for (let i = 0; i < lines; i++) {
      this.bytes.push(0x0a);
    }
    return this;
  }

  /** Partial cut, preceded by enough feed to clear the cutter. */
  cut(): this {
    this.feed(4);
    this.bytes.push(GS, 0x56, 66, 0); // GS V 66 0
    return this;
  }

  /** Open a cash drawer wired to the printer's kick port. */
  openDrawer(): this {
    this.bytes.push(ESC, 0x70, 0, 25, 250); // ESC p 0 25 250
    return this;
  }

  build(): Uint8Array {
    return Uint8Array.from(this.bytes);
  }

  toBase64(): string {
    return bytesToBase64(this.build());
  }
}

/** btoa() chokes on a spread of large arrays, so encode in chunks. */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}
