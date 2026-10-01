import Link from "next/link";
import { loadScreen, pick } from "@/lib/page-data";
import { isDone, PEOPLE, SECTIONS } from "@/lib/domain/kinds";
import { today, weekEnd, weekStart } from "@/lib/domain/week";
import { sortByDue } from "@/lib/domain/rules";
import { toRows } from "@/lib/view";
import { AddLink, ItemList } from "@/components/Row";

export const dynamic = "force-dynamic";

const FILTERS = [
  ["week", "This week"], ["next", "Next week"], ["huddle", "Monthly drive"],
  ["park", "To decide together"], ["overdue", "Overdue"], ["active", "Active"],
  ["done", "Completed"], ["all", "All"],
] as const;

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const filter = params.filter ?? "active";
  const who = params.who ?? "";
  const section = params.section ?? "";
  const screen = await loadScreen();
  const now = today();
  const start = weekStart(now);
  const end = weekEnd(now);

  let tasks = screen.likes.filter((item) => item.kind === "task");

  if (filter === "week") {
    tasks = tasks.filter(
      (task) => !isDone(task) && ((task.dueDate && task.dueDate >= start && task.dueDate <= end) || task.slot === "This week"),
    );
  } else if (filter === "next") {
    tasks = tasks.filter((task) => !isDone(task) && task.slot === "Next week");
  } else if (filter === "huddle") {
    tasks = tasks.filter((task) => !isDone(task) && task.slot === "Monthly drive");
  } else if (filter === "park") {
    tasks = tasks.filter((task) => !isDone(task) && task.slot === "To decide together");
  } else if (filter === "overdue") {
    tasks = tasks.filter((task) => !isDone(task) && task.dueDate !== null && task.dueDate < now);
  } else if (filter === "active") {
    tasks = tasks.filter((task) => !isDone(task));
  } else if (filter === "done") {
    tasks = tasks.filter((task) => isDone(task));
  }

  if (who) tasks = tasks.filter((task) => task.who === who);
  if (section) tasks = tasks.filter((task) => (task.section ?? "general") === section);

  const query = (next: Record<string, string>) => {
    const search = new URLSearchParams({ filter, who, section, ...next });
    for (const [key, value] of [...search.entries()]) if (!value) search.delete(key);
    return `/tasks?${search.toString()}`;
  };

  return (
    <>
      <div className="ph">
        <div>
          <h1>Tasks</h1>
          <p>Every action from every section, in one place.</p>
        </div>
        <AddLink kind="task" label="+ Task" className="btn acc" />
      </div>

      <div className="chips">
        {FILTERS.map(([key, label]) => (
          <Link key={key} href={query({ filter: key })} className={`chip${filter === key ? " on" : ""}`}>
            {label}
          </Link>
        ))}
        {Object.entries(PEOPLE).map(([key, fallback]) =>
          who === key ? (
            <Link key={key} href={query({ who: "" })} className="chip on">
              {screen.extras.names[key] ?? fallback} ×
            </Link>
          ) : null,
        )}
      </div>

      <div className="chips">
        <span className="small muted">Who:</span>
        {Object.entries(PEOPLE).map(([key, fallback]) => (
          <Link key={key} href={query({ who: who === key ? "" : key })} className={`chip${who === key ? " on" : ""}`}>
            {screen.extras.names[key] ?? fallback}
          </Link>
        ))}
      </div>

      <div className="chips">
        <span className="small muted">Section:</span>
        {Object.entries(SECTIONS).map(([key, label]) => (
          <Link
            key={key}
            href={query({ section: section === key ? "" : key })}
            className={`chip${section === key ? " on" : ""}`}
          >
            {label}
          </Link>
        ))}
      </div>

      <ItemList
        rows={toRows(pick(screen, sortByDue(tasks)), { ...screen.extras, showCarried: filter !== "done" })}
        empty="No tasks match these filters."
        addKind="task"
      />
    </>
  );
}
