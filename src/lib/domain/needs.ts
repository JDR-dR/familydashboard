/**
 * Need or want. Every expense is one or the other: it is how a budget
 * conversation starts, and the only classification the app asks for.
 *
 * Pure: no imports from db, next or React.
 */
import type { ItemLike } from "./rules";
import { KIND_DEFS, type NeedWant } from "./kinds";

export type { NeedWant };

/** A need or a want, falling back to the kind's default for older records. */
export function needOf(item: ItemLike): NeedWant {
  if (item.need === "Want") return "Want";
  if (item.need === "Need") return "Need";
  return (KIND_DEFS[item.kind]?.defaults.need as NeedWant | undefined) ?? "Need";
}
