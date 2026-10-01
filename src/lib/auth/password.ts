import { createHash } from "node:crypto";
import bcrypt from "bcryptjs";

const BCRYPT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export interface PasswordProblem {
  ok: false;
  reason: string;
}

/**
 * Length beats punctuation, so there are no composition rules. A known-breached
 * password is refused via the Have I Been Pwned range API, which never sees the
 * password: only the first five characters of its SHA-1 hash leave the server.
 */
export async function checkPasswordStrength(
  password: string,
): Promise<{ ok: true } | PasswordProblem> {
  if (password.length < 12) {
    return { ok: false, reason: "Use at least 12 characters. A short phrase works well." };
  }
  if (password.length > 200) {
    return { ok: false, reason: "That is longer than 200 characters." };
  }
  try {
    const sha1 = createHash("sha1").update(password).digest("hex").toUpperCase();
    const response = await fetch(`https://api.pwnedpasswords.com/range/${sha1.slice(0, 5)}`, {
      signal: AbortSignal.timeout(3000),
    });
    if (response.ok) {
      const body = await response.text();
      const suffix = sha1.slice(5);
      if (body.split("\n").some((line) => line.split(":")[0]?.trim() === suffix)) {
        return {
          ok: false,
          reason: "That password appears in a known breach. Please choose another.",
        };
      }
    }
  } catch {
    // The check is a courtesy; if it cannot run, the length rule still stands.
  }
  return { ok: true };
}
