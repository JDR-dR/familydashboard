ALTER TABLE "households" ADD COLUMN "budget" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
-- The two figures the retired score used were already typed in from the real
-- budget, so they carry straight over rather than being asked for again.
UPDATE "households"
SET "budget" = "budget"
  || CASE WHEN "monthly_needs" IS NOT NULL AND NOT ("budget" ? 'needs')
          THEN jsonb_build_object('needs', trim(to_char("monthly_needs", 'FM999999999990.00')))
          ELSE '{}'::jsonb END
  || CASE WHEN "monthly_wants" IS NOT NULL AND NOT ("budget" ? 'wants')
          THEN jsonb_build_object('wants', trim(to_char("monthly_wants", 'FM999999999990.00')))
          ELSE '{}'::jsonb END
WHERE "monthly_needs" IS NOT NULL OR "monthly_wants" IS NOT NULL;
