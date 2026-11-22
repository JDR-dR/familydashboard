import Link from "next/link";
import { howManyDiscussed, stepPos, stepProps } from "@/lib/domain/drives";
import { loadScreen, pick } from "@/lib/page-data";
import { getMeeting } from "@/lib/db/queries";
import { inSlot, incomeSplit, incomeWindow } from "@/lib/domain/rules";
import { isDone } from "@/lib/domain/kinds";
import { money, moneyShort, percent, sumCents, toCents } from "@/lib/domain/money";
import {
  formatMonth, inWindow, monthEnd, monthKey, monthStart, today,
} from "@/lib/domain/week";
import { toRows } from "@/lib/view";
import { AddLink, ItemList } from "@/components/Row";
import { MeetingNotes, StepHeader } from "@/components/Meeting";
import { DriveRail, FlowEditor } from "@/components/Drive";
import { HORIZONS } from "@/lib/domain/kinds";

export const dynamic = "force-dynamic";


export default async function MonthlyDrive(props: { searchParams: Promise<Record<string, string | undefined>> }) {
  const editFlow = Boolean((await props.searchParams).flow);
  const screen = await loadScreen();
  const now = today();
  const start = monthStart(now);
  const end = monthEnd(now);
  const meeting = await getMeeting(screen.householdId, "month", start);
  const discussed = meeting?.discussed ?? {};
  const order = screen.household?.driveOrder ?? null;
  const flow = howManyDiscussed("month", discussed, order);

  const { likes, items, extras } = screen;

  const huddle = inSlot(likes, "Monthly drive");
  const parked = inSlot(likes, "To decide together");

  const goals = items.filter((item) => item.kind === "lifegoal" && !isDone({ ...item, kind: "lifegoal" } as never));
  // Strategy has no records of its own any more: the business goals carry the
  // steps that used to be strategy cards.
  const strategy = screen.likes.filter(
    (item) => item.kind === "lifegoal" && item.area === "Business" && !isDone(item),
  );

  const received = likes.filter(
    (item) => item.kind === "income" && isDone(item) && inWindow(item.receivedDate ?? item.dueDate, start, end),
  );
  const split = incomeSplit(received);

  const paidKinds = ["bill", "onceoff", "maintenance", "sowing", "projectexp", "medical"];
  const paid = likes.filter(
    (item) => paidKinds.includes(item.kind) && isDone(item) && inWindow(item.dueDate, start, end),
  );
  const paidTotal = sumCents(paid.map((item) => item.amount));
  const surplus = split.total - paidTotal;

  const openDeals = likes.filter((item) => item.kind === "investment" && !isDone(item));
  const pipeline = sumCents(openDeals.map((item) => item.amount));
  const booked = likes.filter((item) => item.kind === "experience" && item.stage === "Booked").length;
  const openGoals = likes.filter((item) => item.kind === "lifegoal" && !isDone(item));
  const onTrack = openGoals.filter((item) => item.status === "On track").length;

  const decisions = items.filter(
    (item) => item.kind === "decision" && inWindow(item.dueDate, start, end),
  );
  const goalTasks = likes.filter(
    (item) => item.kind === "task" && item.section === "goals" && !isDone(item),
  );

  return (
    <>
      <div className="ph">
        <div>
          <h1>Monthly Drive</h1>
          <p>{formatMonth(monthKey(now))} · the longer conversation, once a month</p>
        </div>
        <div className="small muted">
          {flow.done} of {flow.total} discussed
        </div>
      </div>

      <FlowEditor period="month" order={order} open={editFlow} />

      <div className="meet">
        <div className="stepflow">
          <section
              className={`step${discussed["parked"] ? " done" : ""}`}
              id="step-parked"
              style={{ order: stepPos("month", "parked", order) }}
              hidden={!stepPos("month", "parked", order)}
            >
              <StepHeader
                {...stepProps("month", "parked", order)}
                discussed={Boolean(discussed["parked"])}
                periodStart={start}
              >
              <Link className="link" href="/tasks?filter=huddle">
                All tasks
              </Link>
            </StepHeader>
            <ItemList
              rows={toRows(pick(screen, huddle), extras)}
              empty="Nothing parked for this month."
              addKind="task"
            />
            {parked.length ? (
              <details className="more">
                <summary>Still waiting for a joint decision ({parked.length})</summary>
                <ItemList rows={toRows(pick(screen, parked), extras)} />
              </details>
            ) : null}
          </section>

          <section
              className={`step${discussed["goals"] ? " done" : ""}`}
              id="step-goals"
              style={{ order: stepPos("month", "goals", order) }}
              hidden={!stepPos("month", "goals", order)}
            >
              <StepHeader
                {...stepProps("month", "goals", order)}
                discussed={Boolean(discussed["goals"])}
                periodStart={start}
              >
              <Link className="link" href="/goals">
                Open goals
              </Link>
            </StepHeader>
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
            {goals.length === 0 ? (
              <ItemList rows={[]} empty="No goals captured yet. Start with the three that matter most this year." addKind="lifegoal" />
            ) : null}
          </section>

          <section
              className={`step${discussed["business"] ? " done" : ""}`}
              id="step-business"
              style={{ order: stepPos("month", "business", order) }}
              hidden={!stepPos("month", "business", order)}
            >
              <StepHeader
                {...stepProps("month", "business", order)}
                discussed={Boolean(discussed["business"])}
                periodStart={start}
              >
              <Link className="link" href="/goals">
                Open goals
              </Link>
            </StepHeader>
            {strategy.length ? (
              <ItemList rows={toRows(pick(screen, strategy), extras)} />
            ) : (
              <ItemList rows={[]} empty="Add a goal for each business or area you are driving." addKind="lifegoal" />
            )}
            {goalTasks.length ? (
              <div style={{ marginTop: 14 }}>
                <ItemList rows={toRows(pick(screen, goalTasks), extras)} />
              </div>
            ) : null}
          </section>

          <section
              className={`step${discussed["numbers"] ? " done" : ""}`}
              id="step-numbers"
              style={{ order: stepPos("month", "numbers", order) }}
              hidden={!stepPos("month", "numbers", order)}
            >
              <StepHeader
                {...stepProps("month", "numbers", order)}
                discussed={Boolean(discussed["numbers"])}
                periodStart={start}
              />
            <div className="trio">
              <div>
                <div className="l">Received</div>
                <div className="v">{money(split.total)}</div>
                <div className="x">
                  Active {moneyShort(split.active)} ({percent(split.active, split.total)}%) · Passive{" "}
                  {moneyShort(split.passive)} ({percent(split.passive, split.total)}%)
                </div>
              </div>
              <div>
                <div className="l">Paid out</div>
                <div className="v">{money(paidTotal)}</div>
                <div className="x">
                  {paid.length} item{paid.length === 1 ? "" : "s"}
                </div>
              </div>
              <div>
                <div className="l">{surplus < 0 ? "Shortfall" : "Surplus"}</div>
                <div className={`v${surplus < 0 ? " neg" : ""}`}>{money(surplus)}</div>
              </div>
            </div>
            <div className="trio" style={{ marginTop: 12 }}>
              <div>
                <div className="l">Deal pipeline</div>
                <div className="v">{moneyShort(pipeline)}</div>
                <div className="x">{openDeals.length} open</div>
              </div>
              <div>
                <div className="l">Experiences booked</div>
                <div className="v">{booked}</div>
              </div>
              <div>
                <div className="l">Goals on track</div>
                <div className="v">
                  {onTrack} of {openGoals.length}
                </div>
              </div>
            </div>
            <ItemList rows={toRows(pick(screen, received), extras)} empty="Nothing marked as received yet this month." />
          </section>

          <section
              className={`step${discussed["focus"] ? " done" : ""}`}
              id="step-focus"
              style={{ order: stepPos("month", "focus", order) }}
              hidden={!stepPos("month", "focus", order)}
            >
              <StepHeader
                {...stepProps("month", "focus", order)}
                discussed={Boolean(discussed["focus"])}
                periodStart={start}
              />
            <ItemList rows={toRows(decisions, extras)} empty="No decisions recorded this month.">
              <div className="qa">
                <AddLink kind="decision" label="+ Record a decision" className="btn pri" />
              </div>
            </ItemList>
</section>

          <div style={{ order: 999 }}>
            <MeetingNotes
              periodType="month"
              periodStart={start}
              notes={meeting?.notes ?? ""}
              label="Monthly notes"
            />
          </div>
        </div>

        <DriveRail period="month" order={order} discussed={discussed} title={formatMonth(monthKey(now))}>
          <div style={{ marginTop: 18 }}>
            <Link className="link" href="/weekly">
              Back to Weekly Drive
            </Link>
          </div>
        </DriveRail>
      </div>
    </>
  );
}
