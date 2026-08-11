/**
 * Customer-facing order number: YYMMDD-XXXXXX.
 *
 * The suffix is 6 random digits (1,000,000 combinations per day). The
 * previous 3-digit suffix collided under real daily volume against the
 * orders.order_number unique constraint, silently killing checkouts
 * (see tasks/plan.md, Phase 0 findings). Shared by the cart checkout
 * flows so the format only exists in one place.
 */
export function generateOrderNumber(now: Date = new Date()): string {
  const year = now.getFullYear().toString().slice(-2);
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 1_000_000)
    .toString()
    .padStart(6, '0');
  return `${year}${month}${day}-${random}`;
}

/**
 * Customer-facing short form: the last 3 digits of the number. The full
 * YYMMDD-XXXXXX stays in the database (collision safety, see above) and in
 * small print for staff; three digits are what a customer can read out at
 * the counter.
 */
export function shortOrderNumber(orderNumber: string): string {
  const digits = orderNumber.replace(/\D/g, '');
  return digits.slice(-3) || orderNumber;
}
