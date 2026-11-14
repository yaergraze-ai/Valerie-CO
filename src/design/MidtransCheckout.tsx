import { useEffect, useRef, useState } from "react";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { useStore, type Address, type Order } from "./store";
import { api } from "./backend";
import {
  AddressFields,
  InlinePaymentAndReceipt,
  PAYMENT_CHANNELS,
  PaymentChannelOptions,
} from "./Shopping";
import { MidtransGatewayBadge } from "./PaymentLogos";
import { TurnstileWidget } from "./TurnstileWidget";

type Quote = {
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
};

export function MidtransCheckout({ onDone }: { onDone: () => void }) {
  const { db, member, t, money, checkout, refresh, notify } = useStore();
  const [express, setExpress] = useState(false);
  const [promoInput, setPromoInput] = useState("");
  const [code, setCode] = useState("");
  const [selectedChannel, setSelectedChannel] = useState<string>("qris");
  const [checkingRemote, setCheckingRemote] = useState(false);
  const [addressId, setAddressId] = useState(
    () => member?.addresses[0]?.id || "new",
  );
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [order, setOrder] = useState<Order | null>(null);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileResetSignal, setTurnstileResetSignal] = useState(0);
  const key = useRef(crypto.randomUUID());
  const submitting = useRef(false);
  const savedAddress = member?.addresses.find((a) => a.id === addressId);
  const totalItems = db.bag.reduce((sum, line) => sum + line.quantity, 0);
  const turnstileSiteKey = db.paymentConfig?.turnstileSiteKey || "";
  const selectedChannelInfo =
    PAYMENT_CHANNELS.find((c) => c.id === selectedChannel) || PAYMENT_CHANNELS[0];

  useEffect(() => {
    if (order) return;
    const lifecycle = new AbortController();
    setQuote(null);
    setError("");
    void api("payments/quote", { lines: db.bag, code, express })
      .then((q) => {
        if (!lifecycle.signal.aborted) setQuote(q);
      })
      .catch((e) => {
        if (!lifecycle.signal.aborted) setError(e.message);
      });
    return () => lifecycle.abort();
  }, [db.bag, code, express, order]);

  useEffect(() => {
    if (!order?.id) return;
    const live = db.orders.find((o) => o.id === order.id);
    if (live && live !== order) setOrder(live);
  }, [db.orders, order]);

  useEffect(() => {
    const orderId = order?.id;
    const paymentStatus = order?.payment?.status;
    if (!orderId || paymentStatus !== "pending") return;
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      void api("payments/status", { id: orderId })
        .then(() => refresh())
        .catch(() => {});
    }, 4000);
    return () => clearInterval(interval);
  }, [order?.id, order?.payment?.status, refresh]);

  if (order)
    return (
      <InlinePaymentAndReceipt
        order={order}
        initialChannel={selectedChannel}
        startInPaymentStage={order.payment?.status !== "paid"}
        checkingRemote={checkingRemote}
        onCheckRemoteStatus={async () => {
          setCheckingRemote(true);
          try {
            await api("payments/status", { id: order.id });
            await refresh();
          } catch (e) {
            notify((e as Error).message, (e as Error).message);
          } finally {
            setCheckingRemote(false);
          }
        }}
        onDone={onDone}
      />
    );

  const applyPromoCode = () => {
    setCode(promoInput.trim().toUpperCase());
  };

  return (
    <form
      className="checkout-grid"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!quote || submitting.current) return;
        if (turnstileSiteKey && !turnstileToken) {
          setError(
            t(
              "Selesaikan centang keamanan Cloudflare sebelum membuat pesanan.",
              "Complete the Cloudflare security check before placing your order.",
            ),
          );
          return;
        }
        submitting.current = true;
        setBusy(true);
        setError("");
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
          setOrder(
            await checkout(
              address,
              code,
              express,
              key.current,
              quote.total,
              selectedChannel,
              turnstileToken || undefined,
            ),
          );
        } catch (err) {
          setError((err as Error).message);
          setTurnstileToken("");
          setTurnstileResetSignal((n) => n + 1);
        } finally {
          setBusy(false);
          submitting.current = false;
        }
      }}
    >
      <div className="checkout-main">
        <section className="checkout-step-card">
          <div className="checkout-step-head">
            <span className="checkout-step-num">01</span>
            <div>
              <h3>{t("Alamat Pengiriman", "Delivery Address")}</h3>
              <p>
                {t(
                  "Pilih alamat tersimpan atau isi tujuan pengiriman baru.",
                  "Choose a saved address or enter a new destination.",
                )}
              </p>
            </div>
          </div>
          {member && member.addresses.length > 0 && (
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
            <AddressFields name={member?.name} phone={member?.phone} />
          )}
        </section>

        <section className="checkout-step-card">
          <div className="checkout-step-head">
            <span className="checkout-step-num">02</span>
            <div>
              <h3>{t("Opsi Pengiriman", "Shipping Option")}</h3>
              <p>
                {t(
                  "Dikemas rapi dengan kotak atelier & dustbag beludru.",
                  "Packed in our signature atelier box & velvet dustbag.",
                )}
              </p>
            </div>
          </div>
          <div className="delivery-options-list">
            <label className={`delivery-option ${!express ? "selected" : ""}`}>
              <input
                type="radio"
                name="service"
                value="standard"
                checked={!express}
                onChange={() => setExpress(false)}
              />
              <span>
                <b>{t("Reguler", "Standard")}</b>
                <small>
                  {t("Estimasi 3–5 hari kerja", "Estimated 3–5 business days")}
                </small>
              </span>
              <strong>
                {quote
                  ? quote.shipping === 0
                    ? t("Gratis", "Free")
                    : !express
                      ? money(quote.shipping, "IDR")
                      : t("Reguler", "Standard")
                  : "…"}
              </strong>
            </label>
            <label className={`delivery-option ${express ? "selected" : ""}`}>
              <input
                type="radio"
                name="service"
                value="express"
                checked={express}
                onChange={() => setExpress(true)}
              />
              <span>
                <b>{t("Ekspres Prioritas", "Express Priority")}</b>
                <small>
                  {t("Estimasi 1–2 hari kerja", "Estimated 1–2 business days")}
                </small>
              </span>
              <strong>
                {quote && express
                  ? money(quote.shipping, "IDR")
                  : t("Prioritas", "Priority")}
              </strong>
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
                  "Pilih metode pembayaran di bawah — tagihan tampil instan setelah pesanan dibuat.",
                  "Select a payment method below — your bill appears immediately upon order creation.",
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
          <h3>{t("Ringkasan Pesanan", "Order Summary")}</h3>
          <span className="checkout-summary-count">
            {totalItems} {t("item", "items")}
          </span>
        </div>
        <div className="checkout-items-scroll">
          {db.bag.map((l, i) => {
            const p = db.products.find((p) => p.id === l.productId);
            return (
              <div className="checkout-item" key={i}>
                <img src={p?.images[0]} alt={p?.name || ""} />
                <div className="checkout-item-info">
                  <b>{p?.name}</b>
                  <small>
                    EU {l.size}
                    {l.color ? ` · ${l.color}` : ""} · Qty {l.quantity}
                  </small>
                </div>
                <strong className="checkout-item-price">
                  {p?.priceIdr
                    ? money(p.priceIdr * l.quantity, "IDR")
                    : t("Harga IDR belum diatur", "IDR price not set")}
                </strong>
              </div>
            );
          })}
        </div>
        <div className="coupon-input">
          <label className="sr-only" htmlFor="midtrans-coupon">
            {t("Kode voucher", "Voucher code")}
          </label>
          <input
            id="midtrans-coupon"
            name="coupon"
            placeholder={t("Kode voucher Valerie & CO", "Valerie & CO voucher")}
            value={promoInput}
            onChange={(e) => setPromoInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                applyPromoCode();
              }
            }}
          />
          <button
            className="button dark"
            type="button"
            onClick={applyPromoCode}
          >
            {t("Pakai", "Apply")}
          </button>
        </div>
        {quote && (
          <div className="order-totals">
            <div>
              <span>Subtotal</span>
              <span>{money(quote.subtotal, "IDR")}</span>
            </div>
            {code && (
              <div>
                <span>
                  Voucher {code}{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setCode("");
                      setPromoInput("");
                    }}
                  >
                    ×
                  </button>
                </span>
                <span>−{money(quote.discount, "IDR")}</span>
              </div>
            )}
            <div>
              <span>{t("Ongkos Kirim", "Shipping Fee")}</span>
              <span>
                {quote.shipping
                  ? money(quote.shipping, "IDR")
                  : t("Gratis", "Free")}
              </span>
            </div>
            <div>
              <span>{t("Metode Dipilih", "Selected Method")}</span>
              <span>{selectedChannelInfo.badge}</span>
            </div>
            <div className="grand-total">
              <b>{t("Total Pembayaran", "Total Payment")}</b>
              <b>{money(quote.total, "IDR")}</b>
            </div>
          </div>
        )}
        {turnstileSiteKey && (
          <TurnstileWidget
            siteKey={turnstileSiteKey}
            resetSignal={turnstileResetSignal}
            onToken={setTurnstileToken}
            onExpired={() => setTurnstileToken("")}
          />
        )}
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
        <button
          className="button dark full checkout-submit-btn"
          disabled={!quote || busy}
          type="submit"
        >
          {busy
            ? t("Membuat Pesanan…", "Placing Order…")
            : t("Buat Pesanan & Bayar", "Place Order & Pay")}
          {!busy && <ArrowRight size={16} />}
        </button>
        <div className="checkout-security-footnote">
          <ShieldCheck size={13} aria-hidden="true" />
          <span>
            {turnstileSiteKey
              ? t(
                  "Dilindungi Cloudflare Security & Enkripsi Midtrans",
                  "Protected by Cloudflare Security & Midtrans Encryption",
                )
              : t(
                  "Pembayaran otomatis & stok terverifikasi",
                  "Verified stock & automatic payment sync",
                )}
          </span>
        </div>
      </aside>
    </form>
  );
}
