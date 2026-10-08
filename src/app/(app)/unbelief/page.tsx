import { loadScreen } from "@/lib/page-data";
import { isDone, KIND_DEFS } from "@/lib/domain/kinds";
import { toItemLike } from "@/lib/db/queries";
import { toRows } from "@/lib/view";
import { AddLink, ItemList } from "@/components/Row";

export const dynamic = "force-dynamic";

export default async function UnbeliefPage() {
  const screen = await loadScreen();
  const all = screen.items.filter((item) => item.kind === "unbelief");
  const open = all.filter((item) => !isDone(toItemLike(item)));
  const settled = all.filter((item) => isDone(toItemLike(item)));

  const byCategory = (KIND_DEFS.unbelief.categories ?? []).map((category) => ({
    category,
    rows: open.filter((item) => item.category === category),
  })).filter((group) => group.rows.length);
  const uncategorised = open.filter((item) => !item.category);

  return (
    <>
      <div className="ph">
        <div>
          <h1>Unbelief</h1>
          <p>
            Named honestly, in one place. The areas where it is hard to believe God right
            now, and the truth you are choosing to stand on instead.
          </p>
        </div>
        <AddLink kind="unbelief" label="+ Name one" className="btn acc" />
      </div>

      {open.length === 0 ? (
        <ItemList
          rows={[]}
          empty="Nothing named yet. Naming it is most of the work."
          addKind="unbelief"
        />
      ) : (
        <>
          {byCategory.map((group) => (
            <div className="block" key={group.category}>
              <div className="bh">
                <h2 className="st">{group.category}</h2>
                <span className="note">
                  {group.rows.length} named
                </span>
              </div>
              <ItemList rows={toRows(group.rows, screen.extras)} />
            </div>
          ))}
          {uncategorised.length ? (
            <div className="block">
              <div className="bh">
                <h2 className="st">Not yet placed</h2>
              </div>
              <ItemList rows={toRows(uncategorised, screen.extras)} />
            </div>
          ) : null}
        </>
      )}

      {settled.length ? (
        <div className="block">
          <details className="more">
            <summary>Believing now ({settled.length})</summary>
            <ItemList rows={toRows(settled, screen.extras)} />
          </details>
        </div>
      ) : null}
    </>
  );
}
