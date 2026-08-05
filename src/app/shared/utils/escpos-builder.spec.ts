import {
  CODE_PAGE_PC437,
  CODE_PAGE_PC858,
  COLUMNS_58MM,
  EscPosBuilder,
  bytesToBase64,
  encodeText,
  wrapText,
} from './escpos-builder';

describe('encodeText', () => {
  it('passes plain ASCII through unchanged', () => {
    expect(encodeText('TOTAL 12.50')).toEqual(
      'TOTAL 12.50'.split('').map((c) => c.charCodeAt(0))
    );
  });

  it('maps French accents to their CP858 bytes', () => {
    expect(encodeText('é')).toEqual([0x82]);
    expect(encodeText('è')).toEqual([0x8a]);
    expect(encodeText('à')).toEqual([0x85]);
    expect(encodeText('ç')).toEqual([0x87]);
    expect(encodeText('ô')).toEqual([0x93]);
    expect(encodeText('û')).toEqual([0x96]);
    expect(encodeText('À')).toEqual([0xb7]);
    expect(encodeText('É')).toEqual([0x90]);
    expect(encodeText('È')).toEqual([0xd4]);
    expect(encodeText('Ç')).toEqual([0x80]);
  });

  it('maps the Euro sign to the CP858 slot', () => {
    expect(encodeText('€')).toEqual([0xd5]);
  });

  it('encodes a full French ticket line', () => {
    // "À emporter" must not contain a single '?' byte.
    expect(encodeText('À emporter - Préparation')).not.toContain(0x3f);
  });

  it('normalises no-break spaces to a plain space', () => {
    // U+00A0 is 'a-acute' in CP858, so printing it raw would corrupt prices.
    expect(encodeText('12,50 €')).toEqual([
      0x31, 0x32, 0x2c, 0x35, 0x30, 0x20, 0xd5,
    ]);
    expect(encodeText('12,50 €')).toEqual([
      0x31, 0x32, 0x2c, 0x35, 0x30, 0x20, 0xd5,
    ]);
  });

  it('strips diacritics when the code page cannot represent them', () => {
    expect(encodeText('é', CODE_PAGE_PC437)).toEqual(['e'.charCodeAt(0)]);
    expect(encodeText('À', CODE_PAGE_PC437)).toEqual(['A'.charCodeAt(0)]);
  });

  it('substitutes the Euro sign on code pages without it', () => {
    expect(encodeText('€', CODE_PAGE_PC437)).toEqual(
      'EUR'.split('').map((c) => c.charCodeAt(0))
    );
  });

  it('replaces typographic punctuation with ASCII', () => {
    expect(encodeText('’')).toEqual(["'".charCodeAt(0)]);
    expect(encodeText('…')).toEqual('...'.split('').map((c) => c.charCodeAt(0)));
  });

  it('never emits a byte outside a single octet', () => {
    const bytes = encodeText('Crème brûlée « spéciale » 100° €');
    for (const byte of bytes) {
      expect(byte).toBeGreaterThanOrEqual(0);
      expect(byte).toBeLessThanOrEqual(0xff);
    }
  });
});

describe('wrapText', () => {
  it('breaks on word boundaries', () => {
    expect(wrapText('Burger double cheddar bacon', 12)).toEqual([
      'Burger',
      'double',
      'cheddar',
      'bacon',
    ]);
  });

  it('hard-breaks a word longer than the paper', () => {
    expect(wrapText('AAAAAAAAAAAA', 5)).toEqual(['AAAAA', 'AAAAA', 'AA']);
  });

  it('never returns a line wider than the width', () => {
    const lines = wrapText('Menu du jour avec frites et boisson au choix', 20);
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(20);
    }
  });
});

describe('EscPosBuilder', () => {
  it('emits reset and code page selection on init', () => {
    const bytes = Array.from(new EscPosBuilder().init().build());
    expect(bytes.slice(0, 5)).toEqual([0x1b, 0x40, 0x1b, 0x74, CODE_PAGE_PC858]);
  });

  it('emits the documented control sequences', () => {
    const bold = Array.from(new EscPosBuilder().bold(true).build());
    expect(bold).toEqual([0x1b, 0x45, 1]);

    const centre = Array.from(new EscPosBuilder().align('center').build());
    expect(centre).toEqual([0x1b, 0x61, 1]);

    // GS ! n packs width in the high nibble, height in the low nibble.
    const double = Array.from(new EscPosBuilder().size(2, 2).build());
    expect(double).toEqual([0x1d, 0x21, 0x11]);

    const cut = Array.from(new EscPosBuilder().cut().build());
    expect(cut).toEqual([0x0a, 0x0a, 0x0a, 0x0a, 0x1d, 0x56, 66, 0]);
  });

  it('clamps magnification to the 1-8 range', () => {
    expect(Array.from(new EscPosBuilder().size(0, 99).build())).toEqual([
      0x1d, 0x21, 0x07,
    ]);
  });

  it('pads columnsLine so the value sits flush right', () => {
    const builder = new EscPosBuilder({ columns: COLUMNS_58MM });
    const text = decode(builder.columnsLine('Sous-total', '12,50').build());
    expect(text).toBe(`Sous-total${' '.repeat(17)}12,50\n`);
    expect(text.trimEnd().length).toBe(COLUMNS_58MM);
  });

  it('drops the value onto its own line when it cannot fit', () => {
    const builder = new EscPosBuilder({ columns: 10 });
    const text = decode(builder.columnsLine('Article', '1234567890').build());
    expect(text).toBe('Article\n1234567890\n');
  });

  it('draws a divider exactly one line wide', () => {
    const builder = new EscPosBuilder({ columns: 32 });
    expect(decode(builder.divider().build())).toBe(`${'-'.repeat(32)}\n`);
  });

  it('wraps long lines to the paper width', () => {
    const builder = new EscPosBuilder({ columns: 16 });
    expect(decode(builder.line('Menu du jour avec frites').build())).toBe(
      'Menu du jour\navec frites\n'
    );
  });
});

describe('bytesToBase64', () => {
  it('round-trips through atob', () => {
    const bytes = Uint8Array.from([0x1b, 0x40, 0xd5, 0x82, 0x0a]);
    const decoded = atob(bytesToBase64(bytes));
    expect(Array.from(decoded).map((c) => c.charCodeAt(0))).toEqual(
      Array.from(bytes)
    );
  });

  it('handles payloads larger than one chunk', () => {
    const bytes = new Uint8Array(70000).fill(0x41);
    expect(atob(bytesToBase64(bytes)).length).toBe(70000);
  });
});

/** Decode printable output back to a string, ignoring control sequences. */
function decode(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => String.fromCharCode(byte))
    .join('');
}
