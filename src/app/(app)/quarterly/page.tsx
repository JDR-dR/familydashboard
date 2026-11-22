import Link from "next/link";
import { howManyDiscussed, stepPos, stepProps } from "@/lib/domain/drives";
import { loadScreen, pick } from "@/lib/page-data";
import { getMeeting } from "@/lib/db/queries";
import { periodFigures } from "@/lib/review-data";
import { isDone, HORIZONS } from "@/lib/domain/kinds";
import { needOf } from "@/lib/domain/needs";
import { money, moneyShort, percent, sumCents, toCents } from "@/lib/domain/money";
import {
  formatMonth, formatQuarter, inWindow, monthKey, quarterEnd, quarterStart, today,
} from "@/lib/domain/week";
import { toRows } from "@/lib/view";
import { AddLink, ItemList } from "@/components/Row";
import { MeetingNotes, StepHeader } from "@/components/Meeting";
import { DriveRail, FlowEditor } from "@/components/Drive";

export const dynamic = "force-dynamic";


export default async function QuarterlyReview(props: { searchParams: Promise<Record<string, string | undefined>> }) {
  const editFlow = Boolean((await props.searchParams).flow);
  const screen = await loadScreen();
  const now = today();
  const start = quarterStart(now);
  const end = quarterEnd(now);

  const meeting = await getMeeting(screen.householdId, "quarter", start);
  const discussed = meeting?.discussed ?? {};
  const order = screen.household?.driveOrder ?? null;
  const flow = howManyDiscussed("quarter", discussed, order);

  const { items, extras } = screen;
  const figures = periodFigures(screen, start, end);

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
          {flow.done} of {flow.total} discussed
        </div>
      </div>

      <FlowEditor period="quarter" order={order} open={editFlow} />

      <div className="meet">
        <div className="stepflow">
          <section
              className={`step${discussed["numbers"] ? " done" : ""}`}
              id="step-numbers"
              style={{ order: stepPos("quarter", "numbers", order) }}
              hidden={!stepPos("quarter", "numbers", order)}
            >
              <StepHeader
                {...stepProps("quarter", "numbers", order)}
                discussed={Boolean(discussed["numbers"])}
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


          <section
              className={`step${discussed["goals"] ? " done" : ""}`}
              id="step-goals"
              style={{ order: stepPos("quarter", "goals", order) }}
              hidden={!stepPos("quarter", "goals", order)}
            >
              <StepHeader
                {...stepProps("quarter", "goals", order)}
                discussed={Boolean(discussed["goals"])}
                periodStart={start}
              >
              <Link className="link" href="/goals">
                Open goals
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

          <section
              className={`step${discussed["assets"] ? " done" : ""}`}
              id="step-assets"
              style={{ order: stepPos("quarter", "assets", order) }}
              hidden={!stepPos("quarter", "assets", order)}
            >
              <StepHeader
                {...stepProps("quarter", "assets", order)}
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

          <section
              className={`step${discussed["focus"] ? " done" : ""}`}
              id="step-focus"
              style={{ order: stepPos("quarter", "focus", order) }}
              hidden={!stepPos("quarter", "focus", order)}
            >
              <StepHeader
                {...stepProps("quarter", "focus", order)}
                discussed={Boolean(discussed["focus"])}
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
</section>

          <div style={{ order: 999 }}>
            <MeetingNotes
              periodType="quarter"
              periodStart={start}
              notes={meeting?.notes ?? ""}
              label="Quarterly notes"
            />
          </div>
        </div>

        <DriveRail period="quarter" order={order} discussed={discussed} title={formatQuarter(now)}>
          <div style={{ marginTop: 18 }}>
            <Link className="link" href="/annual">
              Annual Review
            </Link>
          </div>
        </DriveRail>
      </div>
    </>
  );
}
