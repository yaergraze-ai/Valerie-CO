# Realtime Multi-Courier & Regional Shipping Design

**Date:** 2026-11-15  
**Scope:** Checkout, Address, Order Management, Store Settings, and Server Pricing Verification  
**Default Store Origin:** Universitas Muhammadiyah Cirebon (UMC) Kampus 2, Jl. Fatahillah No. 40, Watubelah, Kec. Sumber, Kabupaten Cirebon, Jawa Barat 45611 (`lat: -6.7385`, `lon: 108.4975`)

---

## 1. Intent & Why

Currently, Valerie & CO uses fixed flat shipping across all of Indonesia (`SHIPPING_STANDARD_IDR=25000`, `SHIPPING_EXPRESS_IDR=50000`, free standard shipping above `Rp2.000.000`) and buyers cannot choose a courier (JNE, J&T, SiCepat, Anteraja, POS, TIKI, GoSend, Grab) or see real delivery costs by distance/region.

This feature gives shoppers a **Shopee-like shipping experience**:
- Buyers pick an actual courier & service tier in checkout with real IDR pricing and delivery estimates (`ETD`).
- Shipments originate from **Watubelah, Cirebon, Jawa Barat (`45611`)**, so buyers in Cirebon / Jawa Barat pay significantly less than outer provinces (e.g., Kalimantan, Sulawesi, Papua).
- Rates come automatically in real time from **Biteship API** whenever configured, while keeping checkout reliable ("tidak banyak kendala") via HMAC-signed quote tokens and a deterministic Cirebon-origin regional zone fallback whenever Biteship is unconfigured, offline, or timing out.

---

## 2. Goals, Non-Goals, and Anti-Goals

### Goals
- Fetch real-time domestic courier rates from **Biteship API** (`POST https://api.biteship.com/v1/rates/couriers`) and support optional area/postal lookup (`GET https://api.biteship.com/v1/maps/areas`), both proxied strictly server-side so `BITESHIP_API_KEY` stays private.
- Allow buyers to supply destinations effortlessly using the existing checkout workflow:
  1. Manual address fields (`city`, `province`, `postal`),
  2. Area / postal autocomplete (`/api/shipping/areas`),
  3. Existing GPS detect, OpenStreetMap Nominatim search, or Quick Area Pins (`lat`/`lon` + auto-extracted `province` & `postal`).
- Display Shopee-style courier options via a shared `<CourierOptionPicker>` (used in `MidtransCheckout.tsx` and IDR `serverMode` `SimulationCheckout` Step 02 `Opsi Pengiriman`) showing courier name/badge, service name, duration (`ETD`), IDR fee, and crossed-out original price with **`Gratis`** when free-shipping eligibility applies.
- Keep Midtrans and IDR checkout totals tamper-proof on the server (`/api/payments/quote` and `/api/orders/create`) across stateless Vercel Serverless instances via short-lived HMAC-SHA256 `rateToken`s bound to destination postal code, cart weight, and store origin.
- Allow Admins to adjust store shipping settings (`originName`, `originPostalCode`, `originProvince`, `originCity`, `originLat`, `originLon`, `defaultWeightGrams`, `freeAbove`, `enabledCouriers`) in `Dashboard.tsx` → `SettingsPanel`, persisted in `store_settings`.
- Preserve 100% backward compatibility with legacy callers/tests sending `{ express: boolean }` without `shippingOption`.

### Non-Goals
- Automated Biteship booking/AWB label printing or courier webhook tracking (`POST /v1/orders`, `/v1/trackings`). Admins continue inputting manual tracking numbers (`Nomor resi`) when marking orders `shipped`, assisted by displaying the buyer's chosen courier & service in `OrderDetail`.
- Per-SKU `weightGrams` editor in `ProductEditor` or `product(p)` RBAC changes (**Design Call:** defer per-product weights for now; compute cart weight from `settings.shipping.defaultWeightGrams` defaulting to `1000g` per unit, optionally reading `product.weightGrams` if present in data).
- Multi-warehouse split shipments per order.
- Real-time international courier rates in USD mode (USD checkout continues using existing `SHIPPING_RATES.USD`).
- Automatic Cash on Delivery (COD) via couriers (payments remain via Midtrans).

### Anti-Goals
- Never trust client-supplied `shippingFee` amounts without verifying an authentic server-signed `rateToken` (or falling back to authoritative server quote logic).
- Never block checkout or blank the modal if `BITESHIP_API_KEY` is missing, Biteship rate-limits/times out, or an older saved `Address` lacks `province`/`areaId`/`lat`/`lon`.
- Never require a new SQL migration solely to persist store settings or order courier metadata (`store_settings` and `orders.data` are already flexible JSON/JSONB documents).

---

## 3. Approaches Considered

| Approach | Why Considered | Trade-offs | Decision |
| :--- | :--- | :--- | :--- |
| **1. Biteship API + Signed Quote Token + Cirebon Zone Fallback** | Directly accepts `origin_postal_code`, `destination_postal_code`, `area_id`, AND `latitude`/`longitude` already captured by `AddressFields` GPS/OSM pins; handles both regular and instant couriers in one call. | Live production calls cost a small per-request Biteship fee (free in Sandbox); Mitigated with a 5-min in-memory cache + graceful regional zone fallback. | **Selected** |
| **2. RajaOngkir Komerce V2** | Popular Indonesian domestic courier directory with a free daily-quota Starter tier. | Strictly tied to proprietary Province → City → Subdistrict IDs; does not work seamlessly from raw postal codes or GPS/OSM coordinates and lacks unified GoSend/Grab instant pricing. | Rejected |
| **3. Manual Province Rate Matrix Only** | Zero external API keys or ongoing API fees. | Does not satisfy real-time courier accuracy requested by owner; manual maintenance across provinces and couriers. | Used **only** as automatic fallback when Biteship is unavailable |

---

## 4. Architecture & Component Design

### 4.1 Server Shipping Module (`server/shipping.mjs`)

1. **Default Configuration (`DEFAULT_SHIPPING_CONFIG`)**:
   - `originName`: `"UMC Kampus 2 Watubelah (Cirebon)"`
   - `originAddress`: `"Jl. Fatahillah No. 40, Watubelah, Sumber"`
   - `originCity`: `"Kabupaten Cirebon"`
   - `originProvince`: `"Jawa Barat"`
   - `originPostalCode`: `"45611"`
   - `originLat`: `-6.7385`
   - `originLon`: `108.4975`
   - `defaultWeightGrams`: `1000` (1 kg per shoe unit when `product.weightGrams` is unset)
   - `freeAbove`: defaults to `idrShipping.freeAbove` (`2000000`, overrideable to `0` by Admin to disable store-subsidized free shipping)
   - `enabledCouriers`: `["jne", "jnt", "sicepat", "anteraja", "pos", "tiki", "gosend", "grab"]`

2. **Biteship Client (`biteshipClient(apiKey)`)**:
   - Reads `BITESHIP_API_KEY` trimmed; returns `null` when empty.
   - `searchAreas(query)`: calls `GET https://api.biteship.com/v1/maps/areas?countries=ID&input=<q>&type=single` with `Authorization: Bearer <key>`, 8s abort timeout, cached 15 minutes in memory (case-insensitive query key, max 500 entries).
   - `getRates({ origin, destination, items, couriers })`: calls `POST https://api.biteship.com/v1/rates/couriers`, 10s abort timeout.
     - Automatically filters out instant couriers (`gosend`, `grab`) unless **both** origin and destination `latitude` & `longitude` are valid numbers (preventing Biteship validation errors when buyer only enters a postal code).
     - Builds Biteship `items` from validated server catalog items (`name`, `value` in IDR, `weight` in grams per unit = `product.weightGrams || defaultWeightGrams`, box dimensions `length: 32, width: 20, height: 12`, `quantity`).
     - Normalizes Biteship `pricing[]` rows into uniform option objects:
       ```js
       {
         courierCode: "jne",
         courierName: "JNE",
         serviceCode: "reg",
         serviceName: "Reguler (REG)",
         serviceType: "standard" | "express" | "economy" | "instant" | "cargo",
         duration: "2 - 3 hari",
         rawPrice: 14000,
         price: 14000,         // becomes 0 if freeAbove subsidy applies
         freeApplied: false,
         source: "biteship",
       }
       ```
     - Deduplicates by `${courierCode}:${serviceCode}` and sorts cleanly (instant/same-day or cheapest standard tiers cleanly ordered by price).
     - Caches identical requests for 5 minutes in memory to reduce Biteship API usage.

3. **Regional Zone Fallback (`fallbackZoneRates`)**:
   - Triggered automatically when `BITESHIP_API_KEY` is unset, Biteship HTTP errors/times out, or Biteship returns 0 rates (or destination lacks postal code -> uses general Zone 3 fallback notice).
   - Resolves buyer's destination zone primarily from normalized 5-digit Indonesian postal code first 2 digits (with province/city keyword fallback):
     - **Zone 1 (Ciayumajakuning — `45xxx`: Cirebon, Indramayu, Majalengka, Kuningan):** 1 kg base standard ~Rp9.000 (`J&T EZ`), ~Rp10.000 (`JNE REG`), ~Rp9.500 (`SiCepat REG`), express ~Rp18.000 (`JNE YES`).
     - **Zone 2 (Jawa Barat lainnya & Jabodetabek — `40–44`, `16–17`, `10–14`):** standard ~Rp13.000–15.000, economy ~Rp11.000, express ~Rp25.000.
     - **Zone 3 (Banten, Jawa Tengah, DIY, Jawa Timur — `15`, `42`, `50–69`):** standard ~Rp20.000–22.000, economy ~Rp17.000, express ~Rp35.000.
     - **Zone 4 (Bali, NTB, NTT, Sumatera — `20–39`, `80–87`):** standard ~Rp34.000, economy ~Rp27.000, express ~Rp55.000.
     - **Zone 5 (Kalimantan, Sulawesi, Gorontalo — `70–79`, `90–96`):** standard ~Rp45.000, economy ~Rp36.000, express ~Rp72.000.
     - **Zone 6 (Maluku & Papua — `97–99`):** standard ~Rp68.000, economy ~Rp54.000, express ~Rp110.000.
   - Weight multiplier: `kg = Math.max(1, Math.ceil(totalWeightGrams / 1000))`, charging `baseFirstKg + (kg - 1) * extraKgStep`.

4. **Free-Shipping Subsidy Rule**:
   - **Design Call (parity with existing checkout math):** Eligibility uses **gross `subtotal >= effectiveFreeAbove && effectiveFreeAbove > 0`** (before promo voucher discount), matching `idrQuote()` and `totals()`. When Admin explicitly sets `freeAbove` (`0` = disabled) in `store_settings`, that DB setting takes precedence over `SHIPPING_FREE_ABOVE_IDR` for both `/api/shipping/rates` and legacy fallback quotes.
   - Applies to `standard` and `economy` courier service tiers only (`serviceType === "standard" || serviceType === "economy"`, inferred from Biteship `service_type` / service code `reg|ez|oke|ctc|siunt|halu`—never overriding `express`/`instant`/`sameday`/`yes`/`best`).
   - Preserves `rawPrice` while setting `price: 0` and `freeApplied: true`.

5. **Stateless Quote Integrity (`rateToken`)**:
   - **Design Call (Stateless Secret Resolution):** `server/app.mjs` resolves a deterministic HMAC secret across stateless Vercel Serverless instances in priority order: `opts.shippingSecret` → `process.env.SHIPPING_TOKEN_SECRET` → SHA-256 domain-separated derivation from existing deployment secrets (`process.env.SUPABASE_SECRET_KEY || process.env.MIDTRANS_SERVER_KEY`) → ephemeral `randomBytes(32)` for single-process local/test runs (zero extra mandatory Vercel env var needed).
   - Each returned option includes `rateToken` signed with HMAC-SHA256 using that secret.
   - Token payload (`base64url JSON`): `{ courierCode, courierName, serviceCode, serviceName, duration, price, rawPrice, freeApplied, source, originPostal, destPostal, totalWeightGrams, subtotal, exp }`, valid for **20 minutes**.
   - On `/api/payments/quote` and `/api/orders/create`, `verifyRateToken(...)` confirms:
     1. Valid HMAC signature (timing-safe comparison),
     2. Not expired (`Date.now() <= exp`),
     3. Matches current order `destPostal`, `totalWeightGrams`, `subtotal`, and store `originPostal`.
     4. If invalid/expired/tampered -> returns HTTP `409 Conflict` (`"Tarif pengiriman berubah atau kedaluwarsa. Muat ulang ongkir."`) so user simply refreshes rates instead of paying stale amounts.
     5. If `shippingOption` is omitted completely -> falls back cleanly to legacy `idrQuote` using effective `freeAbove` for backward compatibility with existing tests and minimal API callers.

---

### 4.2 Server Endpoints & Data Persistence (`server/app.mjs`)

1. **`GET /api/shipping/areas?q=...`**:
   - Auth: `requireUser()`.
   - Queries `biteship.searchAreas(q)` when key configured; otherwise filters curated Indonesian regional/city presets (starting with Watubelah/Cirebon, Bandung, Jakarta, Bekasi, Depok, Bogor, Semarang, Surabaya, Medan, Makassar, Denpasar, Balikpapan, Jayapura).
   - Always includes postal code & province in returned items so selecting one auto-populates `postal`, `city`, `province`, and `areaId`.

2. **`POST /api/shipping/rates`**:
   - Auth: `requireUser()`.
   - Body: `{ lines, destination: { postal, province, city, areaId, lat, lon } }`.
   - Validates cart lines via catalog, computes gross `subtotal` & `totalWeightGrams`, resolves store shipping settings (`DEFAULT_SHIPPING_CONFIG` merged with `db.getSettings()?.shipping`), fetches Biteship or fallback rates, applies free-shipping rule (`subtotal >= effectiveFreeAbove`), signs `rateToken` per option, and returns:
     `{ source, zoneLabel, origin: { city, province, postal }, weightGrams, freeAbove, options }`.

3. **`POST /api/payments/quote`** & **`POST /api/orders/create`**:
   - Both accept optional `shippingOption: { rateToken }` alongside legacy `express?: boolean`.
   - When `shippingOption?.rateToken` is provided in **any `IDR` checkout** (`payment === "midtrans"` OR `currency === "IDR"` non-Midtrans checkout in `SimulationCheckout`), verifies token against recomputed gross `subtotal`, `totalWeightGrams`, destination postal code (`body.destination?.postal` on quote, `address.postal` on create), and store `originPostalCode`, deriving authoritative `shipping = verified.price` and embedding `shippingMeta` on created orders.
   - Passed total (`subtotal - discount + shipping`) continues to enforce `expectedTotal === quote.total` (`409` on mismatch) and flows directly into Midtrans `item_details` (`SHIPPING` line) and `transaction_details.gross_amount`.

4. **`GET /api/state` & `PATCH /api/patch` (`kind: "settings"`)**:
   - Extend `paymentConfig.shipping` in `GET /api/state` to expose non-secret shipping metadata: `{ standard, express, freeAbove, liveRatesEnabled: Boolean(biteship), originCity, originProvince, originPostalCode, defaultWeightGrams, enabledCouriers }`.
   - Store sanitized `settings.shipping` in `PATCH /api/patch` (`kind: "settings"`, `requireAdmin()`): allows updating `originName`, `originAddress`, `originCity`, `originProvince`, `originPostalCode`, `originLat`, `originLon`, `defaultWeightGrams` (`100..50000`), `freeAbove` (`0..100000000`), and `enabledCouriers` (whitelisted array).
   - Extend `address(a)` helper (`server/app.mjs:101`) to preserve optional sanitized `province`, `areaId`, `areaName`, `lat`, `lon` (valid finite ranges for Indonesia/world coordinates) cleanly on saved addresses and orders.

---

### 4.3 Frontend Types, Checkout UI & Admin Studio

1. **Types (`src/design/store.tsx`)**:
   - Extend `Address`: optional `province?: string`, `areaId?: string`, `areaName?: string`, `lat?: number`, `lon?: number`.
   - Extend `Order`: optional `shippingMeta?: { courierCode: string; courierName: string; serviceCode: string; serviceName: string; duration: string; weightGrams: number; rawPrice: number; freeApplied: boolean; source: string }`.
   - Extend `StoreSettings` & `paymentConfig.shipping` with the sanitized store shipping fields.
   - Update `checkout()` in `store.tsx` to accept optional `shippingOption` (`{ rateToken }`) and send it in `POST /api/orders/create`.

2. **Bag Drawer, Address Form & Receipt (`src/design/Shopping.tsx`)**:
   - **Design Call (`Bag` drawer in `IDR` mode):** Leave `SHIPPING_RATES` and `totals()` in `src/design/commerce.ts` intact for USD & unit tests, while updating `Bag` (`Shopping.tsx:201-231`) in `IDR` mode to read `effectiveFreeAbove = db.paymentConfig?.shipping?.freeAbove ?? rates.freeAbove` (hiding the progress bar when `<= 0`) and display *"Dihitung saat checkout" / "Calculated at checkout"* for shipping instead of hardcoded `Rp25.000`.
   - Update `AddressFields` (`Shopping.tsx:3314-3652`):
     - Track `province`, `areaId`, `areaName`, and `coords` (`lat`, `lon`) in component state and render hidden inputs (`name="province"`, `name="areaId"`, `name="areaName"`, `name="lat"`, `name="lon"`) + editable **Provinsi** input inside the address grid so manual entry, GPS reverse-geocode (`addr.state`), Nominatim search, and **Pin Area Cepat** all populate `province` and coordinates cleanly.
     - Add an area/kecamatan & postal autocomplete suggestion list backed by `GET /api/shipping/areas?q=...` right under the map/search or city+postal row (debounced, optional—never blocks free-form typing).
     - Add a `"Cirebon (Watubelah / Sumber)"` quick pin preset (`45611`) so testing Jawa Barat local rates is one click away.
     - Add optional prop `onDestinationChange?: (dest) => void` so checkout views receive live changes (`postal`, `province`, `city`, `areaId`, `lat`, `lon`) on mount and edit without needing extra form submission.
   - Extract a single shared `<CourierOptionPicker>` helper component (`Shopping.tsx` or standalone module imported by both `MidtransCheckout.tsx` and IDR `SimulationCheckout` when `serverMode` is active; offline `!serverMode` demo keeps static `Standar` / `Ekspres` radios).
   - Update invoice HTML (`buildInvoiceHtml`) & order receipt views to show **Kurir / Layanan** (e.g., `JNE · Reguler (2–3 hari)`) whenever `order.shippingMeta` is present.

3. **Shopee-Style Courier Picker (`src/design/MidtransCheckout.tsx` + shared `<CourierOptionPicker>`)**:
   - Replace the static 2-button (`Reguler` / `Ekspres`) card in Step 02 (`Opsi Pengiriman`) of `MidtransCheckout.tsx` (and IDR `serverMode` `SimulationCheckout`) with `<CourierOptionPicker>` driven by `POST /api/shipping/rates`:
     - Header displays store origin (`Dikirim dari Kab. Cirebon, Jawa Barat`) and package weight (`Berat 1 kg`), plus a compact badge indicating **`Ongkir Live Biteship`** or **`Estimasi Zona Wilayah`** when running in fallback mode.
     - Debounce (`350ms`) rate fetches whenever `destination` (`postal.trim().length >= 5`, `areaId`, or `lat`/`lon`) or `db.bag` changes (no refetch needed on coupon `code` changes since free-shipping eligibility uses gross `subtotal`); before a 5-digit postal code is entered, show default preview or clear inline prompt `"Masukkan 5 digit kode pos / pilih area untuk tarif akurat"`.
     - Auto-select the first affordable `standard` option (e.g. `J&T EZ` / `JNE REG`), or keep the user's selected `courierCode:serviceCode` across refreshes if still available.
     - Each option row displays: **Courier + Service** (`JNE · Reguler`), **Estimasi tiba** (`2 - 3 hari`), **Harga** (or strikethrough `Rp14.000` + **`Gratis`** pill when `freeApplied`).
     - Changing the selected courier option passes `shippingOption: { rateToken }` into `/api/payments/quote` and checkout submission.

4. **Admin Studio & Order Detail (`src/design/Dashboard.tsx`)**:
   - In `SettingsPanel`: add **"Pengaturan Pengiriman & Kurir"** fieldset displaying live status pill (`Biteship Aktif` vs `Mode Estimasi Zona`), inputs for **Nama/Alamat Asal**, **Kota Asal**, **Provinsi**, **Kode Pos Asal** (default Watubelah `45611`), **Berat Default per Pasang (gram)** (`1000`), **Minimum Belanja Gratis Ongkir Reguler (IDR)** (`2000000`, `0` = nonaktif), and **Kurir Aktif** checkboxes, persisted via existing `PATCH /api/patch` (`kind: "settings"`).
   - In `OrderDetail`: display the chosen courier badge & service tier (`o.shippingMeta.courierName · o.shippingMeta.serviceName`) right above `Nomor resi` so staff know which courier to ship with.

---

## 5. Error Handling & Security Guardrails

- **No client price trust:** `rateToken` is HMAC-SHA256 signed server-side and verified against server-calculated `subtotal`, `totalWeightGrams`, and `address.postal`. Any tampered/stale `rateToken` returns HTTP `409` with a bilingual prompt to refresh shipping rates.
- **No secret exposure:** `BITESHIP_API_KEY` stays strictly in server `process.env` (never serialized into `/api/state`, `/api/shipping/rates`, or client bundles).
- **Rate fetch resilience:** If Biteship is slow (>10s), returns 4xx/5xx, or `BITESHIP_API_KEY` is missing, `server/shipping.mjs` logs nothing sensitive and seamlessly switches to the deterministic Cirebon-origin Regional Zone Fallback so orders never fail.
- **Instant courier safety:** `gosend`/`grab` are excluded automatically unless valid destination `lat`/`lon` coordinates exist.

---

## 6. Verification Plan

1. **Automated Unit & API Tests (`tests/shipping.test.mjs`)**:
   - Regional fallback rates ordered cheaper for Cirebon (`45611`) & Jawa Barat (`40115`) than Jawa Tengah (`50132`), Sumatera (`20111`), and Papua (`99111`), scaling accurately above 1 kg.
   - Biteship API client integration test (mocked `fetch`): verifies `Bearer` header, request payload, instant courier gating with/without coordinates, 5-min caching, and automatic fallback on upstream 500/timeout.
   - Security test: forged, modified, mismatched-postal, or expired `rateToken` rejected with `409`; valid `rateToken` persists `order.shipping` & `order.shippingMeta` and matches Midtrans `gross_amount`.
   - Backward compatibility: existing `tests/payments.test.mjs` and `orders/create` without `shippingOption` keep passing unchanged.
   - Admin `PATCH /api/patch` (`settings.shipping`) persists Watubelah / custom origin settings while rejecting non-admin `403`.
2. **Typecheck, Lint & Build**: `tsc -b`, `npm run lint`, `npm test`, `npm run build`.
3. **Live Browser Verification**: Verify Address Pin (`Watubelah / Cirebon 45611` vs luar Jawa Barat seperti `Surabaya` / `Makassar`), live courier selector UI, Midtrans quote update, and Admin Settings panel in a real browser.
