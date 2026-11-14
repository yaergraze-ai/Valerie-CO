import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../server/app.mjs";
import { createSupabaseStore } from "../server/db-supabase.mjs";

function makeFakeSupabaseClient({ schemaReady = true } = {}) {
  let seqCounter = 0;
  const tables = new Map([
    ["app_users", []],
    ["app_sessions", []],
    ["google_accounts", []],
    ["recovery_tokens", []],
    ["verification_codes", []],
    ["google_challenges", []],
    ["products", []],
    ["members", []],
    ["orders", []],
    ["checkout_keys", []],
    ["coupons", []],
    ["tickets", []],
    ["subscribers", []],
    ["store_settings", []],
    ["app_meta", []],
  ]);

  const conflictKey = {
    app_users: "id",
    app_sessions: "token",
    google_accounts: "sub",
    recovery_tokens: "token",
    verification_codes: "key",
    google_challenges: "nonce",
    products: "id",
    members: "id",
    orders: "id",
    coupons: "code",
    tickets: "id",
    subscribers: "email",
    store_settings: "id",
    app_meta: "id",
  };

  function makeQuery(table) {
    const ops = [];
    let mode = "select";
    let selectCols = "*";
    let payload = null;
    let orderCol = null;
    let ascending = true;
    let limitN = null;
    let rangeBounds = null;
    let singleMode = null;

    const execute = () => {
      if (!schemaReady) {
        return {
          data: null,
          error: {
            code: "PGRST205",
            message: `Could not find the table 'public.${table}' in the schema cache`,
          },
        };
      }
      const rows = tables.get(table);
      const matches = (row) => ops.every((fn) => fn(row));

      if (mode === "insert") {
        const list = Array.isArray(payload) ? payload : [payload];
        for (const item of list) {
          const pk = conflictKey[table];
          if (pk && rows.some((r) => r[pk] === item[pk])) {
            return { data: null, error: { code: "23505", message: "Duplicate" } };
          }
          rows.push({ ...structuredClone(item), seq: ++seqCounter });
        }
        return { data: list, error: null };
      }

      if (mode === "upsert") {
        const list = Array.isArray(payload) ? payload : [payload];
        const pk = conflictKey[table];
        for (const item of list) {
          const idx = rows.findIndex((r) => r[pk] === item[pk]);
          if (idx >= 0) {
            rows[idx] = { ...rows[idx], ...structuredClone(item) };
          } else {
            rows.push({ ...structuredClone(item), seq: ++seqCounter });
          }
        }
        return { data: list, error: null };
      }

      if (mode === "delete") {
        const kept = rows.filter((r) => !matches(r));
        tables.set(table, kept);
        return { data: null, error: null };
      }

      if (mode === "update") {
        for (let i = 0; i < rows.length; i++) {
          if (matches(rows[i])) {
            rows[i] = { ...rows[i], ...structuredClone(payload) };
          }
        }
        return { data: null, error: null };
      }

      let filtered = rows.filter(matches).map((r) => {
        const copy = structuredClone(r);
        if (table === "app_sessions" && selectCols.includes("app_users")) {
          const user = tables.get("app_users").find((u) => u.id === r.user_id) || null;
          copy.app_users = user
            ? { id: user.id, email: user.email, role: user.role }
            : null;
        }
        return copy;
      });
      if (orderCol) {
        filtered.sort((a, b) =>
          ascending
            ? (a[orderCol] ?? 0) - (b[orderCol] ?? 0)
            : (b[orderCol] ?? 0) - (a[orderCol] ?? 0),
        );
      }
      if (rangeBounds) {
        filtered = filtered.slice(rangeBounds[0], rangeBounds[1] + 1);
      }
      if (limitN !== null) {
        filtered = filtered.slice(0, limitN);
      }
      if (singleMode === "maybeSingle") {
        return { data: filtered[0] ?? null, error: null };
      }
      return { data: filtered, error: null };
    };

    const builder = {
      select(cols = "*") {
        selectCols = cols;
        return builder;
      },
      insert(data) {
        mode = "insert";
        payload = data;
        return builder;
      },
      upsert(data) {
        mode = "upsert";
        payload = data;
        return builder;
      },
      update(data) {
        mode = "update";
        payload = data;
        return builder;
      },
      delete() {
        mode = "delete";
        return builder;
      },
      eq(col, val) {
        ops.push((r) => r[col] === val);
        return builder;
      },
      neq(col, val) {
        ops.push((r) => r[col] !== val);
        return builder;
      },
      gt(col, val) {
        ops.push((r) => r[col] > val);
        return builder;
      },
      lt(col, val) {
        ops.push((r) => r[col] < val);
        return builder;
      },
      order(col, { ascending: asc = true } = {}) {
        orderCol = col;
        ascending = asc;
        return builder;
      },
      range(from, to) {
        rangeBounds = [from, to];
        return builder;
      },
      limit(n) {
        limitN = n;
        return builder;
      },
      maybeSingle() {
        singleMode = "maybeSingle";
        return builder;
      },
      then(resolve, reject) {
        return Promise.resolve(execute()).then(resolve, reject);
      },
    };
    return builder;
  }

  return {
    setSchemaReady(next) {
      schemaReady = next;
    },
    tables,
    from(table) {
      return makeQuery(table);
    },
    async rpc(fn, params) {
      if (!schemaReady) {
        return {
          data: null,
          error: { code: "PGRST205", message: `Could not find function public.${fn}` },
        };
      }
      if (fn === "vco_create_user_tx") {
        const users = tables.get("app_users");
        if (users.some((u) => u.id === params.p_id || u.email === params.p_email)) {
          return { data: null, error: { code: "23505", message: "Duplicate user" } };
        }
        users.push({
          id: params.p_id,
          email: params.p_email,
          password_hash: params.p_password_hash,
          role: params.p_role,
          seq: ++seqCounter,
        });
        if (params.p_google_sub) {
          tables.get("google_accounts").push({
            sub: params.p_google_sub,
            user_id: params.p_id,
            seq: ++seqCounter,
          });
        }
        tables.get("members").push({
          id: params.p_id,
          email: params.p_email,
          phone: params.p_member.phone || "",
          name: params.p_member.name || "",
          data: structuredClone(params.p_member),
          seq: ++seqCounter,
        });
        return { data: null, error: null };
      }
      if (fn === "vco_consume_google_challenge") {
        const challenges = tables.get("google_challenges");
        const idx = challenges.findIndex(
          (c) => c.nonce === params.p_nonce && c.expires_at > params.p_now,
        );
        if (idx < 0) return { data: false, error: null };
        challenges.splice(idx, 1);
        return { data: true, error: null };
      }
      if (fn === "vco_update_password_tx") {
        const u = tables.get("app_users").find((x) => x.id === params.p_user_id);
        if (u) u.password_hash = params.p_password_hash;
        tables.set(
          "app_sessions",
          tables.get("app_sessions").filter((s) => s.user_id !== params.p_user_id),
        );
        return { data: null, error: null };
      }
      if (fn === "vco_reset_password_tx") {
        const rec = tables.get("recovery_tokens");
        const idx = rec.findIndex(
          (r) => r.token === params.p_token && r.expires_at > params.p_now,
        );
        if (idx < 0) return { data: false, error: null };
        const userId = rec[idx].user_id;
        rec.splice(idx, 1);
        const u = tables.get("app_users").find((x) => x.id === userId);
        if (u) u.password_hash = params.p_password_hash;
        tables.set(
          "app_sessions",
          tables.get("app_sessions").filter((s) => s.user_id !== userId),
        );
        return { data: true, error: null };
      }
      if (fn === "vco_delete_product_tx") {
        tables.set(
          "products",
          tables.get("products").filter((p) => p.id !== params.p_product_id),
        );
        const s = tables.get("store_settings").find((x) => x.id === "main");
        if (s?.data?.homepage?.productIds) {
          s.data.homepage.productIds = s.data.homepage.productIds.filter(
            (id) => id !== params.p_product_id,
          );
        }
        return { data: null, error: null };
      }
      if (fn === "vco_create_order_tx") {
        const ck = tables.get("checkout_keys");
        const existingKey = ck.find(
          (k) => k.user_id === params.p_user_id && k.key === params.p_key,
        );
        if (existingKey) {
          const existingOrder = tables
            .get("orders")
            .find((o) => o.id === existingKey.order_id);
          return {
            data: { duplicate: true, order: existingOrder.data },
            error: null,
          };
        }
        const needed = new Map();
        for (const item of params.p_order.items) {
          needed.set(item.productId, (needed.get(item.productId) || 0) + item.quantity);
        }
        const prods = tables.get("products");
        for (const [id, qty] of needed) {
          const row = prods.find((p) => p.id === id);
          if (!row || !row.active) {
            return { data: null, error: { code: "P0002", message: "A product is unavailable" } };
          }
          if (row.stock < qty) {
            return { data: null, error: { code: "P0001", message: "Insufficient stock" } };
          }
        }
        for (const [id, qty] of needed) {
          const row = prods.find((p) => p.id === id);
          row.stock -= qty;
          row.data.stock = row.stock;
        }
        tables.get("orders").push({
          id: params.p_order.id,
          member_id: params.p_order.memberId,
          status: params.p_order.status,
          currency: params.p_order.currency,
          total: params.p_order.total,
          payment_method: params.p_order.paymentMethod,
          payment_status: params.p_order.payment?.status || null,
          data: structuredClone(params.p_order),
          seq: ++seqCounter,
        });
        ck.push({
          user_id: params.p_user_id,
          key: params.p_key,
          order_id: params.p_order.id,
          seq: ++seqCounter,
        });
        return { data: { duplicate: false, order: params.p_order }, error: null };
      }
      if (fn === "vco_transition_order_tx") {
        const ord = tables.get("orders").find((o) => o.id === params.p_order_id);
        if (!ord) {
          return { data: null, error: { code: "P0002", message: "Order not found" } };
        }
        if (
          (params.p_expected_status !== null &&
            ord.status !== params.p_expected_status) ||
          (params.p_expected_payment_status !== null &&
            (ord.payment_status || "") !== params.p_expected_payment_status)
        ) {
          return {
            data: null,
            error: { code: "P0003", message: "Order state changed concurrently" },
          };
        }
        if (params.p_restore_stock) {
          for (const item of params.p_next_order.items) {
            const p = tables.get("products").find((x) => x.id === item.productId);
            if (p) {
              p.stock += item.quantity;
              p.data.stock = p.stock;
            }
          }
        }
        ord.status = params.p_next_order.status;
        ord.payment_status = params.p_next_order.payment?.status || null;
        ord.data = structuredClone(params.p_next_order);
        return { data: params.p_next_order, error: null };
      }
      throw new Error(`Unexpected RPC ${fn}`);
    },
  };
}

test("Supabase store adapter handles missing schema recovery, auth, seeding, IDR checkout and atomic stock", async (t) => {
  const client = makeFakeSupabaseClient({ schemaReady: false });
  const store = createSupabaseStore({ client });
  const app = createApp({
    store,
    setupToken: "supa-setup-token",
    googleClientId: "test-google-client",
    verifyGoogleToken: async (tok) => JSON.parse(tok),
  });
  await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
  t.after(() => app.close());

  const base = `http://127.0.0.1:${app.server.address().port}`;
  const call = async (path, body, cookie = "") => {
    const r = await fetch(base + "/api/" + path, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return {
      status: r.status,
      data: await r.json(),
      cookie: r.headers.get("set-cookie")?.split(";")[0] || "",
    };
  };

  // Unmigrated schema returns 503 safely and recovers automatically once migration runs
  const beforeSql = await call("state");
  assert.equal(beforeSql.status, 503);
  assert.match(beforeSql.data.error, /Supabase schema not initialized/);

  client.setSchemaReady(true);
  const initial = await call("state");
  assert.equal(initial.status, 200);
  assert.equal(initial.data.backend, undefined);
  assert.equal(initial.data.products.length, 40);
  assert.equal(initial.data.needsAdmin, true);
  assert.equal(initial.data.products[0].id, "vco-zavira-espresso-ankle");

  // Setup admin & verify Supabase persistence
  const adminSetup = await call("auth/setup", {
    name: "Supabase Admin",
    email: "admin@valerieco.test",
    password: "supa-admin-password-1",
    setupToken: "supa-setup-token",
  });
  assert.equal(adminSetup.status, 200);
  assert.equal(adminSetup.data.currentUser.role, "admin");
  assert.equal(adminSetup.data.needsAdmin, false);

  // Google Sign-In challenge + atomic user creation
  const cfg = await call("auth/config");
  const googleRes = await call(
    "auth/google",
    {
      credential: JSON.stringify({
        sub: "supa-google-1",
        email: "buyer@valerieco.test",
        email_verified: true,
        name: "Buyer Supabase",
        nonce: cfg.data.nonce,
      }),
    },
    cfg.cookie,
  );
  assert.equal(googleRes.status, 200);
  assert.equal(googleRes.data.currentUser.role, "member");

  // Checkout in IDR decrements stock and is idempotent across retries
  const target = initial.data.products[0];
  const initialStock = target.stock;
  const key = "supa-idem-key-1";
  const checkoutPayload = {
    key,
    currency: "IDR",
    code: "WELCOME10",
    express: false,
    lines: [
      {
        productId: target.id,
        size: target.sizes[0],
        color: target.colors[0].name,
        quantity: 2,
      },
    ],
    address: {
      id: "addr-1",
      label: "Rumah",
      name: "Buyer Supabase",
      phone: "081234567890",
      street: "Jl. Kemang Raya No. 8",
      city: "Jakarta",
      postal: "12730",
    },
  };
  const order1 = await call("orders/create", checkoutPayload, googleRes.cookie);
  assert.equal(order1.status, 200);
  assert.equal(order1.data.order.currency, "IDR");
  assert.equal(
    order1.data.state.products.find((p) => p.id === target.id).stock,
    initialStock - 2,
  );

  const orderRetry = await call("orders/create", checkoutPayload, googleRes.cookie);
  assert.equal(orderRetry.status, 200);
  assert.equal(orderRetry.data.order.id, order1.data.order.id);
  assert.equal(
    orderRetry.data.state.products.find((p) => p.id === target.id).stock,
    initialStock - 2,
  );

  // Cancelling order restores stock atomically once
  const cancelled = await call(
    "orders/update",
    { id: order1.data.order.id, status: "cancelled" },
    googleRes.cookie,
  );
  assert.equal(cancelled.status, 200);
  assert.equal(
    cancelled.data.products.find((p) => p.id === target.id).stock,
    initialStock,
  );

  // Batch patch: pin a product on homepage then delete it -> cleans homepage list
  const s = adminSetup.data.settings;
  const pinned = await call(
    "patch",
    {
      changes: [
        {
          kind: "settings",
          data: {
            ...s,
            homepage: { mode: "manual", productIds: [target.id] },
          },
        },
        { kind: "products_delete", data: { id: target.id } },
      ],
    },
    adminSetup.cookie,
  );
  assert.equal(pinned.status, 200);
  assert.equal(
    pinned.data.products.some((p) => p.id === target.id),
    false,
  );
  assert.deepEqual(pinned.data.settings.homepage.productIds, []);
});

test("Web Standard fetch handler supports Vercel __path rewrites, cookies, and origin enforcement", async () => {
  const client = makeFakeSupabaseClient({ schemaReady: true });
  const app = createApp({
    dbPath: ":memory:",
    setupToken: "vercel-fetch-token",
    secureCookie: true,
    store: createSupabaseStore({ client }),
  });
  try {
    const stateRes = await app.fetch(
      new Request("https://valerie.vercel.app/api/index?__path=state"),
    );
    assert.equal(stateRes.status, 200);
    assert.equal(stateRes.headers.get("x-frame-options"), "DENY");
    const stateData = await stateRes.json();
    assert.equal(stateData.products.length, 40);
    assert.equal(stateData.needsAdmin, true);

    const setupRes = await app.fetch(
      new Request("https://valerie.vercel.app/api/index?__path=auth/setup", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://valerie.vercel.app",
        },
        body: JSON.stringify({
          name: "Vercel Admin",
          email: "admin@valerieco.id",
          password: "vercel-admin-password-1",
          setupToken: "vercel-fetch-token",
        }),
      }),
    );
    assert.equal(setupRes.status, 200);
    const setCookie = setupRes.headers.get("set-cookie") || "";
    assert.match(setCookie, /^solere_session=.*;.*Secure/);
    const sessionCookie = setCookie.split(";")[0];

    const evilRes = await app.fetch(
      new Request("https://valerie.vercel.app/api/index?__path=auth/logout", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://evil.example",
          cookie: sessionCookie,
        },
        body: "{}",
      }),
    );
    assert.equal(evilRes.status, 403);

    const logoutRes = await app.fetch(
      new Request("https://valerie.vercel.app/api/index?__path=auth/logout", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://valerie.vercel.app",
          cookie: sessionCookie,
        },
        body: "{}",
      }),
    );
    assert.equal(logoutRes.status, 200);
    assert.match(logoutRes.headers.get("set-cookie") || "", /Max-Age=0/);
    const loggedOut = await logoutRes.json();
    assert.equal(loggedOut.currentUser, null);

    // Verify 4-tier role persistence (super_admin & staff) on Supabase adapter
    const claimSuperRes = await app.fetch(
      new Request("https://valerie.vercel.app/api/index?__path=admin/claim", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://valerie.vercel.app",
        },
        body: JSON.stringify({
          email: "admin@valerieco.id",
          password: "vercel-admin-password-1",
          setupToken: "vercel-fetch-token",
          role: "super_admin",
        }),
      }),
    );
    assert.equal(claimSuperRes.status, 200);
    const superCookie = (claimSuperRes.headers.get("set-cookie") || "").split(";")[0];
    const superData = await claimSuperRes.json();
    assert.equal(superData.currentUser.role, "super_admin");

    const refreshedState = await (
      await app.fetch(
        new Request("https://valerie.vercel.app/api/index?__path=state", {
          headers: { cookie: superCookie },
        }),
      )
    ).json();
    assert.equal(refreshedState.currentUser.role, "super_admin");
  } finally {
    app.close();
  }
});

test("Vercel api/index.js fails closed with 503 JSON when VERCEL lacks Supabase keys", async () => {
  const prevVercel = process.env.VERCEL;
  const prevEnv = process.env.VERCEL_ENV;
  const prevUrl = process.env.SUPABASE_URL;
  const prevKey = process.env.SUPABASE_SECRET_KEY;
  process.env.VERCEL = "1";
  process.env.VERCEL_ENV = "production";
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SECRET_KEY;
  try {
    const { default: vercelFn } = await import("../api/index.js");
    const res = await vercelFn.fetch(
      new Request("https://valerie.vercel.app/api/index?__path=state"),
    );
    assert.equal(res.status, 503);
    const body = await res.json();
    assert.match(body.error, /SUPABASE_URL and SUPABASE_SECRET_KEY/);
  } finally {
    if (prevVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = prevVercel;
    if (prevEnv === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = prevEnv;
    if (prevUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = prevUrl;
    if (prevKey === undefined) delete process.env.SUPABASE_SECRET_KEY;
    else process.env.SUPABASE_SECRET_KEY = prevKey;
  }
});

test("Supabase store enforces canonical unique phones across formatting variants", async () => {
  const client = makeFakeSupabaseClient({ schemaReady: true });
  const store = createSupabaseStore({ client });

  await store.putMember({
    id: "m-1",
    email: "one@example.com",
    name: "Member One",
    phone: "0812-9988-7766",
    addresses: [],
  });
  const foundByPlus = await store.findMemberByPhone("+6281299887766");
  const foundBySixTwo = await store.findMemberByPhone("6281299887766");
  assert.equal(foundByPlus?.id, "m-1");
  assert.equal(foundByPlus?.phone, "+6281299887766");
  assert.equal(foundBySixTwo?.id, "m-1");

  await assert.rejects(
    () =>
      store.putMember({
        id: "m-2",
        email: "two@example.com",
        name: "Member Two",
        phone: "6281299887766",
        addresses: [],
      }),
    (err) => err?.status === 409,
  );
});

