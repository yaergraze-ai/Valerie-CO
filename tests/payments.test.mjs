import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createApp } from "../server/app.mjs";
import {
  extractSnapToken,
  idrQuote,
  verifyNotification,
} from "../server/midtrans.mjs";
test("IDR quote rejects missing prices and preserves rupiah integer totals", () => {
  const lines = [{ productId: "p", quantity: 3 }];
  const shipping = { standard: 25000, express: 50000, freeAbove: 2000000 };
  assert.throws(() =>
    idrQuote(lines, [{ id: "p", active: true }], null, false, shipping),
  );
  assert.equal(
    idrQuote(
      lines,
      [{ id: "p", active: true, priceIdr: 100001 }],
      { percent: 10 },
      false,
      shipping,
    ).total,
    295003,
  );
  assert.equal(verifyNotification({ signature_key: "bad" }, "test"), false);
  assert.equal(
    extractSnapToken(
      "https://app.sandbox.midtrans.com/snap/v4/redirection/tok_abc123",
    ),
    "tok_abc123",
  );
  assert.equal(
    extractSnapToken("https://app.midtrans.com/snap/v2/vtweb/tok_live_999"),
    "tok_live_999",
  );
});
test("Midtrans reservations, signed notifications and payment ownership", async (t) => {
  let remote = {};
  let created = 0;
  const key = "test-only-server-key";
  const app = createApp({
    dbPath: ":memory:",
    setupToken: "setup",
    midtransKey: key,
    gateway: {
      create: async () => {
        created++;
        return "https://app.sandbox.midtrans.com/snap/test";
      },
      status: async () => remote,
      refund: async (id, payload) => ({
        transaction_id: `REF-${id}`,
        refund_chargeback_id: 9012,
        ...payload,
      }),
    },
  });
  await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
  t.after(() => app.close());
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const call = async (path, body, cookie = "") => {
    const r = await fetch(base + "/api/" + path, {
      method: body ? "POST" : "GET",
      headers: { "Content-Type": "application/json", cookie },
      body: body ? JSON.stringify(body) : undefined,
    });
    return {
      status: r.status,
      data: await r.json(),
      cookie: r.headers.get("set-cookie")?.split(";")[0] || "",
    };
  };
  const admin = await call("auth/setup", {
    name: "Admin",
    email: "admin@test.com",
    password: "test-password",
    setupToken: "setup",
  });
  const member = await call("auth/register", {
    name: "Member",
    email: "member@test.com",
    password: "test-password",
  });
  let p = member.data.products[0];
  p = { ...p, priceIdr: 100000 };
  assert.equal(
    (
      await call(
        "patch",
        { changes: [{ kind: "products", data: p }] },
        admin.cookie,
      )
    ).status,
    200,
  );
  const body = {
    payment: "midtrans",
    expectedTotal: 125000,
    key: "order-key-1",
    lines: [
      {
        productId: p.id,
        quantity: 1,
        size: p.sizes[0],
        color: p.colors[0].name,
      },
    ],
    address: {
      id: "address",
      label: "Home",
      name: "Member",
      phone: "08123456789",
      street: "Test street 10",
      city: "Bandung",
      postal: "12345",
    },
  };
  assert.equal(
    (await call("orders/create", { ...body, expectedTotal: 1 }, member.cookie))
      .status,
    409,
  );
  assert.equal(
    (await call("state")).data.products.find((x) => x.id === p.id).stock,
    p.stock,
  );
  const result = await call("orders/create", body, member.cookie);
  assert.equal(result.status, 200);
  const o = result.data.order;
  assert.equal(o.currency, "IDR");
  assert.equal(o.total, 125000);
  assert.equal(o.payment.status, "pending");
  assert.equal(
    (await call("orders/create", body, member.cookie)).data.order.id,
    o.id,
  );
  assert.equal(created, 1);
  assert.equal(
    (
      await call(
        "orders/update",
        { id: o.id, status: "shipped", tracking: "TRACK" },
        admin.cookie,
      )
    ).status,
    409,
  );
  assert.equal((await call("payments/status", { id: o.id })).status, 401);
  const notify = async (status, amount = "125000.00") => {
    const b = {
      order_id: o.id,
      status_code: "200",
      gross_amount: amount,
      transaction_status: status,
    };
    b.signature_key = createHash("sha512")
      .update(b.order_id + b.status_code + b.gross_amount + key)
      .digest("hex");
    return call("payments/midtrans/notification", b);
  };
  assert.equal(
    (
      await call("payments/midtrans/notification", {
        order_id: o.id,
        signature_key: "fake",
      })
    ).status,
    403,
  );
  remote = {
    order_id: o.id,
    currency: "IDR",
    gross_amount: "1.00",
    transaction_status: "settlement",
  };
  assert.equal((await notify("settlement")).status, 409);
  remote = {
    ...remote,
    gross_amount: "125000.00",
    transaction_status: "expire",
  };
  assert.equal((await notify("expire")).status, 200);
  assert.equal((await notify("expire")).status, 200);
  assert.equal(
    (await call("state")).data.products.find((x) => x.id === p.id).stock,
    p.stock,
  );
  const paid = await call(
    "orders/create",
    { ...body, key: "order-key-2" },
    member.cookie,
  );
  remote = {
    ...remote,
    order_id: paid.data.order.id,
    transaction_status: "settlement",
  };
  assert.equal(
    (await call("payments/status", { id: remote.order_id }, member.cookie))
      .status,
    200,
  );
  assert.equal(
    (await call("state", undefined, member.cookie)).data.orders.find(
      (x) => x.id === remote.order_id,
    ).payment.status,
    "paid",
  );
  remote.transaction_status = "pending";
  await call("payments/status", { id: remote.order_id }, member.cookie);
  assert.equal(
    (await call("state", undefined, member.cookie)).data.orders.find(
      (x) => x.id === remote.order_id,
    ).payment.status,
    "paid",
  );
  assert.equal(
    (
      await call(
        "orders/update",
        { id: remote.order_id, status: "shipped", tracking: "TRACK" },
        admin.cookie,
      )
    ).status,
    200,
  );
  // Purchase trail: verify receipt number + product SKU snapshot on paid order
  const paidOrder = (await call("state", undefined, member.cookie)).data.orders.find(
    (x) => x.id === remote.order_id,
  );
  assert.ok(paidOrder.receiptNumber?.startsWith("VCO-INV-"));
  assert.equal(paidOrder.items[0].productCode, p.details?.code || p.id.toUpperCase());

  // Product upload with auto-SKU details persists through /api/patch
  const uploadedProduct = {
    ...p,
    id: "vco-atelier-boot-016",
    name: "Atelier Lug Boot",
    priceIdr: 250000,
    details: {
      code: "VCO-BT-016",
      origin: "Crafted in Valerie & CO Atelier",
      composition: { id: "Kulit penuh", en: "Full-grain leather" },
      sole: { id: "Sol Vibram", en: "Vibram sole" },
    },
  };
  assert.equal(
    (
      await call(
        "patch",
        { changes: [{ kind: "products", data: uploadedProduct }] },
        admin.cookie,
      )
    ).status,
    200,
  );
  const fetchedUploaded = (await call("state")).data.products.find(
    (x) => x.id === "vco-atelier-boot-016",
  );
  assert.equal(fetchedUploaded.details.code, "VCO-BT-016");

  // Refund workflow: member requests refund, admin approves & restores stock once
  assert.equal(
    (
      await call(
        "orders/refund",
        { id: paidOrder.id, reason: "Wrong EU size", action: "request" },
        member.cookie,
      )
    ).status,
    200,
  );
  const stockBeforeRefund = (await call("state")).data.products.find(
    (x) => x.id === p.id,
  ).stock;
  const approved = await call(
    "orders/refund",
    { id: paidOrder.id, reason: "Approved per receipt", action: "approve" },
    admin.cookie,
  );
  assert.equal(approved.status, 200);
  const refundedOrder = approved.data.orders.find((x) => x.id === paidOrder.id);
  assert.equal(refundedOrder.payment.status, "refunded");
  assert.equal(refundedOrder.status, "cancelled");
  assert.equal(refundedOrder.refund.status, "refunded");
  assert.equal(
    approved.data.products.find((x) => x.id === p.id).stock,
    stockBeforeRefund + 1,
  );
  // Idempotent: second refund attempt or Midtrans refund webhook must not double-restore stock
  assert.equal(
    (
      await call(
        "orders/refund",
        { id: paidOrder.id, reason: "Duplicate attempt", action: "approve" },
        admin.cookie,
      )
    ).status,
    409,
  );
  remote = {
    order_id: paidOrder.id,
    currency: "IDR",
    gross_amount: "125000.00",
    transaction_status: "refund",
  };
  const bRefund = {
    order_id: paidOrder.id,
    status_code: "200",
    gross_amount: "125000.00",
    transaction_status: "refund",
  };
  bRefund.signature_key = createHash("sha512")
    .update(bRefund.order_id + bRefund.status_code + bRefund.gross_amount + key)
    .digest("hex");
  assert.equal(
    (await call("payments/midtrans/notification", bRefund)).status,
    200,
  );
  assert.equal(
    (await call("state")).data.products.find((x) => x.id === p.id).stock,
    stockBeforeRefund + 1,
  );
  assert.equal(
    approved.data.paymentConfig.snapScriptUrl,
    "https://app.sandbox.midtrans.com/snap/snap.js",
  );
});

test("Midtrans createSnap persists snapToken & payments/status leaves single creation idempotent", async (t) => {
  let createCalls = 0;
  const app = createApp({
    dbPath: ":memory:",
    setupToken: "setup",
    midtransKey: "snap-test-key",
    gateway: {
      createSnap: async () => {
        createCalls += 1;
        return {
          token: "snap-token-xyz-789",
          redirectUrl:
            "https://app.sandbox.midtrans.com/snap/v4/redirection/snap-token-xyz-789",
        };
      },
      create: async () =>
        "https://app.sandbox.midtrans.com/snap/v4/redirection/snap-token-xyz-789",
      status: async (id) => ({
        order_id: id,
        status_code: "404",
      }),
    },
  });
  await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
  t.after(() => app.close());
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const call = async (path, body, cookie = "") => {
    const r = await fetch(base + "/api/" + path, {
      method: body ? "POST" : "GET",
      headers: { "Content-Type": "application/json", cookie },
      body: body ? JSON.stringify(body) : undefined,
    });
    return {
      status: r.status,
      data: await r.json(),
      cookie: r.headers.get("set-cookie")?.split(";")[0] || "",
    };
  };
  const admin = await call("auth/setup", {
    name: "Admin",
    email: "atelier@solere.com",
    password: "password123",
    token: "setup",
  });
  const products = (await call("state")).data.products;
  const p = { ...products[0], priceIdr: 200000, stock: 5 };
  await call("patch", { changes: [{ kind: "products", data: p }] }, admin.cookie);
  const member = await call("auth/register", {
    email: "snapmember@example.com",
    password: "password123",
    name: "Snap Member",
  });
  const lines = [
    {
      productId: p.id,
      quantity: 1,
      size: p.sizes[0],
      color: p.colors[0].name,
    },
  ];
  const quote = await call("payments/quote", { lines, express: false }, member.cookie);
  assert.equal(quote.status, 200);
  const created = await call(
    "orders/create",
    {
      payment: "midtrans",
      expectedTotal: quote.data.total,
      key: "snap-key-1",
      lines,
      address: {
        id: "addr-1",
        label: "Home",
        name: "Snap Member",
        phone: "0812888999",
        street: "Jl. Senopati 10",
        city: "Jakarta",
        postal: "12190",
      },
    },
    member.cookie,
  );
  assert.equal(created.status, 200);
  assert.equal(created.data.order.payment.snapToken, "snap-token-xyz-789");
  const statusSync = await call(
    "payments/status",
    { id: created.data.order.id },
    member.cookie,
  );
  assert.equal(statusSync.status, 200);
  assert.equal(createCalls, 1);
});
