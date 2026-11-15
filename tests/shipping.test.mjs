import test from "node:test";
import assert from "node:assert/strict";
import {
  ALLOWED_COURIERS,
  DEFAULT_SHIPPING_CONFIG,
  FALLBACK_AREA_PRESETS,
  applyFreeShipping,
  biteshipClient,
  computeBagShippingWeight,
  fallbackZoneRates,
  mergeShippingSettings,
  quoteShippingRates,
  resolveRegionZone,
  sanitizeShippingSettings,
  searchShippingAreas,
  signRateToken,
  verifyRateToken,
} from "../server/shipping.mjs";

const cheapestStandard = (options) => {
  const std = options.filter((o) => o.serviceType === "standard");
  assert.ok(std.length > 0, "Expected at least one standard option");
  return Math.min(...std.map((o) => o.rawPrice));
};

test("Regional zone fallback prices Cirebon and Jawa Barat lower than outer regions and scales by weight", async () => {
  const baseConfig = {
    ...DEFAULT_SHIPPING_CONFIG,
    originPostalCode: "45611",
    freeAbove: 2000000,
  };

  const quoteFor = (postal, totalWeightGrams = 1000) =>
    quoteShippingRates({
      biteship: null,
      config: baseConfig,
      destination: { postal },
      bagSummary: { subtotal: 500000, totalWeightGrams },
      secret: "test-shipping-secret",
    });

  const cirebon = await quoteFor("45611");
  const bandung = await quoteFor("40115");
  const surabaya = await quoteFor("60271");
  const medan = await quoteFor("20111");
  const makassar = await quoteFor("90111");
  const jayapura = await quoteFor("99111");

  assert.equal(cirebon.source, "zone_fallback");
  assert.equal(cirebon.origin.postal, "45611");
  assert.equal(cirebon.weightGrams, 1000);
  assert.ok(cirebon.options.every((o) => typeof o.rateToken === "string" && o.rateToken.includes(".")));

  const pCirebon = cheapestStandard(cirebon.options);
  const pBandung = cheapestStandard(bandung.options);
  const pSurabaya = cheapestStandard(surabaya.options);
  const pMedan = cheapestStandard(medan.options);
  const pMakassar = cheapestStandard(makassar.options);
  const pJayapura = cheapestStandard(jayapura.options);

  assert.ok(pCirebon < pBandung, `Expected Cirebon (${pCirebon}) < Bandung (${pBandung})`);
  assert.ok(pBandung <= pSurabaya, `Expected Bandung (${pBandung}) <= Surabaya (${pSurabaya})`);
  assert.ok(pSurabaya < pMedan, `Expected Surabaya (${pSurabaya}) < Medan (${pMedan})`);
  assert.ok(pMedan < pMakassar, `Expected Medan (${pMedan}) < Makassar (${pMakassar})`);
  assert.ok(pMakassar < pJayapura, `Expected Makassar (${pMakassar}) < Jayapura (${pJayapura})`);

  const cirebonHeavy = await quoteFor("45611", 2000);
  assert.ok(
    cheapestStandard(cirebonHeavy.options) > pCirebon,
    "2000g cart weight should cost more than 1000g",
  );

  const emptyPostalQuote = await quoteFor("");
  assert.equal(emptyPostalQuote.source, "zone_fallback");
  assert.ok(emptyPostalQuote.options.length > 0);
  assert.equal(resolveRegionZone({ postal: "" }).zoneCode, 3);
  assert.equal(resolveRegionZone({ postal: "42111" }).zoneCode, 3);
  assert.equal(resolveRegionZone({ postal: "45611" }).zoneCode, 1);
  assert.equal(resolveRegionZone({ postal: "", province: "Papua" }).zoneCode, 6);
});

test("Free shipping applies to standard/economy tiers on gross subtotal and honors freeAbove = 0", () => {
  const sample = [
    { courierCode: "jnt", serviceCode: "ez", serviceType: "standard", rawPrice: 14000, price: 14000, freeApplied: false },
    { courierCode: "jne", serviceCode: "oke", serviceType: "economy", rawPrice: 11500, price: 11500, freeApplied: false },
    { courierCode: "jne", serviceCode: "yes", serviceType: "express", rawPrice: 25000, price: 25000, freeApplied: false },
    { courierCode: "gosend", serviceCode: "instant", serviceType: "instant", rawPrice: 20000, price: 20000, freeApplied: false },
    { courierCode: "jne", serviceCode: "jtr", serviceType: "cargo", rawPrice: 40000, price: 40000, freeApplied: false },
  ];

  const subsidized = applyFreeShipping(sample, 2000000, 2000000);
  assert.equal(subsidized[0].price, 0);
  assert.equal(subsidized[0].rawPrice, 14000);
  assert.equal(subsidized[0].freeApplied, true);

  assert.equal(subsidized[1].price, 0);
  assert.equal(subsidized[1].rawPrice, 11500);
  assert.equal(subsidized[1].freeApplied, true);

  assert.equal(subsidized[2].price, 25000);
  assert.equal(subsidized[2].freeApplied, false);
  assert.equal(subsidized[3].price, 20000);
  assert.equal(subsidized[3].freeApplied, false);
  assert.equal(subsidized[4].price, 40000);
  assert.equal(subsidized[4].freeApplied, false);

  const disabled = applyFreeShipping(sample, 5000000, 0);
  assert.deepEqual(
    disabled.map((o) => [o.price, o.freeApplied]),
    [
      [14000, false],
      [11500, false],
      [25000, false],
      [20000, false],
      [40000, false],
    ],
  );

  const below = applyFreeShipping(sample, 1999999, 2000000);
  assert.ok(below.every((o) => o.price === o.rawPrice && o.freeApplied === false));
});

test("Biteship client maps rates, gates instant couriers without coords, caches hits, and falls back on error", async () => {
  const calls = [];
  const mockFetch = async (url, init = {}) => {
    const body = init.body ? JSON.parse(init.body) : null;
    calls.push({ url: String(url), method: init.method || "GET", headers: init.headers || {}, body });
    return {
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        pricing: [
          {
            courier_code: "jne",
            courier_name: "JNE",
            courier_service_code: "reg",
            courier_service_name: "Reguler",
            service_type: "standard",
            duration: "1 - 2 hari",
            price: 12000,
          },
          {
            courier_code: "jne",
            courier_name: "JNE",
            courier_service_code: "yes",
            courier_service_name: "YES",
            service_type: "overnight",
            duration: "1 hari",
            price: 22000,
          },
          ...(String(body?.couriers || "").includes("gosend")
            ? [
                {
                  courier_code: "gosend",
                  courier_name: "GoSend",
                  courier_service_code: "instant",
                  courier_service_name: "Instant",
                  service_type: "instant",
                  duration: "1 - 2 jam",
                  price: 18000,
                },
              ]
            : []),
        ],
      }),
    };
  };

  assert.equal(biteshipClient("   "), null);
  const client = biteshipClient("  bs_test_key_123  ", { fetchImpl: mockFetch });
  assert.ok(client);

  const noCoordsQuote = await quoteShippingRates({
    biteship: client,
    config: DEFAULT_SHIPPING_CONFIG,
    destination: { postal: "40115", city: "Kota Bandung", province: "Jawa Barat" },
    bagSummary: { subtotal: 500000, totalWeightGrams: 1000 },
    secret: "test-secret",
  });

  assert.equal(noCoordsQuote.source, "biteship");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://api.biteship.com/v1/rates/couriers");
  assert.equal(calls[0].headers.Authorization, "Bearer bs_test_key_123");
  assert.ok(!calls[0].body.couriers.includes("gosend"));
  assert.ok(!calls[0].body.couriers.includes("grab"));

  // Second identical quote hits 5-minute in-memory cache
  const cachedQuote = await quoteShippingRates({
    biteship: client,
    config: DEFAULT_SHIPPING_CONFIG,
    destination: { postal: "40115", city: "Kota Bandung", province: "Jawa Barat" },
    bagSummary: { subtotal: 500000, totalWeightGrams: 1000 },
    secret: "test-secret",
  });
  assert.equal(calls.length, 1);
  assert.equal(cachedQuote.options.length, noCoordsQuote.options.length);

  // Destination with coordinates enables gosend/grab
  const withCoordsQuote = await quoteShippingRates({
    biteship: client,
    config: DEFAULT_SHIPPING_CONFIG,
    destination: { postal: "45611", lat: -6.7385, lon: 108.4975 },
    bagSummary: { subtotal: 500000, totalWeightGrams: 1000 },
    secret: "test-secret",
  });
  assert.equal(calls.length, 2);
  assert.ok(calls[1].body.couriers.includes("gosend"));
  assert.ok(calls[1].body.couriers.includes("grab"));
  assert.ok(withCoordsQuote.options.some((o) => o.courierCode === "gosend" && o.serviceType === "instant"));

  // Upstream 500 or network error degrades cleanly to zone_fallback without throwing
  const failingClient500 = biteshipClient("bs_fail", {
    fetchImpl: async () => ({ ok: false, status: 500, json: async () => ({ error: "upstream error" }) }),
  });
  const fallback500 = await quoteShippingRates({
    biteship: failingClient500,
    config: DEFAULT_SHIPPING_CONFIG,
    destination: { postal: "45611" },
    bagSummary: { subtotal: 500000, totalWeightGrams: 1000 },
    secret: "test-secret",
  });
  assert.equal(fallback500.source, "zone_fallback");
  assert.ok(fallback500.options.length > 0);

  const rejectingClient = biteshipClient("bs_reject", {
    fetchImpl: async () => {
      throw new Error("ECONNRESET");
    },
  });
  const fallbackReject = await quoteShippingRates({
    biteship: rejectingClient,
    config: DEFAULT_SHIPPING_CONFIG,
    destination: { postal: "60271" },
    bagSummary: { subtotal: 500000, totalWeightGrams: 1000 },
    secret: "test-secret",
  });
  assert.equal(fallbackReject.source, "zone_fallback");
  assert.ok(fallbackReject.options.length > 0);

  const emptyPricingClient = biteshipClient("bs_empty", {
    fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ success: true, pricing: [] }) }),
  });
  const fallbackEmpty = await quoteShippingRates({
    biteship: emptyPricingClient,
    config: DEFAULT_SHIPPING_CONFIG,
    destination: { postal: "45611" },
    bagSummary: { subtotal: 2500000, totalWeightGrams: 1000 },
    secret: "test-secret",
  });
  assert.equal(fallbackEmpty.source, "zone_fallback");
  const freeStd = fallbackEmpty.options.find((o) => o.serviceType === "standard");
  assert.ok(freeStd && freeStd.price === 0 && freeStd.freeApplied === true && freeStd.rawPrice > 0);
  const verifiedFree = verifyRateToken(
    freeStd.rateToken,
    { originPostal: "45611", destPostal: "45611", totalWeightGrams: 1000, subtotal: 2500000, freeAbove: 2000000 },
    "test-secret",
  );
  assert.ok(verifiedFree && verifiedFree.price === 0 && verifiedFree.freeApplied === true);
});

test("Rate token verification detects tampering, destination mismatch, weight mismatch, and expiry", () => {
  const secret = "hmac-super-secret";
  const basePayload = {
    originPostal: "45611",
    destPostal: "40115",
    totalWeightGrams: 1000,
    subtotal: 500000,
    freeAbove: 2000000,
    price: 13000,
    rawPrice: 13000,
    freeApplied: false,
    courierCode: "jnt",
    courierName: "J&T Express",
    serviceCode: "ez",
    serviceName: "Reguler (EZ)",
    serviceType: "standard",
    duration: "1 - 3 hari",
    source: "zone_fallback",
  };

  const token = signRateToken(basePayload, secret);
  const expected = {
    destPostal: "40115",
    totalWeightGrams: 1000,
    subtotal: 500000,
    freeAbove: 2000000,
  };

  const verified = verifyRateToken(token, expected, secret);
  assert.ok(verified);
  assert.equal(verified.price, 13000);
  assert.equal(verified.courierCode, "jnt");

  // Flip last character of signature
  const lastChar = token.slice(-1);
  const flipped = token.slice(0, -1) + (lastChar === "a" ? "b" : "a");
  assert.equal(verifyRateToken(flipped, expected, secret), null);

  // Wrong secret or malformed token
  assert.equal(verifyRateToken(token, expected, "wrong-secret"), null);
  assert.equal(verifyRateToken("not-a-valid-token", expected, secret), null);

  // Mismatched destination, weight, subtotal, freeAbove
  assert.equal(verifyRateToken(token, { ...expected, destPostal: "60271" }, secret), null);
  assert.equal(verifyRateToken(token, { ...expected, totalWeightGrams: 2000 }, secret), null);
  assert.equal(verifyRateToken(token, { ...expected, subtotal: 2500000 }, secret), null);
  assert.equal(verifyRateToken(token, { ...expected, freeAbove: 0 }, secret), null);

  // Expired token
  const expiredToken = signRateToken({ ...basePayload, exp: Date.now() - 1000 }, secret);
  assert.equal(verifyRateToken(expiredToken, expected, secret), null);
});

test("Shipping settings sanitization, merge, weight calculation, and area search", async () => {
  assert.equal(Object.isFrozen(DEFAULT_SHIPPING_CONFIG), true);
  assert.equal(DEFAULT_SHIPPING_CONFIG.originPostalCode, "45611");
  assert.ok(ALLOWED_COURIERS.includes("jne"));
  assert.ok(FALLBACK_AREA_PRESETS.some((a) => a.postal === "45611"));

  const sanitized = sanitizeShippingSettings({
    originName: "  Gudang Bandung ",
    originPostalCode: "40115",
    originLat: 95,
    originLon: "not-a-number",
    defaultWeightGrams: 50,
    freeAbove: 0,
    enabledCouriers: ["JNE", "unknown_courier", "jne", "sicepat"],
  });
  assert.equal(sanitized.originName, "Gudang Bandung");
  assert.equal(sanitized.originPostalCode, "40115");
  assert.equal(sanitized.originLat, DEFAULT_SHIPPING_CONFIG.originLat);
  assert.equal(sanitized.originLon, DEFAULT_SHIPPING_CONFIG.originLon);
  assert.equal(sanitized.defaultWeightGrams, 100);
  assert.equal(sanitized.freeAbove, 0);
  assert.deepEqual(sanitized.enabledCouriers, ["jne", "sicepat"]);

  const mergedWithEnv = mergeShippingSettings({ originCity: "Kota Bekasi" }, 1500000);
  assert.equal(mergedWithEnv.freeAbove, 1500000);
  assert.equal(mergedWithEnv.originCity, "Kota Bekasi");

  const mergedDisableFree = mergeShippingSettings({ freeAbove: 0 }, 2000000);
  assert.equal(mergedDisableFree.freeAbove, 0);

  const lines = [
    { productId: "p1", quantity: 2 },
    { productId: "p2", quantity: 1 },
  ];
  const mapCatalog = new Map([
    ["p1", { id: "p1", weightGrams: 800 }],
    ["p2", { id: "p2" }],
  ]);
  assert.equal(computeBagShippingWeight(lines, mapCatalog, 1000), 2600);
  assert.equal(computeBagShippingWeight(lines, [{ id: "p1", weightGrams: 800 }], 1000), 2600);
  assert.equal(computeBagShippingWeight(lines, { p1: { id: "p1", weightGrams: 800 } }, 1000), 2600);
  assert.equal(computeBagShippingWeight([], mapCatalog, 1000), 100);

  // Area search combines Biteship live areas + fallback presets and survives Biteship errors
  let areaCalls = 0;
  const areaClient = biteshipClient("bs_area_key", {
    fetchImpl: async (url) => {
      areaCalls++;
      assert.ok(String(url).includes("/v1/maps/areas"));
      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          areas: [
            {
              id: "IDNP6IDNC222IDND2222",
              name: "Watubelah, Sumber, Kab. Cirebon",
              administrative_division_level_1_name: "Jawa Barat",
              administrative_division_level_2_name: "Kabupaten Cirebon",
              postal_code: 45611,
            },
          ],
        }),
      };
    },
  });

  const liveAreas = await searchShippingAreas({ biteship: areaClient, query: "Watubelah" });
  assert.equal(liveAreas[0].id, "IDNP6IDNC222IDND2222");
  assert.equal(liveAreas[0].postal, "45611");
  // Cached second call
  await searchShippingAreas({ biteship: areaClient, query: "watubelah" });
  assert.equal(areaCalls, 1);

  const failingAreaClient = biteshipClient("bs_fail_area", {
    fetchImpl: async () => ({ ok: false, status: 503, json: async () => ({}) }),
  });
  const fallbackAreas = await searchShippingAreas({ biteship: failingAreaClient, query: "45611" });
  assert.ok(fallbackAreas.some((a) => a.postal === "45611"));

  // Check fallbackZoneRates standalone
  const zoneRates = fallbackZoneRates({
    origin: DEFAULT_SHIPPING_CONFIG,
    destination: { postal: "45611", lat: -6.7385, lon: 108.4975 },
    totalWeightGrams: 1000,
    enabledCouriers: ALLOWED_COURIERS,
  });
  assert.ok(zoneRates.some((o) => o.courierCode === "gosend"));
  assert.ok(zoneRates.some((o) => o.courierCode === "jne"));
});
