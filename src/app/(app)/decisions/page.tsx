import { loadScreen } from "@/lib/page-data";
import { SECTIONS, type Section } from "@/lib/domain/kinds";
import { formatDate } from "@/lib/domain/week";
import { AddLink } from "@/components/Row";
import { SearchBox } from "@/components/SearchBox";
import { OpenRow } from "@/components/OpenRow";

export const dynamic = "force-dynamic";

export default async function DecisionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const query = ((await searchParams).q ?? "").trim().toLowerCase();
  const screen = await loadScreen();

  const decisions = screen.items
    .filter((item) => item.kind === "decision")
    .filter(
      (item) =>
        !query ||
        [item.title, item.notes].some((value) => (value ?? "").toLowerCase().includes(query)),
    )
    .sort((a, b) => (b.dueDate ?? "").localeCompare(a.dueDate ?? ""));

  const byYear = new Map<string, typeof decisions>();
  for (const decision of decisions) {
    const year = (decision.dueDate ?? "Undated").slice(0, 4);
    byYear.set(year, [...(byYear.get(year) ?? []), decision]);
  }

  return (
    <>
      <div className="ph">
        <div>
          <h1>Decisions</h1>
          <p>What you agreed, and when. {decisions.length} recorded.</p>
        </div>
        <AddLink kind="decision" label="+ Decision" className="btn acc" />
      </div>

      <SearchBox placeholder="Search decisions" />

      {decisions.length === 0 ? (
        <div className="list">
          <div className="empty">No decisions found.</div>
        </div>
      ) : (
        [...byYear.entries()].map(([year, list]) => (
          <div className="block" key={year}>
            <div className="bh">
              <h2 className="st">{year}</h2>
              <span className="note">{list.length}</span>
            </div>
            <div className="list">
              {list.map((decision) => (
                <OpenRow key={decision.id} id={decision.id}>
                  <div className="r-check" />
                  <div className="r-main">
                    <div className="r-title">{decision.title}</div>
                    {decision.notes ? <div className="r-sub">{decision.notes}</div> : null}
                  </div>
                  <div className="r-meta">
                    <div className="r-who">{SECTIONS[(decision.section ?? "general") as Section]}</div>
                    <div className="r-date">{formatDate(decision.dueDate)}</div>
                  </div>
                  <div className="r-amt" />
                  <div className="r-status" />
                </OpenRow>
              ))}
            </div>
          </div>
        ))
      )}
    </>
  );
}
