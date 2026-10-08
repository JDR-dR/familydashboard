CREATE TABLE IF NOT EXISTS "freedom_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"period_start" date NOT NULL,
	"passive" numeric(14, 2) NOT NULL,
	"needs" numeric(14, 2) NOT NULL,
	"wants" numeric(14, 2) NOT NULL,
	"score" integer NOT NULL,
	"note" text,
	"captured_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "households" ADD COLUMN "monthly_needs" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "households" ADD COLUMN "monthly_wants" numeric(14, 2);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "freedom_scores" ADD CONSTRAINT "freedom_scores_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "freedom_scores" ADD CONSTRAINT "freedom_scores_captured_by_users_id_fk" FOREIGN KEY ("captured_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "freedom_scores_period_idx" ON "freedom_scores" USING btree ("household_id","period_start");