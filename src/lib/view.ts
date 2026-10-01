import type { Item } from "@/lib/db/schema";
import { KIND_DEFS, isDone, stateOf, toneOf, type Kind } from "@/lib/domain/kinds";
import { toItemLike } from "@/lib/db/queries";
import { money } from "@/lib/domain/money";
import { toCents } from "@/lib/domain/money";
import { formatWhen, today } from "@/lib/domain/week";
import { weeksCarried } from "@/lib/domain/rules";

/** The plain shape a row needs. Server components build it; client ones render it. */
export interface RowData {
  id: string;
  kind: Kind;
  title: string;
  sub: string;
  carried: string | null;
  who: string;
  date: string | null;
  late: boolean;
  amount: string;
  status: string;
  tone: "action" | "waiting" | "done";
  done: boolean;
  checkable: boolean;
  markers: string;
}

export interface RowExtras {
  names: Record<string, string>;
  notes?: Map<string, { body: string; createdAt: Date; userName: string | null }>;
  steps?: Map<string, { done: number; total: number }>;
  linkCounts?: Map<string, number>;
  showCarried?: boolean;
}

function personName(key: string | null, names: Record<string, string>): string {
  if (!key) return "";
  const defaults: Record<string, string> = {
    dad: "Dad", mom: "Mom", c1: "Child 1", c2: "Child 2", c3: "Child 3",
    both: "Both", family: "Family", external: "External person",
  };
  return names[key] ?? defaults[key] ?? key;
}

export function toRow(item: Item, extras: RowExtras): RowData {
  const like = toItemLike(item);
  const kind = item.kind as Kind;
  const done = isDone(like);
  const data = item.data as Record<string, unknown>;

  // The sub-line carries movement: the latest note wins, then the next step.
  const note = extras.notes?.get(item.id);
  let sub = "";
  if (note) {
    sub = `${note.userName ?? "Someone"}, ${formatWhen(note.createdAt)}: ${note.body}`;
  } else if (kind === "lifegoal") {
    sub = [data.area as string, (data.measure as string) || item.nextStep].filter(Boolean).join(" · ");
  } else if (item.nextStep) {
    sub = `Next: ${item.nextStep}`;
  } else {
    sub = (data.purpose as string) || item.category || "";
  }

  const steps = extras.steps?.get(item.id);
  const links = extras.linkCounts?.get(item.id) ?? 0;
  const markers = [
    steps ? `${steps.done}/${steps.total} steps` : "",
    links ? `${links} link${links > 1 ? "s" : ""}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  const carriedWeeks =
    extras.showCarried && kind === "task" && !done ? weeksCarried(like) : 0;

  const amountCents = toCents(
    kind === "income" && done ? ((data.actual as string) ?? item.amount) : item.amount,
  );

  const state = stateOf(like) || (kind === "income" ? (done ? "Received" : (data.confidence as string) ?? "") : "");

  return {
    id: item.id,
    kind,
    title: item.title,
    sub,
    carried: carriedWeeks > 0 ? `Carried for ${carriedWeeks} week${carriedWeeks > 1 ? "s" : ""}` : null,
    who: personName(item.who, extras.names),
    date: item.dueDate,
    // A decision's date is the day it was made, so it is never "late".
    late:
      kind !== "decision" && !done && Boolean(item.dueDate) && (item.dueDate as string) < today(),
    amount: amountCents ? money(amountCents) : "",
    status: state,
    tone: toneOf(like),
    done,
    checkable: kind === "task",
    markers,
  };
}

export function toRows(list: Item[], extras: RowExtras): RowData[] {
  return list.map((item) => toRow(item, extras));
}

export const kindLabel = (kind: Kind) => KIND_DEFS[kind].label;
