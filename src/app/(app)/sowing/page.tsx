import { loadScreen } from "@/lib/page-data";
import { money, sumCents } from "@/lib/domain/money";
import { today } from "@/lib/domain/week";
import { toRows } from "@/lib/view";
import { AddLink, ItemList } from "@/components/Row";

export const dynamic = "force-dynamic";

export default async function SowingPage() {
  const screen = await loadScreen();
  const year = today().slice(0, 4);
  const sowing = screen.items.filter((item) => item.kind === "sowing");
  const considering = sowing.filter((item) => item.status === "Considering");
  const committed = sowing.filter((item) => item.status === "Committed");
  const given = sowing
    .filter((item) => item.status === "Given")
    .sort((a, b) => (b.dueDate ?? "").localeCompare(a.dueDate ?? ""));

  const committedTotal = sumCents(committed.map((item) => item.amount));
  const givenTotal = sumCents(
    given.filter((item) => (item.dueDate ?? "").startsWith(year)).map((item) => item.amount),
  );

  return (
    <>
      <div className="ph">
        <div>
          <h1>Sowing</h1>
          <p>Who and what you are giving into.</p>
        </div>
        <AddLink kind="sowing" label="+ Sowing" className="btn acc" />
      </div>

      <div className="trio">
        <div>
          <div className="l">Committed</div>
          <div className="v">{money(committedTotal)}</div>
          <div className="x">
            {committed.length} promise{committed.length === 1 ? "" : "s"} outstanding
          </div>
        </div>
        <div>
          <div className="l">Given in {year}</div>
          <div className="v">{money(givenTotal)}</div>
        </div>
        <div>
          <div className="l">Being considered</div>
          <div className="v">{considering.length}</div>
        </div>
      </div>

      <div className="block" style={{ marginTop: 28 }}>
        <div className="bh">
          <h2 className="st">Committed</h2>
          <span className="note">Counted as cash going out</span>
        </div>
        <ItemList rows={toRows(committed, screen.extras)} empty="Nothing committed right now." addKind="sowing" />
      </div>

      <div className="block">
        <div className="bh">
          <h2 className="st">Being considered</h2>
        </div>
        <ItemList rows={toRows(considering, screen.extras)} empty="Nothing under consideration." addKind="sowing" />
      </div>

      {given.length ? (
        <div className="block">
          <details className="more">
            <summary>Given ({given.length})</summary>
            <ItemList rows={toRows(given, screen.extras)} />
          </details>
        </div>
      ) : null}
    </>
  );
}
