/**
 * The score over time, drawn in CSS rather than a charting library: this is a dozen
 * bars and a dashed line at 100%, and a dependency for that would be absurd. A
 * month with no reading stays a gap, because a missing reading is not a zero.
 */

export interface ChartBar {
  label: string;
  /** Null means no reading was kept that period. */
  value: number | null;
  /** The second series, used only by the year-on-year view. */
  compare?: number | null;
}

export function ScoreChart({
  bars,
  legend,
}: {
  bars: ChartBar[];
  /** Two labels when a comparison series is present. */
  legend?: [string, string];
}) {
  const values = bars.flatMap((bar) =>
    [bar.value, bar.compare].filter((v): v is number => v !== null && v !== undefined),
  );
  if (!values.length) return null;

  // The axis always reaches 100, because 100 is the whole point of the chart.
  const top = Math.max(100, ...values);
  const height = (value: number) => `${Math.max(1.5, (value / top) * 100)}%`;
  const freeLine = `${(100 / top) * 100}%`;

  return (
    <div className="schart-wrap">
      {legend ? (
        <div className="slegend">
          <span>
            <i className="a" />
            {legend[0]}
          </span>
          <span>
            <i className="b" />
            {legend[1]}
          </span>
        </div>
      ) : null}
      <div className="schart">
        <div className="goal" style={{ bottom: freeLine }}>
          <span>100% — free</span>
        </div>
        {bars.map((bar, index) => (
          <div className="c" key={`${bar.label}-${index}`}>
            <div className="plot">
              {bar.compare === undefined ? (
                bar.value === null ? (
                  <div className="b none" title="No reading kept" />
                ) : (
                  <div
                    className={`b${bar.value >= 100 ? " free" : ""}`}
                    style={{ height: height(bar.value) }}
                    title={`${bar.label}: ${bar.value}%`}
                  >
                    <span className="v">{bar.value}</span>
                  </div>
                )
              ) : (
                <div className="pair">
                  {[bar.value, bar.compare].map((value, side) => (
                    <div className="half" key={side}>
                      {value === null ? (
                        <div className="b none" />
                      ) : (
                        <div
                          className={`b ${side === 0 ? "a" : "b2"}${value >= 100 ? " free" : ""}`}
                          style={{ height: height(value) }}
                          title={`${bar.label}: ${value}%`}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="lbl">{bar.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
