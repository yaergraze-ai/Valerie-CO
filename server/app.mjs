import {
  midtransClient,
  verifyNotification,
  paymentState,
  idrQuote,
} from "./midtrans.mjs";
import { verifyGoogle, resetMailer, whatsappMailer } from "./auth-services.mjs";
import { createSqliteStore } from "./db-sqlite.mjs";
import { createSupabaseStore } from "./db-supabase.mjs";
import { salesTotals } from "./sales.mjs";
import http from "node:http";
import {
  randomBytes,
  randomInt,
  randomUUID,
  scryptSync,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { readFileSync, existsSync, statSync } from "node:fs";
import { resolve, dirname, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const seed = JSON.parse(
  readFileSync(fileURLToPath(new URL("./catalog.json", import.meta.url)), "utf8"),
);
const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "same-origin",
  "X-Frame-Options": "DENY",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self' https://accounts.google.com https://apis.google.com; frame-src 'self' https://accounts.google.com https://app.midtrans.com https://app.sandbox.midtrans.com; style-src 'self' 'unsafe-inline' https://accounts.google.com; img-src 'self' data: blob: https://*.googleusercontent.com https://*.gstatic.com; font-src 'self' data:; connect-src 'self' https://accounts.google.com;",
};
const hashToken = (t) => createHash("sha256").update(t).digest("hex");
const hashPassword = (p) => {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(p, salt, 64).toString("hex")}`;
};
const checkPassword = (p, encoded) => {
  const [salt, key] = encoded.split(":");
  const candidate = scryptSync(p, salt, 64);
  const stored = Buffer.from(key, "hex");
  return (
    stored.length === candidate.length && timingSafeEqual(stored, candidate)
  );
};
const fail = (status, message) => {
  throw Object.assign(new Error(message), { status });
};
const str = (v, max = 200) => {
  if (typeof v !== "string" || !v.trim() || v.length > max)
    fail(400, "Invalid text field");
  return v.trim();
};
const MIN_PASSWORD_LEN = 8;
const validPassword = (v) => {
  const password = str(v, 256);
  if (password.length < MIN_PASSWORD_LEN)
    fail(400, `Password must be at least ${MIN_PASSWORD_LEN} characters`);
  return password;
};
const email = (v) => {
  const e = str(v, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) fail(400, "Invalid email");
  return e;
};
const normalizePhone = (v) => {
  if (typeof v !== "string" || !v.trim()) return "";
  const cleaned = v.replace(/[^\d+]/g, "");
  const rawDigits = cleaned.replace(/^\+/, "");
  const digits = rawDigits.startsWith("08")
    ? `62${rawDigits.slice(1)}`
    : rawDigits.startsWith("8")
      ? `62${rawDigits}`
      : rawDigits;
  if (!/^\d{9,15}$/.test(digits)) fail(400, "Invalid WhatsApp number");
  return `+${digits}`;
};
const number = (v, min, max) => {
  if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max)
    fail(400, "Invalid number");
  return v;
};
const integer = (v, min, max) => {
  number(v, min, max);
  if (!Number.isInteger(v)) fail(400, "Invalid integer");
  return v;
};
const address = (a) => ({
  id: str(a.id, 80),
  label: str(a.label, 60),
  name: str(a.name, 120),
  phone: str(a.phone, 40),
  street: str(a.street, 400),
  city: str(a.city, 100),
  postal: str(a.postal, 20),
});
const isSafeImageUrl = (u) =>
  typeof u === "string" &&
  u.length <= 600000 &&
  (/^https:\/\//.test(u) ||
    (u.startsWith("/") && !u.startsWith("//")) ||
    /^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/i.test(u));

function product(p) {
  const images = p.images;
  if (
    !Array.isArray(images) ||
    !images.length ||
    images.length > 12 ||
    images.some((u) => !isSafeImageUrl(u))
  )
    fail(400, "Invalid images");
  if (p.showcaseImage && !isSafeImageUrl(p.showcaseImage))
    fail(400, "Invalid showcase image");
  if (
    !["Sneakers", "Heels", "Boots", "Flatshoes"].includes(p.category) ||
    !Array.isArray(p.sizes) ||
    !p.sizes.length ||
    p.sizes.length > 40
  )
    fail(400, "Invalid category or sizes");
  if (!Array.isArray(p.colors) || !p.colors.length || p.colors.length > 20)
    fail(400, "Invalid colours");
  return {
    id: str(p.id, 80),
    name: str(p.name, 150),
    brand: str(p.brand, 100),
    category: p.category,
    price: Math.round(number(p.price, 0.01, 1000000) * 100) / 100,
    stock: integer(p.stock, 0, 100000),
    ...(p.priceIdr ? { priceIdr: integer(p.priceIdr, 1, 999999999) } : {}),
    images,
    ...(p.showcaseImage ? { showcaseImage: p.showcaseImage } : {}),
    ...(p.subCategory ? { subCategory: str(p.subCategory, 40) } : {}),
    sizes: [...new Set(p.sizes.map((n) => integer(n, 20, 55)))],
    colors: p.colors.map((c) => {
      if (!/^#[0-9a-f]{6}$/i.test(c.hex)) fail(400, "Invalid colour");
      return {
        name: str(c.name, 100),
        hex: c.hex,
        ...(c.subtitle ? { subtitle: str(c.subtitle, 150) } : {}),
        ...(c.filter ? { filter: str(c.filter, 120) } : {}),
        ...(c.image && isSafeImageUrl(c.image) ? { image: c.image } : {}),
      };
    }),
    ...(p.details && typeof p.details === "object"
      ? {
        details: {
          code: str(p.details.code || p.id.toUpperCase(), 60),
          origin: String(p.details.origin || "Crafted in Valerie & CO Atelier").slice(0, 160),
          composition: {
            id: String(p.details.composition?.id || "").slice(0, 400),
            en: String(p.details.composition?.en || "").slice(0, 400),
          },
          sole: {
            id: String(p.details.sole?.id || "").slice(0, 400),
            en: String(p.details.sole?.en || "").slice(0, 400),
          },
        },
      }
      : {}),
    ...(p.reviews ? { reviews: p.reviews } : {}),
    description: {
      id: str(p.description?.id, 5000),
      en: str(p.description?.en, 5000),
    },
    active: !!p.active,
    fresh: !!p.fresh,
  };
}
function unconfiguredVercelDb() {
  const err = Object.assign(
    new Error(
      "SUPABASE_URL and SUPABASE_SECRET_KEY must be set in Vercel Environment Variables.",
    ),
    { status: 503 },
  );
  return new Proxy(
    {},
    {
      get(_, prop) {
        if (prop === "kind") return "unconfigured";
        if (prop === "close") return () => {};
        return async () => {
          throw err;
        };
      },
    },
  );
}
export function createApp({
  dbPath = resolve(root, "data/solere.sqlite"),
  setupToken = process.env.SOLERE_SETUP_TOKEN,
  secureCookie =
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production" ||
    process.env.VERCEL_ENV === "preview",
  trustProxy =
    process.env.TRUST_PROXY === "true" || Boolean(process.env.VERCEL),
  googleClientId = process.env.GOOGLE_CLIENT_ID,
  verifyGoogleToken = verifyGoogle,
  sendReset = resetMailer(),
  sendWhatsapp = whatsappMailer(),
  allowOtpPreview =
    process.env.NODE_ENV !== "production" &&
    process.env.VERCEL_ENV !== "production" &&
    process.env.VERCEL_ENV !== "preview",
  midtransKey = process.env.MIDTRANS_SERVER_KEY,
  paymentProduction = process.env.MIDTRANS_PRODUCTION === "true",
  gateway = midtransClient(midtransKey, paymentProduction),
  idrShipping = {
    standard: Number(process.env.SHIPPING_STANDARD_IDR || 25000),
    express: Number(process.env.SHIPPING_EXPRESS_IDR || 50000),
    freeAbove: Number(process.env.SHIPPING_FREE_ABOVE_IDR || 2000000),
  },
  store = null,
  supabaseUrl = process.env.SUPABASE_URL,
  supabaseSecretKey = process.env.SUPABASE_SECRET_KEY,
} = {}) {
  if (Object.values(idrShipping).some((n) => !Number.isSafeInteger(n) || n < 0))
    throw Error("Invalid IDR shipping configuration");
  const db =
    store ||
    (dbPath !== ":memory:" && supabaseUrl && supabaseSecretKey
      ? createSupabaseStore({ url: supabaseUrl, secretKey: supabaseSecretKey })
      : process.env.VERCEL && dbPath !== ":memory:"
        ? unconfiguredVercelDb()
        : createSqliteStore(dbPath));
  const defaultStoreName = String(
    process.env.STORE_NAME || process.env.VITE_STORE_NAME || "Valerie & CO",
  ).slice(0, 24);
  const defaultSupportEmail =
    process.env.SUPPORT_EMAIL ||
    process.env.VITE_SUPPORT_EMAIL ||
    "concierge@valerieco.atelier";
  let initialized = false;
  let initializing = null;
  const initializeStore = async () => {
    await db.ensureSchema();
    const currentSeed = await db.getMeta("seed");
    if (!currentSeed || currentSeed.version < 5) {
      if (currentSeed && currentSeed.version < 5) {
        const existingSettings = await db.getSettings();
        if (existingSettings) {
          const nextIds = new Set(seed.map((p) => p.id));
          const kept = existingSettings.homepage?.productIds?.length
            ? existingSettings.homepage.productIds.filter((id) => nextIds.has(id))
            : null;
          const legacyName =
            !existingSettings.name ||
            /^SOL[EÈ]RE$/i.test(existingSettings.name.trim());
          const legacyEmail =
            !existingSettings.email ||
            existingSettings.email.trim().toLowerCase() === "care@solere.example";
          await db.putSettings({
            ...existingSettings,
            name: legacyName ? defaultStoreName : existingSettings.name,
            email: legacyEmail ? defaultSupportEmail : existingSettings.email,
            ...(kept
              ? {
                  homepage:
                    kept.length > 0
                      ? { ...existingSettings.homepage, productIds: kept }
                      : { mode: "auto", productIds: [] },
                }
              : {}),
          });
        }
      }
      await db.resetAndSeedProducts(seed, {
        clearExisting: Boolean(currentSeed && currentSeed.version < 4),
      });
      if (!currentSeed || !(await db.getSettings())) {
        if (!currentSeed) {
          await db.putCoupon({ code: "WELCOME10", percent: 10, active: true });
          await db.putCoupon({ code: "SOLERE20", percent: 20, active: true });
        }
        await db.putSettings({
          name: defaultStoreName,
          email: defaultSupportEmail,
          announcement: {
            id:
              process.env.ANNOUNCEMENT_ID ||
              process.env.VITE_ANNOUNCEMENT_ID ||
              "Sudut pandang baru untuk kemewahan sehari-hari.",
            en:
              process.env.ANNOUNCEMENT_EN ||
              process.env.VITE_ANNOUNCEMENT_EN ||
              "A new perspective on everyday luxury.",
          },
        });
      }
      await db.putMeta("seed", { version: 5 });
    }
    const envAdminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const envAdminPassword = process.env.ADMIN_PASSWORD;
    if (
      envAdminEmail &&
      envAdminPassword &&
      envAdminPassword.length >= MIN_PASSWORD_LEN &&
      !(await db.hasAdmin())
    ) {
      const adminId = randomUUID();
      await db.createUserWithMember(
        {
          id: adminId,
          email: envAdminEmail,
          password: hashPassword(envAdminPassword),
          role: "admin",
        },
        {
          id: adminId,
          email: envAdminEmail,
          name: process.env.ADMIN_NAME || "Valerie & CO Admin",
          phone: "",
          addresses: [],
        },
        null,
        { ignoreConflict: true },
      );
    }
    initialized = true;
  };
  const ensureReady = async () => {
    if (initialized) return;
    if (!initializing) {
      initializing = initializeStore().catch((err) => {
        initializing = null;
        throw err;
      });
    }
    await initializing;
  };
  const ready = ensureReady();
  ready.catch(() => {});

  const authenticate = async (cookieHeader = "") => {
    const token = cookieHeader
      .split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith("solere_session="))
      ?.slice(15);
    if (!token) return null;
    return await db.getSessionUser(hashToken(token), Date.now());
  };
  const session = async (setCookie, user) => {
    const token = randomBytes(32).toString("hex");
    const now = Date.now();
    await db.createSession(hashToken(token), user.id, now + 7 * 86400000, now);
    setCookie(
      `solere_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=604800${secureCookie ? "; Secure" : ""}`,
    );
  };
  const deliverOtp = async ({ key, channel, destination, headline }) => {
    if (channel === "email" && !sendReset && !allowOtpPreview)
      fail(503, "Email OTP service (SMTP) is not configured.");
    if (channel === "phone" && !sendWhatsapp && !allowOtpPreview)
      fail(503, "WhatsApp OTP gateway (FONNTE_TOKEN) is not configured.");
    const code = String(randomInt(100000, 1000000));
    const now = Date.now();
    await db.upsertVerificationCode(key, hashToken(code), now + 600000, now);
    let sent = false;
    try {
      if (channel === "email" && sendReset) {
        await sendReset(destination, code, {
          subject: `Valerie & CO — ${headline}`,
          text: `Kode OTP Valerie & CO Anda: ${code}\nBerlaku 10 menit. Jangan bagikan kode ini kepada siapa pun.`,
        });
        sent = true;
      } else if (channel === "phone" && sendWhatsapp) {
        await sendWhatsapp(
          destination,
          `*Valerie & CO* — ${headline}\n\nKode OTP Anda: *${code}*\nBerlaku selama 10 menit.\nJangan bagikan kode ini kepada siapa pun.`,
        );
        sent = true;
      }
    } catch {
      await db.deleteVerificationCode(key).catch(() => {});
      fail(
        502,
        `Failed to send ${channel === "email" ? "email" : "WhatsApp"} OTP`,
      );
    }
    return {
      ok: true,
      channel,
      sent,
      ...(allowOtpPreview && !sent ? { previewCode: code } : {}),
    };
  };
  const verifyOtpCode = async (
    key,
    rawCode,
    { deleteOnSuccess = true } = {},
  ) => {
    const code = str(rawCode, 12).replace(/\s+/g, "");
    const row = await db.getVerificationCode(key, Date.now());
    if (!row) fail(400, "Verification code expired or not requested");
    if (row.attempts >= 5) fail(429, "Too many wrong codes. Request a new code.");
    const candidateHash = Buffer.from(hashToken(code), "hex");
    const storedHash = Buffer.from(row.code_hash, "hex");
    if (
      candidateHash.length !== storedHash.length ||
      !timingSafeEqual(candidateHash, storedHash)
    ) {
      await db.incrementVerificationAttempts(key);
      fail(400, "Invalid verification code");
    }
    if (deleteOnSuccess) await db.deleteVerificationCode(key);
  };
  const state = async (u) => {
    const [
      allOrders,
      allProducts,
      settings,
      adminExists,
      allMembers,
      allCoupons,
      allTickets,
      allSubscribers,
    ] = await Promise.all([
      db.listOrders(),
      db.listProducts(),
      db.getSettings(),
      db.hasAdmin(),
      u ? db.listMembers() : Promise.resolve([]),
      u?.role === "admin" ? db.listCoupons() : Promise.resolve([]),
      u ? db.listTickets() : Promise.resolve([]),
      u?.role === "admin" ? db.listSubscribers() : Promise.resolve([]),
    ]);
    return {
      paymentConfig: {
        enabled: !!gateway,
        production: paymentProduction,
        shipping: idrShipping,
      },
      sales: salesTotals(
        allOrders.filter(
          (o) =>
            o.status !== "cancelled" &&
            o.refund?.status !== "refunded" &&
            (!o.payment || o.payment.status === "paid"),
        ),
      ),
      products: allProducts.filter((p) => u?.role === "admin" || p.active),
      members: u
        ? allMembers.filter((m) => u.role === "admin" || m.id === u.id)
        : [],
      orders: u
        ? allOrders.filter((o) => u.role === "admin" || o.memberId === u.id)
        : [],
      coupons: allCoupons,
      tickets: u
        ? allTickets.filter((t) => u.role === "admin" || t.memberId === u.id)
        : [],
      subscribers: allSubscribers,
      settings,
      currentUser: u ? { id: u.id, role: u.role } : null,
      needsAdmin: !adminExists,
    };
  };
  const attempts = new Map();
  const handleApiRequest = async ({
    method,
    path,
    origin = "",
    host = "",
    secFetchSite = "",
    contentType = "",
    cookieHeader = "",
    forwardedFor = "",
    remoteAddress = "unknown",
    readRawBody,
  }) => {
    const cookies = [];
    let status = 200;
    let payload = null;
    const send = (code, data) => {
      status = code;
      payload = data;
    };
    const setCookie = (cookie) => {
      cookies.push(cookie);
    };
    const dispatch = async () => {
      await ensureReady();
      const u = await authenticate(cookieHeader);
      if (path === "/api/state" && method === "GET") {
        send(200, await state(u));
        return;
      }
      if (path === "/api/auth/config" && method === "GET") {
        const nonce = randomBytes(24).toString("hex");
        const now = Date.now();
        await db.saveGoogleChallenge(hashToken(nonce), now + 300000, now);
        setCookie(
          `solere_google=${nonce}; Path=/api/auth; HttpOnly; SameSite=Strict; Max-Age=300${secureCookie ? "; Secure" : ""}`,
        );
        send(200, {
          googleClientId: googleClientId || null,
          nonce,
          recovery: !!sendReset,
          emailOtp: !!sendReset,
          whatsappOtp: !!sendWhatsapp,
        });
        return;
      }
      if (method !== "POST") fail(405, "Method not allowed");
      const webhook = path === "/api/payments/midtrans/notification";
      // Same-site mutation guard. No cross-origin CORS permissions are granted.
      if (!webhook && origin) {
        let originHost = "";
        try {
          originHost = new URL(origin).host;
        } catch {
          fail(403, "Invalid origin");
        }
        if (originHost !== host) fail(403, "Invalid origin");
      }
      if (!webhook && secFetchSite === "cross-site")
        fail(403, "Cross-site request rejected");
      if (!contentType.startsWith("application/json"))
        fail(415, "JSON required");
      const raw = await readRawBody();
      let body;
      try {
        body = JSON.parse(raw);
      } catch {
        fail(400, "Invalid JSON");
      }
      const requireUser = () => {
        if (!u) fail(401, "Sign in required");
      };
      const requireAdmin = () => {
        requireUser();
        if (u.role !== "admin") fail(403, "Admin access required");
      };
      const syncPayment = async (id) => {
        if (!gateway) fail(503, "Midtrans is not configured");
        const existing = await db.getOrder(id);
        if (!existing?.payment) fail(404, "Payment order not found");
        const remote = await gateway.status(id);
        if (String(remote.status_code) === "404") return;
        const order = (await db.getOrder(id)) || existing;
        if (!order?.payment) fail(404, "Payment order not found");
        if (
          remote.order_id !== id ||
          Number(remote.gross_amount) !== order.total ||
          remote.currency !== "IDR"
        )
          fail(409, "Payment amount mismatch");
        const next = paymentState(remote);
        if (
          order.payment.status === "refunded" ||
          (order.payment.status === "paid" && next !== "refunded") ||
          (order.payment.status === "failed" && next !== "paid")
        )
          return;
        if (order.payment.status === "failed" && next === "paid")
          fail(409, "Late settlement requires manual reconciliation");
        const shouldRestore =
          (next === "failed" || next === "refunded") &&
          order.payment.status !== "failed" &&
          order.payment.status !== "refunded" &&
          order.status !== "cancelled" &&
          order.refund?.status !== "refunded";
        const now = new Date().toISOString();
        const nextOrder = {
          ...order,
          status:
            next === "failed" || next === "refunded"
              ? "cancelled"
              : order.status,
          payment: {
            ...order.payment,
            status: next,
            method: remote.payment_type || order.payment.method || "",
            transactionId:
              remote.transaction_id || order.payment.transactionId || "",
            ...(next === "paid" && !order.payment.paidAt
              ? { paidAt: now }
              : {}),
            ...(next === "refunded" ? { refundedAt: now } : {}),
            updatedAt: now,
          },
          ...(next === "refunded"
            ? {
                refund: {
                  ...(order.refund || {}),
                  status: "refunded",
                  amount: Number(remote.refund_amount || order.total),
                  currency: order.currency || "IDR",
                  reason:
                    order.refund?.reason || "Midtrans payment refunded",
                  requestedAt: order.refund?.requestedAt || now,
                  refundedAt: now,
                  reference:
                    remote.transaction_id ||
                    order.refund?.reference ||
                    `MID-${id.slice(-8)}`,
                },
              }
            : {}),
        };
        await db.transitionOrderAtomic({
          orderId: id,
          expectedStatus: order.status,
          expectedPaymentStatus: order.payment.status,
          nextOrder,
          restoreStock: shouldRestore,
        });
      };
      if (webhook) {
        if (!verifyNotification(body, midtransKey))
          fail(403, "Invalid payment signature");
        await syncPayment(str(body.order_id, 80));
        send(200, { ok: true });
        return;
      }
      if (path === "/api/payments/status") {
        requireUser();
        const o = await db.getOrder(str(body.id, 80));
        if (!o || (u.role !== "admin" && o.memberId !== u.id))
          fail(403, "Order access denied");
        await syncPayment(o.id);
        send(200, await state(u));
        return;
      }
      if (path === "/api/payments/quote") {
        requireUser();
        if (!gateway) fail(503, "Midtrans is not configured");
        const [coupon, products] = await Promise.all([
          body.code ? db.getCoupon(String(body.code).toUpperCase()) : Promise.resolve(null),
          db.listProducts(),
        ]);
        if (body.code && !coupon?.active)
          fail(400, "Promotion is no longer valid");
        try {
          send(
            200,
            idrQuote(
              body.lines,
              products,
              coupon,
              body.express === true,
              idrShipping,
            ),
          );
        } catch (e) {
          fail(400, e.message);
        }
        return;
      }
      const preparePayment = async (order) => {
        if (
          !order.payment ||
          order.payment.url ||
          order.payment.status !== "pending"
        )
          return order;
        if (!gateway) fail(503, "Midtrans is not configured");
        let url;
        try {
          url = await gateway.create(order);
        } catch {
          fail(
            502,
            "Payment page unavailable. Retry with the same checkout or contact the store; stock is reserved.",
          );
        }
        const latest = await db.getOrder(order.id);
        return await db.saveOrder({ ...latest, payment: { ...latest.payment, url } });
      };
      if (path.startsWith("/api/auth/") || path.startsWith("/api/member/verify/")) {
        const now = Date.now();
        if (attempts.size > 500) {
          for (const [k, v] of attempts) if (v.until <= now) attempts.delete(k);
        }
        const forwarded = trustProxy
          ? String(forwardedFor || "")
              .split(",")[0]
              .trim()
          : "";
        const ip = forwarded || remoteAddress || "unknown";
        const key = `${ip}:${path}`;
        const old = attempts.get(key);
        const bucket =
          old && old.until > now ? old : { count: 0, until: now + 60000 };
        if (++bucket.count > 20)
          fail(429, "Too many attempts. Try again in a minute.");
        attempts.set(key, bucket);
      }
      if (path === "/api/auth/google") {
        if (!googleClientId) fail(503, "Google sign-in is not configured");
        let profile;
        try {
          profile = await verifyGoogleToken(
            str(body.credential, 12000),
            googleClientId,
          );
        } catch {
          fail(401, "Google sign-in could not be verified");
        }
        const nonce = cookieHeader
          .split(";")
          .map((x) => x.trim())
          .find((x) => x.startsWith("solere_google="))
          ?.slice(14);
        if (
          !nonce ||
          profile?.nonce !== nonce ||
          !profile?.sub ||
          !profile.email_verified
        )
          fail(401, "Invalid Google identity");
        const consumed = await db.consumeGoogleChallenge(
          hashToken(nonce),
          Date.now(),
        );
        if (!consumed)
          fail(401, "Google sign-in expired. Reload and try again.");
        let user = await db.getUserByGoogleSub(profile.sub);
        if (!user) {
          const e = email(profile.email);
          if (await db.getUserByEmail(e))
            fail(
              409,
              "This email already has an account. Sign in with your password.",
            );
          user = { id: randomUUID(), email: e, role: "member" };
          await db.createUserWithMember(
            {
              id: user.id,
              email: e,
              password: hashPassword(randomBytes(48).toString("hex")),
              role: "member",
            },
            {
              id: user.id,
              email: e,
              name: str(profile.name || e.split("@")[0], 120),
              phone: "",
              emailVerified: true,
              phoneVerified: false,
              addresses: [],
            },
            profile.sub,
          );
        } else {
          const existingMember = await db.getMember(user.id);
          if (existingMember && !existingMember.emailVerified) {
            await db.putMember({ ...existingMember, emailVerified: true });
          }
        }
        await session(setCookie, user);
        send(200, await state(user));
        return;
      }
      if (path === "/api/auth/forgot") {
        if (!sendReset)
          fail(503, "Email recovery is not configured. Contact the store.");
        const user = await db.getUserByEmail(email(body.email));
        if (user) {
          const token = randomBytes(32).toString("hex");
          const now = Date.now();
          await db.saveRecoveryToken(
            hashToken(token),
            user.id,
            now + 900000,
            now,
          );
          try {
            await sendReset(body.email, token);
          } catch {
            await db.deleteRecoveryToken(hashToken(token));
          }
        }
        send(200, { ok: true });
        return;
      }
      if (path === "/api/auth/reset") {
        const password = validPassword(body.password);
        const resetOk = await db.resetPasswordWithToken(
          hashToken(str(body.token, 128)),
          Date.now(),
          hashPassword(password),
        );
        if (!resetOk) fail(400, "Recovery code is invalid or expired");
        send(200, { ok: true });
        return;
      }
      if (
        path === "/api/auth/otp/request" ||
        path === "/api/auth/otp/verify"
      ) {
        const channel =
          body.channel === "phone" || body.channel === "whatsapp"
            ? "phone"
            : "email";
        const target =
          channel === "phone"
            ? normalizePhone(body.phone || "") ||
              fail(400, "WhatsApp number is required")
            : email(body.email);
        const key = `auth:${channel}:${target}`;
        if (path === "/api/auth/otp/request") {
          send(
            200,
            await deliverOtp({
              key,
              channel,
              destination: target,
              headline: "Kode masuk OTP",
            }),
          );
          return;
        }
        await verifyOtpCode(key, body.code, { deleteOnSuccess: false });
        let user = null;
        if (channel === "phone") {
          const matched = await db.findMemberByPhone(target);
          user = matched ? await db.getUserById(matched.id) : null;
        } else {
          user = await db.getUserByEmail(target);
        }
        if (user) {
          await db.deleteVerificationCode(key);
          const existingMember = await db.getMember(user.id);
          if (existingMember) {
            const verifyField =
              channel === "email" && !existingMember.emailVerified
                ? { emailVerified: true }
                : channel === "phone" && !existingMember.phoneVerified
                  ? { phoneVerified: true }
                  : null;
            if (verifyField) {
              await db.putMember({ ...existingMember, ...verifyField });
            }
          }
          await session(setCookie, user);
          send(200, await state(user));
          return;
        }
        const trimmedName =
          typeof body.name === "string" ? body.name.trim() : "";
        if (!trimmedName) {
          send(200, { needsName: true, channel });
          return;
        }
        const memberName = str(trimmedName, 120);
        await db.deleteVerificationCode(key);
        const memberEmail =
          channel === "phone"
            ? `wa.${target.slice(1)}@wa.valerieco.id`
            : target;
        if (channel === "phone" && (await db.findMemberByPhone(target)))
          fail(409, "WhatsApp number is already registered");
        if (await db.getUserByEmail(memberEmail))
          fail(409, "Email is already registered");
        user = { id: randomUUID(), email: memberEmail, role: "member" };
        await db.createUserWithMember(
          {
            id: user.id,
            email: memberEmail,
            password: hashPassword(randomBytes(48).toString("hex")),
            role: "member",
          },
          {
            id: user.id,
            email: memberEmail,
            name: memberName,
            phone: channel === "phone" ? target : "",
            emailVerified: channel === "email",
            phoneVerified: channel === "phone",
            addresses: [],
          },
        );
        await session(setCookie, user);
        send(200, await state(user));
        return;
      }
      const validRegistrationName = (rawName) => {
        const name = str(rawName, 120);
        if (name.length < 2) fail(400, "Name must be at least 2 characters");
        return name;
      };
      const resolveRegistrationTarget = async (payload) => {
        const usePhone =
          payload.channel === "phone" ||
          payload.channel === "whatsapp" ||
          (!String(payload.email || "").trim() &&
            Boolean(String(payload.phone || "").trim()));
        const phone = normalizePhone(payload.phone || "");
        const memberEmail = usePhone
          ? phone
            ? `wa.${phone.slice(1)}@wa.valerieco.id`
            : fail(400, "WhatsApp number is required")
          : email(payload.email);
        const channel = usePhone ? "phone" : "email";
        const destination = usePhone ? phone : memberEmail;
        if (await db.getUserByEmail(memberEmail))
          fail(409, "Email is already registered");
        if (phone && (await db.findMemberByPhone(phone)))
          fail(409, "WhatsApp number is already registered");
        return { channel, destination, memberEmail, phone };
      };
      if (path === "/api/auth/register/request") {
        validRegistrationName(body.name);
        validPassword(body.password);
        const { channel, destination } = await resolveRegistrationTarget(body);
        send(
          200,
          await deliverOtp({
            key: `reg:${channel}:${destination}`,
            channel,
            destination,
            headline: "Kode verifikasi pendaftaran",
          }),
        );
        return;
      }
      if (path === "/api/auth/register/verify") {
        const memberName = validRegistrationName(body.name);
        const password = validPassword(body.password);
        const { channel, destination, memberEmail, phone } =
          await resolveRegistrationTarget(body);
        const key = `reg:${channel}:${destination}`;
        await verifyOtpCode(key, body.code, { deleteOnSuccess: false });
        await db.deleteVerificationCode(key);
        const user = { id: randomUUID(), email: memberEmail, role: "member" };
        await db.createUserWithMember(
          {
            id: user.id,
            email: memberEmail,
            password: hashPassword(password),
            role: "member",
          },
          {
            id: user.id,
            email: memberEmail,
            name: memberName,
            phone,
            emailVerified: channel === "email",
            phoneVerified: channel === "phone",
            addresses: [],
          },
        );
        await session(setCookie, user);
        send(200, await state(user));
        return;
      }
      if (
        ["/api/auth/login", "/api/auth/register", "/api/auth/setup"].includes(
          path,
        )
      ) {
        const phone = normalizePhone(body.phone || "");
        const e =
          typeof body.email === "string" && body.email.trim()
            ? email(body.email)
            : phone
              ? `wa.${phone.slice(1)}@wa.valerieco.id`
              : fail(400, "Email or WhatsApp number is required");
        const password = str(body.password, 256);
        let user;
        if (path === "/api/auth/login") {
          if (phone && (!body.email || !String(body.email).trim())) {
            const matchedMember = await db.findMemberByPhone(phone);
            user = matchedMember ? await db.getUserById(matchedMember.id) : null;
          } else {
            user = await db.getUserByEmail(e);
          }
          if (!user || !checkPassword(password, user.password))
            fail(401, "Credentials or password is incorrect");
        } else {
          validPassword(password);
          if (path === "/api/auth/setup") {
            if (!setupToken || body.setupToken !== setupToken)
              fail(403, "Invalid setup token");
            if (await db.hasAdmin()) fail(409, "Admin already exists");
          }
          if (await db.getUserByEmail(e)) fail(409, "Email is already registered");
          if (phone && (await db.findMemberByPhone(phone)))
            fail(409, "WhatsApp number is already registered");
          user = {
            id: randomUUID(),
            email: e,
            role: path === "/api/auth/setup" ? "admin" : "member",
          };
          await db.createUserWithMember(
            {
              id: user.id,
              email: e,
              password: hashPassword(password),
              role: user.role,
            },
            {
              id: user.id,
              email: e,
              name: str(body.name, 120),
              phone,
              emailVerified: false,
              phoneVerified: false,
              addresses: [],
            },
          );
        }
        await session(setCookie, user);
        send(200, await state(user));
        return;
      }
      if (path === "/api/auth/logout") {
        const token = cookieHeader
          .split(";")
          .map((x) => x.trim())
          .find((x) => x.startsWith("solere_session="))
          ?.slice(15);
        if (token) await db.deleteSession(hashToken(token));
        setCookie(
          `solere_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secureCookie ? "; Secure" : ""}`,
        );
        send(200, await state(null));
        return;
      }
      if (path === "/api/auth/password") {
        requireUser();
        const old = await db.getUserById(u.id);
        if (!checkPassword(str(body.current, 256), old.password))
          fail(400, "Current password is incorrect");
        const password = validPassword(body.password);
        await db.updatePasswordAndClearSessions(u.id, hashPassword(password));
        await session(setCookie, u);
        send(200, { ok: true });
        return;
      }
      if (path === "/api/member/verify/request") {
        requireUser();
        const channel = body.channel === "phone" ? "phone" : "email";
        const m = await db.getMember(u.id);
        if (!m) fail(404, "Member profile not found");
        if (channel === "phone" && !m.phone)
          fail(400, "Save your WhatsApp number first");
        if (
          channel === "email" &&
          (m.email.endsWith("@wa.valerieco.id") ||
            m.email.endsWith("@wa.solere.local"))
        )
          fail(400, "Add a valid email address first");
        const key = `v:${channel}:${u.id}`;
        send(
          200,
          await deliverOtp({
            key,
            channel,
            destination: channel === "phone" ? m.phone : m.email,
            headline:
              channel === "phone"
                ? "Kode verifikasi WhatsApp"
                : "Kode verifikasi email",
          }),
        );
        return;
      }
      if (path === "/api/member/verify/confirm") {
        requireUser();
        const channel = body.channel === "phone" ? "phone" : "email";
        const key = `v:${channel}:${u.id}`;
        await verifyOtpCode(key, body.code);
        const m = await db.getMember(u.id);
        await db.putMember({
          ...m,
          ...(channel === "email"
            ? { emailVerified: true }
            : { phoneVerified: true }),
        });
        send(200, await state(u));
        return;
      }
      if (path === "/api/coupon") {
        const c = await db.getCoupon(str(body.code, 20).toUpperCase());
        if (!c?.active) fail(400, "Invalid promotion code");
        send(200, c);
        return;
      }
      if (path === "/api/patch") {
        const changes = body.changes;
        if (!Array.isArray(changes) || changes.length > 200)
          fail(400, "Invalid changes");
        const needsSettingsOrProducts = changes.some((c) =>
          ["settings", "products", "products_delete"].includes(c.kind),
        );
        const [initialProducts, initialSettings, initialMember] = await Promise.all([
          needsSettingsOrProducts ? db.listProducts() : Promise.resolve([]),
          needsSettingsOrProducts ? db.getSettings() : Promise.resolve(null),
          u && changes.some((c) => c.kind === "members")
            ? db.getMember(u.id)
            : Promise.resolve(null),
        ]);
        const virtualProductIds = new Set(initialProducts.map((p) => p.id));
        let virtualSettings = initialSettings;
        let virtualMember = initialMember;
        const ticketIds = [
          ...new Set(
            changes
              .filter((c) => c.kind === "tickets" && typeof c.data?.id === "string")
              .map((c) => str(c.data.id, 80)),
          ),
        ];
        const ticketEntries = await Promise.all(
          ticketIds.map(async (id) => [id, await db.getTicket(id)]),
        );
        const ticketMap = new Map(ticketEntries);
        const ops = [];
        for (const change of changes) {
          const { kind, data } = change;
          if (kind === "products") {
            requireAdmin();
            const p = product(data);
            virtualProductIds.add(p.id);
            ops.push({ kind: "products", data: p });
          } else if (kind === "products_delete") {
            requireAdmin();
            const id = str(data?.id, 80);
            virtualProductIds.delete(id);
            if (virtualSettings?.homepage?.productIds?.includes(id)) {
              virtualSettings = {
                ...virtualSettings,
                homepage: {
                  ...virtualSettings.homepage,
                  productIds: virtualSettings.homepage.productIds.filter(
                    (x) => x !== id,
                  ),
                },
              };
            }
            ops.push({ kind: "products_delete", id });
          } else if (kind === "coupons") {
            requireAdmin();
            const code = str(data.code, 20).toUpperCase();
            if (!/^[A-Z0-9]{3,20}$/.test(code)) fail(400, "Invalid code");
            ops.push({
              kind: "coupons",
              data: {
                code,
                percent: integer(data.percent, 1, 90),
                active: !!data.active,
              },
            });
          } else if (kind === "coupons_delete") {
            requireAdmin();
            const code = str(data?.id || data?.code, 20).toUpperCase();
            ops.push({ kind: "coupons_delete", code });
          } else if (kind === "settings") {
            requireAdmin();
            const homepage = data.homepage ?? virtualSettings?.homepage;
            if (
              homepage &&
              (!["manual", "bestsellers"].includes(homepage.mode) ||
                !Array.isArray(homepage.productIds) ||
                homepage.productIds.length > 200 ||
                homepage.productIds.some(
                  (id) => typeof id !== "string" || !virtualProductIds.has(id),
                ))
            )
              fail(400, "Invalid homepage selection");
            virtualSettings = {
              ...(homepage
                ? {
                    homepage: {
                      mode: homepage.mode,
                      productIds: [...new Set(homepage.productIds)],
                    },
                  }
                : {}),
              name: str(data.name, 24),
              email: email(data.email),
              announcement: {
                id: str(data.announcement?.id, 300),
                en: str(data.announcement?.en, 300),
              },
            };
            ops.push({ kind: "settings", data: virtualSettings });
          } else if (kind === "members") {
            requireUser();
            if (data.id !== u.id) fail(403, "Profile access denied");
            const m = virtualMember;
            if (!Array.isArray(data.addresses) || data.addresses.length > 30)
              fail(400, "Too many addresses");
            const avatar =
              typeof data.avatar === "string" && data.avatar.trim()
                ? isSafeImageUrl(data.avatar.trim())
                  ? data.avatar.trim()
                  : fail(400, "Invalid avatar image")
                : "";
            const bio =
              typeof data.bio === "string" ? data.bio.trim().slice(0, 240) : "";
            const preferredSize =
              Number.isInteger(data.preferredSize) &&
              data.preferredSize >= 30 &&
              data.preferredSize <= 50
                ? data.preferredSize
                : undefined;
            const preferences =
              data.preferences && typeof data.preferences === "object"
                ? {
                    promoEmails: !!data.preferences.promoEmails,
                    orderAlerts: data.preferences.orderAlerts !== false,
                  }
                : m.preferences;
            const rawRecovery =
              typeof data.security?.recoveryEmail === "string"
                ? data.security.recoveryEmail.trim()
                : "";
            const security =
              data.security && typeof data.security === "object"
                ? {
                    twoFactorEnabled: !!data.security.twoFactorEnabled,
                    loginAlerts: data.security.loginAlerts !== false,
                    sessionTimeout: ["7d", "24h", "strict"].includes(
                      data.security.sessionTimeout,
                    )
                      ? data.security.sessionTimeout
                      : "7d",
                    recoveryEmail: rawRecovery ? email(rawRecovery) : "",
                    lastPasswordChange:
                      typeof data.security.lastPasswordChange === "string"
                        ? data.security.lastPasswordChange.slice(0, 40)
                        : m.security?.lastPasswordChange || "",
                  }
                : m.security;
            const nextPhone = normalizePhone(data.phone || "");
            const phoneChanged = nextPhone !== (m.phone || "");
            if (phoneChanged && nextPhone) {
              const conflict = await db.findMemberByPhone(nextPhone);
              if (conflict && conflict.id !== u.id)
                fail(409, "WhatsApp number is already registered");
            }
            virtualMember = {
              ...m,
              name: str(data.name, 120),
              phone: nextPhone,
              emailVerified: !!m.emailVerified,
              phoneVerified: phoneChanged ? false : !!m.phoneVerified,
              avatar,
              bio,
              ...(preferredSize !== undefined ? { preferredSize } : {}),
              ...(preferences ? { preferences } : {}),
              ...(security ? { security } : {}),
              addresses: data.addresses.map(address),
            };
            ops.push({ kind: "members", data: virtualMember });
          } else if (kind === "tickets") {
            requireUser();
            const id = str(data.id, 80);
            const old = ticketMap.get(id);
            let nextTicket;
            if (old) {
              requireAdmin();
              nextTicket = {
                ...old,
                reply: str(data.reply, 10000),
                status: data.status === "closed" ? "closed" : "open",
              };
            } else {
              nextTicket = {
                id,
                memberId: u.id,
                subject: str(data.subject, 150),
                message: str(data.message, 10000),
                reply: "",
                status: "open",
                date: new Date().toISOString(),
              };
            }
            ticketMap.set(id, nextTicket);
            ops.push({ kind: "tickets", data: nextTicket });
          } else if (kind === "subscribers") {
            const e = email(data.email);
            ops.push({ kind: "subscribers", email: e });
          } else fail(400, "Unsupported change");
        }
        await db.applyOps(ops);
        send(200, await state(u));
        return;
      }
      if (path === "/api/orders/create") {
        requireUser();
        const key = str(body.key, 80);
        const previous = await db.getOrderByCheckoutKey(u.id, key);
        if (previous) {
          send(200, {
            order: await preparePayment(previous),
            state: await state(u),
          });
          return;
        }
        if (gateway && body.payment !== "midtrans")
          fail(400, "Choose Midtrans payment");
        if (body.payment === "midtrans" && !gateway)
          fail(503, "Midtrans is not configured");
        const m = await db.getMember(u.id);
        const created = await db.createOrderAtomic(u.id, key, (catalog, getCoupon) => {
          const lines = body.lines;
          if (!Array.isArray(lines) || !lines.length || lines.length > 100)
            fail(400, "Invalid bag");
          const orderCurrency =
            body.payment === "midtrans" || body.currency === "IDR" ? "IDR" : "USD";
          const quantities = new Map();
          const items = lines.map((l) => {
            const p = catalog.get(str(l.productId, 80));
            if (!p?.active) fail(409, "A product is unavailable");
            integer(l.quantity, 1, 100);
            if (
              !p.sizes.includes(l.size) ||
              !p.colors.some((c) => c.name === l.color)
            )
              fail(400, "Invalid size or colour");
            quantities.set(p.id, (quantities.get(p.id) || 0) + l.quantity);
            const unitPrice =
              orderCurrency === "IDR"
                ? p.priceIdr && Number.isSafeInteger(p.priceIdr) && p.priceIdr > 0
                  ? p.priceIdr
                  : Math.round((p.price || 0) * 15000)
                : p.price;
            return {
              productId: p.id,
              productCode: p.details?.code || p.id.toUpperCase(),
              size: l.size,
              color: l.color,
              quantity: l.quantity,
              name: p.name,
              image: p.images[0],
              price: unitPrice,
            };
          });
          for (const [id, qty] of quantities) {
            const p = catalog.get(id);
            if (p.stock < qty) fail(409, "Insufficient stock");
          }
          const subtotal = items.reduce((n, i) => n + i.price * i.quantity, 0);
          const coupon = body.code
            ? getCoupon(String(body.code).toUpperCase())
            : null;
          if (body.code && !coupon?.active)
            fail(400, "Promotion is no longer valid");
          const discount =
            orderCurrency === "IDR"
              ? Math.round((subtotal * (coupon?.percent || 0)) / 100)
              : Math.round(subtotal * (coupon?.percent || 0)) / 100;
          const shipping =
            orderCurrency === "IDR"
              ? body.express === true
                ? idrShipping.express
                : subtotal >= idrShipping.freeAbove
                  ? 0
                  : idrShipping.standard
              : body.express === true
                ? 25
                : subtotal >= 250
                  ? 0
                  : 15;
          let quote;
          if (body.payment === "midtrans") {
            try {
              quote = idrQuote(
                lines,
                [...catalog.values()],
                coupon,
                body.express === true,
                idrShipping,
              );
            } catch (e) {
              fail(400, e.message);
            }
          }
          if (quote && body.expectedTotal !== quote.total)
            fail(409, "IDR total changed. Refresh the quote before checkout.");
          const orderId = "SOL-" + randomUUID();
          const receiptNumber =
            "VCO-INV-" + orderId.replace(/^SOL-/, "").slice(0, 8).toUpperCase();
          return {
            id: orderId,
            receiptNumber,
            memberId: u.id,
            name: m.name,
            email: u.email,
            date: new Date().toISOString(),
            status: "processing",
            paymentMethod: quote ? "midtrans" : "direct",
            currency: orderCurrency,
            items,
            total:
              orderCurrency === "IDR"
                ? Math.round(subtotal - discount + shipping)
                : Math.round((subtotal - discount + shipping) * 100) / 100,
            discount,
            shipping,
            address: address(body.address),
            tracking: "",
            ...(quote
              ? {
                  items: items.map((item, i) => ({
                    ...item,
                    price: quote.items[i].price,
                  })),
                  total: quote.total,
                  shipping: quote.shipping,
                  discount: quote.discount,
                  currency: "IDR",
                  payment: {
                    provider: "midtrans",
                    status: "pending",
                    sandbox: !paymentProduction,
                  },
                }
              : {}),
          };
        });
        const order = await preparePayment(created.order);
        send(200, { order, state: await state(u) });
        return;
      }
      if (path === "/api/orders/update") {
        requireUser();
        const o = await db.getOrder(str(body.id, 80));
        if (!o) fail(404, "Order not found");
        if (
          u.role !== "admin" &&
          (o.memberId !== u.id || body.status !== "cancelled")
        )
          fail(403, "Order access denied");
        if (
          o.payment &&
          (o.payment.status !== "paid" || body.status === "cancelled")
        )
          fail(
            409,
            "Midtrans order requires verified payment; cancellation/refund must be handled in the payment dashboard",
          );
        const allowed = {
          processing: ["processing", "shipped", "cancelled"],
          shipped: ["shipped", "delivered"],
          delivered: [],
          cancelled: [],
        };
        if (!allowed[o.status].includes(body.status))
          fail(409, "Invalid order transition");
        const tracking =
          u.role === "admin"
            ? String(body.tracking || o.tracking).slice(0, 100)
            : o.tracking;
        if (body.status === "shipped" && !tracking.trim())
          fail(400, "Tracking number required");
        await db.transitionOrderAtomic({
          orderId: o.id,
          expectedStatus: o.status,
          expectedPaymentStatus: o.payment?.status || "",
          nextOrder: { ...o, status: body.status, tracking },
          restoreStock: body.status === "cancelled",
        });
        send(200, await state(u));
        return;
      }
      if (path === "/api/orders/refund") {
        requireUser();
        const id = str(body.id, 80);
        const o = await db.getOrder(id);
        if (!o) fail(404, "Order not found");
        const action =
          body.action || (u.role === "admin" ? "approve" : "request");
        if (!["request", "approve", "reject"].includes(action))
          fail(400, "Invalid refund action");
        if (action !== "request" && u.role !== "admin")
          fail(403, "Admin access required");
        if (action === "request" && o.memberId !== u.id && u.role !== "admin")
          fail(403, "Order access denied");
        const reason = str(body.reason, 400);
        const now = new Date().toISOString();
        if (action === "request") {
          if (o.status === "cancelled" || o.refund?.status === "refunded")
            fail(409, "Order is already cancelled or refunded");
          if (o.payment && o.payment.status !== "paid")
            fail(409, "Only paid orders can be requested for refund");
          await db.transitionOrderAtomic({
            orderId: o.id,
            expectedStatus: o.status,
            expectedPaymentStatus: o.payment?.status || "",
            nextOrder: {
              ...o,
              refund: {
                status: "requested",
                amount: o.total,
                currency: o.currency || "USD",
                reason,
                requestedAt: now,
              },
            },
            restoreStock: false,
          });
          send(200, await state(u));
          return;
        }
        if (action === "reject") {
          if (!o.refund || o.refund.status !== "requested")
            fail(409, "No pending refund request");
          await db.transitionOrderAtomic({
            orderId: o.id,
            expectedStatus: o.status,
            expectedPaymentStatus: o.payment?.status || "",
            nextOrder: {
              ...o,
              refund: {
                ...o.refund,
                status: "rejected",
                note: reason,
                refundedBy: u.email,
              },
            },
            restoreStock: false,
          });
          send(200, await state(u));
          return;
        }
        if (o.refund?.status === "refunded" || o.payment?.status === "refunded")
          fail(409, "Order has already been refunded");
        if (o.payment && o.payment.status !== "paid")
          fail(409, "Only paid Midtrans orders can be refunded");
        let refundRef = body.reference
          ? String(body.reference).trim().slice(0, 80)
          : "";
        if (o.payment && body.manual !== true && typeof gateway?.refund === "function") {
          const refundKey = `REF-${o.id.slice(-12)}-${Date.now()}`;
          try {
            const resRefund = await gateway.refund(o.id, {
              amount: o.total,
              reason,
              refundKey,
            });
            refundRef =
              refundRef ||
              resRefund?.refund_chargeback_id?.toString() ||
              resRefund?.transaction_id ||
              refundKey;
          } catch {
            fail(
              502,
              "Midtrans API refund unavailable for this method. Retry or record a manual bank transfer refund.",
            );
          }
        }
        if (!refundRef) refundRef = `VCO-REF-${randomUUID().slice(0, 8).toUpperCase()}`;
        const latest = await db.getOrder(id);
        if (!latest) fail(404, "Order not found");
        if (
          latest.refund?.status === "refunded" ||
          latest.payment?.status === "refunded"
        )
          fail(409, "Order has already been refunded");
        await db.transitionOrderAtomic({
          orderId: id,
          expectedStatus: latest.status,
          expectedPaymentStatus: latest.payment?.status || "",
          nextOrder: {
            ...latest,
            status: "cancelled",
            ...(latest.payment
              ? {
                  payment: {
                    ...latest.payment,
                    status: "refunded",
                    refundedAt: now,
                    updatedAt: now,
                  },
                }
              : {}),
            refund: {
              ...(latest.refund || {}),
              status: "refunded",
              amount: latest.total,
              currency: latest.currency || "USD",
              reason: latest.refund?.reason || reason,
              note: reason,
              requestedAt: latest.refund?.requestedAt || now,
              refundedAt: now,
              refundedBy: u.email,
              reference: refundRef,
            },
          },
          restoreStock:
            latest.status !== "cancelled" && latest.payment?.status !== "failed",
        });
        send(200, await state(u));
        return;
      }
      fail(404, "Not found");
    };
    try {
      await dispatch();
    } catch (e) {
      send(e.status || 500, {
        error: e.status ? e.message : "Server error. Please try again.",
      });
    }
    return {
      status,
      cookies,
      body: JSON.stringify(payload),
    };
  };
  const fetchHandler = async (request) => {
    const url = new URL(request.url);
    const rewritten = url.searchParams.get("__path");
    const pathname =
      rewritten &&
      (url.pathname === "/api/index" || url.pathname === "/api/index.js")
        ? `/api/${rewritten.replace(/^\/+/, "")}`
        : url.pathname;
    const host =
      request.headers.get("host") ||
      (trustProxy ? request.headers.get("x-forwarded-host") : "") ||
      url.host;
    const result = await handleApiRequest({
      method: request.method,
      path: pathname,
      origin: request.headers.get("origin") || "",
      host: host || "",
      secFetchSite: request.headers.get("sec-fetch-site") || "",
      contentType: request.headers.get("content-type") || "",
      cookieHeader: request.headers.get("cookie") || "",
      forwardedFor: request.headers.get("x-forwarded-for") || "",
      remoteAddress: "unknown",
      readRawBody: async () => {
        const len = Number(request.headers.get("content-length") || 0);
        if (len > 2500000) fail(413, "Request too large");
        if (!request.body) return "";
        const reader = request.body.getReader();
        const chunks = [];
        let total = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          total += value.byteLength;
          if (total > 2500000) {
            await reader.cancel().catch(() => {});
            fail(413, "Request too large");
          }
          chunks.push(value);
        }
        return Buffer.concat(chunks, total).toString("utf8");
      },
    });
    const headers = new Headers({
      ...SECURITY_HEADERS,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    });
    for (const c of result.cookies) headers.append("Set-Cookie", c);
    return new Response(result.body, { status: result.status, headers });
  };
  const server = http.createServer(async (req, res) => {
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.setHeader(k, v);
    const sendJson = (code, data, cookies = []) => {
      if (cookies.length) res.setHeader("Set-Cookie", cookies);
      res.writeHead(code, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      });
      res.end(typeof data === "string" ? data : JSON.stringify(data));
    };
    try {
      const url = new URL(req.url, "http://localhost");
      const path = url.pathname;
      if (!path.startsWith("/api/")) {
        const dist = resolve(root, "dist");
        let file = resolve(dist, "." + decodeURIComponent(path));
        if (!file.startsWith(dist + sep) && file !== dist)
          fail(403, "Forbidden");
        if (!extname(file) || !existsSync(file) || !statSync(file).isFile())
          file = resolve(dist, "index.html");
        if (!existsSync(file)) fail(404, "Build the app first");
        const types = {
          ".html": "text/html; charset=utf-8",
          ".js": "text/javascript; charset=utf-8",
          ".css": "text/css; charset=utf-8",
          ".json": "application/json; charset=utf-8",
          ".jpg": "image/jpeg",
          ".jpeg": "image/jpeg",
          ".png": "image/png",
          ".webp": "image/webp",
          ".avif": "image/avif",
          ".ico": "image/x-icon",
          ".svg": "image/svg+xml",
          ".woff2": "font/woff2",
          ".ttf": "font/ttf",
        };
        const isAsset = path.startsWith("/assets/");
        res.writeHead(200, {
          "Content-Type": types[extname(file).toLowerCase()] || "application/octet-stream",
          "Cache-Control": isAsset
            ? "public, max-age=31536000, immutable"
            : extname(file) === ".html"
              ? "no-cache"
              : "public, max-age=3600",
        });
        res.end(readFileSync(file));
        return;
      }
      const result = await handleApiRequest({
        method: req.method,
        path,
        origin: req.headers.origin || "",
        host:
          req.headers.host ||
          (trustProxy ? String(req.headers["x-forwarded-host"] || "") : ""),
        secFetchSite: String(req.headers["sec-fetch-site"] || ""),
        contentType: String(req.headers["content-type"] || ""),
        cookieHeader: req.headers.cookie || "",
        forwardedFor: String(req.headers["x-forwarded-for"] || ""),
        remoteAddress: req.socket?.remoteAddress || "unknown",
        readRawBody: async () => {
          let raw = "";
          for await (const chunk of req) {
            raw += chunk;
            if (Buffer.byteLength(raw) > 2500000) fail(413, "Request too large");
          }
          return raw;
        },
      });
      sendJson(result.status, result.body, result.cookies);
    } catch (e) {
      sendJson(e.status || 500, {
        error: e.status ? e.message : "Server error. Please try again.",
      });
    }
  });
  return {
    server,
    fetch: fetchHandler,
    sql: db.sql,
    db,
    backend: db.kind,
    ready,
    close: () => {
      server.close();
      db.close?.();
    },
  };
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const setupToken =
    process.env.SOLERE_SETUP_TOKEN || randomBytes(18).toString("hex");
  const app = createApp({ setupToken });
  const port = Number(process.env.PORT || 5174);
  const host = process.env.HOST || "127.0.0.1";
  app.server.listen(port, host, async () => {
    console.log(`Valerie & CO API (${app.backend}): http://${host}:${port}`);
    try {
      await app.ready;
      if (!(await app.db.hasAdmin()))
        console.log(
          `First admin setup token (local operator only): ${setupToken}`,
        );
    } catch (e) {
      if (e?.schemaMissing) {
        console.warn(
          "[Valerie & CO] Supabase schema belum dijalankan. Buka Supabase SQL Editor lalu jalankan supabase/migrations/202611130001_valerie_store.sql",
        );
      } else {
        console.error("[Valerie & CO] Database initialization warning:", e?.message || e);
      }
    }
  });
}
