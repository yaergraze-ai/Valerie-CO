import type { CSSProperties } from "react";
import qrisLogo from "../assets/payments/qris.svg";
import gopayLogo from "../assets/payments/gopay.svg";
import ovoLogo from "../assets/payments/ovo.svg";
import shopeepayLogo from "../assets/payments/shopeepay.svg";
import danaLogo from "../assets/payments/dana.svg";
import linkajaLogo from "../assets/payments/linkaja.svg";
import bcaLogo from "../assets/payments/bca_va.svg";
import mandiriLogo from "../assets/payments/mandiri_va.svg";
import bniLogo from "../assets/payments/bni_va.svg";
import briLogo from "../assets/payments/bri_va.svg";
import bsiLogo from "../assets/payments/bsi_va.svg";
import permataLogo from "../assets/payments/permata_va.svg";
import cimbLogo from "../assets/payments/cimb_va.svg";
import danamonLogo from "../assets/payments/danamon_va.svg";
import visaLogo from "../assets/payments/visa.svg";
import mastercardLogo from "../assets/payments/mastercard.svg";
import indomaretLogo from "../assets/payments/indomaret.svg";
import alfamartLogo from "../assets/payments/alfamart.svg";
import kredivoLogo from "../assets/payments/kredivo.svg";
import akulakuLogo from "../assets/payments/akulaku.svg";
import indodanaLogo from "../assets/payments/indodana.svg";
import midtransLogo from "../assets/payments/midtrans.svg";

type BrandAsset = {
  title: string;
  src: string;
  secondarySrc?: string;
  secondaryTitle?: string;
};

const BRAND_ASSETS: Record<string, BrandAsset> = {
  qris: { title: "QRIS", src: qrisLogo },
  dana: { title: "DANA", src: danaLogo },
  gopay: { title: "GoPay", src: gopayLogo },
  ovo: { title: "OVO", src: ovoLogo },
  shopeepay: { title: "ShopeePay", src: shopeepayLogo },
  linkaja: { title: "LinkAja", src: linkajaLogo },
  bca_va: { title: "BCA", src: bcaLogo },
  mandiri_va: { title: "Bank Mandiri", src: mandiriLogo },
  bni_va: { title: "BNI", src: bniLogo },
  bri_va: { title: "BRI", src: briLogo },
  bsi_va: { title: "BSI", src: bsiLogo },
  permata_va: { title: "PermataBank", src: permataLogo },
  cimb_va: { title: "CIMB Niaga", src: cimbLogo },
  danamon_va: { title: "Bank Danamon", src: danamonLogo },
  card: {
    title: "Visa",
    src: visaLogo,
    secondaryTitle: "Mastercard",
    secondarySrc: mastercardLogo,
  },
  indomaret: { title: "Indomaret", src: indomaretLogo },
  alfamart: { title: "Alfamart", src: alfamartLogo },
  kredivo: { title: "Kredivo", src: kredivoLogo },
  akulaku: { title: "Akulaku", src: akulakuLogo },
  indodana: { title: "Indodana", src: indodanaLogo },
};

export function PaymentBrandLogo({
  channelId,
  size = "md",
}: {
  channelId: string;
  size?: "sm" | "md" | "lg";
}) {
  const asset = BRAND_ASSETS[channelId];
  if (!asset) {
    return (
      <span className={`payment-logo-tile size-${size}`} translate="no">
        <b className="pay-logo-word">{channelId.toUpperCase()}</b>
      </span>
    );
  }
  const style: CSSProperties = {
    background: "#ffffff",
    borderColor: "rgba(23, 20, 18, 0.14)",
  };
  return (
    <span
      className={`payment-logo-tile size-${size} ch-${channelId}`}
      style={style}
      title={asset.secondaryTitle ? `${asset.title} · ${asset.secondaryTitle}` : asset.title}
      translate="no"
    >
      <img
        src={asset.src}
        alt={asset.title}
        className={`pay-brand-img ${asset.secondarySrc ? "is-half" : ""}`}
        draggable={false}
      />
      {asset.secondarySrc && (
        <img
          src={asset.secondarySrc}
          alt={asset.secondaryTitle || ""}
          className="pay-brand-img is-half"
          draggable={false}
        />
      )}
    </span>
  );
}

export function MidtransGatewayBadge({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`midtrans-brand-badge ${compact ? "compact" : ""}`}>
      <img
        src={midtransLogo}
        alt="Midtrans"
        className="midtrans-brand-wordmark"
        draggable={false}
      />
      {!compact && (
        <span className="midtrans-brand-copy">
          <small>Official Gateway</small>
        </span>
      )}
    </span>
  );
}

const STRIP_CHANNELS = [
  "qris",
  "gopay",
  "dana",
  "ovo",
  "shopeepay",
  "bca_va",
  "mandiri_va",
  "bni_va",
  "bri_va",
  "card",
  "indomaret",
  "alfamart",
] as const;

export function PaymentPartnersStrip({
  compact = false,
  showGateway = true,
  label,
}: {
  compact?: boolean;
  showGateway?: boolean;
  label?: string;
}) {
  return (
    <div className={`payment-partners-strip ${compact ? "compact" : ""}`}>
      {showGateway && <MidtransGatewayBadge compact={compact} />}
      {label && <span className="payment-partners-label">{label}</span>}
      <div className="payment-partners-logos">
        {STRIP_CHANNELS.map((id) => (
          <PaymentBrandLogo key={id} channelId={id} size="sm" />
        ))}
      </div>
    </div>
  );
}
