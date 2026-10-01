import Link from "next/link";
import { loadScreen } from "@/lib/page-data";
import { isDone, MAINTENANCE_CATEGORIES } from "@/lib/domain/kinds";
import { toItemLike } from "@/lib/db/queries";
import { money, sumCents } from "@/lib/domain/money";
import { formatDate } from "@/lib/domain/week";
import { toRows } from "@/lib/view";
import { AddLink, ItemList } from "@/components/Row";

export const dynamic = "force-dynamic";

const TABS = [["bills", "Bills"], ["onceoff", "Once-off"], ["maintenance", "Maintenance"]] as const;

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const tab = (await searchParams).tab ?? "bills";
  const screen = await loadScreen();
  const open = (kind: string) =>
    screen.items.filter((item) => item.kind === kind && !isDone(toItemLike(item)));
  const closed = (kind: string) =>
    screen.items.filter((item) => item.kind === kind && isDone(toItemLike(item)));

  let body: React.ReactNode;

  if (tab === "bills") {
    const bills = open("bill");
    const monthly = sumCents(
      bills
        .filter((item) => (item.data as Record<string, unknown>).repeat === "Monthly")
        .map((item) => item.amount),
    );
    const paid = closed("bill").slice(0, 30);
    body = (
      <>
        <div className="bh">
          <div>
            <h2 className="st">Bills</h2>
            <div className="note">
              About {money(monthly)} a month in recurring bills. Marking a repeating bill paid creates the next one.
            </div>
          </div>
          <AddLink kind="bill" label="+ Bill" className="btn" />
        </div>
        <ItemList rows={toRows(bills, screen.extras)} empty="No bills to pay." addKind="bill" />
        {paid.length ? (
          <details className="more">
            <summary>Paid ({paid.length})</summary>
            <ItemList rows={toRows(paid, screen.extras)} />
          </details>
        ) : null}
      </>
    );
  } else if (tab === "onceoff") {
    const list = open("onceoff");
    const paid = closed("onceoff");
    body = (
      <>
        <div className="bh">
          <h2 className="st">Once-off expenses</h2>
          <AddLink kind="onceoff" label="+ Once-off" className="btn" />
        </div>
        <ItemList rows={toRows(list, screen.extras)} empty="No purchases or repairs planned." addKind="onceoff" />
        {paid.length ? (
          <details className="more">
            <summary>Paid ({paid.length})</summary>
            <ItemList rows={toRows(paid, screen.extras)} />
          </details>
        ) : null}
      </>
    );
  } else {
    const all = screen.items.filter((item) => item.kind === "maintenance");
    const active = all.filter((item) => item.status === "Needs Action" || item.status === "Booked");
    body = (
      <>
        <div className="bh">
          <div>
            <h2 className="st">Needs attention</h2>
            <div className="note">Items only appear here when action is required.</div>
          </div>
          <AddLink kind="maintenance" label="+ Maintenance" className="btn" />
        </div>
        <ItemList rows={toRows(active, screen.extras)} empty="Nothing in the house needs attention." />

        <div className="bh" style={{ marginTop: 30 }}>
          <div>
            <h2 className="st">House register</h2>
            <div className="note">Every area of the house, and when it was last seen to.</div>
          </div>
        </div>
        <div className="reg">
          {MAINTENANCE_CATEGORIES.map((category) => {
            const mine = all.filter((item) => item.category === category);
            const needs = mine.some((item) => item.status === "Needs Action");
            const booked = mine.some((item) => item.status === "Booked");
            const last = mine
              .filter((item) => item.status === "Done" || item.status === "Fine")
              .sort((a, b) => (b.dueDate ?? "").localeCompare(a.dueDate ?? ""))[0];
            return (
              <Link
                key={category}
                href={`/expenses?tab=maintenance&new=maintenance&category=${encodeURIComponent(category)}`}
                className={needs ? "act" : ""}
              >
                <span>{category}</span>
                <span className="s">
                  {needs
                    ? "Needs action"
                    : booked
                      ? "Booked"
                      : last?.dueDate
                        ? `Last ${formatDate(last.dueDate)}`
                        : mine.length
                          ? `${mine.length} logged`
                          : ""}
                </span>
              </Link>
            );
          })}
        </div>
      </>
    );
  }

  return (
    <>
      <div className="ph">
        <div>
          <h1>Expenses & home</h1>
          <p>Bills, once-off costs and looking after the house.</p>
        </div>
      </div>

      <div className="chips">
        {TABS.map(([key, label]) => (
          <Link key={key} href={`/expenses?tab=${key}`} className={`chip${tab === key ? " on" : ""}`}>
            {label}
          </Link>
        ))}
      </div>

      {body}
    </>
  );
}
