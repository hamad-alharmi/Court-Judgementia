// ===== Judgementia — 4-letter chamber code codec =====

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I, O, 0, 1 for legibility

export function generateChamberCode(length = 4): string {
  let out = "";
  const buf = new Uint32Array(length);
  crypto.getRandomValues(buf);
  for (let i = 0; i < length; i++) {
    out += ALPHABET[buf[i] % ALPHABET.length];
  }
  return out;
}

export function isValidChamberCode(code: string): boolean {
  return /^[A-Z2-9]{4}$/.test(code.toUpperCase());
}

export function normalizeCode(code: string): string {
  return code.toUpperCase().trim();
}
