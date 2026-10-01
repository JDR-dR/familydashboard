"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { importPrototype, type ImportReport } from "@/lib/actions/import";

/**
 * Upload the export from the previous dashboard. It always checks first and shows
 * what it would do; nothing is written until you confirm.
 */
export function ImportPanel() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [json, setJson] = useState<string | null>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);

  function check(text: string) {
    setJson(text);
    startTransition(async () => setReport(await importPrototype(text, false)));
  }

  function commit() {
    if (!json) return;
    startTransition(async () => {
      const result = await importPrototype(json, true);
      setReport(result);
      if (result.committed) router.refresh();
    });
  }

  return (
    <div className="block">
      <div className="bh">
        <h2 className="st">Import from the old dashboard</h2>
        <span className="note">Checks first, writes only when you confirm</span>
      </div>

      <div className="list" style={{ padding: 18 }}>
        <label className="btn" style={{ display: "inline-block" }}>
          Choose export file
          <input
            type="file"
            accept="application/json,.json"
            hidden
            onChange={async (event) => {
              const file = event.currentTarget.files?.[0];
              if (!file) return;
              setFilename(file.name);
              setReport(null);
              check(await file.text());
            }}
          />
        </label>
        {filename ? <span className="small muted" style={{ marginLeft: 10 }}>{filename}</span> : null}

        {pending ? <p className="small muted">Reading…</p> : null}

        {report && !report.ok ? <div className="err" style={{ marginTop: 14 }}>{report.error}</div> : null}

        {report?.ok ? (
          <div style={{ marginTop: 16 }}>
            <div className="sect-h">
              <span>{report.committed ? "Imported" : "Reconciliation report"}</span>
              <span>{report.itemCount} items</span>
            </div>
            <div className="list">
              {Object.entries(report.counts ?? {})
                .sort()
                .map(([kind, count]) => (
                  <div className="row" key={kind}>
                    <div className="r-check" />
                    <div className="r-main">
                      <div className="r-title">{kind}</div>
                    </div>
                    <div className="r-meta">
                      <div className="r-who" />
                      <div className="r-date" />
                    </div>
                    <div className="r-amt">{count}</div>
                    <div className="r-status" />
                  </div>
                ))}
            </div>
            <p className="small muted" style={{ marginTop: 10 }}>
              {report.meetingCount} meeting record{report.meetingCount === 1 ? "" : "s"} · amounts
              total {report.totalAmount}
              {report.names ? ` · names: ${Object.values(report.names).join(", ")}` : ""}
            </p>
            {report.problems?.length ? (
              <div className="err">{report.problems.join(" ")}</div>
            ) : null}

            {report.committed ? (
              <div className="ok">
                Imported. The dashboard now holds {report.nowHolding} items. Running this again
                changes nothing.
              </div>
            ) : (
              <button className="btn pri" onClick={commit} disabled={pending}>
                Looks right — import it
              </button>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
