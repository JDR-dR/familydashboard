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
  defaults per kind, and is read only through `needOf()`. It is the denominator of
  the Financial Freedom Score, so a change here moves the score.
- **The Financial Freedom Score is passive income divided by what you spend in a
  month.** Nothing else. The arithmetic lives in `src/lib/domain/freedom.ts` and
  nowhere else; screens render it, they never recompute it. Income marked
  "Possible" never counts, and a stored reading is never recalculated after the
  fact — a past score must not change under you.
- **Four meeting cadences**: week, month, quarter, year. All four share the
  `meetings` table, keyed by `periodType` and `periodStart`, and all four use
  `StepHeader` and `MeetingNotes`. Period maths lives in `src/lib/domain/week.ts`.
- **No new fields, statuses, screens or dependencies** that the build brief does not
  name. If something seems missing, say so and ask rather than inventing it.

## Layout

```
src/app/(auth)      login, invite acceptance, password reset
src/app/(app)       the signed-in app; layout.tsx holds the nav shell
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
