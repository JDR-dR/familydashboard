import Link from "next/link";
import {
  monthSeries, yearOnYear, yearSummaries, type ScoreSnapshot,
} from "@/lib/domain/freedom";
import { money } from "@/lib/domain/money";
import { monthShort } from "@/lib/domain/week";
import { ScoreChart, type ChartBar } from "@/components/ScoreChart";

export type DashboardView = "month" | "year" | "yoy";

const VIEWS: Array<[DashboardView, string]> = [
  ["month", "By month"],
  ["year", "By year"],
  ["yoy", "Year on year"],
];

function href(view: DashboardView, params: Record<string, string> = {}) {
  const query = new URLSearchParams({ view, ...params });
  return `/freedom?${query.toString()}`;
}

function YearPicker({
  years,
  selected,
  view,
  param = "year",
  other = {},
}: {
  years: string[];
  selected: string;
  view: DashboardView;
  param?: string;
  other?: Record<string, string>;
}) {
  return (
    <div className="chips">
      {years.map((year) => (
        <Link
          key={year}
          href={href(view, { ...other, [param]: year })}
          className={`chip${year === selected ? " on" : ""}`}
        >
          {year}
        </Link>
      ))}
    </div>
  );
}

const sign = (n: number) => `${n > 0 ? "+" : ""}${n}`;
const tone = (n: number) => (n > 0 ? " up" : n < 0 ? " down" : "");

/**
 * The score over time, three ways: the twelve months of a year, one line per year,
 * and the same months in two years side by side. Readings are never interpolated —
 * a month with no reading shows as a gap, because that is what it was.
 */
export function ScoreDashboard({
  history,
  view,
  year,
  compareA,
  compareB,
  years,
}: {
  history: ScoreSnapshot[];
  view: DashboardView;
  year: string;
  compareA: string;
  compareB: string;
  /** Every year offered in the pickers, oldest first. */
  years: string[];
}) {
  const chips = (
    <div className="chips">
      {VIEWS.map(([key, label]) => (
        <Link key={key} href={href(key)} className={`chip${view === key ? " on" : ""}`}>
          {label}
        </Link>
      ))}
    </div>
  );

  if (!history.length) {
    return (
      <div className="block">
        <div className="bh">
          <h2 className="st">The score over time</h2>
        </div>
        {chips}
        <div className="empty" style={{ marginTop: 14 }}>
          No readings kept yet. Take one at the Friday coffee and this fills in — a
          month at a time, then a year, then year on year.
        </div>
      </div>
    );
  }

  let body: React.ReactNode;

  if (view === "year") {
    const summaries = yearSummaries(history);
    const bars: ChartBar[] = summaries.map((s) => ({ label: s.year, value: s.closed }));
    body = (
      <>
        <ScoreChart bars={bars} />
        <table className="stable">
          <thead>
            <tr>
              <th>Year</th>
              <th>Opened</th>
              <th>Closed</th>
              <th>Movement</th>
              <th className="hide-s">Best</th>
              <th className="hide-s">Passive at close</th>
              <th className="hide-s">Passive added</th>
              <th className="hide-s">Readings</th>
            </tr>
          </thead>
          <tbody>
            {[...summaries].reverse().map((s) => (
              <tr key={s.year}>
                <td>{s.year}</td>
                <td>{s.opened}%</td>
                <td className="n">{s.closed}%</td>
                <td className={`n${tone(s.points)}`}>{sign(s.points)} pts</td>
                <td className="hide-s">{s.best}%</td>
                <td className="hide-s">{money(s.passive)}</td>
                <td className={`hide-s${tone(s.passiveGrowth)}`}>
                  {s.passiveGrowth > 0 ? "+" : ""}
                  {money(s.passiveGrowth)}
                </td>
                <td className="hide-s">{s.readings}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </>
    );
  } else if (view === "yoy") {
    if (years.length < 2) {
      body = (
        <div className="empty">
          Year on year needs readings in two different years. Keep going — this fills
          in from {years[0] ?? "your first year"} onward.
        </div>
      );
    } else {
      const rows = yearOnYear(history, compareA, compareB);
      const bars: ChartBar[] = rows.map((row) => ({
        label: monthShort(row.month),
        value: row.a?.score ?? null,
        compare: row.b?.score ?? null,
      }));
      const both = rows.filter((row) => row.diff !== null);
      const avg = both.length
        ? Math.round(both.reduce((total, row) => total + (row.diff ?? 0), 0) / both.length)
        : null;
      body = (
        <>
          <div className="yoypick">
            <div>
              <div className="small muted">Compare</div>
              <YearPicker
                years={years}
                selected={compareA}
                view="yoy"
                param="a"
                other={{ b: compareB }}
              />
            </div>
            <div>
              <div className="small muted">With</div>
              <YearPicker
                years={years}
                selected={compareB}
                view="yoy"
                param="b"
                other={{ a: compareA }}
              />
            </div>
          </div>
          <ScoreChart bars={bars} legend={[compareA, compareB]} />
          {avg !== null ? (
            <div className="small muted" style={{ margin: "4px 0 14px" }}>
              Across the {both.length} month{both.length === 1 ? "" : "s"} both years
              have a reading, {compareB} is {avg === 0 ? "level with" : `${sign(avg)} points against`}{" "}
              {compareA}.
            </div>
          ) : (
            <div className="small muted" style={{ margin: "4px 0 14px" }}>
              No month yet has a reading in both years.
            </div>
          )}
          <table className="stable">
            <thead>
              <tr>
                <th>Month</th>
                <th>{compareA}</th>
                <th>{compareB}</th>
                <th>Difference</th>
                <th className="hide-s">Passive {compareB}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.month} className={row.a || row.b ? undefined : "gap"}>
                  <td>{monthShort(row.month)}</td>
                  <td>{row.a ? `${row.a.score}%` : "—"}</td>
                  <td className={row.b ? "n" : undefined}>{row.b ? `${row.b.score}%` : "—"}</td>
                  <td className={`n${row.diff === null ? "" : tone(row.diff)}`}>
                    {row.diff === null ? "—" : `${sign(row.diff)} pts`}
                  </td>
                  <td className="hide-s">{row.b ? money(row.b.passive) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      );
    }
  } else {
    const cells = monthSeries(history, year);
    const bars: ChartBar[] = cells.map((cell) => ({
      label: monthShort(cell.month),
      value: cell.snapshot?.score ?? null,
    }));
    const kept = cells.filter((cell) => cell.snapshot);
    body = (
      <>
        <YearPicker years={years} selected={year} view="month" />
        <ScoreChart bars={bars} />
        <table className="stable">
          <thead>
            <tr>
              <th>Month</th>
              <th>Score</th>
              <th>Movement</th>
              <th className="hide-s">Passive</th>
              <th className="hide-s">Spend</th>
              <th className="q hide-s">What changed</th>
            </tr>
          </thead>
          <tbody>
            {kept.length === 0 ? (
              <tr>
                <td colSpan={6} className="q">
                  No readings kept in {year}.
                </td>
              </tr>
            ) : (
              [...kept].reverse().map((cell, index, list) => {
                const snapshot = cell.snapshot!;
                // The list is newest first, so the earlier reading is the next one.
                const earlier = list[index + 1]?.snapshot ?? null;
                const points = earlier ? snapshot.score - earlier.score : null;
                return (
                  <tr key={cell.month}>
                    <td>{monthShort(cell.month)}</td>
                    <td className="n">{snapshot.score}%</td>
                    <td className={`n${points === null ? "" : tone(points)}`}>
                      {points === null ? "—" : `${sign(points)} pts`}
                    </td>
                    <td className="hide-s">{money(snapshot.passive)}</td>
                    <td className="hide-s">{money(snapshot.needs + snapshot.wants)}</td>
                    <td className="q hide-s">{snapshot.note ?? ""}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </>
    );
  }

  return (
    <div className="block">
      <div className="bh">
        <div>
          <h2 className="st">The score over time</h2>
          <div className="note">
            Only the readings you kept. A month without one stays a gap rather than a zero.
          </div>
        </div>
      </div>
      {chips}
      <div style={{ marginTop: 14 }}>{body}</div>
    </div>
  );
}
