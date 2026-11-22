import Link from "next/link";
import { notFound } from "next/navigation";
import { loadScreen, pick } from "@/lib/page-data";
import {
  FINANCE_KEYS, FINANCE_SECTIONS, financeCategories, financeDefaults, financeRows,
  financeSection, runRate, type FinanceKey,
} from "@/lib/domain/finance";
import { isDone } from "@/lib/domain/kinds";
import { money, sumCents, toCents } from "@/lib/domain/money";
import { addDays, monthKey, today } from "@/lib/domain/week";
import { toRows } from "@/lib/view";
import { AddLink, ItemList } from "@/components/Row";

export const dynamic = "force-dynamic";

/**
 * The money screens, in the order the budget runs. Each one groups its records by
 * the budget's own line items, so adding a cost means picking something the
 * budget already knows about — and anything it has not seen stays visible under
 * "Not yet in the budget" rather than quietly disappearing into Other.
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

  const monthly = runRate(rows);
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
          <div className="l">Monthly run-rate</div>
          <div className="v">{money(monthly)}</div>
          <div className="x">Monthly at face value, annual over twelve</div>
        </div>
        <div>
          <div className="l">Due in 30 days</div>
          <div className="v">{money(soonTotal)}</div>
          <div className="x">
            {soon.length} item{soon.length === 1 ? "" : "s"}
          </div>
        </div>
        <div>
          <div className="l">{key === "income" ? "Received this month" : "Open items"}</div>
          <div className="v">{key === "income" ? money(received) : open.length}</div>
          <div className="x">
            {key === "income"
              ? "Marked as received"
              : settled.length
                ? `${settled.length} settled`
                : "Nothing settled yet"}
          </div>
        </div>
      </div>

      <div className="block" style={{ marginTop: 28 }}>
        <div className="bh">
          <div>
            <h2 className="st">Budget lines</h2>
            <div className="note">
              Grouped the way the budget groups them. Anything the budget has not seen
              is listed on its own below.
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
