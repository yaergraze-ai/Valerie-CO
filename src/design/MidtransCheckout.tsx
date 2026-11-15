import { useEffect, useRef, useState } from "react";
import { ArrowRight, ShieldCheck } from "lucide-react";
import {
  useStore,
  isStaleShippingError,
  type Address,
  type Order,
  type ShippingRateOption,
} from "./store";
import { api } from "./backend";
import {
  AddressFields,
  CheckoutVoucherBar,
  InlinePaymentAndReceipt,
  PAYMENT_CHANNELS,
  PaymentChannelOptions,
} from "./Shopping";
import { MidtransGatewayBadge } from "./PaymentLogos";
import { TurnstileWidget } from "./TurnstileWidget";
import { CourierSubPage, CourierSummaryCard } from "./CourierPicker";
import { AddressSubPage, AddressSummaryCard } from "./CheckoutSubpages";
import {
  buildAddressFromDraft,
  formatShortAddress,
  isAddressComplete,
  useShippingRates,
  type CheckoutAddressDraft,
} from "./useShippingRates";

type Quote = {
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
};

export function MidtransCheckout({ onDone }: { onDone: () => void }) {
  const { db, member, saveMember, t, money, checkout, refresh, notify, activePromotions } =
    useStore();
  const [promoInput, setPromoInput] = useState("");
  const [code, setCode] = useState("");
  const [selectedChannel, setSelectedChannel] = useState<string>("qris");
  const [checkingRemote, setCheckingRemote] = useState(false);
  const [checkoutView, setCheckoutView] = useState<"main" | "address" | "courier">("main");
  const [addressId, setAddressId] = useState(
    () => member?.addresses[0]?.id || "new",
  );
  const [selectedShipping, setSelectedShipping] =
    useState<ShippingRateOption | null>(null);
  const [ratesLoading, setRatesLoading] = useState(false);
  const [shippingRefreshKey, setShippingRefreshKey] = useState(0);
  const [draftAddress, setDraftAddress] = useState<CheckoutAddressDraft>(() => ({
    label: "Utama",
    name: member?.name || "",
    phone: member?.phone || "",
    street: "",
    city: "",
    province: "",
    postal: "",
    areaId: "",
    areaName: "",
  }));
  const [addressNotice, setAddressNotice] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteError, setQuoteError] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [order, setOrder] = useState<Order | null>(null);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileResetSignal, setTurnstileResetSignal] = useState(0);
  const key = useRef(crypto.randomUUID());
  const submitting = useRef(false);
  const shellRef = useRef<HTMLDivElement>(null);
  const savedAddress = member?.addresses.find((a) => a.id === addressId);
  const activeDestination: Partial<Address> =
    addressId !== "new" && savedAddress ? savedAddress : draftAddress;
  const totalItems = db.bag.reduce((sum, line) => sum + line.quantity, 0);
  const turnstileSiteKey = db.paymentConfig?.turnstileSiteKey || "";
  const selectedChannelInfo =
    PAYMENT_CHANNELS.find((c) => c.id === selectedChannel) || PAYMENT_CHANNELS[0];

  const switchView = (next: "main" | "address" | "courier") => {
    setCheckoutView(next);
    requestAnimationFrame(() => {
      shellRef.current?.closest(".modal-inner")?.scrollTo({ top: 0, behavior: "auto" });
    });
  };

  const rates = useShippingRates({
    enabled: !order,
    lines: db.bag,
    destination: activeDestination,
    selected: selectedShipping,
    onSelect: setSelectedShipping,
    refreshKey: shippingRefreshKey,
    onRatesLoading: setRatesLoading,
  });
  const isRatesBusy = rates.loading || ratesLoading;

  const autoRefreshCountRef = useRef(0);
  const destPostal = (activeDestination.postal || "").trim();
  const rateToken = selectedShipping?.rateToken;

  const linesKey = db.bag
    .map((l) => `${l.productId}:${l.size}:${l.color}:${l.quantity}`)
    .sort()
    .join("|");
  const prevQuoteInputRef = useRef(`${linesKey}|${destPostal}`);
  useEffect(() => {
    const currentInput = `${linesKey}|${destPostal}`;
    if (currentInput !== prevQuoteInputRef.current) {
      prevQuoteInputRef.current = currentInput;
      autoRefreshCountRef.current = 0;
    }
  }, [linesKey, destPostal]);

  useEffect(() => {
    if (order) return;
    if (isRatesBusy || !selectedShipping?.rateToken) return;
    if (!db.bag.length) {
      return;
    }
    const lifecycle = new AbortController();
    const payload = {
      lines: db.bag,
      code,
      shippingOption: rateToken ? { rateToken } : undefined,
      destination: { postal: destPostal },
    };
    void api("payments/quote", payload)
      .then((q) => {
        if (!lifecycle.signal.aborted) {
          autoRefreshCountRef.current = 0;
          setQuote(q as Quote);
          setQuoteError("");
        }
      })
      .catch((e) => {
        if (!lifecycle.signal.aborted) {
          setQuote(null);
          const msg = (e as Error).message || "";
          setQuoteError(msg);
          if (isStaleShippingError(e)) {
            setSelectedShipping(null);
            if (autoRefreshCountRef.current < 1) {
              autoRefreshCountRef.current += 1;
              setShippingRefreshKey((k) => k + 1);
            }
          }
        }
      });
    return () => lifecycle.abort();
  }, [
    db.bag,
    code,
    rateToken,
    destPostal,
    order,
    isRatesBusy,
    selectedShipping,
  ]);

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

  const claimedSet = new Set(member?.claimedCoupons || []);
  const claimedPromos = activePromotions.filter((c) => claimedSet.has(c.code));
  const hasUnclaimedPromos = activePromotions.some((c) => !claimedSet.has(c.code));

  const applyPromoCode = (target?: string) => {
    const nextCode = (target ?? promoInput).trim().toUpperCase();
    if (!nextCode) {
      setCode("");
      return;
    }
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
    setPromoInput(nextCode);
    setCode(nextCode);
  };

  const activeError = error || quoteError;
  const destinationLabel =
    formatShortAddress(activeDestination) ||
    [activeDestination.city, activeDestination.postal]
      .filter(Boolean)
      .join(" ");

  const handleApplyNewAddress = (
    nextDraft: CheckoutAddressDraft,
    saveToAccount: boolean,
  ) => {
    setAddressNotice("");
    if (saveToAccount && member) {
      const saved = buildAddressFromDraft(
        nextDraft,
        member.name,
        member.phone,
      );
      saveMember({ ...member, addresses: [...member.addresses, saved] }, true);
      setAddressId(saved.id);
    } else {
      setDraftAddress(nextDraft);
      setAddressId("new");
    }
    switchView("main");
  };

  return (
    <div ref={shellRef} className="checkout-view-host">
      {checkoutView === "address" ? (
        <AddressSubPage
          savedAddresses={member?.addresses || []}
          selectedAddressId={addressId}
          draftAddress={draftAddress}
          defaultName={member?.name || ""}
          defaultPhone={member?.phone || ""}
          validationNotice={addressNotice}
          canSaveToAccount={Boolean(member)}
          onSelectSaved={(id) => {
            setAddressNotice("");
            setAddressId(id);
            switchView("main");
          }}
          onApplyNewAddress={handleApplyNewAddress}
          onBack={() => switchView("main")}
          renderAddressFields={(initial, fieldKey) => (
            <AddressFields
              key={fieldKey}
              name={initial.name || member?.name}
              phone={initial.phone || member?.phone}
              initialAddress={initial}
            />
          )}
        />
      ) : checkoutView === "courier" ? (
        <CourierSubPage
          rates={rates}
          selected={selectedShipping}
          destinationLabel={destinationLabel}
          onSelect={setSelectedShipping}
          onConfirm={() => switchView("main")}
          onBack={() => switchView("main")}
          onEditAddress={() => switchView("address")}
        />
      ) : (
        <form
          className="checkout-grid"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!isAddressComplete(activeDestination)) {
              setAddressNotice(
                t(
                  "Lengkapi alamat pengiriman terlebih dahulu.",
                  "Please complete your delivery address first.",
                ),
              );
              switchView("address");
              return;
            }
            if (!quote || quoteError || submitting.current || isRatesBusy || !selectedShipping) return;
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
              const address: Address =
                savedAddress ||
                buildAddressFromDraft(
                  draftAddress,
                  member?.name || "",
                  member?.phone || "",
                );
              setOrder(
                await checkout(
                  address,
                  code,
                  false,
                  key.current,
                  quote.total,
                  selectedChannel,
                  turnstileToken || undefined,
                  selectedShipping ? { rateToken: selectedShipping.rateToken } : undefined,
                ),
              );
            } catch (err) {
              const msg = (err as Error).message || "Checkout failed";
              setError(msg);
              if (isStaleShippingError(err)) {
                setSelectedShipping(null);
                setShippingRefreshKey((k) => k + 1);
                notify(
                  "Tarif kurir telah kedaluwarsa. Memuat ulang tarif pengiriman...",
                  "Shipping rates expired. Refreshing shipping rates...",
                );
              }
              setTurnstileToken("");
              setTurnstileResetSignal((n) => n + 1);
            } finally {
              setBusy(false);
              submitting.current = false;
            }
          }}
        >
          <div className="checkout-main">
            <section className="checkout-step-card checkout-step-card--compact">
              <div className="checkout-step-head">
                <span className="checkout-step-num">01</span>
                <div>
                  <h3>{t("Alamat Pengiriman", "Delivery Address")}</h3>
                </div>
              </div>
              <AddressSummaryCard
                address={activeDestination}
                isSaved={Boolean(savedAddress)}
                onOpen={() => {
                  setAddressNotice("");
                  switchView("address");
                }}
                notice={addressNotice}
              />
            </section>

            <section className="checkout-step-card checkout-step-card--compact">
              <div className="checkout-step-head">
                <span className="checkout-step-num">02</span>
                <div>
                  <h3>{t("Opsi Pengiriman", "Shipping Option")}</h3>
                </div>
              </div>
              <CourierSummaryCard
                rates={rates}
                selected={selectedShipping}
                onOpen={() => switchView("courier")}
              />
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
            onClick={() => applyPromoCode()}
          >
            {t("Pakai", "Apply")}
          </button>
        </div>
        <CheckoutVoucherBar
          claimedPromos={claimedPromos}
          activeCode={code}
          hasUnclaimed={hasUnclaimedPromos}
          onSelect={(c) => applyPromoCode(c)}
        />
        {quote ? (
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
                {isRatesBusy || !selectedShipping ? (
                  <small className="checkout-summary-courier-name">
                    {t("Menghitung ongkos kirim…", "Calculating shipping fee…")}
                  </small>
                ) : (
                  <>
                    {selectedShipping && (
                      <small className="checkout-summary-courier-name">
                        {selectedShipping.courierName} · {selectedShipping.serviceName}{" "}
                      </small>
                    )}
                    {quote.shipping === 0
                      ? t("Gratis", "Free")
                      : money(quote.shipping, "IDR")}
                  </>
                )}
              </span>
            </div>
            <div>
              <span>{t("Metode Dipilih", "Selected Method")}</span>
              <span>{selectedChannelInfo.badge}</span>
            </div>
            <div className="grand-total">
              <b>{t("Total Pembayaran", "Total Payment")}</b>
              <b>
                {isRatesBusy || !selectedShipping
                  ? money(quote.subtotal - (quote.discount || 0), "IDR")
                  : money(quote.total, "IDR")}
              </b>
            </div>
          </div>
        ) : isRatesBusy || !selectedShipping ? (
          <div className="order-totals">
            <div>
              <span>Subtotal</span>
              <span>
                {money(
                  db.bag.reduce((sum, line) => {
                    const p = db.products.find((prod) => prod.id === line.productId);
                    return sum + (p?.priceIdr || 0) * line.quantity;
                  }, 0),
                  "IDR",
                )}
              </span>
            </div>
            <div>
              <span>{t("Ongkos Kirim", "Shipping Fee")}</span>
              <span>
                <small className="checkout-summary-courier-name">
                  {t("Menghitung ongkos kirim…", "Calculating shipping fee…")}
                </small>
              </span>
            </div>
            <div>
              <span>{t("Metode Dipilih", "Selected Method")}</span>
              <span>{selectedChannelInfo.badge}</span>
            </div>
          </div>
        ) : null}
        {turnstileSiteKey && (
          <TurnstileWidget
            siteKey={turnstileSiteKey}
            resetSignal={turnstileResetSignal}
            onToken={setTurnstileToken}
            onExpired={() => setTurnstileToken("")}
          />
        )}
        {activeError && (
          <div className="error-text" role="alert">
            <span>{activeError}</span>
            {isStaleShippingError(activeError) && (
              <button
                type="button"
                className="button ghost small"
                style={{ marginLeft: 8, display: "inline-flex", verticalAlign: "middle" }}
                onClick={() => {
                  setSelectedShipping(null);
                  autoRefreshCountRef.current = 0;
                  setShippingRefreshKey((k) => k + 1);
                }}
              >
                {t("Muat ulang kurir", "Reload couriers")}
              </button>
            )}
          </div>
        )}
        <button
          className="button dark full checkout-submit-btn"
          disabled={!quote || Boolean(quoteError) || busy || isRatesBusy || !selectedShipping}
          type="submit"
        >
          <span>
            {isRatesBusy
              ? t("Memuat tarif kurir…", "Loading courier rates…")
              : !selectedShipping
                ? t("Pilih kurir pengiriman", "Select courier option")
                : busy
                  ? t("Membuat Pesanan…", "Placing Order…")
                  : t("Buat Pesanan & Bayar", "Place Order & Pay")}
          </span>
          {!busy && !isRatesBusy && selectedShipping && <ArrowRight size={16} />}
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
      )}
    </div>
  );
}
