/**
 * Moves the prototype's records into the new schema, keeping ids, dates, amounts
 * and notes exactly as they were. Run it twice and nothing duplicates: every row
 * is matched on its original id.
 *
 *   npm run import:prototype -- ./data/items            (a folder of JSON files)
 *   npm run import:prototype -- ./data/export.json      (one JSON array or object)
 *   npm run import:prototype -- ./data/items --commit   (write; otherwise dry run)
 *
 * Without --commit it only prints the reconciliation report, so you can check the
 * counts before anything touches the database.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { eq, sql as raw } from "drizzle-orm";
import { db, sql as client } from "../src/lib/db";
import { households, itemEvents, items, meetings, users } from "../src/lib/db/schema";

type Row = Record<string, unknown>;

const [sourcePath, ...flags] = process.argv.slice(2);
const commit = flags.includes("--commit");

if (!sourcePath) {
  console.error("Usage: npm run import:prototype -- <path to export> [--commit]");
  process.exit(1);
}

/** Accepts a directory of per-record files, or one file holding an array/object. */
function readRecords(path: string): Row[] {
  const stats = statSync(path);
  const unwrap = (value: Row): Row =>
    value && typeof value === "object" && "data" in value && typeof value.data === "object"
      ? ({ ...(value.data as Row), id: (value.id as string) ?? (value.data as Row).id })
      : value;

  if (stats.isDirectory()) {
    return readdirSync(path)
      .filter((name) => name.endsWith(".json"))
      .map((name) => unwrap(JSON.parse(readFileSync(join(path, name), "utf8"))));
  }

  const parsed = JSON.parse(readFileSync(path, "utf8"));
  if (Array.isArray(parsed)) return parsed.map(unwrap);
  if (parsed.items) return Object.values(parsed.items as Record<string, Row>).map(unwrap);
  return Object.values(parsed as Record<string, Row>).map(unwrap);
}

const SLOT_MAP: Record<string, string> = {
  "This Week": "This week",
  "This week": "This week",
  "Next week": "Next week",
  Soon: "Monthly drive",
  "Monthly huddle": "Monthly drive",
  "Monthly drive": "Monthly drive",
  Later: "To decide together",
  "To decide together": "To decide together",
};

const DATA_KEYS = [
  "stream", "confidence", "actual", "received", "repeat", "type", "provider",
  "reimbursed", "started", "answer", "answeredAt", "purpose", "area", "horizon",
  "measure", "turnover", "profit", "strategy", "focus", "actions", "spawned",
];

const RENAMED: Record<string, string> = {
  received: "receivedDate",
  started: "startedDate",
  answeredAt: "answeredDate",
  spawned: "spawnedId",
};

const asDate = (value: unknown): string | null => {
  const text = String(value ?? "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
};

const asMoney = (value: unknown): string | null => {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(String(value).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(number) ? number.toFixed(2) : null;
};

async function main() {
  const records = readRecords(sourcePath);
  const config = records.find((row) => row.kind === "config" || row.id === "config");
  const meetingRows = records.filter((row) => row.kind === "meeting" || row.kind === "monthly");
  const itemRows = records.filter(
    (row) => row.kind && !["config", "meeting", "monthly"].includes(String(row.kind)),
  );

  const [household] = await db.select().from(households).limit(1);
  if (!household) {
    console.error("No household yet. Run `npm run setup:owner` first.");
    process.exit(1);
  }
  const [owner] = await db
    .select()
    .from(users)
    .where(eq(users.householdId, household.id))
    .limit(1);

  const counts = new Map<string, number>();
  const problems: string[] = [];
  let totalAmount = 0;
  const prepared: Array<typeof items.$inferInsert> = [];
  const events: Array<typeof itemEvents.$inferInsert> = [];

  for (const row of itemRows) {
    const kind = String(row.kind);
    const id = String(row.id ?? "");
    if (!id) {
      problems.push(`A ${kind} record has no id and was skipped.`);
      continue;
    }

    const data: Record<string, unknown> = {};
    for (const key of DATA_KEYS) {
      const value = row[key];
      if (value === undefined || value === null || value === "") continue;
      const target = RENAMED[key] ?? key;
      data[target] = ["actual", "reimbursed", "turnover", "profit"].includes(key)
        ? asMoney(value)
        : value;
    }

    const amount = asMoney(row.amount);
    if (amount) totalAmount += Number(amount);

    const createdAt = asDate(row.createdAt) ?? asDate(row.date) ?? new Date().toISOString().slice(0, 10);
    const slot = row.priority ? SLOT_MAP[String(row.priority)] ?? "This week" : kind === "task" ? "This week" : null;

    prepared.push({
      id,
      householdId: household.id,
      kind,
      title: String(row.title ?? "Untitled"),
      who: (row.who as string) || null,
      dueDate: asDate(row.date),
      amount,
      status: (row.status as string) ?? null,
      stage: (row.stage as string) ?? null,
      section: (row.section as string) ?? null,
      slot,
      slotWeek: asDate(row.slotWeek),
      nextStep: (row.next as string) || null,
      notes: (row.notes as string) || null,
      category: (row.category as string) || null,
      data,
      linkedItemId: (row.linked as string) || null,
      projectId: (row.project as string) || null,
      doneAt: asDate(row.doneAt),
      createdAt: new Date(`${createdAt}T08:00:00.000Z`),
      updatedAt: row.updatedAt ? new Date(String(row.updatedAt)) : new Date(`${createdAt}T08:00:00.000Z`),
      createdBy: owner?.id ?? null,
    });

    // The prototype kept no per-record history, so every item starts its trail
    // with the fact of its creation, dated when it was created.
    events.push({
      householdId: household.id,
      itemId: id,
      userId: owner?.id ?? null,
      type: "created",
      summary: "added in the previous dashboard",
      createdAt: new Date(`${createdAt}T08:00:00.000Z`),
    });

    counts.set(kind, (counts.get(kind) ?? 0) + 1);
  }

  console.log("\nReconciliation report");
  console.log("─".repeat(46));
  for (const [kind, count] of [...counts.entries()].sort()) {
    console.log(`${kind.padEnd(16)} ${String(count).padStart(4)}`);
  }
  console.log("─".repeat(46));
  console.log(`${"items".padEnd(16)} ${String(prepared.length).padStart(4)}`);
  console.log(`${"meetings".padEnd(16)} ${String(meetingRows.length).padStart(4)}`);
  console.log(
    `${"total amounts".padEnd(16)} ${totalAmount.toLocaleString("en-ZA", { style: "currency", currency: "ZAR" })}`,
  );
  if (config) {
    console.log(`${"family names".padEnd(16)} ${JSON.stringify((config as Row).names ?? {})}`);
  }
  for (const problem of problems) console.log(`!  ${problem}`);

  if (!commit) {
    console.log("\nDry run. Nothing was written. Add --commit to import.\n");
    await client.end();
    return;
  }

  await db.transaction(async (tx) => {
    if (config && (config as Row).names) {
      // Merge, never replace: the owner's own name is already set up locally.
      const merged = {
        ...(household.personNames ?? {}),
        ...((config as Row).names as Record<string, string>),
      };
      await tx
        .update(households)
        .set({ personNames: merged })
        .where(eq(households.id, household.id));
    }

    for (const item of prepared) {
      await tx
        .insert(items)
        .values(item)
        .onConflictDoUpdate({
          target: items.id,
          set: { ...item, updatedAt: item.updatedAt },
        });
    }

    for (const event of events) {
      const existing = await tx
        .select({ count: raw<number>`count(*)::int` })
        .from(itemEvents)
        .where(eq(itemEvents.itemId, event.itemId));
      if (!existing[0]?.count) await tx.insert(itemEvents).values(event);
    }

    for (const meeting of meetingRows) {
      const periodType = meeting.kind === "monthly" ? "month" : "week";
      const periodStart =
        periodType === "month"
          ? `${String(meeting.month ?? "").slice(0, 7)}-01`
          : asDate(meeting.week);
      if (!periodStart || periodStart.startsWith("undefined")) continue;
      await tx
        .insert(meetings)
        .values({
          householdId: household.id,
          periodType,
          periodStart,
          discussed: (meeting.discussed as Record<string, boolean>) ?? {},
          notes: (meeting.notes as string) || null,
        })
        .onConflictDoNothing();
    }
  });

  const [after] = await db
    .select({ count: raw<number>`count(*)::int` })
    .from(items)
    .where(eq(items.householdId, household.id));

  console.log(`\nImported. The database now holds ${after?.count ?? 0} items.\n`);
  await client.end();
}

main().catch(async (error) => {
  console.error(error);
  await client.end();
  process.exit(1);
});
