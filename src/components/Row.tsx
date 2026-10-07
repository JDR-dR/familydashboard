"use client";

import { useOptimistic, useTransition } from "react";
import { toggleDone } from "@/lib/actions/items";
import { useDrawer } from "@/components/DrawerContext";
import type { RowData } from "@/lib/view";
import { formatDate } from "@/lib/domain/week";

export function Row({ row }: { row: RowData }) {
  const { openItem } = useDrawer();
  const [, startTransition] = useTransition();

  // The tick moves immediately and stays moved while the server catches up.
  // React reverts it on its own if the write fails.
  const [done, setDone] = useOptimistic(row.done);

  function open() {
    openItem(row.id);
  }

  function check(nextDone: boolean) {
    startTransition(async () => {
      setDone(nextDone);
      await toggleDone(row.id, nextDone);
    });
  }

  return (
    <div
      className={`row${done ? " isdone" : ""}`}
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          open();
        }
      }}
    >
      <div className="r-check">
        {row.checkable ? (
          <input
            type="checkbox"
            checked={done}
            aria-label={`Mark ${row.title} done`}
            onClick={(event) => event.stopPropagation()}
            onChange={(event) => check(event.currentTarget.checked)}
          />
        ) : null}
      </div>
      <div className="r-main">
        <div className="r-title">{row.title}</div>
        {row.carried || row.sub || row.markers ? (
          <div className="r-sub">
            {row.carried ? <span className="carry">{row.carried}</span> : null}
            {row.carried && row.sub ? " · " : ""}
            {row.sub}
            {row.markers ? (
              <span className="muted">
                {row.sub || row.carried ? " · " : ""}
                {row.markers}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="r-meta">
        <div className="r-who">{row.who}</div>
        <div className={`r-date${row.late ? " late" : ""}`}>{formatDate(row.date)}</div>
      </div>
      <div className="r-amt">{row.amount}</div>
      <div className="r-status">
        {row.status ? <span className={`pill ${row.tone}`}>{row.status}</span> : null}
      </div>
    </div>
  );
}

export function ListHead() {
  return (
    <div className="lh">
      <span />
      <span>What</span>
      <span>Who</span>
      <span>When</span>
      <span>How much</span>
      <span style={{ textAlign: "right" }}>Status</span>
    </div>
  );
}

export function ItemList({
  rows,
  empty = "Nothing here yet.",
  addKind,
  head = true,
  children,
}: {
  rows: RowData[];
  empty?: string;
  addKind?: string;
  head?: boolean;
  children?: React.ReactNode;
}) {
  if (!rows.length) {
    return (
      <div className="list">
        <div className="empty">
          {empty} {addKind ? <AddLink kind={addKind} label="Add one" /> : null}
        </div>
        {children}
      </div>
    );
  }
  return (
    <div className="list">
      {head ? <ListHead /> : null}
      {rows.map((row) => (
        <Row key={row.id} row={row} />
      ))}
      {children}
    </div>
  );
}

export function AddLink({
  kind,
  label,
  className = "link",
  extra,
}: {
  kind: string;
  label: string;
  className?: string;
  extra?: Record<string, string>;
}) {
  const { createItem } = useDrawer();

  return (
    <button
      type="button"
      className={className}
      onClick={() => createItem(kind, extra ?? {})}
    >
      {label}
    </button>
  );
}
