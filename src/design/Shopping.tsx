import { MidtransCheckout } from "./MidtransCheckout";
import { useState, useRef } from "react";
import confetti from "canvas-confetti";
import {
  ArrowRight,
  Check,
  LockKeyhole,
  Minus,
  Plus,
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
    serverMode,
  } = useStore();
  const rates = SHIPPING_RATES[currency];
  const [code, setCode] = useState("");
  const [applied, setApplied] = useState("");
  const [express, setExpress] = useState(false);
  const [finished, setFinished] = useState<Order | null>(null);
  const [addressId, setAddressId] = useState("new");
  const busy = useRef(false);
  const checkoutKey = useRef(crypto.randomUUID());
  const coupon = db.coupons.find((c) => c.code === applied && c.active);
  const sum = totals(db.bag, db.products, coupon, express, currency);
  if (finished)
    return (
      <div className="checkout-success">
        <div className="success-mark">
          <Check size={32} />
        </div>
        <span className="eyebrow">THANK YOU FOR YOUR ORDER</span>
        <h2>
          {t("Langkah berikutnya dimulai.", "Your next chapter starts here.")}
        </h2>
        <p>
          {t(
            "Pesanan Anda telah dikonfirmasi dan sedang diproses oleh Valerie & CO Atelier.",
            "Your order has been confirmed and is being prepared by Valerie & CO Atelier.",
          )}
        </p>
        <strong>
          {finished.id} ·{" "}
          {finished.receiptNumber || `VCO-INV-${finished.id.replace(/^SOL-/, "").slice(0, 8)}`}
        </strong>
        <p>
          {money(finished.total, finished.currency || "USD")} ·{" "}
          {t(
            "Struk resmi & riwayat pembelian tercatat di akun Anda",
            "Official receipt & purchase trail recorded in your account",
          )}
        </p>
        <button className="button dark" onClick={onDone}>
          {t("Lihat pesanan saya", "View my orders")}
          <ArrowRight size={16} />
        </button>
      </div>
    );
  if (!member) return <MemberEntry onDone={() => {}} />;
  return (
    <form
      className="checkout-grid"
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy.current) return;
        busy.current = true;
        try {
          const f = new FormData(e.currentTarget);
          const saved = member.addresses.find((a) => a.id === addressId);
          const address: Address = saved || {
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
          try {
            confetti({
              particleCount: 55,
              spread: 65,
              origin: { y: 0.65 },
            });
          } catch {}
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
      <div>
        <h3>01 / {t("Alamat pengiriman", "Delivery address")}</h3>
        {member.addresses.length > 0 && (
          <label className="field">
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
        {addressId === "new" && (
          <AddressFields name={member.name} phone={member.phone} />
        )}
        <h3>02 / {t("Metode pengiriman", "Delivery method")}</h3>
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
        <h3>03 / {t("Pembayaran", "Payment")}</h3>
        <div className="notice">
          <LockKeyhole size={18} />
          <p>
            {serverMode
              ? t(
                  "Checkout terenkripsi & stok langsung dialokasikan untuk pesanan Anda.",
                  "Encrypted checkout with instant stock allocation for your order.",
                )
              : t(
                  "Pemesanan langsung Valerie & CO Atelier. Alokasi stok tercatat otomatis dan status pengiriman terpantau di akun Anda.",
                  "Valerie & CO Atelier direct checkout. Stock allocation is recorded immediately and shipment updates appear in your account.",
                )}
          </p>
        </div>
      </div>
      <aside className="checkout-summary">
        <h3>{t("Ringkasan pesanan", "Your selection")}</h3>
        <div className="checkout-items-scroll">
        {db.bag.map((l) => {
          const p = db.products.find((p) => p.id === l.productId)!;
          return (
            <div className="checkout-item" key={lineKey(l)}>
              <img src={p.images[0]} alt="" />
              <span>
                <b>{p.name}</b>
                <small>
                  EU {l.size} · {l.quantity} × {priceText(p)}
                </small>
              </span>
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
          />
          <button
            type="button"
            onClick={async () => {
              try {
                const found = await applyCoupon(code.trim().toUpperCase());
                setApplied(found.code);
                notify("Kode promo diterapkan", "Promo code applied");
              } catch (e) {
                notify((e as Error).message, (e as Error).message);
              }
            }}
          >
            {t("Pakai", "Apply")}
          </button>
        </div>
        <small>
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
          {t(
            "Saya menyetujui rincian pesanan dan ketentuan pengiriman Valerie & CO.",
            "I confirm the order details and Valerie & CO delivery terms.",
          )}
        </label>
        <button
          className="button dark full"
          type="submit"
          disabled={!db.bag.length}
        >
          {t("Konfirmasi pesanan", "Confirm order")}
          <ArrowRight size={16} />
        </button>
      </aside>
    </form>
  );
}
export function AddressFields({
  name = "",
  phone = "",
  address,
}: {
  name?: string;
  phone?: string;
  address?: Address;
}) {
  const { t } = useStore();
  return (
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
          required
          minLength={5}
          defaultValue={address?.street}
          autoComplete="street-address"
        />
      </label>
      <label>
        {t("Kota", "City")}
        <input
          name="city"
          required
          defaultValue={address?.city}
          autoComplete="address-level2"
        />
      </label>
      <label>
        {t("Kode pos", "Postal code")}
        <input
          name="postal"
          required
          defaultValue={address?.postal}
          autoComplete="postal-code"
        />
      </label>
    </div>
  );
}
