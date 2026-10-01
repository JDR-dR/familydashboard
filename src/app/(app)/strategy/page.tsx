import { loadScreen } from "@/lib/page-data";
import { money, toCents } from "@/lib/domain/money";
import { AddLink, ItemList } from "@/components/Row";
import { OpenRow } from "@/components/OpenRow";

export const dynamic = "force-dynamic";

export default async function StrategyPage() {
  const screen = await loadScreen();
  const cards = screen.items.filter((item) => item.kind === "goal");

  return (
    <>
      <div className="ph">
        <div>
          <h1>Strategy</h1>
          <p>How you get there. Keep it high level — one card per business or area of life.</p>
        </div>
        <AddLink kind="goal" label="+ Strategy" className="btn acc" />
      </div>

      {cards.length === 0 ? (
        <ItemList
          rows={[]}
          empty="Add a strategy card for each business or area you are driving."
          addKind="goal"
        />
      ) : (
        <div className="grid2">
          {cards.map((card) => {
            const data = card.data as Record<string, string | undefined>;
            return (
              <OpenRow key={card.id} id={card.id} className="gcard">
                <div className="nm">{card.title}</div>
                {data.turnover || data.profit ? (
                  <div className="gnums">
                    <div>
                      <div className="v">{data.turnover ? money(toCents(data.turnover)) : "—"}</div>
                      <div className="l">Turnover goal</div>
                    </div>
                    <div>
                      <div className="v">{data.profit ? money(toCents(data.profit)) : "—"}</div>
                      <div className="l">Profit goal</div>
                    </div>
                  </div>
                ) : (
                  <div style={{ height: 10 }} />
                )}
                {data.strategy ? (
                  <div className="fld-label">
                    <b>Main strategy</b>
                    {data.strategy}
                  </div>
                ) : null}
                {data.focus ? (
                  <div className="fld-label" style={{ marginTop: 8 }}>
                    <b>Current focus</b>
                    {data.focus}
                  </div>
                ) : null}
                {data.actions ? (
                  <div className="fld-label" style={{ marginTop: 8 }}>
                    <b>Key actions</b>
                    {data.actions}
                  </div>
                ) : null}
              </OpenRow>
            );
          })}
        </div>
      )}
    </>
  );
}
