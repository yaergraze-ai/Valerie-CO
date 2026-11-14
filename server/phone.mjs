/**
 * Shared canonical WhatsApp / phone normalization helpers.
 * Converts Indonesian (`08...`, `8...`, `62...`, `+6208...`) and E.164 formats
 * into one canonical `+digits` key so duplicate phone detection works identically
 * across auth endpoints, SQLite, and Supabase.
 */

export function canonicalPhoneDigits(raw) {
  if (typeof raw !== "string" || !raw.trim()) return "";
  const cleaned = raw.replace(/[^\d+]/g, "");
  let rawDigits = cleaned.replace(/^\+/, "");
  if (rawDigits.startsWith("00")) rawDigits = rawDigits.slice(2);
  if (rawDigits.startsWith("6208")) rawDigits = `62${rawDigits.slice(3)}`;
  else if (rawDigits.startsWith("08")) rawDigits = `62${rawDigits.slice(1)}`;
  else if (rawDigits.startsWith("8")) rawDigits = `62${rawDigits}`;
  return /^\d{9,15}$/.test(rawDigits) ? rawDigits : "";
}

export function normalizeCanonicalPhone(raw, onInvalid) {
  if (typeof raw !== "string" || !raw.trim()) return "";
  const digits = canonicalPhoneDigits(raw);
  if (!digits) {
    if (onInvalid) return onInvalid();
    return "";
  }
  return `+${digits}`;
}

export function phoneLookupCandidates(raw) {
  const digits = canonicalPhoneDigits(raw);
  if (!digits) return raw && typeof raw === "string" && raw.trim() ? [raw.trim()] : [];
  const candidates = new Set([`+${digits}`, digits]);
  if (digits.startsWith("62") && digits.length >= 10) {
    candidates.add(`0${digits.slice(2)}`);
    candidates.add(digits.slice(2));
    if (digits.startsWith("628")) candidates.add(`+620${digits.slice(2)}`);
  }
  return [...candidates];
}
