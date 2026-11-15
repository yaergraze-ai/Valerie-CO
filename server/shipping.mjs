import { createHmac, timingSafeEqual } from "node:crypto";

const BITESHIP_RATES_URL = "https://api.biteship.com/v1/rates/couriers";
const BITESHIP_AREAS_URL = "https://api.biteship.com/v1/maps/areas";
const RATE_CACHE_TTL_MS = 5 * 60_000;
const AREA_CACHE_TTL_MS = 15 * 60_000;
const TOKEN_TTL_MS = 20 * 60_000;
const MAX_CACHE_ENTRIES = 500;

export const ALLOWED_COURIERS = Object.freeze([
  "jne",
  "jnt",
  "sicepat",
  "anteraja",
  "pos",
  "tiki",
  "gosend",
  "grab",
]);

const ALLOWED_COURIER_SET = new Set(ALLOWED_COURIERS);
const INSTANT_COURIERS = new Set(["gosend", "grab"]);

const COURIER_LABELS = Object.freeze({
  jne: "JNE",
  jnt: "J&T Express",
  sicepat: "SiCepat",
  anteraja: "Anteraja",
  pos: "POS Indonesia",
  tiki: "TIKI",
  gosend: "GoSend",
  grab: "GrabExpress",
});

export const DEFAULT_SHIPPING_CONFIG = Object.freeze({
  originName: "UMC Kampus 2 Watubelah (Cirebon)",
  originAddress: "Jl. Fatahillah No. 40, Watubelah, Sumber",
  originCity: "Kabupaten Cirebon",
  originProvince: "Jawa Barat",
  originPostalCode: "45611",
  originLat: -6.7385,
  originLon: 108.4975,
  defaultWeightGrams: 1000,
  freeAbove: 2000000,
  enabledCouriers: Object.freeze([...ALLOWED_COURIERS]),
});

export const FALLBACK_AREA_PRESETS = Object.freeze(
  [
    {
      id: "preset-45611",
      name: "Watubelah, Sumber, Kabupaten Cirebon, Jawa Barat 45611",
      city: "Kabupaten Cirebon",
      province: "Jawa Barat",
      postal: "45611",
    },
    {
      id: "preset-45122",
      name: "Kejaksan, Kota Cirebon, Jawa Barat 45122",
      city: "Kota Cirebon",
      province: "Jawa Barat",
      postal: "45122",
    },
    {
      id: "preset-40115",
      name: "Bandung Wetan, Kota Bandung, Jawa Barat 40115",
      city: "Kota Bandung",
      province: "Jawa Barat",
      postal: "40115",
    },
    {
      id: "preset-12190",
      name: "Kebayoran Baru, Jakarta Selatan, DKI Jakarta 12190",
      city: "Jakarta Selatan",
      province: "DKI Jakarta",
      postal: "12190",
    },
    {
      id: "preset-10310",
      name: "Menteng, Jakarta Pusat, DKI Jakarta 10310",
      city: "Jakarta Pusat",
      province: "DKI Jakarta",
      postal: "10310",
    },
    {
      id: "preset-17141",
      name: "Bekasi Selatan, Kota Bekasi, Jawa Barat 17141",
      city: "Kota Bekasi",
      province: "Jawa Barat",
      postal: "17141",
    },
    {
      id: "preset-16431",
      name: "Beji, Kota Depok, Jawa Barat 16431",
      city: "Kota Depok",
      province: "Jawa Barat",
      postal: "16431",
    },
    {
      id: "preset-16127",
      name: "Bogor Tengah, Kota Bogor, Jawa Barat 16127",
      city: "Kota Bogor",
      province: "Jawa Barat",
      postal: "16127",
    },
    {
      id: "preset-15310",
      name: "Serpong, Kota Tangerang Selatan, Banten 15310",
      city: "Kota Tangerang Selatan",
      province: "Banten",
      postal: "15310",
    },
    {
      id: "preset-50132",
      name: "Semarang Tengah, Kota Semarang, Jawa Tengah 50132",
      city: "Kota Semarang",
      province: "Jawa Tengah",
      postal: "50132",
    },
    {
      id: "preset-55224",
      name: "Gondokusuman, Kota Yogyakarta, DI Yogyakarta 55224",
      city: "Kota Yogyakarta",
      province: "DI Yogyakarta",
      postal: "55224",
    },
    {
      id: "preset-60271",
      name: "Genteng, Kota Surabaya, Jawa Timur 60271",
      city: "Kota Surabaya",
      province: "Jawa Timur",
      postal: "60271",
    },
    {
      id: "preset-80361",
      name: "Kuta, Kabupaten Badung, Bali 80361",
      city: "Kabupaten Badung",
      province: "Bali",
      postal: "80361",
    },
    {
      id: "preset-20111",
      name: "Medan Barat, Kota Medan, Sumatera Utara 20111",
      city: "Kota Medan",
      province: "Sumatera Utara",
      postal: "20111",
    },
    {
      id: "preset-76114",
      name: "Balikpapan Selatan, Kota Balikpapan, Kalimantan Timur 76114",
      city: "Kota Balikpapan",
      province: "Kalimantan Timur",
      postal: "76114",
    },
    {
      id: "preset-90111",
      name: "Ujung Pandang, Kota Makassar, Sulawesi Selatan 90111",
      city: "Kota Makassar",
      province: "Sulawesi Selatan",
      postal: "90111",
    },
    {
      id: "preset-99111",
      name: "Jayapura Utara, Kota Jayapura, Papua 99111",
      city: "Kota Jayapura",
      province: "Papua",
      postal: "99111",
    },
  ].map((preset) => Object.freeze(preset)),
);

const ZONE_META = Object.freeze({
  1: { zoneCode: 1, zoneLabel: "Ciayumajakuning (Cirebon & Sekitar)" },
  2: { zoneCode: 2, zoneLabel: "Jawa Barat & Jabodetabek" },
  3: { zoneCode: 3, zoneLabel: "Banten, Jateng, DIY & Jatim" },
  4: { zoneCode: 4, zoneLabel: "Sumatera, Bali & Nusa Tenggara" },
  5: { zoneCode: 5, zoneLabel: "Kalimantan & Sulawesi" },
  6: { zoneCode: 6, zoneLabel: "Maluku & Papua" },
});

const ZONE_2_PREFIXES = new Set([10, 11, 12, 13, 14, 16, 17, 40, 41, 43, 44, 46]);

const ZONE_KEYWORD_RULES = [
  {
    zoneCode: 1,
    keywords: ["cirebon", "watubelah", "sumber", "indramayu", "majalengka", "kuningan"],
  },
  {
    zoneCode: 6,
    keywords: ["papua", "jayapura", "sorong", "merauke", "timika", "manokwari", "maluku", "ambon", "ternate"],
  },
  {
    zoneCode: 5,
    keywords: [
      "kalimantan",
      "balikpapan",
      "samarinda",
      "banjarmasin",
      "pontianak",
      "palangkaraya",
      "tarakan",
      "sulawesi",
      "makassar",
      "manado",
      "palu",
      "kendari",
      "gorontalo",
      "mamuju",
    ],
  },
  {
    zoneCode: 4,
    keywords: [
      "bali",
      "denpasar",
      "badung",
      "ntb",
      "lombok",
      "mataram",
      "ntt",
      "kupang",
      "sumatera",
      "sumatra",
      "aceh",
      "medan",
      "padang",
      "pekanbaru",
      "batam",
      "jambi",
      "palembang",
      "bengkulu",
      "lampung",
      "bangka",
      "belitung",
    ],
  },
  {
    zoneCode: 2,
    keywords: [
      "jawa barat",
      "bandung",
      "bekasi",
      "depok",
      "bogor",
      "karawang",
      "cikarang",
      "cimahi",
      "tasikmalaya",
      "sukabumi",
      "garut",
      "dki jakarta",
      "jakarta",
    ],
  },
  {
    zoneCode: 3,
    keywords: [
      "banten",
      "tangerang",
      "serang",
      "cilegon",
      "jawa tengah",
      "semarang",
      "solo",
      "surakarta",
      "magelang",
      "pekalongan",
      "tegal",
      "purwokerto",
      "yogyakarta",
      "jogja",
      "jawa timur",
      "surabaya",
      "malang",
      "sidoarjo",
      "kediri",
      "jember",
      "banyuwangi",
    ],
  },
];

const DURATION_BY_TIER = Object.freeze({
  standard: ["1 - 2 hari", "1 - 3 hari", "2 - 4 hari", "3 - 6 hari", "4 - 7 hari", "5 - 9 hari"],
  economy: ["2 - 3 hari", "2 - 4 hari", "3 - 5 hari", "4 - 8 hari", "5 - 10 hari", "7 - 12 hari"],
  express: ["1 hari", "1 hari", "1 - 2 hari", "1 - 3 hari", "2 - 3 hari", "2 - 4 hari"],
});

const FALLBACK_COURIER_SERVICES = Object.freeze({
  jnt: [
    { serviceCode: "ez", serviceName: "Reguler (EZ)", serviceType: "standard", prices: [9000, 13000, 20000, 33000, 44000, 66000] },
    { serviceCode: "eco", serviceName: "J&T Economy", serviceType: "economy", prices: [8000, 11000, 17000, 27000, 36000, 54000] },
  ],
  jne: [
    { serviceCode: "reg", serviceName: "Reguler (REG)", serviceType: "standard", prices: [10000, 14000, 21000, 34000, 45000, 68000] },
    { serviceCode: "oke", serviceName: "Ongkos Kirim Ekonomis (OKE)", serviceType: "economy", prices: [8500, 11500, 17500, 28000, 37000, 56000] },
    { serviceCode: "yes", serviceName: "Yakin Esok Sampai (YES)", serviceType: "express", prices: [18000, 25000, 35000, 55000, 72000, 110000] },
  ],
  sicepat: [
    { serviceCode: "reg", serviceName: "Reguler (REG)", serviceType: "standard", prices: [9500, 13500, 20500, 33500, 44500, 67000] },
    { serviceCode: "halu", serviceName: "Harga Mulai Lima Ribu (HALU)", serviceType: "economy", prices: [8000, 11000, 16500, 26500, 35500, 53500] },
    { serviceCode: "best", serviceName: "Besok Sampai Tujuan (BEST)", serviceType: "express", prices: [17500, 24000, 34000, 54000, 70000, 108000] },
  ],
  anteraja: [
    { serviceCode: "reg", serviceName: "Reguler", serviceType: "standard", prices: [9500, 13500, 20000, 34000, 45000, 68000] },
    { serviceCode: "nd", serviceName: "Next Day", serviceType: "express", prices: [18000, 25000, 36000, 56000, 74000, 112000] },
  ],
  pos: [
    { serviceCode: "reg", serviceName: "Pos Reguler", serviceType: "standard", prices: [10000, 14500, 21500, 33000, 43500, 65000] },
    { serviceCode: "kilat", serviceName: "Pos Nextday / Kilat", serviceType: "express", prices: [19000, 26000, 37000, 56000, 73000, 109000] },
  ],
  tiki: [
    { serviceCode: "reg", serviceName: "Reguler (REG)", serviceType: "standard", prices: [10500, 15000, 22000, 35000, 46000, 70000] },
    { serviceCode: "ons", serviceName: "Over Night Service (ONS)", serviceType: "express", prices: [19500, 27000, 38000, 58000, 75000, 115000] },
  ],
});

const FALLBACK_INSTANT_SERVICES = Object.freeze({
  gosend: [
    { serviceCode: "instant", serviceName: "GoSend Instant", serviceType: "instant", duration: "1 - 2 jam", price: 18000 },
    { serviceCode: "same_day", serviceName: "GoSend Same Day", serviceType: "instant", duration: "6 - 8 jam", price: 13000 },
  ],
  grab: [
    { serviceCode: "instant", serviceName: "GrabExpress Instant", serviceType: "instant", duration: "1 - 2 jam", price: 19000 },
    { serviceCode: "same_day", serviceName: "GrabExpress Same Day", serviceType: "instant", duration: "6 - 8 jam", price: 14000 },
  ],
});

const SERVICE_BUCKET = Object.freeze({
  standard: 0,
  economy: 0,
  express: 1,
  instant: 2,
  cargo: 3,
});

const FREE_TIE_ORDER = Object.freeze({
  standard: 0,
  economy: 1,
  express: 2,
  instant: 3,
  cargo: 4,
});

function extractPostal5(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return /^\d{5}$/.test(digits) ? digits : "";
}

function normalizePostalTokenKey(value) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return "";
  return extractPostal5(trimmed) || trimmed;
}

function cleanString(value, fallback, maxLen = 200) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLen) : fallback;
}

function clampInt(value, fallback, min, max) {
  if (value === null || value === undefined || value === "") return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.round(Math.min(max, Math.max(min, n)));
}

function validCoordFloat(value, fallback, min, max) {
  if (value === null || value === undefined || value === "") return fallback;
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) return fallback;
  return n;
}

function extractCoords(obj) {
  if (!obj || typeof obj !== "object") return null;
  const rawLat = obj.lat ?? obj.latitude ?? obj.originLat;
  const rawLon = obj.lon ?? obj.longitude ?? obj.originLon;
  if (rawLat === null || rawLat === undefined || rawLat === "") return null;
  if (rawLon === null || rawLon === undefined || rawLon === "") return null;
  const lat = Number(rawLat);
  const lon = Number(rawLon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return { lat, lon };
}

function normalizeCourierList(couriers, fallback) {
  if (typeof couriers === "string") {
    couriers = couriers.split(",");
  }
  if (!Array.isArray(couriers)) return [...fallback];
  const filtered = [];
  const seen = new Set();
  for (const c of couriers) {
    if (typeof c !== "string") continue;
    const code = c.trim().toLowerCase();
    if (ALLOWED_COURIER_SET.has(code) && !seen.has(code)) {
      seen.add(code);
      filtered.push(code);
    }
  }
  return filtered.length > 0 ? filtered : [...fallback];
}

function getCached(cache, key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function setCached(cache, key, value, ttlMs) {
  const now = Date.now();
  for (const [k, v] of cache) {
    if (v.expiresAt <= now) cache.delete(k);
  }
  while (cache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey === undefined) break;
    cache.delete(oldestKey);
  }
  cache.set(key, { value, expiresAt: now + ttlMs });
}

/**
 * Normalizes and validates store shipping configuration against defaults.
 */
export function sanitizeShippingSettings(input, fallbackConfig = DEFAULT_SHIPPING_CONFIG) {
  const base =
    fallbackConfig && typeof fallbackConfig === "object"
      ? {
          ...DEFAULT_SHIPPING_CONFIG,
          ...fallbackConfig,
          enabledCouriers: normalizeCourierList(
            fallbackConfig.enabledCouriers,
            DEFAULT_SHIPPING_CONFIG.enabledCouriers,
          ),
        }
      : {
          ...DEFAULT_SHIPPING_CONFIG,
          enabledCouriers: [...DEFAULT_SHIPPING_CONFIG.enabledCouriers],
        };

  if (!input || typeof input !== "object") {
    return base;
  }

  return {
    originName: cleanString(input.originName, base.originName, 120),
    originAddress: cleanString(input.originAddress, base.originAddress, 240),
    originCity: cleanString(input.originCity, base.originCity, 100),
    originProvince: cleanString(input.originProvince, base.originProvince, 100),
    originPostalCode: extractPostal5(input.originPostalCode) || base.originPostalCode,
    originLat: validCoordFloat(input.originLat, base.originLat, -90, 90),
    originLon: validCoordFloat(input.originLon, base.originLon, -180, 180),
    defaultWeightGrams: clampInt(input.defaultWeightGrams, base.defaultWeightGrams, 100, 50000),
    freeAbove: clampInt(input.freeAbove, base.freeAbove, 0, 100000000),
    enabledCouriers: normalizeCourierList(input.enabledCouriers, base.enabledCouriers),
  };
}

/**
 * Layers environment freeAbove default and persisted store shipping settings cleanly.
 */
export function mergeShippingSettings(storedShipping, envFreeAbove) {
  const baseWithEnv = {
    ...DEFAULT_SHIPPING_CONFIG,
    enabledCouriers: [...DEFAULT_SHIPPING_CONFIG.enabledCouriers],
    freeAbove: clampInt(envFreeAbove, DEFAULT_SHIPPING_CONFIG.freeAbove, 0, 100000000),
  };
  return sanitizeShippingSettings(storedShipping, baseWithEnv);
}

function lookupProduct(catalogMap, productId) {
  if (!catalogMap || !productId) return undefined;
  if (catalogMap instanceof Map) return catalogMap.get(productId);
  if (Array.isArray(catalogMap)) return catalogMap.find((p) => p?.id === productId);
  if (typeof catalogMap === "object") return catalogMap[productId];
  return undefined;
}

/**
 * Computes total cart shipping weight in grams (clamped >= 100g).
 */
export function computeBagShippingWeight(lines, catalogMap, defaultWeightGrams = DEFAULT_SHIPPING_CONFIG.defaultWeightGrams) {
  const unitFallback = clampInt(defaultWeightGrams, DEFAULT_SHIPPING_CONFIG.defaultWeightGrams, 100, 50000);
  if (!Array.isArray(lines) || lines.length === 0) return 100;
  let total = 0;
  for (const line of lines) {
    const qty = Number(line?.quantity);
    if (!Number.isFinite(qty) || qty <= 0) continue;
    const product = lookupProduct(catalogMap, line?.productId);
    const productWeight = Number(product?.weightGrams);
    const unitWeight = Number.isFinite(productWeight) && productWeight > 0 ? Math.round(productWeight) : unitFallback;
    total += unitWeight * Math.round(qty);
  }
  return Math.max(100, Math.round(total));
}

/**
 * Classifies an Indonesian destination into regional shipping Zones 1..6.
 */
export function resolveRegionZone(destination = {}) {
  const postal5 = extractPostal5(destination?.postal ?? destination?.postalCode);
  if (postal5) {
    const prefix = Number(postal5.slice(0, 2));
    if (prefix === 45) return ZONE_META[1];
    // Evaluate 15 and 42 (Banten) before 40-46 Jawa Barat ranges.
    if (prefix === 15 || prefix === 42 || (prefix >= 50 && prefix <= 69)) return ZONE_META[3];
    if (ZONE_2_PREFIXES.has(prefix)) return ZONE_META[2];
    if ((prefix >= 20 && prefix <= 39) || (prefix >= 80 && prefix <= 87)) return ZONE_META[4];
    if ((prefix >= 70 && prefix <= 79) || (prefix >= 90 && prefix <= 96)) return ZONE_META[5];
    if (prefix >= 97 && prefix <= 99) return ZONE_META[6];
  }

  const text = `${destination?.province || ""} ${destination?.city || ""}`.toLowerCase();
  if (text.trim()) {
    for (const rule of ZONE_KEYWORD_RULES) {
      if (rule.keywords.some((kw) => text.includes(kw))) {
        return ZONE_META[rule.zoneCode];
      }
    }
  }

  return ZONE_META[3];
}

function classifyServiceType(serviceType, serviceCode, serviceName) {
  const combined = `${serviceType || ""} ${serviceCode || ""} ${serviceName || ""}`.toLowerCase();
  if (/(instant|same[_\s-]?day)/.test(combined)) return "instant";
  if (/(cargo|jtr|gokil|trucking|kargo)/.test(combined)) return "cargo";
  if (/(yes|best|next[_\s-]?day|\bnd\b|ons|express|kilat|overnight|priority)/.test(combined)) return "express";
  if (/(oke|halu|eco|economy|hemat)/.test(combined)) return "economy";
  return "standard";
}

function deduplicateAndSortOptions(options) {
  const byKey = new Map();
  for (const opt of options) {
    if (!opt || !opt.courierCode || !opt.serviceCode) continue;
    const key = `${opt.courierCode}:${opt.serviceCode}`;
    const prev = byKey.get(key);
    if (!prev || opt.rawPrice < prev.rawPrice) {
      byKey.set(key, opt);
    }
  }
  return [...byKey.values()].sort((a, b) => {
    const bucketDiff = (SERVICE_BUCKET[a.serviceType] ?? 0) - (SERVICE_BUCKET[b.serviceType] ?? 0);
    if (bucketDiff !== 0) return bucketDiff;
    if (a.price !== b.price) return a.price - b.price;
    const tierDiff = (FREE_TIE_ORDER[a.serviceType] ?? 9) - (FREE_TIE_ORDER[b.serviceType] ?? 9);
    if (tierDiff !== 0) return tierDiff;
    if (a.rawPrice !== b.rawPrice) return a.rawPrice - b.rawPrice;
    return `${a.courierCode}:${a.serviceCode}`.localeCompare(`${b.courierCode}:${b.serviceCode}`);
  });
}

/**
 * Generates deterministic Cirebon-origin regional fallback courier rates.
 */
export function fallbackZoneRates({
  origin = DEFAULT_SHIPPING_CONFIG,
  destination = {},
  totalWeightGrams = 1000,
  enabledCouriers = DEFAULT_SHIPPING_CONFIG.enabledCouriers,
} = {}) {
  const originPostal = extractPostal5(origin?.originPostalCode ?? origin?.postal);
  const destPostal = extractPostal5(destination?.postal ?? destination?.postalCode);
  const destZone = resolveRegionZone(destination);
  const effectiveZone =
    originPostal && destPostal && originPostal.slice(0, 2) === destPostal.slice(0, 2)
      ? 1
      : destZone.zoneCode;
  const zoneIdx = Math.max(0, Math.min(5, effectiveZone - 1));
  const kg = Math.max(1, Math.ceil(Math.max(100, Number(totalWeightGrams) || 1000) / 1000));
  const couriers = normalizeCourierList(enabledCouriers, DEFAULT_SHIPPING_CONFIG.enabledCouriers);
  const allowInstant = effectiveZone === 1 && Boolean(extractCoords(origin)) && Boolean(extractCoords(destination));

  const results = [];
  for (const courierCode of couriers) {
    if (INSTANT_COURIERS.has(courierCode)) {
      if (!allowInstant) continue;
      for (const svc of FALLBACK_INSTANT_SERVICES[courierCode] || []) {
        const weightSurcharge = (kg - 1) * 2000;
        const rawPrice = svc.price + weightSurcharge;
        results.push({
          courierCode,
          courierName: COURIER_LABELS[courierCode] || courierCode.toUpperCase(),
          serviceCode: svc.serviceCode,
          serviceName: svc.serviceName,
          serviceType: svc.serviceType,
          duration: svc.duration,
          rawPrice,
          price: rawPrice,
          freeApplied: false,
          source: "zone_fallback",
        });
      }
      continue;
    }

    for (const svc of FALLBACK_COURIER_SERVICES[courierCode] || []) {
      const baseFirstKg = svc.prices[zoneIdx];
      const extraKgStep = Math.max(2000, Math.round((baseFirstKg * 0.85) / 500) * 500);
      const rawPrice = baseFirstKg + (kg - 1) * extraKgStep;
      results.push({
        courierCode,
        courierName: COURIER_LABELS[courierCode] || courierCode.toUpperCase(),
        serviceCode: svc.serviceCode,
        serviceName: svc.serviceName,
        serviceType: svc.serviceType,
        duration: DURATION_BY_TIER[svc.serviceType]?.[zoneIdx] || "2 - 4 hari",
        rawPrice,
        price: rawPrice,
        freeApplied: false,
        source: "zone_fallback",
      });
    }
  }

  return deduplicateAndSortOptions(results);
}

/**
 * Applies store free-shipping subsidy to standard and economy tiers only.
 */
export function applyFreeShipping(options, subtotal, freeAbove) {
  if (!Array.isArray(options)) return [];
  const threshold = Number(freeAbove);
  const grossSubtotal = Number(subtotal || 0);
  const qualifies =
    Number.isFinite(threshold) &&
    threshold > 0 &&
    Number.isFinite(grossSubtotal) &&
    grossSubtotal >= threshold;

  return options.map((opt) => {
    const rawPrice = Math.max(
      0,
      Math.round(Number.isFinite(Number(opt?.rawPrice)) ? Number(opt.rawPrice) : Number(opt?.price || 0)),
    );
    const eligibleTier = opt?.serviceType === "standard" || opt?.serviceType === "economy";
    if (qualifies && eligibleTier) {
      return { ...opt, rawPrice, price: 0, freeApplied: true };
    }
    return { ...opt, rawPrice, price: rawPrice, freeApplied: false };
  });
}

function computeRateHmacHex(encodedPayload, secret) {
  return createHmac("sha256", secret).update(encodedPayload).digest("hex");
}

/**
 * Signs an HMAC-SHA256 rate quote token binding rate, cart weight, subtotal, and destination.
 */
export function signRateToken(payload, secret) {
  if (!secret || (typeof secret !== "string" && !Buffer.isBuffer(secret))) {
    throw new Error("Shipping token secret is required");
  }
  const bound = {
    originPostal: normalizePostalTokenKey(payload?.originPostal),
    destPostal: normalizePostalTokenKey(payload?.destPostal),
    totalWeightGrams: Math.round(Number(payload?.totalWeightGrams || 0)),
    subtotal: Math.round(Number(payload?.subtotal || 0)),
    freeAbove: Math.round(Number(payload?.freeAbove ?? 0)),
    price: Math.round(Number(payload?.price || 0)),
    rawPrice: Math.round(Number(payload?.rawPrice ?? payload?.price ?? 0)),
    freeApplied: Boolean(payload?.freeApplied),
    courierCode: String(payload?.courierCode || "").trim().toLowerCase(),
    courierName: String(payload?.courierName || "").trim(),
    serviceCode: String(payload?.serviceCode || "").trim().toLowerCase(),
    serviceName: String(payload?.serviceName || "").trim(),
    serviceType: String(payload?.serviceType || "standard").trim().toLowerCase(),
    duration: String(payload?.duration || "").trim(),
    source: String(payload?.source || "zone_fallback").trim(),
    exp: Number.isFinite(Number(payload?.exp)) ? Math.round(Number(payload.exp)) : Date.now() + TOKEN_TTL_MS,
  };
  const encodedPayload = Buffer.from(JSON.stringify(bound), "utf8").toString("base64url");
  return `${encodedPayload}.${computeRateHmacHex(encodedPayload, secret)}`;
}

/**
 * Verifies an HMAC-SHA256 rate token against expiry and expected order parameters.
 */
export function verifyRateToken(token, expected, secret) {
  if (!secret || (typeof secret !== "string" && !Buffer.isBuffer(secret))) return null;
  if (typeof token !== "string" || !token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [encodedPayload, sigHex] = parts;
  if (!encodedPayload || !/^[a-f0-9]{64}$/i.test(sigHex)) return null;

  const expectedHex = computeRateHmacHex(encodedPayload, secret);
  const sigBuf = Buffer.from(sigHex, "hex");
  const expectedBuf = Buffer.from(expectedHex, "hex");
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  let data;
  try {
    data = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!data || typeof data !== "object") return null;
  if (!Number.isFinite(data.exp) || data.exp < Date.now()) return null;
  if (!Number.isFinite(data.price) || data.price < 0) return null;
  if (typeof data.courierCode !== "string" || !data.courierCode) return null;
  if (typeof data.serviceCode !== "string" || !data.serviceCode) return null;

  if (expected && typeof expected === "object") {
    if (
      expected.originPostal !== undefined &&
      normalizePostalTokenKey(data.originPostal) !== normalizePostalTokenKey(expected.originPostal)
    ) {
      return null;
    }
    if (
      expected.destPostal !== undefined &&
      normalizePostalTokenKey(data.destPostal) !== normalizePostalTokenKey(expected.destPostal)
    ) {
      return null;
    }
    if (
      expected.totalWeightGrams !== undefined &&
      Number(data.totalWeightGrams) !== Number(expected.totalWeightGrams)
    ) {
      return null;
    }
    if (expected.subtotal !== undefined && Number(data.subtotal) !== Number(expected.subtotal)) {
      return null;
    }
    if (expected.freeAbove !== undefined && Number(data.freeAbove) !== Number(expected.freeAbove)) {
      return null;
    }
    if (
      expected.courierCode !== undefined &&
      data.courierCode !== String(expected.courierCode).trim().toLowerCase()
    ) {
      return null;
    }
    if (
      expected.serviceCode !== undefined &&
      data.serviceCode !== String(expected.serviceCode).trim().toLowerCase()
    ) {
      return null;
    }
  }

  return data;
}

function normalizeBiteshipArea(area) {
  if (!area || typeof area !== "object") return null;
  const postal = extractPostal5(area.postal_code ?? area.postal);
  const name = String(area.name || "").trim();
  const city = String(area.city || area.administrative_division_level_2_name || "").trim();
  const province = String(area.province || area.administrative_division_level_1_name || "").trim();
  const id = String(area.id || (postal ? `area-${postal}-${name.slice(0, 24)}` : "")).trim();
  if (!id || !name) return null;
  return { id, name, city, province, postal };
}

function formatDuration(row) {
  if (typeof row.duration === "string" && row.duration.trim()) {
    return row.duration.trim();
  }
  const range = String(row.shipment_duration_range || "").trim();
  if (!range) return "";
  const unit = String(row.shipment_duration_unit || "").toLowerCase();
  if (unit.startsWith("hour")) return `${range} jam`;
  if (unit.startsWith("day")) return `${range} hari`;
  return unit ? `${range} ${unit}` : range;
}

function normalizeBiteshipRate(row) {
  if (!row || typeof row !== "object") return null;
  const courierCode = String(row.courier_code || row.company || "").trim().toLowerCase();
  const serviceCode = String(row.courier_service_code || row.service_code || row.type || "").trim().toLowerCase();
  const rawPrice = Math.round(Number(row.price));
  if (!courierCode || !serviceCode || !Number.isFinite(rawPrice) || rawPrice < 0) return null;

  const courierName = String(row.courier_name || COURIER_LABELS[courierCode] || courierCode.toUpperCase()).trim();
  const serviceName = String(row.courier_service_name || row.service_name || serviceCode.toUpperCase()).trim();
  const serviceType = classifyServiceType(row.service_type, serviceCode, serviceName);

  return {
    courierCode,
    courierName,
    serviceCode,
    serviceName,
    serviceType,
    duration: formatDuration(row),
    rawPrice,
    price: rawPrice,
    freeApplied: false,
    source: "biteship",
  };
}

function normalizeBiteshipItems(items) {
  if (!Array.isArray(items) || items.length === 0) return [];
  return items.map((item) => ({
    name: String(item?.name || "Valerie & CO Footwear").slice(0, 120),
    value: Math.max(1, Math.round(Number(item?.value ?? item?.price ?? 100000))),
    length: clampInt(item?.length, 32, 1, 500),
    width: clampInt(item?.width, 20, 1, 500),
    height: clampInt(item?.height, 12, 1, 500),
    weight: Math.max(100, Math.round(Number(item?.weight ?? item?.weightGrams ?? 1000))),
    quantity: Math.max(1, Math.round(Number(item?.quantity || 1))),
  }));
}

/**
 * Creates a Biteship API client for area autocomplete and courier rate quotes.
 */
export function biteshipClient(apiKey, { fetchImpl = globalThis.fetch } = {}) {
  const key = String(apiKey || "").trim();
  if (!key) return null;

  const rateCache = new Map();
  const areaCache = new Map();

  const headers = (isJsonPost) => ({
    Authorization: `Bearer ${key}`,
    Accept: "application/json",
    ...(isJsonPost ? { "Content-Type": "application/json" } : {}),
  });

  return {
    searchAreas: async (query) => {
      const q = String(query || "").trim();
      if (q.length < 2) return [];
      const cacheKey = q.toLowerCase();
      const cached = getCached(areaCache, cacheKey);
      if (cached) return cached;

      const url = `${BITESHIP_AREAS_URL}?countries=ID&input=${encodeURIComponent(q)}&type=single`;
      const res = await fetchImpl(url, {
        method: "GET",
        headers: headers(false),
        signal: AbortSignal.timeout(8000),
      });
      const data = await res.json();
      if (!res.ok || data?.success === false) {
        throw new Error(data?.error || `Biteship area lookup failed (${res.status})`);
      }

      const normalized = (Array.isArray(data?.areas) ? data.areas : [])
        .map(normalizeBiteshipArea)
        .filter(Boolean);
      setCached(areaCache, cacheKey, normalized, AREA_CACHE_TTL_MS);
      return normalized;
    },

    getRates: async ({ origin = DEFAULT_SHIPPING_CONFIG, destination = {}, items = [], couriers } = {}) => {
      const originCoords = extractCoords(origin);
      const destCoords = extractCoords(destination);
      const hasBothCoords = Boolean(originCoords && destCoords);

      const requestedCouriers = normalizeCourierList(couriers, DEFAULT_SHIPPING_CONFIG.enabledCouriers).filter(
        (code) => hasBothCoords || !INSTANT_COURIERS.has(code),
      );
      if (requestedCouriers.length === 0) return [];

      const originPostal = extractPostal5(origin?.originPostalCode ?? origin?.postal);
      const destPostal = extractPostal5(destination?.postal ?? destination?.postalCode);
      const originAreaId = String(origin?.originAreaId ?? origin?.areaId ?? "").trim();
      const destAreaId = String(destination?.areaId || "").trim();
      const normalizedItems = normalizeBiteshipItems(items);

      const payload = {
        ...(originAreaId ? { origin_area_id: originAreaId } : {}),
        ...(originPostal ? { origin_postal_code: Number(originPostal) } : {}),
        ...(originCoords ? { origin_latitude: originCoords.lat, origin_longitude: originCoords.lon } : {}),
        ...(destAreaId ? { destination_area_id: destAreaId } : {}),
        ...(destPostal ? { destination_postal_code: Number(destPostal) } : {}),
        ...(destCoords ? { destination_latitude: destCoords.lat, destination_longitude: destCoords.lon } : {}),
        couriers: requestedCouriers.join(","),
        items: normalizedItems,
      };

      const cacheKey = JSON.stringify(payload);
      const cached = getCached(rateCache, cacheKey);
      if (cached) return cached;

      const res = await fetchImpl(BITESHIP_RATES_URL, {
        method: "POST",
        headers: headers(true),
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000),
      });
      const data = await res.json();
      if (!res.ok || data?.success === false) {
        throw new Error(data?.error || `Biteship rates failed (${res.status})`);
      }

      const normalized = deduplicateAndSortOptions(
        (Array.isArray(data?.pricing) ? data.pricing : []).map(normalizeBiteshipRate).filter(Boolean),
      );
      setCached(rateCache, cacheKey, normalized, RATE_CACHE_TTL_MS);
      return normalized;
    },
  };
}

/**
 * Searches Indonesian shipping areas via Biteship when available, merged with local fallback presets.
 */
export async function searchShippingAreas({ biteship = null, query = "" } = {}) {
  const q = String(query || "").trim();
  const tokens = q.toLowerCase().split(/\s+/).filter(Boolean);
  const presetMatches =
    tokens.length === 0
      ? FALLBACK_AREA_PRESETS.slice(0, 12)
      : FALLBACK_AREA_PRESETS.filter((preset) => {
          const haystack = `${preset.name} ${preset.city} ${preset.province} ${preset.postal}`.toLowerCase();
          return tokens.every((token) => haystack.includes(token));
        });

  let liveMatches = [];
  if (q.length >= 2 && biteship && typeof biteship.searchAreas === "function") {
    try {
      const live = await biteship.searchAreas(q);
      if (Array.isArray(live)) {
        liveMatches = live.map(normalizeBiteshipArea).filter(Boolean);
      }
    } catch {
      liveMatches = [];
    }
  }

  const merged = [];
  const seenIds = new Set();
  const seenKeys = new Set();
  for (const area of [...liveMatches, ...presetMatches]) {
    const dedupeKey = `${area.postal}|${area.name.toLowerCase()}`;
    if (seenIds.has(area.id) || seenKeys.has(dedupeKey)) continue;
    seenIds.add(area.id);
    seenKeys.add(dedupeKey);
    merged.push(area);
    if (merged.length >= 15) break;
  }
  return merged;
}

/**
 * Quotes shipping rates using Biteship live API with automatic Cirebon-zone fallback, free shipping, and signed rate tokens.
 */
export async function quoteShippingRates({
  biteship = null,
  config = DEFAULT_SHIPPING_CONFIG,
  destination = {},
  bagSummary = {},
  secret = "",
} = {}) {
  const effectiveConfig = sanitizeShippingSettings(config, DEFAULT_SHIPPING_CONFIG);
  const destPostal = extractPostal5(destination?.postal ?? destination?.postalCode);
  const destAreaId = String(destination?.areaId || "").trim();
  const destCoords = extractCoords(destination);
  const zone = resolveRegionZone(destination);

  const subtotal = Math.max(0, Math.round(Number(bagSummary?.subtotal || 0)));
  const weightGrams = Math.max(
    100,
    Math.round(Number(bagSummary?.totalWeightGrams || effectiveConfig.defaultWeightGrams || 1000)),
  );

  const rawItems =
    Array.isArray(bagSummary?.items) && bagSummary.items.length > 0
      ? bagSummary.items
      : [
          {
            name: "Valerie & CO Footwear",
            value: Math.max(1000, subtotal || 100000),
            weight: weightGrams,
            quantity: 1,
          },
        ];

  let options = [];
  let source = "zone_fallback";

  if (biteship && typeof biteship.getRates === "function" && (destPostal || destAreaId || destCoords)) {
    try {
      const liveRates = await biteship.getRates({
        origin: effectiveConfig,
        destination,
        items: rawItems,
        couriers: effectiveConfig.enabledCouriers,
      });
      if (Array.isArray(liveRates) && liveRates.length > 0) {
        options = liveRates;
        source = "biteship";
      }
    } catch {
      options = [];
    }
  }

  if (options.length === 0) {
    options = fallbackZoneRates({
      origin: effectiveConfig,
      destination,
      totalWeightGrams: weightGrams,
      enabledCouriers: effectiveConfig.enabledCouriers,
    });
    source = "zone_fallback";
  }

  const subsidized = deduplicateAndSortOptions(
    applyFreeShipping(options, subtotal, effectiveConfig.freeAbove),
  );

  const boundDestPostal = normalizePostalTokenKey(destination?.postal ?? destination?.postalCode);
  const signedOptions = secret
    ? subsidized.map((opt) => ({
        ...opt,
        rateToken: signRateToken(
          {
            originPostal: effectiveConfig.originPostalCode,
            destPostal: boundDestPostal,
            totalWeightGrams: weightGrams,
            subtotal,
            freeAbove: effectiveConfig.freeAbove,
            price: opt.price,
            rawPrice: opt.rawPrice,
            freeApplied: opt.freeApplied,
            courierCode: opt.courierCode,
            courierName: opt.courierName,
            serviceCode: opt.serviceCode,
            serviceName: opt.serviceName,
            serviceType: opt.serviceType,
            duration: opt.duration,
            source: opt.source,
          },
          secret,
        ),
      }))
    : subsidized;

  return {
    source,
    zoneLabel: zone.zoneLabel,
    origin: {
      name: effectiveConfig.originName,
      city: effectiveConfig.originCity,
      province: effectiveConfig.originProvince,
      postal: effectiveConfig.originPostalCode,
    },
    weightGrams,
    freeAbove: effectiveConfig.freeAbove,
    options: signedOptions,
  };
}
