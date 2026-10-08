-- "Considering" has been removed from the investment ladder.
--
-- Anything still sitting there moves back to "Research". Research is the honest
-- landing place: Considering sat between Research and Due Diligence, and moving a
-- deal forward on its behalf would claim progress that was never made. Nudge it on
-- by hand if it is further along than that.
--
-- Written by hand rather than generated: the schema is unchanged, only the data.
UPDATE "items"
SET "stage" = 'Research'
WHERE "kind" = 'investment' AND "stage" = 'Considering';
