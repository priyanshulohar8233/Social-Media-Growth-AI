import crypto from "crypto";
import { envStr } from "./env";

/**
 * Derives a 256-bit encryption key from ENCRYPTION_SECRET or falls back to JWT_SECRET / dev secret.
 */
function getEncryptionKey(): Buffer {
  const secret = envStr("ENCRYPTION_SECRET") || envStr("JWT_SECRET") || "dev-encryption-secret-braingrow-32chars-min";
  return crypto.createHash("sha256").update(secret).digest();
}

/**
 * Encrypts plaintext using AES-256-GCM.
 * Returns format: ivHex:authTagHex:encryptedHex
 */
export function encryptToken(text: string): string {
  if (!text) return text;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

/**
 * Decrypts AES-256-GCM ciphertext formatted as ivHex:authTagHex:encryptedHex.
 * Gracefully returns original text if it does not match encrypted format (for backwards compatibility).
 */
export function decryptToken(cipherText: string): string {
  if (!cipherText) return cipherText;
  const parts = cipherText.split(":");
  if (parts.length !== 3) {
    // Legacy plain token or unsupported format
    return cipherText;
  }
  try {
    const [ivHex, authTagHex, encryptedHex] = parts;
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const decipher = crypto.createDecipheriv("aes-256-gcm", getEncryptionKey(), iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedHex, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (err) {
    console.error("[crypto] Decryption failed:", err);
    return "";
  }
}

/**
 * Hashes a token using SHA-256 so that plaintext tokens are never stored in the database.
 */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Generates a cryptographically secure URL-safe random token.
 */
export function generateSecureToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("hex");
}
