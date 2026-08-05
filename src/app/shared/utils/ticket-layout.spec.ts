import { Order } from '../../models/order.model';
import { renderOrderTicket, renderTestTicket } from './ticket-layout';
import { calculateTvaBreakdownByRate } from './tva-breakdown.util';

/**
 * Decode an ESC/POS stream back into printed lines, tracking the effective
 * width (double-width characters occupy two columns).
 */
function decodeLines(bytes: Uint8Array): { text: string; width: number }[] {
  const lines: { text: string; width: number }[] = [];
  let text = '';
  let width = 0;
  let scale = 1;

  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i];
    if (byte === 0x1b) {
      const command = bytes[i + 1];
      // ESC @ takes no parameter; ESC p takes three; the rest take one.
      i += command === 0x40 ? 1 : command === 0x70 ? 4 : 2;
      continue;
    }
    if (byte === 0x1d) {
      const command = bytes[i + 1];
      if (command === 0x21) {
        scale = ((bytes[i + 2] >> 4) & 0x0f) + 1;
        i += 2;
      } else {
        i += 3; // GS V m n
      }
      continue;
    }
    if (byte === 0x0a) {
      lines.push({ text, width });
      text = '';
      width = 0;
      continue;
    }
    text += byte >= 0x20 && byte <= 0x7e ? String.fromCharCode(byte) : `<${byte.toString(16)}>`;
    width += scale;
  }

  return lines;
}

function buildOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'order-1',
    orderNumber: 'A-1042',
    customer: {
      firstName: 'Amélie',
      lastName: 'Rousseau',
      email: 'amelie@example.fr',
      phone: '06 12 34 56 78',
    },
    items: [
      {
        productId: '1',
        productName: 'Menu Burger Complet',
        quantity: 1,
        price: 14.9,
        tvaRate: 10,
        comment: 'Sans oignons',
        options: [
          {
            stepSelections: [
              {
                stepName: 'Plat',
                selectedOptions: [
                  { optionName: 'Cheeseburger', alaCartePrice: 9.5, tvaRate: 10, priceAdjustment: 0 },
                ],
              },
              {
                stepName: 'Boisson',
                selectedOptions: [
                  { optionName: 'Coca-Cola 33cl', alaCartePrice: 3, tvaRate: 20, priceAdjustment: 0.5 },
                ],
              },
              {
                stepName: 'Accompagnement',
                selectedOptions: [
                  { optionName: 'Frites', alaCartePrice: 3.5, tvaRate: 10, priceAdjustment: 0 },
                ],
              },
            ],
          },
        ],
      },
      {
        productId: '2',
        productName: 'Salade César',
        quantity: 2,
        price: 8.5,
        tvaRate: 10,
        options: [],
      },
      {
        productId: '-9999',
        productName: 'Frais de livraison',
        quantity: 1,
        price: 3,
        tvaRate: 20,
        options: [],
      },
    ],
    totalAmount: 33.9,
    status: 'paid',
    orderType: 'delivery',
    timing: 'asap',
    payAtCheckout: false,
    createdAt: new Date('2026-08-05T18:42:00'),
    updatedAt: new Date('2026-08-05T18:42:00'),
    ...overrides,
  } as Order;
}

const LAYOUT = { businessName: 'Granola', country: 'FR', currency: 'EUR' };

describe('renderOrderTicket', () => {
  it('never prints a line wider than the paper', () => {
    for (const columns of [32, 48]) {
      for (const line of decodeLines(renderOrderTicket(buildOrder(), { ...LAYOUT, columns }))) {
        expect(line.width)
          .withContext(`"${line.text}" at ${columns} columns`)
          .toBeLessThanOrEqual(columns);
      }
    }
  });

  it('prints the order number, type and total', () => {
    const text = decodeLines(renderOrderTicket(buildOrder(), { ...LAYOUT, columns: 32 }))
      .map((line) => line.text)
      .join('\n');

    expect(text).toContain('A-1042');
    expect(text).toContain('LIVRAISON');
    expect(text).toMatch(/TOTAL\s+33,90/);
    expect(text).toContain('PAY');
  });

  it('lists multi-step options with their supplement', () => {
    const text = decodeLines(renderOrderTicket(buildOrder(), { ...LAYOUT, columns: 32 }))
      .map((line) => line.text)
      .join('\n');

    expect(text).toContain('+ Cheeseburger');
    expect(text).toContain('+ Frites');
    // Supplements use the vendor currency, not a bare number.
    expect(text).toMatch(/\+ Coca-Cola 33cl \(\+0,50/);
    // Item comments are what the kitchen must not miss.
    expect(text).toContain('** Sans oignons');
  });

  it('keeps the delivery fee out of the article list and in the totals', () => {
    const lines = decodeLines(renderOrderTicket(buildOrder(), { ...LAYOUT, columns: 32 })).map(
      (line) => line.text
    );

    expect(lines.some((line) => /^\dx Frais de livraison/.test(line))).toBe(false);
    expect(lines.some((line) => line.startsWith('Frais de livraison'))).toBe(true);
    expect(lines.some((line) => /Sous-total\s+31,90/.test(line))).toBe(true);
  });

  it('shows the table number only for eat-in orders', () => {
    const eatIn = decodeLines(
      renderOrderTicket(
        buildOrder({ orderType: 'eat-in', tableNumber: '12' }),
        { ...LAYOUT, columns: 32 }
      )
    )
      .map((line) => line.text)
      .join('\n');
    expect(eatIn).toContain('Table 12');

    const delivery = decodeLines(
      renderOrderTicket(buildOrder({ tableNumber: '12' }), { ...LAYOUT, columns: 32 })
    )
      .map((line) => line.text)
      .join('\n');
    expect(delivery).not.toContain('Table 12');
  });

  it('flags orders that still have to be paid', () => {
    const text = decodeLines(
      renderOrderTicket(buildOrder({ payAtCheckout: true }), { ...LAYOUT, columns: 32 })
    )
      .map((line) => line.text)
      .join('\n');
    expect(text).toContain('PAYER SUR PLACE');
  });

  it('ends with a cut command', () => {
    const bytes = Array.from(renderOrderTicket(buildOrder(), { ...LAYOUT, columns: 32 }));
    expect(bytes.slice(-4)).toEqual([0x1d, 0x56, 66, 0]);
  });
});

describe('renderTestTicket', () => {
  it('fits the paper and shows the configured width', () => {
    const lines = decodeLines(renderTestTicket({ ...LAYOUT, columns: 32 }));
    for (const line of lines) {
      expect(line.width).toBeLessThanOrEqual(32);
    }
    expect(lines.map((l) => l.text).join('\n')).toContain('Largeur 32 colonnes');
  });
});

describe('calculateTvaBreakdownByRate', () => {
  it('splits a multi-step product across the rates of its components', () => {
    const [menu] = buildOrder().items;
    const breakdown = calculateTvaBreakdownByRate([menu], 'FR');

    expect(breakdown.map((b) => b.rate)).toEqual([10, 20]);
    // Whole line is accounted for, nothing lost to rounding.
    const totalTTC = breakdown.reduce((sum, b) => sum + b.totalTTC, 0);
    expect(totalTTC).toBeCloseTo(14.9, 2);
    // The drink gets its pro-rata share of the menu price (14,40 x 3,00/16,00
    // = 2,70) plus its own 0,50 supplement, taxed at 20%.
    const drink = breakdown.find((b) => b.rate === 20)!;
    expect(drink.totalTTC).toBeCloseTo(3.2, 2);
  });

  it('falls back to the line rate for a simple product', () => {
    const simple = buildOrder().items[1];
    expect(calculateTvaBreakdownByRate([simple], 'FR')).toEqual([
      { rate: 10, totalHT: 15.45, totalTVA: 1.55, totalTTC: 17 },
    ]);
  });

  it('uses the country default when no rate is stored', () => {
    const item = { ...buildOrder().items[1], tvaRate: undefined as unknown as number };
    expect(calculateTvaBreakdownByRate([item], 'BE')[0].rate).toBe(12);
  });
});
