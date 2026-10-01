"use server";

import { consumeToken, createSession, setPassword } from "@/lib/auth";
import { checkPasswordStrength } from "@/lib/auth/password";
import { passwordSchema } from "@/lib/schemas/item";

export async function acceptInvite(formData: FormData): Promise<{ error?: string }> {
  const token = String(formData.get("token") ?? "");
  const parsed = passwordSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.errors[0]?.message };

  const strength = await checkPasswordStrength(parsed.data.password);
  if (!strength.ok) return { error: strength.reason };

  const userId = await consumeToken(token, "invite");
  if (!userId) return { error: "That invitation has expired. Ask John to send another." };

  await setPassword(userId, parsed.data.password);
  await createSession(userId);
  return {};
}
