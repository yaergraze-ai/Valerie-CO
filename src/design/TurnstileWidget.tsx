import { useEffect, useId, useRef, useState } from "react";

type TurnstileApi = {
  render: (
    container: HTMLElement | string,
    options: {
      sitekey: string;
      theme?: "light" | "dark" | "auto";
      size?: "normal" | "compact" | "flexible";
      callback?: (token: string) => void;
      "expired-callback"?: () => void;
      "error-callback"?: () => void;
    },
  ) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId?: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let turnstileLoader: Promise<TurnstileApi> | null = null;

function loadTurnstileScript(): Promise<TurnstileApi> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Turnstile requires browser environment"));
  }
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (turnstileLoader) return turnstileLoader;
  turnstileLoader = new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement("script");
    script.src =
      "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.turnstile) {
        resolve(window.turnstile);
      } else {
        turnstileLoader = null;
        reject(new Error("Cloudflare Turnstile unavailable"));
      }
    };
    script.onerror = () => {
      script.remove();
      turnstileLoader = null;
      reject(new Error("Failed to load Cloudflare Turnstile"));
    };
    document.head.appendChild(script);
  });
  return turnstileLoader;
}

export function TurnstileWidget({
  siteKey,
  resetSignal = 0,
  onToken,
  onExpired,
  compact = false,
  className = "",
}: {
  siteKey?: string | null;
  resetSignal?: number;
  onToken: (token: string) => void;
  onExpired?: () => void;
  compact?: boolean;
  className?: string;
}) {
  const hostId = useId();
  const hostRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const tokenCbRef = useRef(onToken);
  const expiredCbRef = useRef(onExpired);
  useEffect(() => {
    tokenCbRef.current = onToken;
    expiredCbRef.current = onExpired;
  }, [onToken, onExpired]);
  const [failed, setFailed] = useState(false);

  const key = String(siteKey || "").trim();

  useEffect(() => {
    if (!key) {
      tokenCbRef.current("");
      return;
    }
    const mountState = { cancelled: false };
    loadTurnstileScript()
      .then((api) => {
        if (mountState.cancelled || !hostRef.current) return;
        if (widgetIdRef.current) {
          try {
            api.remove(widgetIdRef.current);
          } catch {}
          widgetIdRef.current = null;
        }
        widgetIdRef.current = api.render(hostRef.current, {
          sitekey: key,
          theme: "light",
          size: compact ? "compact" : "flexible",
          callback: (token: string) => {
            setFailed(false);
            tokenCbRef.current(token);
          },
          "expired-callback": () => {
            tokenCbRef.current("");
            expiredCbRef.current?.();
          },
          "error-callback": () => {
            tokenCbRef.current("");
            setFailed(true);
          },
        });
      })
      .catch(() => {
        if (!mountState.cancelled) {
          tokenCbRef.current("");
          setFailed(true);
        }
      });
    return () => {
      mountState.cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {}
        widgetIdRef.current = null;
      }
    };
  }, [key, compact]);

  useEffect(() => {
    if (!key || !resetSignal) return;
    tokenCbRef.current("");
    if (widgetIdRef.current && window.turnstile) {
      try {
        window.turnstile.reset(widgetIdRef.current);
      } catch {}
    }
  }, [key, resetSignal]);

  if (!key) return null;

  return (
    <div className={`vco-turnstile-wrap ${className}`.trim()} id={hostId}>
      <div ref={hostRef} className="vco-turnstile-slot" />
      {failed && (
        <p className="vco-turnstile-err" role="alert">
          Verifikasi Cloudflare tidak dapat dimuat. Muat ulang halaman atau periksa koneksi Anda.
        </p>
      )}
    </div>
  );
}
