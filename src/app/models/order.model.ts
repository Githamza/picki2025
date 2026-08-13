export type OrderStatus =
  | 'initiated'
  | 'paid'
  | 'refused'
  | 'cancelled'
  | 'todo'
  | 'ongoing'
  | 'done'
  | 'picked';
export type OrderType = 'eat-in' | 'take-away' | 'delivery';
export type OrderTiming = 'asap' | 'later';

export interface Customer {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  tvaRate: number;
  options?: any[]; // Change from string[] to any[] to support metadata
  vendorId?: string;
  comment?: string;
  metadata?: any; // Add explicit metadata field for multi-step products
  customisationSelections?: {
    customisationId: number;
    customisationName: string;
    selectedOptions: {
      optionId: number;
      optionName: string;
      priceAdjustment: number;
    }[];
  }[];
}

export interface Order {
  id: string;
  orderNumber: string;
  customer: Customer;
  items: OrderItem[];
  totalAmount: number;
  status: OrderStatus;
  orderType: OrderType;
  timing: OrderTiming;
  /**
   * When true, this order should be paid in-person (at pickup / at checkout),
   * and no online payment session is expected.
   */
  payAtCheckout?: boolean;
  /**
   * Qonto terminal payment id when the order was (or is being) paid on the
   * kiosk's physical terminal (SPEC-QONTO-TERMINAL.md). Presence means
   * "terminal flow", not success — success is the order reaching 'todo'.
   */
  terminalPaymentId?: string;
  scheduledTime?: Date; // For 'later' orders
  tableNumber?: string; // For dine-in orders
  createdAt: Date;
  updatedAt: Date;
  notes?: string;
  vendorId?: string;
  refuse_reason?: string;
  // Coupon fields (filled when a coupon is applied to the cart). The DB
  // trigger increments coupons.current_uses when status reaches a non-cancelled
  // value (paid / todo / ongoing / done / picked).
  couponId?: string | null;
  couponCode?: string | null;
  /** Discount amount in vendor currency major units. */
  discountAmount?: number;
}
