/**
 * Applies the SQL migrations in /drizzle. Run on every deploy, before the app
 * takes traffic: `npm run db:migrate`.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const client = postgres(url, { max: 1, prepare: false });

migrate(drizzle(client), { migrationsFolder: "./drizzle" })
  .then(async () => {
    console.log("Migrations applied.");
    await client.end();
  })
  .catch(async (error) => {
    console.error("Migration failed:", error);
    await client.end();
    process.exit(1);
  });
