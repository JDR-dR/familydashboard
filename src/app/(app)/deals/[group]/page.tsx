import { notFound } from "next/navigation";
import { loadScreen } from "@/lib/page-data";
import { DEAL_GROUPS, KIND_DEFS, type DealGroup } from "@/lib/domain/kinds";
import { money, moneyShort, sumCents } from "@/lib/domain/money";
import { formatDate, today } from "@/lib/domain/week";
import { toRows } from "@/lib/view";
import { AddLink, ItemList } from "@/components/Row";
import { OpenRow } from "@/components/OpenRow";

export const dynamic = "force-dynamic";

export default async function DealsPage({ params }: { params: Promise<{ group: string }> }) {
  const { group } = await params;
  if (!(group in DEAL_GROUPS)) notFound();
  const config = DEAL_GROUPS[group as DealGroup];
  const screen = await loadScreen();

  const mine = screen.items.filter(
    (item) =>
      item.kind === "investment" &&
      (config.types as readonly string[]).includes(
        ((item.data as Record<string, unknown>).type as string) ?? "Other",
      ),
  );

  const stages = KIND_DEFS.investment.states.filter((stage) => stage !== "Passed");
  const passed = mine.filter((item) => item.stage === "Passed");
  const open = mine.filter((item) => item.stage !== "Passed" && item.stage !== "Invested");
  const pipeline = sumCents(open.map((item) => item.amount));
  const invested = sumCents(
    mine.filter((item) => item.stage === "Invested").map((item) => item.amount),
  );

  return (
    <>
      <div className="ph">
        <div>
          <h1>{config.title}</h1>
          <p>
            {config.blurb} {money(pipeline)} in the pipeline
            {invested ? `, ${money(invested)} invested` : ""}.
          </p>
        </div>
        <AddLink
          kind="investment"
          label="+ Opportunity"
          className="btn acc"
          extra={{ type: config.types[0] }}
        />
      </div>

      <div className="board">
        {stages.map((stage) => {
          const column = mine.filter((item) => item.stage === stage);
          return (
            <div className="col" key={stage}>
              <h4>
                {stage}
                <span>{column.length}</span>
              </h4>
              {column.map((item) => {
                const data = item.data as Record<string, unknown>;
                const late = item.dueDate && item.dueDate < today();
                return (
                  <OpenRow key={item.id} id={item.id} className="kcard">
                    <div className="t">{item.title}</div>
                    <div className="m">
                      {[data.type as string, screen.extras.names[item.who ?? ""] ?? item.who]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                    {item.amount ? <div className="amt">{moneyShort(Number(item.amount) * 100)}</div> : null}
                    {item.nextStep || item.dueDate ? (
                      <div className={`nx${late ? " late" : ""}`}>
                        {item.nextStep ?? "Target"}
                        {item.dueDate ? ` · ${formatDate(item.dueDate)}` : ""}
                      </div>
                    ) : null}
                  </OpenRow>
                );
              })}
              <AddLink
                kind="investment"
                label="+ Add"
                className="btn ghost"
                extra={{ type: config.types[0], stage }}
              />
            </div>
          );
        })}
      </div>

      {passed.length ? (
        <details className="more">
          <summary>Passed ({passed.length}) — kept for reference</summary>
          <ItemList rows={toRows(passed, screen.extras)} />
        </details>
      ) : null}
    </>
  );
}
