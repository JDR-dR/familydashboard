import { loadScreen } from "@/lib/page-data";
import { HORIZONS, isDone } from "@/lib/domain/kinds";
import { toItemLike } from "@/lib/db/queries";
import { toRows } from "@/lib/view";
import { AddLink, ItemList } from "@/components/Row";

export const dynamic = "force-dynamic";

export default async function GoalsPage() {
  const screen = await loadScreen();
  const goals = screen.items.filter((item) => item.kind === "lifegoal");
  const open = goals.filter((item) => !isDone(toItemLike(item)));
  const achieved = goals.filter((item) => isDone(toItemLike(item)));

  return (
    <>
      <div className="ph">
        <div>
          <h1>Goals</h1>
          <p>What you are aiming at, from this year out to a lifetime.</p>
        </div>
        <AddLink kind="lifegoal" label="+ Goal" className="btn acc" />
      </div>

      {open.length === 0 ? (
        <ItemList
          rows={[]}
          empty="No goals captured yet. Start with the three that matter most this year."
          addKind="lifegoal"
        />
      ) : (
        HORIZONS.map((horizon) => {
          const slice = open.filter(
            (goal) => ((goal.data as Record<string, unknown>).horizon ?? "This year") === horizon,
          );
          if (!slice.length) return null;
          return (
            <div className="block" key={horizon}>
              <div className="bh">
                <h2 className="st">{horizon}</h2>
                <span className="note">
                  {slice.length} goal{slice.length === 1 ? "" : "s"}
                </span>
              </div>
              <ItemList rows={toRows(slice, screen.extras)} />
            </div>
          );
        })
      )}

      {achieved.length ? (
        <details className="more">
          <summary>Achieved ({achieved.length})</summary>
          <ItemList rows={toRows(achieved, screen.extras)} />
        </details>
      ) : null}
    </>
  );
}
