import {
  boolean, date, index, integer, jsonb, numeric, pgTable, text, timestamp,
  uniqueIndex, uuid,
} from "drizzle-orm/pg-core";

/* --------------------------------------------------------------- household -- */

export const households = pgTable("households", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  timezone: text("timezone").notNull().default("Africa/Johannesburg"),
  /** Display names for the person keys: { dad: "John", mom: "Moniek", c1: "Seb" } */
  personNames: jsonb("person_names").$type<Record<string, string>>().notNull().default({}),
  /**
   * The Financial Freedom Score denominator, typed in by hand. Null means "work it
   * out from the bills". You decide what you spend, so you get to pin the number.
   */
  monthlyNeeds: numeric("monthly_needs", { precision: 14, scale: 2 }),
  monthlyWants: numeric("monthly_wants", { precision: 14, scale: 2 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id").notNull().references(() => households.id),
    email: text("email").notNull(),
    name: text("name").notNull(),
    /** Which assignee key this person is: dad, mom, c1, c2, c3. */
    personKey: text("person_key"),
    passwordHash: text("password_hash"),
    role: text("role").notNull().default("member"), // owner | partner | member
    failedAttempts: integer("failed_attempts").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    /** Reserved so TOTP can be added later without a migration. */
    totpSecret: text("totp_secret"),
    totpEnabled: boolean("totp_enabled").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (table) => ({
    emailIdx: uniqueIndex("users_email_idx").on(table.email),
    householdIdx: index("users_household_idx").on(table.householdId),
  }),
);

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(), // sha256 of the cookie token
    userId: uuid("user_id").notNull().references(() => users.id),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    userAgent: text("user_agent"),
  },
  (table) => ({ userIdx: index("sessions_user_idx").on(table.userId) }),
);

/** Invites and password resets share one table; `kind` separates them. */
export const tokens = pgTable(
  "tokens",
  {
    id: text("id").primaryKey(), // sha256 of the emailed token
    userId: uuid("user_id").notNull().references(() => users.id),
    kind: text("kind").notNull(), // invite | reset
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({ userIdx: index("tokens_user_idx").on(table.userId) }),
);

/* -------------------------------------------------------------------- items -- */

export const items = pgTable(
  "items",
  {
    /** Text, not uuid: the prototype's ids migrate across unchanged. */
    id: text("id").primaryKey(),
    householdId: uuid("household_id").notNull().references(() => households.id),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    who: text("who"),
    dueDate: date("due_date"),
    amount: numeric("amount", { precision: 14, scale: 2 }),
    status: text("status"),
    stage: text("stage"),
    section: text("section"),
    slot: text("slot"),
    slotWeek: date("slot_week"),
    nextStep: text("next_step"),
    notes: text("notes"),
    category: text("category"),
    /** Kind-specific fields: stream, confidence, provider, horizon, turnover... */
    data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}),
    linkedItemId: text("linked_item_id"),
    projectId: text("project_id"),
    doneAt: date("done_at"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid("created_by").references(() => users.id),
    updatedBy: uuid("updated_by").references(() => users.id),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (table) => ({
    householdKindIdx: index("items_household_kind_idx").on(table.householdId, table.kind, table.status),
    dueIdx: index("items_due_idx").on(table.householdId, table.dueDate),
    updatedIdx: index("items_updated_idx").on(table.householdId, table.updatedAt),
    projectIdx: index("items_project_idx").on(table.projectId),
  }),
);

/** Append-only. The activity feed and the discussion thread both read from here. */
export const itemEvents = pgTable(
  "item_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id").notNull().references(() => households.id),
    itemId: text("item_id").notNull().references(() => items.id),
    userId: uuid("user_id").references(() => users.id),
    type: text("type").notNull(), // created | updated | note | attachment | system
    /** One line for the feed: "Needs Action → Done", "attached 1 file". */
    summary: text("summary"),
    /** The note itself, when type is note. */
    body: text("body"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    itemIdx: index("item_events_item_idx").on(table.itemId, table.createdAt),
    feedIdx: index("item_events_feed_idx").on(table.householdId, table.createdAt),
  }),
);

export const itemSteps = pgTable(
  "item_steps",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    itemId: text("item_id").notNull().references(() => items.id),
    position: integer("position").notNull(),
    text: text("text").notNull(),
    done: boolean("done").notNull().default(false),
  },
  (table) => ({ itemIdx: index("item_steps_item_idx").on(table.itemId) }),
);

export const itemLinks = pgTable(
  "item_links",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    itemId: text("item_id").notNull().references(() => items.id),
    position: integer("position").notNull(),
    url: text("url").notNull(),
    label: text("label"),
  },
  (table) => ({ itemIdx: index("item_links_item_idx").on(table.itemId) }),
);

export const attachments = pgTable(
  "attachments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    itemId: text("item_id").notNull().references(() => items.id),
    storageKey: text("storage_key").notNull(),
    filename: text("filename").notNull(),
    contentType: text("content_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    uploadedBy: uuid("uploaded_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({ itemIdx: index("attachments_item_idx").on(table.itemId) }),
);

/**
 * One reading of the Financial Freedom Score, kept so the trend is a record and
 * not a memory. One per month, taken deliberately rather than written by a cron.
 */
export const freedomScores = pgTable(
  "freedom_scores",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id").notNull().references(() => households.id),
    /** The first of the month this reading belongs to. */
    periodStart: date("period_start").notNull(),
    passive: numeric("passive", { precision: 14, scale: 2 }).notNull(),
    needs: numeric("needs", { precision: 14, scale: 2 }).notNull(),
    wants: numeric("wants", { precision: 14, scale: 2 }).notNull(),
    /** Stored, not recomputed, so a past reading never changes under you. */
    score: integer("score").notNull(),
    note: text("note"),
    capturedBy: uuid("captured_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    periodIdx: uniqueIndex("freedom_scores_period_idx").on(
      table.householdId, table.periodStart,
    ),
  }),
);

/** One row per meeting — weekly, monthly, quarterly or annual: steps and notes. */
export const meetings = pgTable(
  "meetings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id").notNull().references(() => households.id),
    periodType: text("period_type").notNull(), // week | month | quarter | year
    periodStart: date("period_start").notNull(),
    discussed: jsonb("discussed").$type<Record<string, boolean>>().notNull().default({}),
    notes: text("notes"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    periodIdx: uniqueIndex("meetings_period_idx").on(
      table.householdId, table.periodType, table.periodStart,
    ),
  }),
);

/** "New since you last looked", per person. */
export const seenMarkers = pgTable(
  "seen_markers",
  {
    userId: uuid("user_id").primaryKey().references(() => users.id),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
);

export type Household = typeof households.$inferSelect;
export type User = typeof users.$inferSelect;
export type Item = typeof items.$inferSelect;
export type NewItem = typeof items.$inferInsert;
export type ItemEvent = typeof itemEvents.$inferSelect;
export type ItemStep = typeof itemSteps.$inferSelect;
export type ItemLink = typeof itemLinks.$inferSelect;
export type Meeting = typeof meetings.$inferSelect;
export type FreedomScoreRow = typeof freedomScores.$inferSelect;
