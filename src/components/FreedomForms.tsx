"use client";

import { useState, useTransition } from "react";
import { captureFreedomScore, saveFreedomBaseline } from "@/lib/actions/freedom";
import { centsToDecimal, money, type Cents } from "@/lib/domain/money";

/**
 * The number you decide on. Leaving a box empty hands it back to the bills, which
 * is the honest default — but a pinned figure is the point of the exercise, because
 * what you spend is the half of the score you control outright.
 */
export function BaselineForm({
  needs,
  wants,
  runRateNeeds,
  runRateWants,
}: {
  needs: Cents | null;
  wants: Cents | null;
  runRateNeeds: Cents;
  runRateWants: Cents;
}) {
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const asInput = (value: Cents | null) =>
    value === null ? "" : Math.round(value / 100).toLocaleString("en-US");

  return (
    <form
      className="qa"
      action={(formData) => {
        startTransition(async () => {
          await saveFreedomBaseline(formData);
          setSaved(true);
        });
      }}
    >
      <div className="f">
        <label htmlFor="monthlyNeeds">Needs a month</label>
        <div className="money-input">
          <span>R</span>
          <input
            className="fld"
            id="monthlyNeeds"
            name="monthlyNeeds"
            inputMode="decimal"
            defaultValue={asInput(needs)}
            placeholder={Math.round(runRateNeeds / 100).toLocaleString("en-US")}
          />
        </div>
      </div>
      <div className="f">
        <label htmlFor="monthlyWants">Wants a month</label>
        <div className="money-input">
          <span>R</span>
          <input
            className="fld"
            id="monthlyWants"
            name="monthlyWants"
            inputMode="decimal"
            defaultValue={asInput(wants)}
            placeholder={Math.round(runRateWants / 100).toLocaleString("en-US")}
          />
        </div>
      </div>
      <button className="btn pri" disabled={pending}>
        {pending ? "Saving…" : "Set the line"}
      </button>
      {saved && !pending ? <span className="small muted">Saved.</span> : null}
    </form>
  );
}

/**
 * Takes a reading and keeps it. One per month — capturing twice in the same month
 * corrects that month rather than inventing a second data point.
 */
export function CaptureScore({
  periodStart,
  passive,
  needs,
  wants,
  score,
  existing,
  monthLabel,
}: {
  periodStart: string;
  passive: Cents;
  needs: Cents;
  wants: Cents;
  score: number;
  existing: boolean;
  monthLabel: string;
}) {
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState("");

  return (
    <form
      className="capture"
      action={(formData) => {
        startTransition(async () => {
          await captureFreedomScore(formData);
          setNote("");
        });
      }}
    >
      <input type="hidden" name="periodStart" value={periodStart} />
      <input type="hidden" name="passive" value={centsToDecimal(passive)} />
      <input type="hidden" name="needs" value={centsToDecimal(needs)} />
      <input type="hidden" name="wants" value={centsToDecimal(wants)} />
      <input type="hidden" name="score" value={score} />
      <input
        className="fld"
        name="note"
        value={note}
        onChange={(event) => setNote(event.currentTarget.value)}
        placeholder={`What changed in ${monthLabel}?`}
        maxLength={2000}
      />
      <button className="btn pri" disabled={pending}>
        {pending
          ? "Saving…"
          : existing
            ? `Update ${monthLabel} — ${score}%`
            : `Keep ${monthLabel} at ${score}%`}
      </button>
      <span className="small muted">
        {money(passive)} passive against {money(needs + wants)} spend
      </span>
    </form>
  );
}
