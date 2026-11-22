"use client";

import { useState, useTransition } from "react";
import { setSectionBudget } from "@/lib/actions/budget";

/**
 * The one figure this screen takes from the real budget. It is typed in, not
 * worked out: the budgeting tool decides it, and this keeps it where the things
 * that come up can be read against it. Clearing the box sets it back to unset.
 */
export function BudgetFigure({
  section,
  amount,
  label,
}: {
  section: string;
  amount: string | null;
  label: string;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(amount ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function save() {
    const data = new FormData();
    data.set("section", section);
    data.set("amount", value);
    startTransition(async () => {
      const result = await setSectionBudget(data);
      if (result.ok) {
        setEditing(false);
        setError(null);
      } else {
        setError(result.error ?? "That could not be saved");
      }
    });
  }

  if (!editing) {
    return (
      <button type="button" className="budgetset" onClick={() => setEditing(true)}>
        {amount ? "Edit" : `Set ${label.toLowerCase()}`}
      </button>
    );
  }

  return (
    <form
      className="budgetform"
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      <label className="sr-only" htmlFor={`budget-${section}`}>
        {label}
      </label>
      <span className="pre">R</span>
      <input
        id={`budget-${section}`}
        className="fld"
        inputMode="decimal"
        autoFocus
        value={value}
        placeholder="0"
        onChange={(event) => setValue(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setValue(amount ?? "");
            setEditing(false);
            setError(null);
          }
        }}
      />
      <button type="submit" className="btn pri" disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </button>
      <button
        type="button"
        className="btn"
        onClick={() => {
          setValue(amount ?? "");
          setEditing(false);
          setError(null);
        }}
      >
        Cancel
      </button>
      {error ? <span className="err">{error}</span> : null}
    </form>
  );
}
