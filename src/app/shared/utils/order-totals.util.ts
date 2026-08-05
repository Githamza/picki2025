import { Order, OrderItem } from '../../models/order.model';

/** Sentinel product id used for the synthetic delivery-fee line item. */
const DELIVERY_FEE_PRODUCT_ID = -9999;

/**
 * Delivery fees are stored as a pseudo order item rather than a column, so
 * they must be filtered out of the article list and shown as a summary line.
 */
export function isDeliveryFeeItem(item: OrderItem): boolean {
  const productId = Number(item.productId);
  const name = (item.productName || '').toLowerCase();
  return (
    productId === DELIVERY_FEE_PRODUCT_ID ||
    name.includes('livraison') ||
    name.includes('delivery')
  );
}

/** Real articles, excluding the synthetic delivery-fee line. */
export function getProductItems(order: Order): OrderItem[] {
  return order.items.filter((item) => !isDeliveryFeeItem(item));
}

export function getSubtotal(order: Order): number {
  return getProductItems(order).reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
}

export function getDeliveryFee(order: Order): number {
  const deliveryItem = order.items.find(isDeliveryFeeItem);
  return deliveryItem ? deliveryItem.price * deliveryItem.quantity : 0;
}

/** Whatever is left over between the lines and the charged total. */
export function getServiceFee(order: Order): number {
  const remainder = order.totalAmount - getSubtotal(order) - getDeliveryFee(order);
  return remainder > 0 ? remainder : 0;
}
