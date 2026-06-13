import crypto from "crypto";

const JWT_SECRET = process.env.JWT_SECRET || "zevote_secret_key_2026_super_secure_key";

export function signToken(role: "admin" | "panitia"): string {
  const expiry = Date.now() + 12 * 60 * 60 * 1000; // Token berlaku selama 12 jam
  const payload = `${role}:${expiry}`;
  const signature = crypto
    .createHmac("sha256", JWT_SECRET)
    .update(payload)
    .digest("hex");
  return `${payload}.${signature}`;
}

export function verifyToken(token: string | null): "admin" | "panitia" | null {
  if (!token) return null;
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [payload, signature] = parts;
    const expectedSignature = crypto
      .createHmac("sha256", JWT_SECRET)
      .update(payload)
      .digest("hex");
    if (signature !== expectedSignature) return null;

    const [role, expiryStr] = payload.split(":");
    const expiry = parseInt(expiryStr, 10);
    if (Date.now() > expiry) return null;

    if (role === "admin" || role === "panitia") {
      return role;
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Alias untuk verifyToken, mengembalikan object payload dengan role.
 * Digunakan oleh API route yang membutuhkan info role.
 */
export function verifyAdminToken(token: string | null): { role: "admin" | "panitia" } | null {
  const role = verifyToken(token);
  if (!role) return null;
  return { role };
}

