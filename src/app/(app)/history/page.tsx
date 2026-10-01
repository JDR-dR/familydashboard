import Link from "next/link";
import { loadScreen } from "@/lib/page-data";
import { db } from "@/lib/db";
import { meetings } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { isDone, type Kind } from "@/lib/domain/kinds";
import { toItemLike } from "@/lib/db/queries";
import { formatDate, formatMonth } from "@/lib/domain/week";
import { toRows } from "@/lib/view";
import { ItemList } from "@/components/Row";
import { SearchBox } from "@/components/SearchBox";

export const dynamic = "force-dynamic";

const GROUPS: Array<[string, Kind]> = [
  ["Completed tasks", "task"],
  ["Goals achieved", "lifegoal"],
  ["Answered prayers", "prayer"],
  ["Sowing given", "sowing"],
  ["Investments made or passed", "investment"],
  ["Experiences done", "experience"],
  ["Paid once-off expenses", "onceoff"],
  ["Project costs paid", "projectexp"],
  ["Medical settled", "medical"],
  ["Projects finished", "project"],
  ["Maintenance done", "maintenance"],
];

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const query = ((await searchParams).q ?? "").trim().toLowerCase();
  const screen = await loadScreen();

  const matches = (item: { title: string; notes: string | null; nextStep: string | null }) =>
    !query ||
    [item.title, item.notes, item.nextStep].some((value) =>
      (value ?? "").toLowerCase().includes(query),
    );

  const notes = await db
    .select()
    .from(meetings)
    .where(eq(meetings.householdId, screen.householdId));

  const meetingNotes = notes
    .filter((meeting) => meeting.notes && (!query || meeting.notes.toLowerCase().includes(query)))
    .sort((a, b) => b.periodStart.localeCompare(a.periodStart));

  return (
    <>
      <div className="ph">
        <div>
          <h1>History</h1>
          <p>Everything finished, and the notes from past meetings.</p>
        </div>
        <Link className="link" href="/decisions">
          Decisions →
        </Link>
      </div>

      <SearchBox placeholder="Search past items and meeting notes" />

      {meetingNotes.length ? (
        <div className="block">
          <div className="bh">
            <h2 className="st">Meeting notes</h2>
          </div>
          {meetingNotes.map((meeting) => (
            <div className="notecard" key={meeting.id}>
              <b>
                {meeting.periodType === "month"
                  ? `${formatMonth(meeting.periodStart.slice(0, 7))} — monthly drive`
                  : `Week of ${formatDate(meeting.periodStart)}`}
              </b>
              {meeting.notes}
            </div>
          ))}
        </div>
      ) : null}

      {GROUPS.map(([label, kind]) => {
        const list = screen.items
          .filter((item) => item.kind === kind && isDone(toItemLike(item)) && matches(item))
          .sort((a, b) => (b.doneAt ?? b.dueDate ?? "").localeCompare(a.doneAt ?? a.dueDate ?? ""));
        if (!list.length) return null;
        return (
          <div className="block" key={kind}>
            <details className="more" open={Boolean(query)}>
              <summary>
                {label} ({list.length})
              </summary>
              <ItemList rows={toRows(list, screen.extras)} />
            </details>
          </div>
        );
      })}
    </>
  );
}
