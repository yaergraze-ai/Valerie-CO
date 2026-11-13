/**
 * Aggregate non-cancelled, non-refunded unit quantities by product ID.
 */
export function salesTotals(orders) {
  const totals = {};
  for (const order of orders) {
    if (
      order.status !== "cancelled" &&
      order.payment?.status !== "refunded" &&
      order.refund?.status !== "refunded"
    ) {
      for (const item of order.items) {
        totals[item.productId] = (totals[item.productId] || 0) + item.quantity;
      }
    }
  }
  return totals;
}

