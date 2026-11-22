# CLAUDE.md — working rules for this repo

Family Dashboard. A private web app for one household: a weekly operating system for
tasks, money, projects and plans. Two primary users, three children later.

## Non-negotiables

- **The week runs Friday to Thursday**, in the household timezone (`APP_TIMEZONE`,
  default `Africa/Johannesburg`). Never use the server's or the browser's timezone.
  All week maths lives in `src/lib/domain/week.ts` and nowhere else.
- **Money is South African rand.** Stored as `numeric(14,2)`, handled as integers of
  cents in arithmetic, displayed with no decimals. Never use floats for sums.
- **Every query is scoped by `householdId`**, taken from the session on the server.
  Never accept a household id from the client.
- **Every write goes through a Zod schema** in `src/lib/schemas` and writes its
  activity event in the same transaction. A trail that can disagree with the record
  is worse than no trail.
- **Nothing is hard-deleted.** Set `archivedAt`.
- **Domain logic is pure.** `src/lib/domain/*` has no imports from `db`, `next`, or
  React, and is unit-tested. Components and queries never calculate business rules.
- **Every expense is a need or a want.** The classification lives in `data.need`,
  defaults per kind, and is read only through `needOf()` in
  `src/lib/domain/needs.ts`. It decides which money screen a record appears on.
- **There is no Financial Freedom Score.** It was removed in November 2026. The
  `freedom_scores` table stays so the readings already taken are not destroyed,
  but nothing reads or writes it, and no screen shows a score. Do not reinstate
  it. Passive income is still tracked and still worth discussing; it is simply
  not scored.
- **The app is not the budget.** Each finance section holds one figure typed in
  from the household's real budgeting tool, in `households.budget`, and it is
  never calculated from the records here. An absent key means "not set", which
  is not the same as zero. What the screens add up is the open items — the
  things that have come up, with amounts on them — so the two can be read
  against each other. `src/lib/domain/finance.ts` owns both sides.
- **Four meeting cadences**: week, month, quarter, year. All four share the
  `meetings` table, keyed by `periodType` and `periodStart`, and all four use
  `StepHeader` and `MeetingNotes`. Period maths lives in `src/lib/domain/week.ts`.
- **Steps are the strategy.** There is no strategy record and no projects screen.
  A goal carries its agreed steps in `item_steps`, and a goal with `data.capex`
  is what used to be a project. Strategy, Projects, Activity, Decisions, Income,
  Expenses and Medical are retired screens: do not bring them back.
- **The finance screens follow the household budget, in its order**: income,
  investments, emergency fund, needs, wants, medical. The categories live in
  `src/lib/domain/kinds.ts` and are the same words as the budget spreadsheet, so
  an expense added here is already a line the budget knows. Anything off-budget
  still saves — it shows under "Not yet in the budget" rather than being refused.
  Totals come from `src/lib/domain/finance.ts`; screens render them.
- **A drive's steps have stable ids**, listed in `src/lib/domain/drives.ts`. The
  household's chosen order lives in `households.driveOrder` and the pages apply
  it with CSS `order`; a tick is stored against the step's id, never its
  position, so reordering a meeting never moves a tick onto another step. Old
  numbered ticks are converted on read by `remapDiscussed`, which converts them
  against `LEGACY_IDS` — the list as it shipped, retired steps included — so a
  tick on a step that no longer exists is dropped rather than sliding onto its
  neighbour.
- **No new fields, statuses, screens or dependencies** that the build brief does not
  name. If something seems missing, say so and ask rather than inventing it.

## Layout

```
src/app/(auth)      login, invite acceptance, password reset
src/app/(app)       the signed-in app; layout.tsx holds the nav shell
                    page.tsx is the Overview; the four drives are weekly, monthly,
                    quarterly, annual; finance/[section] serves all six money screens
src/components      row, pill, drawer, band, step header, board — the shared vocabulary
src/lib/domain      week, slots, cash, kinds — pure functions
src/lib/db          drizzle schema, connection, queries (one file per area)
src/lib/schemas     one Zod schema per item kind
src/lib/auth        password hashing, sessions, rate limiting
src/lib/actions     server actions, the only write path
scripts             migrate, create-owner, import-prototype, export-household
tests               unit tests for domain logic
```

## Definition of done

`npm run typecheck`, `npm run test` and `npm run build` all clean; works at 390px and
1440px; works in light and dark; keyboard reachable; no console errors.

## Tone of the product

Calm, minimal, premium. Orange is for action required only. It must never look like
accounting software. If a change adds admin without saving a conversation, it does
not belong in v1.
