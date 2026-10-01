"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { toggleDone } from "@/lib/actions/items";
import type { RowData } from "@/lib/view";
import { formatDate } from "@/lib/domain/week";

export function Row({ row }: { row: RowData }) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function open() {
    const next = new URLSearchParams(params.toString());
    next.set("item", row.id);
    router.push(`?${next.toString()}`, { scroll: false });
  }

  function check(done: boolean) {
    startTransition(async () => {
      await toggleDone(row.id, done);
      router.refresh();
    });
  }

  return (
    <div
      className={`row${row.done ? " isdone" : ""}`}
      role="button"
      tabIndex={0}
      aria-busy={pending}
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
            checked={row.done}
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
            {row.markers ? <span className="muted">{row.sub || row.carried ? " · " : ""}{row.markers}</span> : null}
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
  const router = useRouter();
  const params = useSearchParams();

  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        const next = new URLSearchParams(params.toString());
        next.set("new", kind);
        for (const [key, value] of Object.entries(extra ?? {})) next.set(key, value);
        router.push(`?${next.toString()}`, { scroll: false });
      }}
    >
      {label}
    </button>
  );
}
