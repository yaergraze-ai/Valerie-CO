import { useEffect, useRef, useState } from "react";
import { useStore, type Address, type Order } from "./store";
import { api } from "./backend";
import { AddressFields } from "./Shopping";
type Quote = {
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
};
export function MidtransCheckout({ onDone }: { onDone: () => void }) {
  const { db, member, t, money, checkout } = useStore();
  const [express, setExpress] = useState(false);
  const [code, setCode] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [order, setOrder] = useState<Order | null>(null);
  const key = useRef(crypto.randomUUID());
  const submitting = useRef(false);
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
  if (order)
    return (
      <div className="checkout-success">
        <span className="eyebrow">MIDTRANS PAYMENT</span>
        <h2>
          {t("Pesanan menunggu pembayaran.", "Your order awaits payment.")}
        </h2>
        <p>
          {order.id} ·{" "}
          <b>{order.receiptNumber || `VCO-INV-${order.id.slice(-8).toUpperCase()}`}</b>
        </p>
        <strong>{money(order.total, "IDR")}</strong>
        <p>
          {t(
            "Status lunas diperbarui setelah konfirmasi server Midtrans. Struk pembelian & pengajuan refund tersedia di menu Pesanan pada dashboard member.",
            "Payment is confirmed by the Midtrans server. Your purchase receipt & refund request options are available under Orders in your member dashboard.",
          )}
        </p>
        {order.payment?.url && (
          <a
            className="button dark"
            href={order.payment.url}
            target="_blank"
            rel="noreferrer"
          >
            {t("Buka pembayaran Midtrans", "Open Midtrans payment")}
          </a>
        )}
        <button className="button" onClick={onDone}>
          {t("Lihat pesanan", "View orders")}
        </button>
      </div>
    );
  return (
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
          const address: Address = {
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
      <div>
        <h3>01 / {t("Alamat pengiriman", "Delivery address")}</h3>
        <AddressFields name={member?.name} phone={member?.phone} />
        <h3>02 / {t("Pengiriman", "Shipping")}</h3>
        <label htmlFor="midtrans-service">
          {t("Layanan", "Service")}
          <select
            id="midtrans-service"
            name="service"
            value={express ? "express" : "standard"}
            onChange={(e) => setExpress(e.target.value === "express")}
          >
            <option value="standard">{t("Standar", "Standard")}</option>
            <option value="express">{t("Ekspres", "Express")}</option>
          </select>
        </label>
        <h3>03 / Midtrans · QRIS / Virtual Account</h3>
        <p className="notice">
          {t(
            "Pembayaran terenkripsi dalam Rupiah (IDR) melalui halaman pembayaran resmi Midtrans.",
            "Encrypted Rupiah (IDR) checkout via Midtrans's official payment gateway.",
          )}
        </p>
      </div>
      <aside className="checkout-summary">
        <h3>{t("Ringkasan IDR", "IDR summary")}</h3>
        <div className="checkout-items-scroll">
        {db.bag.map((l, i) => {
          const p = db.products.find((p) => p.id === l.productId);
          return (
            <div className="checkout-item" key={i}>
              <img src={p?.images[0]} alt="" />
              <span>
                {p?.name}
                <small>
                  EU {l.size} · {l.quantity} ×{" "}
                  {p?.priceIdr
                    ? money(p.priceIdr, "IDR")
                    : t("Harga IDR belum diatur", "IDR price not set")}
                </small>
              </span>
            </div>
          );
        })}
        </div>
        <label htmlFor="midtrans-coupon">
          {t("Kode promo", "Promo code")}
          <input
            id="midtrans-coupon"
            name="coupon"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().trim())}
          />
        </label>
        {quote && (
          <div className="order-totals">
            <div>
              <span>Subtotal</span>
              <b>{money(quote.subtotal, "IDR")}</b>
            </div>
            <div>
              <span>{t("Diskon", "Discount")}</span>
              <b>−{money(quote.discount, "IDR")}</b>
            </div>
            <div>
              <span>{t("Ongkir", "Shipping")}</span>
              <b>{quote.shipping ? money(quote.shipping, "IDR") : t("Gratis", "Complimentary")}</b>
            </div>
            <div className="grand-total">
              <span>Total IDR</span>
              <b>{money(quote.total, "IDR")}</b>
            </div>
          </div>
        )}
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
        <button
          className="button dark full"
          disabled={!quote || busy}
          type="submit"
        >
          {busy
            ? t("Menyiapkan pembayaran…", "Preparing payment…")
            : t("Lanjut ke Midtrans", "Continue to Midtrans")}
        </button>
      </aside>
    </form>
  );
}
