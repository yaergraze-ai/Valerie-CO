import { createHash, timingSafeEqual } from "node:crypto";
export function verifyNotification(body, key) {
  if (
    !key ||
    typeof body.signature_key !== "string" ||
    !/^[a-f0-9]{128}$/i.test(body.signature_key)
  )
    return false;
  const expected = createHash("sha512")
    .update(`${body.order_id}${body.status_code}${body.gross_amount}${key}`)
    .digest();
  return timingSafeEqual(expected, Buffer.from(body.signature_key, "hex"));
}
export function paymentState(data) {
  if (
    data.transaction_status === "settlement" ||
    (data.transaction_status === "capture" && data.fraud_status === "accept")
  )
    return "paid";
  if (["deny", "cancel", "expire", "failure"].includes(data.transaction_status))
    return "failed";
  if (["refund", "partial_refund"].includes(data.transaction_status))
    return "refunded";
  return "pending";
}
export function midtransClient(key, production = false) {
  if (!key) return null;
  const app = production
    ? "https://app.midtrans.com"
    : "https://app.sandbox.midtrans.com";
  const api = production
    ? "https://api.midtrans.com"
    : "https://api.sandbox.midtrans.com";
  const request = async (url, body) => {
    const r = await fetch(url, {
      method: body ? "POST" : "GET",
      headers: {
        Authorization: `Basic ${Buffer.from(key + ":").toString("base64")}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15000),
    });
    const data = await r.json();
    if (!r.ok && r.status !== 404) throw Error("Midtrans request failed");
    return data;
  };
  return {
    create: async (order) => {
      const data = await request(app + "/snap/v1/transactions", {
        transaction_details: { order_id: order.id, gross_amount: order.total },
        customer_details: {
          first_name: order.address.name,
          email: order.email,
          phone: order.address.phone,
        },
        enabled_payments: [
          "qris",
          "bca_va",
          "bni_va",
          "bri_va",
          "permata_va",
          "echannel",
        ],
        expiry: { unit: "hours", duration: 24 },
      });
      if (!data.redirect_url || new URL(data.redirect_url).origin !== app)
        throw Error("Invalid payment URL");
      return data.redirect_url;
    },
    status: (id) => request(api + "/v2/" + encodeURIComponent(id) + "/status"),
    refund: (id, { amount, reason, refundKey }) =>
      request(api + "/v2/" + encodeURIComponent(id) + "/refund", {
        refund_key: refundKey,
        amount,
        reason,
      }),
  };
}
export function idrQuote(lines, products, coupon, express, shipping) {
  if (!Array.isArray(lines) || !lines.length || lines.length > 100)
    throw Error("Invalid bag");
  const items = lines.map((l) => {
    const p = products.find((p) => p.id === l.productId && p.active);
    if (!p || !Number.isSafeInteger(p.priceIdr) || p.priceIdr < 1)
      throw Error("Admin must set IDR prices for every product in this bag");
    if (!Number.isInteger(l.quantity) || l.quantity < 1 || l.quantity > 100)
      throw Error("Invalid quantity");
    return { ...l, price: p.priceIdr };
  });
  const subtotal = items.reduce((n, i) => n + i.price * i.quantity, 0);
  const discount = Math.round((subtotal * (coupon?.percent || 0)) / 100);
  const delivery = express
    ? shipping.express
    : subtotal >= shipping.freeAbove
      ? 0
      : shipping.standard;
  const total = subtotal - discount + delivery;
  if (!Number.isSafeInteger(total) || total < 1 || total > 999999999)
    throw Error("Invalid IDR amount");
  return {
    items,
    subtotal,
    discount,
    shipping: delivery,
    total,
    currency: "IDR",
  };
}
