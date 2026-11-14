import type { Item } from "./catalog";
export type BagLine = {
  productId: string;
  size: number;
  color: string;
  quantity: number;
};
export type Coupon = { code: string; percent: number; active: boolean };
export const lineKey = (line: BagLine) =>
  `${line.productId}:${line.size}:${line.color}`;
export function addLine(
  lines: BagLine[],
  line: BagLine,
  stock: number,
): BagLine[] {
  const reserved = lines
    .filter((x) => x.productId === line.productId)
    .reduce((s, x) => s + x.quantity, 0);
  if (
    !Number.isInteger(line.quantity) ||
    line.quantity < 1 ||
    reserved + line.quantity > stock
  )
    throw new Error("stock");
  const existing = lines.find((x) => lineKey(x) === lineKey(line));
  return existing
    ? lines.map((x) =>
        lineKey(x) === lineKey(line)
          ? { ...x, quantity: x.quantity + line.quantity }
          : x,
      )
    : [...lines, { ...line }];
}
export type Currency = "USD" | "IDR";
export const USD_TO_IDR_FALLBACK = 15000;
export const SHIPPING_RATES: Record<
  Currency,
  { standard: number; express: number; freeAbove: number }
> = {
  USD: { standard: 15, express: 25, freeAbove: 250 },
  IDR: { standard: 25000, express: 50000, freeAbove: 2000000 },
};
export function itemPrice(
  item: Pick<Item, "price" | "priceIdr">,
  currency: Currency = "USD",
) {
  if (currency === "IDR") {
    return item.priceIdr && item.priceIdr > 0
      ? item.priceIdr
      : Math.round((item.price || 0) * USD_TO_IDR_FALLBACK);
  }
  return item.price || 0;
}
export function totals(
  lines: BagLine[],
  products: Item[],
  coupon?: Coupon,
  express = false,
  currency: Currency = "USD",
) {
  const rates = SHIPPING_RATES[currency];
  const subtotal = lines.reduce((s, l) => {
    const product = products.find((p) => p.id === l.productId);
    return s + (product ? itemPrice(product, currency) : 0) * l.quantity;
  }, 0);
  const percent = coupon?.active ? coupon.percent : 0;
  const discount =
    currency === "IDR"
      ? Math.round((subtotal * percent) / 100)
      : Math.round(subtotal * percent) / 100;
  const shipping =
    subtotal === 0
      ? 0
      : express
        ? rates.express
        : subtotal >= rates.freeAbove
          ? 0
          : rates.standard;
  const total =
    currency === "IDR"
      ? Math.round(subtotal - discount + shipping)
      : Math.round((subtotal - discount + shipping) * 100) / 100;
  return {
    subtotal,
    discount,
    shipping,
    total,
  };
}
export function validateBag(lines: BagLine[], products: Item[]) {
  if (!lines.length) return false;
  return lines.every((l) => {
    const p = products.find((x) => x.id === l.productId);
    const qty = lines
      .filter((x) => x.productId === l.productId)
      .reduce((s, x) => s + x.quantity, 0);
    return (
      p?.active &&
      p.stock >= qty &&
      Number.isInteger(l.quantity) &&
      l.quantity > 0 &&
      p.sizes.includes(l.size) &&
      p.colors.some((c) => c.name === l.color)
    );
  });
}

/** Approximate anatomical foot length (cm) for standard European (EU) shoe sizes. */
export function euFootCm(eu: number): string {
  return (22.5 + (eu - 36) * 0.65).toFixed(1);
}

const EU_US_EQUIV: Record<number, string> = {
  36: "W 6 / UK 3.5",
  37: "W 6.5 / UK 4",
  38: "W 7.5 / UK 5",
  39: "W 8.5 / M 6.5",
  40: "M 7.5 / UK 6.5",
  41: "M 8 / UK 7",
  42: "M 9 / UK 8",
  43: "M 10 / UK 9",
  44: "M 10.5 / UK 9.5",
  45: "M 11.5 / UK 10.5",
};

/** Equivalent US / UK sizing label for a European (EU) shoe size. */
export function euUsLabel(eu: number): string {
  return EU_US_EQUIV[eu] || `US ~${(eu - 33).toFixed(0)}`;
}
