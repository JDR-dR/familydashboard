"use server";

import { headers } from "next/headers";
import { attemptLogin, createSession } from "@/lib/auth";
import { loginSchema } from "@/lib/schemas/item";

export async function signIn(formData: FormData): Promise<{ error?: string }> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Check the form" };
  }

  const result = await attemptLogin(parsed.data.email, parsed.data.password);
  if (!result.ok) return { error: result.reason };

  const agent = (await headers()).get("user-agent") ?? undefined;
  await createSession(result.userId, agent);
  return {};
}
