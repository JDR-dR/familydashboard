import { loadScreen } from "@/lib/page-data";
import { KIND_DEFS } from "@/lib/domain/kinds";
import { moneyShort } from "@/lib/domain/money";
import { formatDate, today } from "@/lib/domain/week";
import { toRows } from "@/lib/view";
import { AddLink, ItemList } from "@/components/Row";
import { OpenRow } from "@/components/OpenRow";

export const dynamic = "force-dynamic";

export default async function ExperiencesPage() {
  const screen = await loadScreen();
  const all = screen.items.filter((item) => item.kind === "experience");
  const stages = KIND_DEFS.experience.states.filter((stage) => stage !== "Done");
  const done = all
    .filter((item) => item.stage === "Done")
    .sort((a, b) => (b.dueDate ?? "").localeCompare(a.dueDate ?? ""));

  return (
    <>
      <div className="ph">
        <div>
          <h1>Experiences</h1>
          <p>Holidays, weekends away and the things you are looking forward to.</p>
        </div>
        <AddLink kind="experience" label="+ Experience" className="btn acc" />
      </div>

      <div className="board">
        {stages.map((stage) => {
          const column = all.filter((item) => item.stage === stage);
          return (
            <div className="col" key={stage}>
              <h4>
                {stage}
                <span>{column.length}</span>
              </h4>
              {column.map((item) => {
                const late = item.dueDate && item.dueDate < today();
                return (
                  <OpenRow key={item.id} id={item.id} className="kcard">
                    <div className="t">{item.title}</div>
                    <div className="m">
                      {[item.category, screen.extras.names[item.who ?? ""] ?? item.who]
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
              <AddLink kind="experience" label="+ Add" className="btn ghost" extra={{ stage }} />
            </div>
          );
        })}
      </div>

      {done.length ? (
        <details className="more" open>
          <summary>Done ({done.length})</summary>
          <ItemList rows={toRows(done, screen.extras)} />
        </details>
      ) : null}
    </>
  );
}
