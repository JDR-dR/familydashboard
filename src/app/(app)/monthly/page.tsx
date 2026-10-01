import Link from "next/link";
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
import { HORIZONS } from "@/lib/domain/kinds";

export const dynamic = "force-dynamic";

const STEPS = ["Parked for this drive", "Goals", "Strategy", "The month in numbers", "Focus & decisions"];

export default async function MonthlyDrive() {
  const screen = await loadScreen();
  const now = today();
  const start = monthStart(now);
  const end = monthEnd(now);
  const meeting = await getMeeting(screen.householdId, "month", start);
  const discussed = meeting?.discussed ?? {};
  const doneCount = STEPS.filter((_, index) => discussed[String(index + 1)]).length;

  const { likes, items, extras } = screen;

  const huddle = inSlot(likes, "Monthly drive");
  const parked = inSlot(likes, "To decide together");

  const goals = items.filter((item) => item.kind === "lifegoal" && !isDone({ ...item, kind: "lifegoal" } as never));
  const strategy = items.filter((item) => item.kind === "goal");

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
          {doneCount} of {STEPS.length} discussed
        </div>
      </div>

      <div className="meet">
        <div>
          <section className={`step${discussed["1"] ? " done" : ""}`} id="s1">
            <StepHeader
              n={1}
              title="Parked for this drive"
              hint="Everything you agreed to think about together, rather than rush in a weekly."
              discussed={Boolean(discussed["1"])}
              periodType="month"
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

          <section className={`step${discussed["2"] ? " done" : ""}`} id="s2">
            <StepHeader
              n={2}
              title="Goals"
              hint="Are you closer than a month ago? Move the status, or add the next step as a task."
              discussed={Boolean(discussed["2"])}
              periodType="month"
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

          <section className={`step${discussed["3"] ? " done" : ""}`} id="s3">
            <StepHeader
              n={3}
              title="Strategy"
              hint="What is the current focus for each business or area, and what changes this month?"
              discussed={Boolean(discussed["3"])}
              periodType="month"
              periodStart={start}
            >
              <Link className="link" href="/strategy">
                Open strategy
              </Link>
            </StepHeader>
            {strategy.length ? (
              <ItemList rows={toRows(strategy, extras)} />
            ) : (
              <ItemList rows={[]} empty="Add a strategy card for each business or area you are driving." addKind="goal" />
            )}
            {goalTasks.length ? (
              <div style={{ marginTop: 14 }}>
                <ItemList rows={toRows(pick(screen, goalTasks), extras)} />
              </div>
            ) : null}
          </section>

          <section className={`step${discussed["4"] ? " done" : ""}`} id="s4">
            <StepHeader
              n={4}
              title="The month in numbers"
              hint="What actually came in and went out this month."
              discussed={Boolean(discussed["4"])}
              periodType="month"
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

          <section className={`step${discussed["5"] ? " done" : ""}`} id="s5">
            <StepHeader
              n={5}
              title="Focus & decisions"
              hint="What matters most in the month ahead."
              discussed={Boolean(discussed["5"])}
              periodType="month"
              periodStart={start}
            />
            <ItemList rows={toRows(decisions, extras)} empty="No decisions recorded this month.">
              <div className="qa">
                <AddLink kind="decision" label="+ Record a decision" className="btn pri" />
              </div>
            </ItemList>
            <MeetingNotes
              periodType="month"
              periodStart={start}
              notes={meeting?.notes ?? ""}
              label="Monthly notes"
            />
          </section>
        </div>

        <aside className="rail">
          <h4>{formatMonth(monthKey(now))}</h4>
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
            <Link className="link" href="/">
              Back to Weekly Drive
            </Link>
          </div>
        </aside>
      </div>
    </>
  );
}
