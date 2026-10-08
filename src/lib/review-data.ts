/**
 * The figures a review period needs, computed the same way for a quarter and for a
 * year so the two screens can never drift apart. Everything here is a view over
 * the items already loaded by `loadScreen` — no extra queries.
 */

import type { ScreenData } from "@/lib/page-data";
import { isDone } from "@/lib/domain/kinds";
import { incomeSplit, type ItemLike } from "@/lib/domain/rules";
import { sumCents, type Cents } from "@/lib/domain/money";
import { inWindow } from "@/lib/domain/week";

const PAID_KINDS = ["bill", "onceoff", "maintenance", "sowing", "projectexp", "medical"];

export interface PeriodFigures {
  received: ItemLike[];
  active: Cents;
  passive: Cents;
  total: Cents;
  paid: ItemLike[];
  paidTotal: Cents;
  surplus: Cents;
  /** Everything finished inside the window, whatever kind it was. */
  achieved: ItemLike[];
  decisions: ItemLike[];
  experiences: ItemLike[];
  dealsMoved: ItemLike[];
  sown: Cents;
  prayersAnswered: ItemLike[];
}

export function periodFigures(
  screen: ScreenData,
  start: string,
  end: string,
): PeriodFigures {
  const { likes } = screen;

  const received = likes.filter(
    (item) =>
      item.kind === "income" &&
      isDone(item) &&
      inWindow(item.receivedDate ?? item.dueDate, start, end),
  );
  const split = incomeSplit(received);

  const paid = likes.filter(
    (item) => PAID_KINDS.includes(item.kind) && isDone(item) && inWindow(item.dueDate, start, end),
  );
  const paidTotal = sumCents(paid.map((item) => item.amount));

  const achieved = likes.filter(
    (item) => item.kind === "lifegoal" && isDone(item) && inWindow(item.dueDate, start, end),
  );
  const decisions = likes.filter(
    (item) => item.kind === "decision" && inWindow(item.dueDate, start, end),
  );
  const experiences = likes.filter(
    (item) => item.kind === "experience" && item.stage === "Done" && inWindow(item.dueDate, start, end),
  );
  const dealsMoved = likes.filter(
    (item) => item.kind === "investment" && inWindow(item.dueDate, start, end),
  );
  const sown = sumCents(
    likes
      .filter((item) => item.kind === "sowing" && item.status === "Given" && inWindow(item.dueDate, start, end))
      .map((item) => item.amount),
  );
  const prayersAnswered = likes.filter(
    (item) => item.kind === "prayer" && item.status === "Answered",
  );

  return {
    received,
    active: split.active,
    passive: split.passive,
    total: split.total,
    paid,
    paidTotal,
    surplus: split.total - paidTotal,
    achieved,
    decisions,
    experiences,
    dealsMoved,
    sown,
    prayersAnswered,
  };
}
