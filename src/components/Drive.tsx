import Link from "next/link";
import {
  DRIVE_STEPS, driveLabel, driveOff, driveOrder, howManyDiscussed,
  type DriveOrder,
} from "@/lib/domain/drives";
import type { PeriodType } from "@/lib/domain/week";
import { FlowButtons } from "@/components/FlowEditor";

/** The rail: the whole meeting at a glance, in the order it will actually run. */
export function DriveRail({
  period, order, discussed, title, children,
}: {
  period: PeriodType;
  order: DriveOrder | null;
  discussed: Record<string, boolean>;
  title: string;
  children?: React.ReactNode;
}) {
  const steps = driveOrder(period, order);
  const { done, total } = howManyDiscussed(period, discussed, order);
  return (
    <aside className="rail">
      <h4>{title}</h4>
      <div className="pct">
        {done} of {total} discussed
      </div>
      <div className="bar">
        <i style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
      </div>
      {steps.map((id, index) => (
        <a key={id} href={`#step-${id}`} className={discussed[id] ? "d" : ""}>
          <b>{discussed[id] ? "✓" : index + 1}</b>
          {driveLabel(period, id)}
        </a>
      ))}
      <div style={{ marginTop: 16 }}>
        <Link className="link" href="?flow=1">
          Edit this flow
        </Link>
      </div>
      {children}
    </aside>
  );
}

/**
 * Reordering the meeting. Taking a step out hides it from this conversation and
 * nothing else — the records it showed are untouched on their own screens.
 */
export function FlowEditor({
  period, order, open,
}: {
  period: PeriodType;
  order: DriveOrder | null;
  open: boolean;
}) {
  if (!open) return null;
  const steps = driveOrder(period, order);
  const off = driveOff(period, order);
  return (
    <div className="flow">
      <div className="bh">
        <div>
          <h2 className="st">The order of this meeting</h2>
          <div className="note">
            Move a step up or down, or take it out. Taking one out only hides it from
            the meeting — nothing it holds is deleted, and the order is shared.
          </div>
        </div>
        <Link className="link" href="?">
          Done
        </Link>
      </div>
      <div className="flowlist">
        {steps.map((id, index) => (
          <div className="flowrow" key={id}>
            <span className="n">{index + 1}</span>
            <span className="t">{driveLabel(period, id)}</span>
            <FlowButtons
              periodType={period}
              stepId={id}
              first={index === 0}
              last={index === steps.length - 1}
            />
          </div>
        ))}
      </div>
      {off.length ? (
        <div className="flowoff">
          <div className="small muted">Not in this flow</div>
          {off.map((id) => (
            <FlowButtons key={id} periodType={period} stepId={id} add label={driveLabel(period, id)} />
          ))}
        </div>
      ) : null}
      <div className="small muted" style={{ marginTop: 12 }}>
        {DRIVE_STEPS[period].length} steps ship with this drive.
      </div>
    </div>
  );
}
