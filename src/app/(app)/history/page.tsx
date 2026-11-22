import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { loadScreen, pick } from "@/lib/page-data";
import { db } from "@/lib/db";
import { meetings } from "@/lib/db/schema";
import { activityFeed, unseenCount } from "@/lib/db/queries";
import { isDone, KIND_DEFS, type Kind } from "@/lib/domain/kinds";
import { formatDate, formatMonth, formatQuarter } from "@/lib/domain/week";
import { toRows } from "@/lib/view";
import { ItemList } from "@/components/Row";
import { SearchBox } from "@/components/SearchBox";
import { MarkSeen } from "@/components/MarkSeen";

export const dynamic = "force-dynamic";

const TABS = [
  ["changes", "What changed"],
  ["decisions", "Decisions"],
  ["done", "Finished"],
  ["notes", "Meeting notes"],
] as const;
type Tab = (typeof TABS)[number][0];

const FINISHED: Array<[string, Kind]> = [
  ["Completed tasks", "task"],
  ["Goals achieved", "lifegoal"],
  ["Answered prayers", "prayer"],
  ["Believing now", "unbelief"],
  ["Sowing given", "sowing"],
  ["Deals made or passed", "investment"],
  ["Experiences done", "experience"],
  ["Budget lines paid", "bill"],
  ["Once-off paid", "onceoff"],
  ["Saved or invested", "saving"],
  ["Capex costs paid", "projectexp"],
  ["Medical settled", "medical"],
];

/**
 * The past, in one place. What changed, what you decided and what is finished
 * used to be three separate screens; they are three views of the same thing.
 */
export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const tab: Tab = (TABS.find(([t]) => t === params.tab)?.[0] ?? "changes") as Tab;
  const q = (params.q ?? "").trim().toLowerCase();

  const screen = await loadScreen();
  const matches = (text: Array<string | null | undefined>) =>
    !q || text.some((value) => (value ?? "").toLowerCase().includes(q));

  const unseen = await unseenCount(screen.householdId, screen.session.user.id);

  let body: React.ReactNode = null;

  if (tab === "changes") {
    const feed = (await activityFeed(screen.householdId, 120)).filter((entry) =>
      matches([entry.itemTitle, entry.summary, entry.body]),
    );
    const days: Array<{ key: string; rows: typeof feed }> = [];
    for (const entry of feed) {
      const key = entry.createdAt.toISOString().slice(0, 10);
      const last = days[days.length - 1];
      if (last && last.key === key) last.rows.push(entry);
      else days.push({ key, rows: [entry] });
    }
    body = feed.length ? (
      <>
        {days.map((day) => (
          <div className="block" key={day.key}>
            <div className="bh">
              <h2 className="st">{formatDate(day.key)}</h2>
              <span className="note">{day.rows.length}</span>
            </div>
            <div className="list">
              {day.rows.map((entry) => (
                <Link className="row" key={entry.id} href={`/history?tab=changes&item=${entry.itemId}`}>
                  <div className="r-check" />
                  <div className="r-main">
                    <div className="r-title">{entry.itemTitle}</div>
                    <div className="r-sub">
                      {entry.userName ?? "Someone"} ·{" "}
                      {entry.type === "note" ? (entry.body ?? "added a note") : (entry.summary ?? "updated")}
                    </div>
                  </div>
                  <div className="r-meta">
                    <div className="r-who">{KIND_DEFS[entry.itemKind as Kind]?.label ?? entry.itemKind}</div>
                    <div className="r-date">{entry.createdAt.toISOString().slice(11, 16)}</div>
                  </div>
                  <div className="r-amt" />
                  <div className="r-status" />
                </Link>
              ))}
            </div>
          </div>
        ))}
      </>
    ) : (
      <ItemList rows={[]} empty="Nothing has happened yet." />
    );
  } else if (tab === "decisions") {
    const decisions = screen.likes
      .filter((item) => item.kind === "decision" && matches([item.title, item.notes]))
      .sort((a, b) => (b.dueDate ?? "").localeCompare(a.dueDate ?? ""));
    const years = new Map<string, typeof decisions>();
    for (const item of decisions) {
      const year = (item.dueDate ?? "").slice(0, 4) || "Undated";
      const list = years.get(year);
      if (list) list.push(item);
      else years.set(year, [item]);
    }
    body = decisions.length ? (
      <>
        {[...years.entries()].map(([year, list]) => (
          <div className="block" key={year}>
            <div className="bh">
              <h2 className="st">{year}</h2>
              <span className="note">{list.length}</span>
            </div>
            <ItemList rows={toRows(pick(screen, list), screen.extras)} />
          </div>
        ))}
      </>
    ) : (
      <ItemList rows={[]} empty="No decisions recorded yet." />
    );
  } else if (tab === "notes") {
    const rows = await db
      .select()
      .from(meetings)
      .where(eq(meetings.householdId, screen.householdId));
    const withNotes = rows
      .filter((row) => row.notes && (!q || row.notes.toLowerCase().includes(q)))
      .sort((a, b) => b.periodStart.localeCompare(a.periodStart));
    const label = (row: (typeof rows)[number]) =>
      row.periodType === "month"
        ? `${formatMonth(row.periodStart.slice(0, 7))} — monthly drive`
        : row.periodType === "quarter"
          ? `${formatQuarter(row.periodStart)} — quarterly review`
          : row.periodType === "year"
            ? `${row.periodStart.slice(0, 4)} — annual review`
            : `Week of ${formatDate(row.periodStart)}`;
    body = withNotes.length ? (
      <>
        {withNotes.map((row) => (
          <div className="notecard" key={row.id}>
            <b>{label(row)}</b>
            {row.notes}
          </div>
        ))}
      </>
    ) : (
      <ItemList rows={[]} empty="No meeting notes yet." />
    );
  } else {
    const groups = FINISHED.map(([title, kind]) => {
      const list = screen.likes
        .filter(
          (item) =>
            item.kind === kind &&
            isDone(item) &&
            matches([item.title, item.notes, item.category]),
        )
        .sort((a, b) => (b.dueDate ?? "").localeCompare(a.dueDate ?? ""));
      return { title, list };
    }).filter((group) => group.list.length);
    body = groups.length ? (
      <>
        {groups.map((group) => (
          <div className="block" key={group.title}>
            <details className="more" open={Boolean(q)}>
              <summary>
                {group.title} ({group.list.length})
              </summary>
              <ItemList rows={toRows(pick(screen, group.list.slice(0, 60)), screen.extras)} />
            </details>
          </div>
        ))}
      </>
    ) : (
      <ItemList rows={[]} empty="Nothing finished yet." />
    );
  }

  return (
    <>
      <div className="ph">
        <div>
          <h1>History</h1>
          <p>
            What changed, what you decided, and everything finished.
            {unseen ? ` ${unseen} new since you last looked.` : ""}
          </p>
        </div>
        {unseen ? <MarkSeen /> : null}
      </div>

      <div className="tabs">
        {TABS.map(([key, label]) => (
          <Link
            key={key}
            href={`/history?tab=${key}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            className={tab === key ? "on" : ""}
          >
            {label}
          </Link>
        ))}
      </div>

      <SearchBox placeholder="Search" />

      {body}
    </>
  );
}
