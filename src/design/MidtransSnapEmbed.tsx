import { useEffect, useId, useRef, useState } from "react";
import { Check, LockKeyhole, ShieldCheck } from "lucide-react";

declare global {
  interface Window {
    snap?: {
      embed: (
        snapToken: string,
        options: {
          embedId: string;
          onSuccess?: (result: Record<string, unknown>) => void;
          onPending?: (result: Record<string, unknown>) => void;
          onError?: (result: Record<string, unknown>) => void;
          onClose?: () => void;
        },
      ) => void;
      pay: (
        snapToken: string,
        options?: {
          onSuccess?: (result: Record<string, unknown>) => void;
          onPending?: (result: Record<string, unknown>) => void;
          onError?: (result: Record<string, unknown>) => void;
          onClose?: () => void;
        },
      ) => void;
      hide?: () => void;
    };
  }
}

const scriptCache = new Map<string, Promise<void>>();

/** Load Midtrans Snap.js once per environment URL (with optional client key). */
function loadSnapScript(scriptUrl: string, clientKey?: string): Promise<void> {
  const key = `${scriptUrl}::${clientKey || ""}`;
  if (typeof window !== "undefined" && window.snap?.embed) {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-valerie-snap="1"]',
    );
    if (existing && existing.src === scriptUrl) {
      return Promise.resolve();
    }
  }
  const cached = scriptCache.get(key);
  if (cached) return cached;

  const loader = new Promise<void>((resolve, reject) => {
    const previous = document.querySelector<HTMLScriptElement>(
      'script[data-valerie-snap="1"]',
    );
    if (previous) previous.remove();

    const script = document.createElement("script");
    script.src = scriptUrl;
    script.async = true;
    script.dataset.valerieSnap = "1";
    if (clientKey) script.setAttribute("data-client-key", clientKey);
    script.onload = () => {
      if (window.snap?.embed) resolve();
      else reject(new Error("Midtrans Snap unavailable after load"));
    };
    script.onerror = () => {
      scriptCache.delete(key);
      reject(new Error("Failed to load Midtrans Snap script"));
    };
    document.head.appendChild(script);
  });

  scriptCache.set(key, loader);
  return loader;
}

export interface MidtransSnapEmbedProps {
  orderId: string;
  snapToken?: string;
  paymentUrl?: string;
  clientKey?: string;
  snapScriptUrl?: string;
  sandbox?: boolean;
  totalText: string;
  checkingStatus?: boolean;
  onSyncStatus: () => Promise<void> | void;
  onSettled: (methodHint?: string) => void;
  onPendingInstruction?: () => void;
  t: (text: string) => string;
}

/**
 * Render official Midtrans Snap inline via `window.snap.embed()` inside
 * a custom Valerie & CO vertical vitrine matching Snap's proportions.
 */
export function MidtransSnapEmbed({
  orderId,
  snapToken = "",
  paymentUrl = "",
  clientKey = "",
  snapScriptUrl,
  sandbox = true,
  totalText,
  checkingStatus = false,
  onSyncStatus,
  onSettled,
  onPendingInstruction,
  t,
}: MidtransSnapEmbedProps) {
  const rawId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const embedId = `valerie-snap-embed-${rawId}`;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [phase, setPhase] = useState<"loading" | "ready" | "pending" | "error">(
    snapToken ? "loading" : "error",
  );
  const [reloadTick, setReloadTick] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");
  const [polling, setPolling] = useState(false);

  const onSyncRef = useRef(onSyncStatus);
  const onSettledRef = useRef(onSettled);
  const onPendingRef = useRef(onPendingInstruction);

  useEffect(() => {
    onSyncRef.current = onSyncStatus;
    onSettledRef.current = onSettled;
    onPendingRef.current = onPendingInstruction;
  }, [onSyncStatus, onSettled, onPendingInstruction]);

  const effectiveScriptUrl =
    snapScriptUrl ||
    (sandbox
      ? "https://app.sandbox.midtrans.com/snap/snap.js"
      : "https://app.midtrans.com/snap/snap.js");

  const resolvedToken =
    snapToken ||
    (() => {
      const m = paymentUrl.match(/\/snap\/(?:v[0-9]+\/)?(?:vtweb|redirection)\/([^/?#]+)/i);
      if (m?.[1]) return decodeURIComponent(m[1]);
      const tParam = paymentUrl.match(/[?&]token=([^&#]+)/i);
      return tParam?.[1] ? decodeURIComponent(tParam[1]) : "";
    })();

  const missingTokenMessage = t(
    "Token transaksi Midtrans belum tersedia. Klik Muat Sesi Midtrans untuk mencoba ulang.",
  );
  const effectivePhase = !resolvedToken ? "error" : phase;
  const effectiveMessage = !resolvedToken ? missingTokenMessage : statusMessage;

  useEffect(() => {
    if (!resolvedToken) return;

    const lifecycle = new AbortController();

    loadSnapScript(effectiveScriptUrl, clientKey)
      .then(() => {
        if (lifecycle.signal.aborted || !containerRef.current || !window.snap?.embed)
          return;
        containerRef.current.innerHTML = "";
        setPhase("ready");
        setStatusMessage("");
        window.snap.embed(resolvedToken, {
          embedId,
          onSuccess: (result) => {
            if (lifecycle.signal.aborted) return;
            setPolling(false);
            setPhase("ready");
            const method =
              typeof result?.payment_type === "string"
                ? result.payment_type
                : "Midtrans Snap";
            setStatusMessage(
              t("Pembayaran berhasil dikonfirmasi Midtrans. Menyiapkan struk resmi..."),
            );
            void Promise.resolve(onSyncRef.current()).finally(() => {
              onSettledRef.current(method);
            });
          },
          onPending: () => {
            if (lifecycle.signal.aborted) return;
            setPhase("pending");
            setPolling(true);
            setStatusMessage(
              t(
                "Instruksi pembayaran aktif. Selesaikan QRIS / Transfer di panel Midtrans — status otomatis diperbarui.",
              ),
            );
            onPendingRef.current?.();
          },
          onError: () => {
            if (lifecycle.signal.aborted) return;
            setPolling(false);
            setStatusMessage(
              t(
                "Pembayaran belum berhasil atau kedaluwarsa. Anda dapat memilih metode lain langsung di panel Midtrans.",
              ),
            );
          },
          onClose: () => {
            if (lifecycle.signal.aborted) return;
            setPolling(true);
          },
        });
      })
      .catch(() => {
        if (lifecycle.signal.aborted) return;
        setPhase("error");
        setStatusMessage(
          t("Skrip Midtrans Snap tidak dapat dimuat. Periksa koneksi atau nonaktifkan pemblokir skrip."),
        );
      });

    return () => {
      lifecycle.abort();
    };
  }, [resolvedToken, effectiveScriptUrl, clientKey, embedId, reloadTick, t]);

  // Poll payment status gently while customer completes QRIS / Virtual Account inside Snap
  useEffect(() => {
    if (!polling || !resolvedToken) return;
    const timer = window.setInterval(() => {
      void onSyncRef.current();
    }, 6000);
    return () => window.clearInterval(timer);
  }, [polling, resolvedToken]);

  const openSnapPopup = () => {
    if (!resolvedToken || !window.snap?.pay) return;
    window.snap.pay(resolvedToken, {
      onSuccess: (result) => {
        const method =
          typeof result?.payment_type === "string"
            ? result.payment_type
            : "Midtrans Snap";
        void Promise.resolve(onSyncRef.current()).finally(() => {
          onSettledRef.current(method);
        });
      },
      onPending: () => {
        setPhase("pending");
        setPolling(true);
      },
      onClose: () => {
        void onSyncRef.current();
      },
    });
  };

  return (
    <div className="midtrans-atelier-frame">
      <div className="midtrans-atelier-frame-head">
        <div className="midtrans-atelier-brand">
          <span className="midtrans-atelier-eyebrow">
            VALERIE &amp; CO × MIDTRANS
          </span>
          <div className="midtrans-atelier-badges">
            <span className="midtrans-env-pill">
              <ShieldCheck size={12} />{" "}
              {sandbox ? "SANDBOX LIVE" : "MIDTRANS LIVE"}
            </span>
            <span className="midtrans-lock-pill">
              <LockKeyhole size={12} /> TLS 256-BIT
            </span>
          </div>
        </div>
        <div className="midtrans-atelier-amount">
          <div>
            <small>{t("No. Pesanan")}</small>
            <strong>#{orderId.replace(/^SOL-/, "").slice(0, 8)}</strong>
          </div>
          <div className="is-right">
            <small>{t("Total Tagihan")}</small>
            <strong>{totalText}</strong>
          </div>
        </div>
      </div>

      <div className="midtrans-atelier-stage">
        {effectivePhase === "loading" && (
          <div className="midtrans-stage-loading" aria-live="polite">
            <span className="midtrans-spinner" aria-hidden="true" />
            <strong>{t("Menghubungkan ke Midtrans Snap...")}</strong>
            <small>
              {t("QRIS, GoPay, ShopeePay, Virtual Account & Kartu 3DS siap dimuat inline.")}
            </small>
          </div>
        )}

        <div
          id={embedId}
          ref={containerRef}
          className="midtrans-snap-mount"
        />

        {effectivePhase === "error" && (
          <div className="midtrans-stage-fallback">
            <strong>{t("Panel Midtrans Snap Perlu Dimuat Ulang")}</strong>
            <p>{effectiveMessage}</p>
            <div className="midtrans-stage-fallback-actions">
              <button
                type="button"
                className="btn-atelier-primary"
                onClick={() => {
                  if (!resolvedToken) {
                    void onSyncStatus();
                  } else {
                    setPhase("loading");
                    setReloadTick((n) => n + 1);
                  }
                }}
              >
                {t("Aktifkan Panel Midtrans")}
              </button>
              {paymentUrl && (
                <a
                  href={paymentUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-atelier-outline"
                >
                  {t("Buka Halaman Midtrans")}
                </a>
              )}
            </div>
          </div>
        )}
      </div>

      {effectiveMessage && effectivePhase !== "error" && (
        <div
          className={`midtrans-stage-status${effectivePhase === "pending" ? " is-pending" : ""}`}
        >
          <Check size={14} />
          <span>{effectiveMessage}</span>
        </div>
      )}

      <div className="midtrans-atelier-foot">
        <button
          type="button"
          className="btn-atelier-primary"
          disabled={checkingStatus}
          onClick={() => void onSyncStatus()}
        >
          {checkingStatus
            ? t("Memeriksa Midtrans...")
            : t("Periksa Status Pembayaran")}
        </button>
        <div className="midtrans-atelier-foot-secondary">
          {resolvedToken && (
            <button
              type="button"
              className="btn-atelier-outline"
              onClick={openSnapPopup}
            >
              {t("Buka Pop-up Snap")}
            </button>
          )}
          <button
            type="button"
            className="btn-atelier-outline"
            onClick={() => {
              setPhase("loading");
              setReloadTick((n) => n + 1);
            }}
          >
            {t("Muat Ulang Panel")}
          </button>
        </div>
      </div>
    </div>
  );
}
