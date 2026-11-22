-- Goals absorb the strategy cards and the projects, and the money lines move onto
-- the household budget's own categories.
--
-- Written by hand: the schema does not change, only the records. Every statement
-- is guarded so running it twice does nothing the second time.
--
-- Meeting ticks are NOT migrated here. They are remapped on read, in
-- src/lib/domain/drives.ts, so a meeting half-ticked under the old numbering keeps
-- its ticks without this migration having to reason about four different step
-- lists in SQL.

-- 1. A strategy card's key actions become the goal's steps. The steps are the
--    strategy now, so this is where that thinking belongs.
INSERT INTO "item_steps" ("item_id", "position", "text", "done")
SELECT i."id", s.ord - 1, btrim(s.line), false
FROM "items" i
CROSS JOIN LATERAL unnest(string_to_array(i."data"->>'actions', E'\n'))
  WITH ORDINALITY AS s(line, ord)
WHERE i."kind" = 'goal'
  AND coalesce(i."data"->>'actions', '') <> ''
  AND btrim(s.line) <> ''
  AND s.ord <= 5
  AND NOT EXISTS (SELECT 1 FROM "item_steps" e WHERE e."item_id" = i."id");

-- 2. The card itself becomes a business goal. Its focus and strategy move into the
--    notes rather than being dropped; its turnover becomes the target number.
UPDATE "items" SET
  "kind" = 'lifegoal',
  "status" = coalesce("status", 'In progress'),
  "who" = coalesce("who", 'both'),
  "amount" = coalesce("amount", nullif("data"->>'turnover', '')::numeric),
  "notes" = nullif(btrim(concat_ws(E'\n\n',
      CASE WHEN coalesce("data"->>'focus', '') <> ''
           THEN 'Current focus: ' || ("data"->>'focus') END,
      nullif("data"->>'strategy', ''),
      nullif("notes", ''))), ''),
  "data" = ("data" - 'focus' - 'strategy' - 'actions' - 'turnover' - 'profit')
    || jsonb_build_object(
         'area', 'Business',
         'horizon', coalesce(nullif("data"->>'horizon', ''), '1 year'))
    || CASE WHEN coalesce("data"->>'measure', '') = ''
              AND coalesce("data"->>'profit', '') <> ''
            THEN jsonb_build_object(
                   'measure',
                   -- Read as money, the way it is read everywhere else.
                   'Profit goal R' || to_char(("data"->>'profit')::numeric, 'FM999,999,999,999'))
            ELSE '{}'::jsonb END,
  "updated_at" = now()
WHERE "kind" = 'goal';

-- 3. A project becomes a goal with a capex budget. Its budget moves from the
--    target number to capex, because a build is money out, not a number to reach.
UPDATE "items" SET
  "kind" = 'lifegoal',
  "status" = CASE "status"
      WHEN 'Planning' THEN 'Not started'
      WHEN 'On hold' THEN 'At risk'
      WHEN 'Done' THEN 'Achieved'
      ELSE 'In progress' END,
  "who" = coalesce("who", 'both'),
  "data" = "data" || jsonb_build_object(
      'capex', coalesce("amount"::text, ''),
      'area', coalesce(nullif("data"->>'area', ''), 'Personal'),
      'horizon', coalesce(nullif("data"->>'horizon', ''), '1 year')),
  "amount" = NULL,
  "updated_at" = now()
WHERE "kind" = 'project';

-- 4. Ten years and a lifetime collapse into five.
UPDATE "items" SET
  "data" = jsonb_set("data", '{horizon}', to_jsonb(
    CASE "data"->>'horizon'
      WHEN 'This year' THEN '1 year'
      WHEN '10 years' THEN '5 years'
      WHEN 'Lifetime'  THEN '5 years'
      ELSE '1 year' END)),
  "updated_at" = now()
WHERE "kind" = 'lifegoal'
  AND coalesce("data"->>'horizon', '') NOT IN ('1 year', '3 years', '5 years');

-- 5. Budget lines and once-off costs move onto the budget's categories. Anything
--    the budget has never seen lands in the Other line of its own side, where it
--    stays visible instead of being forced into the nearest wrong box.
UPDATE "items" SET
  "category" = CASE WHEN "data"->>'need' = 'Want' THEN
      CASE "category"
        WHEN 'Appliances'          THEN 'Homeware'
        WHEN 'Furniture'           THEN 'Homeware'
        WHEN 'Household purchases' THEN 'Homeware'
        WHEN 'Repairs'             THEN 'Gear repairs'
        ELSE 'Other want' END
    ELSE
      CASE "category"
        WHEN 'Rates and taxes' THEN 'Rates, taxes, electricity & water'
        WHEN 'Electricity'     THEN 'Rates, taxes, electricity & water'
        WHEN 'Water'           THEN 'Rates, taxes, electricity & water'
        WHEN 'Insurance'       THEN 'Insurance — personal'
        WHEN 'Medical'         THEN 'Medical aid'
        ELSE 'Other need' END
    END,
  "updated_at" = now()
WHERE "kind" IN ('bill', 'onceoff')
  AND "category" IS NOT NULL
  AND "category" NOT IN (
    'Home mortgage', 'Rates, taxes, electricity & water', 'Food', 'Vehicles',
    'Bank charges', 'Medical aid', 'Gap cover', 'Life & buy-sell policy',
    'Insurance — personal', 'Other need',
    'Clothing', 'Home & garden', 'Pets & food', 'Wellness & personal care',
    'Sport & subscriptions', 'Gear repairs', 'Gifts', 'Homeware', 'Entertainment',
    'Printing & stationery', 'Travel — national', 'Travel — international',
    'Tithing', 'Other want');

-- 6. The same for medical, which now has its own screen and its own three lines.
UPDATE "items" SET "category" = 'Other medical', "updated_at" = now()
WHERE "kind" = 'medical'
  AND "category" IS NOT NULL
  AND "category" NOT IN ('Medical — expenses', 'Medical — doctors',
    'Medical — dental & provision', 'Other medical');

-- 7. Income moves onto the budget's own sources.
UPDATE "items" SET "category" = 'Other income', "updated_at" = now()
WHERE "kind" = 'income'
  AND "category" IS NOT NULL
  AND "category" NOT IN ('DI — Salary (John)', 'DI — Salary (Moniek)',
    'DI — Dividends (medical)', 'DI — Trust transfer', 'TBH — Dividends',
    'Other income');
