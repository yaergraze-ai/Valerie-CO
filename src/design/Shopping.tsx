import { MidtransCheckout } from "./MidtransCheckout";
import { api } from "./backend";
import { useState, useRef, useEffect } from "react";
import confetti from "canvas-confetti";
import {
  AlertCircle,
  ArrowRight,
  Ban,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Copy,
  CreditCard,
  Download,
  ExternalLink,
  FileText,
  LocateFixed,
  MapPin,
  Minus,
  Package,
  Plus,
  Printer,
  QrCode,
  Receipt,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Store,
  Trash2,
  Truck,
  Wallet,
} from "lucide-react";
import { useStore, type Address, type Order } from "./store";
import { lineKey, SHIPPING_RATES, totals, validateBag, type Coupon } from "./commerce";
import { Empty } from "./ui";
import {
  MidtransGatewayBadge,
  PaymentBrandLogo,
  PaymentPartnersStrip,
} from "./PaymentLogos";
export function CheckoutVoucherBar({
  claimedPromos,
  activeCode,
  hasUnclaimed,
  onSelect,
}: {
  claimedPromos: Coupon[];
  activeCode: string;
  hasUnclaimed: boolean;
  onSelect: (code: string) => void;
}) {
  const { t } = useStore();
  if (!claimedPromos.length && !hasUnclaimed) {
    return (
      <small className="checkout-coupon-hint">
        {t(
          "Masukkan kode voucher Valerie & CO bila tersedia.",
          "Have a Valerie & CO voucher code? Apply it before confirming.",
        )}
      </small>
    );
  }
  return (
    <div className="promo-claimed-bar">
      {claimedPromos.length > 0 && (
        <div className="promo-claimed-row">
          <span className="promo-claimed-label">
            {t("Voucher Anda:", "Your vouchers:")}
          </span>
          {claimedPromos.map((c) => (
            <button
              key={c.code}
              type="button"
              className={`promo-chip ${activeCode === c.code ? "active" : ""}`}
              onClick={() => onSelect(c.code)}
            >
              {c.code} · −{c.percent}%
            </button>
          ))}
        </div>
      )}
      {hasUnclaimed && (
        <button
          type="button"
          className="promo-claim-link"
          onClick={() => window.dispatchEvent(new Event("solere:open-promo"))}
        >
          {t(
            "Klaim voucher diskon member →",
            "Claim member discount vouchers →",
          )}
        </button>
      )}
    </div>
  );
}
export function Bag({
  onShop,
  onCheckout,
}: {
  onShop: () => void;
  onCheckout: () => void;
}) {
  const { db, setDb, t, currency, money, priceText, notify } = useStore();
  const rates = SHIPPING_RATES[currency];
  const effectiveFreeAbove =
    currency === "IDR"
      ? (db.settings?.shipping?.freeAbove ??
        db.paymentConfig?.shipping?.freeAbove ??
        rates.freeAbove)
      : rates.freeAbove;
  const sum = totals(db.bag, db.products, undefined, false, currency);
  if (!db.bag.length)
    return (
      <Empty
        title={t("Tas Anda masih kosong", "Your bag is waiting")}
        body={t(
          "Temukan sepasang sepatu untuk langkah berikutnya.",
          "Find a pair for wherever life takes you next.",
        )}
        action={t("Jelajahi koleksi", "Explore the collection")}
        onAction={onShop}
      />
    );
  return (
    <>
      <div className="bag-lines">
        {db.bag.map((l) => {
          const p = db.products.find((p) => p.id === l.productId);
          if (!p) return null;
          return (
            <article key={lineKey(l)}>
              <img src={p.images[0]} alt={p.name} />
              <div className="bag-line-info">
                <b>{p.brand}</b>
                <p>{p.name}</p>
                <small>EU {l.size}</small>
                <div className="bag-line-bottom">
                  <strong>{priceText(p, l.quantity)}</strong>
                  <div className="quantity">
                    <button
                      aria-label={t("Kurangi jumlah", "Decrease quantity")}
                      onClick={() =>
                        setDb((d) => ({
                          ...d,
                          bag: d.bag
                            .map((x) =>
                              lineKey(x) === lineKey(l)
                                ? { ...x, quantity: x.quantity - 1 }
                                : x,
                            )
                            .filter((x) => x.quantity > 0),
                        }))
                      }
                    >
                      <Minus size={13} />
                    </button>
                    <span>{l.quantity}</span>
                    <button
                      aria-label={t("Tambah jumlah", "Increase quantity")}
                      onClick={() => {
                        const total = db.bag
                          .filter((x) => x.productId === p.id)
                          .reduce((n, x) => n + x.quantity, 0);
                        if (total >= p.stock) {
                          notify(
                            "Stok maksimum tercapai",
                            "Maximum available stock reached",
                          );
                          return;
                        }
                        setDb((d) => ({
                          ...d,
                          bag: d.bag.map((x) =>
                            lineKey(x) === lineKey(l)
                              ? { ...x, quantity: x.quantity + 1 }
                              : x,
                          ),
                        }));
                      }}
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                </div>
              </div>
              <button
                className="icon"
                aria-label={t("Hapus produk", "Remove item")}
                onClick={() =>
                  setDb((d) => ({
                    ...d,
                    bag: d.bag.filter((x) => lineKey(x) !== lineKey(l)),
                  }))
                }
              >
                <Trash2 size={16} />
              </button>
            </article>
          );
        })}
      </div>
      {effectiveFreeAbove > 0 && (
        <div className="shipping-progress">
          <span>
            <Truck size={16} />
            {sum.subtotal >= effectiveFreeAbove
              ? t(
                  "Anda mendapat gratis ongkir standar",
                  "You qualify for complimentary standard shipping",
                )
              : t(
                  `Belanja ${money(effectiveFreeAbove - sum.subtotal)} lagi untuk gratis ongkir`,
                  `You are ${money(effectiveFreeAbove - sum.subtotal)} away from complimentary shipping`,
                )}
          </span>
          <progress
            value={Math.min(sum.subtotal, effectiveFreeAbove)}
            max={effectiveFreeAbove}
          />
        </div>
      )}
      <div className="order-totals">
        <div>
          <span>Subtotal</span>
          <span>{money(sum.subtotal)}</span>
        </div>
        <div>
          <span>
            {currency === "IDR"
              ? t("Ongkos kirim", "Shipping")
              : t("Pengiriman standar", "Standard shipping")}
          </span>
          <span>
            {currency === "IDR"
              ? t("Dihitung saat checkout", "Calculated at checkout")
              : sum.shipping
                ? money(sum.shipping)
                : t("Gratis", "Complimentary")}
          </span>
        </div>
        <div className="grand-total">
          <b>Total</b>
          <b>{money(currency === "IDR" ? sum.subtotal : sum.total)}</b>
        </div>
      </div>
      <div className="bag-footer-actions">
        <button
          className="button dark full"
          onClick={onCheckout}
          disabled={!validateBag(db.bag, db.products)}
        >
          {t("Lanjut ke checkout", "Continue to checkout")}
          <ArrowRight size={17} />
        </button>
        {!validateBag(db.bag, db.products) && (
          <p role="alert" className="error-text">
            {t(
              "Stok atau produk berubah. Perbarui tas Anda.",
              "Product availability has changed. Update your bag.",
            )}
          </p>
        )}
        <div className="bag-payment-partners">
          <PaymentPartnersStrip compact />
        </div>
        <button className="text-link centered" onClick={onShop}>
          {t("Lanjut belanja", "Continue exploring")}
        </button>
      </div>
    </>
  );
}
import { MemberEntry } from "./AuthEntry";
export { MemberEntry };
export function Checkout({ onDone }: { onDone: () => void }) {
  const { db, member } = useStore();
  if (db.paymentConfig?.enabled)
    return member ? (
      <MidtransCheckout onDone={onDone} />
    ) : (
      <MemberEntry onDone={() => {}} />
    );
  return <SimulationCheckout onDone={onDone} />;
}
export type PaymentCategory =
  | "all"
  | "qris_ewallet"
  | "va"
  | "card"
  | "retail"
  | "paylater";

export type PaymentChannelSpec = {
  id: string;
  category: Exclude<PaymentCategory, "all">;
  badge: string;
  label: string;
  sub: string;
  vaPrefix: string;
  billerCode?: string;
};

export const PAYMENT_CHANNELS: readonly PaymentChannelSpec[] = [
  {
    id: "qris",
    category: "qris_ewallet",
    badge: "QRIS",
    label: "QRIS Dinamis (Semua Bank & E-Wallet)",
    sub: "Scan instan dari BCA Mobile, Livin', BRImo, Wondr, GoPay, OVO, DANA, ShopeePay",
    vaPrefix: "",
  },
  {
    id: "gopay",
    category: "qris_ewallet",
    badge: "GOPAY",
    label: "GoPay / GoPay Tabungan",
    sub: "Pembayaran instan via QR GoPay atau aplikasi Gojek",
    vaPrefix: "",
  },
  {
    id: "ovo",
    category: "qris_ewallet",
    badge: "OVO",
    label: "OVO (Push Notification & QR)",
    sub: "Kirim tagihan langsung ke nomor OVO atau scan QRIS OVO",
    vaPrefix: "",
  },
  {
    id: "shopeepay",
    category: "qris_ewallet",
    badge: "SHOPEEPAY",
    label: "ShopeePay / SPayLater",
    sub: "Konfirmasi otomatis via aplikasi Shopee",
    vaPrefix: "",
  },
  {
    id: "dana",
    category: "qris_ewallet",
    badge: "DANA",
    label: "DANA Dompet Digital",
    sub: "Saldo DANA & QRIS DANA terverifikasi instan",
    vaPrefix: "",
  },
  {
    id: "linkaja",
    category: "qris_ewallet",
    badge: "LINKAJA",
    label: "LinkAja",
    sub: "Pembayaran instan via aplikasi LinkAja",
    vaPrefix: "",
  },
  {
    id: "bca_va",
    category: "va",
    badge: "BCA VA",
    label: "BCA Virtual Account",
    sub: "Verifikasi otomatis m-BCA, KlikBCA & ATM BCA",
    vaPrefix: "88010",
  },
  {
    id: "mandiri_va",
    category: "va",
    badge: "MANDIRI",
    label: "Mandiri Bill Payment / VA",
    sub: "Verifikasi otomatis Livin' by Mandiri & ATM Mandiri",
    vaPrefix: "89022",
    billerCode: "70012",
  },
  {
    id: "bni_va",
    category: "va",
    badge: "BNI VA",
    label: "BNI Virtual Account",
    sub: "Verifikasi otomatis Wondr by BNI & Mobile Banking BNI",
    vaPrefix: "88081",
  },
  {
    id: "bri_va",
    category: "va",
    badge: "BRIVA",
    label: "BRI Virtual Account (BRIVA)",
    sub: "Verifikasi otomatis BRImo & ATM BRI",
    vaPrefix: "88810",
  },
  {
    id: "bsi_va",
    category: "va",
    badge: "BSI VA",
    label: "BSI (Bank Syariah Indonesia) VA",
    sub: "Verifikasi otomatis BYOND by BSI & BSI Net",
    vaPrefix: "90012",
  },
  {
    id: "permata_va",
    category: "va",
    badge: "PERMATA",
    label: "Permata Virtual Account",
    sub: "Verifikasi otomatis PermataME & jaringan Alto",
    vaPrefix: "85280",
  },
  {
    id: "cimb_va",
    category: "va",
    badge: "CIMB VA",
    label: "CIMB Niaga Virtual Account",
    sub: "Verifikasi otomatis OCTO Mobile & OCTO Clicks",
    vaPrefix: "80590",
  },
  {
    id: "danamon_va",
    category: "va",
    badge: "DANAMON",
    label: "Danamon / ATM Bersama Virtual Account",
    sub: "Verifikasi otomatis D-Bank PRO & seluruh jaringan ATM Bersama",
    vaPrefix: "79110",
  },
  {
    id: "card",
    category: "card",
    badge: "CARD 3DS",
    label: "Kartu Kredit / Debit Online (Visa · Mastercard · JCB · Amex)",
    sub: "Otorisasi 3D Secure 2.0 langsung di halaman ini + opsi Cicilan 0%",
    vaPrefix: "",
  },
  {
    id: "indomaret",
    category: "retail",
    badge: "INDOMARET",
    label: "Indomaret / Ceriamart",
    sub: "Bayar di kasir Indomaret terdekat dengan Kode Barcode Pembayaran",
    vaPrefix: "IDM",
  },
  {
    id: "alfamart",
    category: "retail",
    badge: "ALFAMART",
    label: "Alfamart / Alfamidi / Dan+Dan",
    sub: "Bayar di kasir Alfamart terdekat dengan Kode Barcode Pembayaran",
    vaPrefix: "ALF",
  },
  {
    id: "kredivo",
    category: "paylater",
    badge: "KREDIVO",
    label: "Kredivo PayLater",
    sub: "Bayar dalam 30 Hari (Bunga 0%) atau Cicilan 3, 6, 12 Bulan",
    vaPrefix: "",
  },
  {
    id: "akulaku",
    category: "paylater",
    badge: "AKULAKU",
    label: "Akulaku PayLater",
    sub: "Cicilan instan tanpa kartu kredit hingga 12 bulan",
    vaPrefix: "",
  },
  {
    id: "indodana",
    category: "paylater",
    badge: "INDODANA",
    label: "Indodana PayLater",
    sub: "Cicilan praktis 30 Hari, 3, 6, atau 12 Bulan",
    vaPrefix: "",
  },
];

type PaymentGroupSpec = {
  id: string;
  titleId: string;
  titleEn: string;
  tagId: string;
  tagEn: string;
  channels: string[];
};

const PAYMENT_ACCORDION_GROUPS: readonly PaymentGroupSpec[] = [
  {
    id: "qris",
    titleId: "QRIS (Semua E-Wallet & m-Banking)",
    titleEn: "QRIS (All E-Wallets & m-Banking)",
    tagId: "Instan",
    tagEn: "Instant",
    channels: ["qris"],
  },
  {
    id: "va",
    titleId: "Transfer Bank (Virtual Account)",
    titleEn: "Bank Transfer (Virtual Account)",
    tagId: "Dicek otomatis",
    tagEn: "Auto-verified",
    channels: [
      "bca_va",
      "mandiri_va",
      "bni_va",
      "bri_va",
      "bsi_va",
      "permata_va",
      "cimb_va",
      "danamon_va",
    ],
  },
  {
    id: "ewallet",
    titleId: "E-Wallet Instan",
    titleEn: "Instant E-Wallets",
    tagId: "Bayar cepat",
    tagEn: "One-tap",
    channels: ["gopay", "dana", "ovo", "shopeepay", "linkaja"],
  },
  {
    id: "card",
    titleId: "Kartu Kredit / Debit",
    titleEn: "Credit / Debit Card",
    tagId: "3D Secure",
    tagEn: "3D Secure",
    channels: ["card"],
  },
  {
    id: "retail",
    titleId: "Gerai Retail",
    titleEn: "Retail Stores",
    tagId: "Kasir",
    tagEn: "Over-the-counter",
    channels: ["alfamart", "indomaret"],
  },
  {
    id: "paylater",
    titleId: "PayLater & Cicilan",
    titleEn: "PayLater & Installments",
    tagId: "Tenor",
    tagEn: "Flexible",
    channels: ["kredivo", "akulaku", "indodana"],
  },
];

function GroupIcon({ id }: { id: string }) {
  if (id === "qris") return <QrCode size={17} aria-hidden="true" />;
  if (id === "va") return <Building2 size={17} aria-hidden="true" />;
  if (id === "ewallet") return <Wallet size={17} aria-hidden="true" />;
  if (id === "card") return <CreditCard size={17} aria-hidden="true" />;
  if (id === "retail") return <Store size={17} aria-hidden="true" />;
  return <ShieldCheck size={17} aria-hidden="true" />;
}

export function PaymentChannelOptions({
  selectedChannel,
  onSelect,
}: {
  selectedChannel: string;
  onSelect: (channelId: string) => void;
}) {
  const { t } = useStore();
  const [openGroup, setOpenGroup] = useState<string>(
    () =>
      PAYMENT_ACCORDION_GROUPS.find((g) => g.channels.includes(selectedChannel))
        ?.id || "qris",
  );

  return (
    <div className="shopee-pay-accordion" role="radiogroup" aria-label={t("Metode Pembayaran", "Payment Method")}>
      {PAYMENT_ACCORDION_GROUPS.map((group) => {
        const items = group.channels
          .map((id) => PAYMENT_CHANNELS.find((c) => c.id === id))
          .filter((x): x is PaymentChannelSpec => Boolean(x));
        const isSingle = items.length === 1;
        const single = items[0];
        const activeInGroup = items.find((c) => c.id === selectedChannel);
        const expanded = !isSingle && openGroup === group.id;

        if (isSingle && single) {
          const isSelected = selectedChannel === single.id;
          return (
            <label
              key={group.id}
              className={`shopee-pay-group-row is-single ${isSelected ? "is-selected" : ""}`}
            >
              <input
                type="radio"
                name="paymentChannel"
                className="sr-only"
                checked={isSelected}
                onChange={() => {
                  setOpenGroup(group.id);
                  onSelect(single.id);
                }}
              />
              <span className="shopee-pay-group-left">
                <span className="shopee-pay-group-ico">
                  <GroupIcon id={group.id} />
                </span>
                <span className="shopee-pay-group-text">
                  <b>{t(group.titleId, group.titleEn)}</b>
                </span>
              </span>
              <span className="shopee-pay-group-right">
                <span className="shopee-pay-tag">{t(group.tagId, group.tagEn)}</span>
                <PaymentBrandLogo channelId={single.id} size="sm" />
                <span className={`shopee-radio-dot ${isSelected ? "checked" : ""}`} aria-hidden="true" />
              </span>
            </label>
          );
        }

        return (
          <div
            key={group.id}
            className={`shopee-pay-group ${activeInGroup ? "has-active" : ""} ${expanded ? "is-open" : ""}`}
          >
            <button
              type="button"
              className="shopee-pay-group-row"
              aria-expanded={expanded}
              onClick={() => {
                setOpenGroup((cur) => (cur === group.id ? "" : group.id));
                if (!activeInGroup && items[0]) {
                  onSelect(items[0].id);
                }
              }}
            >
              <span className="shopee-pay-group-left">
                <span className="shopee-pay-group-ico">
                  <GroupIcon id={group.id} />
                </span>
                <span className="shopee-pay-group-text">
                  <span className="shopee-pay-group-title-line">
                    <b>{t(group.titleId, group.titleEn)}</b>
                    {activeInGroup && (
                      <PaymentBrandLogo channelId={activeInGroup.id} size="sm" />
                    )}
                  </span>
                  {!expanded && (
                    <span
                      className="shopee-pay-group-logos"
                      aria-hidden="true"
                      translate="no"
                    >
                      {items.slice(0, 4).map((ch) => (
                        <PaymentBrandLogo key={ch.id} channelId={ch.id} size="sm" />
                      ))}
                      {items.length > 4 && (
                        <small className="shopee-pay-more-count">
                          +{items.length - 4}
                        </small>
                      )}
                    </span>
                  )}
                </span>
              </span>
              <span className="shopee-pay-group-right">
                <span className="shopee-pay-tag">{t(group.tagId, group.tagEn)}</span>
                <ChevronDown
                  size={16}
                  className={`shopee-pay-chevron ${expanded ? "is-open" : ""}`}
                  aria-hidden="true"
                />
              </span>
            </button>

            {expanded && (
              <div className="shopee-pay-sublist">
                {items.map((ch) => {
                  const isSelected = selectedChannel === ch.id;
                  return (
                    <label
                      key={ch.id}
                      className={`shopee-pay-subrow ${isSelected ? "is-selected" : ""}`}
                    >
                      <input
                        type="radio"
                        name="paymentChannel"
                        className="sr-only"
                        checked={isSelected}
                        onChange={() => onSelect(ch.id)}
                      />
                      <span className="shopee-pay-subrow-brand" translate="no">
                        <PaymentBrandLogo channelId={ch.id} size="sm" />
                        <b>{ch.label}</b>
                      </span>
                      <span className="shopee-pay-group-right">
                        <span
                          className={`shopee-radio-dot ${isSelected ? "checked" : ""}`}
                          aria-hidden="true"
                        />
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function formatReceiptDateTime(iso: string, lang: "id" | "en") {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const datePart = d.toLocaleDateString(lang === "id" ? "id-ID" : "en-US", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const timePart = d.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  return `${datePart} · ${timePart} WIB`;
}

function escHtml(s: string) {
  return String(s || "").replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c] || c,
  );
}

function inferPaymentChannelId(order: Order, fallback = "qris"): string {
  const explicit =
    order.payment?.directCharge?.channel || order.payment?.channel || "";
  if (explicit && PAYMENT_CHANNELS.some((c) => c.id === explicit)) {
    return explicit;
  }
  const raw = `${explicit} ${order.payment?.method || ""} ${order.paymentMethod || ""}`.toLowerCase();
  if (raw.includes("echannel")) return "mandiri_va";
  if (raw.includes("cstore")) return "indomaret";
  if (raw.includes("bank_transfer") && !raw.includes("bca") && !raw.includes("bni") && !raw.includes("bri") && !raw.includes("mandiri") && !raw.includes("permata") && !raw.includes("cimb")) {
    return "bca_va";
  }
  const matched = PAYMENT_CHANNELS.find(
    (c) =>
      raw.includes(c.id.replace("_va", "")) ||
      raw.includes(c.badge.toLowerCase()),
  );
  return matched?.id || fallback;
}

function buildBarcodeBars(code: string): Array<{ x: number; w: number }> {
  const bars: Array<{ x: number; w: number }> = [];
  let x = 3;
  const seed = code || "VCO-INVOICE";
  for (let i = 0; i < 42 && x < 176; i++) {
    const ch = seed.charCodeAt(i % seed.length);
    const w = ((ch + i) % 3) + 1;
    const gap = ((ch >> (i % 4)) % 2) + 1.4;
    if (i % 2 === 0 || w > 1) {
      bars.push({ x: Number(x.toFixed(1)), w });
    }
    x += w + gap;
  }
  return bars;
}

function renderFallbackQrSvg(seedText: string) {
  const size = 21;
  const cells: Array<{ x: number; y: number }> = [];
  const isFinderArea = (r: number, c: number) =>
    (r < 8 && c < 8) || (r < 8 && c >= size - 8) || (r >= size - 8 && c < 8);
  const drawFinder = (r0: number, c0: number) => {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        const border = r === 0 || r === 6 || c === 0 || c === 6;
        const inner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        if (border || inner) cells.push({ x: c0 + c, y: r0 + r });
      }
    }
  };
  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);

  let hash = 2166136261;
  const src = seedText || "VALERIE-QRIS";
  for (let i = 0; i < src.length; i++) {
    hash ^= src.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (isFinderArea(r, c)) continue;
      if (r === 6 || c === 6) {
        if ((r + c) % 2 === 0) cells.push({ x: c, y: r });
        continue;
      }
      const step = (r * size + c) ^ hash;
      const mixed = Math.imul(step ^ (step >>> 7), 2246822519);
      if ((mixed >>> 0) % 10 < 5) cells.push({ x: c, y: r });
    }
  }
  return (
    <svg
      viewBox={`-1.5 -1.5 ${size + 3} ${size + 3}`}
      className="inline-qris-fallback-svg"
      role="img"
      aria-label="QR Code Pembayaran"
    >
      <rect x="-1.5" y="-1.5" width={size + 3} height={size + 3} fill="#ffffff" />
      {cells.map((cell, i) => (
        <rect
          key={i}
          x={cell.x}
          y={cell.y}
          width="0.92"
          height="0.92"
          rx="0.08"
          fill="#171412"
        />
      ))}
    </svg>
  );
}

type LifecycleOutcome =
  | "pending"
  | "paid"
  | "expired"
  | "cancelled"
  | "failed"
  | "refunded";

function resolveOrderOutcome(order: Order): LifecycleOutcome {
  if (order.payment?.status === "paid" || order.payment?.outcome === "paid") {
    return "paid";
  }
  if (
    order.payment?.status === "refunded" ||
    order.payment?.outcome === "refunded" ||
    order.refund?.status === "refunded"
  ) {
    return "refunded";
  }
  if (order.payment?.outcome === "expired") return "expired";
  if (order.payment?.outcome === "cancelled") return "cancelled";
  if (order.payment?.outcome === "failed") return "failed";
  if (order.status === "cancelled") {
    return order.payment?.cancelledAt || order.payment?.cancelledBy
      ? "cancelled"
      : "failed";
  }
  if (order.payment?.status === "failed") return "failed";
  if (!order.payment) return "paid";
  return "pending";
}

function resolveInvoiceStamp(order: Order, lang: "id" | "en") {
  const outcome = resolveOrderOutcome(order);
  if (outcome === "paid" && order.status === "delivered") {
    return {
      variant: "is-delivered",
      label: lang === "id" ? "SELESAI · LUNAS" : "DELIVERED · PAID",
    };
  }
  if (outcome === "paid") {
    return {
      variant: "is-paid",
      label: lang === "id" ? "LUNAS · TERVERIFIKASI" : "PAID · VERIFIED",
    };
  }
  if (outcome === "cancelled") {
    return {
      variant: "is-cancelled",
      label: lang === "id" ? "DIBATALKAN" : "CANCELLED",
    };
  }
  if (outcome === "expired") {
    return {
      variant: "is-expired",
      label: lang === "id" ? "KEDALUWARSA" : "EXPIRED",
    };
  }
  if (outcome === "failed") {
    return {
      variant: "is-failed",
      label: lang === "id" ? "PEMBAYARAN GAGAL" : "PAYMENT FAILED",
    };
  }
  if (outcome === "refunded") {
    return {
      variant: "is-refunded",
      label: lang === "id" ? "REFUND SELESAI" : "REFUNDED",
    };
  }
  return {
    variant: "is-pending",
    label: lang === "id" ? "MENUNGGU PEMBAYARAN" : "AWAITING PAYMENT",
  };
}

export function downloadOfficialReceiptHtml(
  order: Order,
  money: (n: number, c?: "USD" | "IDR") => string,
  lang: "id" | "en" = "id",
) {
  const cur = order.currency || "IDR";
  const receiptNo =
    order.receiptNumber ||
    `VCO-INV-${order.id.replace(/^SOL-/, "").slice(0, 8).toUpperCase()}`;
  const txId =
    order.payment?.transactionId ||
    order.payment?.directCharge?.transactionId ||
    `VCO-TX-${order.id.replace(/^SOL-/, "").slice(0, 8).toUpperCase()}`;
  const paidTime = formatReceiptDateTime(
    order.payment?.paidAt ||
      order.payment?.cancelledAt ||
      order.payment?.expiredAt ||
      order.date,
    lang,
  );
  const method =
    order.payment?.method ||
    order.paymentMethod ||
    "QRIS Instan (Semua Bank & E-Wallet)";
  const itemsSubtotal = order.items.reduce(
    (s, i) => s + i.price * i.quantity,
    0,
  );
  const stamp = resolveInvoiceStamp(order, lang);
  const stampColor =
    stamp.variant === "is-paid" || stamp.variant === "is-delivered"
      ? { bg: "#ecfdf5", fg: "#065f46", border: "#6ee7b7" }
      : stamp.variant === "is-cancelled"
        ? { bg: "#f5f5f4", fg: "#44403c", border: "#d6d3d1" }
        : stamp.variant === "is-expired"
          ? { bg: "#fff7ed", fg: "#9a3412", border: "#fdba74" }
          : stamp.variant === "is-failed"
            ? { bg: "#fef2f2", fg: "#991b1b", border: "#fca5a5" }
            : stamp.variant === "is-refunded"
              ? { bg: "#eef2ff", fg: "#3730a3", border: "#a5b4fc" }
              : { bg: "#fffbeb", fg: "#92400e", border: "#fcd34d" };
  const barcodeRects = buildBarcodeBars(receiptNo)
    .map(
      (b) =>
        `<rect x="${b.x}" y="2" width="${b.w}" height="28" rx="0.6" fill="#24170f" />`,
    )
    .join("");
  const rows = order.items
    .map(
      (i) => `
      <tr>
        <td style="padding:12px 10px;border-bottom:1px solid #ede4d8;">
          <strong style="color:#24170f;font-size:13.5px;">${escHtml(i.name)}</strong><br/>
          <small style="color:#6d6258;">SKU: ${escHtml(i.productCode || i.productId.toUpperCase())} · EU ${i.size}${i.color ? ` · ${escHtml(i.color)}` : ""}</small>
        </td>
        <td style="padding:12px 10px;border-bottom:1px solid #ede4d8;text-align:center;">${i.quantity}</td>
        <td style="padding:12px 10px;border-bottom:1px solid #ede4d8;text-align:right;">${escHtml(money(i.price, cur))}</td>
        <td style="padding:12px 10px;border-bottom:1px solid #ede4d8;text-align:right;font-weight:700;color:#24170f;">${escHtml(money(i.price * i.quantity, cur))}</td>
      </tr>`,
    )
    .join("");
  const refundBlock = order.refund
    ? `<div style="margin-top:16px;padding:12px 14px;border:1px solid #c7d2fe;background:#eef2ff;border-radius:10px;font-size:12.5px;color:#312e81;">
        <strong>${lang === "id" ? "CATATAN REFUND RESMI" : "OFFICIAL REFUND RECORD"} (${escHtml(order.refund.status.toUpperCase())})</strong><br/>
        ${lang === "id" ? "Nominal" : "Amount"}: <b>${escHtml(money(order.refund.amount, order.refund.currency || cur))}</b>${order.refund.reference ? ` · Ref: ${escHtml(order.refund.reference)}` : ""}<br/>
        ${lang === "id" ? "Alasan" : "Reason"}: ${escHtml(order.refund.reason)}
      </div>`
    : "";
  const isPaidLike =
    stamp.variant === "is-paid" ||
    stamp.variant === "is-delivered" ||
    stamp.variant === "is-refunded";
  const html = `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8"/>
<title>Invoice ${escHtml(receiptNo)} — Valerie &amp; CO</title>
<style>
  * { box-sizing:border-box; }
  body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; background:#f5efe6; color:#24170f; padding:28px 14px; margin:0; line-height:1.5; }
  .sheet { max-width:740px; margin:0 auto; background:#ffffff; border:1px solid #e2d8ca; border-radius:20px; overflow:hidden; box-shadow:0 20px 50px rgba(36,23,15,0.08); }
  .banner { display:flex; justify-content:space-between; align-items:flex-start; gap:18px; flex-wrap:wrap; background:linear-gradient(135deg,#24170f 0%,#442c1d 100%); color:#fcfaf7; padding:26px 28px; }
  .kicker { font-size:10.5px; letter-spacing:0.2em; text-transform:uppercase; color:#d8b384; font-weight:700; }
  .banner h1 { margin:6px 0 4px; font-family:Georgia,serif; font-size:26px; font-weight:600; color:#ffffff; }
  .banner p { margin:0; font-size:12.5px; color:rgba(252,250,247,0.75); }
  .head-right { text-align:right; display:flex; flex-direction:column; align-items:flex-end; gap:6px; }
  .stamp { display:inline-block; padding:5px 12px; border-radius:999px; background:${stampColor.bg}; color:${stampColor.fg}; border:1px solid ${stampColor.border}; font-size:11px; font-weight:800; letter-spacing:0.08em; }
  .body { padding:24px 28px 28px; }
  .parties { display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:20px; }
  .card { background:#faf6ef; border:1px solid #ebe1d4; border-radius:12px; padding:14px 16px; font-size:12.8px; }
  .card small { display:block; font-size:10.5px; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; color:#7c6858; margin-bottom:5px; }
  table { width:100%; border-collapse:collapse; font-size:13px; margin-bottom:20px; border:1px solid #ebe1d4; border-radius:12px; overflow:hidden; }
  th { text-align:left; padding:10px; background:#f8f3eb; border-bottom:1px solid #dfd3c3; font-size:11px; text-transform:uppercase; letter-spacing:0.07em; color:#6d5a4b; }
  .bottom { display:grid; grid-template-columns:1.1fr 0.9fr; gap:18px; align-items:start; }
  .seal { background:#fcfaf7; border:1px dashed #d5c6b3; border-radius:12px; padding:14px; font-size:11.8px; color:#5e4e41; }
  .totals { background:#faf6ef; border:1px solid #ebe1d4; border-radius:12px; padding:14px 16px; font-size:13px; }
  .totals div { display:flex; justify-content:space-between; padding:5px 0; }
  .totals .grand { border-top:2px solid #24170f; margin-top:8px; padding-top:10px; font-size:16px; font-weight:800; color:#24170f; }
  @media print { body { background:#fff; padding:0; } .sheet { border:0; box-shadow:none; border-radius:0; } }
  @media (max-width:600px) { .parties, .bottom { grid-template-columns:1fr; } .head-right { align-items:flex-start; text-align:left; } }
</style>
</head>
<body>
  <div class="sheet">
    <div class="banner">
      <div>
        <div class="kicker">VALERIE &amp; CO · OFFICIAL ATELIER INVOICE</div>
        <h1>${lang === "id" ? "Faktur &amp; Bukti Pembayaran" : "Official Tax &amp; Payment Invoice"}</h1>
        <p>Atelier Curated Footwear · SCBD Lot 14, Jakarta Selatan · valerie-co.my.id</p>
      </div>
      <div class="head-right">
        <span class="stamp">${escHtml(stamp.label)}</span>
        <div style="font-size:14px;font-weight:700;">${escHtml(receiptNo)}</div>
        <div style="font-size:12px;color:rgba(252,250,247,0.78);">${escHtml(order.id)} · ${escHtml(paidTime)}</div>
      </div>
    </div>
    <div class="body">
      <div class="parties">
        <div class="card">
          <small>${lang === "id" ? "Diterbitkan Untuk &amp; Tujuan Kirim" : "Billed To &amp; Shipping Destination"}</small>
          <strong>${escHtml(order.address.name || order.name)}</strong> (${escHtml(order.address.phone)})<br/>
          ${escHtml(order.email)}<br/>
          ${escHtml(order.address.street)}, ${escHtml(order.address.city)}${order.address.province ? `, ${escHtml(order.address.province)}` : ""} ${escHtml(order.address.postal)}
          ${order.shippingMeta ? `<br/><span style="color:#6b4423;font-weight:600;">${lang === "id" ? "Kurir" : "Courier"}: ${escHtml(order.shippingMeta.courierName)} · ${escHtml(order.shippingMeta.serviceName)}${order.shippingMeta.duration ? ` · ${escHtml(order.shippingMeta.duration)}` : ""}</span>` : ""}
          ${order.tracking ? `<br/><span style="color:#6b4423;font-weight:600;">Resi: ${escHtml(order.tracking)}</span>` : ""}
        </div>
        <div class="card">
          <small>${lang === "id" ? "Verifikasi &amp; Referensi Pembayaran" : "Payment Verification &amp; Reference"}</small>
          <strong>${escHtml(method)}</strong><br/>
          Ref Transaksi: <code>${escHtml(txId)}</code><br/>
          Status: <strong>${escHtml(stamp.label)}</strong>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>${lang === "id" ? "Produk &amp; SKU" : "Product &amp; SKU"}</th>
            <th style="text-align:center;">Qty</th>
            <th style="text-align:right;">${lang === "id" ? "Harga Satuan" : "Unit Price"}</th>
            <th style="text-align:right;">Subtotal</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="bottom">
        <div class="seal">
          <strong style="display:block;color:#24170f;margin-bottom:6px;">${lang === "id" ? "SEGEL OTENTIKASI DIGITAL" : "DIGITAL AUTHENTICITY SEAL"}</strong>
          <svg width="180" height="34" viewBox="0 0 180 34" aria-hidden="true">${barcodeRects}</svg>
          <div style="font-family:monospace;font-size:11px;margin:2px 0 6px;color:#24170f;">${escHtml(receiptNo)}</div>
          ${lang === "id" ? "Dokumen elektronik resmi diterbitkan otomatis oleh sistem Valerie &amp; CO sebagai bukti transaksi sah." : "Official electronic invoice generated automatically by Valerie &amp; CO."}
          ${refundBlock}
        </div>
        <div class="totals">
          <div><span>Subtotal</span><span>${escHtml(money(itemsSubtotal, cur))}</span></div>
          ${order.discount ? `<div><span>${lang === "id" ? "Potongan Voucher" : "Promo Discount"}</span><span>−${escHtml(money(order.discount, cur))}</span></div>` : ""}
          <div><span>${lang === "id" ? "Biaya Pengiriman" : "Shipping Fee"}${order.shippingMeta ? ` (${escHtml(order.shippingMeta.courierName)} · ${escHtml(order.shippingMeta.serviceName)}${order.shippingMeta.duration ? " · " + escHtml(order.shippingMeta.duration) : ""})` : ""}</span><span>${order.shipping ? escHtml(money(order.shipping, cur)) : lang === "id" ? "Gratis" : "Complimentary"}</span></div>
          <div><span>${lang === "id" ? "Proteksi &amp; Pengemasan" : "Packaging &amp; Care"}</span><span>${lang === "id" ? "Gratis" : "Complimentary"}</span></div>
          <div class="grand"><span>${isPaidLike ? (lang === "id" ? "Total Dibayar" : "Total Paid") : (lang === "id" ? "Total Faktur" : "Invoice Total")}</span><span>${escHtml(money(order.total, cur))}</span></div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Invoice-Valerie-CO-${receiptNo}.html`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function OfficialAtelierInvoice({
  order,
  showActions = false,
  onDone,
  onPrint,
}: {
  order: Order;
  showActions?: boolean;
  onDone?: () => void;
  onPrint?: () => void;
}) {
  const { db, t, lang, money } = useStore();
  const [showMap, setShowMap] = useState(false);
  const cur = order.currency || "IDR";
  const receiptNo =
    order.receiptNumber ||
    `VCO-INV-${order.id.replace(/^SOL-/, "").slice(0, 8).toUpperCase()}`;
  const txId =
    order.payment?.transactionId ||
    order.payment?.directCharge?.transactionId ||
    `VCO-TX-${order.id.replace(/^SOL-/, "").slice(0, 8).toUpperCase()}`;
  const channelId = inferPaymentChannelId(order);
  const stamp = resolveInvoiceStamp(order, lang);
  const itemsSubtotal = order.items.reduce(
    (s, i) => s + i.price * i.quantity,
    0,
  );
  const barcodeBars = buildBarcodeBars(receiptNo);
  const storeEmail = db.settings.email || "concierge@valerie-co.my.id";
  const isPaidLike =
    stamp.variant === "is-paid" ||
    stamp.variant === "is-delivered" ||
    stamp.variant === "is-refunded";
  const invoiceTimestamp = formatReceiptDateTime(
    order.payment?.paidAt ||
      order.payment?.cancelledAt ||
      order.payment?.expiredAt ||
      order.date,
    lang,
  );
  const mapQuery = encodeURIComponent(
    `${order.address.street}, ${order.address.city} ${order.address.postal}`,
  );

  return (
    <div className="vco-invoice-sheet" id="official-receipt-print-area">
      <div className="vco-invoice-head">
        <div className="vco-invoice-brand">
          <span className="vco-invoice-kicker">
            VALERIE &amp; CO · ATELIER CURATED FOOTWEAR
          </span>
          <h3>{t("Faktur & Invoice Resmi", "Official Tax & Payment Invoice")}</h3>
          <p>
            SCBD Lot 14, Jakarta Selatan · {storeEmail} · valerie-co.my.id
          </p>
        </div>
        <div className="vco-invoice-head-right">
          <span className={`vco-invoice-stamp ${stamp.variant}`}>
            {stamp.variant === "is-paid" || stamp.variant === "is-delivered" ? (
              <Check size={12} aria-hidden="true" />
            ) : stamp.variant === "is-cancelled" ? (
              <Ban size={12} aria-hidden="true" />
            ) : stamp.variant === "is-expired" ? (
              <Clock size={12} aria-hidden="true" />
            ) : stamp.variant === "is-failed" ? (
              <AlertCircle size={12} aria-hidden="true" />
            ) : stamp.variant === "is-refunded" ? (
              <RotateCcw size={12} aria-hidden="true" />
            ) : (
              <ShieldCheck size={12} aria-hidden="true" />
            )}
            <span>{stamp.label}</span>
          </span>
          <strong className="vco-invoice-no">{receiptNo}</strong>
          <small className="vco-invoice-subref">
            {order.id} · {invoiceTimestamp}
          </small>
        </div>
      </div>

      <div className="vco-invoice-parties">
        <div className="vco-invoice-party-card">
          <div className="vco-invoice-party-head">
            <small>{t("Diterbitkan Untuk & Tujuan Kirim", "Billed To & Delivery Destination")}</small>
            <button
              type="button"
              className="vco-invoice-map-btn no-print"
              onClick={() => setShowMap((v) => !v)}
            >
              <MapPin size={12} aria-hidden="true" />
              <span>{showMap ? t("Tutup Peta", "Hide Map") : t("Peta", "Map")}</span>
            </button>
          </div>
          <b>{order.address.name || order.name}</b>
          <span className="vco-invoice-party-meta">
            {order.address.phone} · {order.email}
          </span>
          <p>
            {order.address.street}, {order.address.city}
            {order.address.province ? `, ${order.address.province}` : ""}{" "}
            {order.address.postal}
          </p>
          {order.shippingMeta && (
            <span
              className="vco-invoice-courier-chip"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "12px",
                color: "#6b4423",
                fontWeight: 600,
                marginTop: "4px",
              }}
            >
              <Truck size={12} aria-hidden="true" />
              <span>
                {order.shippingMeta.courierName} · {order.shippingMeta.serviceName}
                {order.shippingMeta.duration
                  ? ` · ${order.shippingMeta.duration}`
                  : ""}
              </span>
            </span>
          )}
          {order.tracking && (
            <span className="vco-invoice-tracking-chip">
              <Truck size={12} aria-hidden="true" />
              <span>
                {t("Resi:", "Tracking:")} {order.tracking}
              </span>
            </span>
          )}
        </div>

        <div className="vco-invoice-party-card">
          <div className="vco-invoice-party-head">
            <small>{t("Verifikasi & Metode Pembayaran", "Payment Verification & Method")}</small>
            <MidtransGatewayBadge compact />
          </div>
          <div className="vco-invoice-pay-brand">
            <PaymentBrandLogo channelId={channelId} size="md" />
            <b>
              {order.payment?.method ||
                order.paymentMethod ||
                t("Pembayaran Digital", "Digital Payment")}
            </b>
          </div>
          <div className="vco-invoice-pay-meta">
            <span>
              {t("Ref Transaksi:", "Tx Ref:")} <code>{txId}</code>
            </span>
            <span>
              {t("Pembaruan:", "Updated:")} {invoiceTimestamp}
            </span>
          </div>
        </div>
      </div>

      {showMap && (
        <div className="address-map-preview no-print">
          <div className="address-map-preview-head">
            <span>
              <MapPin size={13} aria-hidden="true" />{" "}
              <b>
                {order.address.street}, {order.address.city}
              </b>
            </span>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${mapQuery}`}
              target="_blank"
              rel="noreferrer"
            >
              {t("Buka di Google Maps", "Open in Google Maps")}{" "}
              <ExternalLink size={11} aria-hidden="true" />
            </a>
          </div>
          <iframe
            title="Peta Tujuan Pengiriman Invoice"
            className="address-map-iframe"
            loading="lazy"
            src="https://www.openstreetmap.org/export/embed.html?bbox=106.7800%2C-6.2450%2C106.8400%2C-6.1950&layer=mapnik&marker=-6.2246%2C106.8096"
          />
        </div>
      )}

      <div className="vco-invoice-table-wrap">
        <table className="vco-invoice-table">
          <thead>
            <tr>
              <th>{t("Produk & Kode SKU", "Product & SKU Code")}</th>
              <th>{t("Ukuran / Varian", "Size / Variant")}</th>
              <th className="num">Qty</th>
              <th className="num">{t("Harga Satuan", "Unit Price")}</th>
              <th className="num">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item, idx) => (
              <tr key={`${item.productId}-${item.size}-${idx}`}>
                <td>
                  <div className="vco-invoice-sku-cell">
                    <img src={item.image} alt={item.name} />
                    <div>
                      <b>{item.name}</b>
                      <span className="vco-invoice-sku-pill">
                        {item.productCode || item.productId.toUpperCase()}
                      </span>
                    </div>
                  </div>
                </td>
                <td>
                  EU {item.size}
                  {item.color ? ` · ${item.color}` : ""}
                </td>
                <td className="num">{item.quantity}</td>
                <td className="num">{money(item.price, cur)}</td>
                <td className="num strong">
                  {money(item.price * item.quantity, cur)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="vco-invoice-bottom-grid">
        <div className="vco-invoice-seal-card">
          <div className="vco-invoice-seal-head">
            <div className="vco-invoice-seal-emblem" aria-hidden="true">
              <ShieldCheck size={20} />
            </div>
            <div>
              <b>{t("VALERIE & CO · VERIFIED DIGITAL INVOICE", "VALERIE & CO · VERIFIED DIGITAL INVOICE")}</b>
              <small>
                {t(
                  "Bukti pembayaran & faktur sah diterbitkan secara elektronik",
                  "Official electronically verified invoice & proof of transaction",
                )}
              </small>
            </div>
          </div>
          <div className="vco-invoice-barcode">
            <svg
              viewBox="0 0 180 34"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              {barcodeBars.map((bar, idx) => (
                <rect
                  key={idx}
                  x={bar.x}
                  y={2}
                  width={bar.w}
                  height={28}
                  rx={0.6}
                  fill="#24170f"
                />
              ))}
            </svg>
            <code>{receiptNo}</code>
          </div>
          {order.refund && (
            <div className={`vco-invoice-refund-box ${order.refund.status}`}>
              <b>
                {order.refund.status === "refunded"
                  ? t("BUKTI REFUND RESMI", "OFFICIAL REFUND RECORD")
                  : order.refund.status === "requested"
                    ? t("PENGAJUAN REFUND DIPROSES", "REFUND PENDING")
                    : t("PENGAJUAN REFUND DITOLAK", "REFUND DECLINED")}
              </b>
              <span>
                {money(order.refund.amount, order.refund.currency || cur)}
                {order.refund.reference ? ` · Ref: ${order.refund.reference}` : ""}
              </span>
              <small>{order.refund.reason}</small>
            </div>
          )}
        </div>

        <div className="vco-invoice-totals-card">
          <div>
            <span>Subtotal</span>
            <span>{money(itemsSubtotal, cur)}</span>
          </div>
          {order.discount > 0 && (
            <div className="discount-row">
              <span>{t("Potongan Voucher", "Promo Discount")}</span>
              <span>−{money(order.discount, cur)}</span>
            </div>
          )}
          <div>
            <span>
              {t("Biaya Pengiriman", "Shipping Fee")}
              {order.shippingMeta
                ? ` (${order.shippingMeta.courierName} · ${order.shippingMeta.serviceName}${order.shippingMeta.duration ? " · " + order.shippingMeta.duration : ""})`
                : ""}
            </span>
            <span>
              {order.shipping
                ? money(order.shipping, cur)
                : t("Gratis", "Complimentary")}
            </span>
          </div>
          <div>
            <span>{t("Proteksi & Pengemasan Atelier", "Atelier Packaging & Care")}</span>
            <span>{t("Gratis", "Complimentary")}</span>
          </div>
          <div className="vco-invoice-grand-row">
            <b>
              {isPaidLike
                ? t("Total Dibayar", "Total Paid")
                : t("Total Faktur", "Invoice Total")}
            </b>
            <b>{money(order.total, cur)}</b>
          </div>
        </div>
      </div>

      {showActions && (
        <div className="vco-invoice-actions no-print">
          <button
            type="button"
            className="button ghost small"
            onClick={() => (onPrint ? onPrint() : window.print())}
          >
            <Printer size={15} aria-hidden="true" />
            {t("Cetak Invoice / PDF", "Print Invoice / PDF")}
          </button>
          <button
            type="button"
            className="button ghost small"
            onClick={() => downloadOfficialReceiptHtml(order, money, lang)}
          >
            <Download size={15} aria-hidden="true" />
            {t("Unduh Invoice (.HTML)", "Download Invoice (.HTML)")}
          </button>
          {onDone && (
            <button type="button" className="button dark small" onClick={onDone}>
              {t("Lihat & Lacak Pesanan", "Track My Order")}
              <ArrowRight size={15} aria-hidden="true" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function OrderedItemsPreview({
  order,
  money,
  t,
}: {
  order: Order;
  money: (n: number, c?: "USD" | "IDR") => string;
  t: (id: string, en: string) => string;
}) {
  const cur = order.currency || "IDR";
  return (
    <div className="vco-lifecycle-items">
      <div className="vco-lifecycle-items-head">
        <span>{t("Rincian Produk Pesanan", "Order Items")}</span>
        <small>
          {order.items.reduce((sum, item) => sum + item.quantity, 0)}{" "}
          {t("pasang", "pairs")}
        </small>
      </div>
      {order.items.map((item, idx) => (
        <div
          key={`${item.productId}-${item.size}-${idx}`}
          className="vco-lifecycle-item-row"
        >
          <img src={item.image} alt={item.name} />
          <div className="vco-lifecycle-item-copy">
            <b>{item.name}</b>
            <small>
              EU {item.size}
              {item.color ? ` · ${item.color}` : ""} · ×{item.quantity}
            </small>
          </div>
          <strong>{money(item.price * item.quantity, cur)}</strong>
        </div>
      ))}
    </div>
  );
}

type StepperItem = {
  label: string;
  state: "done" | "active" | "upcoming" | "warn" | "danger" | "muted";
};

function LifecycleStepper({ steps }: { steps: StepperItem[] }) {
  return (
    <div className="vco-lifecycle-stepper">
      {steps.map((step, idx) => (
        <div key={step.label} className={`vco-step-node ${step.state}`}>
          <span className="vco-step-dot" aria-hidden="true">
            {step.state === "done" ? (
              <Check size={12} />
            ) : step.state === "warn" ? (
              <Clock size={12} />
            ) : step.state === "danger" ? (
              <AlertCircle size={12} />
            ) : step.state === "muted" ? (
              <Ban size={12} />
            ) : (
              idx + 1
            )}
          </span>
          <small>{step.label}</small>
        </div>
      ))}
    </div>
  );
}

function resolveDeadlineMs(order: Order): number {
  const raw = String(
    order.payment?.expiryTime || order.payment?.directCharge?.expiryTime || "",
  ).trim();
  if (raw) {
    const iso = raw.includes("T") ? raw : `${raw.replace(" ", "T")}+07:00`;
    const parsed = Date.parse(iso);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  const created = Date.parse(order.date);
  return (Number.isFinite(created) ? created : Date.now()) + 24 * 60 * 60 * 1000;
}

function formatDeadlineLabel(ms: number, lang: "id" | "en"): string {
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "";
  const datePart = d.toLocaleDateString(lang === "id" ? "id-ID" : "en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const timePart = d.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${datePart}, ${timePart} WIB`;
}

export function InlinePaymentAndReceipt({
  order,
  initialChannel = "qris",
  startInPaymentStage = true,
  onCheckRemoteStatus,
  checkingRemote = false,
  onDone,
  onReorderNavigate,
}: {
  order: Order;
  initialChannel?: string;
  startInPaymentStage?: boolean;
  onCheckRemoteStatus?: () => Promise<void>;
  checkingRemote?: boolean;
  onDone: () => void;
  onReorderNavigate?: () => void;
}) {
  const {
    db,
    serverMode,
    refresh,
    t,
    lang,
    money,
    chargeOrderPayment,
    cancelOrder,
    reorderOrderItems,
    notify,
  } = useStore();
  const liveOrder = db.orders.find((o) => o.id === order.id) || order;
  const directCharge = liveOrder.payment?.directCharge;
  const [selectedChannelOverride, setSelectedChannelOverride] = useState<string>("");
  const [showMethodSwitcher, setShowMethodSwitcher] = useState(false);
  const [selectedTenor, setSelectedTenor] = useState<number>(1);
  const [qrImgError, setQrImgError] = useState(false);
  const channelId =
    selectedChannelOverride ||
    directCharge?.channel ||
    liveOrder.payment?.channel ||
    initialChannel;
  const activeChannel =
    PAYMENT_CHANNELS.find((c) => c.id === channelId) || PAYMENT_CHANNELS[0];
  const outcome = resolveOrderOutcome(liveOrder);
  const prevOutcomeRef = useRef<LifecycleOutcome>(outcome);

  const [paidTab, setPaidTab] = useState<"summary" | "invoice">("summary");
  const [showOutcomeInvoice, setShowOutcomeInvoice] = useState(false);
  const [syncingLocal, setSyncingLocal] = useState(false);
  const [charging, setCharging] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelPanelOpen, setCancelPanelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState(() =>
    t("Ingin mengubah metode pembayaran", "Want to change payment method"),
  );
  const [copiedKey, setCopiedKey] = useState("");
  const deadlineMs = resolveDeadlineMs(liveOrder);
  const [secondsLeft, setSecondsLeft] = useState(() =>
    Math.max(0, Math.floor((deadlineMs - Date.now()) / 1000)),
  );
  const autoExpiredSyncedRef = useRef(false);

  const rawDigits = String(liveOrder.id || "").replace(/\D/g, "");
  const hashDigits = Array.from(String(liveOrder.id || "SOL000000"))
    .reduce((acc, c, idx) => acc + c.charCodeAt(0) * (idx + 17), 104857)
    .toString()
    .replace(/\D/g, "");
  const orderDigits = (rawDigits + hashDigits + "8840291736").slice(0, 10);

  const handleSwitchChannel = async (nextChannelId: string) => {
    setSelectedChannelOverride(nextChannelId);
    setShowMethodSwitcher(false);
    setQrImgError(false);
    setSelectedTenor(1);
    if (liveOrder.payment?.status === "pending") {
      setCharging(true);
      try {
        await chargeOrderPayment(liveOrder.id, nextChannelId);
      } catch (e) {
        notify((e as Error).message, (e as Error).message);
      } finally {
        setCharging(false);
      }
    }
  };

  const handleSyncStatus = async () => {
    if (checkingRemote || syncingLocal) return;
    if (onCheckRemoteStatus) {
      await onCheckRemoteStatus();
      return;
    }
    if (!serverMode) return;
    setSyncingLocal(true);
    try {
      await api("payments/status", { id: liveOrder.id });
      await refresh();
    } catch (e) {
      notify((e as Error).message, (e as Error).message);
    } finally {
      setSyncingLocal(false);
    }
  };

  useEffect(() => {
    if (prevOutcomeRef.current === "pending" && outcome === "paid") {
      try {
        confetti({
          particleCount: 65,
          spread: 70,
          origin: { y: 0.6 },
        });
      } catch {}
    }
    prevOutcomeRef.current = outcome;
  }, [outcome]);

  useEffect(() => {
    if (outcome !== "pending") return;
    autoExpiredSyncedRef.current = false;
    const tick = () => {
      const rem = Math.max(0, Math.floor((deadlineMs - Date.now()) / 1000));
      setSecondsLeft(rem);
      if (rem === 0 && !autoExpiredSyncedRef.current && serverMode) {
        autoExpiredSyncedRef.current = true;
        void api("payments/status", { id: liveOrder.id })
          .then(() => refresh())
          .catch(() => {});
      }
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [outcome, deadlineMs, liveOrder.id, serverMode, refresh]);

  const copyText = (key: string, text: string, labelId: string, labelEn: string) => {
    void navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    notify(labelId, labelEn);
    setTimeout(() => {
      setCopiedKey((cur) => (cur === key ? "" : cur));
    }, 2000);
  };

  const cur = liveOrder.currency || "IDR";
  const receiptNo =
    liveOrder.receiptNumber ||
    `VCO-INV-${liveOrder.id.replace(/^SOL-/, "").slice(0, 8).toUpperCase()}`;
  const txId =
    liveOrder.payment?.transactionId ||
    directCharge?.transactionId ||
    `VCO-TX-${liveOrder.id.replace(/^SOL-/, "").slice(0, 8).toUpperCase()}`;

  const chargeMatchesChannel =
    Boolean(directCharge) && directCharge?.channel === activeChannel.id;
  const isFallbackCharge = Boolean(
    chargeMatchesChannel &&
      (directCharge?.isFallback ||
        directCharge?.statusMessage === "Tagihan siap dibayar"),
  );
  const hasRealChannelCharge = chargeMatchesChannel && !isFallbackCharge;
  const virtualAccountNumber =
    (hasRealChannelCharge && (directCharge?.vaNumber || directCharge?.billKey)) ||
    "";
  const effectiveBillerCode =
    (hasRealChannelCharge && directCharge?.billerCode) || activeChannel.billerCode;
  const retailPaymentCode =
    (hasRealChannelCharge && directCharge?.paymentCode) || "";
  const liveMerchantId = hasRealChannelCharge
    ? directCharge?.merchantId || ""
    : "";
  const liveQrImageUrl = hasRealChannelCharge ? directCharge?.qrUrl || "" : "";
  const activeQrString = hasRealChannelCharge ? directCharge?.qrString || "" : "";
  const liveDeeplinkUrl = chargeMatchesChannel
    ? directCharge?.deeplinkUrl || ""
    : "";

  const hh = String(Math.floor(secondsLeft / 3600)).padStart(2, "0");
  const mm = String(Math.floor((secondsLeft % 3600) / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");
  const isBusyChecking = checkingRemote || syncingLocal;

  const downloadQrisImage = async () => {
    if (!liveQrImageUrl) return;
    try {
      const resp = await fetch(liveQrImageUrl);
      if (!resp.ok) throw new Error("fetch failed");
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `QRIS-Valerie-CO-${receiptNo}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch {
      window.open(liveQrImageUrl, "_blank", "noopener,noreferrer");
    }
  };

  const handleReorder = () => {
    const added = reorderOrderItems(liveOrder.items);
    if (added > 0) {
      onReorderNavigate?.();
      window.dispatchEvent(new Event("solere:open-checkout"));
    }
  };

  const handleConfirmCancel = async () => {
    if (cancelling) return;
    setCancelling(true);
    try {
      await cancelOrder(liveOrder.id, cancelReason);
      setCancelPanelOpen(false);
    } catch (e) {
      notify((e as Error).message, (e as Error).message);
    } finally {
      setCancelling(false);
    }
  };

  const howToSteps =
    activeChannel.id === "qris" || activeChannel.category === "qris_ewallet"
      ? [
          t(
            `Buka aplikasi ${activeChannel.id === "qris" ? "m-Banking atau E-Wallet" : activeChannel.badge} Anda dan pilih menu Scan QR / QRIS.`,
            `Open your ${activeChannel.id === "qris" ? "mobile banking or e-wallet" : activeChannel.badge} app and select Scan QR / QRIS.`,
          ),
          t(
            "Pindai kode QR di atas atau unggah gambar QRIS yang diunduh — nominal sudah terisi otomatis.",
            "Scan the QR code above or upload the downloaded PNG — the exact amount fills automatically.",
          ),
          t(
            "Konfirmasi pembayaran dengan PIN. Halaman ini otomatis terupdate setelah pembayaran terverifikasi.",
            "Confirm with your PIN. This page updates automatically once verified.",
          ),
        ]
      : activeChannel.category === "va"
        ? [
            t(
              `Buka aplikasi mobile banking ${activeChannel.label} atau ATM terdekat, lalu pilih menu Virtual Account / Multi Payment.`,
              `Open your ${activeChannel.label} mobile banking app or ATM and choose Virtual Account / Transfer.`,
            ),
            t(
              effectiveBillerCode
                ? `Masukkan Kode Perusahaan ${effectiveBillerCode} dan nomor tagihan Virtual Account di atas.`
                : "Tempel nomor Virtual Account di atas dan pastikan nama merchant Valerie & CO sesuai.",
              effectiveBillerCode
                ? `Enter Company Code ${effectiveBillerCode} and the Virtual Account number above.`
                : "Paste the Virtual Account number above and verify the merchant name Valerie & CO.",
            ),
            t(
              "Selesaikan otorisasi transfer. Sistem kami mengecek pembayaran masuk secara otomatis.",
              "Complete the transfer. Our system verifies incoming payments automatically.",
            ),
          ]
        : activeChannel.category === "retail"
          ? [
              t(
                `Kunjungi gerai ${activeChannel.badge} terdekat sebelum batas waktu pembayaran berakhir.`,
                `Visit any nearby ${activeChannel.badge} store before the payment deadline.`,
              ),
              t(
                "Tunjukkan Kode Pembayaran di atas ke kasir dan sebutkan pembayaran belanja online Midtrans / Valerie & CO.",
                "Present the Payment Code above to the cashier for Midtrans / Valerie & CO payment.",
              ),
              t(
                "Lakukan pembayaran sesuai total tagihan dan simpan struk fisik dari kasir.",
                "Complete payment for the exact amount and keep your store receipt.",
              ),
            ]
          : [
              t(
                "Ikuti instruksi keamanan langsung pada jendela pembayaran resmi di atas.",
                "Follow the secure authentication steps inside the payment window above.",
              ),
              t(
                "Selesaikan verifikasi OTP / 3DS atau persetujuan akun hingga muncul konfirmasi berhasil.",
                "Complete OTP / 3DS verification until payment confirmation appears.",
              ),
              t(
                "Jangan tutup jendela sebelum status berubah otomatis menjadi Lunas.",
                "Keep this window open while your confirmation syncs automatically.",
              ),
            ];

  const CANCEL_REASONS = [
    t("Ingin mengubah metode pembayaran", "Want to change payment method"),
    t("Ingin mengubah produk, ukuran, atau alamat", "Want to change items, size, or address"),
    t("Menemukan kendala saat membayar", "Encountered a payment issue"),
    t("Tidak jadi membeli saat ini", "Changed mind for now"),
  ];

  // Outcome Views: Expired / Failed / Cancelled / Refunded
  if (outcome === "expired") {
    return (
      <div className="vco-lifecycle-popup is-expired">
        <div className="vco-lifecycle-banner is-expired">
          <div className="vco-lifecycle-emblem is-expired" aria-hidden="true">
            <Clock size={26} />
          </div>
          <div className="vco-lifecycle-copy">
            <span className="vco-lifecycle-kicker">
              {t("BATAS WAKTU BERAKHIR · OTOMATIS DIBATALKAN", "PAYMENT WINDOW ENDED · AUTO-RELEASED")}
            </span>
            <h3>{t("Waktu Pembayaran Habis", "Payment Window Expired")}</h3>
            <p>
              {t(
                `Batas waktu pembayaran 24 jam untuk pesanan ${receiptNo} telah berakhir. Stok produk dikembalikan otomatis ke katalog.`,
                `The 24-hour payment window for order ${receiptNo} has ended. Reserved items have been returned to stock.`,
              )}
            </p>
          </div>
          <div className="vco-lifecycle-amount">
            <small>{t("Total Tagihan", "Order Total")}</small>
            <strong>{money(liveOrder.total, cur)}</strong>
          </div>
        </div>

        <LifecycleStepper
          steps={[
            { label: t("Pesanan Dibuat", "Order Created"), state: "done" },
            { label: t("Batas Waktu 24 Jam", "24h Payment Window"), state: "done" },
            { label: t("Kedaluwarsa", "Expired"), state: "warn" },
          ]}
        />

        {showOutcomeInvoice ? (
          <OfficialAtelierInvoice order={liveOrder} showActions={false} />
        ) : (
          <>
            <OrderedItemsPreview order={liveOrder} money={money} t={t} />
            <div className="shopee-outcome-meta">
              <div>
                <span>{t("No. Pesanan", "Order No.")}</span>
                <b>{receiptNo}</b>
              </div>
              <div>
                <span>{t("Total Tagihan", "Order Total")}</span>
                <b>{money(liveOrder.total, cur)}</b>
              </div>
              <div>
                <span>{t("Metode Pembayaran", "Payment Method")}</span>
                <div className="vco-meta-brand-line">
                  <PaymentBrandLogo channelId={activeChannel.id} size="sm" />
                  <b>{activeChannel.label}</b>
                </div>
              </div>
              <div>
                <span>{t("Status Transaksi", "Transaction Status")}</span>
                <b className="status-tag-expired">{t("KEDALUWARSA", "EXPIRED")}</b>
              </div>
            </div>
          </>
        )}

        <div className="shopee-outcome-actions">
          <button
            type="button"
            className="button dark"
            onClick={handleReorder}
          >
            <RefreshCw size={15} aria-hidden="true" />
            {t("Pesan Ulang Sekarang", "Order Again Now")}
          </button>
          <button
            type="button"
            className="button ghost"
            onClick={() => setShowOutcomeInvoice((v) => !v)}
          >
            <FileText size={15} aria-hidden="true" />
            {showOutcomeInvoice
              ? t("Tutup Invoice", "Hide Invoice")
              : t("Lihat Rincian Invoice", "View Invoice")}
          </button>
          <button type="button" className="button ghost" onClick={onDone}>
            {t("Lihat Pesanan Saya", "My Orders")}
          </button>
        </div>
      </div>
    );
  }

  if (outcome === "failed") {
    return (
      <div className="vco-lifecycle-popup is-failed">
        <div className="vco-lifecycle-banner is-failed">
          <div className="vco-lifecycle-emblem is-failed" aria-hidden="true">
            <AlertCircle size={26} />
          </div>
          <div className="vco-lifecycle-copy">
            <span className="vco-lifecycle-kicker">
              {t("OTORISASI DITOLAK · DANA AMAN", "AUTHORIZATION DECLINED · NO CHARGE")}
            </span>
            <h3>{t("Pembayaran Tidak Berhasil", "Payment Declined")}</h3>
            <p>
              {t(
                "Transaksi belum dapat diselesaikan oleh penyedia pembayaran. Tidak ada saldo atau limit yang terpotong dari akun Anda.",
                "The payment could not be authorized by your issuer or gateway. No funds were captured from your account.",
              )}
            </p>
          </div>
          <div className="vco-lifecycle-amount">
            <small>{t("Nominal Gagal", "Declined Amount")}</small>
            <strong>{money(liveOrder.total, cur)}</strong>
          </div>
        </div>

        <LifecycleStepper
          steps={[
            { label: t("Pesanan Dibuat", "Order Created"), state: "done" },
            { label: t("Otorisasi Gateway", "Gateway Check"), state: "done" },
            { label: t("Pembayaran Gagal", "Payment Failed"), state: "danger" },
          ]}
        />

        <div className="vco-diagnostic-box">
          <AlertCircle size={16} aria-hidden="true" />
          <div>
            <b>{t("Keterangan Penolakan Sistem", "Gateway Diagnostic Note")}</b>
            <p>
              {liveOrder.payment?.statusReason ||
                t(
                  "Pembayaran ditolak oleh penerbit kartu, saldo tidak mencukupi, atau sesi 3D Secure dibatalkan.",
                  "Declined by card issuer, insufficient funds, or 3D Secure authentication was not completed.",
                )}
            </p>
          </div>
        </div>

        {showOutcomeInvoice ? (
          <OfficialAtelierInvoice order={liveOrder} showActions={false} />
        ) : (
          <>
            <OrderedItemsPreview order={liveOrder} money={money} t={t} />
            <div className="shopee-outcome-meta">
              <div>
                <span>{t("No. Pesanan", "Order No.")}</span>
                <b>{receiptNo}</b>
              </div>
              <div>
                <span>{t("Ref Transaksi", "Transaction Ref")}</span>
                <b>{txId}</b>
              </div>
              <div>
                <span>{t("Metode Pembayaran", "Payment Method")}</span>
                <div className="vco-meta-brand-line">
                  <PaymentBrandLogo channelId={activeChannel.id} size="sm" />
                  <b>{liveOrder.payment?.method || activeChannel.label}</b>
                </div>
              </div>
              <div>
                <span>{t("Status Transaksi", "Status")}</span>
                <b className="status-tag-failed">{t("GAGAL", "FAILED")}</b>
              </div>
            </div>
          </>
        )}

        <div className="shopee-outcome-actions">
          <button
            type="button"
            className="button dark"
            onClick={handleReorder}
          >
            <RefreshCw size={15} aria-hidden="true" />
            {t("Ganti Metode / Bayar Ulang", "Try Another Method")}
          </button>
          <button
            type="button"
            className="button ghost"
            onClick={() => setShowOutcomeInvoice((v) => !v)}
          >
            <FileText size={15} aria-hidden="true" />
            {showOutcomeInvoice
              ? t("Tutup Invoice", "Hide Invoice")
              : t("Lihat Rincian Invoice", "View Invoice")}
          </button>
          <button type="button" className="button ghost" onClick={onDone}>
            {t("Tutup", "Close")}
          </button>
        </div>
      </div>
    );
  }

  if (outcome === "cancelled") {
    const actorLabel =
      liveOrder.payment?.cancelledBy === "admin"
        ? "Valerie & CO Studio"
        : liveOrder.payment?.cancelledBy === "gateway"
          ? t("Sistem Pembayaran", "Payment Gateway")
          : t("Pembeli", "Buyer");
    return (
      <div className="vco-lifecycle-popup is-cancelled">
        <div className="vco-lifecycle-banner is-cancelled">
          <div className="vco-lifecycle-emblem is-cancelled" aria-hidden="true">
            <Ban size={26} />
          </div>
          <div className="vco-lifecycle-copy">
            <span className="vco-lifecycle-kicker">
              {t("PESANAN DIBATALKAN · STOK DIKEMBALIKAN", "ORDER CANCELLED · STOCK RESTORED")}
            </span>
            <h3>{t("Pesanan Telah Dibatalkan", "Order Cancelled")}</h3>
            <p>
              {t(
                "Pesanan ini telah dibatalkan secara resmi. Tidak ada dana yang ditagihkan dan seluruh stok sepatu telah dikembalikan.",
                "This order has been officially cancelled. No funds were charged and reserved inventory has been restored.",
              )}
            </p>
          </div>
          <div className="vco-lifecycle-amount">
            <small>{t("Nilai Pesanan", "Order Value")}</small>
            <strong>{money(liveOrder.total, cur)}</strong>
          </div>
        </div>

        <LifecycleStepper
          steps={[
            { label: t("Pesanan Dibuat", "Order Created"), state: "done" },
            { label: t("Menunggu Pembayaran", "Awaiting Payment"), state: "done" },
            { label: t("Pesanan Dibatalkan", "Order Cancelled"), state: "muted" },
          ]}
        />

        {showOutcomeInvoice ? (
          <OfficialAtelierInvoice order={liveOrder} showActions={false} />
        ) : (
          <>
            <OrderedItemsPreview order={liveOrder} money={money} t={t} />
            <div className="shopee-outcome-meta">
              <div>
                <span>{t("No. Pesanan", "Order No.")}</span>
                <b>{receiptNo}</b>
              </div>
              <div>
                <span>{t("Metode Pembayaran", "Payment Method")}</span>
                <div className="vco-meta-brand-line">
                  <PaymentBrandLogo channelId={activeChannel.id} size="sm" />
                  <b>{liveOrder.payment?.method || activeChannel.label}</b>
                </div>
              </div>
              <div>
                <span>{t("Dibatalkan Oleh", "Cancelled By")}</span>
                <b>{actorLabel}</b>
              </div>
              <div>
                <span>{t("Alasan Pembatalan", "Cancellation Reason")}</span>
                <b>
                  {liveOrder.payment?.cancelReason ||
                    liveOrder.payment?.statusReason ||
                    t("Dibatalkan oleh pembeli", "Cancelled by buyer")}
                </b>
              </div>
              <div>
                <span>{t("Waktu Pembatalan", "Cancelled At")}</span>
                <b>
                  {formatReceiptDateTime(
                    liveOrder.payment?.cancelledAt ||
                      liveOrder.payment?.updatedAt ||
                      liveOrder.date,
                    lang,
                  )}
                </b>
              </div>
              <div>
                <span>{t("Status Akhir", "Final Status")}</span>
                <b>{t("DIBATALKAN · STOK PULIH", "CANCELLED · STOCK RESTORED")}</b>
              </div>
            </div>
          </>
        )}

        <div className="shopee-outcome-actions">
          <button
            type="button"
            className="button dark"
            onClick={handleReorder}
          >
            <RefreshCw size={15} aria-hidden="true" />
            {t("Beli Lagi / Checkout Ulang", "Reorder Items")}
          </button>
          <button
            type="button"
            className="button ghost"
            onClick={() => setShowOutcomeInvoice((v) => !v)}
          >
            <FileText size={15} aria-hidden="true" />
            {showOutcomeInvoice
              ? t("Tutup Invoice Batal", "Hide Invoice")
              : t("Lihat Invoice Batal", "View Cancelled Invoice")}
          </button>
          <button type="button" className="button ghost" onClick={onDone}>
            {t("Tutup / Pesanan Saya", "My Orders")}
          </button>
        </div>
      </div>
    );
  }

  if (outcome === "refunded") {
    return (
      <div className="vco-lifecycle-popup is-refunded">
        <div className="vco-lifecycle-banner is-refunded">
          <div className="vco-lifecycle-emblem is-refunded" aria-hidden="true">
            <RotateCcw size={26} />
          </div>
          <div className="vco-lifecycle-copy">
            <span className="vco-lifecycle-kicker">
              {t("REFUND SELESAI · DANA DIKEMBALIKAN", "REFUND COMPLETED · FUNDS RETURNED")}
            </span>
            <h3>{t("Pengembalian Dana Berhasil", "Payment Refunded")}</h3>
            <p>
              {t(
                "Pengembalian dana untuk pesanan ini telah diproses ke rekening / metode pembayaran asal Anda.",
                "A refund for this order has been issued to your original payment method.",
              )}
            </p>
          </div>
          <div className="vco-lifecycle-amount">
            <small>{t("Nominal Refund", "Refunded Amount")}</small>
            <strong>{money(liveOrder.refund?.amount || liveOrder.total, cur)}</strong>
          </div>
        </div>

        {showOutcomeInvoice ? (
          <OfficialAtelierInvoice order={liveOrder} showActions={false} />
        ) : (
          <>
            <OrderedItemsPreview order={liveOrder} money={money} t={t} />
            <div className="shopee-outcome-meta">
              <div>
                <span>{t("No. Pesanan", "Order No.")}</span>
                <b>{receiptNo}</b>
              </div>
              <div>
                <span>{t("Nominal Refund", "Refund Amount")}</span>
                <b>{money(liveOrder.refund?.amount || liveOrder.total, cur)}</b>
              </div>
              <div>
                <span>{t("Referensi Refund", "Reference")}</span>
                <b>{liveOrder.refund?.reference || txId}</b>
              </div>
              <div>
                <span>{t("Alasan", "Reason")}</span>
                <b>
                  {liveOrder.refund?.reason ||
                    liveOrder.payment?.statusReason ||
                    t("Pengembalian dana diproses", "Refund processed")}
                </b>
              </div>
            </div>
          </>
        )}

        <div className="shopee-outcome-actions">
          <button
            type="button"
            className="button ghost"
            onClick={() => downloadOfficialReceiptHtml(liveOrder, money, lang)}
          >
            <Download size={15} aria-hidden="true" />
            {t("Unduh Bukti Refund / Invoice", "Download Refund Invoice")}
          </button>
          <button
            type="button"
            className="button ghost"
            onClick={() => setShowOutcomeInvoice((v) => !v)}
          >
            <Receipt size={15} aria-hidden="true" />
            {showOutcomeInvoice
              ? t("Tutup Invoice", "Hide Invoice")
              : t("Lihat Invoice Resmi", "View Official Invoice")}
          </button>
          <button type="button" className="button dark" onClick={onDone}>
            {t("Lihat Pesanan Saya", "My Orders")}
          </button>
        </div>
      </div>
    );
  }

  // Pending View (Shopee-style focused payment sheet)
  if (outcome === "pending" && (startInPaymentStage || liveOrder.payment?.status === "pending")) {
    return (
      <div className="shopee-pay-sheet">
        <div className="shopee-pay-topbar">
          <div className="shopee-pay-status-badge">
            <span className="shopee-live-dot" aria-hidden="true" />
            <span>{t("Menunggu Pembayaran", "Awaiting Payment")}</span>
          </div>
          <div className="shopee-pay-topbar-right">
            <span className="shopee-order-ref">{receiptNo}</span>
            <MidtransGatewayBadge compact />
          </div>
        </div>

        <div className="shopee-pay-hero">
          <div className="shopee-pay-hero-amount">
            <small>{t("Total Pembayaran", "Total Payment")}</small>
            <div className="shopee-pay-amount-line">
              <strong>{money(liveOrder.total, cur)}</strong>
              <button
                type="button"
                className="shopee-copy-pill"
                onClick={() =>
                  copyText(
                    "amount",
                    String(Math.round(liveOrder.total)),
                    "Nominal tagihan disalin",
                    "Amount copied",
                  )
                }
              >
                {copiedKey === "amount" ? <Check size={12} /> : <Copy size={12} />}
                {copiedKey === "amount" ? t("Disalin", "Copied") : t("Salin", "Copy")}
              </button>
            </div>
          </div>
          <div className="shopee-pay-hero-timer">
            <small>{t("Bayar Dalam", "Pay Within")}</small>
            <div className="shopee-timer-digits" aria-live="polite">
              <span>{hh}</span>
              <i>:</i>
              <span>{mm}</span>
              <i>:</i>
              <span>{ss}</span>
            </div>
            <span className="shopee-deadline-label">
              {t("Batas", "Due")}: {formatDeadlineLabel(deadlineMs, lang)}
            </span>
          </div>
        </div>

        <div className="shopee-bill-card">
          <div className="shopee-bill-header">
            <span className="inline-va-brand-title" translate="no">
              <PaymentBrandLogo channelId={activeChannel.id} size="md" />
              <b>{activeChannel.label}</b>
            </span>
            <div className="shopee-bill-header-right">
              <span className="shopee-autosync-label">
                {charging
                  ? t("Memuat metode…", "Switching…")
                  : t("Verifikasi otomatis", "Auto-verification active")}
              </span>
              {liveOrder.payment?.status === "pending" && (
                <button
                  type="button"
                  className="shopee-change-method-btn"
                  disabled={charging}
                  onClick={() => setShowMethodSwitcher((v) => !v)}
                >
                  {showMethodSwitcher
                    ? t("Tutup", "Close")
                    : t("Ubah Metode", "Change Method")}
                  <ChevronDown
                    size={13}
                    className={showMethodSwitcher ? "shopee-pay-chevron is-open" : "shopee-pay-chevron"}
                    aria-hidden="true"
                  />
                </button>
              )}
            </div>
          </div>

          {showMethodSwitcher && liveOrder.payment?.status === "pending" && (
            <div className="shopee-inline-method-switcher">
              <PaymentChannelOptions
                selectedChannel={activeChannel.id}
                onSelect={(ch) => void handleSwitchChannel(ch)}
              />
            </div>
          )}

          {/* 1. QRIS & E-Wallets */}
          {activeChannel.category === "qris_ewallet" && (() => {
            const qrCopyValue = liveQrImageUrl || liveDeeplinkUrl || activeQrString || "";
            const qrTargetUrl =
              liveDeeplinkUrl ||
              (liveOrder.payment?.channel === activeChannel.id
                ? liveOrder.payment?.url || ""
                : "");
            return (
              <div className="shopee-qr-stage">
                <div className="shopee-qr-frame" aria-label={`QRIS ${activeChannel.label}`}>
                  {liveQrImageUrl && !qrImgError ? (
                    <img
                      src={liveQrImageUrl}
                      alt={`QRIS ${activeChannel.label}`}
                      className="inline-qris-live-img"
                      onError={() => setQrImgError(true)}
                    />
                  ) : (
                    renderFallbackQrSvg(
                      activeQrString || liveDeeplinkUrl || `${liveOrder.id}-${activeChannel.id}`,
                    )
                  )}
                </div>
                <div className="shopee-qr-caption">
                  <strong>VALERIE &amp; CO ATELIER</strong>
                  <span>{money(liveOrder.total, cur)}</span>
                </div>
                <div className="shopee-qr-actions">
                  {liveQrImageUrl && !qrImgError && (
                    <button
                      type="button"
                      className="button ghost small"
                      onClick={() => void downloadQrisImage()}
                    >
                      <Download size={14} />
                      {t("Unduh QRIS", "Download QRIS")}
                    </button>
                  )}
                  <button
                    type="button"
                    className="button ghost small"
                    onClick={() =>
                      copyText(
                        "qrurl",
                        qrCopyValue,
                        "Kode QR disalin",
                        "QR code copied",
                      )
                    }
                  >
                    {copiedKey === "qrurl" ? <Check size={14} /> : <Copy size={14} />}
                    {copiedKey === "qrurl"
                      ? t("Tersalin", "Copied")
                      : liveQrImageUrl
                    ? t("Salin Link QR", "Copy QR Image URL")
                    : liveDeeplinkUrl
                      ? t("Salin Link Redirect", "Copy Redirect URL")
                      : t("Salin Kode QR", "Copy QR Code")}
                  </button>
                  {activeQrString && (
                    <button
                      type="button"
                      className="button ghost small"
                      onClick={() =>
                        copyText(
                          "qremv",
                          activeQrString,
                          "String EMV QRIS disalin",
                          "EMV QRIS string copied",
                        )
                      }
                    >
                      {copiedKey === "qremv" ? <Check size={14} /> : <Copy size={14} />}
                      {copiedKey === "qremv"
                        ? t("Tersalin", "Copied")
                        : t("Salin String QRIS", "Copy EMV String")}
                    </button>
                  )}
                </div>
                {qrTargetUrl && (
                  <a
                    href={qrTargetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="button dark full"
                  >
                    <ExternalLink size={15} />
                    {t(
                      `Buka & Bayar di ${activeChannel.badge}`,
                      `Open & Pay in ${activeChannel.badge}`,
                    )}
                  </a>
                )}
              </div>
            );
          })()}

          {/* 2. Virtual Account */}
          {activeChannel.category === "va" && (() => {
            const displayVaNumber =
              virtualAccountNumber ||
              t("Menunggu VA resmi Midtrans...", "Waiting for Midtrans VA...");
            return (
              <div className="shopee-va-stage">
                {effectiveBillerCode && (
                  <div className="shopee-bill-row">
                    <div>
                      <small>{t("Kode Perusahaan / Biller", "Company / Biller Code")}</small>
                      <code>{effectiveBillerCode}</code>
                    </div>
                    <button
                      type="button"
                      className="button ghost small"
                      onClick={() =>
                        copyText(
                          "biller",
                          effectiveBillerCode,
                          "Kode Biller disalin",
                          "Biller code copied",
                        )
                      }
                    >
                      {copiedKey === "biller" ? <Check size={14} /> : <Copy size={14} />}
                      {copiedKey === "biller" ? t("Tersalin", "Copied") : t("Salin", "Copy")}
                    </button>
                  </div>
                )}
                <div className="shopee-bill-row is-primary">
                  <div>
                    <small>{t("Nomor Virtual Account", "Virtual Account Number")}</small>
                    <code>{displayVaNumber}</code>
                  </div>
                  <button
                    type="button"
                    className="button dark small"
                    onClick={() =>
                      copyText(
                        "va",
                        displayVaNumber,
                        "Nomor Virtual Account disalin",
                        "Virtual Account copied",
                      )
                    }
                  >
                    {copiedKey === "va" ? <Check size={14} /> : <Copy size={14} />}
                    {copiedKey === "va" ? t("Tersalin", "Copied") : t("Salin No. VA", "Copy VA")}
                  </button>
                </div>
                {!virtualAccountNumber &&
                  liveOrder.payment?.url &&
                  liveOrder.payment?.channel === activeChannel.id && (
                  <a
                    href={liveOrder.payment.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="button ghost small full"
                  >
                    <ExternalLink size={14} />
                    {t(
                      `Buka Halaman Pembayaran ${activeChannel.badge}`,
                      `Open ${activeChannel.badge} Payment Page`,
                    )}
                  </a>
                )}
                <p className="shopee-va-note">
                  {t(
                    "Transfer sesuai total tagihan hingga digit terakhir agar pembayaran terverifikasi otomatis.",
                    "Transfer the exact amount shown above so our gateway verifies your payment automatically.",
                  )}
                </p>
              </div>
            );
          })()}

          {/* 3. Retail Store Barcode & Code */}
          {activeChannel.category === "retail" && (() => {
            const displayRetailCode =
              retailPaymentCode ||
              t("Menunggu kode pembayaran Midtrans...", "Waiting for Midtrans code...");
            const retailBars = buildBarcodeBars(displayRetailCode);
            return (
              <div className="shopee-va-stage">
                <div className="shopee-retail-barcode" aria-hidden="true">
                  <svg viewBox="0 0 180 42">
                    {retailBars.map((bar, idx) => (
                      <rect
                        key={idx}
                        x={bar.x}
                        y="2"
                        width={bar.w}
                        height="34"
                        fill="#171412"
                      />
                    ))}
                  </svg>
                  <small>{displayRetailCode}</small>
                </div>
                <div className="shopee-bill-row is-primary">
                  <div>
                    <small>{t(`Kode Pembayaran ${activeChannel.badge}`, `${activeChannel.badge} Payment Code`)}</small>
                    <code>{displayRetailCode}</code>
                  </div>
                  <button
                    type="button"
                    className="button dark small"
                    onClick={() =>
                      copyText(
                        "retail",
                        displayRetailCode,
                        "Kode pembayaran disalin",
                        "Payment code copied",
                      )
                    }
                  >
                    {copiedKey === "retail" ? <Check size={14} /> : <Copy size={14} />}
                    {copiedKey === "retail" ? t("Tersalin", "Copied") : t("Salin Kode", "Copy Code")}
                  </button>
                </div>
                <p className="shopee-va-note">
                  {t(
                    `Tunjukkan barcode / kode di atas kepada kasir ${activeChannel.badge} terdekat sebelum batas waktu berakhir.`,
                    `Show the barcode or code above to any ${activeChannel.badge} cashier before the expiry time.`,
                  )}
                </p>
              </div>
            );
          })()}

          {/* 4. Credit / Debit Card 3DS & PayLater Installment Stage */}
          {(activeChannel.category === "card" || activeChannel.category === "paylater") && (() => {
            const authCode =
              retailPaymentCode ||
              `${activeChannel.id === "card" ? "3DS" : activeChannel.id.slice(0, 3).toUpperCase()}-${orderDigits.slice(0, 8)}`;
            const authTargetUrl =
              liveDeeplinkUrl ||
              (liveOrder.payment?.channel === activeChannel.id
                ? liveOrder.payment?.url || ""
                : "");
            return (
              <div className="shopee-va-stage shopee-card-paylater-stage">
                <div className="shopee-card-auth-banner">
                  {activeChannel.category === "card" ? (
                    <CreditCard size={16} aria-hidden="true" />
                  ) : (
                    <ShieldCheck size={16} aria-hidden="true" />
                  )}
                  <span>
                    {activeChannel.category === "card"
                      ? t(
                          "Otorisasi Kartu 3D Secure 2.0 · Visa / Mastercard / JCB / Amex",
                          "3D Secure 2.0 Card Authorization · Visa / Mastercard / JCB / Amex",
                        )
                      : t(
                          `Cicilan Instan ${activeChannel.badge} · Terdaftar & Diawasi OJK`,
                          `${activeChannel.badge} Instant Installment · OJK Licensed`,
                        )}
                  </span>
                </div>
                <div className="shopee-tenor-grid" role="group" aria-label={t("Pilih tenor cicilan", "Choose installment plan")}>
                  {[1, 3, 6, 12].map((months) => {
                    const active = selectedTenor === months;
                    const monthly = Math.ceil(liveOrder.total / months);
                    return (
                      <button
                        key={months}
                        type="button"
                        className={`shopee-tenor-pill ${active ? "is-selected" : ""}`}
                        onClick={() => setSelectedTenor(months)}
                      >
                        <b>
                          {months === 1
                            ? activeChannel.category === "card"
                              ? t("Bayar Penuh 0%", "Full Payment 0%")
                              : t("30 Hari Bunga 0%", "30 Days 0%")
                            : t(`Cicilan ${months}x`, `${months} Months`)}
                        </b>
                        <small>
                          {months === 1
                            ? money(liveOrder.total, cur)
                            : `${money(monthly, cur)}/${t("bln", "mo")}`}
                        </small>
                      </button>
                    );
                  })}
                </div>
                <div className="shopee-bill-row is-primary">
                  <div>
                    <small>
                      {activeChannel.category === "card"
                        ? t("Kode Referensi Otorisasi 3DS", "3DS Authorization Reference")
                        : t(`Referensi Tagihan ${activeChannel.badge}`, `${activeChannel.badge} Billing Reference`)}
                    </small>
                    <code>{authCode}</code>
                  </div>
                  <button
                    type="button"
                    className="button ghost small"
                    onClick={() =>
                      copyText(
                        "authcode",
                        authCode,
                        "Kode referensi disalin",
                        "Reference code copied",
                      )
                    }
                  >
                    {copiedKey === "authcode" ? <Check size={14} /> : <Copy size={14} />}
                    {copiedKey === "authcode" ? t("Tersalin", "Copied") : t("Salin Kode", "Copy Code")}
                  </button>
                </div>
                {authTargetUrl ? (
                  <a
                    href={authTargetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="button dark full"
                  >
                    <ExternalLink size={15} />
                    {t(
                      `Lanjutkan Otorisasi ${activeChannel.badge}`,
                      `Continue to ${activeChannel.badge} Authorization`,
                    )}
                  </a>
                ) : (
                  <button
                    type="button"
                    className="button dark full"
                    disabled={isBusyChecking}
                    onClick={() => void handleSyncStatus()}
                  >
                    <ShieldCheck size={15} />
                    {t(
                      `Verifikasi Otorisasi ${activeChannel.badge}`,
                      `Verify ${activeChannel.badge} Authorization`,
                    )}
                  </button>
                )}
              </div>
            );
          })()}

          <details className="shopee-howto-details">
            <summary>{t("Petunjuk Pembayaran", "Payment Instructions")}</summary>
            <ol>
              {liveMerchantId && activeChannel.id === "indomaret" && (
                <li>
                  {t("Masukkan Merchant ID Midtrans:", "Enter Midtrans Merchant ID:")}{" "}
                  <code>{liveMerchantId}</code>
                </li>
              )}
              {isFallbackCharge && liveDeeplinkUrl && (
                <li>
                  {t(
                    "Metode ini memakai halaman resmi Midtrans:",
                    "This method uses the official Midtrans page:",
                  )}{" "}
                  <a href={liveDeeplinkUrl} target="_blank" rel="noopener noreferrer">
                    {t("Buka Pembayaran Midtrans", "Open Midtrans Payment")}
                  </a>
                </li>
              )}
              {hasRealChannelCharge &&
                activeChannel.id === "danamon_va" &&
                directCharge?.bank === "permata" && (
                  <li>
                    {t(
                      "Jika menguji di Midtrans Sandbox Simulator, pilih tab Permata VA (routing VA bersama Midtrans).",
                      "When testing in Midtrans Sandbox Simulator, use the Permata VA simulator tab.",
                    )}
                  </li>
                )}
              {howToSteps.map((stepText, idx) => (
                <li key={idx}>{stepText}</li>
              ))}
            </ol>
          </details>
        </div>

        {/* Cancel confirmation drawer */}
        {cancelPanelOpen ? (
          <div className="shopee-cancel-drawer">
            <div className="shopee-cancel-drawer-top">
              <span className="shopee-cancel-badge" aria-hidden="true">
                <Ban size={18} />
              </span>
              <div className="shopee-cancel-drawer-head">
                <div className="shopee-cancel-head-row">
                  <b>{t("Konfirmasi Pembatalan Pesanan", "Confirm Order Cancellation")}</b>
                  <span className="shopee-cancel-ref-pill">{receiptNo}</span>
                </div>
                <small>
                  {t(
                    "Stok sepatu pada pesanan ini akan langsung dikembalikan ke katalog secara otomatis.",
                    "Reserved footwear items for this order will be automatically returned to stock.",
                  )}
                </small>
              </div>
            </div>
            <div className="shopee-cancel-reasons" role="radiogroup" aria-label={t("Alasan pembatalan", "Cancellation reason")}>
              {CANCEL_REASONS.map((r) => {
                const selected = cancelReason === r;
                return (
                  <label
                    key={r}
                    className={`shopee-cancel-reason ${selected ? "is-selected" : ""}`}
                  >
                    <input
                      type="radio"
                      name="cancelReason"
                      className="sr-only"
                      checked={selected}
                      onChange={() => setCancelReason(r)}
                    />
                    <span
                      className={`shopee-radio-dot ${selected ? "checked" : ""}`}
                      aria-hidden="true"
                    />
                    <span>{r}</span>
                  </label>
                );
              })}
            </div>
            <div className="shopee-cancel-actions">
              <button
                type="button"
                className="button ghost small"
                disabled={cancelling}
                onClick={() => setCancelPanelOpen(false)}
              >
                {t("Kembali ke Pembayaran", "Back to Payment")}
              </button>
              <button
                type="button"
                className="button danger small"
                disabled={cancelling}
                onClick={() => void handleConfirmCancel()}
              >
                {cancelling && <RefreshCw size={14} className="spin" aria-hidden="true" />}
                {cancelling
                  ? t("Membatalkan…", "Cancelling…")
                  : t("Ya, Batalkan Pesanan Sekarang", "Confirm Cancellation Now")}
              </button>
            </div>
          </div>
        ) : (
          <div className="shopee-pay-actions">
            <button
              type="button"
              className="button dark"
              disabled={isBusyChecking}
              onClick={() => void handleSyncStatus()}
            >
              <RefreshCw
                size={15}
                className={isBusyChecking ? "spin" : ""}
                aria-hidden="true"
              />
              {isBusyChecking
                ? t("Mengecek Pembayaran…", "Checking Payment…")
                : t("Cek Status Pembayaran", "Check Payment Status")}
            </button>
            {liveOrder.status === "processing" && (
              <button
                type="button"
                className="button ghost"
                onClick={() => setCancelPanelOpen(true)}
              >
                <Ban size={15} aria-hidden="true" />
                {t("Batalkan Pesanan", "Cancel Order")}
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  // Paid / Completed Popup ("Pop-up Selesai") with Summary + Official Invoice switcher
  const delivered = liveOrder.status === "delivered";
  return (
    <div className="vco-lifecycle-popup is-paid">
      <div className="vco-lifecycle-banner is-paid">
        <div className="vco-lifecycle-emblem is-paid" aria-hidden="true">
          <CheckCircle2 size={28} />
        </div>
        <div className="vco-lifecycle-copy">
          <span className="vco-lifecycle-kicker">
            {delivered
              ? t("PESANAN SELESAI · DITERIMA PELANGGAN", "ORDER DELIVERED · COMPLETED")
              : t("TRANSAKSI SELESAI · TERVERIFIKASI OTOMATIS", "PAYMENT COMPLETED · VERIFIED")}
          </span>
          <h3>
            {delivered
              ? t("Pesanan Telah Selesai & Diterima", "Order Delivered & Completed")
              : t("Pembayaran Berhasil Diterima", "Payment Confirmed")}
          </h3>
          <p>
            {delivered
              ? t(
                  "Terima kasih telah berbelanja di Valerie & CO Atelier. Faktur resmi tetap tersimpan untuk arsip & garansi.",
                  "Thank you for shopping at Valerie & CO Atelier. Your official invoice remains saved for warranty & archive.",
                )
              : t(
                  "Pembayaran Anda telah lunas dan diverifikasi secara otomatis. Sepatu pesanan sedang disiapkan oleh tim atelier.",
                  "Your payment is confirmed and verified automatically. Your footwear order is now being prepared by our atelier team.",
                )}
          </p>
        </div>
        <div className="vco-lifecycle-amount is-paid">
          <small>{t("Total Lunas", "Total Paid")}</small>
          <strong>{money(liveOrder.total, cur)}</strong>
        </div>
      </div>

      <LifecycleStepper
        steps={[
          { label: t("Pesanan Dibuat", "Order Placed"), state: "done" },
          { label: t("Pembayaran Lunas", "Paid"), state: "done" },
          {
            label: t("Dikemas Atelier", "Atelier Prep"),
            state:
              liveOrder.status === "shipped" || liveOrder.status === "delivered"
                ? "done"
                : "active",
          },
          {
            label: t("Dikirim ke Tujuan", "Delivered"),
            state:
              liveOrder.status === "delivered"
                ? "done"
                : liveOrder.status === "shipped"
                  ? "active"
                  : "upcoming",
          },
        ]}
      />

      <div className="vco-lifecycle-switch no-print" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={paidTab === "summary"}
          className={paidTab === "summary" ? "active" : ""}
          onClick={() => setPaidTab("summary")}
        >
          <Package size={15} aria-hidden="true" />
          <span>{t("Ringkasan Transaksi", "Transaction Summary")}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={paidTab === "invoice"}
          className={paidTab === "invoice" ? "active" : ""}
          onClick={() => setPaidTab("invoice")}
        >
          <Receipt size={15} aria-hidden="true" />
          <span>{t("Faktur / Invoice Resmi", "Official Invoice")}</span>
        </button>
      </div>

      {paidTab === "invoice" ? (
        <OfficialAtelierInvoice order={liveOrder} showActions={false} />
      ) : (
        <div className="vco-paid-summary-body">
          <OrderedItemsPreview order={liveOrder} money={money} t={t} />
          <div className="vco-paid-info-grid">
            <div className="vco-paid-info-card">
              <small>{t("Metode & Referensi Pembayaran", "Payment Method & Ref")}</small>
              <div className="vco-meta-brand-line">
                <PaymentBrandLogo channelId={activeChannel.id} size="sm" />
                <b>
                  {liveOrder.payment?.method ||
                    liveOrder.paymentMethod ||
                    activeChannel.label}
                </b>
              </div>
              <span>
                {receiptNo} · {txId}
              </span>
              <small>
                {formatReceiptDateTime(
                  liveOrder.payment?.paidAt || liveOrder.date,
                  lang,
                )}
              </small>
            </div>
            <div className="vco-paid-info-card">
              <small>{t("Penerima & Alamat Pengiriman", "Recipient & Delivery Address")}</small>
              <b>
                {liveOrder.address.name} · {liveOrder.address.phone}
              </b>
              <span>
                {liveOrder.address.street}, {liveOrder.address.city}
                {liveOrder.address.province ? `, ${liveOrder.address.province}` : ""}{" "}
                {liveOrder.address.postal}
              </span>
              {liveOrder.shippingMeta && (
                <span
                  className="vco-invoice-courier-chip"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    fontSize: "12px",
                    color: "#6b4423",
                    fontWeight: 600,
                    marginTop: "4px",
                  }}
                >
                  <Truck size={12} aria-hidden="true" />
                  <span>
                    {liveOrder.shippingMeta.courierName} · {liveOrder.shippingMeta.serviceName}
                    {liveOrder.shippingMeta.duration
                      ? ` · ${liveOrder.shippingMeta.duration}`
                      : ""}
                  </span>
                </span>
              )}
              {liveOrder.tracking && (
                <span className="vco-invoice-tracking-chip">
                  <Truck size={12} aria-hidden="true" />
                  <span>{liveOrder.tracking}</span>
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="vco-invoice-actions no-print">
        <button
          type="button"
          className="button ghost small"
          onClick={() => {
            setPaidTab("invoice");
            setTimeout(() => window.print(), 120);
          }}
        >
          <Printer size={15} aria-hidden="true" />
          {t("Cetak Invoice / PDF", "Print Invoice / PDF")}
        </button>
        <button
          type="button"
          className="button ghost small"
          onClick={() => downloadOfficialReceiptHtml(liveOrder, money, lang)}
        >
          <Download size={15} aria-hidden="true" />
          {t("Unduh Invoice (.HTML)", "Download Invoice (.HTML)")}
        </button>
        <button type="button" className="button dark small" onClick={onDone}>
          {t("Selesai & Lacak Pesanan", "Track in My Orders")}
          <ArrowRight size={15} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

function SimulationCheckout({ onDone }: { onDone: () => void }) {
  const {
    db,
    t,
    currency,
    money,
    priceText,
    member,
    checkout,
    notify,
    applyCoupon,
    activePromotions,
  } = useStore();
  const rates = SHIPPING_RATES[currency];
  const [code, setCode] = useState("");
  const [applied, setApplied] = useState("");
  const [express, setExpress] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<string>("qris");
  const [finished, setFinished] = useState<Order | null>(null);
  const [addressId, setAddressId] = useState(
    () => member?.addresses[0]?.id || "new",
  );
  const busy = useRef(false);
  const checkoutKey = useRef(crypto.randomUUID());
  const coupon = (
    activePromotions.find((c) => c.code === applied && c.active) ||
    db.coupons.find((c) => c.code === applied && c.active)
  );
  const sum = totals(db.bag, db.products, coupon, express, currency);
  const savedAddress = member?.addresses.find((a) => a.id === addressId);
  const totalItems = db.bag.reduce((count, line) => count + line.quantity, 0);
  const claimedSet = new Set(member?.claimedCoupons || []);
  const claimedPromos = activePromotions.filter((c) => claimedSet.has(c.code));
  const hasUnclaimedPromos = activePromotions.some((c) => !claimedSet.has(c.code));
  if (finished)
    return (
      <InlinePaymentAndReceipt
        order={finished}
        initialChannel={selectedChannel}
        startInPaymentStage={true}
        onDone={onDone}
      />
    );
  if (!member) return <MemberEntry onDone={() => {}} />;
  const applyPromoCode = async (target?: string) => {
    const nextCode = (target ?? code).trim().toUpperCase();
    if (!nextCode) return;
    if (
      activePromotions.some((c) => c.code === nextCode) &&
      !claimedSet.has(nextCode)
    ) {
      notify(
        `Klaim voucher ${nextCode} di popup diskon member terlebih dahulu`,
        `Please claim voucher ${nextCode} in the member discount popup first`,
      );
      return;
    }
    try {
      const found = await applyCoupon(nextCode);
      setCode(found.code);
      setApplied(found.code);
      notify("Kode promo diterapkan", "Promo code applied");
    } catch (e) {
      notify((e as Error).message, (e as Error).message);
    }
  };
  return (
    <form
      className="checkout-grid"
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy.current) return;
        busy.current = true;
        try {
          const f = new FormData(e.currentTarget);
          const rawLat = f.get("lat");
          const rawLon = f.get("lon");
          const lat =
            rawLat && Number.isFinite(Number(rawLat))
              ? Number(rawLat)
              : undefined;
          const lon =
            rawLon && Number.isFinite(Number(rawLon))
              ? Number(rawLon)
              : undefined;
          const province =
            String(f.get("province") || "").trim() || undefined;
          const areaId =
            String(f.get("areaId") || "").trim() || undefined;
          const areaName =
            String(f.get("areaName") || "").trim() || undefined;
          const address: Address = savedAddress || {
            id: crypto.randomUUID(),
            label: "Shipping",
            name: String(f.get("name")),
            phone: String(f.get("phone")),
            street: String(f.get("street")),
            city: String(f.get("city")),
            postal: String(f.get("postal")),
            ...(province ? { province } : {}),
            ...(areaId ? { areaId } : {}),
            ...(areaName ? { areaName } : {}),
            ...(lat !== undefined ? { lat } : {}),
            ...(lon !== undefined ? { lon } : {}),
          };
          const order = await checkout(
            address,
            applied,
            express,
            checkoutKey.current,
            undefined,
            selectedChannel,
          );
          setFinished(order);
        } catch {
          notify(
            "Pesanan tidak dapat dibuat. Periksa stok dan tas.",
            "Unable to create order. Check your bag and stock.",
          );
        } finally {
          busy.current = false;
        }
      }}
    >
      <div className="checkout-main">
        <section className="checkout-step-card">
          <div className="checkout-step-head">
            <span className="checkout-step-num">01</span>
            <div>
              <h3>{t("Alamat pengiriman", "Delivery address")}</h3>
              <p>
                {t(
                  "Pilih alamat tersimpan atau isi tujuan pengiriman baru.",
                  "Choose a saved address or enter a new destination.",
                )}
              </p>
            </div>
          </div>
          {member.addresses.length > 0 && (
            <label className="field checkout-saved-select">
              {t("Pilih alamat", "Select address")}
              <select
                value={addressId}
                onChange={(e) => setAddressId(e.target.value)}
              >
                <option value="new">{t("Alamat baru", "New address")}</option>
                {member.addresses.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label} — {a.street}
                  </option>
                ))}
              </select>
            </label>
          )}
          {savedAddress ? (
            <div className="checkout-saved-address-preview">
              <b>
                {savedAddress.label} · {savedAddress.name}
              </b>
              <span>{savedAddress.phone}</span>
              <p>
                {savedAddress.street}, {savedAddress.city} {savedAddress.postal}
              </p>
            </div>
          ) : (
            <AddressFields name={member.name} phone={member.phone} />
          )}
        </section>

        <section className="checkout-step-card">
          <div className="checkout-step-head">
            <span className="checkout-step-num">02</span>
            <div>
              <h3>{t("Metode pengiriman", "Delivery method")}</h3>
              <p>
                {t(
                  "Setiap pasang dikemas dengan kotak atelier & dustbag beludru.",
                  "Every pair is packed with an atelier box & velvet dustbag.",
                )}
              </p>
            </div>
          </div>
          <div className="delivery-options-list">
            <label className={`delivery-option ${!express ? "selected" : ""}`}>
              <input
                type="radio"
                name="delivery"
                checked={!express}
                onChange={() => setExpress(false)}
              />
              <span>
                <b>{t("Standar", "Standard")}</b>
                <small>
                  {t(
                    "Estimasi pengiriman: 3–5 hari kerja",
                    "Estimated delivery: 3–5 business days",
                  )}
                </small>
              </span>
              <strong>
                {sum.subtotal >= rates.freeAbove
                  ? t("Gratis", "Free")
                  : money(rates.standard)}
              </strong>
            </label>
            <label className={`delivery-option ${express ? "selected" : ""}`}>
              <input
                type="radio"
                name="delivery"
                checked={express}
                onChange={() => setExpress(true)}
              />
              <span>
                <b>{t("Ekspres", "Express")}</b>
                <small>
                  {t(
                    "Estimasi pengiriman: 1–2 hari kerja",
                    "Estimated delivery: 1–2 business days",
                  )}
                </small>
              </span>
              <strong>{money(rates.express)}</strong>
            </label>
          </div>
        </section>

        <section className="checkout-step-card">
          <div className="checkout-step-head">
            <span className="checkout-step-num">03</span>
            <div className="checkout-step-head-body">
              <div className="checkout-step-title-row">
                <h3>{t("Metode Pembayaran", "Payment Method")}</h3>
                <MidtransGatewayBadge compact />
              </div>
              <p>
                {t(
                  "Pilih metode pembayaran yang paling nyaman untuk Anda.",
                  "Choose the payment method that suits you best.",
                )}
              </p>
            </div>
          </div>
          <PaymentChannelOptions
            selectedChannel={selectedChannel}
            onSelect={setSelectedChannel}
          />
        </section>
      </div>

      <aside className="checkout-summary">
        <div className="checkout-summary-head">
          <h3>{t("Ringkasan pesanan", "Your selection")}</h3>
          <span className="checkout-summary-count">
            {totalItems} {t("item", "items")}
          </span>
        </div>
        <div className="checkout-items-scroll">
          {db.bag.map((l) => {
            const p = db.products.find((p) => p.id === l.productId);
            if (!p) return null;
            return (
              <div className="checkout-item" key={lineKey(l)}>
                <img src={p.images[0]} alt={p.name} />
                <div className="checkout-item-info">
                  <b>{p.name}</b>
                  <small>
                    EU {l.size}
                    {l.color ? ` · ${l.color}` : ""} · Qty {l.quantity}
                  </small>
                </div>
                <strong className="checkout-item-price">
                  {priceText(p, l.quantity)}
                </strong>
              </div>
            );
          })}
        </div>
        <div className="coupon-input">
          <label className="sr-only" htmlFor="coupon">
            {t("Kode promo", "Promo code")}
          </label>
          <input
            id="coupon"
            name="coupon"
            placeholder={t("Kode promo", "Promo code")}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void applyPromoCode();
              }
            }}
          />
          <button
            className="button dark"
            type="button"
            onClick={() => void applyPromoCode()}
          >
            {t("Pakai", "Apply")}
          </button>
        </div>
        <CheckoutVoucherBar
          claimedPromos={claimedPromos}
          activeCode={applied}
          hasUnclaimed={hasUnclaimedPromos}
          onSelect={(c) => void applyPromoCode(c)}
        />
        <div className="order-totals">
          <div>
            <span>Subtotal</span>
            <span>{money(sum.subtotal)}</span>
          </div>
          {coupon && (
            <div>
              <span>
                {coupon.code}{" "}
                <button
                  type="button"
                  onClick={() => {
                    setApplied("");
                    setCode("");
                  }}
                >
                  ×
                </button>
              </span>
              <span>−{money(sum.discount)}</span>
            </div>
          )}
          <div>
            <span>{t("Pengiriman", "Shipping")}</span>
            <span>{sum.shipping ? money(sum.shipping) : t("Gratis", "Complimentary")}</span>
          </div>
          <div className="grand-total">
            <b>Total {currency}</b>
            <b>{money(sum.total)}</b>
          </div>
        </div>
        <label className="checkbox-label" htmlFor="checkout-terms">
          <input id="checkout-terms" name="terms" type="checkbox" required />
          <span>
            {t(
              "Saya menyetujui rincian pesanan dan ketentuan pengiriman Valerie & CO.",
              "I confirm the order details and Valerie & CO delivery terms.",
            )}
          </span>
        </label>
        <button
          className="button dark full checkout-submit-btn"
          type="submit"
          disabled={!db.bag.length}
        >
          {t("Lanjutkan ke Pembayaran", "Proceed to Inline Payment")}
          <ArrowRight size={16} />
        </button>
      </aside>
    </form>
  );
}

const ATELIER_MAP_PRESETS = [
  {
    label: "UMC Watubelah (Cirebon)",
    street: "Jl. Fatahillah No. 40, Watubelah, Sumber",
    city: "Kabupaten Cirebon",
    province: "Jawa Barat",
    postal: "45611",
    lat: -6.7385,
    lon: 108.4975,
  },
  {
    label: "SCBD / Senayan",
    street: "Jl. Jend. Sudirman Kav. 52-53, SCBD Lot 14, Kebayoran Baru",
    city: "Jakarta Selatan",
    province: "DKI Jakarta",
    postal: "12190",
    lat: -6.2246,
    lon: 106.8096,
  },
  {
    label: "Menteng",
    street: "Jl. Teuku Umar No. 24, Menteng",
    city: "Jakarta Pusat",
    province: "DKI Jakarta",
    postal: "10350",
    lat: -6.1954,
    lon: 106.8342,
  },
  {
    label: "PIK Avenue",
    street: "Jl. Pantai Indah Kapuk Boulevard, Kamal Muara, Penjaringan",
    city: "Jakarta Utara",
    province: "DKI Jakarta",
    postal: "14470",
    lat: -6.1095,
    lon: 106.7402,
  },
  {
    label: "Pondok Indah",
    street: "Jl. Metro Pondok Indah Kav. IV, Kebayoran Lama",
    city: "Jakarta Selatan",
    province: "DKI Jakarta",
    postal: "12310",
    lat: -6.2655,
    lon: 106.7843,
  },
  {
    label: "Dago Bandung",
    street: "Jl. Ir. H. Juanda No. 112, Coblong",
    city: "Bandung",
    province: "Jawa Barat",
    postal: "40132",
    lat: -6.8904,
    lon: 107.6132,
  },
  {
    label: "Pakuwon Surabaya",
    street: "Jl. Puncak Indah Lontar No. 2, Wiyung",
    city: "Surabaya",
    province: "Jawa Timur",
    postal: "60216",
    lat: -7.2892,
    lon: 112.6756,
  },
  {
    label: "Seminyak Bali",
    street: "Jl. Kayu Aya No. 48, Seminyak, Kuta",
    city: "Badung, Bali",
    province: "Bali",
    postal: "80361",
    lat: -8.6868,
    lon: 115.1583,
  },
] as const;

type NominatimSearchResult = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  address?: Record<string, string>;
};

export type DestinationChangePayload = {
  street?: string;
  city?: string;
  province?: string;
  postal?: string;
  areaId?: string;
  areaName?: string;
  lat?: number;
  lon?: number;
};

export function AddressFields({
  name = "",
  phone = "",
  address,
  initialAddress,
  defaultValues,
  onDestinationChange,
}: {
  name?: string;
  phone?: string;
  address?: Address;
  initialAddress?: Partial<Address>;
  defaultValues?: Partial<Address>;
  onDestinationChange?: (dest: DestinationChangePayload) => void;
}) {
  const base = address || initialAddress || defaultValues;
  const { t, notify } = useStore();
  const [street, setStreet] = useState(base?.street || "");
  const [city, setCity] = useState(base?.city || "");
  const [postal, setPostal] = useState(base?.postal || "");
  const [province, setProvince] = useState(base?.province || "");
  const [areaId, setAreaId] = useState(base?.areaId || "");
  const [areaName, setAreaName] = useState(base?.areaName || "");
  const [locating, setLocating] = useState(false);
  const [mapQuery, setMapQuery] = useState("");
  const [searchingMap, setSearchingMap] = useState(false);
  const [mapResults, setMapResults] = useState<NominatimSearchResult[]>([]);
  const [coords, setCoords] = useState<{
    lat: number;
    lon: number;
    label: string;
  } | null>(() => {
    if (typeof base?.lat === "number" && typeof base?.lon === "number") {
      return {
        lat: base.lat,
        lon: base.lon,
        label: base.street || `${base.lat}, ${base.lon}`,
      };
    }
    return null;
  });

  const [areaQuery, setAreaQuery] = useState("");
  const [searchingAreas, setSearchingAreas] = useState(false);
  const [areaResults, setAreaResults] = useState<
    Array<{
      id: string;
      name: string;
      city: string;
      province: string;
      postal: string;
    }>
  >([]);

  const onDestinationChangeRef = useRef(onDestinationChange);
  useEffect(() => {
    onDestinationChangeRef.current = onDestinationChange;
  });

  const notifyChange = (next: DestinationChangePayload) => {
    onDestinationChangeRef.current?.(next);
  };

  const initialNotified = useRef(false);
  useEffect(() => {
    if (!initialNotified.current) {
      initialNotified.current = true;
      if (street || city || postal || province || areaId || coords) {
        onDestinationChangeRef.current?.({
          street,
          city,
          province,
          postal,
          areaId,
          areaName,
          lat: coords?.lat,
          lon: coords?.lon,
        });
      }
    }
  }, [street, city, postal, province, areaId, areaName, coords]);

  const prevAddressId = useRef(address?.id);
  useEffect(() => {
    if (address && address.id !== prevAddressId.current) {
      prevAddressId.current = address.id;
      setStreet(address.street || "");
      setCity(address.city || "");
      setPostal(address.postal || "");
      setProvince(address.province || "");
      setAreaId(address.areaId || "");
      setAreaName(address.areaName || "");
      const nextCoords =
        typeof address.lat === "number" && typeof address.lon === "number"
          ? {
              lat: address.lat,
              lon: address.lon,
              label: address.street || `${address.lat}, ${address.lon}`,
            }
          : null;
      setCoords(nextCoords);
      onDestinationChangeRef.current?.({
        street: address.street || "",
        city: address.city || "",
        province: address.province || "",
        postal: address.postal || "",
        areaId: address.areaId || "",
        areaName: address.areaName || "",
        lat: nextCoords?.lat,
        lon: nextCoords?.lon,
      });
    }
  }, [address]);

  useEffect(() => {
    const q = areaQuery.trim();
    if (q.length < 2) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setSearchingAreas(true);
      try {
        const res = await api(`shipping/areas?q=${encodeURIComponent(q)}`);
        if (!cancelled) {
          setAreaResults(Array.isArray(res?.areas) ? res.areas : []);
        }
      } catch {
        if (!cancelled) setAreaResults([]);
      } finally {
        if (!cancelled) setSearchingAreas(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [areaQuery]);

  const displayedAreaResults = areaQuery.trim().length >= 2 ? areaResults : [];

  const selectArea = (item: {
    id: string;
    name: string;
    city: string;
    province: string;
    postal: string;
  }) => {
    setAreaId(item.id);
    setAreaName(item.name);
    setCity(item.city);
    setProvince(item.province);
    setPostal(item.postal);
    setAreaResults([]);
    setAreaQuery("");
    notifyChange({
      street,
      city: item.city,
      province: item.province,
      postal: item.postal,
      areaId: item.id,
      areaName: item.name,
      lat: coords?.lat,
      lon: coords?.lon,
    });
    notify(
      `Area ${item.name} (${item.postal}) dipilih`,
      `Area ${item.name} (${item.postal}) selected`,
    );
  };

  const applyReverseAddress = (
    addr: Record<string, string> | undefined,
    displayName: string,
    lat: number,
    lon: number,
  ) => {
    const road =
      addr?.road ||
      addr?.pedestrian ||
      addr?.neighbourhood ||
      addr?.suburb ||
      addr?.village ||
      "";
    const houseNo = addr?.house_number ? ` No. ${addr.house_number}` : "";
    const suburb = addr?.suburb || addr?.village || addr?.Subdistrict || "";
    const district = addr?.city_district || addr?.municipality || "";
    const parts = [
      road ? `${road}${houseNo}` : "",
      suburb && suburb !== road ? suburb : "",
      district && district !== suburb ? district : "",
    ].filter(Boolean);
    const fallbackStreet = displayName
      .split(",")
      .slice(0, 3)
      .map((s) => s.trim())
      .join(", ");
    const resolvedStreet = parts.join(", ") || fallbackStreet;
    const resolvedCity =
      addr?.city ||
      addr?.town ||
      addr?.county ||
      addr?.state_district ||
      addr?.state ||
      "Jakarta";
    const resolvedProvince =
      addr?.state ||
      addr?.province ||
      addr?.region ||
      "";
    const resolvedPostal =
      addr?.postcode?.replace(/\D/g, "").slice(0, 5) || "12190";
    setStreet(resolvedStreet);
    setCity(resolvedCity);
    if (resolvedProvince) setProvince(resolvedProvince);
    setPostal(resolvedPostal);
    setAreaId("");
    setAreaName("");
    setCoords({
      lat,
      lon,
      label: `${resolvedStreet}, ${resolvedCity} ${resolvedPostal}`,
    });
    notifyChange({
      street: resolvedStreet,
      city: resolvedCity,
      province: resolvedProvince || province,
      postal: resolvedPostal,
      areaId: "",
      areaName: "",
      lat,
      lon,
    });
  };

  const detectCurrentLocation = () => {
    if (!("geolocation" in navigator)) {
      notify(
        "Perangkat tidak mendukung GPS. Gunakan pencarian peta atau pin area di bawah.",
        "Geolocation is not supported. Use map search or area pins below.",
      );
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&addressdetails=1&accept-language=id`,
          );
          if (!res.ok) throw new Error("Reverse geocode failed");
          const data = await res.json();
          applyReverseAddress(data.address, data.display_name || "", lat, lon);
          notify(
            "Titik lokasi GPS berhasil diisi otomatis dari peta",
            "GPS location automatically filled from map",
          );
        } catch {
          const fallbackStreet = `Titik Koordinat GPS (${lat.toFixed(5)}, ${lon.toFixed(5)})`;
          const fallbackCity = city || "Jakarta";
          const fallbackPostal = postal || "12190";
          setStreet(fallbackStreet);
          if (!city) setCity(fallbackCity);
          if (!postal) setPostal(fallbackPostal);
          setCoords({
            lat,
            lon,
            label: `GPS (${lat.toFixed(5)}, ${lon.toFixed(5)})`,
          });
          notifyChange({
            street: fallbackStreet,
            city: fallbackCity,
            province,
            postal: fallbackPostal,
            areaId: "",
            areaName: "",
            lat,
            lon,
          });
          notify(
            "Koordinat GPS berhasil ditangkap ke alamat",
            "GPS coordinates captured to address",
          );
        } finally {
          setLocating(false);
        }
      },
      () => {
        setLocating(false);
        notify(
          "Akses lokasi GPS ditolak browser. Gunakan pencarian peta atau klik pin area cepat di bawah.",
          "Browser location access denied. Use the map search or quick area pins below.",
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  };

  const searchMapLocation = async () => {
    const q = mapQuery.trim();
    if (q.length < 2) return;
    setSearchingMap(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(q)}&countrycodes=id&addressdetails=1&limit=4&accept-language=id`,
      );
      if (!res.ok) throw new Error("Map search failed");
      const list = (await res.json()) as NominatimSearchResult[];
      setMapResults(Array.isArray(list) ? list : []);
      if (!list.length) {
        notify(
          "Lokasi tidak ditemukan. Coba kata kunci kota atau nama jalan lain.",
          "Location not found. Try another street or city keyword.",
        );
      }
    } catch {
      notify(
        "Pencarian peta sedang sibuk. Gunakan pin area cepat di bawah.",
        "Map search is busy. Use the quick area pins below.",
      );
    } finally {
      setSearchingMap(false);
    }
  };

  return (
    <div className="address-fields-wrapper">
      <div className="address-maps-toolbar">
        <div className="address-maps-toolbar-top">
          <div className="address-maps-title">
            <MapPin size={16} />
            <div>
              <b>
                {t(
                  "Isi Alamat Otomatis via GPS & Maps",
                  "Auto-Fill Address via GPS & Maps",
                )}
              </b>
              <small>
                {t(
                  "Deteksi titik lokasi saat ini atau cari di peta tanpa perlu mengetik manual.",
                  "Detect your current GPS location or search the map without typing manually.",
                )}
              </small>
            </div>
          </div>
          <button
            type="button"
            className="button dark small address-gps-btn"
            disabled={locating}
            onClick={detectCurrentLocation}
          >
            <LocateFixed size={15} />
            {locating
              ? t("Mendeteksi Titik GPS…", "Detecting GPS…")
              : t("Gunakan Lokasi Saat Ini", "Use Current Location")}
          </button>
        </div>

        <div className="address-map-search-row">
          <input
            type="text"
            value={mapQuery}
            onChange={(e) => setMapQuery(e.target.value)}
            placeholder={t(
              "Cari nama jalan, gedung, atau area di Maps (contoh: Sudirman, Kemang, Dago)…",
              "Search street, building, or area on Maps…",
            )}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void searchMapLocation();
              }
            }}
          />
          <button
            type="button"
            className="button ghost small"
            disabled={searchingMap}
            onClick={() => void searchMapLocation()}
          >
            <Search size={14} />
            {searchingMap ? t("Mencari…", "Searching…") : t("Cari Peta", "Search Map")}
          </button>
        </div>

        {mapResults.length > 0 && (
          <div className="address-map-results">
            {mapResults.map((item) => (
              <button
                key={item.place_id}
                type="button"
                className="address-map-result-item"
                onClick={() => {
                  applyReverseAddress(
                    item.address,
                    item.display_name,
                    Number(item.lat),
                    Number(item.lon),
                  );
                  setMapResults([]);
                  notify(
                    "Alamat berhasil diterapkan dari hasil pencarian peta",
                    "Address applied from map search result",
                  );
                }}
              >
                <MapPin size={14} />
                <span>{item.display_name}</span>
              </button>
            ))}
          </div>
        )}

        <div className="address-preset-Row">
          <small className="address-preset-label">
            <Sparkles size={12} />{" "}
            {t("Pin Area Cepat:", "Quick Area Pins:")}
          </small>
          <div className="address-preset-chips">
            {ATELIER_MAP_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                className="address-preset-chip"
                onClick={() => {
                  setStreet(preset.street);
                  setCity(preset.city);
                  setPostal(preset.postal);
                  const prov = "province" in preset ? preset.province : "";
                  setProvince(prov);
                  setAreaId("");
                  setAreaName("");
                  const nextCoords = {
                    lat: preset.lat,
                    lon: preset.lon,
                    label: `${preset.street}, ${preset.city} ${preset.postal}`,
                  };
                  setCoords(nextCoords);
                  notifyChange({
                    street: preset.street,
                    city: preset.city,
                    province: prov,
                    postal: preset.postal,
                    areaId: "",
                    areaName: "",
                    lat: preset.lat,
                    lon: preset.lon,
                  });
                  notify(
                    `Titik peta ${preset.label} diterapkan ke alamat`,
                    `${preset.label} map pin applied to address`,
                  );
                }}
              >
                <MapPin size={11} />
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {coords && (
          <div className="address-map-preview">
            <div className="address-map-preview-head">
              <span>
                <MapPin size={13} />{" "}
                {t("Titik Peta Terpilih:", "Selected Map Pin:")}{" "}
                <b>{coords.label}</b>
              </span>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${coords.lat},${coords.lon}`}
                target="_blank"
                rel="noreferrer"
              >
                {t("Buka di Google Maps", "Open in Google Maps")}{" "}
                <ExternalLink size={11} />
              </a>
            </div>
            <iframe
              title="Peta Lokasi Pengiriman"
              className="address-map-iframe"
              loading="lazy"
              src={`https://www.openstreetmap.org/export/embed.html?bbox=${(coords.lon - 0.008).toFixed(5)}%2C${(coords.lat - 0.005).toFixed(5)}%2C${(coords.lon + 0.008).toFixed(5)}%2C${(coords.lat + 0.005).toFixed(5)}&layer=mapnik&marker=${coords.lat.toFixed(5)}%2C${coords.lon.toFixed(5)}`}
            />
          </div>
        )}
      </div>

      <div className="address-area-autocomplete-box" style={{ marginBottom: "14px" }}>
        <div className="address-area-input-row" style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <input
            type="text"
            value={areaQuery}
            onChange={(e) => setAreaQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.preventDefault();
            }}
            placeholder={t(
              "Cari kecamatan / kode pos (contoh: Sumber, Watubelah, Cirebon, 45611)…",
              "Search district / postal code (e.g. Sumber, Watubelah, Cirebon, 45611)…",
            )}
          />
          {searchingAreas && (
            <span className="address-area-spinner" style={{ fontSize: "12px", color: "#8c9b7b" }}>…</span>
          )}
        </div>
        {areaName && (
          <div
            className="address-selected-area-badge"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "4px 8px",
              background: "#f4ede4",
              borderRadius: "4px",
              fontSize: "12px",
              marginTop: "6px",
            }}
          >
            <Sparkles size={12} aria-hidden="true" />
            <span>
              {t("Area Biteship:", "Biteship Area:")} <b>{areaName}</b> ({postal || city})
            </span>
            <button
              type="button"
              className="address-clear-area-btn"
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: "0 2px",
                fontSize: "14px",
              }}
              onClick={() => {
                setAreaId("");
                setAreaName("");
                notifyChange({
                  street,
                  city,
                  province,
                  postal,
                  areaId: "",
                  areaName: "",
                  lat: coords?.lat,
                  lon: coords?.lon,
                });
              }}
            >
              ×
            </button>
          </div>
        )}
        {displayedAreaResults.length > 0 && (
          <div
            className="address-area-results"
            role="listbox"
            style={{
              background: "#fff",
              border: "1px solid #d5c6b3",
              borderRadius: "6px",
              marginTop: "4px",
              maxHeight: "200px",
              overflowY: "auto",
              boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
            }}
          >
            {displayedAreaResults.map((item) => (
              <button
                key={item.id}
                type="button"
                className="address-area-result-item"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  width: "100%",
                  textAlign: "left",
                  padding: "8px 12px",
                  border: "none",
                  borderBottom: "1px solid #f0eae1",
                  background: "transparent",
                  cursor: "pointer",
                }}
                onClick={() => selectArea(item)}
              >
                <strong style={{ fontSize: "13px", color: "#24170f" }}>{item.name}</strong>
                <small style={{ fontSize: "11px", color: "#6b594d" }}>
                  {item.city}, {item.province} {item.postal}
                </small>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="form-grid">
        <label>
          {t("Nama penerima", "Recipient name")}
          <input
            name="name"
            required
            defaultValue={address?.name || name}
            autoComplete="name"
          />
        </label>
        <label>
          {t("Nomor telepon", "Phone number")}
          <input
            name="phone"
            type="tel"
            inputMode="tel"
            required
            minLength={7}
            defaultValue={address?.phone || phone}
            autoComplete="tel"
          />
        </label>
        <label className="span-two">
          {t("Alamat lengkap", "Street address")}
          <textarea
            name="street"
            rows={2}
            required
            minLength={5}
            value={street}
            onChange={(e) => {
              const val = e.target.value;
              setStreet(val);
              notifyChange({
                street: val,
                city,
                province,
                postal,
                areaId,
                areaName,
                lat: coords?.lat,
                lon: coords?.lon,
              });
            }}
            placeholder={t(
              "Nama jalan, nomor rumah/gedung, RT/RW, kelurahan, kecamatan…",
              "Street name, building/house number, district…",
            )}
            autoComplete="street-address"
          />
        </label>
        <label>
          {t("Kota / Kabupaten", "City")}
          <input
            name="city"
            required
            value={city}
            onChange={(e) => {
              const val = e.target.value;
              setCity(val);
              setAreaId("");
              setAreaName("");
              notifyChange({
                street,
                city: val,
                province,
                postal,
                areaId: "",
                areaName: "",
                lat: coords?.lat,
                lon: coords?.lon,
              });
            }}
            autoComplete="address-level2"
          />
        </label>
        <label>
          {t("Provinsi", "Province")}
          <input
            name="province"
            value={province}
            onChange={(e) => {
              const val = e.target.value;
              setProvince(val);
              notifyChange({
                street,
                city,
                province: val,
                postal,
                areaId,
                areaName,
                lat: coords?.lat,
                lon: coords?.lon,
              });
            }}
            autoComplete="address-level1"
            placeholder={t("Jawa Barat, DKI Jakarta, dll.", "Province")}
          />
        </label>
        <label>
          {t("Kode pos", "Postal code")}
          <input
            name="postal"
            inputMode="numeric"
            required
            value={postal}
            onChange={(e) => {
              const val = e.target.value;
              setPostal(val);
              setAreaId("");
              setAreaName("");
              notifyChange({
                street,
                city,
                province,
                postal: val,
                areaId,
                areaName,
                lat: coords?.lat,
                lon: coords?.lon,
              });
            }}
            autoComplete="postal-code"
          />
        </label>
        <input type="hidden" name="areaId" value={areaId} />
        <input type="hidden" name="areaName" value={areaName} />
        <input
          type="hidden"
          name="lat"
          value={coords?.lat !== undefined ? String(coords.lat) : ""}
        />
        <input
          type="hidden"
          name="lon"
          value={coords?.lon !== undefined ? String(coords.lon) : ""}
        />
      </div>
    </div>
  );
}
