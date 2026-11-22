import Link from "next/link";
import { loadScreen, pick } from "@/lib/page-data";
import { unseenCount } from "@/lib/db/queries";
import { capexOutstanding, monthlyBudget } from "@/lib/domain/finance";
import { freedomBand, freedomScore, monthlyExpenses, passiveMonthly } from "@/lib/domain/freedom";
import { carriedOver, dueThisWeek } from "@/lib/domain/rules";
import { isDone } from "@/lib/domain/kinds";
import { money, moneyShort, sumCents, toCents } from "@/lib/domain/money";
import { formatDate, today, weekEnd, weekStart } from "@/lib/domain/week";
import { toRows } from "@/lib/view";
import { AddLink, ItemList } from "@/components/Row";

export const dynamic = "force-dynamic";

/**
 * One tile per part of the household, each a way in. The money tiles are the
 * budget's own summary line — what comes in, what the month has already promised,
 * and what is left — because a thirty-day cash view reads as a disaster the
 * moment a capex quote lands in it.
 */
export default async function Overview() {
  const screen = await loadScreen();
  const now = today();
  const start = weekStart(now);
  const end = weekEnd(now);

  const carried = carriedOver(screen.likes, now);
  const week = dueThisWeek(screen.likes, now);

  const budget = monthlyBudget(screen.likes);
  const capex = capexOutstanding(screen.likes);

  const expenses = monthlyExpenses(screen.likes, {
    needs: screen.household?.monthlyNeeds ? toCents(screen.household.monthlyNeeds) : null,
    wants: screen.household?.monthlyWants ? toCents(screen.household.monthlyWants) : null,
  });
  const score = freedomScore(passiveMonthly(screen.likes, now).monthly, expenses);

  const goals = screen.likes.filter((item) => item.kind === "lifegoal" && !isDone(item));
  const onTrack = goals.filter((item) => item.status === "On track").length;
  const atRisk = goals.filter((item) => item.status === "At risk").length;

  const deals = screen.likes.filter((item) => item.kind === "investment" && !isDone(item));
  const prayers = screen.likes.filter((item) => item.kind === "prayer" && !isDone(item)).length;
  const unbelief = screen.likes.filter((item) => item.kind === "unbelief" && !isDone(item)).length;
  const committedGiving = sumCents(
    screen.likes.filter((item) => item.kind === "sowing" && item.status === "Committed").map((i) => i.amount),
  );
  const experiences = screen.likes.filter((item) => item.kind === "experience" && !isDone(item));
  const booked = experiences.filter((item) => item.stage === "Booked").length;

  const unseen = await unseenCount(screen.householdId, screen.session.user.id);

  const Tile = ({
    href, title, value, line, sub, tone,
  }: {
    href: string; title: string; value: string | number; line: string;
    sub?: string; tone?: "acc" | "neg" | "pos";
  }) => (
    <Link href={href} className="ov">
      <div className="t">{title}</div>
      <div className={`v${tone ? ` ${tone}` : ""}`}>{value}</div>
      <div className="l">{line}</div>
      {sub ? <div className="s">{sub}</div> : null}
    </Link>
  );

  return (
    <>
      <div className="ph">
        <div>
          <h1>Overview</h1>
          <p>
            Friday {formatDate(start)} to Thursday {formatDate(end)}
            {unseen ? ` · ${unseen} update${unseen > 1 ? "s" : ""} since you last looked` : ""}
          </p>
        </div>
        <AddLink kind="task" label="+ Task" className="btn acc" />
      </div>

      <div className="ovgrid">
        <Tile
          href="/weekly"
          title="This week"
          value={week.length + carried.length}
          line={`${week.length} due, ${carried.length} carried`}
          sub={carried.length ? "Carried items open the Weekly Drive" : "Nothing carried over"}
          tone={carried.length ? "acc" : undefined}
        />
        <Tile
          href="/finance/needs"
          title="Monthly budget"
          value={money(budget.committed)}
          line={`${money(budget.needs)} needs · ${money(budget.wants)} wants · ${money(budget.medical)} medical`}
          sub={
            budget.investments + budget.efund
              ? `plus ${money(budget.investments + budget.efund)} put away each month`
              : "Nothing budgeted to savings yet"
          }
        />
        <Tile
          href="/finance/income"
          title={budget.leftOver < 0 ? "Short each month" : "Left over each month"}
          value={money(budget.leftOver)}
          line={`${money(budget.income)} in · ${money(budget.committed)} committed`}
          sub={
            capex
              ? `${money(capex)} of capex sits outside this`
              : "No capex committed outside the budget"
          }
          tone={budget.leftOver < 0 ? "neg" : "pos"}
        />
        <Tile
          href="/freedom"
          title="Freedom score"
          value={`${score.score}%`}
          line={freedomBand(score.score).label}
          sub={score.free ? "Covered" : `${money(score.gap)} a month still to cover`}
          tone={score.free ? "pos" : undefined}
        />
        <Tile
          href="/goals"
          title="Goals"
          value={`${onTrack}/${goals.length}`}
          line="On track"
          sub={atRisk ? `${atRisk} at risk` : "Nothing flagged at risk"}
          tone={atRisk ? "acc" : undefined}
        />
        <Tile
          href="/deals/business"
          title="NAV"
          value={moneyShort(sumCents(deals.map((item) => item.amount)))}
          line={`${deals.length} open opportunit${deals.length === 1 ? "y" : "ies"}`}
          sub="Business, property and stocks"
        />
        <Tile
          href="/prayer"
          title="Kingdom"
          value={prayers}
          line={`${prayers} being prayed`}
          sub={`${unbelief} named as unbelief${committedGiving ? ` · ${money(committedGiving)} committed` : ""}`}
        />
        <Tile
          href="/experiences"
          title="Experiences"
          value={experiences.length}
          line={`${booked} booked`}
          sub={experiences.length ? "Things to look forward to" : "Nothing being planned"}
        />
      </div>

      {carried.length ? (
        <div className="block" style={{ marginTop: 34 }}>
          <div className="bh">
            <div>
              <h2 className="st">Carried over</h2>
              <div className="note">Not finished last week. These open the Weekly Drive.</div>
            </div>
            <Link className="link" href="/weekly">
              Weekly Drive
            </Link>
          </div>
          <ItemList rows={toRows(pick(screen, carried.slice(0, 6)), { ...screen.extras, showCarried: true })} />
        </div>
      ) : null}

      <div className="block">
        <div className="bh">
          <h2 className="st">Due this week</h2>
          <Link className="link" href="/tasks">
            All tasks
          </Link>
        </div>
        <ItemList
          rows={toRows(pick(screen, week.slice(0, 8)), screen.extras)}
          empty="Nothing due this week yet."
          addKind="task"
        />
      </div>
    </>
  );
}
