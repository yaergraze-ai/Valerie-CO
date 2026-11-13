import { OAuth2Client } from "google-auth-library";
import nodemailer from "nodemailer";
const google = new OAuth2Client();
export async function verifyGoogle(credential, audience) {
  const ticket = await google.verifyIdToken({ idToken: credential, audience });
  return ticket.getPayload();
}
export function resetMailer(env = process.env) {
  if (!env.SMTP_HOST || !env.MAIL_FROM) return null;
  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: Number(env.SMTP_PORT || 587),
    secure: env.SMTP_PORT === "465",
    requireTLS: env.SMTP_PORT !== "465",
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    auth: env.SMTP_USER
      ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD }
      : undefined,
  });
  return (to, token, custom) =>
    transport.sendMail({
      from: env.MAIL_FROM,
      to,
      subject:
        custom?.subject ||
        "Valerie & CO — Reset password / Atur ulang kata sandi",
      text:
        custom?.text ||
        `Kode pemulihan / Recovery code:\n${token}\n\nBerlaku 15 menit, sekali pakai. / Valid for 15 minutes, one use.\nBuka halaman Masuk > Lupa kata sandi > Saya punya kode. / Open Sign in > Forgot password > I have a code.\nAbaikan jika Anda tidak meminta ini. / Ignore if you did not request this.`,
    });
}

/**
 * Send WhatsApp OTP/messages via Fonnte HTTP API when FONNTE_TOKEN is configured.
 */
export function whatsappMailer(env = process.env, fetchImpl = fetch) {
  const token = String(env.FONNTE_TOKEN || "").trim();
  if (!token) return null;
  const endpoint =
    String(env.FONNTE_URL || "").trim() || "https://api.fonnte.com/send";
  return async (phone, message) => {
    const target = String(phone || "").replace(/[^\d]/g, "");
    if (!target) throw Error("Invalid WhatsApp target");
    const body = new URLSearchParams({
      target,
      message: String(message || ""),
      countryCode: "0",
    });
    const res = await fetchImpl(endpoint, {
      method: "POST",
      headers: { Authorization: token },
      body,
      signal: AbortSignal.timeout(10000),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || data?.status === false) {
      throw Error(
        data?.reason ||
          data?.detail ||
          data?.message ||
          `WhatsApp delivery failed (${res.status})`,
      );
    }
    return data;
  };
}
