export enum RefuseReason {
  OUT_OF_STOCK = 'out_of_stock',
  RESTAURANT_CLOSED = 'restaurant_closed',
  TOO_BUSY = 'too_busy',
  TECHNICAL_ISSUE = 'technical_issue',
  INVALID_ORDER = 'invalid_order',
  CUSTOM = 'custom',
}

export const RefuseReasonLabels: Record<RefuseReason, string> = {
  [RefuseReason.OUT_OF_STOCK]: 'Produits indisponibles',
  [RefuseReason.RESTAURANT_CLOSED]: 'Restaurant fermé',
  [RefuseReason.TOO_BUSY]: 'Trop de commandes',
  [RefuseReason.TECHNICAL_ISSUE]: 'Problème technique',
  [RefuseReason.INVALID_ORDER]: 'Commande invalide',
  [RefuseReason.CUSTOM]: 'Autre raison',
};

