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
