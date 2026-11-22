import Link from "next/link";
import { notFound } from "next/navigation";
import { loadScreen, pick } from "@/lib/page-data";
import {
  FINANCE_KEYS, FINANCE_SECTIONS, financeCategories, financeDefaults, financeRows,
  financeSection, sectionMoney, type FinanceKey,
} from "@/lib/domain/finance";
import { isDone } from "@/lib/domain/kinds";
import { money, sumCents, toCents } from "@/lib/domain/money";
import { addDays, monthKey, today } from "@/lib/domain/week";
import { toRows } from "@/lib/view";
import { AddLink, ItemList } from "@/components/Row";
import { BudgetFigure } from "@/components/BudgetFigure";

export const dynamic = "force-dynamic";

/**
 * The money screens, in the order the budget runs.
 *
 * The app is not the budget. Each screen holds one figure typed in from the real
 * budgeting tool, and underneath it the things that have actually come up, with
 * their amounts. Reading the two against each other is the whole point: an amount
 * next to a task is what makes it possible to weigh it and plan around it.
 */
export default async function FinancePage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (!(FINANCE_KEYS as readonly string[]).includes(section)) notFound();
  const key = section as FinanceKey;
  const meta = financeSection(key);

  const screen = await loadScreen();
  const rows = financeRows(key, screen.likes);
  const cats = financeCategories(key);
  const open = rows.filter((item) => !isDone(item));
  const settled = rows.filter((item) => isDone(item));

  const figures = sectionMoney(key, screen.likes, screen.household?.budget ?? null);
  const typed = screen.household?.budget?.[key] ?? null;
  const horizon = addDays(today(), 30);
  const soon = open.filter((item) => item.dueDate && item.dueDate <= horizon);
  const soonTotal = sumCents(soon.map((item) => item.amount));

  const uncategorised = open.filter(
    (item) => !item.category || !cats.includes(item.category),
  );

  const received = screen.likes
    .filter(
      (item) =>
        item.kind === "income" &&
        isDone(item) &&
        (item.receivedDate ?? item.dueDate ?? "").startsWith(monthKey(today())),
    )
    .reduce((total, item) => total + toCents(item.actual ?? item.amount), 0);

  const presets = financeDefaults(key);

  return (
    <>
      <div className="ph">
        <div>
          <h1>{meta.title}</h1>
          <p>{meta.blurb}</p>
        </div>
        <AddLink kind={meta.kind} label="+ Add" className="btn acc" extra={presets} />
      </div>

      <div className="finnav">
        {FINANCE_SECTIONS.map((s) => (
          <Link
            key={s.key}
            href={`/finance/${s.key}`}
            className={`chip${s.key === key ? " on" : ""}`}
          >
            {s.title}
          </Link>
        ))}
      </div>

      <div className="trio">
        <div>
          <div className="l">Monthly budget</div>
          <div className="v">{figures.set ? money(figures.budgeted) : "—"}</div>
          <div className="x">
            <BudgetFigure section={key} amount={typed} label={`${meta.title} budget`} />
          </div>
        </div>
        <div>
          <div className="l">{key === "income" ? "Expected" : "On the table"}</div>
          <div className="v">{money(figures.open)}</div>
          <div className="x">
            {open.length} open item{open.length === 1 ? "" : "s"}
            {soon.length ? ` · ${money(soonTotal)} inside 30 days` : ""}
          </div>
        </div>
        {key === "income" ? (
          <div>
            <div className="l">Received this month</div>
            <div className="v">{money(received)}</div>
            <div className="x">Marked as received</div>
          </div>
        ) : (
          <div>
            <div className="l">
              {figures.set && figures.left < 0 ? "Over budget" : "Left against budget"}
            </div>
            <div className={`v${figures.set && figures.left < 0 ? " neg" : ""}`}>
              {figures.set ? money(Math.abs(figures.left)) : "—"}
            </div>
            <div className="x">
              {figures.set
                ? "Budget less what is on the table"
                : "Type in the budget figure to compare"}
            </div>
          </div>
        )}
      </div>

      <div className="block" style={{ marginTop: 28 }}>
        <div className="bh">
          <div>
            <h2 className="st">What has come up</h2>
            <div className="note">
              Grouped by the budget line each one belongs to, so you can check it
              against the budgeting tool. Anything with no line yet is listed below.
            </div>
          </div>
        </div>
      </div>

      {cats.map((category) => {
        const its = open.filter((item) => item.category === category);
        if (!its.length) return null;
        return (
          <div className="block" key={category}>
            <div className="bh">
              <h2 className="st">{category}</h2>
              <span className="note">
                {money(sumCents(its.map((item) => item.amount)))}
                {its.length > 1 ? ` · ${its.length} items` : ""}
              </span>
            </div>
            <ItemList rows={toRows(pick(screen, its), screen.extras)} />
          </div>
        );
      })}

      {uncategorised.length ? (
        <div className="block">
          <div className="bh">
            <div>
              <h2 className="st">Not yet in the budget</h2>
              <div className="note">
                Real spending the budget has no line for. Put it on one, or add the line.
              </div>
            </div>
            <span className="note">
              {money(sumCents(uncategorised.map((item) => item.amount)))}
            </span>
          </div>
          <ItemList rows={toRows(pick(screen, uncategorised), screen.extras)} />
        </div>
      ) : null}

      {!open.length ? (
        <ItemList
          rows={[]}
          empty={`Nothing captured under ${meta.title.toLowerCase()} yet.`}
          addKind={meta.kind}
        />
      ) : null}

      {settled.length ? (
        <div className="block">
          <details className="more">
            <summary>Settled ({settled.length})</summary>
            <ItemList
              rows={toRows(
                pick(
                  screen,
                  [...settled]
                    .sort((a, b) => (b.dueDate ?? "").localeCompare(a.dueDate ?? ""))
                    .slice(0, 40),
                ),
                screen.extras,
              )}
            />
          </details>
        </div>
      ) : null}
    </>
  );
}
