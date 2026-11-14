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
  ChevronDown,
  Clock,
  Copy,
  CreditCard,
  Download,
  ExternalLink,
  LocateFixed,
  LockKeyhole,
  MapPin,
  Minus,
  Plus,
  Printer,
  QrCode,
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
import { lineKey, SHIPPING_RATES, totals, validateBag } from "./commerce";
import { Empty } from "./ui";
import {
  MidtransGatewayBadge,
  PaymentBrandLogo,
  PaymentPartnersStrip,
} from "./PaymentLogos";
export function Bag({
  onShop,
  onCheckout,
}: {
  onShop: () => void;
  onCheckout: () => void;
}) {
  const { db, setDb, t, currency, money, priceText, notify } = useStore();
  const rates = SHIPPING_RATES[currency];
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
      <div className="shipping-progress">
        <span>
          <Truck size={16} />
          {sum.subtotal >= rates.freeAbove
            ? t(
                "Anda mendapat gratis ongkir standar",
                "You qualify for complimentary standard shipping",
              )
            : t(
                `Belanja ${money(rates.freeAbove - sum.subtotal)} lagi untuk gratis ongkir`,
                `You are ${money(rates.freeAbove - sum.subtotal)} away from complimentary shipping`,
              )}
        </span>
        <progress value={Math.min(sum.subtotal, rates.freeAbove)} max={rates.freeAbove} />
      </div>
      <div className="order-totals">
        <div>
          <span>Subtotal</span>
          <span>{money(sum.subtotal)}</span>
        </div>
        <div>
          <span>{t("Pengiriman standar", "Standard shipping")}</span>
          <span>
            {sum.shipping ? money(sum.shipping) : t("Gratis", "Complimentary")}
          </span>
        </div>
        <div className="grand-total">
          <b>Total</b>
          <b>{money(sum.total)}</b>
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
    channels: ["gopay", "shopeepay", "dana", "ovo", "linkaja"],
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
                  <b>{t(group.titleId, group.titleEn)}</b>
                  {activeInGroup && (
                    <small className="shopee-pay-chosen-pill">
                      {activeInGroup.badge}
                    </small>
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
                      <span className="shopee-pay-subrow-brand">
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

function downloadOfficialReceiptHtml(
  order: Order,
  money: (n: number, c?: "USD" | "IDR") => string,
) {
  const cur = order.currency || "IDR";
  const receiptNo =
    order.receiptNumber ||
    `VCO-INV-${order.id.replace(/^SOL-/, "").slice(0, 8).toUpperCase()}`;
  const txId =
    order.payment?.transactionId ||
    `VCO-TX-${order.id.replace(/^SOL-/, "").slice(0, 8).toUpperCase()}`;
  const paidTime = formatReceiptDateTime(
    order.payment?.paidAt || order.date,
    "id",
  );
  const method =
    order.payment?.method ||
    order.paymentMethod ||
    "QRIS Instan (Semua Bank & E-Wallet)";
  const itemsSubtotal = order.items.reduce(
    (s, i) => s + i.price * i.quantity,
    0,
  );
  const rows = order.items
    .map(
      (i) => `
      <tr>
        <td style="padding:10px 8px;border-bottom:1px solid #e6dfd5;">
          <strong>${i.name}</strong><br/>
          <small style="color:#6d6258;">SKU: ${i.productCode || i.productId.toUpperCase()} · EU ${i.size}${i.color ? ` · ${i.color}` : ""}</small>
        </td>
        <td style="padding:10px 8px;border-bottom:1px solid #e6dfd5;text-align:center;">${i.quantity}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #e6dfd5;text-align:right;">${money(i.price, cur)}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #e6dfd5;text-align:right;font-weight:600;">${money(i.price * i.quantity, cur)}</td>
      </tr>`,
    )
    .join("");
  const html = `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8"/>
<title>Struk Pembayaran ${receiptNo} — Valerie & CO</title>
<style>
  body { font-family: system-ui, -apple-system, sans-serif; background:#f6f2eb; color:#181512; padding:32px 16px; margin:0; }
  .sheet { max-width:680px; margin:0 auto; background:#fff; border:1px solid #dcd3c6; border-radius:16px; padding:32px; }
  .head { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid #181512; padding-bottom:18px; margin-bottom:20px; }
  .badge { background:#1f5f3b; color:#fff; padding:4px 10px; border-radius:999px; font-size:11px; font-weight:700; letter-spacing:0.08em; }
  .meta { display:grid; grid-template-columns:1fr 1fr; gap:12px; background:#faf7f2; padding:16px; border-radius:12px; margin-bottom:20px; font-size:13px; }
  table { width:100%; border-collapse:collapse; font-size:13px; margin-bottom:20px; }
  th { text-align:left; padding:8px; border-bottom:2px solid #181512; font-size:11px; text-transform:uppercase; letter-spacing:0.08em; color:#6d6258; }
  .totals { margin-left:auto; width:280px; font-size:13px; }
  .totals div { display:flex; justify-content:space-between; padding:5px 0; }
  .totals .grand { border-top:2px solid #181512; margin-top:8px; padding-top:10px; font-size:16px; font-weight:700; }
</style>
</head>
<body>
  <div class="sheet">
    <div class="head">
      <div>
        <div style="font-size:11px;letter-spacing:0.2em;color:#8b6f47;font-weight:700;">VALERIE &amp; CO · OFFICIAL ATELIER RECEIPT</div>
        <h1 style="margin:6px 0 4px;font-family:Georgia,serif;font-size:24px;">Struk Pembayaran Resmi</h1>
        <div style="font-size:13px;color:#6d6258;">${receiptNo} · ${order.id}</div>
      </div>
      <span class="badge">LUNAS / PAID</span>
    </div>
    <div class="meta">
      <div><strong>Penerima:</strong><br/>${order.address.name} (${order.address.phone})<br/>${order.email}</div>
      <div><strong>Alamat Pengiriman:</strong><br/>${order.address.street}, ${order.address.city} ${order.address.postal}</div>
      <div><strong>Metode Pembayaran:</strong><br/>${method}</div>
      <div><strong>Waktu &amp; Ref Transaksi:</strong><br/>${paidTime}<br/>Ref: ${txId}</div>
    </div>
    <table>
      <thead>
        <tr>
          <th>Produk Atelier</th>
          <th style="text-align:center;">Qty</th>
          <th style="text-align:right;">Harga Satuan</th>
          <th style="text-align:right;">Subtotal</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="totals">
      <div><span>Subtotal</span><span>${money(itemsSubtotal, cur)}</span></div>
      ${order.discount ? `<div><span>Diskon Promo</span><span>−${money(order.discount, cur)}</span></div>` : ""}
      <div><span>Pengiriman</span><span>${order.shipping ? money(order.shipping, cur) : "Gratis"}</span></div>
      <div class="grand"><span>Total Dibayar</span><span>${money(order.total, cur)}</span></div>
    </div>
    <p style="margin-top:28px;font-size:12px;color:#6d6258;text-align:center;border-top:1px dashed #dcd3c6;padding-top:16px;">
      Terima kasih telah berbelanja di Valerie &amp; CO Atelier · Dokumen ini adalah bukti pembayaran sah.
    </p>
  </div>
</body>
</html>`;
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Struk-Valerie-CO-${order.id}.html`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
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
  return "pending";
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
  const channelId =
    directCharge?.channel || liveOrder.payment?.channel || initialChannel;
  const activeChannel =
    PAYMENT_CHANNELS.find((c) => c.id === channelId) || PAYMENT_CHANNELS[0];
  const outcome = resolveOrderOutcome(liveOrder);
  const prevOutcomeRef = useRef<LifecycleOutcome>(outcome);

  const [showReceiptMap, setShowReceiptMap] = useState(false);
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
  const virtualAccountNumber =
    (chargeMatchesChannel && (directCharge?.vaNumber || directCharge?.billKey)) ||
    "";
  const effectiveBillerCode =
    (chargeMatchesChannel && directCharge?.billerCode) || activeChannel.billerCode;
  const retailPaymentCode =
    (chargeMatchesChannel && directCharge?.paymentCode) || "";
  const liveQrImageUrl = chargeMatchesChannel ? directCharge?.qrUrl || "" : "";
  const activeQrString = chargeMatchesChannel ? directCharge?.qrString || "" : "";
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

  const isCoreCapable = [
    "qris",
    "gopay",
    "shopeepay",
    "bca_va",
    "bni_va",
    "bri_va",
    "permata_va",
    "cimb_va",
    "mandiri_va",
    "indomaret",
    "alfamart",
  ].includes(activeChannel.id);

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
      <div className="shopee-outcome-card is-expired">
        <div className="shopee-outcome-icon is-expired">
          <Clock size={26} />
        </div>
        <h3>{t("Waktu Pembayaran Habis", "Payment Window Expired")}</h3>
        <p className="shopee-outcome-sub">
          {t(
            `Batas waktu pembayaran untuk pesanan ${receiptNo} telah berakhir. Stok produk telah dikembalikan secara otomatis.`,
            `The payment window for order ${receiptNo} has ended. Reserved items have been returned to stock automatically.`,
          )}
        </p>
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
            <span>{t("Metode", "Method")}</span>
            <b>{activeChannel.label}</b>
          </div>
          <div>
            <span>{t("Status", "Status")}</span>
            <b className="status-tag-expired">{t("KEDALUWARSA", "EXPIRED")}</b>
          </div>
        </div>
        <div className="shopee-outcome-actions">
          <button
            type="button"
            className="button dark"
            onClick={handleReorder}
          >
            <RefreshCw size={15} />
            {t("Pesan Ulang", "Order Again")}
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
      <div className="shopee-outcome-card is-failed">
        <div className="shopee-outcome-icon is-failed">
          <AlertCircle size={26} />
        </div>
        <h3>{t("Pembayaran Tidak Berhasil", "Payment Declined")}</h3>
        <p className="shopee-outcome-sub">
          {liveOrder.payment?.statusReason ||
            t(
              "Pembayaran ditolak oleh penerbit kartu atau sistem gateway. Tidak ada dana yang dipotong dari akun Anda.",
              "Payment was declined by your issuer or payment gateway. No funds were captured.",
            )}
        </p>
        <div className="shopee-outcome-meta">
          <div>
            <span>{t("No. Pesanan", "Order No.")}</span>
            <b>{receiptNo}</b>
          </div>
          <div>
            <span>{t("Nominal", "Amount")}</span>
            <b>{money(liveOrder.total, cur)}</b>
          </div>
          <div>
            <span>{t("Metode", "Method")}</span>
            <b>{liveOrder.payment?.method || activeChannel.label}</b>
          </div>
          <div>
            <span>{t("Status", "Status")}</span>
            <b className="status-tag-failed">{t("GAGAL", "FAILED")}</b>
          </div>
        </div>
        <div className="shopee-outcome-actions">
          <button
            type="button"
            className="button dark"
            onClick={handleReorder}
          >
            <RefreshCw size={15} />
            {t("Ganti Metode / Pesan Ulang", "Try Another Method")}
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
      <div className="shopee-outcome-card is-cancelled">
        <div className="shopee-outcome-icon is-cancelled">
          <Ban size={26} />
        </div>
        <h3>{t("Pesanan Dibatalkan", "Order Cancelled")}</h3>
        <p className="shopee-outcome-sub">
          {t(
            "Pesanan ini telah dibatalkan dan seluruh stok produk telah dikembalikan ke katalog.",
            "This order has been cancelled and reserved inventory has been released.",
          )}
        </p>
        <div className="shopee-outcome-meta">
          <div>
            <span>{t("No. Pesanan", "Order No.")}</span>
            <b>{receiptNo}</b>
          </div>
          <div>
            <span>{t("Dibatalkan Oleh", "Cancelled By")}</span>
            <b>{actorLabel}</b>
          </div>
          <div>
            <span>{t("Alasan", "Reason")}</span>
            <b>
              {liveOrder.payment?.cancelReason ||
                liveOrder.payment?.statusReason ||
                t("Dibatalkan oleh pembeli", "Cancelled by buyer")}
            </b>
          </div>
          <div>
            <span>{t("Waktu", "Timestamp")}</span>
            <b>
              {formatReceiptDateTime(
                liveOrder.payment?.cancelledAt ||
                  liveOrder.payment?.updatedAt ||
                  liveOrder.date,
                lang,
              )}
            </b>
          </div>
        </div>
        <div className="shopee-outcome-actions">
          <button
            type="button"
            className="button dark"
            onClick={handleReorder}
          >
            <RefreshCw size={15} />
            {t("Beli Lagi / Pesan Ulang", "Reorder Items")}
          </button>
          <button type="button" className="button ghost" onClick={onDone}>
            {t("Lihat Pesanan Saya", "My Orders")}
          </button>
        </div>
      </div>
    );
  }

  if (outcome === "refunded") {
    return (
      <div className="shopee-outcome-card is-refunded">
        <div className="shopee-outcome-icon is-refunded">
          <RotateCcw size={26} />
        </div>
        <h3>{t("Dana Telah Dikembalikan", "Payment Refunded")}</h3>
        <p className="shopee-outcome-sub">
          {t(
            "Pengembalian dana untuk pesanan ini telah diproses ke rekening / metode pembayaran asal Anda.",
            "A refund for this order has been issued to your original payment method.",
          )}
        </p>
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
        <div className="shopee-outcome-actions">
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
            <span className="inline-va-brand-title">
              <PaymentBrandLogo channelId={activeChannel.id} size="md" />
              <b>{activeChannel.label}</b>
            </span>
            <span className="shopee-autosync-label">
              {t("Verifikasi otomatis", "Auto-verification active")}
            </span>
          </div>

          {/* 1. Direct QRIS / E-Wallet QR Bill */}
          {liveQrImageUrl ? (
            <div className="shopee-qr-stage">
              <div className="shopee-qr-frame" aria-label={`QRIS ${activeChannel.label}`}>
                <img
                  src={liveQrImageUrl}
                  alt={`QRIS ${activeChannel.label}`}
                  className="inline-qris-live-img"
                />
              </div>
              <div className="shopee-qr-caption">
                <strong>VALERIE &amp; CO ATELIER</strong>
                <span>{money(liveOrder.total, cur)}</span>
              </div>
              <div className="shopee-qr-actions">
                <button
                  type="button"
                  className="button ghost small"
                  onClick={() => void downloadQrisImage()}
                >
                  <Download size={14} />
                  {t("Unduh QRIS", "Download QRIS")}
                </button>
                <button
                  type="button"
                  className="button ghost small"
                  onClick={() =>
                    copyText(
                      "qrurl",
                      liveQrImageUrl,
                      "Kode QR disalin",
                      "QR code copied",
                    )
                  }
                >
                  {copiedKey === "qrurl" ? <Check size={14} /> : <Copy size={14} />}
                  {copiedKey === "qrurl"
                    ? t("Tersalin", "Copied")
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
              {liveDeeplinkUrl && (
                <a
                  href={liveDeeplinkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="button dark full"
                >
                  <ExternalLink size={15} />
                  {t(`Bayar di Aplikasi ${activeChannel.badge}`, `Open ${activeChannel.badge} App`)}
                </a>
              )}
            </div>
          ) : virtualAccountNumber ? (
            /* 2. Virtual Account Bill */
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
                  <code>{virtualAccountNumber}</code>
                </div>
                <button
                  type="button"
                  className="button dark small"
                  onClick={() =>
                    copyText(
                      "va",
                      virtualAccountNumber,
                      "Nomor Virtual Account disalin",
                      "Virtual Account copied",
                    )
                  }
                >
                  {copiedKey === "va" ? <Check size={14} /> : <Copy size={14} />}
                  {copiedKey === "va" ? t("Tersalin", "Copied") : t("Salin No. VA", "Copy VA")}
                </button>
              </div>
              <p className="shopee-va-note">
                {t(
                  "Transfer sesuai total tagihan hingga digit terakhir agar pembayaran terverifikasi otomatis.",
                  "Transfer the exact amount shown above so our gateway verifies your payment automatically.",
                )}
              </p>
            </div>
          ) : retailPaymentCode ? (
            /* 3. Retail Store Barcode & Code */
            <div className="shopee-va-stage">
              <div className="shopee-bill-row is-primary">
                <div>
                  <small>{t(`Kode Pembayaran ${activeChannel.badge}`, `${activeChannel.badge} Payment Code`)}</small>
                  <code>{retailPaymentCode}</code>
                </div>
                <button
                  type="button"
                  className="button dark small"
                  onClick={() =>
                    copyText(
                      "retail",
                      retailPaymentCode,
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
                  `Tunjukkan kode di atas kepada kasir ${activeChannel.badge} terdekat sebelum batas waktu berakhir.`,
                  `Show the code above to any ${activeChannel.badge} cashier before the expiry time.`,
                )}
              </p>
            </div>
          ) : liveOrder.payment?.url ? (
            /* 4. Embedded Midtrans Snap Checkout (Card 3DS, DANA, OVO, PayLater, etc.) */
            <div className="shopee-snap-embed">
              <iframe
                src={liveOrder.payment.url}
                title={`Pembayaran ${activeChannel.label}`}
                className="inline-gateway-iframe"
              />
            </div>
          ) : (
            /* 5. Direct Charge Initialization Trigger (if order created without direct bill) */
            <div className="shopee-init-fallback">
              <p>
                {t(
                  "Klik tombol di bawah untuk menerbitkan kode bayar resmi untuk pesanan ini.",
                  "Click below to generate your official payment bill for this order.",
                )}
              </p>
              {serverMode && (isCoreCapable || !liveOrder.payment?.url) && (
                <button
                  type="button"
                  className="button dark small"
                  disabled={charging}
                  onClick={async () => {
                    setCharging(true);
                    try {
                      await chargeOrderPayment(liveOrder.id, activeChannel.id);
                    } catch (e) {
                      notify((e as Error).message, (e as Error).message);
                    } finally {
                      setCharging(false);
                    }
                  }}
                >
                  {charging
                    ? t("Memuat Tagihan…", "Generating Bill…")
                    : t(`Tampilkan Kode ${activeChannel.badge}`, `Generate ${activeChannel.badge} Bill`)}
                </button>
              )}
            </div>
          )}

          <details className="shopee-howto-details">
            <summary>{t("Petunjuk Pembayaran", "Payment Instructions")}</summary>
            <ol>
              {howToSteps.map((stepText, idx) => (
                <li key={idx}>{stepText}</li>
              ))}
            </ol>
          </details>
        </div>

        {/* Cancel confirmation drawer */}
        {cancelPanelOpen ? (
          <div className="shopee-cancel-drawer">
            <div className="shopee-cancel-drawer-head">
              <b>{t("Batalkan Pesanan Ini?", "Cancel This Order?")}</b>
              <small>
                {t(
                  "Pilih alasan pembatalan. Stok pesanan akan otomatis dikembalikan.",
                  "Choose a cancellation reason. Reserved items will be returned to stock.",
                )}
              </small>
            </div>
            <div className="shopee-cancel-reasons">
              {CANCEL_REASONS.map((r) => (
                <label
                  key={r}
                  className={`shopee-cancel-reason ${cancelReason === r ? "is-selected" : ""}`}
                >
                  <input
                    type="radio"
                    name="cancelReason"
                    checked={cancelReason === r}
                    onChange={() => setCancelReason(r)}
                  />
                  <span>{r}</span>
                </label>
              ))}
            </div>
            <div className="shopee-cancel-actions">
              <button
                type="button"
                className="button ghost small"
                disabled={cancelling}
                onClick={() => setCancelPanelOpen(false)}
              >
                {t("Kembali", "Keep Order")}
              </button>
              <button
                type="button"
                className="button danger small"
                disabled={cancelling}
                onClick={() => void handleConfirmCancel()}
              >
                {cancelling
                  ? t("Membatalkan…", "Cancelling…")
                  : t("Ya, Batalkan Pesanan", "Confirm Cancellation")}
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

  return (
    <div className="inline-receipt-shell" id="official-receipt-print-area">
      <div className="inline-receipt-top-banner">
        <div className="inline-receipt-brand">
          <span className="eyebrow">VALERIE &amp; CO · OFFICIAL ATELIER RECEIPT</span>
          <h2>{t("Struk Pembayaran Resmi", "Official Payment Receipt")}</h2>
          <p>
            {t(
              "Pembayaran Anda telah lunas dan diverifikasi secara otomatis. Pesanan sedang disiapkan oleh tim atelier.",
              "Your payment is confirmed and verified automatically. Your order is now being prepared by our atelier team.",
            )}
          </p>
        </div>
        <div className="inline-receipt-status-pill">
          <Check size={16} />
          <span>{t("LUNAS · TERVERIFIKASI", "PAID · VERIFIED")}</span>
        </div>
      </div>

      <div className="inline-receipt-meta-grid">
        <div className="inline-receipt-meta-item">
          <small>{t("No. Struk Resmi", "Receipt Number")}</small>
          <strong>{receiptNo}</strong>
        </div>
        <div className="inline-receipt-meta-item">
          <small>{t("ID Pesanan", "Order ID")}</small>
          <strong>{liveOrder.id}</strong>
        </div>
        <div className="inline-receipt-meta-item">
          <small>{t("No. Referensi Transaksi", "Transaction ID")}</small>
          <strong>{txId}</strong>
        </div>
        <div className="inline-receipt-meta-item">
          <small>{t("Waktu Transaksi (Real-Time)", "Transaction Timestamp")}</small>
          <strong>
            {formatReceiptDateTime(
              liveOrder.payment?.paidAt || liveOrder.date,
              lang,
            )}
          </strong>
        </div>
        <div className="inline-receipt-meta-item">
          <small>{t("Metode Pembayaran", "Payment Method")}</small>
          <strong>
            {liveOrder.payment?.method ||
              liveOrder.paymentMethod ||
              activeChannel.label}
          </strong>
        </div>
        <div className="inline-receipt-meta-item">
          <small>{t("Status Pesanan", "Order Status")}</small>
          <strong>{t("Diproses Atelier", "Atelier Processing")}</strong>
        </div>
      </div>

      <div className="inline-receipt-address-box">
        <div>
          <small>{t("Penerima & Tujuan Pengiriman", "Recipient & Delivery Destination")}</small>
          <b>
            {liveOrder.address.name} · {liveOrder.address.phone}
          </b>
          <p>
            {liveOrder.address.street}, {liveOrder.address.city}{" "}
            {liveOrder.address.postal}
          </p>
        </div>
        <button
          type="button"
          className="button ghost small"
          onClick={() => setShowReceiptMap((v) => !v)}
        >
          <MapPin size={14} />
          {showReceiptMap
            ? t("Sembunyikan Peta", "Hide Map")
            : t("Lihat Peta di Halaman Ini", "View Map Inline")}
        </button>
      </div>

      {showReceiptMap && (
        <div className="address-map-preview">
          <iframe
            title="Peta Lokasi Pengiriman Struk"
            className="address-map-iframe"
            loading="lazy"
            src="https://www.openstreetmap.org/export/embed.html?bbox=106.7800%2C-6.2450%2C106.8400%2C-6.1950&layer=mapnik&marker=-6.2246%2C106.8096"
          />
        </div>
      )}

      <div className="inline-receipt-items-table">
        <div className="inline-receipt-table-head">
          <span>{t("Rincian Produk & SKU", "Product & SKU Breakdown")}</span>
          <span>{t("Subtotal", "Subtotal")}</span>
        </div>
        {liveOrder.items.map((item, idx) => (
          <div
            className="inline-receipt-item-row"
            key={`${item.productId}-${item.size}-${idx}`}
          >
            <img src={item.image} alt={item.name} />
            <div className="inline-receipt-item-info">
              <b>{item.name}</b>
              <small>
                SKU {item.productCode || item.productId.toUpperCase()} · EU{" "}
                {item.size}
                {item.color ? ` · ${item.color}` : ""} · Qty {item.quantity} ×{" "}
                {money(item.price, cur)}
              </small>
            </div>
            <strong>{money(item.price * item.quantity, cur)}</strong>
          </div>
        ))}
      </div>

      <div className="inline-receipt-totals">
        <div>
          <span>Subtotal</span>
          <span>
            {money(
              liveOrder.items.reduce((s, i) => s + i.price * i.quantity, 0),
              cur,
            )}
          </span>
        </div>
        {liveOrder.discount > 0 && (
          <div>
            <span>{t("Potongan Voucher", "Promo Discount")}</span>
            <span>−{money(liveOrder.discount, cur)}</span>
          </div>
        )}
        <div>
          <span>{t("Biaya Pengiriman", "Shipping Fee")}</span>
          <span>
            {liveOrder.shipping
              ? money(liveOrder.shipping, cur)
              : t("Gratis", "Complimentary")}
          </span>
        </div>
        <div className="inline-receipt-grand-total">
          <b>{t("Total Dibayar", "Total Paid")}</b>
          <b>{money(liveOrder.total, cur)}</b>
        </div>
      </div>

      <div className="inline-receipt-actions">
        <button
          type="button"
          className="button ghost"
          onClick={() => window.print()}
        >
          <Printer size={16} />
          {t("Cetak Struk / PDF", "Print Receipt / PDF")}
        </button>
        <button
          type="button"
          className="button ghost"
          onClick={() => downloadOfficialReceiptHtml(liveOrder, money)}
        >
          <Download size={16} />
          {t("Unduh Struk (.HTML)", "Download Receipt (.HTML)")}
        </button>
        <button type="button" className="button dark" onClick={onDone}>
          {t("Lihat & Lacak di Pesanan Saya", "Track in My Orders")}
          <ArrowRight size={16} />
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
  const coupon = db.coupons.find((c) => c.code === applied && c.active);
  const sum = totals(db.bag, db.products, coupon, express, currency);
  const savedAddress = member?.addresses.find((a) => a.id === addressId);
  const totalItems = db.bag.reduce((count, line) => count + line.quantity, 0);
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
  const applyPromoCode = async () => {
    try {
      const found = await applyCoupon(code.trim().toUpperCase());
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
          const address: Address = savedAddress || {
            id: crypto.randomUUID(),
            label: "Shipping",
            name: String(f.get("name")),
            phone: String(f.get("phone")),
            street: String(f.get("street")),
            city: String(f.get("city")),
            postal: String(f.get("postal")),
          };
          const order = await checkout(
            address,
            applied,
            express,
            checkoutKey.current,
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
        <small className="checkout-coupon-hint">
          {t("Masukkan kode voucher Valerie & CO bila tersedia.", "Have a Valerie & CO voucher code? Apply it before confirming.")}
        </small>
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
    label: "SCBD / Senayan",
    street: "Jl. Jend. Sudirman Kav. 52-53, SCBD Lot 14, Kebayoran Baru",
    city: "Jakarta Selatan",
    postal: "12190",
    lat: -6.2246,
    lon: 106.8096,
  },
  {
    label: "Menteng",
    street: "Jl. Teuku Umar No. 24, Menteng",
    city: "Jakarta Pusat",
    postal: "10350",
    lat: -6.1954,
    lon: 106.8342,
  },
  {
    label: "PIK Avenue",
    street: "Jl. Pantai Indah Kapuk Boulevard, Kamal Muara, Penjaringan",
    city: "Jakarta Utara",
    postal: "14470",
    lat: -6.1095,
    lon: 106.7402,
  },
  {
    label: "Pondok Indah",
    street: "Jl. Metro Pondok Indah Kav. IV, Kebayoran Lama",
    city: "Jakarta Selatan",
    postal: "12310",
    lat: -6.2655,
    lon: 106.7843,
  },
  {
    label: "Dago Bandung",
    street: "Jl. Ir. H. Juanda No. 112, Coblong",
    city: "Bandung",
    postal: "40132",
    lat: -6.8904,
    lon: 107.6132,
  },
  {
    label: "Pakuwon Surabaya",
    street: "Jl. Puncak Indah Lontar No. 2, Wiyung",
    city: "Surabaya",
    postal: "60216",
    lat: -7.2892,
    lon: 112.6756,
  },
  {
    label: "Seminyak Bali",
    street: "Jl. Kayu Aya No. 48, Seminyak, Kuta",
    city: "Badung, Bali",
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

export function AddressFields({
  name = "",
  phone = "",
  address,
}: {
  name?: string;
  phone?: string;
  address?: Address;
}) {
  const { t, notify } = useStore();
  const [street, setStreet] = useState(address?.street || "");
  const [city, setCity] = useState(address?.city || "");
  const [postal, setPostal] = useState(address?.postal || "");
  const [locating, setLocating] = useState(false);
  const [mapQuery, setMapQuery] = useState("");
  const [searchingMap, setSearchingMap] = useState(false);
  const [mapResults, setMapResults] = useState<NominatimSearchResult[]>([]);
  const [coords, setCoords] = useState<{
    lat: number;
    lon: number;
    label: string;
  } | null>(null);

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
    const resolvedPostal =
      addr?.postcode?.replace(/\D/g, "").slice(0, 5) || "12190";
    setStreet(resolvedStreet);
    setCity(resolvedCity);
    setPostal(resolvedPostal);
    setCoords({
      lat,
      lon,
      label: `${resolvedStreet}, ${resolvedCity} ${resolvedPostal}`,
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
          setStreet(
            `Titik Koordinat GPS (${lat.toFixed(5)}, ${lon.toFixed(5)})`,
          );
          if (!city) setCity("Jakarta");
          if (!postal) setPostal("12190");
          setCoords({
            lat,
            lon,
            label: `GPS (${lat.toFixed(5)}, ${lon.toFixed(5)})`,
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
                  setCoords({
                    lat: preset.lat,
                    lon: preset.lon,
                    label: `${preset.street}, ${preset.city} ${preset.postal}`,
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
            onChange={(e) => setStreet(e.target.value)}
            placeholder={t(
              "Nama jalan, nomor rumah/gedung, RT/RW, kelurahan, kecamatan…",
              "Street name, building/house number, district…",
            )}
            autoComplete="street-address"
          />
        </label>
        <label>
          {t("Kota", "City")}
          <input
            name="city"
            required
            value={city}
            onChange={(e) => setCity(e.target.value)}
            autoComplete="address-level2"
          />
        </label>
        <label>
          {t("Kode pos", "Postal code")}
          <input
            name="postal"
            inputMode="numeric"
            required
            value={postal}
            onChange={(e) => setPostal(e.target.value)}
            autoComplete="postal-code"
          />
        </label>
      </div>
    </div>
  );
}
