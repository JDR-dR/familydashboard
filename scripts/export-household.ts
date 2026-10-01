/**
 * Writes the whole household to one JSON file: the family's own backup, theirs to
 * keep. Run it whenever you want a copy:  npm run export:household -- ./backup.json
 */
import { writeFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import { db, sql as client } from "../src/lib/db";
import {
  households, itemEvents, itemLinks, itemSteps, items, meetings, users,
} from "../src/lib/db/schema";

const out = process.argv[2] ?? `./family-dashboard-${new Date().toISOString().slice(0, 10)}.json`;

async function main() {
  const [household] = await db.select().from(households).limit(1);
  if (!household) {
    console.error("No household found.");
    process.exit(1);
  }

  const [itemRows, eventRows, stepRows, linkRows, meetingRows, userRows] = await Promise.all([
    db.select().from(items).where(eq(items.householdId, household.id)),
    db.select().from(itemEvents).where(eq(itemEvents.householdId, household.id)),
    db.select().from(itemSteps),
    db.select().from(itemLinks),
    db.select().from(meetings).where(eq(meetings.householdId, household.id)),
    db.select().from(users).where(eq(users.householdId, household.id)),
  ]);

  const payload = {
    exportedAt: new Date().toISOString(),
    household,
    // Accounts without their password hashes.
    users: userRows.map(({ passwordHash, totpSecret, ...rest }) => rest),
    items: itemRows,
    events: eventRows,
    steps: stepRows,
    links: linkRows,
    meetings: meetingRows,
  };

  writeFileSync(out, JSON.stringify(payload, null, 2));
  console.log(`Wrote ${itemRows.length} items and ${eventRows.length} events to ${out}`);
  await client.end();
}

main().catch(async (error) => {
  console.error(error);
  await client.end();
  process.exit(1);
});
