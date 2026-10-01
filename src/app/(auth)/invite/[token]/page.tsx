import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { consumeToken } from "@/lib/auth";
import { createHash } from "node:crypto";
import { tokens } from "@/lib/db/schema";
import { and, gt } from "drizzle-orm";
import { AcceptForm } from "./form";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const id = createHash("sha256").update(token).digest("hex");

  const [row] = await db
    .select({ user: users })
    .from(tokens)
    .innerJoin(users, eq(users.id, tokens.userId))
    .where(and(eq(tokens.id, id), gt(tokens.expiresAt, new Date())))
    .limit(1);

  if (!row) notFound();

  return (
    <main className="loginwrap">
      <div className="loginbox">
        <h1>Welcome, {row.user.name}</h1>
        <p className="sub">Choose a password and you are in.</p>
        <AcceptForm token={token} />
      </div>
    </main>
  );
}
