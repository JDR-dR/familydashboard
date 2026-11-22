import Link from "next/link";
import { howManyDiscussed, stepPos, stepProps } from "@/lib/domain/drives";
import { requireSession } from "@/lib/auth";
import {
  activityFeed, allItems, getHousehold, getMeeting, lastMonthlyDrive,
  latestNotes, stepCounts, toItemLike, unseenCount,
} from "@/lib/db/queries";
import { db } from "@/lib/db";
import { itemLinks, items as itemsTable } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import {
  carriedOver, cashRequired, dueThisWeek, incomeSplit, incomeWindow, inSlot,
} from "@/lib/domain/rules";
import { isDone, type Kind } from "@/lib/domain/kinds";
import { money, moneyShort } from "@/lib/domain/money";
import { formatWeekRange, monthKey, today, weekEnd, weekStart, formatMonth } from "@/lib/domain/week";
import { toRows } from "@/lib/view";
import { ItemList, AddLink } from "@/components/Row";
import { MarkSeenButton, MeetingNotes, QuickAdd, StepHeader } from "@/components/Meeting";
import { DriveRail, FlowEditor } from "@/components/Drive";

export const dynamic = "force-dynamic";


export default async function WeeklyDrive(props: { searchParams: Promise<Record<string, string | undefined>> }) {
  const editFlow = Boolean((await props.searchParams).flow);
  const session = await requireSession();
  const householdId = session.householdId;
  const now = today();
  const start = weekStart(now);
  const end = weekEnd(now);

  const [household, items, notes, steps, meeting, lastMonthly, unseen, feed] = await Promise.all([
    getHousehold(householdId),
    allItems(householdId),
    latestNotes(householdId),
    stepCounts(householdId),
    getMeeting(householdId, "week", start),
    lastMonthlyDrive(householdId),
    unseenCount(householdId, session.user.id),
    activityFeed(householdId, 5),
  ]);

  const linkRows = await db
    .select({ itemId: itemLinks.itemId, count: sql<number>`count(*)::int` })
    .from(itemLinks)
    .innerJoin(itemsTable, eq(itemsTable.id, itemLinks.itemId))
    .where(eq(itemsTable.householdId, householdId))
    .groupBy(itemLinks.itemId);
  const linkCounts = new Map(linkRows.map((row) => [row.itemId, row.count]));

  const names = household?.personNames ?? {};
  const extras = { names, notes, steps, linkCounts };
  const likes = items.map(toItemLike);
  const byId = new Map(items.map((item) => [item.id, item]));
  const pick = (list: { id: string }[]) =>
    list.map((entry) => byId.get(entry.id)!).filter(Boolean);

  const discussed = meeting?.discussed ?? {};
  const order = household?.driveOrder ?? null;
  const flow = howManyDiscussed("week", discussed, order);

  const carried = carriedOver(likes, now);
  const thisWeek = dueThisWeek(likes, now);
  const nextWeek = inSlot(likes, "Next week");
  const monthly = inSlot(likes, "Monthly drive");
  const parked = inSlot(likes, "To decide together");

  const income = incomeWindow(likes, now);
  const split = incomeSplit(income.firm);
  const out = cashRequired(likes, now);
  const net = income.total - out.total;

  const openDeals = likes.filter((item) => item.kind === "investment" && !isDone(item));
  const openExperiences = likes.filter((item) => item.kind === "experience" && !isDone(item));
  const planning = openExperiences.filter((item) => item.stage !== "Dreaming");

  const kingdom = items.filter(
    (item) => (item.kind === "prayer" || item.kind === "sowing") && !isDone(toItemLike(item)),
  );

  const homeKinds: Kind[] = ["bill", "onceoff", "maintenance", "projectexp", "medical"];
  const in30 = cashRequired(likes, now).rows.map((row) => row.id);
  const homeRows = items.filter(
    (item) =>
      homeKinds.includes(item.kind as Kind) &&
      !isDone(toItemLike(item)) &&
      (in30.includes(item.id) || item.status === "Needs Action" || item.status === "To pay"),
  );

  const decisions = items.filter(
    (item) => item.kind === "decision" && item.dueDate && item.dueDate >= start && item.dueDate <= end,
  );

  const monthlyDone = lastMonthly?.periodStart?.slice(0, 7) === monthKey(now);
  const latestChange = feed.find((entry) => entry.userId !== session.user.id);

  return (
    <>
      <div className="ph">
        <div>
          <h1>Weekly Drive</h1>
          <p>{formatWeekRange(now)}</p>
        </div>
        <div className="small muted">
          {flow.done} of {flow.total} discussed
        </div>
      </div>

      {unseen > 0 ? (
        <div className="welcome">
          <div>
            <h3>
              {unseen} update{unseen > 1 ? "s" : ""} since you last looked
            </h3>
            <p>
              {latestChange
                ? `Most recent: ${latestChange.userName ?? "Someone"} on ${latestChange.itemTitle}.`
                : "Open Activity to see what changed."}
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <MarkSeenButton />
            <Link className="btn pri" href="/history">
              See what changed
            </Link>
          </div>
        </div>
      ) : null}

      <div className="band">
        <a className="c" href="#step-lastweek">
          <div className={`v${carried.length ? " acc" : ""}`}>{carried.length}</div>
          <div className="l">Carried over</div>
        </a>
        <a className="c" href="#step-thisweek">
          <div className="v">{thisWeek.length}</div>
          <div className="l">Tasks due this week</div>
        </a>
        <a className="c" href="#step-income">
          <div className="v">{moneyShort(income.total)}</div>
          <div className="l">Income, next 30 days</div>
        </a>
        <a className="c" href="#step-home">
          <div className="v">{moneyShort(out.total)}</div>
          <div className="l">Cash required, next 30 days</div>
        </a>
        <a className="c" href="#step-deals">
          <div className="v">{openDeals.length}</div>
          <div className="l">Active opportunities</div>
        </a>
        <a className="c" href="#step-experiences">
          <div className="v">{planning.length}</div>
          <div className="l">Experiences being planned</div>
        </a>
      </div>

      <FlowEditor period="week" order={order} open={editFlow} />

      <div className="meet">
        <div className="stepflow">
          <section
              className={`step${discussed["lastweek"] ? " done" : ""}`}
              id="step-lastweek"
              style={{ order: stepPos("week", "lastweek", order) }}
              hidden={!stepPos("week", "lastweek", order)}
            >
              <StepHeader
                {...stepProps("week", "lastweek", order)}
                discussed={Boolean(discussed["lastweek"])}
                periodStart={start}
              >
              <Link className="link" href="/tasks">
                All tasks
              </Link>
            </StepHeader>
            <ItemList
              rows={toRows(pick(carried), { ...extras, showCarried: true })}
              empty="Nothing carried over — everything from last week was finished."
            />
          </section>

          <section
              className={`step${discussed["thisweek"] ? " done" : ""}`}
              id="step-thisweek"
              style={{ order: stepPos("week", "thisweek", order) }}
              hidden={!stepPos("week", "thisweek", order)}
            >
              <StepHeader
                {...stepProps("week", "thisweek", order)}
                discussed={Boolean(discussed["thisweek"])}
                periodStart={start}
              >
              <Link className="link" href="/tasks">
                All tasks
              </Link>
            </StepHeader>
            <ItemList rows={toRows(pick(thisWeek), extras)} empty="No tasks for this week yet — add one below.">
              <QuickAdd names={names} defaultDue={end} />
            </ItemList>
            {nextWeek.length ? (
              <details className="more">
                <summary>
                  Next week&apos;s drive ({nextWeek.length}) — rolls in automatically next Friday
                </summary>
                <ItemList rows={toRows(pick(nextWeek), extras)} />
              </details>
            ) : null}
            {monthly.length ? (
              <details className="more">
                <summary>Parked for the Monthly Drive ({monthly.length})</summary>
                <ItemList rows={toRows(pick(monthly), extras)} />
              </details>
            ) : null}
            {parked.length ? (
              <details className="more">
                <summary>Waiting for a joint decision ({parked.length})</summary>
                <ItemList rows={toRows(pick(parked), extras)} />
              </details>
            ) : null}
          </section>

          <section
              className={`step${discussed["income"] ? " done" : ""}`}
              id="step-income"
              style={{ order: stepPos("week", "income", order) }}
              hidden={!stepPos("week", "income", order)}
            >
              <StepHeader
                {...stepProps("week", "income", order)}
                discussed={Boolean(discussed["income"])}
                periodStart={start}
              >
              <Link className="link" href="/finance/income">
                Open
              </Link>
            </StepHeader>
            <div className="trio">
              <div>
                <div className="l">Expected in</div>
                <div className="v">{money(income.total)}</div>
                <div className="x">
                  Active {moneyShort(split.active)} · Passive {moneyShort(split.passive)}
                  {income.possibleTotal ? ` · + ${moneyShort(income.possibleTotal)} possible` : ""}
                </div>
              </div>
              <div>
                <div className="l">Going out</div>
                <div className="v">{money(out.total)}</div>
              </div>
              <div>
                <div className="l">Projected {net < 0 ? "shortfall" : "surplus"}</div>
                <div className={`v${net < 0 ? " neg" : ""}`}>{money(net)}</div>
              </div>
            </div>
            <ItemList
              rows={toRows(pick(income.rows), extras)}
              empty="No income expected in the next 30 days."
              addKind="income"
            />
          </section>

          <section
              className={`step${discussed["home"] ? " done" : ""}`}
              id="step-home"
              style={{ order: stepPos("week", "home", order) }}
              hidden={!stepPos("week", "home", order)}
            >
              <StepHeader
                {...stepProps("week", "home", order)}
                discussed={Boolean(discussed["home"])}
                periodStart={start}
              >
              <Link className="link" href="/finance/needs">
                Home
              </Link>
              <Link className="link" href="/goals">
                Projects
              </Link>
              <Link className="link" href="/finance/medical">
                Medical
              </Link>
            </StepHeader>
            <ItemList
              rows={toRows(homeRows, extras)}
              empty="No bills or maintenance needing attention."
              addKind="bill"
            />
          </section>

          <section
              className={`step${discussed["kingdom"] ? " done" : ""}`}
              id="step-kingdom"
              style={{ order: stepPos("week", "kingdom", order) }}
              hidden={!stepPos("week", "kingdom", order)}
            >
              <StepHeader
                {...stepProps("week", "kingdom", order)}
                discussed={Boolean(discussed["kingdom"])}
                periodStart={start}
              >
              <Link className="link" href="/prayer">
                Prayer
              </Link>
              <Link className="link" href="/sowing">
                Sowing
              </Link>
            </StepHeader>
            <ItemList
              rows={toRows(kingdom, extras)}
              empty="No open prayers or sowing."
              addKind="prayer"
            />
          </section>

          <section
              className={`step${discussed["deals"] ? " done" : ""}`}
              id="step-deals"
              style={{ order: stepPos("week", "deals", order) }}
              hidden={!stepPos("week", "deals", order)}
            >
              <StepHeader
                {...stepProps("week", "deals", order)}
                discussed={Boolean(discussed["deals"])}
                periodStart={start}
              >
              <Link className="link" href="/deals/property">
                Property
              </Link>
              <Link className="link" href="/deals/stocks">
                Stocks
              </Link>
              <Link className="link" href="/deals/business">
                Business
              </Link>
            </StepHeader>
            <ItemList
              rows={toRows(pick(openDeals), extras)}
              empty="No active opportunities."
              addKind="investment"
            />
          </section>

          <section
              className={`step${discussed["experiences"] ? " done" : ""}`}
              id="step-experiences"
              style={{ order: stepPos("week", "experiences", order) }}
              hidden={!stepPos("week", "experiences", order)}
            >
              <StepHeader
                {...stepProps("week", "experiences", order)}
                discussed={Boolean(discussed["experiences"])}
                periodStart={start}
              >
              <Link className="link" href="/experiences">
                Open
              </Link>
            </StepHeader>
            <ItemList
              rows={toRows(pick(openExperiences).slice(0, 8), extras)}
              empty="Nothing being planned. What would you love to do next?"
              addKind="experience"
            />
          </section>

          <section
              className={`step${discussed["decisions"] ? " done" : ""}`}
              id="step-decisions"
              style={{ order: stepPos("week", "decisions", order) }}
              hidden={!stepPos("week", "decisions", order)}
            >
              <StepHeader
                {...stepProps("week", "decisions", order)}
                discussed={Boolean(discussed["decisions"])}
                periodStart={start}
              >
              <Link className="link" href="/history?tab=decisions">
                All decisions
              </Link>
            </StepHeader>
            <ItemList rows={toRows(decisions, extras)} empty="No decisions recorded this week.">
              <div className="qa">
                <AddLink kind="decision" label="+ Record a decision" className="btn pri" />
              </div>
            </ItemList>

            {!monthlyDone ? (
              <div className="welcome" style={{ marginTop: 20 }}>
                <div>
                  <h3>Monthly Drive for {formatMonth(monthKey(now))} not done yet</h3>
                  <p>
                    Goals and strategy moved to a monthly conversation, so the weekly stays quick.
                  </p>
                </div>
                <Link className="btn pri" href="/monthly">
                  Open Monthly Drive
                </Link>
              </div>
            ) : null}
</section>

          <div style={{ order: 999 }}>
            <MeetingNotes
              periodType="week"
              periodStart={start}
              notes={meeting?.notes ?? ""}
              label="Meeting notes"
            />
          </div>
        </div>

        <DriveRail period="week" order={order} discussed={discussed} title="This week’s meeting">
          <div style={{ marginTop: 18 }}>
            <Link className="link" href="/monthly">
              Open Monthly Drive
            </Link>
          </div>
        </DriveRail>
      </div>
    </>
  );
}
