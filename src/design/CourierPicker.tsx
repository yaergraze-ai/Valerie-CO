import {
  AlertCircle,
  ArrowLeft,
  Check,
  ChevronRight,
  Info,
  MapPin,
  RefreshCw,
  Truck,
} from "lucide-react";
import { useStore, type ShippingRateOption } from "./store";
import { getShippingTierMeta, type ShippingRatesState } from "./useShippingRates";

export type { ShippingRateOption };

export type CourierSummaryCardProps = {
  rates: ShippingRatesState;
  selected: ShippingRateOption | null;
  onOpen: () => void;
};

export function CourierSummaryCard({
  rates,
  selected,
  onOpen,
}: CourierSummaryCardProps) {
  const { t, money } = useStore();
  const { ratesData, options, loading, error, originText, weightKg, handleRetry } =
    rates;

  const selectedTier = selected
    ? getShippingTierMeta(selected.serviceType)
    : null;
  const totalCount = options.length;

  return (
    <div className="shopee-summary-stack">
      <div className="shopee-courier-meta-strip">
        <span className="shopee-courier-origin-chip">
          <Truck size={12} aria-hidden="true" />
          <span>
            {t("Dari", "From")} <b>{originText}</b> · {weightKg} kg
            {ratesData?.zoneLabel ? ` · ${ratesData.zoneLabel}` : ""}
          </span>
        </span>
        <span
          className={`courier-source-pill ${ratesData?.source === "biteship" ? "live" : "fallback"}`}
        >
          {ratesData?.source === "biteship"
            ? t("Tarif Live Biteship", "Live Biteship")
            : t("Estimasi Zona", "Regional Estimate")}
        </span>
      </div>

      {loading && !ratesData ? (
        <div className="shopee-courier-skeleton" aria-busy="true">
          <div className="courier-skeleton-row" />
        </div>
      ) : (
        <button
          type="button"
          className={`shopee-summary-card shopee-courier-summary ${!selected ? "is-empty" : ""}`}
          onClick={onOpen}
          aria-label={t(
            "Pilih atau ubah opsi pengiriman kurir",
            "Choose or change courier shipping option",
          )}
        >
          <div className="shopee-summary-icon-badge" aria-hidden="true">
            <Truck size={16} />
          </div>
          <div className="shopee-summary-body">
            {selected && selectedTier ? (
              <>
                <div className="shopee-summary-top-row">
                  <span className="shopee-tier-inline-tag">
                    {t(selectedTier.badgeId, selectedTier.badgeEn)}
                  </span>
                  <span className="courier-code-pill">
                    {selected.courierName}
                  </span>
                  <b className="courier-service-name">{selected.serviceName}</b>
                </div>
                <div className="shopee-summary-sub-row">
                  <span>
                    {selected.duration
                      ? t(
                          `Estimasi tiba: ${selected.duration}`,
                          `ETD: ${selected.duration}`,
                        )
                      : t("Ketuk untuk melihat semua layanan", "Tap to browse services")}
                    {totalCount > 1
                      ? ` · ${totalCount} ${t("opsi kurir", "courier options")}`
                      : ""}
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="shopee-summary-top-row">
                  <b className="shopee-summary-title">
                    {loading
                      ? t("Menghitung tarif kurir terbaik…", "Calculating courier rates…")
                      : t("Pilih Kurir Pengiriman", "Select Shipping Courier")}
                  </b>
                </div>
                <div className="shopee-summary-sub-row">
                  <span>
                    {totalCount > 0
                      ? t(
                          `${totalCount} layanan Reguler, Hemat, Express & Instant tersedia`,
                          `${totalCount} Regular, Economy, Express & Instant options available`,
                        )
                      : t(
                          "Ketuk untuk memilih kurir & estimasi pengiriman",
                          "Tap to choose courier & delivery speed",
                        )}
                  </span>
                </div>
              </>
            )}
          </div>
          <div className="shopee-summary-trailing">
            {selected && (
              <div className="courier-option-price-col">
                {selected.freeApplied ? (
                  <>
                    <span className="courier-price-old">
                      {money(selected.rawPrice, "IDR")}
                    </span>
                    <span className="courier-free-pill">
                      {t("Gratis", "Free")}
                    </span>
                  </>
                ) : (
                  <span className="courier-option-price">
                    {money(selected.price, "IDR")}
                  </span>
                )}
              </div>
            )}
            <span className="shopee-summary-action-pill">
              <span>{selected ? t("Ubah", "Change") : t("Pilih", "Select")}</span>
              <ChevronRight size={14} aria-hidden="true" />
            </span>
          </div>
        </button>
      )}

      {error && !loading && (
        <div className="courier-picker-error" role="alert">
          <div className="courier-picker-error-msg">
            <AlertCircle size={14} aria-hidden="true" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            className="button ghost small courier-picker-retry-btn"
            onClick={handleRetry}
          >
            <RefreshCw size={12} aria-hidden="true" />
            {t("Coba lagi", "Retry")}
          </button>
        </div>
      )}
    </div>
  );
}

export type CourierSubPageProps = {
  rates: ShippingRatesState;
  selected: ShippingRateOption | null;
  destinationLabel: string;
  onSelect: (opt: ShippingRateOption) => void;
  onConfirm: () => void;
  onBack: () => void;
  onEditAddress: () => void;
};

export function CourierSubPage({
  rates,
  selected,
  destinationLabel,
  onSelect,
  onConfirm,
  onBack,
  onEditAddress,
}: CourierSubPageProps) {
  const { t, money } = useStore();
  const {
    ratesData,
    tierGroups,
    loading,
    error,
    isPostalShort,
    originText,
    weightKg,
    handleRetry,
  } = rates;

  const hasInstant = tierGroups.some((g) => g.meta.key === "instant");

  return (
    <div className="checkout-grid checkout-subpage-grid shopee-subpage">
      <div className="shopee-subpage-topbar">
        <button type="button" className="shopee-back-btn" onClick={onBack}>
          <ArrowLeft size={16} aria-hidden="true" />
          <span>{t("Kembali", "Back")}</span>
        </button>
        <div className="shopee-subpage-title">
          <h3>{t("Opsi Pengiriman", "Shipping Options")}</h3>
          <small>
            {t(
              "Pilih kategori layanan & kurir yang paling sesuai",
              "Choose your preferred service tier and courier",
            )}
          </small>
        </div>
        <span
          className={`courier-source-pill ${ratesData?.source === "biteship" ? "live" : "fallback"}`}
        >
          {ratesData?.source === "biteship"
            ? t("Tarif Live Biteship", "Live Biteship Rates")
            : t("Estimasi Zona", "Regional Zone Estimate")}
        </span>
      </div>

      <div className="shopee-courier-route-banner">
        <div className="shopee-route-line">
          <Truck size={14} aria-hidden="true" />
          <span>
            {t("Dikirim dari", "Origin")} <b>{originText}</b> · {weightKg} kg
            {ratesData?.zoneLabel ? ` · ${ratesData.zoneLabel}` : ""}
          </span>
        </div>
        <div className="shopee-route-dest">
          <MapPin size={13} aria-hidden="true" />
          <span className="shopee-route-dest-text">
            {t("Tujuan:", "Destination:")}{" "}
            <b>{destinationLabel || t("Belum diatur", "Not set yet")}</b>
          </span>
          <button
            type="button"
            className="shopee-inline-link-btn"
            onClick={onEditAddress}
          >
            {t("Ubah alamat", "Change address")}
          </button>
        </div>
      </div>

      {isPostalShort && (
        <div className="courier-picker-notice" role="status">
          <Info size={13} aria-hidden="true" />
          <span>
            {t(
              "Masukkan 5 digit kode pos pada alamat tujuan agar tarif zona paling akurat",
              "Enter a 5-digit postal code in your address for the most accurate rates",
            )}
          </span>
        </div>
      )}

      {error && !loading && (
        <div className="courier-picker-error" role="alert">
          <div className="courier-picker-error-msg">
            <AlertCircle size={14} aria-hidden="true" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            className="button ghost small courier-picker-retry-btn"
            onClick={handleRetry}
          >
            <RefreshCw size={12} aria-hidden="true" />
            {t("Coba lagi", "Retry")}
          </button>
        </div>
      )}

      {loading && !ratesData && (
        <div className="courier-picker-skeleton" aria-busy="true">
          <div className="courier-skeleton-row" />
          <div className="courier-skeleton-row" />
          <div className="courier-skeleton-row" />
        </div>
      )}

      {tierGroups.length > 0 && (
        <div
          className="shopee-tier-stack"
          role="radiogroup"
          aria-label={t("Pilihan Kategori & Kurir Pengiriman", "Shipping Tiers & Couriers")}
        >
          {tierGroups.map((group) => (
            <section className="shopee-tier-card" key={group.meta.key}>
              <div className="shopee-tier-header">
                <div className="shopee-tier-title-wrap">
                  <div className="shopee-tier-title-row">
                    <h4>{t(group.meta.titleId, group.meta.titleEn)}</h4>
                    {group.meta.key === "standard" && (
                      <span className="shopee-tier-pop-pill">
                        {t("Populer", "Popular")}
                      </span>
                    )}
                    <span className="shopee-tier-count">
                      {group.options.length} {t("kurir", "couriers")}
                    </span>
                  </div>
                  <p>{t(group.meta.descId, group.meta.descEn)}</p>
                </div>
                <div className="shopee-tier-min-price">
                  {group.hasFreeOption ? (
                    <span className="courier-free-pill">
                      {t("Gratis", "Free")}
                    </span>
                  ) : (
                    <span>
                      {t("Mulai", "From")}{" "}
                      <b>{money(group.lowestEffectivePrice, "IDR")}</b>
                    </span>
                  )}
                </div>
              </div>

              <div className="courier-options-list">
                {group.options.map((opt) => {
                  const isSelected =
                    selected?.courierCode === opt.courierCode &&
                    selected?.serviceCode === opt.serviceCode;

                  return (
                    <label
                      key={`${opt.courierCode}:${opt.serviceCode}`}
                      className={`delivery-option courier-option-card ${isSelected ? "selected" : ""}`}
                      role="radio"
                      aria-checked={isSelected}
                    >
                      <input
                        type="radio"
                        name="courierOption"
                        checked={isSelected}
                        onChange={() => onSelect(opt)}
                      />
                      <div className="courier-option-info">
                        <div className="courier-option-title-row">
                          <span className="courier-code-pill">
                            {opt.courierName}
                          </span>
                          <b className="courier-service-name">
                            {opt.serviceName}
                          </b>
                        </div>
                        {opt.duration && (
                          <small className="courier-option-duration">
                            {t(
                              `Estimasi tiba: ${opt.duration}`,
                              `ETD: ${opt.duration}`,
                            )}
                          </small>
                        )}
                      </div>
                      <div className="courier-option-price-col">
                        {opt.freeApplied ? (
                          <>
                            <span className="courier-price-old">
                              {money(opt.rawPrice, "IDR")}
                            </span>
                            <span className="courier-free-pill">
                              {t("Gratis", "Free")}
                            </span>
                          </>
                        ) : (
                          <span className="courier-option-price">
                            {money(opt.price, "IDR")}
                          </span>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {!hasInstant && ratesData && (
        <p className="shopee-instant-hint">
          <Info size={12} aria-hidden="true" />
          <span>
            {t(
              "GoSend & Grab Instant/Same Day muncul otomatis bila tujuan berada di area Cirebon dengan titik pin/GPS peta.",
              "GoSend & Grab Instant/Same Day appear automatically for Cirebon addresses with pinned GPS/map coordinates.",
            )}
          </span>
        </p>
      )}

      <div className="shopee-subpage-footer">
        <div className="shopee-subpage-footer-info">
          {selected ? (
            <>
              <small>{t("Kurir dipilih:", "Selected courier:")}</small>
              <b>
                {selected.courierName} · {selected.serviceName}{" "}
                <span className="shopee-footer-price">
                  —{" "}
                  {selected.freeApplied
                    ? t("Gratis", "Free")
                    : money(selected.price, "IDR")}
                </span>
              </b>
            </>
          ) : (
            <small>
              {loading
                ? t("Memuat daftar kurir…", "Loading couriers…")
                : t("Pilih salah satu kurir di atas", "Select a courier above")}
            </small>
          )}
        </div>
        <button
          type="button"
          className="button dark shopee-confirm-btn"
          disabled={!selected || loading}
          onClick={onConfirm}
        >
          <Check size={15} aria-hidden="true" />
          <span>{t("Konfirmasi", "Confirm")}</span>
        </button>
      </div>
    </div>
  );
}
