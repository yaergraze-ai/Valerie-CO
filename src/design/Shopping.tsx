import { MidtransCheckout } from "./MidtransCheckout";
import { useState, useRef, useEffect } from "react";
import confetti from "canvas-confetti";
import {
  ArrowRight,
  Check,
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
  Search,
  Sparkles,
  Trash2,
  Truck,
} from "lucide-react";
import { useStore, type Address, type Order } from "./store";
import { lineKey, SHIPPING_RATES, totals, validateBag } from "./commerce";
import { Empty } from "./ui";
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
export const PAYMENT_CHANNELS = [
  {
    id: "qris",
    label: "QRIS Instan (Semua Bank & E-Wallet)",
    sub: "GoPay, OVO, Dana, ShopeePay, BCA Mobile, Livin', BRImo",
    vaPrefix: "",
  },
  {
    id: "bca_va",
    label: "BCA Virtual Account",
    sub: "Verifikasi otomatis m-BCA, KlikBCA & ATM BCA",
    vaPrefix: "88010",
  },
  {
    id: "mandiri_va",
    label: "Mandiri Bill / Virtual Account",
    sub: "Verifikasi otomatis Livin' by Mandiri & ATM Mandiri",
    vaPrefix: "89022",
  },
  {
    id: "bni_va",
    label: "BNI Virtual Account",
    sub: "Verifikasi otomatis Wondr by BNI & Mobile Banking BNI",
    vaPrefix: "88081",
  },
  {
    id: "bri_va",
    label: "BRI Virtual Account (BRIVA)",
    sub: "Verifikasi otomatis BRImo & ATM BRI",
    vaPrefix: "88810",
  },
  {
    id: "card",
    label: "Kartu Kredit / Debit (Visa · Mastercard · JCB)",
    sub: "3D Secure 2.0 terenkripsi penuh",
    vaPrefix: "",
  },
] as const;

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
  const { db, t, lang, money, completeOrderPayment, notify } = useStore();
  const liveOrder = db.orders.find((o) => o.id === order.id) || order;
  const [channelId, setChannelId] = useState(initialChannel);
  const [stage, setStage] = useState<"pay" | "receipt">(
    startInPaymentStage ? "pay" : "receipt",
  );
  const [confirming, setConfirming] = useState(false);
  const [showGatewayFrame, setShowGatewayFrame] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(15 * 60);

  useEffect(() => {
    if (stage !== "pay") return;
    const timer = setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [stage]);

  const activeChannel =
    PAYMENT_CHANNELS.find((c) => c.id === channelId) || PAYMENT_CHANNELS[0];
  const cur = liveOrder.currency || "IDR";
  const receiptNo =
    liveOrder.receiptNumber ||
    `VCO-INV-${liveOrder.id.replace(/^SOL-/, "").slice(0, 8).toUpperCase()}`;
  const txId =
    liveOrder.payment?.transactionId ||
    `VCO-TX-${liveOrder.id.replace(/^SOL-/, "").slice(0, 8).toUpperCase()}`;
  const vaDigits =
    liveOrder.address.phone.replace(/\D/g, "").slice(-10) || "0812994028";
  const virtualAccountNumber = `${activeChannel.vaPrefix}${vaDigits}`;
  const countdownText = `${String(Math.floor(secondsLeft / 60)).padStart(2, "0")}:${String(secondsLeft % 60).padStart(2, "0")}`;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${liveOrder.address.street}, ${liveOrder.address.city} ${liveOrder.address.postal}`,
  )}`;

  const handleConfirmPayment = async () => {
    if (confirming) return;
    setConfirming(true);
    try {
      await completeOrderPayment(liveOrder.id, activeChannel.label);
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
            <span className="eyebrow">
              {t(
                "PEMBAYARAN LANGSUNG DI HALAMAN INI",
                "INSTANT INLINE PAYMENT",
              )}
            </span>
            <h2>
              {t(
                "Selesaikan Pembayaran Pesanan",
                "Complete Your Order Payment",
              )}
            </h2>
            <p>
              {t(
                "Tidak perlu berpindah tab. Pilih metode pembayaran di bawah lalu klik konfirmasi untuk langsung menerbitkan struk resmi.",
                "No page redirect needed. Select your payment channel below and confirm to immediately issue your official receipt.",
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
          <span className="inline-section-label">
            {t("Pilih Kanal Pembayaran", "Select Payment Channel")}
          </span>
          <div className="inline-channel-grid">
            {PAYMENT_CHANNELS.map((ch) => (
              <button
                key={ch.id}
                type="button"
                className={`inline-channel-chip ${channelId === ch.id ? "active" : ""}`}
                onClick={() => setChannelId(ch.id)}
              >
                <b>{ch.label}</b>
                <small>{ch.sub}</small>
              </button>
            ))}
          </div>
        </div>

        <div className="inline-payment-instruction-card">
          {activeChannel.id === "qris" ? (
            <div className="inline-qris-box">
              <div className="inline-qris-visual" aria-label="QRIS Valerie & CO">
                <div className="inline-qris-top">
                  <strong>QRIS</strong>
                  <span>NMID: ID202608891029</span>
                </div>
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
                  <rect x="56" y="48" width="12" height="12" fill="#8b6f47" />
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
                <small>VALERIE &amp; CO ATELIER · {money(liveOrder.total, cur)}</small>
              </div>
              <div className="inline-qris-steps">
                <h4>
                  <QrCode size={18} />{" "}
                  {t(
                    "Scan QRIS Instan (Tanpa Pindah Halaman)",
                    "Instant QRIS Scan (No Page Redirect)",
                  )}
                </h4>
                <ol>
                  <li>
                    {t(
                      "Buka aplikasi m-Banking atau E-Wallet (BCA Mobile, Livin', BRImo, GoPay, OVO, Dana, ShopeePay).",
                      "Open your mobile banking or e-wallet app.",
                    )}
                  </li>
                  <li>
                    {t(
                      "Pindai kode QRIS di samping dan pastikan nominal sesuai dengan total tagihan.",
                      "Scan the QRIS code and verify the total amount matches.",
                    )}
                  </li>
                  <li>
                    {t(
                      "Klik tombol Konfirmasi Pembayaran di bawah untuk menerbitkan Struk Resmi secara langsung.",
                      "Click Confirm Payment below to immediately issue your Official Receipt.",
                    )}
                  </li>
                </ol>
              </div>
            </div>
          ) : activeChannel.vaPrefix ? (
            <div className="inline-va-box">
              <div className="inline-va-head">
                <span>{activeChannel.label}</span>
                <small>{t("Verifikasi Otomatis 24 Jam", "24/7 Auto Verification")}</small>
              </div>
              <div className="inline-va-number-row">
                <code>{virtualAccountNumber}</code>
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
              <p className="inline-va-hint">
                {t(
                  `Masukkan nomor Virtual Account di atas pada menu Transfer Virtual Account ${activeChannel.label}, lalu klik Konfirmasi Pembayaran di bawah.`,
                  `Enter the Virtual Account number above in your ${activeChannel.label} menu, then click Confirm Payment below.`,
                )}
              </p>
            </div>
          ) : (
            <div className="inline-va-box">
              <div className="inline-va-head">
                <span>
                  <CreditCard size={16} /> {activeChannel.label}
                </span>
                <small>3D Secure 2.0 Verified</small>
              </div>
              <p className="inline-va-hint">
                {t(
                  "Otorisasi kartu terenkripsi siap diproses untuk pesanan ini. Klik Konfirmasi Pembayaran di bawah untuk menyelesaikan transaksi dan menampilkan struk resmi.",
                  "Encrypted card authorization is ready. Click Confirm Payment below to complete the transaction and view your official receipt.",
                )}
              </p>
            </div>
          )}

          {liveOrder.payment?.url && (
            <div className="inline-gateway-embed-wrap">
              <button
                type="button"
                className="button ghost small"
                onClick={() => setShowGatewayFrame((v) => !v)}
              >
                {showGatewayFrame
                  ? t("Sembunyikan Panel Gateway", "Hide Gateway Frame")
                  : t(
                      "Tampilkan Panel Midtrans Langsung di Sini",
                      "Show Midtrans Gateway Inline Here",
                    )}
              </button>
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
                  "Konfirmasi Pembayaran & Tampilkan Struk Resmi",
                  "Confirm Payment & Show Official Receipt",
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
        <a
          href={mapsUrl}
          target="_blank"
          rel="noreferrer"
          className="button ghost small"
        >
          <MapPin size={14} />
          {t("Buka Titik di Google Maps", "Open Pin in Google Maps")}
          <ExternalLink size={12} />
        </a>
      </div>

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
            <div>
              <h3>{t("Pembayaran", "Payment")}</h3>
              <p>
                {t(
                  "Pilih kanal pembayaran — tampil langsung di halaman ini tanpa pindah tab.",
                  "Choose your payment channel — opens inline right here without leaving the page.",
                )}
              </p>
            </div>
          </div>
          <div className="delivery-options-list payment-channel-options">
            {PAYMENT_CHANNELS.map((ch) => (
              <label
                key={ch.id}
                className={`delivery-option ${selectedChannel === ch.id ? "selected" : ""}`}
              >
                <input
                  type="radio"
                  name="paymentChannel"
                  checked={selectedChannel === ch.id}
                  onChange={() => setSelectedChannel(ch.id)}
                />
                <span>
                  <b>{ch.label}</b>
                  <small>{ch.sub}</small>
                </span>
              </label>
            ))}
          </div>
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
