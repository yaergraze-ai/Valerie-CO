export function salesTotals(
  orders: {
    status: string;
    payment?: { status?: string };
    refund?: { status?: string };
    items: { productId: string; quantity: number }[];
  }[],
): Record<string, number>;

