import { loadScreen } from "@/lib/page-data";
import { isDone } from "@/lib/domain/kinds";
import { toItemLike } from "@/lib/db/queries";
import { medicalTotals } from "@/lib/domain/rules";
import { money } from "@/lib/domain/money";
import { today } from "@/lib/domain/week";
import { toRows } from "@/lib/view";
import { AddLink, ItemList } from "@/components/Row";

export const dynamic = "force-dynamic";

export default async function MedicalPage() {
  const screen = await loadScreen();
  const year = today().slice(0, 4);
  const totals = medicalTotals(screen.likes);
  const medical = screen.items.filter((item) => item.kind === "medical");
  const toPay = medical.filter((item) => item.status === "To pay");
  const claims = medical.filter((item) => item.status === "Paid" || item.status === "Claim submitted");
  const settled = medical.filter((item) => isDone(toItemLike(item)));

  return (
    <>
      <div className="ph">
        <div>
          <h1>Medical expenses</h1>
          <p>Bills, claims and what came back from the medical aid.</p>
        </div>
        <AddLink kind="medical" label="+ Medical expense" className="btn acc" />
      </div>

      <div className="trio">
        <div>
          <div className="l">Still to pay</div>
          <div className={`v${totals.outstanding ? " neg" : ""}`}>{money(totals.outstanding)}</div>
          <div className="x">{toPay.length} open</div>
        </div>
        <div>
          <div className="l">Paid in {year}</div>
          <div className="v">{money(totals.paidThisYear)}</div>
        </div>
        <div>
          <div className="l">Reimbursed in {year}</div>
          <div className="v">{money(totals.reimbursedThisYear)}</div>
          <div className="x">Out of pocket {money(totals.outOfPocket)}</div>
        </div>
      </div>

      <div className="block" style={{ marginTop: 28 }}>
        <div className="bh">
          <h2 className="st">To pay</h2>
          <span className="note">Counted as cash going out</span>
        </div>
        <ItemList rows={toRows(toPay, screen.extras)} empty="Nothing outstanding." addKind="medical" />
      </div>

      <div className="block">
        <div className="bh">
          <h2 className="st">Paid, waiting on the medical aid</h2>
        </div>
        <ItemList rows={toRows(claims, screen.extras)} empty="No open claims." />
      </div>

      {settled.length ? (
        <div className="block">
          <details className="more">
            <summary>Settled ({settled.length})</summary>
            <ItemList rows={toRows(settled, screen.extras)} />
          </details>
        </div>
      ) : null}
    </>
  );
}
