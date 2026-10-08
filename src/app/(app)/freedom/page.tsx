import Link from "next/link";
import { loadScreen, pick } from "@/lib/page-data";
import { freedomHistory } from "@/lib/db/queries";
import {
  freedomScore, monthlyExpenses, monthsToFreedom, passiveMonthly, scoreMovement,
  yearsWithReadings, type ScoreSnapshot,
} from "@/lib/domain/freedom";
import { ScoreDashboard, type DashboardView } from "@/components/ScoreDashboard";
import { money, toCents } from "@/lib/domain/money";
import { formatMonth, monthKey, monthStart, today } from "@/lib/domain/week";
import { toRows } from "@/lib/view";
import { AddLink, ItemList } from "@/components/Row";
import { Scorecard } from "@/components/Scorecard";
import { BaselineForm, CaptureScore } from "@/components/FreedomForms";

export const dynamic = "force-dynamic";

export default async function FreedomPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const screen = await loadScreen();
  const now = today();
  const thisMonth = monthStart(now);

  const baseline = {
    needs: screen.household?.monthlyNeeds ? toCents(screen.household.monthlyNeeds) : null,
    wants: screen.household?.monthlyWants ? toCents(screen.household.monthlyWants) : null,
  };

  const expenses = monthlyExpenses(screen.likes, baseline);
  const passive = passiveMonthly(screen.likes, now);
  const score = freedomScore(passive.monthly, expenses);

  const rows = await freedomHistory(screen.householdId);
  const history: ScoreSnapshot[] = rows.map((row) => ({
    periodStart: row.periodStart,
    passive: toCents(row.passive),
    needs: toCents(row.needs),
    wants: toCents(row.wants),
    score: row.score,
    note: row.note,
  }));
  const movement = scoreMovement(history);
  const months = monthsToFreedom(history, score.score);
  const best = history.reduce((top, row) => Math.max(top, row.score), 0);
  const captured = rows.find((row) => row.periodStart === thisMonth);

  // The dashboard's three views. Years offered are the ones with readings, plus
  // this one, so the picker is never empty on a fresh household.
  const view: DashboardView =
    params.view === "year" ? "year" : params.view === "yoy" ? "yoy" : "month";
  const years = [...new Set([...yearsWithReadings(history), now.slice(0, 4)])].sort();
  const chooseYear = (value: string | undefined, fallback: string) =>
    value && years.includes(value) ? value : fallback;
  const latest = years[years.length - 1];
  const previous = years.length > 1 ? years[years.length - 2] : latest;

  return (
    <>
      <div className="ph">
        <div>
          <h1>Financial Freedom Score</h1>
          <p>
            High income does not equal freedom. High income ends the second you stop
            showing up — passive income bigger than your monthly expenses does not need
            you in the room.
          </p>
        </div>
        <AddLink kind="income" label="+ Passive income" className="btn acc" />
      </div>

      <Scorecard score={score} />

      <div className="trio" style={{ marginTop: 12 }}>
        <div>
          <div className="l">Since the last reading</div>
          <div className={`v${movement.points < 0 ? " neg" : movement.points > 0 ? " pos" : ""}`}>
            {movement.previous
              ? `${movement.points > 0 ? "+" : ""}${movement.points} pts`
              : "—"}
          </div>
          <div className="x">
            {movement.previous
              ? `${formatMonth(monthKey(movement.previous.periodStart))} was ${movement.previous.score}%`
              : "Keep two readings and the trend starts here"}
          </div>
        </div>
        <div>
          <div className="l">Best so far</div>
          <div className="v">{history.length ? `${best}%` : "—"}</div>
          <div className="x">
            {history.length} reading{history.length === 1 ? "" : "s"} kept
          </div>
        </div>
        <div>
          <div className="l">At this rate</div>
          <div className="v">
            {score.free ? "Free" : months === null ? "—" : `${months} mo`}
          </div>
          <div className="x">
            {score.free
              ? "The scoreboard is already paying for your life"
              : months === null
                ? "Needs two readings that moved upward"
                : "To reach 100% at the average gain so far"}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 28 }}>
        <ScoreDashboard
          history={history}
          view={view}
          year={chooseYear(params.year, latest)}
          compareA={chooseYear(params.a, previous)}
          compareB={chooseYear(params.b, latest)}
          years={years}
        />
      </div>

      <div className="block">
        <div className="bh">
          <div>
            <h2 className="st">Keep this month&rsquo;s score</h2>
            <div className="note">
              {captured
                ? `${formatMonth(monthKey(thisMonth))} is already kept at ${captured.score}%. Saving again corrects it.`
                : "Take the reading at the Friday coffee and it becomes a record rather than a memory."}
            </div>
          </div>
        </div>
        <CaptureScore
          periodStart={thisMonth}
          passive={score.passive}
          needs={score.needs}
          wants={score.wants}
          score={score.score}
          existing={Boolean(captured)}
          monthLabel={formatMonth(monthKey(thisMonth))}
        />
      </div>

      <div className="block">
        <div className="bh">
          <div>
            <h2 className="st">What you spend in a month</h2>
            <div className="note">
              You decide this number. Leave a box empty and it is read off your recurring
              bills instead — currently {money(expenses.runRate.needs)} needs and{" "}
              {money(expenses.runRate.wants)} wants across{" "}
              {expenses.runRate.rows.length} recurring bill
              {expenses.runRate.rows.length === 1 ? "" : "s"}. Once-off costs and
              maintenance are left out of the run-rate on purpose: they are lumpy, not
              monthly.
            </div>
          </div>
          <Link className="link" href="/expenses">
            Needs &amp; wants
          </Link>
        </div>
        <BaselineForm
          needs={baseline.needs}
          wants={baseline.wants}
          runRateNeeds={expenses.runRate.needs}
          runRateWants={expenses.runRate.wants}
        />
        {expenses.needsFromBaseline || expenses.wantsFromBaseline ? (
          <div className="small muted" style={{ marginTop: 10 }}>
            Using your figure for{" "}
            {expenses.needsFromBaseline && expenses.wantsFromBaseline
              ? "needs and wants"
              : expenses.needsFromBaseline
                ? "needs"
                : "wants"}
            .
          </div>
        ) : null}
      </div>

      <div className="block">
        <div className="bh">
          <div>
            <h2 className="st">What pays you anyway</h2>
            <div className="note">
              Everything that pays you without you actively working for it. A rental
              property. A private loan. A business run by another operator. Royalties.
              Anything marked only Possible is left out.
            </div>
          </div>
          <Link className="link" href="/income">
            All income
          </Link>
        </div>
        <ItemList
          rows={toRows(pick(screen, passive.rows), screen.extras)}
          empty="No passive income yet. One rental, one loan, one dividend and the score starts moving."
          addKind="income"
        />
      </div>

      <div className="block">
        <div className="bh">
          <h2 className="st">Why this scoreboard</h2>
        </div>
        <div className="essay">
          <p>
            The 4% rule was written in 1994. Ask the experts today and one analyst says
            2.7%, Wade Pfau says about 3%, others say 5%, and the man who wrote the rule
            now says 4.7%. On a R5 million account that is the difference between
            R135,000 and R235,000 a year. The experts disagree by R100,000 a year on the
            same money. The moving target is not a bug, it is the business model.
          </p>
          <p>
            The traditional plan also rests on three variables you do not control: the
            growth rate, future tax rates, and the market conditions in the year you
            start withdrawing.
          </p>
          <p>
            So the scoreboard is this instead. Add up everything that pays you without
            you working for it. Divide it by what you spend in a month. That percentage
            is your Financial Freedom Score. R2,500 a month of passive income against
            R10,000 a month of expenses is not 0% retired — it is 25% of the way to
            freedom, and it starts paying you with the very first rand.
          </p>
        </div>
      </div>
    </>
  );
}
