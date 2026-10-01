import { loadScreen } from "@/lib/page-data";
import { isDone } from "@/lib/domain/kinds";
import { toItemLike } from "@/lib/db/queries";
import { projectTotals } from "@/lib/domain/rules";
import { money, sumCents } from "@/lib/domain/money";
import { formatDate } from "@/lib/domain/week";
import { toRows } from "@/lib/view";
import { AddLink, ItemList } from "@/components/Row";
import { OpenRow } from "@/components/OpenRow";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const screen = await loadScreen();
  const projects = screen.items.filter((item) => item.kind === "project");
  const costs = screen.items.filter((item) => item.kind === "projectexp");
  const costLikes = costs.map(toItemLike);

  const open = projects.filter((item) => !isDone(toItemLike(item)));
  const finished = projects.filter((item) => isDone(toItemLike(item)));
  const unassigned = costs.filter(
    (cost) => !cost.projectId || !projects.some((project) => project.id === cost.projectId),
  );
  const outstanding = sumCents(
    costs.filter((cost) => !isDone(toItemLike(cost))).map((cost) => cost.amount),
  );

  function Card({ project }: { project: (typeof projects)[number] }) {
    const totals = projectTotals(toItemLike(project), costLikes);
    const rows = costs.filter((cost) => cost.projectId === project.id);
    return (
      <div className="block" key={project.id}>
        <div className="bh">
          <div>
            <h2 className="st">{project.title}</h2>
            <div className="note">
              {totals.budget
                ? `${money(totals.committed)} committed of ${money(totals.budget)} budget · ${money(totals.paid)} paid`
                : `${money(totals.committed)} committed · no budget set`}
              {project.dueDate ? ` · target ${formatDate(project.dueDate)}` : ""}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <OpenRow id={project.id} className="btn">
              Edit project
            </OpenRow>
            <AddLink
              kind="projectexp"
              label="+ Cost"
              className="btn acc"
              extra={{ projectId: project.id }}
            />
          </div>
        </div>
        {totals.budget ? (
          <div className="bar" style={{ marginBottom: 12 }}>
            <i
              style={{
                width: `${totals.percentUsed}%`,
                background: totals.overBudget ? "var(--accent)" : "var(--ink)",
              }}
            />
          </div>
        ) : null}
        <ItemList
          rows={toRows(rows, screen.extras)}
          empty="No costs captured for this project yet."
          addKind="projectexp"
        />
      </div>
    );
  }

  return (
    <>
      <div className="ph">
        <div>
          <h1>Project expenses</h1>
          <p>
            Capital projects and what each one is costing. {money(outstanding)} still to pay across all
            projects.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <AddLink kind="project" label="+ Project" className="btn" />
          <AddLink kind="projectexp" label="+ Cost" className="btn acc" />
        </div>
      </div>

      {open.length ? (
        open.map((project) => <Card key={project.id} project={project} />)
      ) : (
        <ItemList rows={[]} empty="No projects yet. Add one, then hang its costs underneath." addKind="project" />
      )}

      {unassigned.length ? (
        <div className="block">
          <div className="bh">
            <h2 className="st">Not linked to a project</h2>
          </div>
          <ItemList rows={toRows(unassigned, screen.extras)} />
        </div>
      ) : null}

      {finished.length ? (
        <details className="more">
          <summary>Finished projects ({finished.length})</summary>
          {finished.map((project) => (
            <Card key={project.id} project={project} />
          ))}
        </details>
      ) : null}
    </>
  );
}
