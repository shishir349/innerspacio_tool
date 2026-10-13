import "server-only";
import { randomBytes, createHash } from "crypto";

/**
 * Generates a fresh presentation-link token: 256 bits of entropy from
 * `crypto.randomBytes`, base64url-encoded (URL-safe, no padding). This is
 * the only form of the token a client ever sees — it's returned once at
 * creation time and is never stored anywhere, only its hash is.
 */
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * SHA-256 is intentionally used here, not a slow password hash (bcrypt/
 * argon2/scrypt) — this isn't a low-entropy human password being hashed to
 * resist brute force; it's a 256-bit random token, which is already
 * infeasible to guess or brute force regardless of hash speed. SHA-256 just
 * needs to be a one-way function so a database read alone can't be used to
 * reconstruct a working link.
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
