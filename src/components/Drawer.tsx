"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CONFIDENCE, HORIZONS, INVESTMENT_TYPES, KIND_DEFS, LIFE_AREAS, PEOPLE,
  REPEATS, SECTIONS, SLOTS, STREAMS, type Kind,
} from "@/lib/domain/kinds";
import { addNote, archiveItem, saveItem } from "@/lib/actions/items";
import { loadDrawerItem, type DrawerItem } from "@/lib/actions/drawer";
import { formatDate, formatWhen } from "@/lib/domain/week";

/** Which fields each kind shows, in order. Pairs render side by side. */
const FIELDS: Record<Kind, Array<string | [string, string]>> = {
  task: ["title", ["who", "dueDate"], ["amount", "status"], ["slot", "section"], "nextStep", "notes"],
  income: ["title", ["category", "stream"], ["amount", "dueDate"], "confidence", ["actual", "receivedDate"], "notes"],
  bill: ["title", "category", ["amount", "dueDate"], ["who", "status"], "repeat", "notes"],
  onceoff: ["title", "category", ["amount", "dueDate"], ["who", "status"], "notes"],
  maintenance: ["title", "category", ["who", "dueDate"], ["amount", "status"], "nextStep", "notes"],
  project: ["title", ["amount", "dueDate"], ["who", "status"], "nextStep", "notes"],
  projectexp: ["title", "projectId", ["amount", "dueDate"], ["who", "status"], "notes"],
  medical: ["title", "provider", ["who", "dueDate"], ["amount", "status"], "reimbursed", "notes"],
  investment: ["title", ["type", "stage"], ["amount", "who"], "nextStep", "dueDate", "notes"],
  experience: ["title", "category", ["who", "dueDate"], ["amount", "stage"], "nextStep", "notes"],
  prayer: ["title", ["who", "startedDate"], "status", "answer", "answeredDate"],
  sowing: ["title", "purpose", ["who", "dueDate"], ["amount", "status"], "notes"],
  goal: ["title", ["turnover", "profit"], "focus", "strategy", "actions", "notes"],
  lifegoal: ["title", ["area", "horizon"], ["who", "dueDate"], ["amount", "status"], "measure", "nextStep", "notes"],
  decision: ["title", ["dueDate", "section"], "notes"],
};

const LABELS: Record<string, string> = {
  title: "What", who: "Who", dueDate: "When", amount: "How much", status: "Status",
  stage: "Stage", slot: "Discuss at", section: "Section", nextStep: "Next step",
  notes: "Notes", category: "Category", stream: "Type of income",
  confidence: "Confidence", actual: "Actual amount", receivedDate: "Date received",
  repeat: "Repeats", type: "Type", provider: "Provider / practice",
  reimbursed: "Reimbursed so far", startedDate: "Date started",
  answer: "Answer / experience / notes", answeredDate: "Date answered",
  purpose: "Purpose", area: "Area of life", horizon: "Horizon",
  measure: "How we measure it", turnover: "Turnover goal", profit: "Profit goal",
  strategy: "Main strategy", focus: "Current focus", actions: "Key actions",
  projectId: "Project",
};

const TITLE_LABELS: Partial<Record<Kind, string>> = {
  income: "Income source", investment: "Investment / opportunity", experience: "Experience",
  prayer: "Prayer / person / situation", sowing: "Person / organisation",
  goal: "Business / area", lifegoal: "Goal", decision: "Decision", project: "Project",
  bill: "Expense",
};

const TEXTAREAS = new Set(["notes", "answer", "strategy", "actions"]);
const MONEY = new Set(["amount", "actual", "reimbursed", "turnover", "profit"]);
const DATES = new Set(["dueDate", "receivedDate", "startedDate", "answeredDate"]);

export function Drawer() {
  const router = useRouter();
  const params = useSearchParams();
  const itemId = params.get("item");
  const newKind = params.get("new") as Kind | null;
  const [item, setItem] = useState<DrawerItem | null>(null);
  const [loading, setLoading] = useState(false);

  const open = Boolean(itemId || newKind);

  useEffect(() => {
    let active = true;
    if (!open) {
      setItem(null);
      return;
    }
    setLoading(true);
    const presets: Record<string, string> = {};
    for (const key of ["category", "projectId", "type", "slot", "section", "who"]) {
      const value = params.get(key);
      if (value) presets[key] = value;
    }
    loadDrawerItem(itemId, newKind, presets).then((loaded) => {
      if (!active) return;
      setItem(loaded);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [itemId, newKind, open, params]);

  function close() {
    const next = new URLSearchParams(params.toString());
    for (const key of ["item", "new", "category", "projectId", "type", "slot", "section", "who"]) {
      next.delete(key);
    }
    const query = next.toString();
    router.push(query ? `?${query}` : window.location.pathname, { scroll: false });
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && open) close();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!open) return null;

  return (
    <>
      <button className="scrim" aria-label="Close" onClick={close} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label="Item">
        {loading || !item ? (
          <div className="db">
            <p className="muted">Loading…</p>
          </div>
        ) : (
          <ItemForm item={item} onClose={close} />
        )}
      </aside>
    </>
  );
}

function ItemForm({ item, onClose }: { item: DrawerItem; onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [slot, setSlot] = useState<string>("This week");
  const def = KIND_DEFS[item.kind];
  const isNew = !item.id;
  const notes = item.events.filter((event) => event.type === "note");

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await saveItem(formData);
      if (!result.ok) {
        setError(result.error ?? "That could not be saved");
        return;
      }
      router.refresh();
      onClose();
    });
  }

  function postNote() {
    if (!note.trim() || !item.id) return;
    const data = new FormData();
    data.set("itemId", item.id);
    data.set("body", note);
    startTransition(async () => {
      const result = await addNote(data);
      if (!result.ok) setError(result.error ?? "That note could not be added");
      else {
        setNote("");
        router.refresh();
        onClose();
      }
    });
  }

  function remove() {
    if (!item.id) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    startTransition(async () => {
      await archiveItem(item.id as string);
      router.refresh();
      onClose();
    });
  }

  const lastEvent = item.events[0];

  return (
    <>
      <div className="dh">
        <h2>{isNew ? `New ${def.label.toLowerCase()}` : def.label}</h2>
        <button className="x" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>

      <div className="db">
        <form id="itemForm" action={submit}>
          <input type="hidden" name="kind" value={item.kind} />
          {item.id ? <input type="hidden" name="id" value={item.id} /> : null}

          {FIELDS[item.kind].map((entry, index) =>
            Array.isArray(entry) ? (
              <div className="frow" key={index}>
                {entry.map((field) => (
                  <Field key={field} name={field} item={item} />
                ))}
              </div>
            ) : (
              <Field key={entry} name={entry} item={item} />
            ),
          )}

          {item.kind === "task" ? (
            <div className="sect">
              <div className="sect-h">
                <span>Steps</span>
                <span>up to 3</span>
              </div>
              {[0, 1, 2].map((index) => (
                <label className="subrow" key={index}>
                  <input
                    type="checkbox"
                    name={`step${index}done`}
                    defaultChecked={item.steps[index]?.done ?? false}
                  />
                  <input
                    className="fld"
                    name={`step${index}`}
                    defaultValue={item.steps[index]?.text ?? ""}
                    placeholder={index === 0 ? "First step" : "Next step"}
                  />
                </label>
              ))}
            </div>
          ) : null}

          <div className="sect">
            <div className="sect-h">
              <span>Links</span>
              <span>quote, listing, article</span>
            </div>
            {item.links.length ? (
              <div style={{ marginBottom: 9 }}>
                {item.links.map((link) => (
                  <a
                    key={link.url}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="link"
                    style={{ marginRight: 12 }}
                  >
                    ↗ {link.label || link.url.replace(/^https?:\/\//, "").slice(0, 34)}
                  </a>
                ))}
              </div>
            ) : null}
            {[0, 1].map((index) => (
              <div className="linkrow" key={index}>
                <input
                  className="fld"
                  name={`link${index}url`}
                  inputMode="url"
                  placeholder="https://"
                  defaultValue={item.links[index]?.url ?? ""}
                />
                <input
                  className="fld"
                  name={`link${index}label`}
                  placeholder="Label"
                  defaultValue={item.links[index]?.label ?? ""}
                />
              </div>
            ))}
          </div>

          {!isNew ? (
            <div className="stamp">
              {[
                item.createdAt ? `Added ${formatDate(item.createdAt.slice(0, 10))}` : "",
                item.doneAt ? `completed ${formatDate(item.doneAt)}` : "",
                lastEvent ? `last touched by ${lastEvent.who ?? "someone"} ${formatWhen(lastEvent.at)}` : "",
              ]
                .filter(Boolean)
                .join(" · ")}
            </div>
          ) : null}
        </form>

        {!isNew ? (
          <div className="sect">
            <div className="sect-h">
              <span>Discussion</span>
            </div>
            {notes.length ? (
              <div>
                {notes.slice(0, 12).map((event) => (
                  <div className="post" key={event.id}>
                    <b>
                      {event.who ?? "Someone"} · {formatWhen(event.at)}
                    </b>
                    {event.body}
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted small" style={{ margin: "0 0 8px" }}>
                No notes yet. Anything added here is stamped with your name and the date.
              </p>
            )}
            <textarea
              className="fld"
              rows={2}
              value={note}
              onChange={(event) => setNote(event.currentTarget.value)}
              placeholder="Add a note for the next conversation"
            />
            <button
              type="button"
              className="btn"
              style={{ marginTop: 8 }}
              onClick={postNote}
              disabled={pending || !note.trim()}
            >
              Add note
            </button>
          </div>
        ) : null}

        {item.events.length ? (
          <details className="more sect">
            <summary>Activity ({item.events.length})</summary>
            <div>
              {item.events.map((event) => (
                <div className="post" key={event.id}>
                  <b>
                    {event.who ?? "Someone"} · {formatWhen(event.at)}
                    {event.summary ? ` · ${event.summary}` : ""}
                  </b>
                  {event.type === "note" ? event.body : ""}
                </div>
              ))}
            </div>
          </details>
        ) : null}

        {error ? <div className="err" style={{ marginTop: 14 }}>{error}</div> : null}
      </div>

      <div className="df">
        <button className="btn pri" type="submit" form="itemForm" disabled={pending}>
          {isNew ? "Add" : "Save"}
        </button>

        {!isNew && item.kind !== "task" && item.kind !== "decision" && item.kind !== "goal" ? (
          <>
            <select
              className="fld"
              value={slot}
              onChange={(event) => setSlot(event.currentTarget.value)}
              aria-label="When to discuss the new task"
              style={{ padding: "6px 8px", fontSize: 13.5 }}
            >
              {SLOTS.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
            <button
              type="button"
              className="btn"
              onClick={() => {
                const next = new URLSearchParams(window.location.search);
                next.delete("item");
                next.set("new", "task");
                next.set("slot", slot);
                if (item.section) next.set("section", item.section);
                if (item.who) next.set("who", item.who);
                router.push(`?${next.toString()}`, { scroll: false });
              }}
            >
              + Task
            </button>
          </>
        ) : null}

        <span className="sp" />
        {isNew ? (
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
        ) : (
          <button type="button" className="btn ghost danger" onClick={remove} disabled={pending}>
            {confirmDelete ? "Tap again to remove" : "Remove"}
          </button>
        )}
      </div>
    </>
  );
}

function Field({ name, item }: { name: string; item: DrawerItem }) {
  const def = KIND_DEFS[item.kind];
  const label = name === "title" ? TITLE_LABELS[item.kind] ?? "What" : LABELS[name] ?? name;
  const dataValue = item.data[name] ?? "";

  const value = ((): string => {
    switch (name) {
      case "title": return item.title;
      case "who": return item.who ?? "";
      case "dueDate": return item.dueDate ?? "";
      case "amount": return item.amount ?? "";
      case "status": return item.status ?? String(def.defaults.status ?? "");
      case "stage": return item.stage ?? String(def.defaults.stage ?? "");
      case "slot": return item.slot ?? "This week";
      case "section": return item.section ?? "general";
      case "nextStep": return item.nextStep ?? "";
      case "notes": return item.notes ?? "";
      case "category": return item.category ?? "";
      case "projectId": return item.projectId ?? "";
      default: return dataValue;
    }
  })();

  let input: React.ReactNode;

  if (name === "who") {
    input = (
      <select className="fld" name="who" defaultValue={value}>
        <option value="">—</option>
        {Object.entries(PEOPLE).map(([key, fallback]) => (
          <option key={key} value={key}>
            {item.personNames[key] ?? fallback}
          </option>
        ))}
      </select>
    );
  } else if (name === "status" || name === "stage") {
    input = (
      <select className="fld" name={name} defaultValue={value}>
        {def.states.map((state) => (
          <option key={state}>{state}</option>
        ))}
      </select>
    );
  } else if (name === "slot") {
    input = (
      <select className="fld" name="slot" defaultValue={value}>
        {SLOTS.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    );
  } else if (name === "section") {
    input = (
      <select className="fld" name="section" defaultValue={value}>
        {Object.entries(SECTIONS).map(([key, title]) => (
          <option key={key} value={key}>
            {title}
          </option>
        ))}
      </select>
    );
  } else if (name === "category") {
    input = (
      <select className="fld" name="category" defaultValue={value}>
        <option value="">—</option>
        {(def.categories ?? []).map((category) => (
          <option key={category}>{category}</option>
        ))}
      </select>
    );
  } else if (name === "projectId") {
    input = (
      <select className="fld" name="projectId" defaultValue={value}>
        <option value="">— none —</option>
        {item.projects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.title}
          </option>
        ))}
      </select>
    );
  } else if (name === "stream" || name === "confidence" || name === "repeat" || name === "type" || name === "area" || name === "horizon") {
    const options =
      name === "stream" ? STREAMS
      : name === "confidence" ? CONFIDENCE
      : name === "repeat" ? REPEATS
      : name === "type" ? INVESTMENT_TYPES
      : name === "area" ? LIFE_AREAS
      : HORIZONS;
    input = (
      <select className="fld" name={name} defaultValue={value || String(def.defaults[name] ?? options[0])}>
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    );
  } else if (TEXTAREAS.has(name)) {
    input = <textarea className="fld" name={name} rows={3} defaultValue={value} />;
  } else if (DATES.has(name)) {
    input = <input className="fld" type="date" name={name} defaultValue={value} />;
  } else if (MONEY.has(name)) {
    input = (
      <div className="money-input">
        <span>R</span>
        <input
          className="fld"
          name={name}
          inputMode="decimal"
          defaultValue={value ? Number(value).toLocaleString("en-US") : ""}
        />
      </div>
    );
  } else {
    input = (
      <input
        className={`fld${name === "title" ? " title" : ""}`}
        name={name}
        defaultValue={value}
        required={name === "title"}
      />
    );
  }

  return (
    <div className="f">
      <label>{label}</label>
      {input}
    </div>
  );
}
