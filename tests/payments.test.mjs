import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createApp } from "../server/app.mjs";
import {
  idrQuote,
  midtransClient,
  supportsCoreCharge,
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
      create: async (o) => {
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
});

test("Concurrent Midtrans webhooks and status checks serialize safely and deduplicate", async (t) => {
  let statusCalls = 0;
  let orderIdForRemote = "";
  const key = "test-race-server-key";
  const app = createApp({
    dbPath: ":memory:",
    setupToken: "setup",
    midtransKey: key,
    gateway: {
      create: async () => "https://app.sandbox.midtrans.com/snap/race-test",
      status: async (id) => {
        statusCalls++;
        await new Promise((r) => setTimeout(r, 15));
        return {
          order_id: orderIdForRemote || id,
          currency: "IDR",
          gross_amount: "125000.00",
          transaction_status: "settlement",
          payment_type: "qris",
          transaction_id: "tx-race-1",
        };
      },
      refund: async () => ({}),
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
  const sign = (payload) => ({
    ...payload,
    signature_key: createHash("sha512")
      .update(`${payload.order_id}${payload.status_code}${payload.gross_amount}${key}`)
      .digest("hex"),
  });

  const admin = await call("auth/setup", {
    name: "Admin",
    email: "admin-race@test.com",
    password: "test-password",
    setupToken: "setup",
  });
  const member = await call("auth/register", {
    name: "Member",
    email: "member-race@test.com",
    password: "test-password",
  });
  const p = { ...member.data.products[0], priceIdr: 100000 };
  const initialStock = p.stock;
  assert.equal(
    (await call("patch", { changes: [{ kind: "products", data: p }] }, admin.cookie))
      .status,
    200,
  );
  const created = await call(
    "orders/create",
    {
      payment: "midtrans",
      channel: "qris",
      expectedTotal: 125000,
      key: "race-order-key-1",
      lines: [
        {
          productId: p.id,
          quantity: 1,
          size: p.sizes[0],
          color: p.colors[0].name,
        },
      ],
      address: {
        id: "addr-race",
        label: "Home",
        name: "Member",
        phone: "08123456789",
        street: "Jl. Senopati 1",
        city: "Jakarta",
        postal: "12190",
      },
    },
    member.cookie,
  );
  assert.equal(created.status, 200);
  const orderId = created.data.order.id;
  orderIdForRemote = orderId;

  const nPending = sign({
    order_id: orderId,
    status_code: "201",
    gross_amount: "125000.00",
    transaction_status: "pending",
    transaction_id: "tx-race-1",
  });
  const nSettle = sign({
    order_id: orderId,
    status_code: "200",
    gross_amount: "125000.00",
    transaction_status: "settlement",
    transaction_id: "tx-race-1",
  });

  const concurrent = await Promise.all([
    call("payments/midtrans/notification", nPending),
    call("payments/midtrans/notification", nSettle),
    call("payments/midtrans/notification", nSettle),
    call("payments/status", { id: orderId }, member.cookie),
  ]);
  for (const res of concurrent) {
    assert.equal(res.status, 200);
  }

  const callsAfterBurst = statusCalls;
  const replay = await call("payments/midtrans/notification", nSettle);
  assert.equal(replay.status, 200);
  assert.equal(replay.data.duplicate, true);
  assert.equal(replay.data.queued, false);
  assert.equal(statusCalls, callsAfterBurst);

  const memberState = await call("state", null, member.cookie);
  assert.equal(memberState.data.paymentQueue, undefined);
  const settledOrder = memberState.data.orders.find((o) => o.id === orderId);
  assert.equal(settledOrder.payment.status, "paid");
  assert.equal(settledOrder.payment.transactionId, "tx-race-1");
  assert.equal(
    memberState.data.products.find((x) => x.id === p.id).stock,
    initialStock - 1,
  );

  const adminState = await call("state", null, admin.cookie);
  assert.ok(adminState.data.paymentQueue);
  assert.ok(adminState.data.paymentQueue.summary.done >= 1);
  assert.equal(adminState.data.paymentQueue.summary.failed, 0);
});

test("Transient gateway errors enter retry queue and recover on staff queue drain", async (t) => {
  let failGateway = true;
  const key = "test-retry-server-key";
  const app = createApp({
    dbPath: ":memory:",
    setupToken: "setup",
    midtransKey: key,
    gateway: {
      create: async () => "https://app.sandbox.midtrans.com/snap/retry-test",
      status: async (id) => {
        if (failGateway) {
          throw Object.assign(Error("Upstream 502 Bad Gateway"), { status: 502 });
        }
        return {
          order_id: id,
          currency: "IDR",
          gross_amount: "125000.00",
          transaction_status: "settlement",
          payment_type: "bca_va",
          transaction_id: "tx-retry-1",
        };
      },
      refund: async () => ({}),
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
    email: "admin-retry@test.com",
    password: "test-password",
    setupToken: "setup",
  });
  const member = await call("auth/register", {
    name: "Member",
    email: "member-retry@test.com",
    password: "test-password",
  });
  const p = { ...member.data.products[0], priceIdr: 100000 };
  const initialStock = p.stock;
  assert.equal(
    (await call("patch", { changes: [{ kind: "products", data: p }] }, admin.cookie))
      .status,
    200,
  );
  const created = await call(
    "orders/create",
    {
      payment: "midtrans",
      channel: "bca_va",
      expectedTotal: 125000,
      key: "retry-order-key-1",
      lines: [
        {
          productId: p.id,
          quantity: 1,
          size: p.sizes[0],
          color: p.colors[0].name,
        },
      ],
      address: {
        id: "addr-retry",
        label: "Home",
        name: "Member",
        phone: "08123456789",
        street: "Jl. Kemang 2",
        city: "Jakarta",
        postal: "12730",
      },
    },
    member.cookie,
  );
  assert.equal(created.status, 200);
  const orderId = created.data.order.id;

  const hookBody = {
    order_id: orderId,
    status_code: "200",
    gross_amount: "125000.00",
    transaction_status: "settlement",
    transaction_id: "tx-retry-1",
  };
  hookBody.signature_key = createHash("sha512")
    .update(`${hookBody.order_id}${hookBody.status_code}${hookBody.gross_amount}${key}`)
    .digest("hex");

  const queuedRes = await call("payments/midtrans/notification", hookBody);
  assert.equal(queuedRes.status, 200);
  assert.equal(queuedRes.data.queued, true);
  assert.equal(queuedRes.data.retried, 1);
  assert.equal(queuedRes.data.done, 0);

  const midState = await call("state", null, admin.cookie);
  assert.equal(midState.data.paymentQueue.summary.pending, 1);
  assert.equal(midState.data.paymentQueue.items[0].attempts, 1);
  assert.match(midState.data.paymentQueue.items[0].lastError, /502/);
  assert.equal(
    midState.data.orders.find((o) => o.id === orderId).payment.status,
    "pending",
  );

  // Member cannot drain admin callback queue
  assert.equal(
    (await call("payments/queue/drain", { orderId, force: true }, member.cookie))
      .status,
    403,
  );

  // Gateway recovers and staff drains the queued job
  failGateway = false;
  const drainRes = await call(
    "payments/queue/drain",
    { orderId, force: true },
    admin.cookie,
  );
  assert.equal(drainRes.status, 200);
  assert.equal(drainRes.data.done, 1);
  assert.equal(drainRes.data.retried, 0);
  assert.equal(drainRes.data.queue.summary.pending, 0);
  assert.equal(drainRes.data.queue.summary.done, 1);

  const finalState = await call("state", null, member.cookie);
  const paidOrder = finalState.data.orders.find((o) => o.id === orderId);
  assert.equal(paidOrder.payment.status, "paid");
  assert.equal(paidOrder.payment.method, "bca_va");
  assert.equal(
    finalState.data.products.find((x) => x.id === p.id).stock,
    initialStock - 1,
  );
});

test("Midtrans Core API direct charge populates custom checkout data and falls back to Snap", async (t) => {
  assert.equal(supportsCoreCharge("qris"), true);
  assert.equal(supportsCoreCharge("bca_va"), true);
  assert.equal(supportsCoreCharge("mandiri_va"), true);
  assert.equal(supportsCoreCharge("indomaret"), true);
  assert.equal(supportsCoreCharge("card"), false);
  assert.equal(supportsCoreCharge("kredivo"), false);

  const origFetch = globalThis.fetch;
  const recordedRequests = [];
  t.after(() => {
    globalThis.fetch = origFetch;
  });
  globalThis.fetch = async (url, init) => {
    const body = init?.body ? JSON.parse(init.body) : null;
    recordedRequests.push({ url: String(url), body });
    if (String(url).endsWith("/v2/charge")) {
      if (body.payment_type === "qris") {
        return new Response(
          JSON.stringify({
            status_code: "201",
            status_message: "Success, QRIS transaction is created",
            transaction_id: "core-qris-1",
            payment_type: "qris",
            qr_string: "00020101021226660014ID.CO.GOPAY.WWW0215",
            expiry_time: "2026-11-15 18:00:00",
            actions: [
              {
                name: "generate-qr-code",
                method: "GET",
                url: "https://api.sandbox.midtrans.com/v2/qris/core-qris-1/qr-code",
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (body.payment_type === "echannel") {
        return new Response(
          JSON.stringify({
            status_code: "201",
            status_message: "Success, Mandiri Bill transaction is created",
            transaction_id: "core-mandiri-1",
            payment_type: "echannel",
            biller_code: "70012",
            bill_key: "990011223344",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({
          status_code: "201",
          status_message: "Success, Bank Transfer transaction is created",
          transaction_id: "core-va-1",
          payment_type: "bank_transfer",
          va_numbers: [{ bank: "bca", va_number: "12345678901" }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    return new Response(
      JSON.stringify({
        redirect_url: "https://app.sandbox.midtrans.com/snap/v4/redirection/snap-tok",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };

  const client = midtransClient("SB-Mid-server-unit", false);
  const sampleOrder = {
    id: "ORD-CORE-1",
    receiptNumber: "VCO-INV-CORE1",
    total: 125000,
    shipping: 25000,
    discount: 0,
    email: "buyer@test.com",
    address: {
      name: "Budi",
      phone: "+628123",
      street: "Jl. Sudirman 10",
      city: "Jakarta",
      postal: "10220",
    },
    items: [{ productId: "p1", productCode: "VCO-01", name: "Derby", size: 42, price: 100000, quantity: 1 }],
    payment: { channel: "qris" },
  };
  const qrisCharge = await client.charge(sampleOrder, "qris");
  assert.equal(qrisCharge.channel, "qris");
  assert.equal(
    qrisCharge.qrUrl,
    "https://api.sandbox.midtrans.com/v2/qris/core-qris-1/qr-code",
  );
  assert.match(qrisCharge.qrString, /^000201/);
  const mandiriCharge = await client.charge(sampleOrder, "mandiri_va");
  assert.equal(mandiriCharge.billerCode, "70012");
  assert.equal(mandiriCharge.billKey, "990011223344");
  const snapUrl = await client.create(sampleOrder, {
    finishUrl: "https://www.valerie-co.my.id/#member",
  });
  assert.equal(
    snapUrl,
    "https://app.sandbox.midtrans.com/snap/v4/redirection/snap-tok",
  );
  const snapPayload = recordedRequests.at(-1).body;
  assert.deepEqual(snapPayload.enabled_payments, ["other_qris", "gopay"]);
  assert.equal(snapPayload.callbacks.finish, "https://www.valerie-co.my.id/#member");
  assert.equal(snapPayload.item_details.length, 2);

  // Restore real global fetch before starting local HTTP server
  globalThis.fetch = origFetch;

  let snapCreated = 0;
  let coreCharged = 0;
  let coreShouldFail = false;
  const key = "test-core-app-key";
  const app = createApp({
    dbPath: ":memory:",
    setupToken: "setup",
    midtransKey: key,
    gateway: {
      create: async () => {
        snapCreated++;
        return "https://app.sandbox.midtrans.com/snap/fallback-url";
      },
      charge: async (_order, channelId) => {
        coreCharged++;
        if (coreShouldFail) throw Error("Core API channel not activated");
        return {
          channel: channelId,
          paymentType: channelId === "bca_va" ? "bank_transfer" : "qris",
          transactionId: `core-${channelId}-99`,
          qrUrl:
            channelId === "qris"
              ? "https://api.sandbox.midtrans.com/v2/qris/99/qr-code"
              : "",
          deeplinkUrl: "",
          qrString: channelId === "qris" ? "000201010212..." : "",
          vaNumber: channelId === "bca_va" ? "77889900112" : "",
          bank: channelId === "bca_va" ? "bca" : "",
          billerCode: "",
          billKey: "",
          paymentCode: "",
          expiryTime: "",
          statusMessage: "Created",
        };
      },
      status: async () => ({}),
      refund: async () => ({}),
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
    email: "admin-core@test.com",
    password: "test-password",
    setupToken: "setup",
  });
  const member = await call("auth/register", {
    name: "Member",
    email: "member-core@test.com",
    password: "test-password",
  });
  const p = { ...member.data.products[0], priceIdr: 100000 };
  assert.equal(
    (await call("patch", { changes: [{ kind: "products", data: p }] }, admin.cookie))
      .status,
    200,
  );
  assert.equal(member.data.paymentConfig.coreApiEnabled, true);

  // Direct Core API on checkout (qris) -> populates directCharge without opening Snap
  const resQris = await call(
    "orders/create",
    {
      payment: "midtrans",
      channel: "qris",
      expectedTotal: 125000,
      key: "core-key-qris",
      lines: [
        {
          productId: p.id,
          quantity: 1,
          size: p.sizes[0],
          color: p.colors[0].name,
        },
      ],
      address: {
        id: "addr-core-1",
        label: "Home",
        name: "Member",
        phone: "08123456789",
        street: "Jl. Senopati 3",
        city: "Jakarta",
        postal: "12190",
      },
    },
    member.cookie,
  );
  assert.equal(resQris.status, 200);
  assert.equal(coreCharged, 1);
  assert.equal(snapCreated, 0);
  assert.equal(
    resQris.data.order.payment.directCharge.qrUrl,
    "https://api.sandbox.midtrans.com/v2/qris/99/qr-code",
  );

  // Core API failure seamlessly falls back to customized Snap URL
  coreShouldFail = true;
  const resFallback = await call(
    "orders/create",
    {
      payment: "midtrans",
      channel: "bca_va",
      expectedTotal: 125000,
      key: "core-key-fallback",
      lines: [
        {
          productId: p.id,
          quantity: 1,
          size: p.sizes[0],
          color: p.colors[0].name,
        },
      ],
      address: {
        id: "addr-core-2",
        label: "Home",
        name: "Member",
        phone: "08123456789",
        street: "Jl. Senopati 3",
        city: "Jakarta",
        postal: "12190",
      },
    },
    member.cookie,
  );
  assert.equal(resFallback.status, 200);
  assert.equal(snapCreated, 1);
  assert.equal(
    resFallback.data.order.payment.url,
    "https://app.sandbox.midtrans.com/snap/fallback-url",
  );
  assert.equal(resFallback.data.order.payment.directCharge, undefined);

  // Once Core API works again, member can upgrade that pending Snap order via /api/payments/charge
  coreShouldFail = false;
  const upgraded = await call(
    "payments/charge",
    { id: resFallback.data.order.id, channel: "bca_va" },
    member.cookie,
  );
  assert.equal(upgraded.status, 200);
  assert.equal(upgraded.data.order.payment.directCharge.vaNumber, "77889900112");
  assert.equal(upgraded.data.order.payment.directCharge.channel, "bca_va");
});
