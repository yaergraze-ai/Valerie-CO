import { useEffect, useRef, useState, useCallback } from "react";
import { Truck, Info, AlertCircle, RefreshCw } from "lucide-react";
import { api } from "./backend";
import { useStore, type Address, type ShippingRateOption } from "./store";
import type { BagLine } from "./commerce";

export type { ShippingRateOption };

export type CourierPickerProps = {
  lines: BagLine[];
  destination: Partial<Address>;
  selected: ShippingRateOption | null;
  onSelect: (opt: ShippingRateOption | null) => void;
  refreshKey?: number;
  onRatesLoading?: (loading: boolean) => void;
};

type RatesApiResponse = {
  source: "biteship" | "zone_fallback";
  zoneLabel: string;
  origin: {
    name?: string;
    city?: string;
    province?: string;
    postal?: string;
  };
  weightGrams: number;
  freeAbove: number;
  options: ShippingRateOption[];
};

export function CourierOptionPicker({
  lines,
  destination,
  selected,
  onSelect,
  refreshKey = 0,
  onRatesLoading,
}: CourierPickerProps) {
  const { t, money } = useStore();
  const [ratesData, setRatesData] = useState<RatesApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [retryTrigger, setRetryTrigger] = useState(0);
  const [fetchedSignature, setFetchedSignature] = useState("");

  const requestIdRef = useRef(0);
  const linesRef = useRef(lines);
  const selectedRef = useRef(selected);
  const onSelectRef = useRef(onSelect);
  const onRatesLoadingRef = useRef(onRatesLoading);
  const hasLoadedOnceRef = useRef(false);
  const prevRefreshKeyRef = useRef(refreshKey);
  const prevRetryTriggerRef = useRef(retryTrigger);
  const fetchedSignatureRef = useRef("");

  useEffect(() => {
    linesRef.current = lines;
    selectedRef.current = selected;
    onSelectRef.current = onSelect;
    onRatesLoadingRef.current = onRatesLoading;
  });

  const linesKey = lines
    .map((l) => `${l.productId}:${l.size}:${l.color}:${l.quantity}`)
    .sort()
    .join("|");

  const destPostal = destination.postal || "";
  const destAreaId = destination.areaId || "";
  const destProvince = destination.province || "";
  const destCity = destination.city || "";
  const destLat = destination.lat;
  const destLon = destination.lon;

  const requestSignature = `${linesKey}|${destPostal}|${destAreaId}|${destCity}|${destProvince}|${destLat ?? ""}|${destLon ?? ""}`;

  useEffect(() => {
    const reqId = ++requestIdRef.current;

    if (!linesKey) {
      onRatesLoadingRef.current?.(false);
      if (selectedRef.current !== null) {
        onSelectRef.current(null);
      }
      return;
    }

    const isRefresh = refreshKey !== prevRefreshKeyRef.current;
    const isRetry = retryTrigger !== prevRetryTriggerRef.current;
    const isInitial = !hasLoadedOnceRef.current;
    const isSignatureChanged = requestSignature !== fetchedSignatureRef.current;

    prevRefreshKeyRef.current = refreshKey;
    prevRetryTriggerRef.current = retryTrigger;

    if (isSignatureChanged || isRefresh || isRetry) {
      onRatesLoadingRef.current?.(true);
      if (selectedRef.current !== null) {
        onSelectRef.current(null);
      }
    }

    const delay = isInitial || isRefresh || isRetry ? 0 : 350;

    const timer = setTimeout(async () => {
      onRatesLoadingRef.current?.(true);
      setLoading(true);
      setError("");

      try {
        const payload = {
          lines: linesRef.current,
          destination: {
            postal: destPostal,
            areaId: destAreaId,
            lat: destLat,
            lon: destLon,
            province: destProvince,
            city: destCity,
          },
        };

        const res = (await api("shipping/rates", payload)) as RatesApiResponse;

        if (reqId !== requestIdRef.current) return;

        fetchedSignatureRef.current = requestSignature;
        setFetchedSignature(requestSignature);
        hasLoadedOnceRef.current = true;
        setRatesData(res);
        setError("");

        const options = Array.isArray(res?.options) ? res.options : [];
        let nextSelected: ShippingRateOption | null = null;

        if (options.length > 0) {
          const current = selectedRef.current;
          if (current) {
            const matched = options.find(
              (o) =>
                o.courierCode === current.courierCode &&
                o.serviceCode === current.serviceCode,
            );
            if (matched) {
              nextSelected = matched;
            }
          }

          if (!nextSelected) {
            const standardOrEconomy = options
              .filter(
                (o) => o.serviceType === "standard" || o.serviceType === "economy",
              )
              .sort((a, b) => a.price - b.price);

            if (standardOrEconomy.length > 0) {
              nextSelected = standardOrEconomy[0];
            } else {
              nextSelected = options[0];
            }
          }
        }

        const isDifferent =
          (!selectedRef.current && nextSelected !== null) ||
          (selectedRef.current && nextSelected === null) ||
          (selectedRef.current &&
            nextSelected &&
            (selectedRef.current.courierCode !== nextSelected.courierCode ||
              selectedRef.current.serviceCode !== nextSelected.serviceCode ||
              selectedRef.current.rateToken !== nextSelected.rateToken ||
              selectedRef.current.price !== nextSelected.price));

        if (isDifferent) {
          onSelectRef.current(nextSelected);
        }
      } catch (err) {
        if (reqId !== requestIdRef.current) return;
        hasLoadedOnceRef.current = true;
        setFetchedSignature(requestSignature);
        const msg = (err as Error).message || "Gagal memuat tarif pengiriman";
        setError(msg);
      } finally {
        if (reqId === requestIdRef.current) {
          setLoading(false);
          onRatesLoadingRef.current?.(false);
        }
      }
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [
    linesKey,
    destPostal,
    destAreaId,
    destProvince,
    destCity,
    destLat,
    destLon,
    refreshKey,
    retryTrigger,
    requestSignature,
  ]);

  const handleRetry = useCallback(() => {
    setRetryTrigger((v) => v + 1);
  }, []);

  const activeRatesData = lines.length ? ratesData : null;
  const isSignaturePending = Boolean(linesKey && requestSignature !== fetchedSignature);
  const activeLoading = Boolean(linesKey && (loading || isSignaturePending || !fetchedSignature));
  const postalDigits = (destPostal || "").replace(/\D/g, "");
  const isPostalShort = postalDigits.length < 5;

  const originText =
    activeRatesData?.origin?.name ||
    activeRatesData?.origin?.city ||
    "Watubelah, Cirebon";

  const weightGrams =
    activeRatesData?.weightGrams ??
    lines.reduce((acc, l) => acc + l.quantity * 1000, 0);
  const weightKg = (weightGrams / 1000).toFixed(
    weightGrams % 1000 === 0 ? 0 : 1,
  );

  const options = activeRatesData?.options || [];

  return (
    <div className="courier-picker-shell">
      <div className="courier-picker-header">
        <div className="courier-picker-origin-line">
          <Truck size={14} className="courier-picker-icon" aria-hidden="true" />
          <span>
            {t("Dikirim dari", "Shipped from")}{" "}
            <b>{originText}</b>
          </span>
          <span className="courier-picker-meta">
            · {weightKg} kg
            {activeRatesData?.zoneLabel ? ` · ${activeRatesData.zoneLabel}` : ""}
          </span>
        </div>
        <span
          className={`courier-source-pill ${activeRatesData?.source === "biteship" ? "live" : "fallback"}`}
        >
          {activeRatesData?.source === "biteship"
            ? t("Tarif Live Biteship", "Live Biteship Rates")
            : t("Estimasi Zona", "Regional Zone Estimate")}
        </span>
      </div>

      {isPostalShort && (
        <div className="courier-picker-notice" role="status">
          <Info size={13} aria-hidden="true" />
          <span>
            {t(
              "Masukkan 5 digit kode pos untuk tarif kurir paling akurat",
              "Enter 5-digit postal code for the most accurate courier rates",
            )}
          </span>
        </div>
      )}

      {error && !activeLoading && (
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

      {activeLoading && !activeRatesData && (
        <div className="courier-picker-skeleton" aria-busy="true">
          <div className="courier-skeleton-row" />
          <div className="courier-skeleton-row" />
        </div>
      )}

      {options.length > 0 && (
        <div
          className="courier-options-list"
          role="radiogroup"
          aria-label={t("Pilihan Kurir & Layanan", "Courier & Service Options")}
        >
          {options.map((opt) => {
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
                    <span className="courier-code-pill">{opt.courierName}</span>
                    <b className="courier-service-name">{opt.serviceName}</b>
                  </div>
                  {opt.duration && (
                    <small className="courier-option-duration">
                      {t(`Estimasi tiba: ${opt.duration}`, `ETD: ${opt.duration}`)}
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
      )}
    </div>
  );
}
