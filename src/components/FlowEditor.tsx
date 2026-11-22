"use client";

import { useTransition } from "react";
import { reorderDrive } from "@/lib/actions/drives";
import type { PeriodType } from "@/lib/domain/week";

/**
 * The move, take-out and put-back buttons for one step. Every press is a write,
 * so the whole household sees the same meeting next Friday.
 */
export function FlowButtons({
  periodType, stepId, first, last, add, label,
}: {
  periodType: PeriodType;
  stepId: string;
  first?: boolean;
  last?: boolean;
  /** Renders the single "put it back" button instead of the move controls. */
  add?: boolean;
  label?: string;
}) {
  const [pending, startTransition] = useTransition();

  const send = (action: "up" | "down" | "remove" | "add") => {
    const data = new FormData();
    data.set("periodType", periodType);
    data.set("stepId", stepId);
    data.set("action", action);
    startTransition(async () => { await reorderDrive(data); });
  };

  if (add) {
    return (
      <button type="button" className="btn" disabled={pending} onClick={() => send("add")}>
        + {label}
      </button>
    );
  }

  return (
    <>
      <button
        type="button" className="btn ghost" title="Move up" aria-label="Move up"
        disabled={pending || first} onClick={() => send("up")}
      >
        ↑
      </button>
      <button
        type="button" className="btn ghost" title="Move down" aria-label="Move down"
        disabled={pending || last} onClick={() => send("down")}
      >
        ↓
      </button>
      <button
        type="button" className="btn ghost" title="Take out" aria-label="Take out"
        disabled={pending} onClick={() => send("remove")}
      >
        ×
      </button>
    </>
  );
}
