import { useEffect, useId, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Eye,
  EyeOff,
  Mail,
  Smartphone,
} from "lucide-react";
import { useStore } from "./store";
import { api } from "./backend";

type GoogleIdentity = {
  initialize: (options: {
    client_id: string;
    nonce: string;
    callback: (r: { credential: string }) => void;
  }) => void;
  renderButton: (
    element: HTMLElement,
    options: Record<string, string | number>,
  ) => void;
};
declare global {
  interface Window {
    google?: { accounts: { id: GoogleIdentity } };
  }
}

let googleScript: Promise<void> | undefined;
function loadGoogle() {
  return (googleScript ||= new Promise<void>((resolve, reject) => {
    if (window.google) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      script.remove();
      googleScript = undefined;
      reject(Error("Google unavailable"));
    };
    document.head.append(script);
  }));
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function translateAuthError(
  raw: string,
  t: (id: string, en: string) => string,
) {
  const m = raw.toLowerCase();
  if (m.includes("credentials or password"))
    return t(
      "Email / No. WhatsApp atau kata sandi salah.",
      "Incorrect email / WhatsApp number or password.",
    );
  if (m.includes("email is already registered"))
    return t(
      "Email sudah terdaftar. Silakan masuk atau gunakan email lain.",
      "Email is already registered. Sign in or use another email.",
    );
  if (m.includes("whatsapp number is already registered"))
    return t(
      "Nomor WhatsApp sudah terdaftar. Silakan masuk.",
      "WhatsApp number is already registered. Please sign in.",
    );
  if (m.includes("invalid whatsapp number"))
    return t(
      "Format nomor WhatsApp tidak valid. Gunakan angka 9–15 digit (mis. 08123456789).",
      "Invalid WhatsApp number format. Use 9–15 digits (e.g. 08123456789).",
    );
  if (m.includes("password must be at least 8"))
    return t(
      "Kata sandi minimal 8 karakter.",
      "Password must be at least 8 characters.",
    );
  if (m.includes("invalid setup token"))
    return t(
      "Kode aktivasi Studio Admin tidak valid.",
      "Invalid Studio Admin activation token.",
    );
  if (m.includes("admin already exists"))
    return t(
      "Akun admin sudah ada. Silakan masuk dengan email & kata sandi admin.",
      "Admin account already exists. Sign in with your admin email and password.",
    );
  if (m.includes("recovery code is invalid"))
    return t(
      "Kode pemulihan tidak valid atau sudah kedaluwarsa.",
      "Recovery code is invalid or expired.",
    );
  if (m.includes("too many attempts"))
    return t(
      "Terlalu banyak percobaan login. Tunggu 1 menit lalu coba lagi.",
      "Too many sign-in attempts. Wait a minute and try again.",
    );
  if (m.includes("too many wrong codes"))
    return t(
      "Terlalu banyak kode OTP salah. Silakan kirim ulang kode baru.",
      "Too many wrong OTP codes. Request a new code.",
    );
  if (m.includes("verification code expired"))
    return t(
      "Kode OTP kedaluwarsa atau belum diminta. Silakan kirim ulang kode baru.",
      "OTP code expired or not requested. Request a new code.",
    );
  if (m.includes("invalid verification code"))
    return t(
      "Kode OTP tidak cocok. Periksa kembali kode 6 digit Anda.",
      "Invalid OTP code. Check your 6-digit code and try again.",
    );
  if (m.includes("whatsapp otp gateway"))
    return t(
      "Gateway WhatsApp OTP (FONNTE_TOKEN) belum dikonfigurasi pada server.",
      "WhatsApp OTP gateway (FONNTE_TOKEN) is not configured on the server.",
    );
  if (m.includes("email otp service"))
    return t(
      "Layanan Email OTP (SMTP) belum dikonfigurasi pada server.",
      "Email OTP service (SMTP) is not configured on the server.",
    );
  if (m.includes("failed to send"))
    return t(
      "Gagal mengirim kode OTP. Pastikan nomor/email dan konfigurasi pengirim sudah benar.",
      "Failed to deliver OTP code. Verify your contact and gateway configuration.",
    );
  return raw;
}

function normalizeWhatsappInput(raw: string) {
  const cleaned = raw.replace(/[^\d+]/g, "");
  const digits = cleaned.replace(/^\+/, "");
  if (digits.startsWith("08")) return `+62${digits.slice(1)}`;
  if (digits.startsWith("8")) return `+62${digits}`;
  return digits ? `+${digits}` : "";
}

function GoogleAuthSection({
  mode,
  onDone,
}: {
  mode: "login" | "register";
  onDone: () => void;
}) {
  const { t, refresh, serverMode, notify } = useStore();
  const ref = useRef<HTMLDivElement>(null);
  const done = useRef(onDone);
  const refreshRef = useRef(refresh);
  const tRef = useRef(t);
  useEffect(() => {
    done.current = onDone;
    refreshRef.current = refresh;
    tRef.current = t;
  }, [onDone, refresh, t]);

  const [sdkStatus, setSdkStatus] = useState<
    "checking" | "ready" | "unconfigured" | "error"
  >(serverMode ? "checking" : "unconfigured");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!serverMode) {
      setSdkStatus("unconfigured");
      return;
    }
    const lifecycle = new AbortController();
    void api("auth/config")
      .then(async (config) => {
        if (!config.googleClientId) {
          if (!lifecycle.signal.aborted) setSdkStatus("unconfigured");
          return;
        }
        await loadGoogle();
        if (lifecycle.signal.aborted || !ref.current) return;
        window.google!.accounts.id.initialize({
          client_id: config.googleClientId,
          nonce: config.nonce,
          callback: async ({ credential }) => {
            try {
              await api("auth/google", { credential });
              await refreshRef.current();
              notify("Masuk dengan Google berhasil", "Signed in with Google");
              done.current();
            } catch (e) {
              setError(translateAuthError((e as Error).message, tRef.current));
            }
          },
        });
        ref.current.replaceChildren();
        window.google!.accounts.id.renderButton(ref.current, {
          theme: "outline",
          size: "large",
          text: mode === "register" ? "signup_with" : "continue_with",
          shape: "pill",
          width: 310,
        });
        setSdkStatus("ready");
      })
      .catch(() => {
        if (!lifecycle.signal.aborted) setSdkStatus("error");
      });
    return () => lifecycle.abort();
  }, [serverMode, mode, notify]);

  return (
    <div className="auth-google">
      <div
        ref={ref}
        style={{ display: sdkStatus === "ready" ? "block" : "none" }}
      />
      {sdkStatus !== "ready" && (
        <button
          type="button"
          className="auth-google-btn"
          disabled={sdkStatus === "checking"}
          onClick={() => {
            setError(
              !serverMode
                ? t(
                    "Backend autentikasi belum aktif. Jalankan server terlebih dahulu.",
                    "Authentication backend is offline. Start the server first.",
                  )
                : sdkStatus === "error"
                  ? t(
                      "Gagal terhubung ke server Google Sign-In. Periksa koneksi server & GOOGLE_CLIENT_ID.",
                      "Unable to reach Google Sign-In server. Check server connection & GOOGLE_CLIENT_ID.",
                    )
                  : t(
                      "Google OAuth belum dikonfigurasi pada server (.env GOOGLE_CLIENT_ID). Gunakan Email atau No. WhatsApp di atas.",
                      "Google OAuth is not configured on the server (.env GOOGLE_CLIENT_ID). Please use Email or WhatsApp above.",
                    ),
            );
          }}
        >
          <GoogleMark />
          <span>
            {sdkStatus === "checking"
              ? t("Menghubungkan Google…", "Connecting Google…")
              : mode === "register"
                ? t("Daftar dengan Google", "Continue with Google")
                : t("Lanjutkan dengan Google", "Continue with Google")}
          </span>
        </button>
      )}
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
    </div>
  );
}

export function MemberEntry({
  onDone,
  admin = false,
}: {
  onDone: () => void;
  admin?: boolean;
}) {
  const {
    t,
    authenticate,
    requestAuthOtp,
    verifyAuthOtp,
    needsAdmin,
    serverMode,
  } = useStore();
  const pillGroupId = useId();
  const [mode, setMode] = useState<
    "login" | "register" | "setup" | "forgot" | "reset"
  >(admin && needsAdmin ? "setup" : "login");
  const [channel, setChannel] = useState<"email" | "whatsapp">("email");
  const [authMethod, setAuthMethod] = useState<"password" | "otp">("password");
  const [otpSent, setOtpSent] = useState(false);
  const [otpTarget, setOtpTarget] = useState("");
  const [otpDisplayTarget, setOtpDisplayTarget] = useState("");
  const [otpNameDraft, setOtpNameDraft] = useState("");
  const [otpNeedsName, setOtpNeedsName] = useState(false);
  const [otpPreview, setOtpPreview] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const resetOtpState = () => {
    setOtpSent(false);
    setOtpTarget("");
    setOtpDisplayTarget("");
    setOtpNameDraft("");
    setOtpNeedsName(false);
    setOtpPreview("");
    setOtpCode("");
  };
  const changeMode = (next: typeof mode) => {
    setMode(next);
    resetOtpState();
    setError("");
    setMessage("");
  };
  const changeChannel = (next: "email" | "whatsapp") => {
    setChannel(next);
    resetOtpState();
    setError("");
    setMessage("");
  };
  const changeMethod = (next: "password" | "otp") => {
    setAuthMethod(next);
    resetOtpState();
    setError("");
    setMessage("");
  };

  const creating = mode === "register" || mode === "setup";
  const showMethodToggles = !admin && (mode === "login" || mode === "register");
  const usingOtp = showMethodToggles && authMethod === "otp";
  const passwordNeeded = mode !== "forgot" && !usingOtp;
  const showContactField = mode !== "reset" && !(usingOtp && otpSent);
  const showNameField = creating
    ? !(usingOtp && otpSent)
    : usingOtp && otpSent && otpNeedsName;
  const minPasswordLen = 8;

  const sendOtpForContact = async (target: string, display: string) => {
    const ch = channel === "whatsapp" ? "phone" : "email";
    const res = await requestAuthOtp({
      channel: ch,
      email: ch === "email" ? target : undefined,
      phone: ch === "phone" ? target : undefined,
    });
    setOtpTarget(target);
    setOtpDisplayTarget(display);
    setOtpSent(true);
    setOtpPreview(res.previewCode || "");
    setOtpCode("");
    setMessage(
      res.sent
        ? channel === "whatsapp"
          ? t(
              "Kode OTP 6 digit telah dikirim ke WhatsApp Anda.",
              "A 6-digit OTP was sent to your WhatsApp.",
            )
          : t(
              "Kode OTP 6 digit telah dikirim ke email Anda.",
              "A 6-digit OTP was sent to your email.",
            )
        : t(
            "Masukkan kode OTP 6 digit di bawah.",
            "Enter the 6-digit OTP code below.",
          ),
    );
  };

  return (
    <div className={`member-entry auth-entry ${creating ? "is-creating" : ""}`}>
      <span className="eyebrow">
        {admin ? "VALERIE & CO STUDIO" : "VALERIE & CO MEMBERS"}
      </span>
      <h3>
        {mode === "login"
          ? t("Masuk ke akun.", "Welcome back.")
          : mode === "register"
            ? t("Buat akun baru.", "Create account.")
            : mode === "setup"
              ? t("Siapkan studio Anda.", "Set up your studio.")
              : t("Pulihkan akun.", "Recover account.")}
      </h3>

      {showMethodToggles && (
        <>
          <div
            className="auth-segmented"
            role="tablist"
            aria-label={t("Mode autentikasi", "Authentication mode")}
          >
            {(
              [
                ["login", t("Masuk", "Sign in")],
                ["register", t("Daftar", "Register")],
              ] as const
            ).map(([mKey, mLabel]) => (
              <button
                key={mKey}
                type="button"
                role="tab"
                aria-selected={mode === mKey}
                className={mode === mKey ? "active" : ""}
                onClick={() => changeMode(mKey)}
              >
                {mode === mKey && (
                  <motion.span
                    layoutId={`${pillGroupId}-mode`}
                    className="auth-pill-indicator"
                    transition={{ type: "spring", stiffness: 480, damping: 34 }}
                  />
                )}
                <span>{mLabel}</span>
              </button>
            ))}
          </div>
          <div className="auth-method-row">
            <span>{t("Metode masuk:", "Sign-in method:")}</span>
            <span
              className="auth-channel-mini"
              role="tablist"
              aria-label={t("Metode verifikasi", "Authentication method")}
            >
              <button
                type="button"
                role="tab"
                aria-selected={authMethod === "password"}
                className={authMethod === "password" ? "active" : ""}
                onClick={() => changeMethod("password")}
              >
                <span>{t("Kata sandi", "Password")}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={authMethod === "otp"}
                className={authMethod === "otp" ? "active" : ""}
                onClick={() => changeMethod("otp")}
              >
                <span>{t("Kode OTP", "OTP Code")}</span>
              </button>
            </span>
          </div>
        </>
      )}

      <form
        className="form-stack"
        key={`${mode}-${channel}-${authMethod}`}
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          setMessage("");
          if (!serverMode) {
            setError(
              t(
                "Backend server belum terhubung. Jalankan backend (`npm start` atau `npm run dev`) agar autentikasi terverifikasi di server.",
                "Backend server is disconnected. Start the server (`npm start` or `npm run dev`) for verified server authentication.",
              ),
            );
            return;
          }
          const f = new FormData(e.currentTarget);
          const password = String(f.get("password") || "");
          const rawPhone = String(f.get("phone") || "").trim();
          const rawEmail = String(f.get("email") || "").trim();
          const normalizedPhone =
            showMethodToggles && channel === "whatsapp"
              ? normalizeWhatsappInput(rawPhone)
              : "";

          if (!usingOtp || !otpSent) {
            if (showMethodToggles && channel === "whatsapp") {
              const digits = normalizedPhone.replace(/\D/g, "");
              if (digits.length < 10 || digits.length > 15) {
                setError(
                  t(
                    "Masukkan nomor WhatsApp yang valid (contoh: 081234567890).",
                    "Enter a valid WhatsApp number (e.g. 081234567890).",
                  ),
                );
                return;
              }
            }
          }

          if (!usingOtp && creating && password.length < minPasswordLen) {
            setError(
              t(
                `Kata sandi minimal ${minPasswordLen} karakter.`,
                `Password must be at least ${minPasswordLen} characters.`,
              ),
            );
            return;
          }

          if (
            !usingOtp &&
            (creating || mode === "reset") &&
            password !== f.get("confirm")
          ) {
            setError(
              t(
                "Konfirmasi kata sandi tidak cocok.",
                "Passwords do not match.",
              ),
            );
            return;
          }

          setBusy(true);
          try {
            if (usingOtp) {
              if (!otpSent) {
                if (creating) {
                  setOtpNameDraft(String(f.get("name") || "").trim());
                }
                const target =
                  channel === "whatsapp" ? normalizedPhone : rawEmail;
                const display = channel === "whatsapp" ? rawPhone : rawEmail;
                await sendOtpForContact(target, display);
              } else {
                const nameVal = String(
                  f.get("name") || otpNameDraft || "",
                ).trim();
                const ch = channel === "whatsapp" ? "phone" : "email";
                const res = await verifyAuthOtp({
                  channel: ch,
                  email: ch === "email" ? otpTarget : undefined,
                  phone: ch === "phone" ? otpTarget : undefined,
                  code: otpCode.trim(),
                  name: nameVal || undefined,
                });
                if (res && "needsName" in res && res.needsName) {
                  setOtpNeedsName(true);
                  setMessage(
                    t(
                      "Kontak baru terdeteksi — masukkan nama lengkap Anda lalu klik Verifikasi lagi.",
                      "New contact detected — enter your full name and click Verify again.",
                    ),
                  );
                  return;
                }
                onDone();
              }
            } else if (mode === "forgot") {
              await api("auth/forgot", { email: rawEmail });
              setMessage(
                t(
                  "Jika email terdaftar, kode pemulihan telah dikirim. Periksa juga folder spam.",
                  "If the email is registered, a recovery code has been sent. Check your spam folder too.",
                ),
              );
            } else if (mode === "reset") {
              await api("auth/reset", { token: f.get("token"), password });
              changeMode("login");
              setMessage(
                t(
                  "Kata sandi diperbarui. Silakan masuk dengan kata sandi baru.",
                  "Password updated. Please sign in with your new password.",
                ),
              );
            } else {
              await authenticate(mode, {
                name: String(f.get("name") || "").trim(),
                email: channel === "email" || admin ? rawEmail : "",
                phone: channel === "whatsapp" && !admin ? normalizedPhone : "",
                password,
                setupToken: String(f.get("token") || "").trim(),
              });
              onDone();
            }
          } catch (err) {
            setError(translateAuthError((err as Error).message, t));
          } finally {
            setBusy(false);
          }
        }}
      >
            {showNameField && (
              <label>
                {t("Nama lengkap", "Full name")}
                <input
                  name="name"
                  required
                  minLength={2}
                  maxLength={120}
                  autoComplete="name"
                  placeholder={t("Nama Anda", "Your full name")}
                />
              </label>
            )}

            {showContactField && (
              <div className="auth-field">
                <div className="auth-field-head">
                  <label htmlFor={`${pillGroupId}-contact`}>
                    {channel === "whatsapp" && showMethodToggles
                      ? t("Nomor WhatsApp", "WhatsApp number")
                      : "Email"}
                  </label>
                  {showMethodToggles && (
                    <span
                      className="auth-channel-mini"
                      role="tablist"
                      aria-label={t("Metode kontak", "Contact channel")}
                    >
                      <button
                        type="button"
                        role="tab"
                        aria-selected={channel === "email"}
                        className={channel === "email" ? "active" : ""}
                        onClick={() => changeChannel("email")}
                      >
                        <Mail size={11} aria-hidden="true" />
                        <span>Email</span>
                      </button>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={channel === "whatsapp"}
                        className={channel === "whatsapp" ? "active" : ""}
                        onClick={() => changeChannel("whatsapp")}
                      >
                        <Smartphone size={11} aria-hidden="true" />
                        <span>WhatsApp</span>
                      </button>
                    </span>
                  )}
                </div>
                {channel === "whatsapp" && showMethodToggles ? (
                  <span className="wa-input-wrap">
                    <span className="wa-prefix">WA +62</span>
                    <input
                      id={`${pillGroupId}-contact`}
                      name="phone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      required
                      placeholder="0812-3456-7890"
                    />
                  </span>
                ) : (
                  <input
                    id={`${pillGroupId}-contact`}
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="nama@email.com"
                  />
                )}
              </div>
            )}

            {usingOtp && otpSent && (
              <>
                <div className="auth-otp-target">
                  <span>
                    {channel === "whatsapp" ? "WhatsApp" : "Email"} ·{" "}
                    <strong>{otpDisplayTarget}</strong>
                  </span>
                  <span className="auth-otp-links">
                    <button
                      type="button"
                      className="text-link auth-forgot-inline"
                      disabled={busy}
                      onClick={async () => {
                        setError("");
                        setBusy(true);
                        try {
                          await sendOtpForContact(otpTarget, otpDisplayTarget);
                        } catch (err) {
                          setError(translateAuthError((err as Error).message, t));
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      {t("Kirim ulang", "Resend")}
                    </button>
                    <button
                      type="button"
                      className="text-link auth-forgot-inline"
                      disabled={busy}
                      onClick={() => {
                        resetOtpState();
                        setError("");
                        setMessage("");
                      }}
                    >
                      {t("Ubah", "Edit")}
                    </button>
                  </span>
                </div>
                {otpPreview && (
                  <small className="otp-preview-code">
                    {t("Kode OTP:", "Code:")} <b>{otpPreview}</b>
                  </small>
                )}
                <label>
                  {t("Kode OTP 6 digit", "6-digit OTP code")}
                  <input
                    name="otp"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    required
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    placeholder="6 digit OTP"
                  />
                </label>
              </>
            )}

            {passwordNeeded && (
              <div
                className={
                  creating || mode === "reset" ? "auth-password-pair" : ""
                }
              >
                <div className="auth-field">
                  <div className="auth-field-head">
                    <label htmlFor={`${pillGroupId}-password`}>
                      {t("Kata sandi", "Password")}
                    </label>
                    {mode === "login" && channel === "email" && (
                      <button
                        type="button"
                        className="text-link auth-forgot-inline"
                        onClick={() => changeMode("forgot")}
                      >
                        {t("Lupa sandi?", "Forgot?")}
                      </button>
                    )}
                  </div>
                  <span className="password-field">
                    <input
                      id={`${pillGroupId}-password`}
                      name="password"
                      type={visible ? "text" : "password"}
                      required
                      minLength={mode === "login" ? 1 : minPasswordLen}
                      maxLength={256}
                      autoComplete={
                        mode === "login" ? "current-password" : "new-password"
                      }
                      placeholder={
                        creating || mode === "reset"
                          ? t(`Min. ${minPasswordLen} kar.`, `Min. ${minPasswordLen} chars`)
                          : "••••••••"
                      }
                    />
                    <button
                      type="button"
                      aria-label={
                        visible
                          ? t("Sembunyikan kata sandi", "Hide password")
                          : t("Tampilkan kata sandi", "Show password")
                      }
                      aria-pressed={visible}
                      onClick={() => setVisible(!visible)}
                    >
                      {visible ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </span>
                </div>

                {(creating || mode === "reset") && (
                  <div className="auth-field">
                    <div className="auth-field-head">
                      <label htmlFor={`${pillGroupId}-confirm`}>
                        {t("Konfirmasi", "Confirm")}
                      </label>
                    </div>
                    <input
                      id={`${pillGroupId}-confirm`}
                      name="confirm"
                      type={visible ? "text" : "password"}
                      required
                      minLength={minPasswordLen}
                      maxLength={256}
                      autoComplete="new-password"
                      placeholder={t("Ulangi sandi", "Repeat")}
                    />
                  </div>
                )}
              </div>
            )}

            {(mode === "setup" || mode === "reset") && (
              <label>
                {mode === "setup"
                  ? t("Kode aktivasi Studio Admin", "Admin Studio activation token")
                  : t("Kode pemulihan dari email", "Recovery code from email")}
                <input name="token" required autoComplete="off" />
              </label>
            )}

            {error && (
              <p role="alert" className="error-text">
                {error}
              </p>
            )}
            {message && (
              <p role="status" className="auth-message">
                {message}
              </p>
            )}

            <button className="button dark full" type="submit" disabled={busy}>
              {busy
                ? t("Memproses…", "Please wait…")
                : usingOtp
                  ? otpSent
                    ? t("Verifikasi & lanjutkan", "Verify & continue")
                    : t("Kirim kode OTP", "Send OTP code")
                  : mode === "login"
                    ? t("Masuk sekarang", "Sign in")
                    : mode === "forgot"
                      ? t("Kirim kode pemulihan", "Send recovery code")
                      : mode === "reset"
                        ? t("Simpan kata sandi baru", "Save new password")
                        : t("Daftar sekarang", "Create account")}
              <ArrowRight size={15} />
            </button>
          </form>

          {showMethodToggles && (
            <>
              <div className="auth-divider">
                <span>{t("atau", "or")}</span>
              </div>
              <GoogleAuthSection
                mode={mode === "register" ? "register" : "login"}
                onDone={onDone}
              />
            </>
          )}

          {mode === "forgot" && (
            <div className="auth-recovery-links">
              <button
                type="button"
                className="text-link"
                onClick={() => changeMode("reset")}
              >
                {t("Saya punya kode pemulihan", "I have a recovery code")}
              </button>
              <button
                type="button"
                className="text-link"
                onClick={() => changeMode("login")}
              >
                {t("Kembali ke masuk", "Back to sign in")}
              </button>
            </div>
          )}
          {mode === "reset" && (
            <button
              type="button"
              className="text-link centered"
              onClick={() => changeMode("login")}
            >
              {t("Kembali ke masuk", "Back to sign in")}
            </button>
          )}
    </div>
  );
}
