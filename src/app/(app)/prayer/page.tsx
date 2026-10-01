import { loadScreen } from "@/lib/page-data";
import { isDone } from "@/lib/domain/kinds";
import { toItemLike } from "@/lib/db/queries";
import { toRows } from "@/lib/view";
import { AddLink, ItemList } from "@/components/Row";

export const dynamic = "force-dynamic";

export default async function PrayerPage() {
  const screen = await loadScreen();
  const prayers = screen.items.filter((item) => item.kind === "prayer");
  const open = prayers.filter((item) => !isDone(toItemLike(item)));
  const answered = prayers.filter((item) => isDone(toItemLike(item)));

  return (
    <>
      <div className="ph">
        <div>
          <h1>Prayer</h1>
          <p>People and situations you are standing for, and what came of them.</p>
        </div>
        <AddLink kind="prayer" label="+ Prayer" className="btn acc" />
      </div>

      <ItemList rows={toRows(open, screen.extras)} empty="No open prayer items." addKind="prayer" />

      {answered.length ? (
        <details className="more">
          <summary>Answered ({answered.length})</summary>
          <ItemList rows={toRows(answered, screen.extras)} />
        </details>
      ) : null}
    </>
  );
}
