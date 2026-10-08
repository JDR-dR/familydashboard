import { loadScreen, pick } from "@/lib/page-data";
import { cashRequired, incomeSplit, incomeWindow } from "@/lib/domain/rules";
import { freedomScore, monthlyExpenses, passiveMonthly } from "@/lib/domain/freedom";
import { isDone } from "@/lib/domain/kinds";
import { money, percent, sumCents, toCents } from "@/lib/domain/money";
import { addDays, today } from "@/lib/domain/week";
import { toRows } from "@/lib/view";
import { AddLink, ItemList } from "@/components/Row";
import { Scorecard } from "@/components/Scorecard";

export const dynamic = "force-dynamic";

export default async function IncomePage() {
  const screen = await loadScreen();
  const now = today();
  const window = incomeWindow(screen.likes, now);
  const out = cashRequired(screen.likes, now);
  const split = incomeSplit(window.firm);
  const net = window.total - out.total;

  const active = window.rows.filter((item) => item.stream !== "Passive");
  const passive = window.rows.filter((item) => item.stream === "Passive");
  const later = screen.likes.filter(
    (item) => item.kind === "income" && !isDone(item) && item.dueDate !== null && item.dueDate > addDays(now, 30),
  );
  const cut = addDays(now, -90);
  const received = screen.likes
    .filter((item) => item.kind === "income" && isDone(item) && (item.receivedDate ?? item.dueDate ?? "") >= cut)
    .sort((a, b) => (b.receivedDate ?? b.dueDate ?? "").localeCompare(a.receivedDate ?? a.dueDate ?? ""));
  const receivedTotal = sumCents(received.map((item) => item.actual ?? item.amount));

  // The scoreboard sits between the two income blocks, because that is the whole
  // point of splitting them: one stream needs you, the other does not.
  const expenses = monthlyExpenses(screen.likes, {
    needs: screen.household?.monthlyNeeds ? toCents(screen.household.monthlyNeeds) : null,
    wants: screen.household?.monthlyWants ? toCents(screen.household.monthlyWants) : null,
  });
  const score = freedomScore(passiveMonthly(screen.likes, now).monthly, expenses);

  const parts = Object.entries(out.parts)
    .filter(([, value]) => value)
    .map(([label, value]) => `${label} ${money(value)}`)
    .join(" · ");

  return (
    <>
      <div className="ph">
        <div>
          <h1>Income & cash flow</h1>
          <p>Looking forward 30 days. Possible income is shown but not counted.</p>
        </div>
        <AddLink kind="income" label="+ Income" className="btn acc" />
      </div>

      <div className="trio">
        <div>
          <div className="l">Expected in</div>
          <div className="v">{money(window.total)}</div>
          {window.possibleTotal ? <div className="x">+ {money(window.possibleTotal)} possible</div> : null}
        </div>
        <div>
          <div className="l">Going out</div>
          <div className="v">{money(out.total)}</div>
          <div className="x">{parts || "Nothing due"}</div>
        </div>
        <div>
          <div className="l">Projected {net < 0 ? "shortfall" : "surplus"}</div>
          <div className={`v${net < 0 ? " neg" : ""}`}>{money(net)}</div>
        </div>
      </div>

      <div className="trio" style={{ marginTop: 12 }}>
        <div>
          <div className="l">Active income</div>
          <div className="v">{money(split.active)}</div>
          <div className="x">{percent(split.active, split.total)}% of total</div>
        </div>
        <div>
          <div className="l">Passive income</div>
          <div className="v">{money(split.passive)}</div>
          <div className="x">{percent(split.passive, split.total)}% of total</div>
        </div>
        <div>
          <div className="l">Total income</div>
          <div className="v">{money(split.total)}</div>
          <div className="x">Next 30 days</div>
        </div>
      </div>

      <div className="block" style={{ marginTop: 28 }}>
        <div className="bh">
          <h2 className="st">Active income</h2>
          <span className="note">Salaries, business and anything you work for</span>
        </div>
        <ItemList
          rows={toRows(pick(screen, active), screen.extras)}
          empty="No active income expected in the next 30 days."
          addKind="income"
        />
      </div>

      <div style={{ margin: "28px 0" }}>
        <Scorecard score={score} href="/freedom" compact />
      </div>

      <div className="block">
        <div className="bh">
          <h2 className="st">Passive income</h2>
          <span className="note">Rent, dividends, interest and anything that pays without you</span>
        </div>
        <ItemList
          rows={toRows(pick(screen, passive), screen.extras)}
          empty="No passive income expected in the next 30 days."
          addKind="income"
        />
      </div>

      {later.length ? (
        <div className="block">
          <details className="more">
            <summary>Further out ({later.length})</summary>
            <ItemList rows={toRows(pick(screen, later), screen.extras)} />
          </details>
        </div>
      ) : null}

      <div className="block">
        <div className="bh">
          <h2 className="st">Going out, next 30 days</h2>
          <span className="note">
            Bills, once-off costs, maintenance, project costs, medical, sowing, booked experiences and tasks.
          </span>
        </div>
        <ItemList rows={toRows(pick(screen, out.rows), screen.extras)} empty="Nothing going out in the next 30 days." />
      </div>

      <div className="block">
        <div className="bh">
          <h2 className="st">Received, last 90 days</h2>
          <span className="note">{money(receivedTotal)}</span>
        </div>
        <ItemList rows={toRows(pick(screen, received), screen.extras)} empty="Nothing marked as received yet." />
      </div>
    </>
  );
}
