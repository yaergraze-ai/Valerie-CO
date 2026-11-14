import { useEffect, useRef, useState } from "react";
import { ArrowRight, LockKeyhole, ShieldCheck } from "lucide-react";
import { useStore, type Address, type Order } from "./store";
import { api } from "./backend";
import { AddressFields, InlinePaymentAndReceipt } from "./Shopping";

type Quote = {
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
};

/**
 * Two-step Midtrans checkout flow:
 * 01. Confirm delivery address, courier speed & promo quote
 * 02. Open official Midtrans Snap inline vitrine -> Official Atelier Receipt
 */
export function MidtransCheckout({ onDone }: { onDone: () => void }) {
  const { db, member, t, money, checkout, refresh, notify } = useStore();
  const [express, setExpress] = useState(false);
  const [promoInput, setPromoInput] = useState("");
  const [code, setCode] = useState("");
  const [checkingRemote, setCheckingRemote] = useState(false);
  const [addressId, setAddressId] = useState(
    () => member?.addresses[0]?.id || "new",
  );
  const [quoteState, setQuoteState] = useState<{
    key: string;
    quote: Quote | null;
    error: string;
  }>({ key: "", quote: null, error: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [order, setOrder] = useState<Order | null>(null);
  const key = useRef(crypto.randomUUID());
  const submitting = useRef(false);

  const savedAddress = member?.addresses.find((a) => a.id === addressId);
  const totalItems = db.bag.reduce((sum, line) => sum + line.quantity, 0);
  const requestKey = `${db.bag.map((l) => `${l.productId}:${l.size}:${l.quantity}`).join(",")}|${code}|${express}`;
  const quote = quoteState.key === requestKey ? quoteState.quote : null;
  const effectiveError =
    error || (quoteState.key === requestKey ? quoteState.error : "");

  useEffect(() => {
    if (order) return;
    const lifecycle = new AbortController();
    void api("payments/quote", { lines: db.bag, code, express })
      .then((q) => {
        if (!lifecycle.signal.aborted) {
          setQuoteState({ key: requestKey, quote: q, error: "" });
        }
      })
      .catch((e) => {
        if (!lifecycle.signal.aborted) {
          setQuoteState({
            key: requestKey,
            quote: null,
            error: (e as Error).message,
          });
        }
      });
    return () => lifecycle.abort();
  }, [db.bag, code, express, order, requestKey]);

  if (order) {
    return (
      <InlinePaymentAndReceipt
        order={order}
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
  }

  const applyPromoCode = () => {
    setCode(promoInput.trim().toUpperCase());
  };

  return (
    <div className="checkout-flow-shell">
      <nav className="checkout-stepper" aria-label={t("Tahap Checkout", "Checkout Steps")}>
        <span className="checkout-step-pill is-active">
          <b>01</b> {t("Pengiriman", "Delivery")}
        </span>
        <span className="checkout-step-line" aria-hidden="true" />
        <span className="checkout-step-pill">
          <b>02</b> {t("Midtrans Snap", "Midtrans Snap")}
        </span>
        <span className="checkout-step-line" aria-hidden="true" />
        <span className="checkout-step-pill">
          <b>03</b> {t("Struk Resmi", "Official Receipt")}
        </span>
      </nav>

      <form
        className="checkout-grid"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!quote || submitting.current) return;
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
              await checkout(address, code, express, key.current, quote.total),
            );
          } catch (e) {
            setError((e as Error).message);
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
                <h3>{t("Alamat pengiriman", "Delivery address")}</h3>
                <p>
                  {t(
                    "Pilih alamat tersimpan atau isi tujuan baru.",
                    "Select a saved address or enter a destination.",
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
                  {savedAddress.street}, {savedAddress.city}{" "}
                  {savedAddress.postal}
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
                <h3>{t("Kurir & gerbang pembayaran", "Courier & gateway")}</h3>
                <p>
                  {t(
                    "Pilih kecepatan kirim, lalu bayar langsung via Midtrans Snap.",
                    "Pick shipping speed, then pay inline via Midtrans Snap.",
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
                  <b>{t("Standar (3–5 hari)", "Standard (3–5 days)")}</b>
                  <small>{t("Kotak atelier & dustbag beludru", "Atelier box & velvet dustbag")}</small>
                </span>
                <strong>
                  {quote
                    ? quote.shipping === 0
                      ? t("Gratis", "Free")
                      : !express
                        ? money(quote.shipping, "IDR")
                        : t("Standar", "Standard")
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
                  <b>{t("Ekspres (1–2 hari)", "Express (1–2 days)")}</b>
                  <small>{t("Prioritas kurir berasuransi", "Insured priority courier")}</small>
                </span>
                <strong>
                  {quote && express
                    ? money(quote.shipping, "IDR")
                    : t("Prioritas", "Priority")}
                </strong>
              </label>
            </div>
            <div className="notice checkout-payment-notice">
              <LockKeyhole size={17} />
              <p>
                {t(
                  "QRIS, GoPay, ShopeePay, Virtual Account, Kartu 3DS & PayLater terbuka resmi via Midtrans di langkah berikutnya.",
                  "QRIS, GoPay, ShopeePay, Virtual Accounts, 3DS Cards & PayLater open officially via Midtrans in the next step.",
                )}
              </p>
            </div>
          </section>
        </div>

        <aside className="checkout-summary">
          <div className="checkout-summary-head">
            <h3>{t("Ringkasan pesanan", "Order summary")}</h3>
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
                    {p
                      ? money(
                          (p.priceIdr || p.price * 15000) * l.quantity,
                          "IDR",
                        )
                      : ""}
                  </strong>
                </div>
              );
            })}
          </div>
          <div className="coupon-input">
            <label className="sr-only" htmlFor="midtrans-coupon">
              {t("Kode promo", "Promo code")}
            </label>
            <input
              id="midtrans-coupon"
              value={promoInput}
              onChange={(e) => setPromoInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  applyPromoCode();
                }
              }}
              placeholder={t("Kode promo (opsional)", "Promo code (optional)")}
            />
            <button
              className="button ghost"
              type="button"
              onClick={applyPromoCode}
            >
              {t("Pakai", "Apply")}
            </button>
          </div>
          {quote && (
            <div className="bag-totals">
              <div>
                <span>Subtotal</span>
                <span>{money(quote.subtotal, "IDR")}</span>
              </div>
              {quote.discount > 0 && (
                <div>
                  <span>
                    {t("Diskon", "Discount")} ({code})
                    <button
                      type="button"
                      className="inline-remove-code"
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
                <span>{t("Ongkir", "Shipping")}</span>
                <span>
                  {quote.shipping
                    ? money(quote.shipping, "IDR")
                    : t("Gratis", "Complimentary")}
                </span>
              </div>
              <div className="grand-total">
                <b>Total IDR</b>
                <b>{money(quote.total, "IDR")}</b>
              </div>
            </div>
          )}
          {effectiveError && (
            <p className="error-text" role="alert">
              {effectiveError}
            </p>
          )}
          <button
            className="button dark full checkout-submit-btn"
            disabled={!quote || busy}
            type="submit"
          >
            <ShieldCheck size={16} />
            {busy
              ? t("Membuka Midtrans…", "Opening Midtrans…")
              : t("Lanjut ke Midtrans", "Continue to Midtrans")}
            {!busy && <ArrowRight size={16} />}
          </button>
        </aside>
      </form>
    </div>
  );
}
