import { NextResponse } from "next/server";
import { sql as client } from "@/lib/db";

export const dynamic = "force-dynamic";

/** For uptime monitoring: checks the app can reach its database. */
export async function GET() {
  try {
    await client`select 1`;
    return NextResponse.json({ ok: true, at: new Date().toISOString() });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
