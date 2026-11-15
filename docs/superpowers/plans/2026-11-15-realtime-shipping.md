# Realtime Multi-Courier & Regional Shipping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Shopee-style multi-courier checkout experience originating from Watubelah, Kab. Cirebon (`45611`, Jawa Barat) powered by Biteship API with stateless HMAC quote integrity and automatic regional zone fallback.

**Architecture:** A new server module (`server/shipping.mjs`) handles Biteship `/v1/rates/couriers` & `/v1/maps/areas` calls (with caching and automatic Cirebon-origin zone fallback), free-shipping subsidy computation, and HMAC-signed `rateToken` tokens verified statelessly across Vercel Serverless instances in `server/app.mjs`. On the frontend, shared components (`src/design/CourierPicker.tsx`, `AddressFields` in `src/design/Shopping.tsx`) drive real-time courier selection in both `MidtransCheckout.tsx` and server-mode IDR `SimulationCheckout`, backed by store origin/courier settings in `Dashboard.tsx`.

**Tech Stack:** Node.js ESM, TypeScript/React 19, Biteship REST API (`fetch`), Node `node:crypto` HMAC-SHA256, `node:test`, Vitest/Vite build, SQLite & Supabase JSON/JSONB settings/orders.

**Spec:** [docs/superpowers/specs/2026-11-15-realtime-shipping-design.md](file:///c:/Users/hann/Downloads/solere-luxury-store-v4/solere-luxury/docs/superpowers/specs/2026-11-15-realtime-shipping-design.md)

## Global Constraints
- Default store origin: Universitas Muhammadiyah Cirebon Kampus 2 Watubelah (`originName: "UMC Kampus 2 Watubelah (Cirebon)"`, `originAddress: "Jl. Fatahillah No. 40, Watubelah, Sumber"`, `originCity: "Kabupaten Cirebon"`, `originProvince: "Jawa Barat"`, `originPostalCode: "45611"`, `originLat: -6.7385`, `originLon: 108.4975`).
- Demo/test safety: **Never** call courier booking/pickup endpoints (`POST /v1/orders`); integrate `rates/couriers` and `maps/areas` only.
- Package weight default: `defaultWeightGrams: 1000` per unit (`product.weightGrams || defaultWeightGrams`).
- Free shipping applies when `subtotal >= effectiveFreeAbove && effectiveFreeAbove > 0` (gross subtotal before coupons) to `standard`/`economy` tiers only; Admin setting `freeAbove` (`0..100000000`, `0` = disabled) overrides env `SHIPPING_FREE_ABOVE_IDR`.
- Secret discipline: `BITESHIP_API_KEY` and signing secrets must never leave the server; no new mandatory Vercel environment variable may break stateless deployments.
- Backward compatibility: All 49 existing tests (including legacy `{ express: boolean }` calls without `shippingOption` and USD mode) must continue passing unchanged.

## Review Focus
1. Missing destination coordinates (`lat`/`lon` absent) when instant couriers (`gosend`/`grab`) are enabled -> strip instant couriers before calling Biteship so standard couriers succeed cleanly.
2. Address postal code or bag weight changed between `/api/shipping/rates` and `/api/orders/create` -> reject stale `rateToken` with HTTP `409` instead of undercharging shipping.
3. `BITESHIP_API_KEY` missing or Biteship returning 5xx/timeout/empty rates -> seamlessly degrade to deterministic Cirebon-origin `fallbackZoneRates` without surfacing blocking errors.
4. Coupon applied while gross subtotal qualifies for free shipping -> keep `freeAbove` evaluated on gross `subtotal` and allow `freeAbove = 0` to disable subsidy across both rate quotes and legacy fallback.
5. Forged or tampered `rateToken` (bad HMAC, altered price, expired `exp`) -> timing-safe rejection with HTTP `409` on `/api/payments/quote` and `/api/orders/create`.

---

### Task 1: Server Shipping Module & Core Logic (`server/shipping.mjs`)

**Files:**
- Create: `server/shipping.mjs`
- Create: `tests/shipping.test.mjs`

**Interfaces:**
- Produces in `server/shipping.mjs`:
  - `DEFAULT_SHIPPING_CONFIG`: frozen default config for UMC Watubelah Cirebon (`45611`).
  - `ALLOWED_COURIERS`: `["jne", "jnt", "sicepat", "anteraja", "pos", "tiki", "gosend", "grab"]`.
  - `FALLBACK_AREA_PRESETS`: curated Indonesian regional postal/province presets including Watubelah Cirebon `45611`.
  - `sanitizeShippingSettings(input, fallbackConfig)`: returns normalized store shipping config (`{ originName, originAddress, originCity, originProvince, originPostalCode, originLat, originLon, defaultWeightGrams, freeAbove, enabledCouriers }`).
  - `mergeShippingSettings(storedShipping, envFreeAbove)`: merges stored DB settings over `DEFAULT_SHIPPING_CONFIG` and env default cleanly.
  - `computeBagShippingWeight(lines, catalogMap, defaultWeightGrams)`: returns integer total weight in grams (`>= 100`).
  - `resolveRegionZone(destination)`: classifies `{ postal, province, city }` into Zones `1..6` (`zoneCode`, `zoneLabel`).
  - `fallbackZoneRates({ origin, destination, totalWeightGrams, enabledCouriers })`: returns normalized rate array ordered cheaper for Cirebon/Jabar than outer islands.
  - `applyFreeShipping(options, subtotal, freeAbove)`: marks qualifying `standard`/`economy` tiers `price: 0, freeApplied: true` while preserving `rawPrice`.
  - `signRateToken(payload, secret)` / `verifyRateToken(token, expected, secret)`: HMAC-SHA256 sign/verify with 20-min TTL and timing-safe digest check.
  - `biteshipClient(apiKey, { fetchImpl }?)`: returns `{ searchAreas(query), getRates({ origin, destination, items, couriers }) } | null` with 5-min rate cache, 15-min area cache, and instant-courier coordinate gating.
  - `quoteShippingRates({ biteship, config, destination, bagSummary, secret })`: orchestrates Biteship -> automatic `fallbackZoneRates` -> `applyFreeShipping` -> attaches `rateToken` and returns `{ source, zoneLabel, origin, weightGrams, freeAbove, options }`.

- [ ] **Step 1: Write failing unit tests in `tests/shipping.test.mjs`**

Tests to include with exact assertions:
1. `"Regional zone fallback prices Cirebon and Jawa Barat lower than outer regions and scales by weight"` — assert `quoteShippingRates` with `biteship: null`, `originPostalCode: "45611"`, `totalWeightGrams: 1000`, `freeAbove: 2000000`, `subtotal: 500000`:
   - Watubelah/Cirebon (`postal: "45611"`) cheapest standard price < Bandung (`postal: "40115"`) <= Surabaya (`postal: "60271"`) < Medan (`postal: "20111"`) < Makassar (`postal: "90111"`) < Jayapura (`postal: "99111"`).
   - `2000g` cart weight produces higher standard price than `1000g` for the same destination.
   - Empty `postal: ""` safely falls back to Zone 3 without throwing.
2. `"Free shipping applies to standard/economy tiers on gross subtotal and honors freeAbove = 0"` — assert `applyFreeShipping` sets `price === 0` and `freeApplied === true` (keeping `rawPrice > 0`) for `standard`/`economy`, leaves `express`/`instant` untouched, and makes zero changes when `freeAbove === 0`.
3. `"Biteship client maps rates, gates instant couriers without coords, caches hits, and falls back on error"` — mock `fetchImpl`:
   - Without `destination.lat`/`lon`, `POST /v1/rates/couriers` body `couriers` omits `gosend` and `grab`; with `lat`/`lon`, includes them.
   - Verifies `Authorization: Bearer <trimmedKey>` header and cached second identical call invokes `fetchImpl` only once.
   - When `fetchImpl` rejects or returns `500`, `quoteShippingRates` returns `source: "zone_fallback"` with valid options instead of throwing.
4. `"Rate token verification detects tampering, destination mismatch, weight mismatch, and expiry"` — sign payload with `signRateToken`, confirm valid verify returns payload, then verify `null` return when: last character flipped, `destPostal` differs, `totalWeightGrams` differs, `subtotal` differs, or `exp < Date.now()`.

- [ ] **Step 2: Run `node --test tests/shipping.test.mjs` to confirm FAIL**

Run: `node --test tests/shipping.test.mjs`  
Expected: FAIL (`Cannot find module '../server/shipping.mjs'`).

- [ ] **Step 3: Implement `server/shipping.mjs`**

Create `server/shipping.mjs` implementing all exported functions from the Interfaces block:
- Biteship endpoint URLs: `https://api.biteship.com/v1/rates/couriers` and `https://api.biteship.com/v1/maps/areas`.
- Zone mapping table by 2-digit postal code prefix (`45` Zone 1; `40-44,16-17,10-14` Zone 2; `15,42,50-69` Zone 3; `20-39,80-87` Zone 4; `70-79,90-96` Zone 5; `97-99` Zone 6) with province keyword backup (`jawa barat`, `dki jakarta`, `banten`, `jawa tengah`, `jawa timur`, `papua`, `maluku`, `kalimantan`, `sulawesi`).
- Deduplicate options by `courierCode:serviceCode`, classify service types (`instant|sameday` -> `"instant"`, `yes|best|next|ons|express|kilat` -> `"express"`, `oke|halu|eco|hemat` -> `"economy"`, `cargo|jtr|gokil|trucking` -> `"cargo"`, otherwise `"standard"`), sort cleanly (`source === "biteship"` preserves affordable standard-first or natural order cleanly, placing free options prominently without burying express).
- Enforce `timingSafeEqual` on HMAC hex digests inside `verifyRateToken`.

- [ ] **Step 4: Run `node --test tests/shipping.test.mjs` to verify PASS**

Run: `node --test tests/shipping.test.mjs`  
Expected: PASS (all unit tests pass).

- [ ] **Step 5: Commit Task 1**

```bash
git add server/shipping.mjs tests/shipping.test.mjs
git commit -m "feat(shipping): add Biteship client, Cirebon zone fallback, and HMAC rate tokens"
```

---

### Task 2: Wire Server Routes, Settings Persistence & Order Verification (`server/app.mjs`, `.env.example`)

**Files:**
- Modify: `server/app.mjs` (imports, `createApp` params, `address(a)`, `state(u)`, `/api/shipping/areas`, `/api/shipping/rates`, `/api/payments/quote`, `/api/patch` `settings`, `/api/orders/create`)
- Modify: `server/midtrans.mjs` (`idrQuote` optional override `shippingOverride` or reuse `shipping` calculation cleanly)
- Modify: `.env.example` (add optional commented/blank `BITESHIP_API_KEY=` and `SHIPPING_TOKEN_SECRET=`)
- Modify: `tests/shipping.test.mjs` (add full HTTP integration tests against `createApp`)

**Interfaces:**
- Consumes: Task 1 exports from `server/shipping.mjs`.
- Produces on `createApp(opts)`:
  - Optional test/injection opts: `biteshipKey`, `shippingClient`, `shippingSecret`.
  - Secret resolution helper in `createApp`: uses `shippingSecret || SHIPPING_TOKEN_SECRET || sha256("valerie-shipping-v1:" + (supabaseSecretKey || midtransKey)) || randomBytes(32)`.
  - `GET /api/shipping/areas?q=<text>` -> `{ areas: Array<{ id, name, city, province, postal }> }`.
  - `POST /api/shipping/rates` -> `{ source, zoneLabel, origin, weightGrams, freeAbove, options }`.
  - `POST /api/payments/quote` accepts optional `shippingOption: { rateToken }` + `destination?: { postal }`, sets `shippingMeta` on response when token used, returns HTTP `409` if tampered/stale.
  - `POST /api/orders/create` accepts optional `shippingOption: { rateToken }` for both `midtrans` and non-Midtrans `IDR` checkouts, sets `order.shipping` & `order.shippingMeta`, enforces `expectedTotal`, returns HTTP `409` on invalid/stale `rateToken`, and preserves legacy `express` fallback when `shippingOption` is omitted.
  - `GET /api/state` exposes `paymentConfig.shipping`: `{ standard, express, freeAbove, liveRatesEnabled, originName, originCity, originProvince, originPostalCode, defaultWeightGrams, enabledCouriers }` and `settings.shipping`.
  - `PATCH /api/patch` (`kind: "settings"`) saves sanitized `settings.shipping` (`requireAdmin()`).

- [ ] **Step 1: Add HTTP integration tests to `tests/shipping.test.mjs`**

Add tests covering:
1. `"GET /api/shipping/areas and POST /api/shipping/rates enforce auth and return regional rates"` — unauthenticated gets `401`; member gets Cirebon Watubelah preset in `areas`; Cirebon destination (`45611`) costs less than Makassar (`90111`).
2. `"POST /api/orders/create verifies rateToken across stateless instances, rejects tampering/mismatches, and saves shippingMeta"` — create rate token using app instance A (with shared `supabaseSecretKey` / `shippingSecret`), verify/order on app instance B (`409` on wrong `address.postal`, `409` on modified cart quantity, `409` on forged `rateToken`; `200` on matching checkout persisting `order.shippingMeta` and matching Midtrans `gross_amount`). Also test non-Midtrans `currency: "IDR"` (`gateway: null`) path cleanly!
3. `"Admin can update settings.shipping to toggle freeAbove = 0 and member receives 403"` — Admin updates `originPostalCode` & `freeAbove: 0` via `/api/patch`, verify `/api/state` reflects updated `paymentConfig.shipping.freeAbove === 0` and quotes honor `freeAbove === 0`; member patch returns `403`.

- [ ] **Step 2: Run `node --test tests/shipping.test.mjs` to confirm new tests FAIL**

Run: `node --test tests/shipping.test.mjs`  
Expected: FAIL (`404` / route not implemented).

- [ ] **Step 3: Implement backend integration in `server/app.mjs` & `.env.example`**

Update cleanly:
- `address(a)` helper (`server/app.mjs:101`): preserve sanitized optional `province`, `areaId`, `areaName`, finite `lat` (`-90..90`), `lon` (`-180..180`).
- Seed/merge shipping settings safely via `mergeShippingSettings(settings?.shipping, idrShipping.freeAbove)`.
- Extend `idrQuote(lines, products, coupon, express, shipping, { shippingFeeOverride, freeAboveOverride } = {})` in `server/midtrans.mjs` cleanly so dynamic verified shipping prices and Admin `freeAbove` overrides reuse the exact same authoritative subtotal/discount/item math without duplication.
- Implement `resolveIdrOrderQuote({ bodyLines, products, coupon, express, shippingOption, destination, settings, fallbackShipping, secret })` shared cleanly by **both** `/api/payments/quote` and `/api/orders/create`.
- Update `GET /api/state`, `PATCH /api/patch` (`settings`), `GET /api/shipping/areas`, `POST /api/shipping/rates`, `/api/payments/quote`, `/api/orders/create`.
- Add optional `BITESHIP_API_KEY=` and `SHIPPING_TOKEN_SECRET=` to `.env.example`.

- [ ] **Step 4: Run `npm test`**

Run: `npm.cmd test`  
Expected: PASS across ALL existing tests + new `tests/shipping.test.mjs` tests (`0` failures).

- [ ] **Step 5: Commit Task 2**

```bash
git add server/app.mjs .env.example tests/shipping.test.mjs
git commit -m "feat(shipping): wire Biteship rate/area endpoints, rateToken verification, and admin shipping settings"
```

---

### Task 3: Frontend Types, Shared CourierPicker Component, Bag Drawer, AddressFields & Invoice

**Files:**
- Modify: `src/design/store.tsx` (`Address`, `Order`, `Database["paymentConfig"]["shipping"]`, `Database["settings"]`, `ShippingRateOption`, `checkout`)
- Create: `src/design/CourierPicker.tsx`
- Modify: `src/design/Shopping.tsx` (`Bag`, `AddressFields`, `ATELIER_MAP_PRESETS`, `buildInvoiceHtml`, receipt summary)

**Interfaces:**
- Produces in `src/design/store.tsx`:
  - `ShippingRateOption`: `{ courierCode: string; courierName: string; serviceCode: string; serviceName: string; serviceType: string; duration: string; rawPrice: number; price: number; freeApplied: boolean; source: "biteship" | "zone_fallback"; rateToken: string }`.
  - `ShippingSettings`: `{ originName: string; originAddress: string; originCity: string; originProvince: string; originPostalCode: string; originLat: number; originLon: number; defaultWeightGrams: number; freeAbove: number; enabledCouriers: string[] }`.
  - Updated `checkout(address, code, express, key?, expectedTotal?, channel?, turnstileToken?, shippingOption?)`.
- Produces in `src/design/CourierPicker.tsx`:
  - `<CourierOptionPicker lines={BagLine[]} destination={Partial<Address>} selected={ShippingRateOption | null} onSelect={(opt) => void} />` calling `/api/shipping/rates`, displaying origin header (`Dikirim dari ...`), total weight (`kg`), Biteship vs Zona badge, and Shopee-like service rows.
- Consumed by Task 4 in `src/design/MidtransCheckout.tsx` and `SimulationCheckout` (`src/design/Shopping.tsx`).

- [ ] **Step 1: Update `src/design/store.tsx` types and `checkout()`**

Extend `Address`, `Order` (`shippingMeta`), `Database` (`paymentConfig.shipping` + `settings.shipping`), export `ShippingRateOption` / `ShippingSettings`, and pass `shippingOption` + optional `expectedTotal` cleanly inside `checkout()`.

- [ ] **Step 2: Create `src/design/CourierPicker.tsx`**

Build a crisp, accessible `<CourierOptionPicker>` component:
- Fetches `POST /api/shipping/rates` (debounced `350ms`) on `destination` (`postal`, `areaId`, `lat`, `lon`, `province`, `city`) or `lines` change.
- Auto-selects the first cheapest `standard`/`economy` option or preserves matching `courierCode:serviceCode` across refreshes.
- Shows subtle loading skeleton when fetching, clear note if postal code `< 5` digits (`"Masukkan 5 digit kode pos untuk tarif kurir paling akurat"` while showing zone preview), crossed-out `rawPrice` + **`Gratis`** pill when `freeApplied`, and localized `ETD`.

- [ ] **Step 3: Update `Bag`, `AddressFields`, and `buildInvoiceHtml` in `src/design/Shopping.tsx`**

- **`Bag` drawer (`Shopping.tsx:108-231`):** Compute `effectiveFreeAbove = currency === "IDR" && db.paymentConfig?.shipping?.freeAbove !== undefined ? db.paymentConfig.shipping.freeAbove : rates.freeAbove`. Hide `.shipping-progress` when `effectiveFreeAbove <= 0`. In `IDR` mode, display `"Ongkos kirim"` -> `"Dihitung saat checkout"` and subtotal cleanly (leave `USD` & `tests/commerce.test.mjs` untouched).
- **`AddressFields` (`Shopping.tsx:3314-3652`):**
  - Track `province`, `areaId`, `areaName` alongside `street`, `city`, `postal`, `coords`; populate `province` from GPS/OSM `addr.state`, presets, and new optional autocomplete results from `GET /api/shipping/areas?q=...`.
  - Add `"UMC Watubelah (Cirebon)"` (`45611`) to `ATELIER_MAP_PRESETS`.
  - Add hidden inputs (`name="province"`, `areaId`, `areaName`, `lat`, `lon`) + visible **Provinsi** input and `onDestinationChange` callback.
- **`buildInvoiceHtml` & receipt card:** Show chosen `order.shippingMeta` (`courierName · serviceName · duration`) cleanly in invoice header/totals.

- [ ] **Step 4: Run `.\node_modules\.bin\tsc.cmd -b` and `npm.cmd run lint`**

Run: `.\node_modules\.bin\tsc.cmd -b; npm.cmd run lint`  
Expected: `tsc -b` exits 0; `oxlint` reports 0 errors.

- [ ] **Step 5: Commit Task 3**

```bash
git add src/design/store.tsx src/design/CourierPicker.tsx src/design/Shopping.tsx
git commit -m "feat(shipping): add CourierPicker component, AddressFields area/province support, and Bag IDR updates"
```

---

### Task 4: Wire CourierPicker Into Checkouts & Styling (`src/design/MidtransCheckout.tsx`, `src/design/Shopping.tsx`, `src/design/styles.css`)

**Files:**
- Modify: `src/design/MidtransCheckout.tsx`
- Modify: `src/design/Shopping.tsx` (`SimulationCheckout`)
- Modify: `src/design/styles.css`

**Interfaces:**
- Consumes Task 3 `<CourierOptionPicker>`, `AddressFields.onDestinationChange`, and updated `checkout(..., shippingOption)`.

- [ ] **Step 1: Wire `<CourierOptionPicker>` into `src/design/MidtransCheckout.tsx`**

- Track live `destination` state synced from `savedAddress` (when `addressId !== "new"`) or `AddressFields` (`onDestinationChange`).
- Track `selectedShipping: ShippingRateOption | null`.
- Update `useEffect` calling `api("payments/quote", ...)` to include `shippingOption: selectedShipping ? { rateToken: selectedShipping.rateToken } : undefined` and `destination: { postal: destination.postal }` whenever `selectedShipping?.rateToken` changes (and pass `shippingOption` + enriched `Address` fields on form submit!).
- Replace static Step 02 (`Reguler` / `Ekspres Prioritas`) with `<CourierOptionPicker>` and auto-handle HTTP `409` on stale `rateToken` by prompting & triggering rate refresh.

- [ ] **Step 2: Wire `<CourierOptionPicker>` into `SimulationCheckout` (`src/design/Shopping.tsx`)**

- When `serverMode && currency === "IDR"`, mirror the exact same `<CourierOptionPicker>` + server `payments/quote` total synchronization so local/no-Midtrans test checkouts match Midtrans behavior identically without duplicating courier UI. Keep `!serverMode` / `USD` using `Standar`/`Ekspres` fallback.

- [ ] **Step 3: Style courier cards, Badges, Free-Shipping Strikethrough, and Area Autocomplete in `src/design/styles.css`**

- Add concise classes matching existing `.delivery-option` tokens: `.courier-picker-meta`, `.courier-source-pill`, `.courier-option-price`, `.courier-price-old`, `.courier-free-pill`, `.area-suggest-list`. Ensure clean desktop + mobile 390px alignment (`no horizontal overflow`).

- [ ] **Step 4: Run `tsc -b`, `lint`, `npm test`, and `npm run build`**

Run: `.\node_modules\.bin\tsc.cmd -b; if ($LASTEXITCODE -eq 0) { npm.cmd run lint }; if ($LASTEXITCODE -eq 0) { npm.cmd test }; if ($LASTEXITCODE -eq 0) { npm.cmd run build }`  
Expected: All checks exit 0.

- [ ] **Step 5: Commit Task 4**

```bash
git add src/design/MidtransCheckout.tsx src/design/Shopping.tsx src/design/styles.css
git commit -m "feat(shipping): integrate Shopee-style live courier selection into checkout flows"
```

---

### Task 5: Admin Shipping Settings & Order Detail Display + End-to-End Verification (`src/design/Dashboard.tsx`)

**Files:**
- Modify: `src/design/Dashboard.tsx` (`SettingsPanel` lines ~4372-4490 and `OrderDetail` lines ~2405-2480)

**Interfaces:**
- Consumes `db.settings.shipping` and `db.paymentConfig.shipping` from Task 2/3.

- [ ] **Step 1: Add Shipping Settings Fieldset to `SettingsPanel` (`src/design/Dashboard.tsx`)**

- Display read-only indicator showing whether Biteship Live key is active (`Ongkir Live Biteship Terhubung`) or running in demo/fallback (`Mode Demo Estimasi Zona Cirebon`).
- Add inputs initialized from `db.settings.shipping || DEFAULT`:
  - `originName`, `originAddress`, `originCity`, `originProvince`, `originPostalCode`
  - `defaultWeightGrams` (number, `100..50000`)
  - `freeAbove` (number IDR, `0..100000000`, note `0 = nonaktif`)
  - Checkboxes for `enabledCouriers` (`jne`, `jnt`, `sicepat`, `anteraja`, `pos`, `tiki`, `gosend`, `grab`)
- Save cleanly into `settings.shipping` on submit -> persists via `PATCH /api/patch`.

- [ ] **Step 2: Display `o.shippingMeta` in Admin & Member `OrderDetail` (`src/design/Dashboard.tsx`)**

- Above `Nomor resi` (`OrderDetail:2412`), display **Kurir dipilih** (`o.shippingMeta.courierName · o.shippingMeta.serviceName · ${o.shippingMeta.duration}`) when `o.shippingMeta` exists so Admin knows which expedition to ship through.

- [ ] **Step 3: Full Verification Suite & Browser E2E Verification**

1. Run `.\node_modules\.bin\tsc.cmd -b`, `npm.cmd run lint`, `npm.cmd test`, `npm.cmd run build` -> confirm 100% pass with 0 failures.
2. Start local server cleanly or inspect in browser (`tests/shipping.test.mjs` + Vite/Node dev test + if deploying after user confirmation, verify live!):
   - Verify Address Pin `Watubelah, Cirebon 45611` produces cheaper Jawa Barat courier rates than `Surabaya 60271` / `Makassar 90111`.
   - Verify free-shipping pill (`Gratis` + strikethrough) above `Rp2.000.000`, checkout order creation -> invoice shows courier, Admin Settings saves origin/couriers cleanly.

- [ ] **Step 4: Commit Task 5**

```bash
git add src/design/Dashboard.tsx
git commit -m "feat(shipping): add admin origin/courier settings and order detail courier display"
```
