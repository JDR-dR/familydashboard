import Link from "next/link";
import { loadScreen, pick } from "@/lib/page-data";
import { goalSteps } from "@/lib/db/queries";
import { HORIZONS, isDone } from "@/lib/domain/kinds";
import { money, sumCents, toCents } from "@/lib/domain/money";
import { formatDate } from "@/lib/domain/week";
import type { ItemLike } from "@/lib/domain/rules";
import { toRows } from "@/lib/view";
import { AddLink, ItemList } from "@/components/Row";
import { GoalSteps } from "@/components/GoalSteps";

export const dynamic = "force-dynamic";

const toneOfGoal = (status: string | null) =>
  status === "On track" ? "ok" : status === "At risk" ? "risk" : status === "Achieved" ? "done" : "";

const isCapex = (goal: ItemLike) => goal.capex !== null && goal.capex !== undefined && goal.capex !== "";

/**
 * Where you are heading over one, three and five years, and the steps you agreed
 * to get there. Strategy has no screen of its own any more: the steps are the
 * strategy, and a goal with a capex budget is what used to be a project.
 */
export default async function GoalsPage() {
  const screen = await loadScreen();
  const steps = await goalSteps(screen.householdId);

  const all = screen.likes.filter((item) => item.kind === "lifegoal");
  const open = all.filter((item) => !isDone(item));
  const done = all.filter((item) => isDone(item));
  const capexGoals = open.filter(isCapex);

  const costs = screen.likes.filter((item) => item.kind === "projectexp" && !item.archivedAt);
  const spentOf = (id: string) => sumCents(costs.filter((c) => c.projectId === id).map((c) => c.amount));
  const paidOf = (id: string) =>
    sumCents(costs.filter((c) => c.projectId === id && isDone(c)).map((c) => c.amount));

  return (
    <>
      <div className="ph">
        <div>
          <h1>Goals</h1>
          <p>
            Where you are heading over one, three and five years — and the steps you
            agreed to get there.
          </p>
        </div>
        <AddLink kind="lifegoal" label="+ Goal" className="btn acc" />
      </div>

      {open.length ? (
        <div className="tl">
          <div className="tlaxis">
            <i />
          </div>
          <div className="tlcols">
            {HORIZONS.map((horizon) => {
              const its = open.filter((goal) => (goal.horizon ?? "1 year") === horizon);
              return (
                <div className="tlcol" key={horizon}>
                  <div className="tlh">
                    <b>{horizon}</b>
                    <span>{its.length}</span>
                  </div>
                  {its.length ? (
                    its.map((goal) => {
                      const mine = steps.get(goal.id) ?? [];
                      return (
                        <Link key={goal.id} href={`/goals?item=${goal.id}`} className={`tlcard ${toneOfGoal(goal.status)}`}>
                          <div className="n">{goal.title}</div>
                          <div className="m">
                            {[goal.area, goal.status].filter(Boolean).join(" · ")}
                          </div>
                          {isCapex(goal) || goal.amount ? (
                            <div className="a">
                              {money(toCents(isCapex(goal) ? goal.capex : goal.amount))}
                              {isCapex(goal) ? " capex" : ""}
                            </div>
                          ) : null}
                          {mine.length ? (
                            <div className="st2">
                              {mine.filter((s) => s.done).length}/{mine.length} steps
                            </div>
                          ) : null}
                        </Link>
                      );
                    })
                  ) : (
                    <div className="tlempty">Nothing here yet</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {open.length ? (
        <div style={{ marginTop: 30 }}>
          {open.map((goal) => {
            const mine = steps.get(goal.id) ?? [];
            const budget = toCents(goal.capex);
            const spent = isCapex(goal) ? spentOf(goal.id) : 0;
            const paid = isCapex(goal) ? paidOf(goal.id) : 0;
            const pct = budget ? Math.min(100, Math.round((spent / budget) * 100)) : 0;
            const rows = isCapex(goal) ? costs.filter((c) => c.projectId === goal.id) : [];
            return (
              <div className="gblock" key={goal.id}>
                <div className="bh">
                  <div>
                    <h2 className="st">{goal.title}</h2>
                    <div className="note">
                      {[goal.area, goal.horizon, goal.status].filter(Boolean).join(" · ")}
                      {goal.dueDate ? ` · target ${formatDate(goal.dueDate)}` : ""}
                      {goal.measure ? ` · ${goal.measure}` : ""}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    {isCapex(goal) ? (
                      <AddLink
                        kind="projectexp"
                        label="+ Cost"
                        className="btn acc"
                        extra={{ projectId: goal.id }}
                      />
                    ) : null}
                    <Link className="btn" href={`/goals?item=${goal.id}`}>
                      Open
                    </Link>
                  </div>
                </div>

                {isCapex(goal) ? (
                  <>
                    <div className="note" style={{ marginBottom: 8 }}>
                      {money(spent)} committed of {money(budget)} capex · {money(paid)} paid
                    </div>
                    <div className="bar" style={{ marginBottom: 14 }}>
                      <i style={{ width: `${pct}%`, background: spent > budget ? "var(--accent)" : "var(--ink)" }} />
                    </div>
                  </>
                ) : null}

                {mine.length ? (
                  <GoalSteps itemId={goal.id} steps={mine} />
                ) : (
                  <div className="note" style={{ marginBottom: 10 }}>
                    No steps yet — open the goal and write down how you get there.
                  </div>
                )}

                {isCapex(goal) && rows.length ? (
                  <details className="more">
                    <summary>Capex costs ({rows.length})</summary>
                    <ItemList rows={toRows(pick(screen, rows), screen.extras)} />
                  </details>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : (
        <ItemList
          rows={[]}
          empty="No goals yet. Start with the three that matter most this year."
          addKind="lifegoal"
        />
      )}

      {capexGoals.length ? (
        <div className="block">
          <div className="bh">
            <div>
              <h2 className="st">Capex</h2>
              <div className="note">
                Goals with a build or a purchase behind them — money outside the monthly budget.
              </div>
            </div>
          </div>
          <div className="trio">
            <div>
              <div className="l">Capex budgeted</div>
              <div className="v">{money(sumCents(capexGoals.map((g) => g.capex)))}</div>
            </div>
            <div>
              <div className="l">Committed</div>
              <div className="v">
                {money(capexGoals.reduce((total, g) => total + spentOf(g.id), 0))}
              </div>
            </div>
            <div>
              <div className="l">Paid</div>
              <div className="v">
                {money(capexGoals.reduce((total, g) => total + paidOf(g.id), 0))}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {done.length ? (
        <div className="block">
          <details className="more">
            <summary>Achieved ({done.length})</summary>
            <ItemList rows={toRows(pick(screen, done), screen.extras)} />
          </details>
        </div>
      ) : null}
    </>
  );
}
