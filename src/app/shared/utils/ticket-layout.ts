import { Order, OrderItem, OrderType } from '../../models/order.model';
import { CODE_PAGE_PC858, COLUMNS_58MM, EscPosBuilder } from './escpos-builder';
import { getDeliveryFee, getProductItems, getServiceFee, getSubtotal } from './order-totals.util';
import { shortOrderNumber } from './order-number.util';
import { calculateTvaBreakdownByRate } from './tva-breakdown.util';

/**
 * Pure ticket layout. Kept free of Angular DI so it can be exercised directly
 * in tests and from a script - `TicketRendererService` only supplies the
 * vendor-derived defaults.
 */
export interface TicketLayoutOptions {
  businessName?: string | null;
  /** Vendor country, used to pick the default VAT rate. */
  country?: string | null;
  currency?: string;
  columns?: number;
  codePage?: number;
}

const ORDER_TYPE_LABELS: Record<OrderType, string> = {
  'eat-in': 'SUR PLACE',
  'take-away': 'À EMPORTER',
  delivery: 'LIVRAISON',
};

export function renderOrderTicket(order: Order, options: TicketLayoutOptions = {}): Uint8Array {
  const currency = options.currency || 'EUR';
  const builder = new EscPosBuilder({
    columns: options.columns ?? COLUMNS_58MM,
    codePage: options.codePage ?? CODE_PAGE_PC858,
  });
  const money = (amount: number) => formatCurrency(amount, currency);

  builder.init().align('center');

  if (options.businessName) {
    builder.bold(true).line(options.businessName.toUpperCase()).bold(false);
  }

  // Short order number, as large as the paper allows - this is what staff
  // call out and the customer reads back. The full number stays underneath
  // in small print for record matching.
  builder
    .size(2, 2)
    .bold(true)
    .line(`N° ${shortOrderNumber(order.orderNumber)}`, {
      columns: Math.floor(builder.width / 2),
    })
    .bold(false)
    .size(1, 1)
    .line(`Réf. ${order.orderNumber}`);

  builder.bold(true).line(ORDER_TYPE_LABELS[order.orderType] ?? order.orderType).bold(false);

  if (order.orderType === 'eat-in' && order.tableNumber) {
    builder.size(1, 2).line(`Table ${order.tableNumber}`).size(1, 1);
  }

  if (order.timing === 'later' && order.scheduledTime) {
    builder.bold(true).line(`PRÉVUE POUR ${formatTime(order.scheduledTime)}`).bold(false);
  }

  builder.align('left').divider();

  // --------------------------------------------------------------- articles
  const productItems = getProductItems(order);
  for (const item of productItems) {
    builder
      .bold(true)
      .columnsLine(`${item.quantity}x ${item.productName}`, money(item.price * item.quantity))
      .bold(false);

    for (const option of getOptionLines(item, money)) {
      builder.line(`+ ${option}`, { indent: 2 });
    }

    if (item.comment) {
      builder.bold(true).line(`** ${item.comment}`, { indent: 2 }).bold(false);
    }
  }

  builder.divider();

  // ----------------------------------------------------------------- totals
  const deliveryFee = getDeliveryFee(order);
  const serviceFee = getServiceFee(order);

  builder.columnsLine('Sous-total', money(getSubtotal(order)));
  if (deliveryFee > 0) {
    builder.columnsLine('Frais de livraison', money(deliveryFee));
  }
  if (serviceFee > 0) {
    builder.columnsLine('Frais de service', money(serviceFee));
  }
  if (order.discountAmount && order.discountAmount > 0) {
    const label = order.couponCode ? `Remise ${order.couponCode}` : 'Remise';
    builder.columnsLine(label, `-${money(order.discountAmount)}`);
  }

  builder
    .size(1, 2)
    .bold(true)
    .columnsLine('TOTAL', money(order.totalAmount))
    .bold(false)
    .size(1, 1);

  for (const tva of calculateTvaBreakdownByRate(productItems, options.country)) {
    builder.line(
      `TVA ${formatRate(tva.rate)}  HT ${money(tva.totalHT)}  TVA ${money(tva.totalTVA)}`
    );
  }

  builder.divider();

  // ---------------------------------------------------------------- payment
  builder
    .align('center')
    .bold(true)
    .line(order.payAtCheckout ? 'À PAYER SUR PLACE' : 'PAYÉ EN LIGNE')
    .bold(false)
    .align('left');

  // --------------------------------------------------------------- customer
  const customerName = `${order.customer.firstName ?? ''} ${order.customer.lastName ?? ''}`.trim();
  if (customerName) {
    builder.line(customerName);
  }
  if (order.customer.phone) {
    builder.line(`Tél. ${order.customer.phone}`);
  }
  if (order.notes) {
    builder.line(`Note: ${order.notes}`);
  }

  builder.line(formatDateTime(order.createdAt));

  return builder.cut().build();
}

/** Alignment / encoding check printed from the settings screen. */
export function renderTestTicket(
  options: TicketLayoutOptions & { now?: Date } = {}
): Uint8Array {
  const builder = new EscPosBuilder({
    columns: options.columns ?? COLUMNS_58MM,
    codePage: options.codePage ?? CODE_PAGE_PC858,
  });

  builder.init().align('center').bold(true).line('TEST IMPRESSION').bold(false);

  if (options.businessName) {
    builder.line(options.businessName);
  }

  return builder
    .align('left')
    .divider()
    .line('Accents : à â ä é è ê ë î ï ô ö ù û ü ç')
    .line('Majuscules : À É È Ê Ç Ô Û')
    .line('Symboles : € 1,50 % ° « »')
    .line('Types : Sur place / À emporter / Livraison')
    .divider()
    // Fills the full width, so a wrong column setting is obvious at a glance.
    .line('1234567890'.repeat(5).slice(0, builder.width), { wrap: false })
    .columnsLine('Colonne gauche', 'droite')
    .columnsLine(`Largeur ${builder.width} colonnes`, 'OK')
    .divider()
    .align('center')
    .line(formatDateTime(options.now ?? new Date()))
    .cut()
    .build();
}

/**
 * Human-readable option lines for a product.
 *
 * Multi-step selections live in `options[0].stepSelections`; the
 * `customisationSelections` field on the model is never populated by
 * `OrdersService.mapDbOrderToOrder`, so it is deliberately not read here.
 */
function getOptionLines(item: OrderItem, money: (amount: number) => string): string[] {
  const stepSelections = item.options?.[0]?.stepSelections;
  if (!stepSelections?.length) {
    return [];
  }

  const lines: string[] = [];
  for (const step of stepSelections) {
    for (const option of step.selectedOptions || []) {
      const name = option.optionName ?? '';
      if (!name) {
        continue;
      }
      const adjustment = Number(option.priceAdjustment) || 0;
      lines.push(adjustment > 0 ? `${name} (+${money(adjustment)})` : name);
    }
  }
  return lines;
}

function formatCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: currency.toUpperCase(),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

function formatRate(rate: number): string {
  return `${rate.toString().replace('.', ',')}%`;
}

function formatTime(value: Date | string): string {
  return new Date(value).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDateTime(value: Date | string): string {
  const date = new Date(value);
  const day = date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  return `${day} ${formatTime(date)}`;
}
