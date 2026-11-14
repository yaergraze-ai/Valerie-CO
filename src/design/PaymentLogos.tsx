import type { CSSProperties, ReactNode } from "react";

type BrandStyle = {
  bg: string;
  fg: string;
  border?: string;
  title: string;
  renderGraphic: () => ReactNode;
};

function QrisLogo() {
  return (
    <span className="pay-logo-inner pay-logo-qris">
      <svg viewBox="0 0 22 22" className="pay-logo-mark" aria-hidden="true">
        <rect x="2" y="2" width="7" height="7" rx="1.2" fill="none" stroke="#111827" strokeWidth="1.8" />
        <rect x="4.3" y="4.3" width="2.4" height="2.4" fill="#111827" />
        <rect x="13" y="2" width="7" height="7" rx="1.2" fill="none" stroke="#111827" strokeWidth="1.8" />
        <rect x="15.3" y="4.3" width="2.4" height="2.4" fill="#111827" />
        <rect x="2" y="13" width="7" height="7" rx="1.2" fill="none" stroke="#111827" strokeWidth="1.8" />
        <rect x="4.3" y="15.3" width="2.4" height="2.4" fill="#111827" />
        <rect x="12.5" y="12.5" width="3" height="3" rx="0.5" fill="#d92d20" />
        <rect x="16.5" y="12.5" width="3.5" height="2.2" fill="#111827" />
        <rect x="12.5" y="16.8" width="2.4" height="3.2" fill="#111827" />
        <rect x="16.2" y="16.2" width="3.8" height="3.8" rx="0.6" fill="#111827" />
      </svg>
      <span className="pay-logo-wordmark-col">
        <b className="pay-logo-word">QRIS</b>
        <span className="pay-logo-flag-bar" aria-hidden="true">
          <i style={{ background: "#d92d20" }} />
          <i style={{ background: "#0f2c59" }} />
        </span>
      </span>
    </span>
  );
}

function CardNetworksLogo() {
  return (
    <span className="pay-logo-inner pay-logo-cards" aria-label="Visa, Mastercard, JCB">
      <svg viewBox="0 0 38 14" className="pay-card-visa" aria-hidden="true">
        <text
          x="1"
          y="11.5"
          fill="#1a1f71"
          fontFamily="system-ui, -apple-system, sans-serif"
          fontWeight="900"
          fontStyle="italic"
          fontSize="12"
          letterSpacing="-0.5"
        >
          VISA
        </text>
      </svg>
      <svg viewBox="0 0 24 15" className="pay-card-mc" aria-hidden="true">
        <circle cx="8.5" cy="7.5" r="6" fill="#eb001b" />
        <circle cx="15.5" cy="7.5" r="6" fill="#f79e1b" fillOpacity="0.92" />
      </svg>
      <svg viewBox="0 0 18 14" className="pay-card-jcb" aria-hidden="true">
        <rect x="0.5" y="1" width="5" height="12" rx="1.5" fill="#0e4c96" />
        <rect x="6.5" y="1" width="5" height="12" rx="1.5" fill="#c61d23" />
        <rect x="12.5" y="1" width="5" height="12" rx="1.5" fill="#007b40" />
        <text
          x="9"
          y="9.5"
          textAnchor="middle"
          fill="#ffffff"
          fontFamily="system-ui, sans-serif"
          fontWeight="800"
          fontSize="5.5"
        >
          JCB
        </text>
      </svg>
    </span>
  );
}

const BRAND_SPECS: Record<string, BrandStyle> = {
  qris: {
    bg: "#ffffff",
    fg: "#111827",
    border: "rgba(17, 24, 39, 0.2)",
    title: "QRIS",
    renderGraphic: () => <QrisLogo />,
  },
  gopay: {
    bg: "#00aed6",
    fg: "#ffffff",
    border: "#0098bc",
    title: "GoPay",
    renderGraphic: () => (
      <span className="pay-logo-inner">
        <svg viewBox="0 0 20 20" className="pay-logo-mark" aria-hidden="true">
          <circle cx="10" cy="10" r="8.2" fill="#ffffff" />
          <path d="M10 4.8a5.2 5.2 0 1 0 5.2 5.2h-4.6v2.1h2.4a3 3 0 1 1-3-3.2c1.1 0 2 .5 2.5 1.3l1.7-1.1A5.1 5.1 0 0 0 10 4.8Z" fill="#00aed6" />
        </svg>
        <b className="pay-logo-word" style={{ textTransform: "lowercase" }}>
          gopay
        </b>
      </span>
    ),
  },
  ovo: {
    bg: "#4c3494",
    fg: "#ffffff",
    border: "#3f2880",
    title: "OVO",
    renderGraphic: () => (
      <span className="pay-logo-inner">
        <svg viewBox="0 0 20 20" className="pay-logo-mark" aria-hidden="true">
          <circle cx="10" cy="10" r="7.5" fill="none" stroke="#ffffff" strokeWidth="3.2" />
          <circle cx="10" cy="10" r="2.2" fill="#d8ccff" />
        </svg>
        <b className="pay-logo-word" style={{ letterSpacing: "0.08em" }}>
          OVO
        </b>
      </span>
    ),
  },
  shopeepay: {
    bg: "#ee4d2d",
    fg: "#ffffff",
    border: "#d73f21",
    title: "ShopeePay",
    renderGraphic: () => (
      <span className="pay-logo-inner">
        <svg viewBox="0 0 20 20" className="pay-logo-mark" aria-hidden="true">
          <path d="M6.5 6.8a3.5 3.5 0 0 1 7 0h2.2l.8 10.2a1.4 1.4 0 0 1-1.4 1.5H4.9a1.4 1.4 0 0 1-1.4-1.5l.8-10.2h2.2Zm1.7 0h3.6a1.8 1.8 0 0 0-3.6 0Z" fill="#ffffff" />
          <text x="10" y="14.5" textAnchor="middle" fill="#ee4d2d" fontSize="7" fontWeight="900" fontFamily="system-ui, sans-serif">
            S
          </text>
        </svg>
        <b className="pay-logo-word" style={{ fontSize: "10.5px" }}>
          ShopeePay
        </b>
      </span>
    ),
  },
  dana: {
    bg: "#118eea",
    fg: "#ffffff",
    border: "#0e7ccf",
    title: "DANA",
    renderGraphic: () => (
      <span className="pay-logo-inner">
        <svg viewBox="0 0 20 20" className="pay-logo-mark" aria-hidden="true">
          <rect x="2" y="4.5" width="16" height="11" rx="5.5" fill="#ffffff" />
          <path d="M4.5 10c2.2-1.8 4.4-1.8 6.6 0 1.4 1.1 3 1.1 4.4 0" fill="none" stroke="#118eea" strokeWidth="2.1" strokeLinecap="round" />
        </svg>
        <b className="pay-logo-word" style={{ letterSpacing: "0.06em" }}>
          DANA
        </b>
      </span>
    ),
  },
  linkaja: {
    bg: "#e1251b",
    fg: "#ffffff",
    border: "#c41e15",
    title: "LinkAja",
    renderGraphic: () => (
      <span className="pay-logo-inner">
        <svg viewBox="0 0 20 20" className="pay-logo-mark" aria-hidden="true">
          <path d="M10 17s-6.2-3.9-6.2-8.2A3.6 3.6 0 0 1 10 6.5a3.6 3.6 0 0 1 6.2 2.3C16.2 13.1 10 17 10 17Z" fill="#ffffff" />
          <circle cx="10" cy="9.5" r="1.9" fill="#e1251b" />
        </svg>
        <b className="pay-logo-word">LinkAja</b>
      </span>
    ),
  },
  bca_va: {
    bg: "#0060af",
    fg: "#ffffff",
    border: "#004e91",
    title: "BCA Virtual Account",
    renderGraphic: () => (
      <span className="pay-logo-inner">
        <svg viewBox="0 0 20 20" className="pay-logo-mark" aria-hidden="true">
          <circle cx="10" cy="10" r="8" fill="#ffffff" fillOpacity="0.16" />
          <path d="M10 3.2c1.6 2 1.6 4.4 0 6.4-1.6-2-1.6-4.4 0-6.4Zm0 7.2c1.6 2 1.6 4.4 0 6.4-1.6-2-1.6-4.4 0-6.4ZM3.2 10c2-1.6 4.4-1.6 6.4 0-2 1.6-4.4 1.6-6.4 0Zm7.2 0c2-1.6 4.4-1.6 6.4 0-2 1.6-4.4 1.6-6.4 0Z" fill="#ffffff" />
        </svg>
        <b className="pay-logo-word" style={{ letterSpacing: "0.08em" }}>
          BCA
        </b>
      </span>
    ),
  },
  mandiri_va: {
    bg: "#003d79",
    fg: "#ffffff",
    border: "#002f5e",
    title: "Mandiri Virtual Account",
    renderGraphic: () => (
      <span className="pay-logo-inner">
        <span className="pay-logo-wordmark-col">
          <b className="pay-logo-word" style={{ textTransform: "lowercase", fontSize: "11px" }}>
            mandiri
          </b>
          <svg viewBox="0 0 46 6" className="pay-mandiri-ribbon" aria-hidden="true">
            <path d="M1 4.8C13 0.5 31 0.5 45 4.2" fill="none" stroke="#ffb81c" strokeWidth="2.4" strokeLinecap="round" />
          </svg>
        </span>
      </span>
    ),
  },
  bni_va: {
    bg: "#005e6a",
    fg: "#ffffff",
    border: "#004a54",
    title: "BNI Virtual Account",
    renderGraphic: () => (
      <span className="pay-logo-inner">
        <svg viewBox="0 0 18 18" className="pay-logo-mark" aria-hidden="true">
          <rect x="2" y="2" width="14" height="14" rx="3" fill="#f15a23" />
          <text x="9" y="12" textAnchor="middle" fill="#ffffff" fontSize="7.5" fontWeight="900" fontFamily="system-ui, sans-serif">
            46
          </text>
        </svg>
        <b className="pay-logo-word" style={{ letterSpacing: "0.06em" }}>
          BNI
        </b>
      </span>
    ),
  },
  bri_va: {
    bg: "#00529c",
    fg: "#ffffff",
    border: "#00407c",
    title: "BRI Virtual Account",
    renderGraphic: () => (
      <span className="pay-logo-inner">
        <svg viewBox="0 0 18 18" className="pay-logo-mark" aria-hidden="true">
          <rect x="1.5" y="1.5" width="15" height="15" rx="3.5" fill="none" stroke="#ffffff" strokeWidth="1.8" />
          <path d="M5 13V5h4.2c1.4 0 2.2.7 2.2 1.8 0 .8-.4 1.4-1.1 1.7.9.2 1.4.9 1.4 1.9 0 1.4-.9 2.6-2.4 2.6H5Z" fill="#ffffff" />
        </svg>
        <b className="pay-logo-word" style={{ letterSpacing: "0.06em" }}>
          BRI
        </b>
      </span>
    ),
  },
  bsi_va: {
    bg: "#00a39d",
    fg: "#ffffff",
    border: "#008782",
    title: "BSI Virtual Account",
    renderGraphic: () => (
      <span className="pay-logo-inner">
        <svg viewBox="0 0 18 18" className="pay-logo-mark" aria-hidden="true">
          <polygon points="9,1.5 11.1,6.4 16.5,6.8 12.3,10.2 13.7,15.5 9,12.5 4.3,15.5 5.7,10.2 1.5,6.8 6.9,6.4" fill="#f7941d" />
        </svg>
        <b className="pay-logo-word" style={{ letterSpacing: "0.08em" }}>
          BSI
        </b>
      </span>
    ),
  },
  permata_va: {
    bg: "#00843d",
    fg: "#ffffff",
    border: "#006930",
    title: "Permata Virtual Account",
    renderGraphic: () => (
      <span className="pay-logo-inner">
        <svg viewBox="0 0 18 18" className="pay-logo-mark" aria-hidden="true">
          <polygon points="9,2 15.5,7 12.8,15.5 5.2,15.5 2.5,7" fill="#ffffff" />
          <polygon points="9,4.2 13,7.5 11.2,13.4 6.8,13.4 5,7.5" fill="#00843d" />
        </svg>
        <b className="pay-logo-word" style={{ fontSize: "10.5px" }}>
          Permata
        </b>
      </span>
    ),
  },
  cimb_va: {
    bg: "#790008",
    fg: "#ffffff",
    border: "#5c0006",
    title: "CIMB Niaga Virtual Account",
    renderGraphic: () => (
      <span className="pay-logo-inner">
        <svg viewBox="0 0 20 18" className="pay-logo-mark" aria-hidden="true">
          <polygon points="2,3 9,9 2,15 6,15 13,9 6,3" fill="#ec1c24" />
          <polygon points="8,3 15,9 8,15 12,15 19,9 12,3" fill="#ffffff" />
        </svg>
        <b className="pay-logo-word">CIMB</b>
      </span>
    ),
  },
  danamon_va: {
    bg: "#ffffff",
    fg: "#f37021",
    border: "rgba(243, 112, 33, 0.42)",
    title: "Danamon Virtual Account",
    renderGraphic: () => (
      <span className="pay-logo-inner">
        <svg viewBox="0 0 18 18" className="pay-logo-mark" aria-hidden="true">
          <rect x="2" y="3" width="14" height="5" rx="2.5" fill="#f37021" />
          <rect x="2" y="10" width="14" height="5" rx="2.5" fill="#008c45" />
        </svg>
        <b className="pay-logo-word" style={{ fontSize: "10.5px", color: "#c24f0c" }}>
          Danamon
        </b>
      </span>
    ),
  },
  card: {
    bg: "#ffffff",
    fg: "#1a1f71",
    border: "rgba(26, 31, 113, 0.22)",
    title: "Visa, Mastercard & JCB",
    renderGraphic: () => <CardNetworksLogo />,
  },
  indomaret: {
    bg: "#ffffff",
    fg: "#005daa",
    border: "rgba(0, 93, 170, 0.28)",
    title: "Indomaret",
    renderGraphic: () => (
      <span className="pay-logo-inner">
        <span className="pay-retail-bars" aria-hidden="true">
          <i style={{ background: "#005daa" }} />
          <i style={{ background: "#ed1c24" }} />
          <i style={{ background: "#facc15" }} />
        </span>
        <b className="pay-logo-word" style={{ fontSize: "10.5px", color: "#005daa" }}>
          Indomaret
        </b>
      </span>
    ),
  },
  alfamart: {
    bg: "#ed1c24",
    fg: "#ffffff",
    border: "#c8141b",
    title: "Alfamart",
    renderGraphic: () => (
      <span className="pay-logo-inner">
        <span className="pay-retail-bars" aria-hidden="true">
          <i style={{ background: "#ffffff" }} />
          <i style={{ background: "#ffd100" }} />
          <i style={{ background: "#00529c" }} />
        </span>
        <b className="pay-logo-word" style={{ fontSize: "10.5px" }}>
          Alfamart
        </b>
      </span>
    ),
  },
  kredivo: {
    bg: "#fff7ed",
    fg: "#c2410c",
    border: "rgba(245, 130, 32, 0.42)",
    title: "Kredivo",
    renderGraphic: () => (
      <span className="pay-logo-inner">
        <svg viewBox="0 0 18 18" className="pay-logo-mark" aria-hidden="true">
          <circle cx="9" cy="9" r="7.5" fill="#f58220" />
          <path d="M5.5 9.2 8 11.7 13 6.7" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <b className="pay-logo-word" style={{ fontSize: "10.5px" }}>
          Kredivo
        </b>
      </span>
    ),
  },
  akulaku: {
    bg: "#ff3b30",
    fg: "#ffffff",
    border: "#d92b21",
    title: "Akulaku",
    renderGraphic: () => (
      <span className="pay-logo-inner">
        <svg viewBox="0 0 18 18" className="pay-logo-mark" aria-hidden="true">
          <polygon points="9,2.5 15.5,14.8 2.5,14.8" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinejoin="round" />
        </svg>
        <b className="pay-logo-word" style={{ fontSize: "10.5px" }}>
          Akulaku
        </b>
      </span>
    ),
  },
  indodana: {
    bg: "#1d4ed8",
    fg: "#ffffff",
    border: "#173fb0",
    title: "Indodana",
    renderGraphic: () => (
      <span className="pay-logo-inner">
        <svg viewBox="0 0 18 18" className="pay-logo-mark" aria-hidden="true">
          <circle cx="9" cy="9" r="6.5" fill="none" stroke="#93c5fd" strokeWidth="2.2" />
          <circle cx="9" cy="9" r="2.6" fill="#ffffff" />
        </svg>
        <b className="pay-logo-word" style={{ fontSize: "10.5px" }}>
          Indodana
        </b>
      </span>
    ),
  },
};

export function PaymentBrandLogo({
  channelId,
  size = "md",
}: {
  channelId: string;
  size?: "sm" | "md" | "lg";
}) {
  const spec = BRAND_SPECS[channelId];
  if (!spec) {
    return (
      <span className={`payment-logo-tile size-${size}`}>
        <b className="pay-logo-word">{channelId.toUpperCase()}</b>
      </span>
    );
  }
  const style: CSSProperties = {
    background: spec.bg,
    color: spec.fg,
    borderColor: spec.border || "rgba(23, 20, 18, 0.14)",
  };
  return (
    <span
      className={`payment-logo-tile size-${size} ch-${channelId}`}
      style={style}
      title={spec.title}
    >
      {spec.renderGraphic()}
    </span>
  );
}

export function MidtransGatewayBadge({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`midtrans-brand-badge ${compact ? "compact" : ""}`}>
      <svg viewBox="0 0 24 24" className="midtrans-brand-icon" aria-hidden="true">
        <rect x="2" y="5" width="4" height="14" rx="2" fill="#009ade" />
        <rect x="10" y="2" width="4" height="20" rx="2" fill="#002855" />
        <rect x="18" y="6" width="4" height="12" rx="2" fill="#009ade" />
      </svg>
      <span className="midtrans-brand-copy">
        <b>midtrans</b>
        {!compact && <small>Official Gateway</small>}
      </span>
    </span>
  );
}

const STRIP_CHANNELS = [
  "qris",
  "gopay",
  "ovo",
  "dana",
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
  label,
}: {
  compact?: boolean;
  label?: string;
}) {
  return (
    <div className={`payment-partners-strip ${compact ? "compact" : ""}`}>
      <MidtransGatewayBadge compact={compact} />
      {label && <span className="payment-partners-label">{label}</span>}
      <div className="payment-partners-logos">
        {STRIP_CHANNELS.map((id) => (
          <PaymentBrandLogo key={id} channelId={id} size="sm" />
        ))}
      </div>
    </div>
  );
}
