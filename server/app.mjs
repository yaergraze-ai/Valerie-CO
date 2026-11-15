import {
  midtransClient,
  verifyNotification,
  paymentState,
  paymentOutcome,
  paymentFailureReason,
  idrQuote,
  supportsCoreCharge,
  buildFallbackDirectCharge,
  buildSwitchOrderId,
  isFallbackDirectCharge,
} from "./midtrans.mjs";
import {
  biteshipClient,
  searchShippingAreas,
  quoteShippingRates,
  verifyRateToken,
  mergeShippingSettings,
  sanitizeShippingSettings,
  computeBagShippingWeight,
} from "./shipping.mjs";
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
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
  "X-Frame-Options": "DENY",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(self)",
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self' https://accounts.google.com https://apis.google.com https://challenges.cloudflare.com; frame-src 'self' https://accounts.google.com https://app.midtrans.com https://app.sandbox.midtrans.com https://challenges.cloudflare.com https://www.openstreetmap.org; style-src 'self' 'unsafe-inline' https://accounts.google.com; img-src 'self' data: blob: https://*.googleusercontent.com https://*.gstatic.com https://*.tile.openstreetmap.org https://api.midtrans.com https://api.sandbox.midtrans.com; font-src 'self' data:; connect-src 'self' https://accounts.google.com https://challenges.cloudflare.com https://nominatim.openstreetmap.org;",
};
const hashToken = (t) => createHash("sha256").update(t).digest("hex");
const hashPassword = (p) => {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(p, salt, 64).toString("hex")}`;
};
const checkPassword = (p, encoded) => {
  if (!encoded || typeof encoded !== "string" || encoded.startsWith("nopwd:"))
    return false;
  const [salt, key] = encoded.split(":");
  if (!salt || !key) return false;
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
const address = (a) => {
  if (!a || typeof a !== "object") fail(400, "Invalid address");
  const lat = Number(a.lat);
  const lon = Number(a.lon);
  return {
    id: str(a.id, 80),
    label: str(a.label, 60),
    name: str(a.name, 120),
    phone: str(a.phone, 40),
    street: str(a.street, 400),
    city: str(a.city, 100),
    postal: str(a.postal, 20),
    ...(typeof a.province === "string" && a.province.trim()
      ? { province: a.province.trim().slice(0, 100) }
      : {}),
    ...(typeof a.areaId === "string" && a.areaId.trim()
      ? { areaId: a.areaId.trim().slice(0, 100) }
      : {}),
    ...(typeof a.areaName === "string" && a.areaName.trim()
      ? { areaName: a.areaName.trim().slice(0, 160) }
      : {}),
    ...(Number.isFinite(lat) && lat >= -90 && lat <= 90 ? { lat } : {}),
    ...(Number.isFinite(lon) && lon >= -180 && lon <= 180 ? { lon } : {}),
  };
};
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
  googleClientId: rawGoogleClientId = process.env.GOOGLE_CLIENT_ID,
  verifyGoogleToken = verifyGoogle,
  sendReset = resetMailer(),
  sendWhatsapp = whatsappMailer(),
  allowOtpPreview =
    process.env.NODE_ENV !== "production" &&
    process.env.VERCEL_ENV !== "production" &&
    process.env.VERCEL_ENV !== "preview",
  midtransKey = process.env.MIDTRANS_SERVER_KEY,
  paymentProduction = String(process.env.MIDTRANS_PRODUCTION || "").trim() === "true",
  gateway = midtransClient(String(midtransKey || "").trim(), paymentProduction),
  turnstileSiteKey =
    process.env.TURNSTILE_SITE_KEY || process.env.VITE_TURNSTILE_SITE_KEY || "",
  turnstileSecretKey = process.env.TURNSTILE_SECRET_KEY || "",
  verifyTurnstile = null,
  idrShipping = {
    standard: Number(process.env.SHIPPING_STANDARD_IDR || 25000),
    express: Number(process.env.SHIPPING_EXPRESS_IDR || 50000),
    freeAbove: Number(process.env.SHIPPING_FREE_ABOVE_IDR || 2000000),
  },
  biteshipKey: rawBiteshipKey = process.env.BITESHIP_API_KEY,
  shippingClient: rawShippingClient = undefined,
  shippingSecret = process.env.SHIPPING_TOKEN_SECRET,
  store = null,
  supabaseUrl = process.env.SUPABASE_URL,
  supabaseSecretKey = process.env.SUPABASE_SECRET_KEY,
} = {}) {
  const biteshipKey = String(rawBiteshipKey || "").trim();
  const activeBiteship =
    rawShippingClient !== undefined
      ? rawShippingClient
      : biteshipClient(biteshipKey);

  const resolveShippingSecret = () => {
    const explicit = String(shippingSecret || process.env.SHIPPING_TOKEN_SECRET || "").trim();
    if (explicit) return explicit;
    const seedVal = String(supabaseSecretKey || midtransKey || "").trim();
    if (seedVal) {
      return createHash("sha256").update("valerie-shipping-v1:" + seedVal).digest("hex");
    }
    return randomBytes(32).toString("hex");
  };
  const resolvedShippingSecret = resolveShippingSecret();

  const resolveIdrOrderQuote = ({
    lines,
    products,
    coupon,
    express = false,
    shippingOption = null,
    destinationPostal = "",
    settings = null,
  }) => {
    const effectiveShipping = mergeShippingSettings(
      settings?.shipping,
      idrShipping.freeAbove,
    );
    const catalogMap = (
      Array.isArray(products)
        ? products
        : [...(products?.values?.() || [])]
    ).map((p) => ({
      ...p,
      priceIdr:
        p.priceIdr && Number.isSafeInteger(p.priceIdr) && p.priceIdr > 0
          ? p.priceIdr
          : Math.round((p.price || 0) * 15000),
    }));
    const totalWeightGrams = computeBagShippingWeight(
      lines,
      catalogMap,
      effectiveShipping.defaultWeightGrams,
    );
    const baseQuote = idrQuote(
      lines,
      catalogMap,
      coupon,
      express,
      { ...idrShipping, ...effectiveShipping },
      { freeAboveOverride: effectiveShipping.freeAbove },
    );

    let verified = null;
    if (shippingOption && typeof shippingOption === "object" && shippingOption.rateToken) {
      const destPostal = String(destinationPostal || "").trim();
      verified = verifyRateToken(
        shippingOption.rateToken,
        {
          originPostal: effectiveShipping.originPostalCode,
          destPostal,
          totalWeightGrams,
          subtotal: baseQuote.subtotal,
          freeAbove: effectiveShipping.freeAbove,
        },
        resolvedShippingSecret,
      );
      if (!verified) {
        fail(
          409,
          "Ongkos kirim sudah berubah atau kedaluwarsa. Muat ulang pilihan kurir.",
        );
      }
    }

    const finalQuote = verified
      ? idrQuote(
          lines,
          catalogMap,
          coupon,
          express,
          { ...idrShipping, ...effectiveShipping },
          {
            shippingFeeOverride: verified.price,
            freeAboveOverride: effectiveShipping.freeAbove,
          },
        )
      : baseQuote;

    const shippingMeta = verified
      ? {
          courierCode: verified.courierCode,
          courierName: verified.courierName,
          serviceCode: verified.serviceCode,
          serviceName: verified.serviceName,
          serviceType: verified.serviceType,
          duration: verified.duration,
          rawPrice: verified.rawPrice,
          price: verified.price,
          freeApplied: verified.freeApplied,
          source: verified.source,
          weightGrams: totalWeightGrams,
          originPostalCode: effectiveShipping.originPostalCode,
          destPostalCode: String(destinationPostal || "").trim(),
        }
      : null;

    return {
      quote: finalQuote,
      shippingMeta,
      effectiveShipping,
      totalWeightGrams,
    };
  };
  const trimmedGoogleClientId = String(rawGoogleClientId || "").trim();
  const googleClientSecretMisconfigured = /^GOCSPX-/i.test(
    trimmedGoogleClientId,
  );
  // Client secrets (GOCSPX-...) must never be exposed via public /api/auth/config.
  const googleClientId = googleClientSecretMisconfigured
    ? ""
    : trimmedGoogleClientId;
  const trimmedTurnstileSiteKey = String(turnstileSiteKey || "").trim();
  const trimmedTurnstileSecretKey = String(turnstileSecretKey || "").trim();
  const checkTurnstile = async (token, remoteIp = "") => {
    if (!trimmedTurnstileSecretKey) return;
    const cleaned = str(token, 4096);
    if (!cleaned) {
      fail(400, "Selesaikan verifikasi keamanan Cloudflare terlebih dahulu");
    }
    const verifier =
      typeof verifyTurnstile === "function"
        ? verifyTurnstile
        : async (responseToken, ip) => {
            const form = new URLSearchParams({
              secret: trimmedTurnstileSecretKey,
              response: responseToken,
              ...(ip ? { remoteip: ip } : {}),
            });
            const res = await fetch(
              "https://challenges.cloudflare.com/turnstile/v0/siteverify",
              {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: form.toString(),
                signal: AbortSignal.timeout(8000),
              },
            );
            if (!res.ok) return { success: false };
            return await res.json();
          };
    let verdict;
    try {
      verdict = await verifier(cleaned, remoteIp);
    } catch {
      fail(502, "Verifikasi Cloudflare sementara tidak tersedia. Coba lagi.");
    }
    if (!verdict || verdict.success !== true) {
      fail(
        403,
        "Verifikasi keamanan Cloudflare gagal atau kedaluwarsa. Muat ulang centang keamanan.",
      );
    }
  };
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
    if (envAdminEmail) {
      const existingEnvAdmin = await db.getUserByEmail(envAdminEmail);
      if (existingEnvAdmin) {
        if (!isSuperAdminRole(existingEnvAdmin.role)) {
          await db.updateUserRole(existingEnvAdmin.id, "super_admin");
        }
        if (
          envAdminPassword &&
          envAdminPassword.length >= MIN_PASSWORD_LEN &&
          typeof existingEnvAdmin.password === "string" &&
          existingEnvAdmin.password.startsWith("nopwd:")
        ) {
          await db.updatePasswordAndClearSessions(
            existingEnvAdmin.id,
            hashPassword(envAdminPassword),
          );
        }
      } else if (
        envAdminPassword &&
        envAdminPassword.length >= MIN_PASSWORD_LEN
      ) {
        const adminId = randomUUID();
        const initialRole = (await db.hasAdmin()) ? "super_admin" : "admin";
        await db.createUserWithMember(
          {
            id: adminId,
            email: envAdminEmail,
            password: hashPassword(envAdminPassword),
            role: initialRole,
          },
          {
            id: adminId,
            email: envAdminEmail,
            name: process.env.ADMIN_NAME || "Valerie & CO Admin",
            phone: "",
            role: initialRole,
            emailVerified: true,
            hasPassword: true,
            addresses: [],
          },
          null,
          { ignoreConflict: true },
        );
      }
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

  const getCookieValue = (cookieHeader, name) =>
    cookieHeader
      .split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith(`${name}=`))
      ?.slice(name.length + 1) || "";

  const isHttpsCookieContext = ({
    origin = "",
    host = "",
    forwardedProto = "",
    protocol = "",
  } = {}) => {
    if (!secureCookie) return false;
    const proto = String(forwardedProto || protocol || "").toLowerCase();
    if (proto.startsWith("http:")) return false;
    if (proto === "http" && !process.env.VERCEL) return false;
    if (origin.startsWith("http://") && !process.env.VERCEL) return false;
    if (
      !process.env.VERCEL &&
      proto !== "https" &&
      !origin.startsWith("https://") &&
      /^(127\.0\.0\.1|localhost)(:\d+)?$/i.test(host)
    ) {
      return false;
    }
    return true;
  };

  const VALID_ROLES = new Set(["member", "staff", "admin", "super_admin"]);
  const isStaffRole = (role) =>
    role === "staff" || role === "admin" || role === "super_admin";
  const isAdminRole = (role) => role === "admin" || role === "super_admin";
  const isSuperAdminRole = (role) => role === "super_admin";

  const resolveEffectiveUser = async (user, prefetchedMember) => {
    if (!user) return null;
    const member =
      prefetchedMember !== undefined
        ? prefetchedMember
        : await db.getMember(user.id);
    const mRole = member?.role && VALID_ROLES.has(member.role) ? member.role : null;
    const uRole = VALID_ROLES.has(user.role) ? user.role : null;
    let effectiveRole =
      mRole && mRole !== "member"
        ? mRole
        : uRole && uRole !== "member"
          ? uRole
          : mRole || uRole || "member";
    const configuredAdminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    if (
      configuredAdminEmail &&
      user.email?.toLowerCase() === configuredAdminEmail &&
      effectiveRole === "member"
    ) {
      effectiveRole = "super_admin";
      await db.updateUserRole(user.id, "super_admin").catch(() => {});
    }
    return { ...user, role: effectiveRole };
  };

  const authenticate = async (cookieHeader = "") => {
    const token = getCookieValue(cookieHeader, "solere_session");
    if (!token) return null;
    const sessionUser = await db.getSessionUser(hashToken(token), Date.now());
    return resolveEffectiveUser(sessionUser);
  };
  const session = async (setCookie, user, useSecure = secureCookie) => {
    const token = randomBytes(32).toString("hex");
    const now = Date.now();
    await db.createSession(hashToken(token), user.id, now + 7 * 86400000, now);
    setCookie(
      `solere_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=604800${useSecure ? "; Secure" : ""}`,
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
      allTickets,
    ] = await Promise.all([
      db.listOrders(),
      db.listProducts(),
      db.getSettings(),
      db.hasAdmin(),
      u ? db.listMembers() : Promise.resolve([]),
      u ? db.listTickets() : Promise.resolve([]),
    ]);
    const ownMember = u ? allMembers.find((m) => m.id === u.id) || null : null;
    const resolved = u ? await resolveEffectiveUser(u, ownMember) : null;
    const role = resolved?.role || null;
    const [rawCoupons, allSubscribers, paymentQueue] = await Promise.all([
      db.listCoupons(),
      isAdminRole(role) ? db.listSubscribers() : Promise.resolve([]),
      isStaffRole(role) && typeof db.listPaymentQueue === "function"
        ? db.listPaymentQueue(40)
        : Promise.resolve(undefined),
    ]);
    const allCoupons = isAdminRole(role) ? rawCoupons : [];
    const promotions = rawCoupons
      .filter((c) => c.active)
      .map((c) => ({ code: c.code, percent: c.percent, active: true }));
    const effectiveShipping = mergeShippingSettings(
      settings?.shipping,
      idrShipping.freeAbove,
    );
    return {
      paymentConfig: {
        enabled: !!gateway,
        production: paymentProduction,
        shipping: {
          ...idrShipping,
          ...effectiveShipping,
          liveRatesEnabled: Boolean(activeBiteship),
        },
        coreApiEnabled: typeof gateway?.charge === "function",
        turnstileSiteKey: trimmedTurnstileSiteKey || null,
      },
      ...(paymentQueue ? { paymentQueue } : {}),
      sales: salesTotals(
        allOrders.filter(
          (o) =>
            o.status !== "cancelled" &&
            o.refund?.status !== "refunded" &&
            (!o.payment || o.payment.status === "paid"),
        ),
      ),
      products: allProducts.filter((p) => isStaffRole(role) || p.active),
      members: resolved
        ? allMembers
            .filter((m) => isStaffRole(role) || m.id === resolved.id)
            .map((m) => ({
              ...m,
              role: VALID_ROLES.has(m.role)
                ? m.role
                : m.id === resolved.id
                  ? role
                  : "member",
            }))
        : [],
      orders: resolved
        ? allOrders.filter((o) => isStaffRole(role) || o.memberId === resolved.id)
        : [],
      coupons: allCoupons,
      promotions,
      tickets: resolved
        ? allTickets.filter((t) => isStaffRole(role) || t.memberId === resolved.id)
        : [],
      subscribers: allSubscribers,
      settings: settings ? { ...settings, shipping: effectiveShipping } : settings,
      currentUser: resolved ? { id: resolved.id, role: resolved.role } : null,
      needsAdmin: !adminExists,
    };
  };
  const attempts = new Map();
  const orderLocks = new Map();
  const enqueueOrderTask = (orderId, fn) => {
    const key = String(orderId || "global");
    const prev = orderLocks.get(key) || Promise.resolve();
    const next = prev.then(fn, fn);
    const guard = next
      .finally(() => {
        if (orderLocks.get(key) === guard) orderLocks.delete(key);
      })
      .catch(() => {});
    orderLocks.set(key, guard);
    return next;
  };
  const handleApiRequest = async ({
    method,
    path: rawPath,
    searchParams = null,
    origin = "",
    host = "",
    secFetchSite = "",
    contentType = "",
    cookieHeader = "",
    forwardedProto = "",
    protocol = "",
    forwardedFor = "",
    remoteAddress = "unknown",
    readRawBody,
  }) => {
    let requestPath = rawPath;
    let queryParams = searchParams;
    if (requestPath.includes("?")) {
      const [cleanPath, qs] = requestPath.split("?");
      requestPath = cleanPath;
      if (!queryParams || !queryParams.toString()) {
        queryParams = new URLSearchParams(qs);
      }
    }
    const path = requestPath;
    const cookies = [];
    const useSecureCookie = isHttpsCookieContext({
      origin,
      host,
      forwardedProto,
      protocol,
    });
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
      const requireUser = () => {
        if (!u) fail(401, "Sign in required");
      };
      const requireStaff = () => {
        requireUser();
        if (!isStaffRole(u.role)) fail(403, "Staff access required");
      };
      const requireAdmin = () => {
        requireUser();
        if (!isAdminRole(u.role)) fail(403, "Admin access required");
      };
      if (requestPath === "/api/state" && method === "GET") {
        send(200, await state(u));
        return;
      }
      if (requestPath === "/api/shipping/areas" && method === "GET") {
        requireUser();
        const q = queryParams?.get?.("q") || "";
        const areas = await searchShippingAreas({
          biteship: activeBiteship,
          query: q,
        });
        send(200, { areas });
        return;
      }
      if (requestPath === "/api/auth/config" && method === "GET") {
        const nonce = randomBytes(24).toString("hex");
        const now = Date.now();
        await db.saveGoogleChallenge(hashToken(nonce), now + 1800000, now);
        const prevNonces = getCookieValue(cookieHeader, "solere_google")
          .split(".")
          .filter((x) => /^[a-f0-9]{16,128}$/i.test(x) && x !== nonce)
          .slice(0, 3);
        const cookieNonces = [nonce, ...prevNonces];
        setCookie(
          `solere_google=${cookieNonces.join(".")}; Path=/api/auth; HttpOnly; SameSite=Strict; Max-Age=1800${useSecureCookie ? "; Secure" : ""}`,
        );
        send(200, {
          googleClientId: googleClientId || null,
          ...(googleClientSecretMisconfigured
            ? { googleIssue: "secret_in_client_id" }
            : {}),
          turnstileSiteKey: trimmedTurnstileSiteKey || null,
          nonce,
          recovery: !!sendReset,
          emailOtp: !!sendReset,
          whatsappOtp: !!sendWhatsapp,
        });
        return;
      }
      if (method !== "POST") fail(405, "Method not allowed");
      const webhook = requestPath === "/api/payments/midtrans/notification";
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
      const requestIp =
        (trustProxy
          ? String(forwardedFor || "")
              .split(",")[0]
              .trim()
          : "") ||
        remoteAddress ||
        "";
      const finishUrl =
        useSecureCookie && host && !/^(127\.0\.0\.1|localhost)(:\d+)?$/i.test(host)
          ? `https://${host}/#member`
          : "";
      const syncPaymentOnce = async (id) => {
        if (!gateway) fail(503, "Midtrans is not configured");
        const existing = await db.getOrder(id);
        if (!existing?.payment) fail(404, "Payment order not found");
        if (existing.payment.status === "refunded") return existing;
        const gatewayOrderId = existing.payment.gatewayOrderId || id;
        const remote = await gateway.status(gatewayOrderId);
        if (String(remote.status_code) === "404") return existing;
        const order = (await db.getOrder(id)) || existing;
        if (!order?.payment) fail(404, "Payment order not found");
        if (
          (remote.order_id !== id &&
            remote.order_id !== (order.payment.gatewayOrderId || id)) ||
          Number(remote.gross_amount) !== order.total ||
          remote.currency !== "IDR"
        )
          fail(409, "Payment amount mismatch");
        const next = paymentState(remote);
        const outcome = paymentOutcome(remote);
        const rawStatus = String(remote.transaction_status || "").toLowerCase();
        const statusReason = paymentFailureReason(remote);
        const resolvedExpiry = String(
          remote.expiry_time ||
            order.payment.expiryTime ||
            order.payment.directCharge?.expiryTime ||
            "",
        );
        if (
          order.payment.status === "refunded" ||
          (order.payment.status === "paid" && next !== "refunded") ||
          (order.payment.status === "failed" && next !== "paid")
        ) {
          return order;
        }
        if (order.payment.status === "failed" && next === "paid")
          fail(409, "Late settlement requires manual reconciliation");
        if (
          order.payment.status === next &&
          order.payment.outcome === outcome &&
          (!remote.transaction_id || order.payment.transactionId === remote.transaction_id) &&
          (!resolvedExpiry || order.payment.expiryTime === resolvedExpiry)
        )
          return order;
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
            outcome,
            ...(rawStatus ? { rawStatus } : {}),
            ...(statusReason ? { statusReason } : {}),
            ...(resolvedExpiry ? { expiryTime: resolvedExpiry } : {}),
            method: remote.payment_type || order.payment.method || "",
            transactionId:
              remote.transaction_id || order.payment.transactionId || "",
            ...(next === "paid" && !order.payment.paidAt
              ? { paidAt: now }
              : {}),
            ...(outcome === "expired" && !order.payment.expiredAt
              ? { expiredAt: now }
              : {}),
            ...(outcome === "cancelled" && !order.payment.cancelledAt
              ? {
                  cancelledAt: now,
                  cancelledBy: order.payment.cancelledBy || "gateway",
                }
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
        try {
          return await db.transitionOrderAtomic({
            orderId: id,
            expectedStatus: order.status,
            expectedPaymentStatus: order.payment.status,
            nextOrder,
            restoreStock: shouldRestore,
          });
        } catch (err) {
          if (err?.status === 409) {
            const latest = await db.getOrder(id);
            if (
              latest?.payment?.status === next ||
              latest?.payment?.status === "paid" ||
              latest?.payment?.status === "refunded"
            )
              return latest;
          }
          throw err;
        }
      };
      const drainOrderQueue = async (orderId, { throwClientError = false } = {}) => {
        return enqueueOrderTask(orderId, async () => {
          if (typeof db.claimPaymentJobs !== "function") {
            await syncPaymentOnce(orderId);
            return { processed: 1, done: 1, retried: 0, failed: 0 };
          }
          const jobs = await db.claimPaymentJobs({
            orderId,
            now: Date.now(),
            lockTimeoutMs: 30000,
            limit: 10,
          });
          let done = 0;
          let retried = 0;
          let failed = 0;
          for (const job of jobs) {
            try {
              await syncPaymentOnce(job.orderId || orderId);
              await db.finishPaymentJob({
                id: job.id,
                status: "done",
                attempts: (job.attempts || 0) + 1,
                nextRunAt: 0,
                lastError: "",
              });
              done++;
            } catch (err) {
              const attemptsCount = (job.attempts || 0) + 1;
              const isClientConflict = Boolean(err?.status && err.status >= 400 && err.status < 500);
              if (!isClientConflict && attemptsCount < 5) {
                const delayMs = Math.min(300000, 5000 * 2 ** attemptsCount);
                await db.finishPaymentJob({
                  id: job.id,
                  status: "pending",
                  attempts: attemptsCount,
                  nextRunAt: Date.now() + delayMs,
                  lastError: err?.message || "Transient gateway error",
                });
                retried++;
              } else {
                await db.finishPaymentJob({
                  id: job.id,
                  status: "failed",
                  attempts: attemptsCount,
                  nextRunAt: 0,
                  lastError: err?.message || "Payment sync failed",
                });
                failed++;
                if (throwClientError && isClientConflict) throw err;
              }
            }
          }
          return { processed: jobs.length, done, retried, failed };
        });
      };
      if (webhook) {
        if (!verifyNotification(body, String(midtransKey || "").trim()))
          fail(403, "Invalid payment signature");
        const rawOrderId = str(body.order_id, 80);
        const orderId = rawOrderId.split("--")[0];
        const dedupeKey = [
          rawOrderId,
          String(body.status_code || ""),
          String(body.transaction_status || ""),
          String(body.gross_amount || ""),
          String(body.transaction_id || ""),
          String(body.fraud_status || ""),
        ].join(":");
        if (typeof db.enqueuePaymentJob === "function") {
          const enq = await db.enqueuePaymentJob({
            id: "pq-" + randomUUID(),
            dedupeKey,
            orderId,
            kind: "midtrans_webhook",
            payload: {
              order_id: orderId,
              status_code: String(body.status_code || ""),
              transaction_status: String(body.transaction_status || ""),
              gross_amount: String(body.gross_amount || ""),
              payment_type: String(body.payment_type || ""),
              transaction_id: String(body.transaction_id || ""),
            },
            now: Date.now(),
          });
          if (enq.duplicate && enq.job?.status === "done") {
            send(200, { ok: true, queued: false, duplicate: true, jobId: enq.job.id });
            return;
          }
          const drained = await drainOrderQueue(orderId, { throwClientError: true });
          send(200, {
            ok: true,
            queued: true,
            duplicate: enq.duplicate,
            jobId: enq.job?.id,
            ...drained,
          });
          return;
        }
        await enqueueOrderTask(orderId, () => syncPaymentOnce(orderId));
        send(200, { ok: true });
        return;
      }
      if (path === "/api/payments/queue/drain") {
        requireStaff();
        const targetOrderId = body.orderId ? str(body.orderId, 80) : null;
        if (typeof db.claimPaymentJobs !== "function") {
          send(200, { processed: 0, done: 0, retried: 0, failed: 0, queue: { summary: {}, items: [] } });
          return;
        }
        const nowTs = Date.now();
        const forceOffset = body.force ? 360000 : 0;
        const jobs = await db.claimPaymentJobs({
          orderId: targetOrderId,
          now: nowTs + forceOffset,
          lockTimeoutMs: 30000 + forceOffset,
          limit: 20,
        });
        let done = 0;
        let retried = 0;
        let failed = 0;
        for (const job of jobs) {
          await enqueueOrderTask(job.orderId, async () => {
            try {
              await syncPaymentOnce(job.orderId);
              await db.finishPaymentJob({
                id: job.id,
                status: "done",
                attempts: (job.attempts || 0) + 1,
                nextRunAt: 0,
                lastError: "",
              });
              done++;
            } catch (err) {
              const attemptsCount = (job.attempts || 0) + 1;
              const isClientConflict = Boolean(err?.status && err.status >= 400 && err.status < 500);
              if (!isClientConflict && attemptsCount < 5) {
                await db.finishPaymentJob({
                  id: job.id,
                  status: "pending",
                  attempts: attemptsCount,
                  nextRunAt: Date.now() + Math.min(300000, 5000 * 2 ** attemptsCount),
                  lastError: err?.message || "Transient gateway error",
                });
                retried++;
              } else {
                await db.finishPaymentJob({
                  id: job.id,
                  status: "failed",
                  attempts: attemptsCount,
                  nextRunAt: 0,
                  lastError: err?.message || "Payment sync failed",
                });
                failed++;
              }
            }
          });
        }
        send(200, {
          processed: jobs.length,
          done,
          retried,
          failed,
          queue: await db.listPaymentQueue(40),
        });
        return;
      }
      if (path === "/api/payments/status") {
        requireUser();
        const o = await db.getOrder(str(body.id, 80));
        if (!o || (!isStaffRole(u.role) && o.memberId !== u.id))
          fail(403, "Order access denied");
        await enqueueOrderTask(o.id, async () => {
          if (typeof db.claimPaymentJobs === "function") {
            const pendingJobs = await db.claimPaymentJobs({
              orderId: o.id,
              now: Date.now(),
              lockTimeoutMs: 30000,
              limit: 10,
            });
            for (const job of pendingJobs) {
              try {
                await syncPaymentOnce(o.id);
                await db.finishPaymentJob({
                  id: job.id,
                  status: "done",
                  attempts: (job.attempts || 0) + 1,
                  nextRunAt: 0,
                  lastError: "",
                });
              } catch (err) {
                await db.finishPaymentJob({
                  id: job.id,
                  status: err?.status && err.status < 500 ? "failed" : "pending",
                  attempts: (job.attempts || 0) + 1,
                  nextRunAt: Date.now() + 10000,
                  lastError: err?.message || "",
                });
                throw err;
              }
            }
            if (pendingJobs.length > 0) return;
          }
          await syncPaymentOnce(o.id);
        });
        send(200, await state(u));
        return;
      }
      if (path === "/api/payments/complete") {
        requireUser();
        const orderId = str(body.id, 80);
        await enqueueOrderTask(orderId, async () => {
          const o = await db.getOrder(orderId);
          if (!o || (!isStaffRole(u.role) && o.memberId !== u.id))
            fail(403, "Order access denied");
          if (o.status === "cancelled" || o.status === "Dibatalkan")
            fail(409, "Pesanan yang dibatalkan tidak dapat dibayar");
          const chosenMethod =
            str(body.method, 64) ||
            o.payment?.method ||
            "QRIS / Virtual Account Instan";
          if (o.payment?.status !== "paid") {
            const paidAt = new Date().toISOString();
            const txId =
              o.payment?.transactionId ||
              `VCO-TX-${Date.now().toString(36).toUpperCase()}-${o.id.slice(-4).toUpperCase()}`;
            const nextOrder = {
              ...o,
              payment: {
                ...(o.payment || {
                  provider: "midtrans",
                  gatewayId: o.id,
                }),
                status: "paid",
                outcome: "paid",
                method: chosenMethod,
                transactionId: txId,
                paidAt,
              },
            };
            await db.transitionOrderAtomic({
              orderId: o.id,
              expectedStatus: o.status,
              expectedPaymentStatus: o.payment?.status,
              nextOrder,
              restoreStock: false,
            });
          }
        });
        send(200, await state(u));
        return;
      }
      const preparePayment = async (order, { preferDirect = true } = {}) => {
        if (!order?.payment || order.payment.status !== "pending") return order;
        return enqueueOrderTask(order.id, async () => {
          const latest = await db.getOrder(order.id);
          if (!latest?.payment || latest.payment.status !== "pending") return latest || order;
          if (latest.payment.directCharge || latest.payment.url) return latest;
          if (!gateway) fail(503, "Midtrans is not configured");
          const ch = latest.payment.channel;
          if (
            preferDirect &&
            ch &&
            supportsCoreCharge(ch) &&
            typeof gateway.charge === "function"
          ) {
            try {
              const directCharge = await gateway.charge(latest, ch, { finishUrl });
              const patch = {
                channel: ch,
                outcome: "pending",
                method: directCharge.paymentType || ch,
                transactionId:
                  directCharge.transactionId || latest.payment.transactionId || "",
                ...(directCharge.expiryTime ? { expiryTime: directCharge.expiryTime } : {}),
                directCharge,
              };
              return typeof db.setOrderPaymentInitAtomic === "function"
                ? await db.setOrderPaymentInitAtomic(latest.id, patch)
                : await db.saveOrder({ ...latest, payment: { ...latest.payment, ...patch } });
            } catch {
              // Fall back seamlessly to Snap when a channel is not activated on Core API yet
            }
          }
          let url;
          try {
            url = await gateway.create(latest, { finishUrl });
          } catch {
            fail(
              502,
              "Payment page unavailable. Retry with the same checkout or contact the store; stock is reserved.",
            );
          }
          const snapPatch = {
            ...(ch ? { channel: ch } : {}),
            url,
          };
          return typeof db.setOrderPaymentInitAtomic === "function"
            ? await db.setOrderPaymentInitAtomic(latest.id, snapPatch)
            : await db.saveOrder({ ...latest, payment: { ...latest.payment, ...snapPatch } });
        });
      };
      if (path === "/api/payments/charge") {
        requireUser();
        const orderId = str(body.id, 80);
        const requestedChannel =
          typeof body.channel === "string" && /^[a-z0-9_]{2,24}$/.test(body.channel)
            ? body.channel
            : "";
        let chargeNotice = "";
        const updatedOrder = await enqueueOrderTask(orderId, async () => {
          const latest = await db.getOrder(orderId);
          if (!latest || (!isStaffRole(u.role) && latest.memberId !== u.id))
            fail(403, "Order access denied");
          if (!latest.payment || latest.payment.status !== "pending")
            fail(409, "Order payment is no longer pending");
          const ch = requestedChannel || latest.payment.channel || "qris";
          const existingCharge = latest.payment.directCharge;
          const shouldRetryFallback =
            supportsCoreCharge(ch) && isFallbackDirectCharge(existingCharge);
          if (
            existingCharge &&
            existingCharge.channel === ch &&
            !shouldRetryFallback
          ) {
            return latest;
          }
          if (!gateway) fail(503, "Midtrans is not configured");
          const hasPriorAttempt = Boolean(
            existingCharge || latest.payment.url || latest.payment.transactionId,
          );
          const isSwitching = Boolean(
            hasPriorAttempt &&
              (existingCharge?.channel !== ch ||
                shouldRetryFallback ||
                String(latest.payment.gatewayOrderId || "").length > 50),
          );
          const gatewayOrderId = isSwitching
            ? buildSwitchOrderId(latest.id, ch)
            : latest.payment.gatewayOrderId || latest.id;

          let directCharge = null;
          if (supportsCoreCharge(ch) && typeof gateway.charge === "function") {
            try {
              directCharge = await gateway.charge(latest, ch, {
                finishUrl,
                gatewayOrderId,
              });
            } catch (err) {
              chargeNotice = err?.message || "Direct Core API unavailable; using Snap.";
            }
          }

          let snapUrl = !isSwitching ? latest.payment.url || "" : "";
          if (!directCharge && (!snapUrl || isSwitching)) {
            try {
              snapUrl = await gateway.create(
                {
                  ...latest,
                  payment: { ...latest.payment, channel: ch, gatewayOrderId },
                },
                { finishUrl, gatewayOrderId },
              );
            } catch (err) {
              if (!chargeNotice) {
                chargeNotice = err?.message || "Snap fallback unavailable; using reference bill.";
              }
            }
          }

          const resolvedDirect =
            directCharge || buildFallbackDirectCharge(latest, ch, snapUrl);
          const fresh = (await db.getOrder(orderId)) || latest;
          if (!fresh.payment || fresh.payment.status !== "pending") return fresh;
          const nextOrder = {
            ...fresh,
            payment: {
              ...fresh.payment,
              channel: ch,
              gatewayOrderId,
              outcome: "pending",
              method: resolvedDirect.paymentType || ch,
              transactionId:
                resolvedDirect.transactionId || fresh.payment.transactionId || "",
              ...(resolvedDirect.expiryTime
                ? { expiryTime: resolvedDirect.expiryTime }
                : {}),
              ...(snapUrl ? { url: snapUrl } : {}),
              directCharge: resolvedDirect,
            },
          };
          return db.saveOrder(nextOrder);
        });
        send(200, {
          order: updatedOrder,
          state: await state(u),
          ...(chargeNotice ? { chargeNotice } : {}),
        });
        return;
      }
      if (requestPath === "/api/shipping/rates") {
        requireUser();
        const lines = body.lines;
        if (!Array.isArray(lines) || !lines.length || lines.length > 100) {
          fail(400, "Invalid bag");
        }
        const [catalog, settings] = await Promise.all([
          db.listProducts(),
          db.getSettings(),
        ]);
        const effectiveShipping = mergeShippingSettings(
          settings?.shipping,
          idrShipping.freeAbove,
        );
        const items = lines.map((l) => {
          const p = catalog.find((p) => p.id === l.productId && p.active);
          if (!p) fail(409, "A product is unavailable");
          integer(l.quantity, 1, 100);
          const price =
            p.priceIdr && Number.isSafeInteger(p.priceIdr) && p.priceIdr > 0
              ? p.priceIdr
              : Math.round((p.price || 0) * 15000);
          return {
            name: p.name,
            value: price,
            weightGrams: p.weightGrams,
            quantity: l.quantity,
          };
        });
        const subtotal = items.reduce((n, i) => n + i.value * i.quantity, 0);
        const weightGrams = computeBagShippingWeight(
          lines,
          catalog,
          effectiveShipping.defaultWeightGrams,
        );

        const quotes = await quoteShippingRates({
          biteship: activeBiteship,
          config: effectiveShipping,
          destination: body.destination || {},
          bagSummary: {
            subtotal,
            totalWeightGrams: weightGrams,
            items: items.map((i) => ({
              name: i.name,
              value: i.value,
              weight: i.weightGrams || effectiveShipping.defaultWeightGrams,
              quantity: i.quantity,
            })),
          },
          secret: resolvedShippingSecret,
        });
        send(200, quotes);
        return;
      }
      if (requestPath === "/api/payments/quote") {
        requireUser();
        const [coupon, products, settings] = await Promise.all([
          body.code ? db.getCoupon(String(body.code).toUpperCase()) : Promise.resolve(null),
          db.listProducts(),
          db.getSettings(),
        ]);
        if (body.code && !coupon?.active)
          fail(400, "Promotion is no longer valid");
        const destPostal =
          body.destination?.postal ??
          body.destination?.postalCode ??
          body.address?.postal ??
          "";
        try {
          const { quote, shippingMeta } = resolveIdrOrderQuote({
            lines: body.lines,
            products,
            coupon,
            express: body.express === true,
            shippingOption: body.shippingOption,
            destinationPostal: destPostal,
            settings,
          });
          send(200, {
            ...quote,
            ...(shippingMeta ? { shippingMeta } : {}),
          });
        } catch (e) {
          fail(e.status || 400, e.message);
        }
        return;
      }
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
        if (!profile?.sub) fail(401, "Invalid Google identity");
        if (!profile.email_verified)
          fail(401, "Google account email is not verified");
        const nonces = getCookieValue(cookieHeader, "solere_google")
          .split(".")
          .filter(Boolean);
        const matchedNonce = nonces.find((n) => n === profile?.nonce);
        if (!matchedNonce)
          fail(401, "Google sign-in expired. Reload and try again.");
        const consumed = await db.consumeGoogleChallenge(
          hashToken(matchedNonce),
          Date.now(),
        );
        if (!consumed)
          fail(401, "Google sign-in expired. Reload and try again.");
        let user = await db.getUserByGoogleSub(profile.sub);
        const configuredAdminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
        if (!user) {
          const e = email(profile.email);
          const existingByEmail = await db.getUserByEmail(e);
          if (existingByEmail) {
            const existingMember = await db.getMember(existingByEmail.id);
            const canLinkGoogle =
              existingMember?.emailVerified === true ||
              isStaffRole(existingByEmail.role) ||
              isStaffRole(existingMember?.role) ||
              (configuredAdminEmail && e === configuredAdminEmail);
            if (!canLinkGoogle) {
              fail(
                409,
                "This email already has an account. Sign in with your password.",
              );
            }
            if (db.linkGoogleAccount) {
              await db.linkGoogleAccount(profile.sub, existingByEmail.id);
            }
            user = existingByEmail;
            if (existingMember && !existingMember.emailVerified) {
              await db.putMember({ ...existingMember, emailVerified: true });
            }
          } else {
            const assignedRole =
              configuredAdminEmail && e === configuredAdminEmail
                ? "super_admin"
                : "member";
            user = { id: randomUUID(), email: e, role: assignedRole };
            await db.createUserWithMember(
              {
                id: user.id,
                email: e,
                password: `nopwd:${hashPassword(randomBytes(48).toString("hex"))}`,
                role: assignedRole,
              },
              {
                id: user.id,
                email: e,
                name: str(profile.name || e.split("@")[0], 120),
                phone: "",
                role: assignedRole,
                emailVerified: true,
                phoneVerified: false,
                hasPassword: false,
                addresses: [],
              },
              profile.sub,
            );
          }
        } else {
          const existingMember = await db.getMember(user.id);
          if (existingMember && !existingMember.emailVerified) {
            await db.putMember({ ...existingMember, emailVerified: true });
          }
        }
        if (
          configuredAdminEmail &&
          user.email?.toLowerCase() === configuredAdminEmail &&
          user.role === "member"
        ) {
          await db.updateUserRole(user.id, "super_admin");
          user = { ...user, role: "super_admin" };
        }
        await session(setCookie, user, useSecureCookie);
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
        let user = null;
        if (channel === "phone") {
          const matched = await db.findMemberByPhone(target);
          user = matched ? await db.getUserById(matched.id) : null;
        } else {
          user = await db.getUserByEmail(target);
        }
        const existingMember = user ? await db.getMember(user.id) : null;
        if (existingMember) {
          if (channel === "email" && !existingMember.emailVerified) {
            fail(
              403,
              "Verify your email in Profile before signing in with OTP",
            );
          }
          if (channel === "phone" && !existingMember.phoneVerified) {
            fail(
              403,
              "Verify your WhatsApp number in Profile before signing in with OTP",
            );
          }
        }
        if (path === "/api/auth/otp/request") {
          await checkTurnstile(body.turnstileToken, requestIp);
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
        if (user) {
          await db.deleteVerificationCode(key);
          await session(setCookie, user, useSecureCookie);
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
        const configuredAdminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
        const assignedOtpRole =
          configuredAdminEmail && memberEmail === configuredAdminEmail
            ? "super_admin"
            : "member";
        user = { id: randomUUID(), email: memberEmail, role: assignedOtpRole };
        await db.createUserWithMember(
          {
            id: user.id,
            email: memberEmail,
            password: `nopwd:${hashPassword(randomBytes(48).toString("hex"))}`,
            role: assignedOtpRole,
          },
          {
            id: user.id,
            email: memberEmail,
            name: memberName,
            phone: channel === "phone" ? target : "",
            role: assignedOtpRole,
            emailVerified: channel === "email",
            phoneVerified: channel === "phone",
            hasPassword: false,
            addresses: [],
          },
        );
        await session(setCookie, user, useSecureCookie);
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
        await checkTurnstile(body.turnstileToken, requestIp);
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
        await session(setCookie, user, useSecureCookie);
        send(200, await state(user));
        return;
      }
      if (
        ["/api/auth/login", "/api/auth/register", "/api/auth/setup"].includes(
          path,
        )
      ) {
        if (path !== "/api/auth/setup") {
          await checkTurnstile(body.turnstileToken, requestIp);
        }
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
        await session(setCookie, user, useSecureCookie);
        send(200, await state(user));
        return;
      }
      if (path === "/api/auth/logout") {
        const token = getCookieValue(cookieHeader, "solere_session");
        if (token) await db.deleteSession(hashToken(token));
        setCookie(
          `solere_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${useSecureCookie ? "; Secure" : ""}`,
        );
        send(200, await state(null));
        return;
      }
      if (path === "/api/auth/password") {
        requireUser();
        const old = await db.getUserById(u.id);
        const oldMember = await db.getMember(u.id);
        const isPasswordless =
          typeof old?.password === "string" &&
          (old.password.startsWith("nopwd:") ||
            oldMember?.hasPassword === false);
        if (
          !isPasswordless &&
          !checkPassword(str(body.current, 256), old.password)
        )
          fail(400, "Current password is incorrect");
        const password = validPassword(body.password);
        await db.updatePasswordAndClearSessions(u.id, hashPassword(password));
        if (oldMember && oldMember.hasPassword === false) {
          await db.putMember({ ...oldMember, hasPassword: true });
        }
        await session(setCookie, u, useSecureCookie);
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
            requireStaff();
            const p = product(data);
            if (!isAdminRole(u.role)) {
              const existing = initialProducts.find((item) => item.id === p.id);
              if (!existing) fail(403, "Admin access required");
              const stockChangedOnly =
                p.name === existing.name &&
                p.brand === existing.brand &&
                p.category === existing.category &&
                (p.description?.id ?? "") === (existing.description?.id ?? "") &&
                (p.description?.en ?? "") === (existing.description?.en ?? "") &&
                Number(p.price) === Number(existing.price) &&
                p.active === existing.active;
              if (!stockChangedOnly) fail(403, "Admin access required");
              const stockOnlyProduct = { ...existing, stock: p.stock };
              virtualProductIds.add(stockOnlyProduct.id);
              ops.push({ kind: "products", data: stockOnlyProduct });
            } else {
              virtualProductIds.add(p.id);
              ops.push({ kind: "products", data: p });
            }
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
            const currentEffectiveShipping = mergeShippingSettings(
              virtualSettings?.shipping,
              idrShipping.freeAbove,
            );
            const sanitizedShipping =
              data.shipping !== undefined
                ? sanitizeShippingSettings(data.shipping, currentEffectiveShipping)
                : virtualSettings?.shipping;
            virtualSettings = {
              ...(homepage
                ? {
                    homepage: {
                      mode: homepage.mode,
                      productIds: [...new Set(homepage.productIds)],
                    },
                  }
                : {}),
              name:
                data.name !== undefined
                  ? str(data.name, 24)
                  : virtualSettings?.name || defaultStoreName,
              email:
                data.email !== undefined
                  ? email(data.email)
                  : virtualSettings?.email || defaultSupportEmail,
              announcement:
                data.announcement !== undefined
                  ? {
                      id: str(data.announcement?.id, 300),
                      en: str(data.announcement?.en, 300),
                    }
                  : virtualSettings?.announcement || { id: "", en: "" },
              ...(sanitizedShipping ? { shipping: sanitizedShipping } : {}),
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
            const claimedCoupons = Array.isArray(data.claimedCoupons)
              ? [
                  ...new Set(
                    data.claimedCoupons
                      .map((c) => str(c, 20).toUpperCase())
                      .filter((c) => /^[A-Z0-9]{3,20}$/.test(c)),
                  ),
                ].slice(0, 50)
              : m.claimedCoupons;
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
              ...(claimedCoupons ? { claimedCoupons } : {}),
              addresses: data.addresses.map(address),
            };
            ops.push({ kind: "members", data: virtualMember });
          } else if (kind === "tickets") {
            requireUser();
            const id = str(data.id, 80);
            const old = ticketMap.get(id);
            let nextTicket;
            if (old) {
              requireStaff();
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
        await checkTurnstile(body.turnstileToken, requestIp);
        const [m, settings] = await Promise.all([
          db.getMember(u.id),
          db.getSettings(),
        ]);
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

          let discount;
          let shipping;
          let total;
          let quote = null;
          let shippingMeta = null;

          if (orderCurrency === "IDR") {
            const destPostal =
              body.destination?.postal ??
              body.destination?.postalCode ??
              body.address?.postal ??
              "";
            try {
              const idrResult = resolveIdrOrderQuote({
                lines,
                products: [...catalog.values()],
                coupon,
                express: body.express === true,
                shippingOption: body.shippingOption,
                destinationPostal: destPostal,
                settings,
              });
              quote = idrResult.quote;
              shippingMeta = idrResult.shippingMeta;
              discount = quote.discount;
              shipping = quote.shipping;
              total = quote.total;
            } catch (e) {
              fail(e.status || 400, e.message);
            }
          } else {
            discount = Math.round(subtotal * (coupon?.percent || 0)) / 100;
            shipping =
              body.express === true
                ? 25
                : subtotal >= 250
                  ? 0
                  : 15;
            total = Math.round((subtotal - discount + shipping) * 100) / 100;
          }

          if (body.payment === "midtrans" && body.expectedTotal !== quote?.total) {
            fail(409, "IDR total changed. Refresh the quote before checkout.");
          }
          if (body.expectedTotal !== undefined && body.expectedTotal !== total) {
            fail(409, "IDR total changed. Refresh the quote before checkout.");
          }
          const selectedChannel =
            typeof body.channel === "string" && /^[a-z0-9_]{2,24}$/.test(body.channel)
              ? body.channel
              : "";
          const orderId = "SOL-" + randomUUID();
          const receiptNumber =
            "VCO-INV-" + orderId.replace(/^SOL-/, "").slice(0, 8).toUpperCase();
          const isMidtrans = body.payment === "midtrans";
          return {
            id: orderId,
            receiptNumber,
            memberId: u.id,
            name: m.name,
            email: u.email,
            date: new Date().toISOString(),
            status: "processing",
            paymentMethod: isMidtrans ? "midtrans" : "direct",
            currency: orderCurrency,
            items: quote
              ? items.map((item, i) => ({
                  ...item,
                  price: quote.items[i].price,
                }))
              : items,
            total,
            discount,
            shipping,
            address: address(body.address),
            tracking: "",
            ...(shippingMeta ? { shippingMeta } : {}),
            ...(isMidtrans
              ? {
                  payment: {
                    provider: "midtrans",
                    status: "pending",
                    outcome: "pending",
                    sandbox: !paymentProduction,
                    ...(selectedChannel ? { channel: selectedChannel } : {}),
                  },
                }
              : {}),
          };
        });
        const order = await preparePayment(created.order);
        send(200, { order, state: await state(u) });
        return;
      }
      if (path === "/api/orders/cancel") {
        requireUser();
        const orderId = str(body.id, 80);
        const reason =
          str(body.reason, 200) ||
          (isStaffRole(u.role)
            ? "Dibatalkan oleh studio"
            : "Dibatalkan oleh pembeli");
        await enqueueOrderTask(orderId, async () => {
          let o = await db.getOrder(orderId);
          if (!o) fail(404, "Order not found");
          if (!isStaffRole(u.role) && o.memberId !== u.id)
            fail(403, "Order access denied");
          if (
            o.status === "cancelled" ||
            o.payment?.outcome === "cancelled" ||
            o.payment?.status === "refunded"
          ) {
            return;
          }
          if (o.status !== "processing")
            fail(
              409,
              "Pesanan yang sudah diproses pengiriman tidak dapat dibatalkan",
            );
          if (o.payment?.status === "paid")
            fail(
              409,
              "Pembayaran sudah terkonfirmasi lunas; ajukan pengembalian dana pada detail pesanan.",
            );
          if (o.payment && gateway) {
            if (typeof gateway.status === "function") {
              try {
                const synced = await syncPaymentOnce(orderId);
                if (synced) o = synced;
              } catch (err) {
                if (err?.status === 409) throw err;
              }
            }
            if (o.payment?.status === "paid")
              fail(
                409,
                "Pembayaran baru saja terkonfirmasi lunas. Muat ulang halaman untuk melihat struk.",
              );
            if (o.status === "cancelled" || o.payment?.status === "failed") {
              return;
            }
            if (typeof gateway.cancel === "function") {
              try {
                await gateway.cancel(o.payment?.gatewayOrderId || o.id);
              } catch {
                // Snap redirect orders that were never opened on Midtrans return 404/412 on /cancel; safe to proceed locally
              }
            }
          }
          const now = new Date().toISOString();
          const actor =
            isStaffRole(u.role) && o.memberId !== u.id ? "admin" : "buyer";
          await db.transitionOrderAtomic({
            orderId: o.id,
            expectedStatus: o.status,
            expectedPaymentStatus: o.payment?.status || "",
            nextOrder: {
              ...o,
              status: "cancelled",
              ...(o.payment
                ? {
                    payment: {
                      ...o.payment,
                      status: "failed",
                      outcome: "cancelled",
                      rawStatus: "cancel",
                      statusReason: reason,
                      cancelReason: reason,
                      cancelledBy: actor,
                      cancelledAt: now,
                      updatedAt: now,
                    },
                  }
                : {}),
            },
            restoreStock: true,
          });
        });
        send(200, { order: await db.getOrder(orderId), state: await state(u) });
        return;
      }
      if (path === "/api/orders/update") {
        requireUser();
        const orderId = str(body.id, 80);
        await enqueueOrderTask(orderId, async () => {
          const o = await db.getOrder(orderId);
          if (!o) fail(404, "Order not found");
          if (
            !isStaffRole(u.role) &&
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
            isStaffRole(u.role)
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
        });
        send(200, await state(u));
        return;
      }
      if (path === "/api/orders/refund") {
        requireUser();
        const id = str(body.id, 80);
        await enqueueOrderTask(id, async () => {
          const o = await db.getOrder(id);
          if (!o) fail(404, "Order not found");
          const action =
            body.action || (isAdminRole(u.role) ? "approve" : "request");
          if (!["request", "approve", "reject"].includes(action))
            fail(400, "Invalid refund action");
          if (action !== "request" && !isAdminRole(u.role))
            fail(403, "Admin access required");
          if (action === "request" && o.memberId !== u.id && !isAdminRole(u.role))
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
                      outcome: "refunded",
                      statusReason:
                        latest.refund?.reason || reason || "Dana dikembalikan ke pembeli",
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
        });
        send(200, await state(u));
        return;
      }
      if (path === "/api/admin/role") {
        requireAdmin();
        if (method !== "POST") fail(405, "Method not allowed");
        const userId = str(body.userId, 80);
        const nextRole = str(body.role, 32);
        if (!VALID_ROLES.has(nextRole)) fail(400, "Invalid role");
        const targetUser = await db.getUserById(userId);
        if (!targetUser) fail(404, "User not found");
        const allMembers = await db.listMembers();
        const targetMember = allMembers.find((m) => m.id === userId) || null;
        const targetCurrent = await resolveEffectiveUser(
          targetUser,
          targetMember,
        );
        const superAdmins = allMembers.filter((m) => m.role === "super_admin");
        const callerIsSuper = isSuperAdminRole(u.role);
        const isFirstSuperClaim =
          superAdmins.length === 0 &&
          targetUser.id === u.id &&
          nextRole === "super_admin";
        if (!callerIsSuper && !isFirstSuperClaim) {
          if (
            targetCurrent.role === "super_admin" ||
            nextRole === "super_admin" ||
            nextRole === "admin"
          ) {
            fail(403, "Super Admin access required");
          }
        }
        if (targetUser.id === u.id && !isAdminRole(nextRole)) {
          fail(409, "Cannot demote your own administrative account");
        }
        if (
          targetCurrent.role === "super_admin" &&
          nextRole !== "super_admin" &&
          superAdmins.length <= 1
        ) {
          fail(409, "At least one Super Admin is required");
        }
        await db.updateUserRole(userId, nextRole);
        send(200, await state(userId === u.id ? { ...u, role: nextRole } : u));
        return;
      }
      if (path === "/api/admin/claim") {
        if (method !== "POST") fail(405, "Method not allowed");
        const providedToken =
          typeof body.setupToken === "string" ? body.setupToken.trim() : "";
        const fallbackSecret = process.env.ADMIN_PASSWORD?.trim() || "";
        const validSetupToken =
          (setupToken &&
            providedToken.length === setupToken.length &&
            timingSafeEqual(
              Buffer.from(providedToken),
              Buffer.from(setupToken),
            )) ||
          (fallbackSecret.length >= MIN_PASSWORD_LEN &&
            providedToken.length === fallbackSecret.length &&
            timingSafeEqual(
              Buffer.from(providedToken),
              Buffer.from(fallbackSecret),
            ));
        if (!validSetupToken) fail(403, "Invalid setup token");
        const requestedRole =
          typeof body.role === "string" &&
          ["staff", "admin", "super_admin"].includes(body.role)
            ? body.role
            : "super_admin";
        if (u && (!body.email || String(body.email).trim().toLowerCase() === u.email.toLowerCase())) {
          await db.updateUserRole(u.id, requestedRole);
          if (typeof body.password === "string" && body.password.trim().length >= MIN_PASSWORD_LEN) {
            await db.updatePasswordAndClearSessions(
              u.id,
              hashPassword(validPassword(body.password)),
            );
            const curMem = await db.getMember(u.id);
            if (curMem && curMem.hasPassword === false) {
              await db.putMember({ ...curMem, hasPassword: true });
            }
            await session(setCookie, { ...u, role: requestedRole }, useSecureCookie);
          }
          send(200, await state({ ...u, role: requestedRole }));
          return;
        }
        const e = email(body.email);
        const existing = await db.getUserByEmail(e);
        if (existing) {
          await db.updateUserRole(existing.id, requestedRole);
          if (typeof body.password === "string" && body.password.trim()) {
            const pwd = validPassword(body.password);
            await db.updatePasswordAndClearSessions(
              existing.id,
              hashPassword(pwd),
            );
          }
          const existingMember = await db.getMember(existing.id);
          if (existingMember) {
            const nextName =
              typeof body.name === "string" && body.name.trim().length >= 2
                ? str(body.name, 120)
                : existingMember.name;
            await db.putMember({
              ...existingMember,
              name: nextName,
              role: requestedRole,
              hasPassword: true,
            });
          }
          const elevated = { ...existing, role: requestedRole };
          await session(setCookie, elevated, useSecureCookie);
          send(200, await state(elevated));
          return;
        }
        const password = validPassword(body.password);
        const name =
          typeof body.name === "string" && body.name.trim().length >= 2
            ? str(body.name, 120)
            : e.split("@")[0];
        const newUser = { id: randomUUID(), email: e, role: requestedRole };
        await db.createUserWithMember(
          {
            id: newUser.id,
            email: e,
            password: hashPassword(password),
            role: requestedRole,
          },
          {
            id: newUser.id,
            email: e,
            name,
            phone: "",
            role: requestedRole,
            emailVerified: true,
            phoneVerified: false,
            hasPassword: true,
            addresses: [],
          },
        );
        await session(setCookie, newUser, useSecureCookie);
        send(200, await state(newUser));
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
      searchParams: url.searchParams,
      origin: request.headers.get("origin") || "",
      host: host || "",
      secFetchSite: request.headers.get("sec-fetch-site") || "",
      contentType: request.headers.get("content-type") || "",
      cookieHeader: request.headers.get("cookie") || "",
      forwardedProto: request.headers.get("x-forwarded-proto") || "",
      protocol: url.protocol,
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
        searchParams: url.searchParams,
        origin: req.headers.origin || "",
        host:
          req.headers.host ||
          (trustProxy ? String(req.headers["x-forwarded-host"] || "") : ""),
        secFetchSite: String(req.headers["sec-fetch-site"] || ""),
        contentType: String(req.headers["content-type"] || ""),
        cookieHeader: req.headers.cookie || "",
        forwardedProto: String(req.headers["x-forwarded-proto"] || ""),
        protocol: req.socket?.encrypted ? "https:" : "http:",
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
      server.closeAllConnections?.();
      server.closeIdleConnections?.();
      if (!store) {
        try {
          db.close?.();
        } catch {}
      }
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
