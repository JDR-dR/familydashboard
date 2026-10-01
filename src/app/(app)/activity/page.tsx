import Link from "next/link";
import { activityFeed, unseenCount } from "@/lib/db/queries";
import { requireSession } from "@/lib/auth";
import { formatWhen, today } from "@/lib/domain/week";
import { KIND_DEFS, type Kind } from "@/lib/domain/kinds";
import { MarkSeenButton } from "@/components/Meeting";
import { db } from "@/lib/db";
import { seenMarkers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function ActivityPage() {
  const session = await requireSession();
  const [feed, unseen, marker] = await Promise.all([
    activityFeed(session.householdId, 80),
    unseenCount(session.householdId, session.user.id),
    db.select().from(seenMarkers).where(eq(seenMarkers.userId, session.user.id)).limit(1),
  ]);
  const since = marker[0]?.lastSeenAt ?? new Date(0);

  const groups = new Map<string, typeof feed>();
  for (const entry of feed) {
    const day = entry.createdAt.toISOString().slice(0, 10);
    const list = groups.get(day) ?? [];
    list.push(entry);
    groups.set(day, list);
  }

  const dayLabel = (day: string) => {
    const label = formatWhen(`${day}T12:00:00.000Z`).replace(/ \d\d:\d\d$/, "");
    return label.charAt(0).toUpperCase() + label.slice(1);
  };

  return (
    <>
      <div className="ph">
        <div>
          <h1>Activity</h1>
          <p>
            Everything added, changed or noted — newest first.
            {unseen ? ` ${unseen} new since you last looked.` : ""}
          </p>
        </div>
        {unseen ? <MarkSeenButton label="Mark all as seen" /> : null}
      </div>

      {feed.length === 0 ? (
        <div className="list">
          <div className="empty">Nothing has happened yet.</div>
        </div>
      ) : (
        [...groups.entries()].map(([day, entries]) => (
          <div className="block" key={day}>
            <div className="bh">
              <h2 className="st">{dayLabel(day)}</h2>
              <span className="note">{entries.length}</span>
            </div>
            <div className="list">
              {entries.map((entry) => (
                <Link key={entry.id} href={`/tasks?item=${entry.itemId}`} className="row">
                  <div className="r-check">
                    {entry.createdAt > since && entry.userId !== session.user.id ? (
                      <span className="dot" title="New since you last looked" />
                    ) : null}
                  </div>
                  <div className="r-main">
                    <div className="r-title">{entry.itemTitle}</div>
                    <div className="r-sub">
                      {entry.userName ?? "Someone"} ·{" "}
                      {entry.type === "note" ? entry.body : entry.summary ?? "updated"}
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
        ))
      )}
    </>
  );
}
