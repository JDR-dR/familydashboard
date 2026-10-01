"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { markActivitySeen, quickAddTask, updateMeeting } from "@/lib/actions/items";
import { PEOPLE, SLOTS } from "@/lib/domain/kinds";

export function StepHeader({
  n,
  title,
  hint,
  discussed,
  periodType,
  periodStart,
  children,
}: {
  n: number;
  title: string;
  hint?: string;
  discussed: boolean;
  periodType: "week" | "month";
  periodStart: string;
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  function toggle(next: boolean) {
    const data = new FormData();
    data.set("periodType", periodType);
    data.set("periodStart", periodStart);
    data.set("step", String(n));
    if (next) data.set("discussed", "true");
    startTransition(async () => {
      await updateMeeting(data);
      router.refresh();
    });
  }

  return (
    <div className="step-h">
      <span className="num">{discussed ? "✓" : n}</span>
      <div className="grow">
        <h2 className="st">{title}</h2>
        {hint ? <div className="hint">{hint}</div> : null}
      </div>
      <div className="acts">
        {children}
        <label className="tick">
          <input
            type="checkbox"
            checked={discussed}
            onChange={(event) => toggle(event.currentTarget.checked)}
          />
          Discussed
        </label>
      </div>
    </div>
  );
}

export function MeetingNotes({
  periodType,
  periodStart,
  notes,
  label,
}: {
  periodType: "week" | "month";
  periodStart: string;
  notes: string;
  label: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div style={{ marginTop: 16 }}>
      <label className="small muted" htmlFor="meeting-notes">
        {label}
      </label>
      <textarea
        id="meeting-notes"
        className="fld"
        defaultValue={notes}
        placeholder="Anything worth remembering from this conversation"
        onBlur={(event) => {
          const value = event.currentTarget.value;
          if (value === notes) return;
          const data = new FormData();
          data.set("periodType", periodType);
          data.set("periodStart", periodStart);
          data.set("notes", value);
          startTransition(async () => {
            await updateMeeting(data);
            router.refresh();
          });
        }}
      />
      {pending ? <div className="small muted">Saving…</div> : null}
    </div>
  );
}

export function QuickAdd({
  names,
  defaultDue,
}: {
  names: Record<string, string>;
  defaultDue: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="qa"
      action={(formData) => {
        startTransition(async () => {
          await quickAddTask(formData);
          router.refresh();
        });
      }}
      onSubmit={(event) => {
        const form = event.currentTarget;
        requestAnimationFrame(() => form.reset());
      }}
    >
      <input className="fld" type="text" name="title" placeholder="What needs to happen?" required />
      <select className="fld" name="who" aria-label="Who">
        <option value="">Who</option>
        {Object.entries(PEOPLE).map(([key, fallback]) => (
          <option key={key} value={key}>
            {names[key] ?? fallback}
          </option>
        ))}
      </select>
      <input className="fld" type="date" name="dueDate" defaultValue={defaultDue} aria-label="When" />
      <input
        className="fld"
        type="text"
        name="amount"
        inputMode="decimal"
        placeholder="R amount"
        style={{ width: 110 }}
        aria-label="How much"
      />
      <select className="fld" name="slot" aria-label="Discuss at">
        {SLOTS.map((slot) => (
          <option key={slot}>{slot}</option>
        ))}
      </select>
      <button className="btn pri" disabled={pending}>
        {pending ? "Adding…" : "Add task"}
      </button>
    </form>
  );
}

export function MarkSeenButton({ label = "Mark seen" }: { label?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      className="btn"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await markActivitySeen();
          router.refresh();
        })
      }
    >
      {label}
    </button>
  );
}
