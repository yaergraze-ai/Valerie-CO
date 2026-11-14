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
const SNAP_ENABLED_MAP = {
  qris: ["other_qris", "gopay"],
  gopay: ["gopay"],
  ovo: ["other_qris", "gopay"],
  shopeepay: ["shopeepay"],
  dana: ["dana", "other_qris"],
  linkaja: ["linkaja", "other_qris"],
  bca_va: ["bca_va"],
  mandiri_va: ["echannel"],
  bni_va: ["bni_va"],
  bri_va: ["bri_va"],
  bsi_va: ["bsi_va"],
  permata_va: ["permata_va"],
  cimb_va: ["cimb_va"],
  danamon_va: ["danamon_va"],
  card: ["credit_card"],
  indomaret: ["indomaret"],
  alfamart: ["alfamart"],
  kredivo: ["kredivo"],
  akulaku: ["akulaku"],
  indodana: ["indodana"],
};

const CORE_CHARGE_BUILDERS = {
  qris: () => ({ payment_type: "qris", qris: { acquirer: "gopay" } }),
  gopay: (order, finishUrl) => ({
    payment_type: "gopay",
    gopay: {
      enable_callback: true,
      ...(finishUrl ? { callback_url: finishUrl } : {}),
    },
  }),
  shopeepay: (order, finishUrl) => ({
    payment_type: "shopeepay",
    shopeepay: {
      ...(finishUrl ? { callback_url: finishUrl } : {}),
    },
  }),
  bca_va: () => ({ payment_type: "bank_transfer", bank_transfer: { bank: "bca" } }),
  bni_va: () => ({ payment_type: "bank_transfer", bank_transfer: { bank: "bni" } }),
  bri_va: () => ({ payment_type: "bank_transfer", bank_transfer: { bank: "bri" } }),
  cimb_va: () => ({ payment_type: "bank_transfer", bank_transfer: { bank: "cimb" } }),
  permata_va: () => ({ payment_type: "bank_transfer", bank_transfer: { bank: "permata" } }),
  mandiri_va: (order) => ({
    payment_type: "echannel",
    echannel: {
      bill_info1: "Valerie & CO",
      bill_info2: String(order.receiptNumber || order.id).slice(0, 30),
    },
  }),
  indomaret: (order) => ({
    payment_type: "cstore",
    cstore: {
      store: "indomaret",
      message: `Valerie & CO ${String(order.receiptNumber || order.id).slice(0, 18)}`,
    },
  }),
  alfamart: () => ({
    payment_type: "cstore",
    cstore: {
      store: "alfamart",
      message: "Valerie & CO Order",
    },
  }),
};

export function supportsCoreCharge(channelId) {
  return Boolean(channelId && CORE_CHARGE_BUILDERS[channelId]);
}

function buildItemDetails(order) {
  const details = (order.items || []).map((item, idx) => ({
    id: String(item.productCode || item.productId || `ITEM-${idx + 1}`).slice(0, 50),
    price: Math.round(Number(item.price || 0)),
    quantity: Math.round(Number(item.quantity || 1)),
    name: `${item.name}${item.size ? ` (${item.size})` : ""}`.slice(0, 50),
  }));
  if (Number(order.shipping) > 0) {
    details.push({
      id: "SHIPPING",
      price: Math.round(Number(order.shipping)),
      quantity: 1,
      name: "Shipping / Pengiriman Atelier",
    });
  }
  if (Number(order.discount) > 0) {
    details.push({
      id: "DISCOUNT",
      price: -Math.round(Number(order.discount)),
      quantity: 1,
      name: "Promo / Diskon Valerie & CO",
    });
  }
  const sum = details.reduce((n, d) => n + d.price * d.quantity, 0);
  return sum === Math.round(Number(order.total)) ? details : undefined;
}

function safeActionUrl(raw, allowedPrefixes) {
  if (typeof raw !== "string" || !raw.trim()) return "";
  const val = raw.trim();
  if (allowedPrefixes.some((p) => val.startsWith(p))) return val;
  return "";
}

function extractDirectCharge(data, channelId, apiOrigin) {
  const actions = Array.isArray(data.actions) ? data.actions : [];
  const qrAction = actions.find((a) => a?.name === "generate-qr-code")?.url;
  const deeplinkAction = actions.find((a) => a?.name === "deeplink-redirect")?.url;
  return {
    channel: channelId,
    paymentType: String(data.payment_type || ""),
    transactionId: String(data.transaction_id || ""),
    qrUrl: safeActionUrl(qrAction, [apiOrigin + "/"]),
    deeplinkUrl: safeActionUrl(deeplinkAction, ["https://", "gojek://", "shopeeid://"]),
    qrString: typeof data.qr_string === "string" ? data.qr_string : "",
    vaNumber: String(
      data.va_numbers?.[0]?.va_number || data.permata_va_number || "",
    ),
    bank: String(
      data.va_numbers?.[0]?.bank || (channelId === "permata_va" ? "permata" : ""),
    ),
    billerCode: String(data.biller_code || ""),
    billKey: String(data.bill_key || ""),
    paymentCode: String(data.payment_code || ""),
    expiryTime: String(data.expiry_time || ""),
    statusMessage: String(data.status_message || ""),
  };
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
    if (!r.ok && r.status !== 404) {
      throw Object.assign(
        Error(data?.status_message || "Midtrans request failed"),
        { gatewayStatus: r.status, gatewayData: data },
      );
    }
    return data;
  };
  return {
    create: async (order, { finishUrl = "" } = {}) => {
      const channel = order.payment?.channel;
      const enabledPayments = channel ? SNAP_ENABLED_MAP[channel] : undefined;
      const itemDetails = buildItemDetails(order);
      const safeFinish =
        typeof finishUrl === "string" && finishUrl.startsWith("https://")
          ? finishUrl
          : "";
      const data = await request(app + "/snap/v1/transactions", {
        transaction_details: { order_id: order.id, gross_amount: order.total },
        customer_details: {
          first_name: order.address.name,
          email: order.email,
          phone: order.address.phone,
          shipping_address: {
            first_name: order.address.name,
            phone: order.address.phone,
            address: order.address.street,
            city: order.address.city,
            postal_code: order.address.postal,
            country_code: "IDN",
          },
        },
        ...(itemDetails ? { item_details: itemDetails } : {}),
        ...(enabledPayments ? { enabled_payments: enabledPayments } : {}),
        ...(safeFinish ? { callbacks: { finish: safeFinish } } : {}),
        credit_card: { secure: true },
        expiry: { unit: "hours", duration: 24 },
      });
      if (!data.redirect_url || new URL(data.redirect_url).origin !== app)
        throw Error("Invalid payment URL");
      return data.redirect_url;
    },
    charge: async (order, channelId, { finishUrl = "" } = {}) => {
      const builder = CORE_CHARGE_BUILDERS[channelId];
      if (!builder) throw Error("Channel uses Snap gateway");
      const itemDetails = buildItemDetails(order);
      const safeFinish =
        typeof finishUrl === "string" && finishUrl.startsWith("https://")
          ? finishUrl
          : "";
      const channelPayload = builder(order, safeFinish);
      const data = await request(api + "/v2/charge", {
        ...channelPayload,
        transaction_details: { order_id: order.id, gross_amount: order.total },
        customer_details: {
          first_name: order.address.name,
          email: order.email,
          phone: order.address.phone,
        },
        ...(itemDetails ? { item_details: itemDetails } : {}),
        custom_expiry: { expiry_duration: 24, unit: "hour" },
      });
      const code = Number(data.status_code || 0);
      if (code >= 400) {
        throw Object.assign(
          Error(data.status_message || "Midtrans direct charge unavailable"),
          { gatewayStatus: code, gatewayData: data },
        );
      }
      return extractDirectCharge(data, channelId, api);
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
