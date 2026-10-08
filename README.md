# Family Dashboard

The family's weekly operating system: tasks, money, projects and plans on one
screen, built around a Friday-morning coffee meeting.

Next.js 15 · Postgres · Drizzle · password login · deploys to Vercel.

---

## Deploying it, start to finish

Roughly 20 minutes. You need a GitHub account and the Vercel account you already
have.

### 1. Put the code on GitHub

```bash
cd family-dashboard
git init
git add -A
git commit -m "Family Dashboard"
gh repo create family-dashboard --private --source=. --push
```

No `gh` command? Create an **empty private** repo on github.com, then:

```bash
git remote add origin git@github.com:<you>/family-dashboard.git
git push -u origin main
```

Keep the repo **private**. It holds no data, but there is no reason for it to be
public.

### 2. Create the database

In Vercel: **Storage → Create Database → Postgres (Neon)**, in the region closest
to you. Vercel adds `DATABASE_URL` to the project automatically. Use the **pooled**
connection string if you are asked to choose.

Any other Postgres works too — Supabase, Railway, your own server. Only the
connection string matters.

### 3. Create the Vercel project

**Add New → Project → import the repo.** Framework preset: Next.js. Before the first
deploy, add these environment variables (Production, Preview and Development):

| Name | Value |
| --- | --- |
| `DATABASE_URL` | already added by the database step |
| `SESSION_SECRET` | run `openssl rand -base64 48` and paste the result |
| `APP_TIMEZONE` | `Africa/Johannesburg` |
| `APP_URL` | your final URL, e.g. `https://dashboard.treebarkholdings.com` |

Then **Deploy**. The build runs the database migrations first, so the tables are
created on that first deploy.

### 4. Point your domain at it

Vercel → **Settings → Domains**, add the subdomain, and follow the DNS record it
gives you. The certificate is issued automatically. Update `APP_URL` afterwards and
redeploy.

### 5. Create your account

Open your new URL and go to **/setup**. Fill in your name, email and a password, and
you are in. That page works exactly once — after the first account exists it
disappears, and everyone else is invited from Settings.

### 6. Bring the old data across

**Settings → Import from the old dashboard → Choose export file**, and pick
`old-dashboard-export.json`.

It reads the file and shows a reconciliation report: how many of each kind, the
total of all amounts, and the family names it found. Nothing is written yet. If the
counts look right, press **Looks right — import it**.

Running it twice changes nothing: every record is matched on its original id. Keep
the export file as your rollback.

### 7. Invite Moniek

**Settings → Invite someone.** Her name and email, **Mom**, and **Partner —
everything**. You get a link valid for three days; send it to her and she sets her
own password. There is no public sign-up page, by design.

### 8. Check it works

Open `/api/health` — it should return `{"ok":true}`. Point any uptime monitor there.

---

## Running it locally

```bash
cp .env.example .env          # point DATABASE_URL at a local Postgres
npm install
npm run db:migrate
npm run dev                   # then open http://localhost:3000/setup
```

## The commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server on :3000 |
| `npm run build` | Production build |
| `npm run typecheck` | TypeScript, no emit |
| `npm test` | Unit tests for the domain rules |
| `npm run db:generate` | New migration from a schema change |
| `npm run db:migrate` | Apply migrations |
| `npm run setup:owner` | Create the household and first account |
| `npm run import:prototype` | Import the old dashboard's records |
| `npm run export:household` | Write the whole household to a JSON file |

## How it is put together

- `src/lib/domain` — the rules, as pure functions: the Friday-to-Thursday week,
  carry-forward, slot rollover, cash required, income splits, project totals.
  Unit-tested, no database, no React. **Business logic lives here and nowhere else.**
- `src/lib/db` — Drizzle schema and queries. Every query is scoped by household.
- `src/lib/actions` — server actions. The only write path. Each one validates with
  Zod and writes its activity event in the same transaction.
- `src/components` — the shared vocabulary: row, list, drawer, step header, board.
- `src/app/(app)` — the screens, all server components.

One `items` table holds every kind of record, discriminated by `kind`. That is
deliberate: a task can come from anywhere, the activity feed spans everything, and
search runs once.

## Speed

The app is small but it talks to the database on every render, so the one setting
that matters most is **where the functions run relative to the database**. If the
two are on different continents every query pays a round trip, and an interaction
that needs a handful of them feels like a long pause.

**Put them in the same region.** In Vercel: Storage → open the database → note its
region. Then Project Settings → Functions → Function Region, and set it to the
same one. There is no `regions` key in `vercel.json` on purpose, so this is the
single place it is decided.

What the code does to keep the work down:

- `currentSession`, `allItems` and the other hot reads are wrapped in React's
  `cache()`, so the layout and the page share one query each per request instead
  of repeating them.
- The sidebar badge is two small counts, not a full load of every item.
- The drawer is client state with the URL kept in step by `history.replaceState`.
  Opening or closing it used to be a navigation, which re-rendered the whole page
  behind it twice per edit.
- Ticking a task and ticking a meeting step are optimistic: the tick moves at
  once and the write follows. React puts it back if the write fails.
- Server actions revalidate on their own; no component calls `router.refresh()`
  afterwards, which used to double every write.
- `fetch_types` is off on the connection, which removes two catalogue round trips
  on every cold serverless container.

If it ever feels slow again, the first question is the region, and the second is
whether a new screen is doing its own queries outside `loadScreen`.

## The Financial Freedom Score

The scoreboard that replaces a retirement date: **passive income divided by what you
spend in a month**. It lives at `/freedom`, and appears again on `/income` between
the active and passive blocks, because that is the whole reason those two are split.

- **The numerator** is passive income expected in the next 30 days — income with
  `stream: "Passive"`, not yet received, and never anything marked only *Possible*.
- **The denominator** is what you spend in a month, split into needs and wants.
  By default it is the recurring-bill run-rate: a monthly bill at face value, an
  annual bill over twelve. Once-off costs and maintenance are deliberately left
  out — they are lumpy, not a run-rate.
- **You can pin either side.** `households.monthly_needs` and `monthly_wants` are a
  typed-in baseline that wins over the run-rate, one side at a time. Clearing a box
  hands that side back to the bills.
- **Readings are kept, not recalculated.** `freedom_scores` holds one row a month,
  captured deliberately from the page. A stored reading never changes afterwards, so
  the trend is a record rather than a recomputation. Capturing twice in a month
  corrects that month instead of adding a second point.

The arithmetic is all in `src/lib/domain/freedom.ts`, pure and unit-tested. Screens
render the result; they never do the sums themselves.

**The dashboard** reads the kept readings three ways, chosen by `?view=`:

| View | What it shows |
| --- | --- |
| `month` | The twelve months of one year, with a year picker. Movement is against the previous reading, not the previous month. |
| `year` | One line per year: how it opened, how it closed, the best it reached, and the passive income added. |
| `yoy` | The same twelve months in two chosen years, side by side, with the points difference where both have a reading. |

A month with no reading stays a gap. Nothing is interpolated, averaged or carried
forward, because an invented data point would make the trend a lie. The chart is CSS
bars — a charting library for a dozen bars and a dashed line would be absurd.

## The four cadences

Weekly Drive, Monthly Drive, Quarterly Review and Annual Review all share the
`meetings` table, keyed by `period_type` and `period_start`, and all four tick their
steps through the same `StepHeader`. Quarters are calendar quarters; the year is the
calendar year. Only the week is Friday-to-Thursday.

## Things worth knowing

- **The week runs Friday to Thursday** in the household timezone. Never use the
  server's clock for week maths; use `src/lib/domain/week.ts`.
- **Nothing is hard-deleted.** Removing sets `archivedAt`.
- **Money** is `numeric(14,2)` in the database and integer cents in arithmetic.
  Never add floats.
- **The activity trail is append-only.** Never rewrite it.
- `/api/health` returns 200 when the app can reach the database — point uptime
  monitoring at it.

## Still to build

Attachments, web push and the Friday email digest are specified in the build brief
but not in this version. The schema already carries the `attachments` table and the
two-factor columns, so neither needs a migration later.
