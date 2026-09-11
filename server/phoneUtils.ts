/**
 * Backend Phone Utilities for strict phone normalization and deduplication
 */

export function normalizePhoneNumber(raw: string | number | undefined | null): string {
  if (raw === undefined || raw === null) return "";
  let digits = String(raw).replace(/[^0-9]/g, "");
  if (!digits) return "";

  // Strip international prefix '00'
  if (digits.startsWith("00")) {
    digits = digits.substring(2);
  }

  // Egypt: 010, 011, 012, 015 (11 digits starting with 01) -> convert to 201...
  if (digits.length === 11 && /^01[0125]/.test(digits)) {
    return "20" + digits.substring(1);
  }

  // Egypt: 10 digits starting with 10, 11, 12, 15 -> convert to 201...
  if (digits.length === 10 && /^1[0125]/.test(digits)) {
    return "20" + digits;
  }

  // Saudi Arabia: 10 digits starting with 05 -> convert to 9665...
  if (digits.length === 10 && digits.startsWith("05")) {
    return "966" + digits.substring(1);
  }

  // Saudi Arabia: 9 digits starting with 5 -> convert to 9665...
  if (digits.length === 9 && digits.startsWith("5")) {
    return "966" + digits;
  }

  // UAE: 10 digits starting with 05 -> convert to 9715...
  if (digits.length === 10 && /^05[024568]/.test(digits)) {
    return "971" + digits.substring(1);
  }

  // General leading zero removal if long enough
  if (digits.startsWith("0") && digits.length >= 10) {
    digits = digits.substring(1);
  }

  return digits;
}

export function isSamePhoneNumber(phoneA: string | undefined | null, phoneB: string | undefined | null): boolean {
  if (!phoneA || !phoneB) return false;
  const normA = normalizePhoneNumber(phoneA);
  const normB = normalizePhoneNumber(phoneB);
  if (!normA || !normB) return false;
  if (normA === normB) return true;

  const rawA = String(phoneA).replace(/[^0-9]/g, "");
  const rawB = String(phoneB).replace(/[^0-9]/g, "");
  if (rawA.length >= 9 && rawB.length >= 9) {
    if (rawA.endsWith(rawB) || rawB.endsWith(rawA)) {
      return true;
    }
  }

  return false;
}
