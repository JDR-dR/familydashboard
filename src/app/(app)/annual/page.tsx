import Link from "next/link";
import { howManyDiscussed, stepPos, stepProps } from "@/lib/domain/drives";
import { loadScreen, pick } from "@/lib/page-data";
import { getMeeting } from "@/lib/db/queries";
import { periodFigures } from "@/lib/review-data";
import { isDone, HORIZONS, LIFE_AREAS } from "@/lib/domain/kinds";
import { needOf } from "@/lib/domain/needs";
import { money, moneyShort, percent, sumCents, toCents } from "@/lib/domain/money";
import {
  formatMonth, inWindow, monthKey, today, yearEnd, yearStart,
} from "@/lib/domain/week";
import { toRows } from "@/lib/view";
import { AddLink, ItemList } from "@/components/Row";
import { MeetingNotes, StepHeader } from "@/components/Meeting";
import { DriveRail, FlowEditor } from "@/components/Drive";

export const dynamic = "force-dynamic";


export default async function AnnualReview(props: { searchParams: Promise<Record<string, string | undefined>> }) {
  const editFlow = Boolean((await props.searchParams).flow);
  const screen = await loadScreen();
  const now = today();
  const start = yearStart(now);
  const end = yearEnd(now);
  const year = now.slice(0, 4);

  const meeting = await getMeeting(screen.householdId, "year", start);
  const discussed = meeting?.discussed ?? {};
  const order = screen.household?.driveOrder ?? null;
  const flow = howManyDiscussed("year", discussed, order);

  const { items, extras } = screen;
  const figures = periodFigures(screen, start, end);

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
          {flow.done} of {flow.total} discussed
        </div>
      </div>

      <FlowEditor period="year" order={order} open={editFlow} />

      <div className="meet">
        <div className="stepflow">
          <section
              className={`step${discussed["numbers"] ? " done" : ""}`}
              id="step-numbers"
              style={{ order: stepPos("year", "numbers", order) }}
              hidden={!stepPos("year", "numbers", order)}
            >
              <StepHeader
                {...stepProps("year", "numbers", order)}
                discussed={Boolean(discussed["numbers"])}
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


          <section
              className={`step${discussed["goals"] ? " done" : ""}`}
              id="step-goals"
              style={{ order: stepPos("year", "goals", order) }}
              hidden={!stepPos("year", "goals", order)}
            >
              <StepHeader
                {...stepProps("year", "goals", order)}
                discussed={Boolean(discussed["goals"])}
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

          <section
              className={`step${discussed["strategy"] ? " done" : ""}`}
              id="step-strategy"
              style={{ order: stepPos("year", "strategy", order) }}
              hidden={!stepPos("year", "strategy", order)}
            >
              <StepHeader
                {...stepProps("year", "strategy", order)}
                discussed={Boolean(discussed["strategy"])}
                periodStart={start}
              >
              <Link className="link" href="/goals">
                Open goals
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

          <section
              className={`step${discussed["assets"] ? " done" : ""}`}
              id="step-assets"
              style={{ order: stepPos("year", "assets", order) }}
              hidden={!stepPos("year", "assets", order)}
            >
              <StepHeader
                {...stepProps("year", "assets", order)}
                discussed={Boolean(discussed["assets"])}
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

          <section
              className={`step${discussed["decisions"] ? " done" : ""}`}
              id="step-decisions"
              style={{ order: stepPos("year", "decisions", order) }}
              hidden={!stepPos("year", "decisions", order)}
            >
              <StepHeader
                {...stepProps("year", "decisions", order)}
                discussed={Boolean(discussed["decisions"])}
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
</section>

          <div style={{ order: 999 }}>
            <MeetingNotes
              periodType="year"
              periodStart={start}
              notes={meeting?.notes ?? ""}
              label={`Annual notes for ${year}`}
            />
          </div>
        </div>

        <DriveRail period="year" order={order} discussed={discussed} title={String(year)}>
          <div style={{ marginTop: 18 }}>
            <Link className="link" href="/quarterly">
              Quarterly Review
            </Link>
          </div>
        </DriveRail>
      </div>
    </>
  );
}
