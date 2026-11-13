import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../server/app.mjs";
test("server authentication, authorization and commerce flow", async (t) => {
  const app = createApp({
    dbPath: ":memory:",
    setupToken: "test-only-setup-token",
  });
  await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const call = async (path, body, cookie, headers = {}) => {
    const r = await fetch(base + "/api/" + path, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(cookie ? { Cookie: cookie } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return {
      status: r.status,
      data: await r.json(),
      cookie: r.headers.get("set-cookie")?.split(";")[0],
    };
  };
  let admin, member, other, p, order;
  try {
    await t.test("public state never exposes members or orders", async () => {
      const r = await call("state");
      assert.equal(r.status, 200);
      assert.equal(r.data.products.length, 40);
      assert.deepEqual(r.data.members, []);
      assert.deepEqual(r.data.orders, []);
      p = r.data.products.find((x) => x.id === "vco-zavira-espresso-ankle");
    });
    await t.test("admin setup requires its one-time token", async () => {
      const r = await call("auth/setup", {
        name: "Admin",
        email: "admin@example.com",
        password: "test-password-123",
        setupToken: "wrong",
      });
      assert.equal(r.status, 403);
      const good = await call("auth/setup", {
        name: "Admin",
        email: "admin@example.com",
        password: "test-password-123",
        setupToken: "test-only-setup-token",
      });
      assert.equal(good.status, 200);
      assert.equal(good.data.currentUser.role, "admin");
      admin = good.cookie;
      const repeat = await call("auth/setup", {
        name: "Admin 2",
        email: "admin2@example.com",
        password: "test-password-123",
        setupToken: "test-only-setup-token",
      });
      assert.equal(repeat.status, 409);
    });
    await t.test(
      "register and login create server sessions with member role",
      async () => {
        const r = await call("auth/register", {
          name: "Member One",
          email: "member@example.com",
          password: "test-password-123",
          role: "admin",
        });
        assert.equal(r.status, 200);
        assert.equal(r.data.currentUser.role, "member");
        member = r.cookie;
        const r2 = await call("auth/register", {
          name: "Member Two",
          email: "other@example.com",
          password: "test-password-123",
        });
        other = r2.cookie;
        const bad = await call("auth/login", {
          email: "member@example.com",
          password: "incorrect-password",
        });
        assert.equal(bad.status, 401);
      },
    );
    await t.test(
      "member cannot edit inventory, coupons, other profiles, or store settings",
      async () => {
        for (const change of [
          { kind: "products", data: { ...p, price: 1 } },
          {
            kind: "coupons",
            data: { code: "HACK", percent: 90, active: true },
          },
          {
            kind: "members",
            data: { id: "not-own", name: "Hacked", addresses: [] },
          },
          { kind: "settings", data: { name: "Hacked" } },
        ]) {
          const r = await call("patch", { changes: [change] }, member);
          assert.equal(r.status, 403);
        }
        const r = await call("patch", {
          changes: [{ kind: "products", data: p }],
        });
        assert.equal(r.status, 401);
      },
    );
    await t.test("same-origin guard blocks cross-site mutation", async () => {
      const r = await call("patch", { changes: [] }, admin, {
        Origin: "https://other.example",
      });
      assert.equal(r.status, 403);
    });
    await t.test(
      "server calculates prices, applies coupon, decrements inventory and deduplicates checkout",
      async () => {
        const payload = {
          key: "unique-checkout-1",
          lines: [
            {
              productId: p.id,
              size: 42,
              color: p.colors[0].name,
              quantity: 1,
              price: 1,
            },
          ],
          code: "WELCOME10",
          express: false,
          address: {
            id: "test-address",
            label: "Home",
            name: "Test Member",
            phone: "0800000000",
            street: "Example address only",
            city: "Example city",
            postal: "12345",
          },
          total: 1,
        };
        const r = await call("orders/create", payload, member);
        assert.equal(r.status, 200);
        order = r.data.order;
        assert.equal(order.total, 355.5);
        assert.equal(order.items[0].price, 395);
        assert.equal(
          r.data.state.products.find((x) => x.id === p.id).stock,
          23,
        );
        const again = await call("orders/create", payload, member);
        assert.equal(again.data.order.id, order.id);
        assert.equal(
          again.data.state.products.find((x) => x.id === p.id).stock,
          23,
        );
      },
    );
    await t.test("orders remain private to owner and admin", async () => {
      const r = await call("state", undefined, other);
      assert.equal(r.data.orders.length, 0);
      const deny = await call(
        "orders/update",
        { id: order.id, status: "cancelled" },
        other,
      );
      assert.equal(deny.status, 403);
      const adminState = await call("state", undefined, admin);
      assert.equal(adminState.data.orders.length, 1);
    });
    await t.test(
      "member cannot ship an order; admin must supply tracking",
      async () => {
        assert.equal(
          (
            await call(
              "orders/update",
              { id: order.id, status: "shipped", tracking: "X" },
              member,
            )
          ).status,
          403,
        );
        assert.equal(
          (
            await call(
              "orders/update",
              { id: order.id, status: "shipped" },
              admin,
            )
          ).status,
          400,
        );
      },
    );
    await t.test("cancellation restores stock exactly once", async () => {
      const r = await call(
        "orders/update",
        { id: order.id, status: "cancelled" },
        member,
      );
      assert.equal(r.status, 200);
      assert.equal(r.data.products.find((x) => x.id === p.id).stock, 24);
      assert.equal(
        (
          await call(
            "orders/update",
            { id: order.id, status: "cancelled" },
            member,
          )
        ).status,
        409,
      );
    });
    await t.test(
      "invalid size and overstock checkout roll back inventory",
      async () => {
        for (const patch of [
          { size: 99, quantity: 1 },
          { size: 42, quantity: 25 },
        ]) {
          const r = await call(
            "orders/create",
            {
              key: crypto.randomUUID(),
              lines: [{ productId: p.id, color: p.colors[0].name, ...patch }],
            },
            member,
          );
          assert.ok([400, 409].includes(r.status));
        }
        assert.equal(
          (await call("state")).data.products.find((x) => x.id === p.id).stock,
          24,
        );
      },
    );
    await t.test("support ownership and replies follow roles", async () => {
      const payload = {
        kind: "tickets",
        data: {
          id: "ticket-1",
          subject: "Example question",
          message: "Example request",
          memberId: "someone-else",
        },
      };
      assert.equal(
        (await call("patch", { changes: [payload] }, member)).status,
        200,
      );
      const own = (await call("state", undefined, member)).data.tickets[0];
      assert.equal(
        own.memberId,
        (await call("state", undefined, member)).data.currentUser.id,
      );
      assert.equal(
        (
          await call(
            "patch",
            {
              changes: [
                {
                  kind: "tickets",
                  data: { ...own, reply: "Fake admin reply", status: "closed" },
                },
              ],
            },
            member,
          )
        ).status,
        403,
      );
      assert.equal(
        (
          await call(
            "patch",
            {
              changes: [
                {
                  kind: "tickets",
                  data: { ...own, reply: "Admin reply", status: "closed" },
                },
              ],
            },
            admin,
          )
        ).status,
        200,
      );
    });
    await t.test("admin can save showcase artwork but invalid URLs are rejected", async () => {
      const payload = {...p, showcaseImage: "/shoes/01_Sneakers/01_velora_blush_chunky/01_velora_blush_chunky.webp"};
      const valid = await call("patch", {changes:[{kind:"products",data:payload}]}, admin);
      assert.equal(valid.status,200);
      assert.equal(valid.data.products.find(x=>x.id===p.id).showcaseImage,payload.showcaseImage);
      const invalid = await call("patch", {changes:[{kind:"products",data:{...payload,showcaseImage:"javascript:alert(1)"}}]}, admin);
      assert.equal(invalid.status,400);
    });
    await t.test("homepage selection is admin-only, persists and is public without private orders", async () => {
      const before = (await call("state", undefined, admin)).data.settings;
      const settings = {...before, homepage: {mode: "manual", productIds: [p.id]}};
      const body = {changes: [{kind: "settings", data: settings}]};
      assert.equal((await call("patch", body, member)).status, 403);
      assert.equal((await call("patch", body, admin)).status, 200);
      const visible = (await call("state")).data;
      assert.deepEqual(visible.settings.homepage, settings.homepage);
      assert.deepEqual(visible.orders, []);
      assert.equal(typeof visible.sales, "object");
      assert.equal((await call("patch", {changes:[{kind:"settings",data:{...settings,homepage:{mode:"manual",productIds:["unknown"]}}}]}, admin)).status,400);
      assert.equal((await call("patch", {changes:[{kind:"products_delete",data:{id:"vco-zavira-ruby-lace-sling"}}]}, member)).status, 403);
      const afterDel = await call("patch", {changes:[{kind:"products_delete",data:{id:"vco-zavira-ruby-lace-sling"}},{kind:"coupons_delete",data:{id:"SOLERE20"}}]}, admin);
      assert.equal(afterDel.status, 200);
      assert.equal(afterDel.data.products.some(x=>x.id==="vco-zavira-ruby-lace-sling"), false);
      assert.equal(afterDel.data.coupons.some(c=>c.code==="SOLERE20"), false);
    });
    await t.test(
      "password change rotates sessions and logout invalidates session",
      async () => {
        const r = await call(
          "auth/password",
          { current: "test-password-123", password: "new-test-password-456" },
          member,
        );
        assert.equal(r.status, 200);
        assert.equal(
          (await call("state", undefined, member)).data.currentUser,
          null,
        );
        member = r.cookie;
        assert.equal(
          (await call("state", undefined, member)).data.currentUser.role,
          "member",
        );
        await call("auth/logout", {}, member);
        assert.equal(
          (await call("state", undefined, member)).data.currentUser,
          null,
        );
      },
    );
    await t.test(
      "whatsapp registration, otp verification, spoof guard and safe static fallback",
      async () => {
        const waReg = await call("auth/register", {
          name: "Sari WA",
          phone: "081234567890",
          password: "wa-password-1234",
        });
        assert.equal(waReg.status, 200);
        const waUser = waReg.data.currentUser;
        const waMember = waReg.data.members.find((m) => m.id === waUser.id);
        assert.equal(waMember.phone, "+6281234567890");
        assert.equal(waMember.phoneVerified, false);
        assert.equal(waMember.emailVerified, false);

        const spoof = await call(
          "patch",
          {
            changes: [
              {
                kind: "members",
                data: {
                  ...waMember,
                  emailVerified: true,
                  phoneVerified: true,
                },
              },
            ],
          },
          waReg.cookie,
        );
        assert.equal(spoof.status, 200);
        const afterSpoof = spoof.data.members.find((m) => m.id === waUser.id);
        assert.equal(afterSpoof.emailVerified, false);
        assert.equal(afterSpoof.phoneVerified, false);

        const blockedEmailReq = await call(
          "member/verify/request",
          { channel: "email" },
          waReg.cookie,
        );
        assert.equal(blockedEmailReq.status, 400);

        const otpReq = await call(
          "member/verify/request",
          { channel: "phone" },
          waReg.cookie,
        );
        assert.equal(otpReq.status, 200);
        assert.match(otpReq.data.previewCode, /^\d{6}$/);

        const wrongOtp = await call(
          "member/verify/confirm",
          { channel: "phone", code: "000000" },
          waReg.cookie,
        );
        if (otpReq.data.previewCode !== "000000") {
          assert.equal(wrongOtp.status, 400);
        }

        const confirmed = await call(
          "member/verify/confirm",
          { channel: "phone", code: otpReq.data.previewCode },
          waReg.cookie,
        );
        assert.equal(confirmed.status, 200);
        const verifiedMember = confirmed.data.members.find(
          (m) => m.id === waUser.id,
        );
        assert.equal(verifiedMember.phoneVerified, true);

        const waLogin = await call("auth/login", {
          phone: "+62 812-3456-7890",
          password: "wa-password-1234",
        });
        assert.equal(waLogin.status, 200);
        assert.equal(waLogin.data.currentUser.id, waUser.id);

        const waShortLogin = await call("auth/login", {
          phone: "81234567890",
          password: "wa-password-1234",
        });
        assert.equal(waShortLogin.status, 200);
        assert.equal(waShortLogin.data.currentUser.id, waUser.id);

        const waWrongPass = await call("auth/login", {
          phone: "081234567890",
          password: "wrong-password-1234",
        });
        assert.equal(waWrongPass.status, 401);

        const staticRes = await fetch(base + "/");
        assert.notEqual(staticRes.status, 500);
        assert.ok(staticRes.headers.get("content-security-policy"));
        assert.ok(staticRes.headers.get("permissions-policy"));
        assert.equal(
          staticRes.headers.get("x-content-type-options"),
          "nosniff",
        );
      },
    );
    await t.test(
      "direct IDR checkout calculates authoritative priceIdr and records IDR currency",
      async () => {
        const login = await call("auth/login", {
          email: "member@example.com",
          password: "new-test-password-456",
        });
        assert.equal(login.status, 200);
        member = login.cookie;
        const expectedDiscount = Math.round((p.priceIdr * 10) / 100);
        const r = await call(
          "orders/create",
          {
            key: "unique-checkout-idr-1",
            currency: "IDR",
            code: "WELCOME10",
            express: false,
            lines: [
              {
                productId: p.id,
                size: p.sizes[0],
                color: p.colors[0].name,
                quantity: 1,
              },
            ],
            address: {
              id: "idr-addr",
              label: "Home",
              name: "Test Member",
              phone: "081234567890",
              street: "Jl. Senopati No. 10",
              city: "Jakarta",
              postal: "12190",
            },
          },
          member,
        );
        assert.equal(r.status, 200);
        assert.equal(r.data.order.currency, "IDR");
        assert.equal(r.data.order.items[0].price, p.priceIdr);
        assert.equal(r.data.order.discount, expectedDiscount);
        assert.equal(r.data.order.shipping, 0);
        assert.equal(r.data.order.total, p.priceIdr - expectedDiscount);
      },
    );
  } finally {
    await new Promise((r) => app.server.close(r));
    app.sql.close();
  }
});
