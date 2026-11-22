"use client";

import { useOptimistic, useTransition } from "react";
import { toggleGoalStep } from "@/lib/actions/drives";

export interface GoalStep {
  id: string;
  text: string;
  done: boolean;
}

/**
 * The steps are the strategy, so they are tickable where you read them rather
 * than only inside the drawer. The tick moves at once and the write follows;
 * React puts it back if the write fails.
 */
export function GoalSteps({ itemId, steps }: { itemId: string; steps: GoalStep[] }) {
  const [, startTransition] = useTransition();
  const [shown, setShown] = useOptimistic(
    steps,
    (current: GoalStep[], change: { id: string; done: boolean }) =>
      current.map((step) => (step.id === change.id ? { ...step, done: change.done } : step)),
  );

  if (!steps.length) return null;

  return (
    <div className="steps">
      {shown.map((step) => (
        <label key={step.id} className={`steprow${step.done ? " done" : ""}`}>
          <input
            type="checkbox"
            checked={step.done}
            onChange={(event) => {
              const done = event.currentTarget.checked;
              const data = new FormData();
              data.set("itemId", itemId);
              data.set("stepId", step.id);
              data.set("done", done ? "true" : "");
              startTransition(async () => {
                setShown({ id: step.id, done });
                await toggleGoalStep(data);
              });
            }}
          />
          <span>{step.text}</span>
        </label>
      ))}
    </div>
  );
}
