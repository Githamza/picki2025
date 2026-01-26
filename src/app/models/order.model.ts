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
  scheduledTime?: Date; // For 'later' orders
  tableNumber?: string; // For dine-in orders
  createdAt: Date;
  updatedAt: Date;
  notes?: string;
  vendorId?: string;
  refuse_reason?: string; // Reference to the vendor this order belongs to
}
