import { useState, type ReactNode } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  ChevronRight,
  LocateFixed,
  MapPin,
  Plus,
  Sparkles,
} from "lucide-react";
import { useStore, type Address } from "./store";
import {
  formatShortAddress,
  isAddressComplete,
  type CheckoutAddressDraft,
} from "./useShippingRates";

export type { CheckoutAddressDraft };

const ADDRESS_LABEL_CHIPS = [
  { id: "Rumah", en: "Home" },
  { id: "Kantor", en: "Office" },
  { id: "Apartemen", en: "Apartment" },
  { id: "Kos", en: "Boarding House" },
] as const;

export type AddressSummaryCardProps = {
  address: Partial<Address>;
  isSaved: boolean;
  onOpen: () => void;
  notice?: string;
};

export function AddressSummaryCard({
  address,
  isSaved,
  onOpen,
  notice,
}: AddressSummaryCardProps) {
  const { t } = useStore();
  const shortLine = formatShortAddress(address);
  const complete = isAddressComplete(address);
  const hasAny = Boolean(shortLine);

  return (
    <div className="shopee-summary-stack">
      <button
        type="button"
        className={`shopee-summary-card shopee-address-summary ${!complete ? "is-empty" : ""}`}
        onClick={onOpen}
        aria-label={t(
          "Pilih atau ubah alamat pengiriman",
          "Choose or edit delivery address",
        )}
      >
        <div className="shopee-address-ribbon" aria-hidden="true" />
        <div className="shopee-summary-icon-badge" aria-hidden="true">
          <MapPin size={16} />
        </div>
        <div className="shopee-summary-body">
          {hasAny ? (
            <>
              <div className="shopee-summary-top-row">
                {(address.label || isSaved) && (
                  <span className="shopee-addr-label-pill">
                    {address.label || t("Utama", "Primary")}
                  </span>
                )}
                <b className="shopee-summary-title">
                  {address.name || t("Penerima", "Recipient")}
                </b>
                {address.phone && (
                  <span className="shopee-addr-phone">{address.phone}</span>
                )}
              </div>
              <div className="shopee-summary-sub-row is-multiline">
                <span>{shortLine}</span>
              </div>
              {(address.areaName || typeof address.lat === "number") && (
                <div className="shopee-addr-pins-row">
                  {address.areaName && (
                    <span className="shopee-mini-pin">
                      <Sparkles size={10} aria-hidden="true" />
                      {address.areaName}
                    </span>
                  )}
                  {typeof address.lat === "number" && (
                    <span className="shopee-mini-pin">
                      <LocateFixed size={10} aria-hidden="true" />
                      {t("Titik peta terpin", "Map pinned")}
                    </span>
                  )}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="shopee-summary-top-row">
                <b className="shopee-summary-title">
                  {t(
                    "Pilih atau Isi Alamat Pengiriman",
                    "Select or Enter Delivery Address",
                  )}
                </b>
              </div>
              <div className="shopee-summary-sub-row">
                <span>
                  {t(
                    "Ketuk untuk pilih alamat tersimpan, cari kecamatan, atau pin GPS",
                    "Tap to choose saved address, search area, or pin GPS",
                  )}
                </span>
              </div>
            </>
          )}
        </div>
        <div className="shopee-summary-trailing">
          <span className="shopee-summary-action-pill">
            <span>{hasAny ? t("Ubah", "Change") : t("Isi", "Add")}</span>
            <ChevronRight size={14} aria-hidden="true" />
          </span>
        </div>
      </button>
      {notice && (
        <p className="shopee-inline-warn" role="alert">
          <AlertCircle size={13} aria-hidden="true" />
          <span>{notice}</span>
        </p>
      )}
    </div>
  );
}

export type AddressSubPageProps = {
  savedAddresses: Address[];
  selectedAddressId: string;
  draftAddress: CheckoutAddressDraft;
  defaultName?: string;
  defaultPhone?: string;
  validationNotice?: string;
  canSaveToAccount?: boolean;
  onSelectSaved: (addressId: string) => void;
  onApplyNewAddress: (
    draft: CheckoutAddressDraft,
    saveToAccount: boolean,
  ) => void;
  onBack: () => void;
  renderAddressFields: (initial: Partial<Address>, key: number) => ReactNode;
};

export function AddressSubPage({
  savedAddresses,
  selectedAddressId,
  draftAddress,
  defaultName = "",
  defaultPhone = "",
  validationNotice = "",
  canSaveToAccount = false,
  onSelectSaved,
  onApplyNewAddress,
  onBack,
  renderAddressFields,
}: AddressSubPageProps) {
  const { t } = useStore();
  const [showNewForm, setShowNewForm] = useState(
    () => savedAddresses.length === 0 || selectedAddressId === "new",
  );
  const [labelVal, setLabelVal] = useState(draftAddress.label || "Utama");
  const [saveToAccount, setSaveToAccount] = useState(false);
  const [formError, setFormError] = useState("");

  const initialForFields: Partial<Address> = {
    ...draftAddress,
    name: draftAddress.name || defaultName,
    phone: draftAddress.phone || defaultPhone,
  };

  return (
    <div className="checkout-grid checkout-subpage-grid shopee-subpage">
      <div className="shopee-subpage-topbar">
        <button type="button" className="shopee-back-btn" onClick={onBack}>
          <ArrowLeft size={16} aria-hidden="true" />
          <span>{t("Kembali", "Back")}</span>
        </button>
        <div className="shopee-subpage-title">
          <h3>{t("Alamat Pengiriman", "Delivery Address")}</h3>
          <small>
            {t(
              "Pilih alamat tersimpan atau isi tujuan baru dengan pin lokasi",
              "Choose a saved address or enter a new destination with location pin",
            )}
          </small>
        </div>
      </div>

      {(validationNotice || formError) && (
        <div className="shopee-subpage-alert" role="alert">
          <AlertCircle size={15} aria-hidden="true" />
          <span>{formError || validationNotice}</span>
        </div>
      )}

      {savedAddresses.length > 0 && (
        <section className="shopee-saved-section">
          <div className="shopee-section-head-row">
            <h4>{t("Alamat Tersimpan", "Saved Addresses")}</h4>
            <button
              type="button"
              className="button ghost small shopee-toggle-new-btn"
              onClick={() => setShowNewForm((v) => !v)}
            >
              <Plus size={14} aria-hidden="true" />
              <span>
                {showNewForm
                  ? t("Tutup form alamat baru", "Hide new address form")
                  : t("Pakai / Tambah Alamat Baru", "Use / Add New Address")}
              </span>
            </button>
          </div>

          <div
            className="shopee-saved-list"
            role="radiogroup"
            aria-label={t("Daftar alamat tersimpan", "Saved addresses")}
          >
            {savedAddresses.map((addr) => {
              const isSelected = selectedAddressId === addr.id;
              return (
                <button
                  key={addr.id}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  className={`shopee-saved-addr-card ${isSelected ? "selected" : ""}`}
                  onClick={() => onSelectSaved(addr.id)}
                >
                  <div className="shopee-radio-dot" aria-hidden="true">
                    {isSelected && <Check size={12} />}
                  </div>
                  <div className="shopee-saved-addr-content">
                    <div className="shopee-summary-top-row">
                      <span className="shopee-addr-label-pill">
                        {addr.label || t("Utama", "Primary")}
                      </span>
                      <b>{addr.name}</b>
                      <span className="shopee-addr-phone">{addr.phone}</span>
                    </div>
                    <p className="shopee-saved-addr-line">
                      {formatShortAddress(addr)}
                    </p>
                    {(addr.areaName || typeof addr.lat === "number") && (
                      <div className="shopee-addr-pins-row">
                        {addr.areaName && (
                          <span className="shopee-mini-pin">
                            <Sparkles size={10} aria-hidden="true" />
                            {addr.areaName}
                          </span>
                        )}
                        {typeof addr.lat === "number" && (
                          <span className="shopee-mini-pin">
                            <LocateFixed size={10} aria-hidden="true" />
                            {t("Titik peta terpin", "Map pinned")}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <span className="shopee-saved-use-tag">
                    {isSelected
                      ? t("Dipilih", "Active")
                      : t("Pilih", "Select")}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {(savedAddresses.length === 0 || showNewForm) && (
        <form
          className="shopee-address-form"
          onSubmit={(e) => {
            e.preventDefault();
            setFormError("");
            const f = new FormData(e.currentTarget);
            const rawLat = f.get("lat");
            const rawLon = f.get("lon");
            const lat =
              rawLat && Number.isFinite(Number(rawLat))
                ? Number(rawLat)
                : undefined;
            const lon =
              rawLon && Number.isFinite(Number(rawLon))
                ? Number(rawLon)
                : undefined;

            const nextDraft: CheckoutAddressDraft = {
              label: String(f.get("label") || labelVal || "Utama").trim() || "Utama",
              name: String(f.get("name") || "").trim(),
              phone: String(f.get("phone") || "").trim(),
              street: String(f.get("street") || "").trim(),
              city: String(f.get("city") || "").trim(),
              province: String(f.get("province") || "").trim() || undefined,
              postal: String(f.get("postal") || "").trim(),
              areaId: String(f.get("areaId") || "").trim() || undefined,
              areaName: String(f.get("areaName") || "").trim() || undefined,
              lat,
              lon,
            };

            if (!nextDraft.name || nextDraft.phone.length < 7) {
              setFormError(
                t(
                  "Lengkapi nama penerima dan nomor telepon yang aktif.",
                  "Please enter recipient name and a valid phone number.",
                ),
              );
              return;
            }
            if (nextDraft.street.length < 5 || !nextDraft.city || !nextDraft.postal) {
              setFormError(
                t(
                  "Lengkapi alamat jalan, kota/kabupaten, dan kode pos tujuan.",
                  "Please fill street address, city, and postal code.",
                ),
              );
              return;
            }

            onApplyNewAddress(nextDraft, saveToAccount);
          }}
        >
          <div className="shopee-address-form-head">
            <h4>
              {savedAddresses.length > 0
                ? t("Isi Alamat Pengiriman Baru", "Enter New Delivery Address")
                : t("Lengkapi Alamat Pengiriman", "Complete Delivery Address")}
            </h4>
            <div className="shopee-label-chips">
              {ADDRESS_LABEL_CHIPS.map((chip) => {
                const chipLabel = t(chip.id, chip.en);
                const active = labelVal === chipLabel;
                return (
                  <button
                    key={chip.id}
                    type="button"
                    className={`shopee-label-chip ${active ? "active" : ""}`}
                    onClick={() => setLabelVal(chipLabel)}
                  >
                    {chipLabel}
                  </button>
                );
              })}
              <input
                type="text"
                name="label"
                className="shopee-label-input"
                value={labelVal}
                onChange={(e) => setLabelVal(e.target.value)}
                placeholder={t("Label (misal: Rumah)", "Label")}
                maxLength={24}
                aria-label={t("Label alamat", "Address label")}
              />
            </div>
          </div>

          {renderAddressFields(initialForFields, 0)}

          <div className="shopee-subpage-footer shopee-address-footer">
            <div className="shopee-subpage-footer-info">
              {canSaveToAccount ? (
                <label className="shopee-save-addr-check">
                  <input
                    type="checkbox"
                    checked={saveToAccount}
                    onChange={(e) => setSaveToAccount(e.target.checked)}
                  />
                  <span>
                    {t(
                      "Simpan ke daftar alamat akun",
                      "Save to my address book",
                    )}
                  </span>
                </label>
              ) : (
                <small>
                  {t(
                    "Ongkos kirim otomatis dihitung ulang sesuai tujuan baru",
                    "Shipping fee updates automatically for this destination",
                  )}
                </small>
              )}
            </div>
            <div className="shopee-footer-actions">
              <button type="button" className="button ghost" onClick={onBack}>
                {t("Batal", "Cancel")}
              </button>
              <button
                type="submit"
                className="button dark shopee-confirm-btn"
              >
                <Check size={15} aria-hidden="true" />
                <span>{t("Pakai Alamat Ini", "Use This Address")}</span>
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
