/**
 * Creates the household and its first account. Run once, after the migrations:
 *   npm run setup:owner -- "John" "john@example.com" "a long passphrase"
 * Further people are invited from Settings inside the app.
 */
import { db } from "../src/lib/db";
import { households, users } from "../src/lib/db/schema";
import { hashPassword } from "../src/lib/auth/password";
import { sql as client } from "../src/lib/db";

const [name, email, password] = process.argv.slice(2);

if (!name || !email || !password) {
  console.error('Usage: npm run setup:owner -- "Name" "email@example.com" "password"');
  process.exit(1);
}

if (password.length < 12) {
  console.error("The password must be at least 12 characters.");
  process.exit(1);
}

async function main() {
  const existing = await db.select().from(households).limit(1);
  const household =
    existing[0] ??
    (
      await db
        .insert(households)
        .values({
          name: "Our household",
          personNames: { dad: name },
        })
        .returning()
    )[0];

  const [user] = await db
    .insert(users)
    .values({
      householdId: household.id,
      email: email.trim().toLowerCase(),
      name,
      personKey: "dad",
      role: "owner",
      passwordHash: await hashPassword(password),
    })
    .returning();

  console.log(`Household: ${household.id}`);
  console.log(`Owner:     ${user.email}`);
  console.log("You can now sign in.");
  await client.end();
}

main().catch(async (error) => {
  console.error(error);
  await client.end();
  process.exit(1);
});
