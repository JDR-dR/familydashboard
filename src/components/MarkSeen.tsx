"use client";

import { useTransition } from "react";
import { markActivitySeen } from "@/lib/actions/items";

/** Clears the "new since you last looked" badge for this person only. */
export function MarkSeen() {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      className="btn pri"
      disabled={pending}
      onClick={() => startTransition(async () => { await markActivitySeen(); })}
    >
      {pending ? "Marking…" : "Mark all as seen"}
    </button>
  );
}
