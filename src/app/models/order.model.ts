export type OrderStatus =
  | 'initiated'
  | 'refused'
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
  options?: string[];
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
  scheduledTime?: Date; // For 'later' orders
  tableNumber?: string; // For dine-in orders
  createdAt: Date;
  updatedAt: Date;
  notes?: string;
}
