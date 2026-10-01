/**
 * Maps the previous dashboard's records onto this schema. Shared by the CLI script
 * and the import panel in Settings, so both behave identically.
 */

export type RawRecord = Record<string, unknown>;

export interface PreparedItem {
  id: string;
  kind: string;
  title: string;
  who: string | null;
  dueDate: string | null;
  amount: string | null;
  status: string | null;
  stage: string | null;
  section: string | null;
  slot: string | null;
  slotWeek: string | null;
  nextStep: string | null;
  notes: string | null;
  category: string | null;
  data: Record<string, unknown>;
  linkedItemId: string | null;
  projectId: string | null;
  doneAt: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PreparedMeeting {
  periodType: "week" | "month";
  periodStart: string;
  discussed: Record<string, boolean>;
  notes: string | null;
}

export interface ImportPlan {
  items: PreparedItem[];
  meetings: PreparedMeeting[];
  names: Record<string, string> | null;
  counts: Record<string, number>;
  totalAmount: number;
  problems: string[];
}

const SLOT_MAP: Record<string, string> = {
  "This Week": "This week",
  "This week": "This week",
  "Next week": "Next week",
  Soon: "Monthly drive",
  "Monthly huddle": "Monthly drive",
  "Monthly drive": "Monthly drive",
  Later: "To decide together",
  "To decide together": "To decide together",
};

const DATA_KEYS = [
  "stream", "confidence", "actual", "received", "repeat", "type", "provider",
  "reimbursed", "started", "answer", "answeredAt", "purpose", "area", "horizon",
  "measure", "turnover", "profit", "strategy", "focus", "actions", "spawned",
];

const RENAMED: Record<string, string> = {
  received: "receivedDate",
  started: "startedDate",
  answeredAt: "answeredDate",
  spawned: "spawnedId",
};

const MONEY_KEYS = new Set(["actual", "reimbursed", "turnover", "profit"]);

function asDate(value: unknown): string | null {
  const text = String(value ?? "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function asMoney(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(String(value).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(number) ? number.toFixed(2) : null;
}

/** Accepts the artifact's own shapes: an array, a keyed object, or {id, data}. */
export function normaliseRecords(input: unknown): RawRecord[] {
  const unwrap = (value: RawRecord): RawRecord =>
    value && typeof value === "object" && "data" in value && typeof value.data === "object"
      ? { ...(value.data as RawRecord), id: (value.id as string) ?? (value.data as RawRecord).id }
      : value;

  if (Array.isArray(input)) return input.map((entry) => unwrap(entry as RawRecord));
  if (input && typeof input === "object") {
    const object = input as Record<string, unknown>;
    if (object.items && typeof object.items === "object") {
      return Object.values(object.items as Record<string, RawRecord>).map(unwrap);
    }
    return Object.values(object as Record<string, RawRecord>)
      .filter((value) => value && typeof value === "object")
      .map(unwrap);
  }
  return [];
}

export function buildPlan(records: RawRecord[]): ImportPlan {
  const config = records.find((row) => row.kind === "config" || row.id === "config");
  const meetingRows = records.filter((row) => row.kind === "meeting" || row.kind === "monthly");
  const itemRows = records.filter(
    (row) => row.kind && !["config", "meeting", "monthly"].includes(String(row.kind)),
  );

  const counts: Record<string, number> = {};
  const problems: string[] = [];
  const items: PreparedItem[] = [];
  let totalAmount = 0;

  for (const row of itemRows) {
    const kind = String(row.kind);
    const id = String(row.id ?? "");
    if (!id) {
      problems.push(`A ${kind} record has no id and was skipped.`);
      continue;
    }

    const data: Record<string, unknown> = {};
    for (const key of DATA_KEYS) {
      const value = row[key];
      if (value === undefined || value === null || value === "") continue;
      data[RENAMED[key] ?? key] = MONEY_KEYS.has(key) ? asMoney(value) : value;
    }

    const amount = asMoney(row.amount);
    if (amount) totalAmount += Number(amount);

    const created =
      asDate(row.createdAt) ?? asDate(row.date) ?? new Date().toISOString().slice(0, 10);
    const slot = row.priority
      ? SLOT_MAP[String(row.priority)] ?? "This week"
      : kind === "task"
        ? "This week"
        : null;

    items.push({
      id,
      kind,
      title: String(row.title ?? "Untitled"),
      who: (row.who as string) || null,
      dueDate: asDate(row.date),
      amount,
      status: (row.status as string) ?? null,
      stage: (row.stage as string) ?? null,
      section: (row.section as string) ?? null,
      slot,
      slotWeek: asDate(row.slotWeek),
      nextStep: (row.next as string) || null,
      notes: (row.notes as string) || null,
      category: (row.category as string) || null,
      data,
      linkedItemId: (row.linked as string) || null,
      projectId: (row.project as string) || null,
      doneAt: asDate(row.doneAt),
      createdAt: new Date(`${created}T08:00:00.000Z`),
      updatedAt: row.updatedAt ? new Date(String(row.updatedAt)) : new Date(`${created}T08:00:00.000Z`),
    });

    counts[kind] = (counts[kind] ?? 0) + 1;
  }

  const meetings: PreparedMeeting[] = [];
  for (const row of meetingRows) {
    const periodType = row.kind === "monthly" ? "month" : "week";
    const periodStart =
      periodType === "month" ? `${String(row.month ?? "").slice(0, 7)}-01` : asDate(row.week);
    if (!periodStart || periodStart.startsWith("undefined")) continue;
    meetings.push({
      periodType,
      periodStart,
      discussed: (row.discussed as Record<string, boolean>) ?? {},
      notes: (row.notes as string) || null,
    });
  }

  return {
    items,
    meetings,
    names: (config?.names as Record<string, string>) ?? null,
    counts,
    totalAmount,
    problems,
  };
}
