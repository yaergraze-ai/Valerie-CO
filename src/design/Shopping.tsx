import { MidtransCheckout } from "./MidtransCheckout";
import { useState, useRef, useEffect } from "react";
import confetti from "canvas-confetti";
import {
  ArrowRight,
  Check,
  Copy,
  Download,
  ExternalLink,
  LocateFixed,
  LockKeyhole,
  MapPin,
  Minus,
  Plus,
  Printer,
  QrCode,
  Search,
  Sparkles,
  Trash2,
  Truck,
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

export function PaymentChannelOptions({
  selectedChannel,
  onSelect,
}: {
  selectedChannel: string;
  onSelect: (channelId: string) => void;
}) {
  return (
    <div className="delivery-options-list payment-channel-options">
      {PAYMENT_CHANNELS.map((ch) => (
        <label
          key={ch.id}
          className={`delivery-option payment-channel-row ${selectedChannel === ch.id ? "selected" : ""}`}
        >
          <input
            type="radio"
            name="paymentChannel"
            checked={selectedChannel === ch.id}
            onChange={() => onSelect(ch.id)}
          />
          <div className="payment-channel-row-logo">
            <PaymentBrandLogo channelId={ch.id} size="md" />
          </div>
          <span>
            <b>{ch.label}</b>
            <small>{ch.sub}</small>
          </span>
        </label>
      ))}
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

export function InlinePaymentAndReceipt({
  order,
  initialChannel = "qris",
  startInPaymentStage = true,
  onCheckRemoteStatus,
  checkingRemote = false,
  onDone,
}: {
  order: Order;
  initialChannel?: string;
  startInPaymentStage?: boolean;
  onCheckRemoteStatus?: () => Promise<void>;
  checkingRemote?: boolean;
  onDone: () => void;
}) {
  const { db, t, lang, money, completeOrderPayment, chargeOrderPayment, notify } =
    useStore();
  const liveOrder = db.orders.find((o) => o.id === order.id) || order;
  const directCharge = liveOrder.payment?.directCharge;
  const [channelId, setChannelId] = useState(
    () => directCharge?.channel || liveOrder.payment?.channel || initialChannel,
  );
  const [catFilter, setCatFilter] = useState<PaymentCategory>("all");
  const [stage, setStage] = useState<"pay" | "receipt">(
    startInPaymentStage && liveOrder.payment?.status !== "paid" ? "pay" : "receipt",
  );
  const [confirming, setConfirming] = useState(false);
  const [charging, setCharging] = useState(false);
  const [showGatewayFrame, setShowGatewayFrame] = useState(
    Boolean(order.payment?.url && !order.payment?.directCharge),
  );
  const [showReceiptMap, setShowReceiptMap] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(15 * 60);

  // Interactive states for specific payment gateway channels
  const [ovoPhone, setOvoPhone] = useState(order.address.phone || "0812");
  const [ovoPushed, setOvoPushed] = useState(false);
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [cardHolder, setCardHolder] = useState(order.address.name || "");
  const [cardInstallment, setCardInstallment] = useState<1 | 3 | 6 | 12>(1);
  const [paylaterTenor, setPaylaterTenor] = useState<1 | 3 | 6 | 12>(1);
  const [paylaterPhone, setPaylaterPhone] = useState(
    order.address.phone || "0812",
  );

  useEffect(() => {
    if (stage === "pay" && liveOrder.payment?.status === "paid") {
      setStage("receipt");
    }
  }, [stage, liveOrder.payment?.status]);

  useEffect(() => {
    if (stage !== "pay") return;
    const timer = setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [stage]);

  const activeChannel =
    PAYMENT_CHANNELS.find((c) => c.id === channelId) || PAYMENT_CHANNELS[0];
  const filteredChannels =
    catFilter === "all"
      ? PAYMENT_CHANNELS
      : PAYMENT_CHANNELS.filter((c) => c.category === catFilter);
  const cur = liveOrder.currency || "IDR";
  const receiptNo =
    liveOrder.receiptNumber ||
    `VCO-INV-${liveOrder.id.replace(/^SOL-/, "").slice(0, 8).toUpperCase()}`;
  const txId =
    liveOrder.payment?.transactionId ||
    directCharge?.transactionId ||
    `VCO-TX-${liveOrder.id.replace(/^SOL-/, "").slice(0, 8).toUpperCase()}`;
  const vaDigits =
    liveOrder.address.phone.replace(/\D/g, "").slice(-10).padStart(10, "8") ||
    "0812994028";
  const chargeMatchesChannel =
    Boolean(directCharge) && directCharge?.channel === activeChannel.id;
  const virtualAccountNumber =
    (chargeMatchesChannel && (directCharge?.vaNumber || directCharge?.billKey)) ||
    `${activeChannel.vaPrefix}${vaDigits}`;
  const effectiveBillerCode =
    (chargeMatchesChannel && directCharge?.billerCode) || activeChannel.billerCode;
  const retailPaymentCode =
    (chargeMatchesChannel && directCharge?.paymentCode) ||
    `${activeChannel.vaPrefix}-${liveOrder.id.replace(/[^A-Z0-9]/gi, "").slice(-6).toUpperCase()}-${vaDigits.slice(-4)}`;
  const qrisPayloadString = `00020101021226680016ID.CO.VALERIE.WWW01189360089902026889100215${liveOrder.id.slice(0, 15)}0303UMI52045661530336054${String(Math.round(liveOrder.total)).length.toString().padStart(2, "0")}${Math.round(liveOrder.total)}5802ID5919VALERIE & CO ATELIER6007JAKARTA6304A1B9`;
  const activeQrString =
    (chargeMatchesChannel && directCharge?.qrString) || qrisPayloadString;
  const liveQrImageUrl = chargeMatchesChannel ? directCharge?.qrUrl || "" : "";
  const liveDeeplinkUrl = chargeMatchesChannel
    ? directCharge?.deeplinkUrl || ""
    : "";
  const countdownText = `${String(Math.floor(secondsLeft / 60)).padStart(2, "0")}:${String(secondsLeft % 60).padStart(2, "0")}`;

  const downloadQrisSvg = () => {
    const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 280" width="480" height="560">
      <rect width="240" height="280" rx="16" fill="#ffffff" stroke="#171412" stroke-width="2"/>
      <text x="20" y="30" font-family="sans-serif" font-size="14" font-weight="bold" fill="#171412">QRIS · VALERIE &amp; CO</text>
      <text x="20" y="46" font-family="sans-serif" font-size="9" fill="#6d6258">NMID: ID202608891029A01 · ${liveOrder.id}</text>
      <g transform="translate(30, 60) scale(1.5)">
        <rect width="120" height="120" rx="8" fill="#ffffff"/>
        <rect x="10" y="10" width="30" height="30" fill="#171412"/>
        <rect x="15" y="15" width="20" height="20" fill="#ffffff"/>
        <rect x="20" y="20" width="10" height="10" fill="#171412"/>
        <rect x="80" y="10" width="30" height="30" fill="#171412"/>
        <rect x="85" y="15" width="20" height="20" fill="#ffffff"/>
        <rect x="90" y="20" width="10" height="10" fill="#171412"/>
        <rect x="10" y="80" width="30" height="30" fill="#171412"/>
        <rect x="15" y="85" width="20" height="20" fill="#ffffff"/>
        <rect x="20" y="90" width="10" height="10" fill="#171412"/>
        <rect x="48" y="14" width="8" height="8" fill="#171412"/>
        <rect x="62" y="14" width="8" height="16" fill="#171412"/>
        <rect x="48" y="28" width="8" height="14" fill="#171412"/>
        <rect x="14" y="48" width="16" height="8" fill="#171412"/>
        <rect x="36" y="48" width="14" height="14" fill="#171412"/>
        <rect x="56" y="48" width="12" height="12" fill="#8b6f47"/>
        <rect x="74" y="48" width="14" height="8" fill="#171412"/>
        <rect x="94" y="48" width="16" height="16" fill="#171412"/>
        <rect x="20" y="62" width="10" height="10" fill="#171412"/>
        <rect x="48" y="68" width="16" height="8" fill="#171412"/>
        <rect x="70" y="64" width="10" height="18" fill="#171412"/>
        <rect x="48" y="84" width="12" height="12" fill="#171412"/>
        <rect x="66" y="88" width="16" height="8" fill="#171412"/>
        <rect x="88" y="78" width="22" height="12" fill="#171412"/>
        <rect x="84" y="96" width="12" height="14" fill="#171412"/>
        <rect x="102" y="96" width="8" height="14" fill="#171412"/>
      </g>
      <text x="120" y="262" text-anchor="middle" font-family="sans-serif" font-size="12" font-weight="bold" fill="#171412">${money(liveOrder.total, cur)}</text>
    </svg>`;
    const blob = new Blob([svgContent], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `QRIS-Valerie-CO-${liveOrder.id}.svg`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  const handleConfirmPayment = async () => {
    if (confirming) return;
    setConfirming(true);
    try {
      const detailSuffix =
        activeChannel.category === "card" && cardInstallment > 1
          ? ` (Cicilan 0% ${cardInstallment} Bulan)`
          : activeChannel.category === "paylater"
            ? paylaterTenor === 1
              ? " (Bayar 30 Hari · Bunga 0%)"
              : ` (Cicilan ${paylaterTenor} Bulan)`
            : "";
      await completeOrderPayment(
        liveOrder.id,
        `${activeChannel.label}${detailSuffix}`,
      );
      setStage("receipt");
      try {
        confetti({
          particleCount: 65,
          spread: 70,
          origin: { y: 0.6 },
        });
      } catch {}
    } catch (e) {
      notify((e as Error).message, (e as Error).message);
    } finally {
      setConfirming(false);
    }
  };

  if (stage === "pay") {
    return (
      <div className="inline-payment-stage">
        <div className="inline-payment-header">
          <div>
            <div className="inline-gateway-title-badges">
              <MidtransGatewayBadge />
              <span className="eyebrow">
                {t(
                  "PAYMENT GATEWAY TERINTEGRASI · TETAP DI HALAMAN INI",
                  "INTEGRATED IN-PAGE PAYMENT GATEWAY · NO NEW TAB",
                )}
              </span>
            </div>
            <h2>
              {t(
                "Pilih Metode & Selesaikan Pembayaran",
                "Choose Method & Complete Payment",
              )}
            </h2>
            <p>
              {t(
                "Mendukung QRIS Dinamis, GoPay, OVO, ShopeePay, DANA, LinkAja, 8 Bank Virtual Account, Kartu Kredit/Debit 3DS, Indomaret/Alfamart, dan PayLater — langsung di halaman ini tanpa pindah tab.",
                "Supports Dynamic QRIS, GoPay, OVO, ShopeePay, DANA, LinkAja, 8 Bank Virtual Accounts, 3DS Cards, Retail Stores, and PayLater — 100% inline on this page.",
              )}
            </p>
          </div>
          <div className="inline-payment-timer-box">
            <small>{t("Batas Waktu Sesi", "Session Timer")}</small>
            <strong>{countdownText}</strong>
            <span>{liveOrder.id}</span>
          </div>
        </div>

        <div className="inline-payment-amount-banner">
          <div>
            <span>{t("Total Tagihan Pesanan", "Total Amount Due")}</span>
            <strong>{money(liveOrder.total, cur)}</strong>
          </div>
          <div className="inline-payment-amount-meta">
            <span>{receiptNo}</span>
            <small>
              {liveOrder.items.reduce((s, i) => s + i.quantity, 0)}{" "}
              {t("pasang sepatu atelier", "atelier pairs")}
            </small>
          </div>
        </div>

        <div className="inline-channel-selector">
          <div className="inline-category-tabs" role="tablist">
            {(
              [
                [
                  "all",
                  t(
                    `Semua Metode (${PAYMENT_CHANNELS.length})`,
                    `All Methods (${PAYMENT_CHANNELS.length})`,
                  ),
                ],
                ["qris_ewallet", t("QRIS & E-Wallet", "QRIS & E-Wallet")],
                ["va", t("Virtual Account Bank", "Bank Virtual Account")],
                ["card", t("Kartu Kredit / Debit", "Credit / Debit Card")],
                ["retail", t("Indomaret & Alfamart", "Retail Stores")],
                ["paylater", t("PayLater & Cicilan", "PayLater")],
              ] as const
            ).map(([catKey, catLabel]) => (
              <button
                key={catKey}
                type="button"
                role="tab"
                aria-selected={catFilter === catKey}
                className={`inline-category-tab ${catFilter === catKey ? "active" : ""}`}
                onClick={() => setCatFilter(catKey)}
              >
                {catLabel}
              </button>
            ))}
          </div>

          <div className="inline-channel-grid">
            {filteredChannels.map((ch) => (
              <button
                key={ch.id}
                type="button"
                className={`inline-channel-chip ${channelId === ch.id ? "active" : ""}`}
                onClick={() => setChannelId(ch.id)}
              >
                <div className="inline-channel-chip-top">
                  <PaymentBrandLogo channelId={ch.id} size="md" />
                  {channelId === ch.id && (
                    <span className="inline-channel-active-check">
                      <Check size={14} />
                    </span>
                  )}
                </div>
                <b>{ch.label}</b>
                <small>{ch.sub}</small>
              </button>
            ))}
          </div>
        </div>

        <div className="inline-payment-instruction-card">
          {directCharge && (
            <div className={`inline-live-charge-banner ${chargeMatchesChannel ? "matched" : "locked"}`}>
              <span className="inline-va-brand-title">
                <MidtransGatewayBadge compact />
                <b>
                  {chargeMatchesChannel
                    ? t(
                        "UI Custom Valerie & CO · Terhubung Langsung ke Midtrans Core API",
                        "Valerie & CO Custom UI · Live Midtrans Core API Charge",
                      )
                    : t(
                        `Tagihan Midtrans aktif untuk ${directCharge.channel.toUpperCase()} — pilih channel tersebut untuk menampilkan kode bayar asli`,
                        `Active Midtrans charge issued for ${directCharge.channel.toUpperCase()}`,
                      )}
                </b>
              </span>
              {directCharge.expiryTime && (
                <small>
                  {t("Batas", "Expires")}: {directCharge.expiryTime}
                </small>
              )}
            </div>
          )}
          {!directCharge &&
            db.paymentConfig?.coreApiEnabled &&
            ["qris", "gopay", "shopeepay", "bca_va", "bni_va", "bri_va", "permata_va", "cimb_va", "mandiri_va", "indomaret", "alfamart"].includes(activeChannel.id) && (
              <div className="inline-live-charge-banner prompt">
                <span>
                  {t(
                    "Ingin bayar langsung di UI custom ini tanpa pop-up Midtrans?",
                    "Generate a native direct bill in this custom UI without Snap iframe?",
                  )}
                </span>
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
                    ? t("Menghubungkan Midtrans…", "Connecting Midtrans…")
                    : t(
                        `Buat Tagihan ${activeChannel.badge} Langsung`,
                        `Create Live ${activeChannel.badge} Bill`,
                      )}
                </button>
              </div>
            )}
          {activeChannel.category === "qris_ewallet" ? (
            <div className="inline-qris-box">
              <div className="inline-qris-visual" aria-label={`QRIS ${activeChannel.label}`}>
                <div className="inline-qris-top">
                  <PaymentBrandLogo channelId={activeChannel.id} size="md" />
                  <span>NMID: ID202608891029A01</span>
                </div>
                {liveQrImageUrl ? (
                  <img
                    src={liveQrImageUrl}
                    alt={`QRIS ${activeChannel.label}`}
                    className="inline-qris-svg inline-qris-live-img"
                  />
                ) : (
                  <svg
                    viewBox="0 0 120 120"
                    className="inline-qris-svg"
                    role="img"
                    aria-label="QR Code"
                  >
                  <rect width="120" height="120" rx="8" fill="#ffffff" />
                  <rect x="10" y="10" width="30" height="30" fill="#171412" />
                  <rect x="15" y="15" width="20" height="20" fill="#ffffff" />
                  <rect x="20" y="20" width="10" height="10" fill="#171412" />
                  <rect x="80" y="10" width="30" height="30" fill="#171412" />
                  <rect x="85" y="15" width="20" height="20" fill="#ffffff" />
                  <rect x="90" y="20" width="10" height="10" fill="#171412" />
                  <rect x="10" y="80" width="30" height="30" fill="#171412" />
                  <rect x="15" y="85" width="20" height="20" fill="#ffffff" />
                  <rect x="20" y="90" width="10" height="10" fill="#171412" />
                  <rect x="48" y="14" width="8" height="8" fill="#171412" />
                  <rect x="62" y="14" width="8" height="16" fill="#171412" />
                  <rect x="48" y="28" width="8" height="14" fill="#171412" />
                  <rect x="14" y="48" width="16" height="8" fill="#171412" />
                  <rect x="36" y="48" width="14" height="14" fill="#171412" />
                  <rect x="52" y="46" width="16" height="16" rx="3" fill="#8b6f47" />
                  <rect x="74" y="48" width="14" height="8" fill="#171412" />
                  <rect x="94" y="48" width="16" height="16" fill="#171412" />
                  <rect x="20" y="62" width="10" height="10" fill="#171412" />
                  <rect x="48" y="68" width="16" height="8" fill="#171412" />
                  <rect x="70" y="64" width="10" height="18" fill="#171412" />
                  <rect x="48" y="84" width="12" height="12" fill="#171412" />
                  <rect x="66" y="88" width="16" height="8" fill="#171412" />
                  <rect x="88" y="78" width="22" height="12" fill="#171412" />
                  <rect x="84" y="96" width="12" height="14" fill="#171412" />
                  <rect x="102" y="96" width="8" height="14" fill="#171412" />
                  </svg>
                )}
                <small>VALERIE &amp; CO ATELIER · {money(liveOrder.total, cur)}</small>
                <div className="inline-qris-mini-btns">
                  <button
                    type="button"
                    className="button ghost small"
                    onClick={downloadQrisSvg}
                  >
                    <Download size={12} />
                    {t("Unduh QRIS", "Download QRIS")}
                  </button>
                  <button
                    type="button"
                    className="button ghost small"
                    onClick={() => {
                      void navigator.clipboard?.writeText(activeQrString);
                      notify("Kode QRIS disalin", "QRIS payload copied");
                    }}
                  >
                    <Copy size={12} />
                    {t("Salin Kode", "Copy Code")}
                  </button>
                </div>
                {liveDeeplinkUrl && (
                  <a
                    href={liveDeeplinkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="button dark small full"
                    style={{ marginTop: 6 }}
                  >
                    <ExternalLink size={12} />
                    {t(`Buka Aplikasi ${activeChannel.badge}`, `Open ${activeChannel.badge} App`)}
                  </a>
                )}
              </div>
              <div className="inline-qris-steps">
                <h4>
                  <QrCode size={18} /> {activeChannel.label}
                </h4>
                {activeChannel.id === "ovo" && (
                  <div className="inline-ewallet-phone-box">
                    <label>
                      {t(
                        "Nomor Handphone Terdaftar OVO (Push Notification):",
                        "Registered OVO Phone Number (Push Notification):",
                      )}
                      <div className="inline-ewallet-phone-row">
                        <input
                          type="tel"
                          value={ovoPhone}
                          onChange={(e) => setOvoPhone(e.target.value)}
                          placeholder="0812xxxxxxxx"
                        />
                        <button
                          type="button"
                          className="button dark small"
                          onClick={() => {
                            setOvoPushed(true);
                            notify(
                              `Notifikasi tagihan dikirim ke OVO (${ovoPhone})`,
                              `Payment notification sent to OVO (${ovoPhone})`,
                            );
                          }}
                        >
                          {ovoPushed
                            ? t("Terkirim ke OVO ✓", "Sent to OVO ✓")
                            : t("Kirim Tagihan ke OVO", "Push to OVO App")}
                        </button>
                      </div>
                    </label>
                  </div>
                )}
                <ol>
                  <li>
                    {t(
                      `Buka aplikasi ${activeChannel.id === "qris" ? "m-Banking (BCA Mobile, Livin', BRImo, Wondr) atau E-Wallet (GoPay, OVO, DANA, ShopeePay, LinkAja)" : activeChannel.label} di ponsel Anda.`,
                      `Open your ${activeChannel.label} or mobile banking app on your phone.`,
                    )}
                  </li>
                  <li>
                    {t(
                      "Pindai kode QRIS Dinamis di samping (atau unggah gambar QRIS yang diunduh). Nominal tagihan terisi otomatis.",
                      "Scan the Dynamic QRIS code on the left (or upload the downloaded QRIS image). The total amount is pre-filled automatically.",
                    )}
                  </li>
                  <li>
                    {t(
                      "Selesaikan otorisasi PIN di ponsel Anda, lalu klik tombol Konfirmasi Pembayaran di bawah untuk langsung menerbitkan Struk Resmi di halaman ini.",
                      "Authorize with your PIN, then click Confirm Payment below to immediately issue your Official Receipt on this page.",
                    )}
                  </li>
                </ol>
              </div>
            </div>
          ) : activeChannel.category === "va" ? (
            <div className="inline-va-box">
              <div className="inline-va-head">
                <span className="inline-va-brand-title">
                  <PaymentBrandLogo channelId={activeChannel.id} size="lg" />
                  <b>{activeChannel.label}</b>
                </span>
                <small>{t("Verifikasi Otomatis 24 Jam", "24/7 Auto Verification")}</small>
              </div>
              {effectiveBillerCode && (
                <div className="inline-va-number-row">
                  <div>
                    <small className="inline-va-sublabel">
                      {t("Kode Perusahaan / Biller Mandiri", "Mandiri Company / Biller Code")}
                    </small>
                    <code>{effectiveBillerCode} (VALERIE &amp; CO)</code>
                  </div>
                  <button
                    type="button"
                    className="button ghost small"
                    onClick={() => {
                      void navigator.clipboard?.writeText(effectiveBillerCode);
                      notify("Kode Perusahaan disalin", "Biller code copied");
                    }}
                  >
                    <Copy size={14} />
                    {t("Salin Kode", "Copy Code")}
                  </button>
                </div>
              )}
              <div className="inline-va-number-row">
                <div>
                  <small className="inline-va-sublabel">
                    {t("Nomor Virtual Account", "Virtual Account Number")}
                  </small>
                  <code>{virtualAccountNumber}</code>
                </div>
                <button
                  type="button"
                  className="button ghost small"
                  onClick={() => {
                    void navigator.clipboard?.writeText(virtualAccountNumber);
                    notify(
                      "Nomor Virtual Account disalin",
                      "Virtual Account number copied",
                    );
                  }}
                >
                  <Copy size={14} />
                  {t("Salin Nomor VA", "Copy VA")}
                </button>
              </div>
              <div className="inline-va-number-row">
                <div>
                  <small className="inline-va-sublabel">
                    {t("Nominal Transfer (Tepat Hingga Digit Terakhir)", "Exact Transfer Amount")}
                  </small>
                  <code>{money(liveOrder.total, cur)}</code>
                </div>
                <button
                  type="button"
                  className="button ghost small"
                  onClick={() => {
                    void navigator.clipboard?.writeText(String(Math.round(liveOrder.total)));
                    notify("Nominal tagihan disalin", "Amount copied");
                  }}
                >
                  <Copy size={14} />
                  {t("Salin Nominal", "Copy Amount")}
                </button>
              </div>
              <p className="inline-va-hint">
                {t(
                  `Buka menu Pembayaran / Transfer Virtual Account pada aplikasi ${activeChannel.label}, tempel nomor ${virtualAccountNumber}, lalu klik Konfirmasi Pembayaran di bawah.`,
                  `Open Virtual Account Transfer in ${activeChannel.label}, paste ${virtualAccountNumber}, then click Confirm Payment below.`,
                )}
              </p>
            </div>
          ) : activeChannel.category === "card" ? (
            <div className="inline-va-box">
              <div className="inline-va-head">
                <span className="inline-va-brand-title">
                  <PaymentBrandLogo channelId="card" size="lg" />
                  <b>{activeChannel.label}</b>
                </span>
                <small>3D Secure 2.0 · PCI-DSS Level 1</small>
              </div>
              <div className="inline-card-form-grid">
                <label className="span-two">
                  {t("Nomor Kartu Kredit / Debit", "Card Number")}
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="4532 •••• •••• ••••"
                    value={cardNumber}
                    onChange={(e) =>
                      setCardNumber(
                        e.target.value
                          .replace(/\D/g, "")
                          .slice(0, 16)
                          .replace(/(\d{4})(?=\d)/g, "$1 "),
                      )
                    }
                  />
                </label>
                <label>
                  {t("Masa Berlaku (MM/YY)", "Expiry Date (MM/YY)")}
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="08/29"
                    value={cardExpiry}
                    onChange={(e) => {
                      const d = e.target.value.replace(/\D/g, "").slice(0, 4);
                      setCardExpiry(d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d);
                    }}
                  />
                </label>
                <label>
                  CVV / CVC
                  <input
                    type="password"
                    inputMode="numeric"
                    placeholder="•••"
                    maxLength={4}
                    value={cardCvv}
                    onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  />
                </label>
                <label>
                  {t("Nama Pemegang Kartu", "Cardholder Name")}
                  <input
                    type="text"
                    placeholder="VALERIE MEMBER"
                    value={cardHolder}
                    onChange={(e) => setCardHolder(e.target.value)}
                  />
                </label>
                <label>
                  {t("Pilihan Pembayaran / Cicilan 0%", "Installment Plan")}
                  <select
                    value={cardInstallment}
                    onChange={(e) =>
                      setCardInstallment(Number(e.target.value) as 1 | 3 | 6 | 12)
                    }
                  >
                    <option value={1}>
                      {t("Bayar Penuh (100%)", "Full Payment (100%)")} —{" "}
                      {money(liveOrder.total, cur)}
                    </option>
                    <option value={3}>
                      {t("Cicilan 0% · 3 Bulan", "0% Installment · 3 Months")} —{" "}
                      {money(Math.ceil(liveOrder.total / 3), cur)}/bln
                    </option>
                    <option value={6}>
                      {t("Cicilan 0% · 6 Bulan", "0% Installment · 6 Months")} —{" "}
                      {money(Math.ceil(liveOrder.total / 6), cur)}/bln
                    </option>
                    <option value={12}>
                      {t("Cicilan 0% · 12 Bulan", "0% Installment · 12 Months")} —{" "}
                      {money(Math.ceil(liveOrder.total / 12), cur)}/bln
                    </option>
                  </select>
                </label>
              </div>
            </div>
          ) : activeChannel.category === "retail" ? (
            <div className="inline-va-box">
              <div className="inline-va-head">
                <span className="inline-va-brand-title">
                  <PaymentBrandLogo channelId={activeChannel.id} size="lg" />
                  <b>{activeChannel.label}</b>
                </span>
                <small>{t("Kode Barcode Kasir Instan", "Instant Cashier Barcode")}</small>
              </div>
              <div className="inline-retail-barcode-box">
                <svg
                  viewBox="0 0 260 56"
                  className="inline-barcode-svg"
                  role="img"
                  aria-label="Payment Barcode"
                >
                  <rect width="260" height="56" fill="#ffffff" />
                  {[
                    8, 14, 22, 26, 34, 42, 46, 54, 62, 68, 76, 82, 90, 96, 106,
                    112, 120, 128, 134, 144, 150, 158, 166, 174, 180, 188, 196,
                    204, 210, 218, 226, 234, 240, 248,
                  ].map((x, i) => (
                    <rect
                      key={x}
                      x={x}
                      y="6"
                      width={i % 3 === 0 ? "4" : "2"}
                      height="44"
                      fill="#171412"
                    />
                  ))}
                </svg>
                <div className="inline-va-number-row">
                  <div>
                    <small className="inline-va-sublabel">
                      {t("Kode Pembayaran Kasir", "Cashier Payment Code")}
                    </small>
                    <code>{retailPaymentCode}</code>
                  </div>
                  <button
                    type="button"
                    className="button ghost small"
                    onClick={() => {
                      void navigator.clipboard?.writeText(retailPaymentCode);
                      notify("Kode pembayaran kasir disalin", "Payment code copied");
                    }}
                  >
                    <Copy size={14} />
                    {t("Salin Kode Bayar", "Copy Code")}
                  </button>
                </div>
              </div>
              <p className="inline-va-hint">
                {t(
                  `Tunjukkan barcode atau sebutkan Kode Pembayaran ${retailPaymentCode} (Merchant: Valerie & CO / Midtrans) kepada kasir ${activeChannel.label}, lalu klik Konfirmasi Pembayaran di bawah.`,
                  `Show the barcode or state Payment Code ${retailPaymentCode} to the ${activeChannel.label} cashier, then click Confirm Payment below.`,
                )}
              </p>
            </div>
          ) : (
            <div className="inline-va-box">
              <div className="inline-va-head">
                <span className="inline-va-brand-title">
                  <PaymentBrandLogo channelId={activeChannel.id} size="lg" />
                  <b>{activeChannel.label}</b>
                </span>
                <small>{t("Persetujuan Instan Tanpa Kartu", "Instant Cardless Approval")}</small>
              </div>
              <div className="inline-paylater-options">
                {([1, 3, 6, 12] as const).map((months) => (
                  <button
                    key={months}
                    type="button"
                    className={`inline-channel-chip ${paylaterTenor === months ? "active" : ""}`}
                    onClick={() => setPaylaterTenor(months)}
                  >
                    <b>
                      {months === 1
                        ? t("Bayar 30 Hari Lagi (Bunga 0%)", "Pay in 30 Days (0% Interest)")
                        : t(`Cicilan ${months} Bulan`, `${months}-Month Installment`)}
                    </b>
                    <small>
                      {money(Math.ceil(liveOrder.total / months), cur)} /{" "}
                      {months === 1 ? t("tagihan", "bill") : t("bulan", "mo")}
                    </small>
                  </button>
                ))}
              </div>
              <label className="inline-paylater-phone">
                {t(
                  `Nomor Handphone Akun ${activeChannel.badge}:`,
                  `Registered ${activeChannel.badge} Phone Number:`,
                )}
                <input
                  type="tel"
                  value={paylaterPhone}
                  onChange={(e) => setPaylaterPhone(e.target.value)}
                  placeholder="0812xxxxxxxx"
                />
              </label>
            </div>
          )}

          {liveOrder.payment?.url && (
            <div className="inline-gateway-embed-wrap">
              <div className="inline-gateway-embed-bar">
                <span className="inline-va-brand-title">
                  <MidtransGatewayBadge compact />
                  <span>
                    {t(
                      "Modul Midtrans Snap Live (Tertanam di Halaman Ini — Tanpa Tab Baru)",
                      "Midtrans Snap Live Module (Embedded In-Page — No New Tab)",
                    )}
                  </span>
                </span>
                <button
                  type="button"
                  className="button ghost small"
                  onClick={() => setShowGatewayFrame((v) => !v)}
                >
                  {showGatewayFrame
                    ? t("Sembunyikan Modul Snap", "Hide Snap Module")
                    : t("Tampilkan Modul Snap di Sini", "Show Snap Module Inline")}
                </button>
              </div>
              {showGatewayFrame && (
                <iframe
                  src={liveOrder.payment.url}
                  title="Midtrans Inline Payment"
                  className="inline-gateway-iframe"
                />
              )}
            </div>
          )}
        </div>

        <div className="inline-payment-actions">
          <button
            type="button"
            className="button dark full inline-confirm-pay-btn"
            disabled={confirming}
            onClick={() => void handleConfirmPayment()}
          >
            <Check size={18} />
            {confirming
              ? t("Memverifikasi & Menerbitkan Struk…", "Verifying & Issuing Receipt…")
              : t(
                  `Selesaikan Pembayaran via ${activeChannel.badge} & Terbitkan Struk`,
                  `Complete Payment via ${activeChannel.badge} & Issue Receipt`,
                )}
          </button>
          {onCheckRemoteStatus && (
            <button
              type="button"
              className="button ghost"
              disabled={checkingRemote}
              onClick={() => void onCheckRemoteStatus()}
            >
              {checkingRemote
                ? t("Mengecek…", "Checking…")
                : t("Sinkronkan Status Gateway", "Sync Gateway Status")}
            </button>
          )}
        </div>
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
                <h3>{t("Pembayaran", "Payment")}</h3>
                <MidtransGatewayBadge compact />
              </div>
              <p>
                {t(
                  "Pilih kanal pembayaran — tampil langsung di halaman ini tanpa pindah tab.",
                  "Choose your payment channel — opens inline right here without leaving the page.",
                )}
              </p>
              <PaymentPartnersStrip compact showGateway={false} />
            </div>
          </div>
          <PaymentChannelOptions
            selectedChannel={selectedChannel}
            onSelect={setSelectedChannel}
          />
          <div className="notice checkout-payment-notice">
            <LockKeyhole size={18} />
            <p>
              {t(
                "Pembayaran terintegrasi langsung di jendela ini. Setelah konfirmasi, Struk Pembayaran Resmi Valerie & CO langsung terbit otomatis.",
                "Inline payment right inside this window. Upon confirmation, your official Valerie & CO payment receipt is issued immediately.",
              )}
            </p>
          </div>
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
