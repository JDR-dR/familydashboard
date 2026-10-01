import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { sql } from "drizzle-orm";
import { SetupForm } from "./form";

export const dynamic = "force-dynamic";

/** First run only: once an account exists this page is gone for good. */
export default async function SetupPage() {
  const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(users);
  if ((row?.count ?? 0) > 0) redirect("/login");

  return (
    <main className="loginwrap">
      <div className="loginbox">
        <h1>Set up your dashboard</h1>
        <p className="sub">
          This creates the household and your own account. It only works once — after
          this, people are invited from Settings.
        </p>
        <SetupForm />
      </div>
    </main>
  );
}
