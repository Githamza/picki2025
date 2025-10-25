/* Shared PayGreen interfaces (no runtime code) */
export interface PayGreenPaymentOrderRequest {
  ttl?: number;
  auto_capture: boolean;
  buyer: {
    object: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
  };
  currency: string;
  merchant_initiated: boolean;
  mode: string;
  partial_allowed: boolean;
  return_url: string;
  plbs: boolean;
  amount: number;
  reference?: string;
}
