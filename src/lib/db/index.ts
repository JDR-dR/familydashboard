import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

declare global {
  // eslint-disable-next-line no-var
  var __familyDashboardSql: ReturnType<typeof postgres> | undefined;
}

function connectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env and point it at your Postgres.",
    );
  }
  return url;
}

/**
 * One pool per process. Serverless functions reuse it across invocations, so the
 * connection count stays low; use the POOLED connection string on Neon or Vercel
 * Postgres.
 */
const client =
  globalThis.__familyDashboardSql ??
  postgres(connectionString(), {
    // Serverless: keep the pool small and short-lived, and never use prepared
    // statements, which do not survive a pooled connection.
    max: 5,
    idle_timeout: 20,
    prepare: false,
    // Neon, Vercel Postgres and Supabase all require TLS.
    ssl: /sslmode=(require|verify-full)/.test(connectionString()) ? "require" : undefined,
  });

if (process.env.NODE_ENV !== "production") globalThis.__familyDashboardSql = client;

export const db = drizzle(client, { schema });
export { client as sql };
export * from "./schema";
