import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../server/app.mjs";

test("Google identity challenges and email recovery", async (t) => {
  let delivered;
  const app = createApp({
    dbPath: ":memory:",
    googleClientId: "test-client",
    verifyGoogleToken: async (token) => JSON.parse(token),
    sendReset: async (email, token) => {
      delivered = { email, token };
    },
  });
  await new Promise((resolve) => app.server.listen(0, "127.0.0.1", resolve));
  t.after(() => app.close());
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const request = async (path, body, cookie = "") => {
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
  const config = await request("auth/config");
  const profile = {
    sub: "google-user",
    email: "google@example.com",
    email_verified: true,
    name: "Google member",
    nonce: config.data.nonce,
  };
  assert.equal(
    (await request("auth/google", { credential: JSON.stringify(profile) }))
      .status,
    401,
  );
  const signed = await request(
    "auth/google",
    { credential: JSON.stringify(profile) },
    config.cookie,
  );
  assert.equal(signed.status, 200);
  assert.equal(signed.data.currentUser.role, "member");
  assert.equal(
    (
      await request(
        "auth/google",
        { credential: JSON.stringify(profile) },
        config.cookie,
      )
    ).status,
    401,
  );
  const registered = await request("auth/register", {
    name: "Member",
    email: "member@example.com",
    password: "original-pass-123",
  });
  const conflict = await request("auth/config");
  assert.equal(
    (
      await request(
        "auth/google",
        {
          credential: JSON.stringify({
            ...profile,
            sub: "another",
            email: "member@example.com",
            nonce: conflict.data.nonce,
          }),
        },
        conflict.cookie,
      )
    ).status,
    409,
  );
  const known = await request("auth/forgot", { email: "member@example.com" });
  const unknown = await request("auth/forgot", {
    email: "unknown@example.com",
  });
  assert.deepEqual(known.data, unknown.data);
  assert.equal(delivered.email, "member@example.com");
  assert.equal(
    (await request("auth/reset", { token: "bad", password: "replacement-123" }))
      .status,
    400,
  );
  assert.equal(
    (
      await request("auth/reset", {
        token: delivered.token,
        password: "replacement-123",
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await request("auth/reset", {
        token: delivered.token,
        password: "replacement-456",
      })
    ).status,
    400,
  );
  assert.equal(
    (await request("state", undefined, registered.cookie)).data.currentUser,
    null,
  );
  assert.equal(
    (
      await request("auth/login", {
        email: "member@example.com",
        password: "original-pass-123",
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await request("auth/login", {
        email: "member@example.com",
        password: "replacement-123",
      })
    ).status,
    200,
  );
});

test("whatsappMailer formats Fonnte payloads and surfaces failures", async () => {
  const { whatsappMailer } = await import("../server/auth-services.mjs");
  assert.equal(whatsappMailer({}), null);

  const calls = [];
  const mailer = whatsappMailer(
    { FONNTE_TOKEN: "test-fonnte-token", FONNTE_URL: "https://fonnte.test/send" },
    async (url, init) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ status: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  );
  await mailer("+6281234567890", "Kode OTP Anda: 123456");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://fonnte.test/send");
  assert.equal(calls[0].init.method, "POST");
  assert.equal(calls[0].init.headers.Authorization, "test-fonnte-token");
  const body = new URLSearchParams(String(calls[0].init.body));
  assert.equal(body.get("target"), "6281234567890");
  assert.equal(body.get("message"), "Kode OTP Anda: 123456");
  assert.equal(body.get("countryCode"), "0");

  const failingMailer = whatsappMailer(
    { FONNTE_TOKEN: "test-fonnte-token" },
    async () =>
      new Response(JSON.stringify({ status: false, reason: "device disconnected" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
  );
  await assert.rejects(
    failingMailer("+6281234567890", "Kode OTP Anda: 654321"),
    /device disconnected/,
  );
});

test("passwordless WhatsApp and Email OTP sign-in, lockout, duplicate phone guard, and production fail-closed checks", async (t) => {
  const { createApp } = await import("../server/app.mjs");
  const waSent = [];
  const emailSent = [];
  const app = createApp({
    dbPath: ":memory:",
    allowOtpPreview: false,
    sendWhatsapp: async (phone, message) => {
      waSent.push({ phone, message });
    },
    sendReset: async (...args) => {
      emailSent.push(args);
    },
  });
  await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
  t.after(() => app.server.close());
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const req = async (path, body, cookie) => {
    const res = await fetch(`${base}/api/${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return {
      status: res.status,
      data: await res.json(),
      cookie: res.headers.get("set-cookie")?.split(";")[0],
    };
  };

  const cfg = await req("auth/config");
  assert.equal(cfg.status, 200);
  assert.equal(cfg.data.emailOtp, true);
  assert.equal(cfg.data.whatsappOtp, true);

  // 1. WhatsApp OTP registration & sign-in flow
  const waReq = await req("auth/otp/request", {
    channel: "whatsapp",
    phone: "081234567890",
  });
  assert.equal(waReq.status, 200);
  assert.equal(waReq.data.sent, true);
  assert.equal(waReq.data.previewCode, undefined);
  assert.equal(waSent.length, 1);
  assert.equal(waSent[0].phone, "+6281234567890");
  const waCode1 = waSent[0].message.match(/\b(\d{6})\b/)?.[1];
  assert.ok(waCode1);

  const needsName = await req("auth/otp/verify", {
    channel: "whatsapp",
    phone: "081234567890",
    code: waCode1,
  });
  assert.equal(needsName.status, 200);
  assert.equal(needsName.data.needsName, true);
  assert.equal(needsName.data.channel, "phone");

  const registered = await req("auth/otp/verify", {
    channel: "whatsapp",
    phone: "081234567890",
    code: waCode1,
    name: "Nadia Putri",
  });
  assert.equal(registered.status, 200);
  assert.ok(registered.cookie);
  assert.equal(registered.data.currentUser.role, "member");
  const waMember = registered.data.members.find(
    (m) => m.id === registered.data.currentUser.id,
  );
  assert.equal(waMember.name, "Nadia Putri");
  assert.equal(waMember.email, "wa.6281234567890@wa.valerieco.id");
  assert.equal(waMember.phone, "+6281234567890");
  assert.equal(waMember.phoneVerified, true);

  // Existing WhatsApp user can sign in again without passing name
  const waReq2 = await req("auth/otp/request", {
    channel: "whatsapp",
    phone: "+6281234567890",
  });
  assert.equal(waReq2.status, 200);
  const waCode2 = waSent[1].message.match(/\b(\d{6})\b/)?.[1];
  const signedInWa = await req("auth/otp/verify", {
    channel: "whatsapp",
    phone: "+6281234567890",
    code: waCode2,
  });
  assert.equal(signedInWa.status, 200);
  assert.ok(signedInWa.cookie);
  assert.equal(signedInWa.data.currentUser.id, waMember.id);

  // 2. Email OTP registration & sign-in flow + duplicate phone guard
  const emailReq = await req("auth/otp/request", {
    channel: "email",
    email: "nadia.email@example.com",
  });
  assert.equal(emailReq.status, 200);
  assert.equal(emailReq.data.sent, true);
  assert.equal(emailReq.data.previewCode, undefined);
  assert.equal(emailSent.length, 1);
  assert.equal(emailSent[0][0], "nadia.email@example.com");
  const emailCode = String(emailSent[0].join(" ")).match(/\b(\d{6})\b/)?.[1];
  assert.ok(emailCode);

  const emailReg = await req("auth/otp/verify", {
    channel: "email",
    email: "nadia.email@example.com",
    code: emailCode,
    name: "Nadia Email",
  });
  assert.equal(emailReg.status, 200);
  assert.ok(emailReg.cookie);
  const emailMember = emailReg.data.members.find(
    (m) => m.id === emailReg.data.currentUser.id,
  );
  assert.equal(emailMember.emailVerified, true);

  const dupPatch = await req(
    "patch",
    {
      changes: [
        {
          kind: "members",
          data: { ...emailMember, phone: "081234567890" },
        },
      ],
    },
    emailReg.cookie,
  );
  assert.equal(dupPatch.status, 409);

  // 3. Wrong OTP lockout after 5 bad attempts -> 6th attempt gets 429
  await req("auth/otp/request", {
    channel: "email",
    email: "nadia.email@example.com",
  });
  for (let i = 0; i < 5; i++) {
    const bad = await req("auth/otp/verify", {
      channel: "email",
      email: "nadia.email@example.com",
      code: "000000",
    });
    assert.equal(bad.status, 400);
  }
  const lockedCode = String(emailSent[1].join(" ")).match(/\b(\d{6})\b/)?.[1];
  const locked = await req("auth/otp/verify", {
    channel: "email",
    email: "nadia.email@example.com",
    code: lockedCode,
  });
  assert.equal(locked.status, 429);

  // 4. Production fail-closed (503) & gateway failure (502)
  const unconfigured = createApp({
    dbPath: ":memory:",
    allowOtpPreview: false,
    sendWhatsapp: null,
    sendReset: null,
  });
  await new Promise((r) => unconfigured.server.listen(0, "127.0.0.1", r));
  t.after(() => unconfigured.server.close());
  const unconfBase = `http://127.0.0.1:${unconfigured.server.address().port}`;
  const unconfWa = await fetch(`${unconfBase}/api/auth/otp/request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ channel: "whatsapp", phone: "081234567890" }),
  });
  assert.equal(unconfWa.status, 503);

  const broken = createApp({
    dbPath: ":memory:",
    allowOtpPreview: false,
    sendWhatsapp: async () => {
      throw new Error("gateway down");
    },
  });
  await new Promise((r) => broken.server.listen(0, "127.0.0.1", r));
  t.after(() => broken.server.close());
  const brokenBase = `http://127.0.0.1:${broken.server.address().port}`;
  const brokenWa = await fetch(`${brokenBase}/api/auth/otp/request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ channel: "whatsapp", phone: "081234567890" }),
  });
  assert.equal(brokenWa.status, 502);
});
