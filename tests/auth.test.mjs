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
