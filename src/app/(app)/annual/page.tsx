import Link from "next/link";
import { loadScreen, pick } from "@/lib/page-data";
import { freedomHistory, getMeeting } from "@/lib/db/queries";
import { periodFigures } from "@/lib/review-data";
import { isDone, HORIZONS, LIFE_AREAS } from "@/lib/domain/kinds";
import {
  freedomScore, monthlyExpenses, monthsToFreedom, passiveMonthly, type ScoreSnapshot,
} from "@/lib/domain/freedom";
import { money, moneyShort, percent, sumCents, toCents } from "@/lib/domain/money";
import {
  formatMonth, inWindow, monthKey, today, yearEnd, yearStart,
} from "@/lib/domain/week";
import { toRows } from "@/lib/view";
import { AddLink, ItemList } from "@/components/Row";
import { MeetingNotes, StepHeader } from "@/components/Meeting";
import { Scorecard } from "@/components/Scorecard";

export const dynamic = "force-dynamic";

const STEPS = [
  "The year in numbers",
  "Freedom Score — a year of movement",
  "Goals achieved",
  "Strategy for the year ahead",
  "Assets, deals and experiences",
  "Decisions & the year ahead",
];

export default async function AnnualReview() {
  const screen = await loadScreen();
  const now = today();
  const start = yearStart(now);
  const end = yearEnd(now);
  const year = now.slice(0, 4);

  const [meeting, scoreRows] = await Promise.all([
    getMeeting(screen.householdId, "year", start),
    freedomHistory(screen.householdId),
  ]);
  const discussed = meeting?.discussed ?? {};
  const doneCount = STEPS.filter((_, index) => discussed[String(index + 1)]).length;

  const { items, extras } = screen;
  const figures = periodFigures(screen, start, end);

  const expenses = monthlyExpenses(screen.likes, {
    needs: screen.household?.monthlyNeeds ? toCents(screen.household.monthlyNeeds) : null,
    wants: screen.household?.monthlyWants ? toCents(screen.household.monthlyWants) : null,
  });
  const score = freedomScore(passiveMonthly(screen.likes, now).monthly, expenses);

  const toSnapshot = (row: (typeof scoreRows)[number]): ScoreSnapshot => ({
    periodStart: row.periodStart,
    passive: toCents(row.passive),
    needs: toCents(row.needs),
    wants: toCents(row.wants),
    score: row.score,
  });
  const allHistory = scoreRows.map(toSnapshot);
  const inYear = scoreRows.filter((row) => inWindow(row.periodStart, start, end)).map(toSnapshot);
  const opened = inYear[0];
  const yearPoints = opened ? score.score - opened.score : 0;
  const months = monthsToFreedom(allHistory, score.score);
  const passiveGrowth = opened ? score.passive - opened.passive : 0;

  const goals = items.filter(
    (item) => item.kind === "lifegoal" && !isDone({ ...item, kind: "lifegoal" } as never),
  );
  const strategy = items.filter((item) => item.kind === "goal");
  const openDeals = screen.likes.filter((item) => item.kind === "investment" && !isDone(item));
  const invested = screen.likes.filter(
    (item) => item.kind === "investment" && item.stage === "Invested",
  );
  const pipeline = sumCents(openDeals.map((item) => item.amount));
  const investedTotal = sumCents(invested.map((item) => item.amount));

  return (
    <>
      <div className="ph">
        <div>
          <h1>Annual Review</h1>
          <p>{year} · the once-a-year conversation about where this is all going</p>
        </div>
        <div className="small muted">
          {doneCount} of {STEPS.length} discussed
        </div>
      </div>

      <div className="meet">
        <div>
          <section className={`step${discussed["1"] ? " done" : ""}`} id="s1">
            <StepHeader
              n={1}
              title="The year in numbers"
              hint="Twelve months of what came in, what went out, and what was left."
              discussed={Boolean(discussed["1"])}
              periodType="year"
              periodStart={start}
            />
            <div className="trio">
              <div>
                <div className="l">Received in {year}</div>
                <div className="v">{money(figures.total)}</div>
                <div className="x">
                  Active {moneyShort(figures.active)} · Passive {moneyShort(figures.passive)}
                </div>
              </div>
              <div>
                <div className="l">Paid out</div>
                <div className="v">{money(figures.paidTotal)}</div>
                <div className="x">
                  {figures.paid.length} item{figures.paid.length === 1 ? "" : "s"}
                </div>
              </div>
              <div>
                <div className="l">{figures.surplus < 0 ? "Shortfall" : "Surplus"}</div>
                <div className={`v${figures.surplus < 0 ? " neg" : " pos"}`}>
                  {money(figures.surplus)}
                </div>
              </div>
            </div>
            <div className="trio" style={{ marginTop: 12 }}>
              <div>
                <div className="l">Passive share of income</div>
                <div className="v">{percent(figures.passive, figures.total)}%</div>
                <div className="x">The one percentage worth growing every year</div>
              </div>
              <div>
                <div className="l">Sown</div>
                <div className="v">{moneyShort(figures.sown)}</div>
                <div className="x">Given in {year}</div>
              </div>
              <div>
                <div className="l">Invested to date</div>
                <div className="v">{moneyShort(investedTotal)}</div>
                <div className="x">{invested.length} positions</div>
              </div>
            </div>
          </section>

          <section className={`step${discussed["2"] ? " done" : ""}`} id="s2">
            <StepHeader
              n={2}
              title="Freedom Score — a year of movement"
              hint="High income ends the second you stop showing up. This is the number that does not."
              discussed={Boolean(discussed["2"])}
              periodType="year"
              periodStart={start}
            >
              <Link className="link" href="/freedom">
                Open the scoreboard
              </Link>
            </StepHeader>
            <Scorecard score={score} />
            <div className="trio" style={{ marginTop: 12 }}>
              <div>
                <div className="l">Movement in {year}</div>
                <div className={`v${yearPoints < 0 ? " neg" : yearPoints > 0 ? " pos" : ""}`}>
                  {opened ? `${yearPoints > 0 ? "+" : ""}${yearPoints} pts` : "—"}
                </div>
                <div className="x">
                  {opened
                    ? `${formatMonth(monthKey(opened.periodStart))} opened at ${opened.score}%`
                    : "No reading kept inside this year yet"}
                </div>
              </div>
              <div>
                <div className="l">Passive income added</div>
                <div className={`v${passiveGrowth > 0 ? " pos" : passiveGrowth < 0 ? " neg" : ""}`}>
                  {opened ? `${passiveGrowth > 0 ? "+" : ""}${money(passiveGrowth)}` : "—"}
                </div>
                <div className="x">A month, against the first reading of the year</div>
              </div>
              <div>
                <div className="l">At this rate</div>
                <div className="v">
                  {score.free ? "Free" : months === null ? "—" : `${months} mo`}
                </div>
                <div className="x">
                  {score.free ? "Already covered" : "To reach 100% at the average gain so far"}
                </div>
              </div>
            </div>
            {inYear.length ? (
              <div className="list" style={{ marginTop: 16 }}>
                {[...inYear].reverse().map((snapshot) => (
                  <div className="row" key={snapshot.periodStart}>
                    <div className="r-main">
                      <div className="r-title">{formatMonth(monthKey(snapshot.periodStart))}</div>
                      <div className="r-sub">
                        {money(snapshot.passive)} passive against{" "}
                        {money(snapshot.needs + snapshot.wants)} spend
                      </div>
                    </div>
                    <div className="r-amt">{snapshot.score}%</div>
                  </div>
                ))}
              </div>
            ) : null}
          </section>

          <section className={`step${discussed["3"] ? " done" : ""}`} id="s3">
            <StepHeader
              n={3}
              title="Goals achieved"
              hint="Read them out. A year of small moves looks like nothing in a week and a lot in twelve months."
              discussed={Boolean(discussed["3"])}
              periodType="year"
              periodStart={start}
            >
              <Link className="link" href="/goals">
                Open goals
              </Link>
            </StepHeader>
            <ItemList
              rows={toRows(pick(screen, figures.achieved), extras)}
              empty="Nothing marked achieved this year yet."
            />
            {LIFE_AREAS.map((area) => {
              const slice = goals.filter(
                (goal) => ((goal.data as Record<string, unknown>).area ?? "Family") === area,
              );
              if (!slice.length) return null;
              return (
                <div key={area} style={{ marginTop: 14 }}>
                  <h3 style={{ margin: "0 0 8px", fontWeight: 500, color: "var(--muted)" }}>
                    {area} — still open
                  </h3>
                  <ItemList rows={toRows(slice, extras)} />
                </div>
              );
            })}
          </section>

          <section className={`step${discussed["4"] ? " done" : ""}`} id="s4">
            <StepHeader
              n={4}
              title="Strategy for the year ahead"
              hint="What changes, what stops, and what you are no longer going to pretend is working."
              discussed={Boolean(discussed["4"])}
              periodType="year"
              periodStart={start}
            >
              <Link className="link" href="/strategy">
                Open strategy
              </Link>
            </StepHeader>
            {strategy.length ? (
              <ItemList rows={toRows(strategy, extras)} />
            ) : (
              <ItemList
                rows={[]}
                empty="Add a strategy card for each business or area you are driving."
                addKind="goal"
              />
            )}
            <div style={{ marginTop: 16 }}>
              <h3 style={{ margin: "0 0 8px", fontWeight: 500, color: "var(--muted)" }}>
                Where the goals sit by horizon
              </h3>
              {HORIZONS.map((horizon) => {
                const count = goals.filter(
                  (goal) =>
                    ((goal.data as Record<string, unknown>).horizon ?? "This year") === horizon,
                ).length;
                return (
                  <div key={horizon} className="linkrow">
                    <span>{horizon}</span>
                    <span className="small muted">
                      {count} open goal{count === 1 ? "" : "s"}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          <section className={`step${discussed["5"] ? " done" : ""}`} id="s5">
            <StepHeader
              n={5}
              title="Assets, deals and experiences"
              hint="What you own, what you are looking at, and what you actually did together."
              discussed={Boolean(discussed["5"])}
              periodType="year"
              periodStart={start}
            >
              <Link className="link" href="/deals/business">
                Open deals
              </Link>
            </StepHeader>
            <div className="trio">
              <div>
                <div className="l">Deal pipeline</div>
                <div className="v">{moneyShort(pipeline)}</div>
                <div className="x">{openDeals.length} open</div>
              </div>
              <div>
                <div className="l">Experiences done in {year}</div>
                <div className="v">{figures.experiences.length}</div>
              </div>
              <div>
                <div className="l">Prayers answered</div>
                <div className="v">{figures.prayersAnswered.length}</div>
                <div className="x">All time</div>
              </div>
            </div>
            {figures.experiences.length ? (
              <div style={{ marginTop: 14 }}>
                <ItemList rows={toRows(pick(screen, figures.experiences), extras)} />
              </div>
            ) : null}
            {invested.length ? (
              <details className="more">
                <summary>Invested ({invested.length})</summary>
                <ItemList rows={toRows(pick(screen, invested), extras)} />
              </details>
            ) : null}
          </section>

          <section className={`step${discussed["6"] ? " done" : ""}`} id="s6">
            <StepHeader
              n={6}
              title="Decisions & the year ahead"
              hint="The few things that would make next year different."
              discussed={Boolean(discussed["6"])}
              periodType="year"
              periodStart={start}
            />
            <ItemList
              rows={toRows(pick(screen, figures.decisions), extras)}
              empty="No decisions recorded this year."
            >
              <div className="qa">
                <AddLink kind="decision" label="+ Record a decision" className="btn pri" />
              </div>
            </ItemList>
            <MeetingNotes
              periodType="year"
              periodStart={start}
              notes={meeting?.notes ?? ""}
              label={`Annual notes for ${year}`}
            />
          </section>
        </div>

        <aside className="rail">
          <h4>{year}</h4>
          <div className="pct">
            {doneCount} of {STEPS.length} discussed
          </div>
          <div className="bar">
            <i style={{ width: `${(doneCount / STEPS.length) * 100}%` }} />
          </div>
          {STEPS.map((step, index) => (
            <a key={step} href={`#s${index + 1}`} className={discussed[String(index + 1)] ? "d" : ""}>
              <b>{discussed[String(index + 1)] ? "✓" : index + 1}</b>
              {step}
            </a>
          ))}
          <div style={{ marginTop: 18 }}>
            <Link className="link" href="/quarterly">
              Quarterly Review
            </Link>
          </div>
        </aside>
      </div>
    </>
  );
}
