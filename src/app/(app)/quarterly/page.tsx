import Link from "next/link";
import { loadScreen, pick } from "@/lib/page-data";
import { freedomHistory, getMeeting } from "@/lib/db/queries";
import { periodFigures } from "@/lib/review-data";
import { isDone, HORIZONS } from "@/lib/domain/kinds";
import {
  freedomScore, monthlyExpenses, passiveMonthly, type ScoreSnapshot,
} from "@/lib/domain/freedom";
import { money, moneyShort, percent, sumCents, toCents } from "@/lib/domain/money";
import {
  formatMonth, formatQuarter, inWindow, monthKey, quarterEnd, quarterStart, today,
} from "@/lib/domain/week";
import { toRows } from "@/lib/view";
import { AddLink, ItemList } from "@/components/Row";
import { MeetingNotes, StepHeader } from "@/components/Meeting";
import { Scorecard } from "@/components/Scorecard";

export const dynamic = "force-dynamic";

const STEPS = [
  "The quarter in numbers",
  "Freedom Score",
  "Goals & strategy",
  "Assets, deals and experiences",
  "Focus & decisions for next quarter",
];

export default async function QuarterlyReview() {
  const screen = await loadScreen();
  const now = today();
  const start = quarterStart(now);
  const end = quarterEnd(now);

  const [meeting, scoreRows] = await Promise.all([
    getMeeting(screen.householdId, "quarter", start),
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

  const inQuarter: ScoreSnapshot[] = scoreRows
    .filter((row) => inWindow(row.periodStart, start, end))
    .map((row) => ({
      periodStart: row.periodStart,
      passive: toCents(row.passive),
      needs: toCents(row.needs),
      wants: toCents(row.wants),
      score: row.score,
    }));
  const opened = inQuarter[0];
  const quarterPoints = opened ? score.score - opened.score : 0;

  const goals = items.filter(
    (item) => item.kind === "lifegoal" && !isDone({ ...item, kind: "lifegoal" } as never),
  );
  const strategy = items.filter((item) => item.kind === "goal");
  const openDeals = screen.likes.filter((item) => item.kind === "investment" && !isDone(item));
  const pipeline = sumCents(openDeals.map((item) => item.amount));
  const booked = screen.likes.filter(
    (item) => item.kind === "experience" && item.stage === "Booked",
  );
  const openGoals = screen.likes.filter((item) => item.kind === "lifegoal" && !isDone(item));
  const onTrack = openGoals.filter((item) => item.status === "On track").length;

  return (
    <>
      <div className="ph">
        <div>
          <h1>Quarterly Review</h1>
          <p>{formatQuarter(now)} · the ninety-day look up from the week</p>
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
              title="The quarter in numbers"
              hint="What actually came in and went out across the three months."
              discussed={Boolean(discussed["1"])}
              periodType="quarter"
              periodStart={start}
            />
            <div className="trio">
              <div>
                <div className="l">Received</div>
                <div className="v">{money(figures.total)}</div>
                <div className="x">
                  Active {moneyShort(figures.active)} ({percent(figures.active, figures.total)}%) ·
                  Passive {moneyShort(figures.passive)} ({percent(figures.passive, figures.total)}%)
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
                <div className="x">The number worth growing</div>
              </div>
              <div>
                <div className="l">Sown</div>
                <div className="v">{moneyShort(figures.sown)}</div>
                <div className="x">Given this quarter</div>
              </div>
              <div>
                <div className="l">Goals on track</div>
                <div className="v">
                  {onTrack} of {openGoals.length}
                </div>
              </div>
            </div>
          </section>

          <section className={`step${discussed["2"] ? " done" : ""}`} id="s2">
            <StepHeader
              n={2}
              title="Freedom Score"
              hint="Passive income against what you spend. Where did it move in ninety days?"
              discussed={Boolean(discussed["2"])}
              periodType="quarter"
              periodStart={start}
            >
              <Link className="link" href="/freedom">
                Open the scoreboard
              </Link>
            </StepHeader>
            <Scorecard score={score} compact />
            <div className="trio" style={{ marginTop: 12 }}>
              <div>
                <div className="l">Movement this quarter</div>
                <div className={`v${quarterPoints < 0 ? " neg" : quarterPoints > 0 ? " pos" : ""}`}>
                  {opened ? `${quarterPoints > 0 ? "+" : ""}${quarterPoints} pts` : "—"}
                </div>
                <div className="x">
                  {opened
                    ? `${formatMonth(monthKey(opened.periodStart))} opened at ${opened.score}%`
                    : "No reading kept inside this quarter yet"}
                </div>
              </div>
              <div>
                <div className="l">Readings kept</div>
                <div className="v">{inQuarter.length} of 3</div>
                <div className="x">One a month at the Friday coffee</div>
              </div>
              <div>
                <div className="l">Still to cover</div>
                <div className={`v${score.free ? " pos" : ""}`}>
                  {score.free ? "Covered" : money(score.gap)}
                </div>
                <div className="x">Every month, to reach 100%</div>
              </div>
            </div>
          </section>

          <section className={`step${discussed["3"] ? " done" : ""}`} id="s3">
            <StepHeader
              n={3}
              title="Goals & strategy"
              hint="Three months is long enough to tell the difference between slow and stuck."
              discussed={Boolean(discussed["3"])}
              periodType="quarter"
              periodStart={start}
            >
              <Link className="link" href="/strategy">
                Open strategy
              </Link>
            </StepHeader>
            {figures.achieved.length ? (
              <div style={{ marginBottom: 16 }}>
                <h3 style={{ margin: "0 0 8px", fontWeight: 500, color: "var(--green)" }}>
                  Achieved this quarter
                </h3>
                <ItemList rows={toRows(pick(screen, figures.achieved), extras)} />
              </div>
            ) : null}
            {HORIZONS.map((horizon) => {
              const slice = goals.filter(
                (goal) => ((goal.data as Record<string, unknown>).horizon ?? "This year") === horizon,
              );
              if (!slice.length) return null;
              return (
                <div key={horizon} style={{ marginBottom: 14 }}>
                  <h3 style={{ margin: "14px 0 8px", fontWeight: 500, color: "var(--muted)" }}>
                    {horizon}
                  </h3>
                  <ItemList rows={toRows(slice, extras)} />
                </div>
              );
            })}
            {strategy.length ? (
              <div style={{ marginTop: 16 }}>
                <h3 style={{ margin: "0 0 8px", fontWeight: 500, color: "var(--muted)" }}>
                  Strategy cards
                </h3>
                <ItemList rows={toRows(strategy, extras)} />
              </div>
            ) : (
              <ItemList
                rows={[]}
                empty="Add a strategy card for each business or area you are driving."
                addKind="goal"
              />
            )}
          </section>

          <section className={`step${discussed["4"] ? " done" : ""}`} id="s4">
            <StepHeader
              n={4}
              title="Assets, deals and experiences"
              hint="What moved in the pipeline, and what you actually did as a family."
              discussed={Boolean(discussed["4"])}
              periodType="quarter"
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
                <div className="l">Experiences done</div>
                <div className="v">{figures.experiences.length}</div>
                <div className="x">{booked.length} booked ahead</div>
              </div>
              <div>
                <div className="l">Prayers answered</div>
                <div className="v">{figures.prayersAnswered.length}</div>
                <div className="x">Worth reading out loud</div>
              </div>
            </div>
            {figures.experiences.length ? (
              <div style={{ marginTop: 14 }}>
                <ItemList rows={toRows(pick(screen, figures.experiences), extras)} />
              </div>
            ) : null}
            {openDeals.length ? (
              <details className="more">
                <summary>Open deals ({openDeals.length})</summary>
                <ItemList rows={toRows(pick(screen, openDeals), extras)} />
              </details>
            ) : null}
          </section>

          <section className={`step${discussed["5"] ? " done" : ""}`} id="s5">
            <StepHeader
              n={5}
              title="Focus & decisions for next quarter"
              hint="One or two things, not ten. Write down what you agreed."
              discussed={Boolean(discussed["5"])}
              periodType="quarter"
              periodStart={start}
            />
            <ItemList
              rows={toRows(pick(screen, figures.decisions), extras)}
              empty="No decisions recorded this quarter."
            >
              <div className="qa">
                <AddLink kind="decision" label="+ Record a decision" className="btn pri" />
              </div>
            </ItemList>
            <MeetingNotes
              periodType="quarter"
              periodStart={start}
              notes={meeting?.notes ?? ""}
              label="Quarterly notes"
            />
          </section>
        </div>

        <aside className="rail">
          <h4>{formatQuarter(now)}</h4>
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
            <Link className="link" href="/annual">
              Annual Review
            </Link>
          </div>
        </aside>
      </div>
    </>
  );
}
