import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./backend";
import type { Address, ShippingRateOption } from "./store";
import type { BagLine } from "./commerce";

export type RatesApiResponse = {
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

export type CheckoutAddressDraft = {
  label?: string;
  name: string;
  phone: string;
  street: string;
  city: string;
  province?: string;
  postal: string;
  areaId?: string;
  areaName?: string;
  lat?: number;
  lon?: number;
};

export type ShippingTierKey = "instant" | "express" | "standard" | "economy";

export type ShippingTierMeta = {
  key: ShippingTierKey;
  order: number;
  titleId: string;
  titleEn: string;
  descId: string;
  descEn: string;
  badgeId: string;
  badgeEn: string;
};

const TIER_MAP: Record<ShippingTierKey, ShippingTierMeta> = {
  instant: {
    key: "instant",
    order: 0,
    titleId: "Instant & Same Day",
    titleEn: "Instant & Same Day",
    descId: "Tiba di hari yang sama (khusus area terjangkau)",
    descEn: "Arrives today (for covered instant delivery zones)",
    badgeId: "Instant / Same Day",
    badgeEn: "Instant / Same Day",
  },
  express: {
    key: "express",
    order: 1,
    titleId: "Next Day / Express",
    titleEn: "Next Day / Express",
    descId: "Pengiriman prioritas lebih cepat",
    descEn: "Priority faster delivery",
    badgeId: "Express",
    badgeEn: "Express",
  },
  standard: {
    key: "standard",
    order: 2,
    titleId: "Reguler",
    titleEn: "Regular",
    descId: "Pengiriman standar terpercaya & ekonomis",
    descEn: "Reliable everyday standard delivery",
    badgeId: "Reguler",
    badgeEn: "Reguler",
  },
  economy: {
    key: "economy",
    order: 3,
    titleId: "Hemat & Kargo",
    titleEn: "Economy & Cargo",
    descId: "Pilihan tarif paling hemat",
    descEn: "Most economical shipping rates",
    badgeId: "Hemat",
    badgeEn: "Economy",
  },
};

export function getShippingTierMeta(serviceType: string): ShippingTierMeta {
  const norm = (serviceType || "").trim().toLowerCase();
  if (
    norm === "instant" ||
    norm === "same_day" ||
    norm === "same-day" ||
    norm === "sameday"
  ) {
    return TIER_MAP.instant;
  }
  if (
    norm === "express" ||
    norm === "next_day" ||
    norm === "next-day" ||
    norm === "nextday" ||
    norm === "overnight" ||
    norm === "priority"
  ) {
    return TIER_MAP.express;
  }
  if (norm === "standard" || norm === "regular" || norm === "reguler" || norm === "reg") {
    return TIER_MAP.standard;
  }
  if (norm === "economy" || norm === "hemat" || norm === "cargo" || norm === "trucking") {
    return TIER_MAP.economy;
  }
  return TIER_MAP.standard;
}

export type ShippingTierGroup = {
  meta: ShippingTierMeta;
  options: ShippingRateOption[];
  lowestEffectivePrice: number;
  hasFreeOption: boolean;
};

export function groupOptionsByTier(
  options: ShippingRateOption[],
): ShippingTierGroup[] {
  const buckets = new Map<ShippingTierKey, ShippingRateOption[]>();
  for (const opt of options) {
    const meta = getShippingTierMeta(opt.serviceType);
    const list = buckets.get(meta.key) || [];
    list.push(opt);
    buckets.set(meta.key, list);
  }
  const tierOrder: ShippingTierKey[] = ["standard", "express", "instant", "economy"];
  const groups: ShippingTierGroup[] = [];
  for (const key of tierOrder) {
    const list = buckets.get(key);
    if (!list || list.length === 0) continue;
    const sorted = [...list].sort((a, b) => a.price - b.price);
    const lowestEffectivePrice = Math.min(...sorted.map((o) => o.price));
    const hasFreeOption = sorted.some((o) => o.freeApplied || o.price === 0);
    groups.push({
      meta: TIER_MAP[key],
      options: sorted,
      lowestEffectivePrice,
      hasFreeOption,
    });
  }
  return groups;
}

export function isAddressComplete(dest?: Partial<Address> | null): boolean {
  if (!dest) return false;
  const name = String(dest.name || "").trim();
  const phone = String(dest.phone || "").trim();
  const street = String(dest.street || "").trim();
  const city = String(dest.city || "").trim();
  const postal = String(dest.postal || "").trim();
  return (
    name.length >= 1 &&
    phone.length >= 7 &&
    street.length >= 5 &&
    city.length >= 1 &&
    postal.length >= 3
  );
}

export function formatShortAddress(dest?: Partial<Address> | null): string {
  if (!dest) return "";
  return [
    dest.street,
    dest.city,
    dest.province,
    dest.postal,
  ]
    .map((s) => String(s || "").trim())
    .filter(Boolean)
    .join(", ");
}

export function buildAddressFromDraft(
  draft: CheckoutAddressDraft,
  fallbackName = "",
  fallbackPhone = "",
): Address {
  const province = String(draft.province || "").trim();
  const areaId = String(draft.areaId || "").trim();
  const areaName = String(draft.areaName || "").trim();
  return {
    id: crypto.randomUUID(),
    label: String(draft.label || "Utama").trim() || "Utama",
    name: String(draft.name || fallbackName).trim(),
    phone: String(draft.phone || fallbackPhone).trim(),
    street: String(draft.street || "").trim(),
    city: String(draft.city || "").trim(),
    postal: String(draft.postal || "").trim(),
    ...(province ? { province } : {}),
    ...(areaId ? { areaId } : {}),
    ...(areaName ? { areaName } : {}),
    ...(typeof draft.lat === "number" && Number.isFinite(draft.lat)
      ? { lat: draft.lat }
      : {}),
    ...(typeof draft.lon === "number" && Number.isFinite(draft.lon)
      ? { lon: draft.lon }
      : {}),
  };
}

export type UseShippingRatesParams = {
  enabled?: boolean;
  lines: BagLine[];
  destination: Partial<Address>;
  selected: ShippingRateOption | null;
  onSelect: (opt: ShippingRateOption | null) => void;
  refreshKey?: number;
  onRatesLoading?: (loading: boolean) => void;
};

export type ShippingRatesState = {
  ratesData: RatesApiResponse | null;
  options: ShippingRateOption[];
  tierGroups: ShippingTierGroup[];
  loading: boolean;
  error: string;
  isPostalShort: boolean;
  originText: string;
  weightKg: string;
  handleRetry: () => void;
};

export function useShippingRates({
  enabled = true,
  lines,
  destination,
  selected,
  onSelect,
  refreshKey = 0,
  onRatesLoading,
}: UseShippingRatesParams): ShippingRatesState {
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

    if (!enabled || !linesKey) {
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

    const delay = isInitial || isRefresh || isRetry ? 0 : 180;

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
    enabled,
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

  const activeRatesData = enabled && lines.length ? ratesData : null;
  const isSignaturePending = Boolean(
    enabled && linesKey && requestSignature !== fetchedSignature,
  );
  const activeLoading = Boolean(
    enabled && linesKey && (loading || isSignaturePending || !fetchedSignature),
  );
  const postalDigits = (destPostal || "").replace(/\D/g, "");
  const isPostalShort = postalDigits.length < 5;

  const originText =
    activeRatesData?.origin?.name ||
    activeRatesData?.origin?.city ||
    "UMC Kampus 2 Watubelah (Cirebon)";

  const weightGrams =
    activeRatesData?.weightGrams ??
    lines.reduce((acc, l) => acc + l.quantity * 1000, 0);
  const weightKg = (weightGrams / 1000).toFixed(
    weightGrams % 1000 === 0 ? 0 : 1,
  );

  const options = activeRatesData?.options || [];
  const tierGroups = groupOptionsByTier(options);

  return {
    ratesData: activeRatesData,
    options,
    tierGroups,
    loading: activeLoading,
    error,
    isPostalShort,
    originText,
    weightKg,
    handleRetry,
  };
}
