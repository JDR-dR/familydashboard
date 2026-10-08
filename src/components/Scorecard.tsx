import Link from "next/link";
import { freedomBand, type FreedomScore } from "@/lib/domain/freedom";
import { money } from "@/lib/domain/money";

/**
 * The scoreboard itself. Presentational and server-rendered, so it can sit on the
 * Income screen between active and passive income and again, larger, on its own
 * page without the two drifting apart.
 */
export function Scorecard({
  score,
  href,
  compact = false,
}: {
  score: FreedomScore;
  /** Where the heading links to. Omitted on the Freedom Score page itself. */
  href?: string;
  compact?: boolean;
}) {
  const band = freedomBand(score.score);
  const fill = Math.min(100, score.score);
  // Where the needs line falls on the same track: cross it and the essentials
  // are covered without you, whatever is left is the life you chose on top.
  const needsMark =
    score.expenses > 0 ? Math.min(100, Math.round((score.needs / score.expenses) * 100)) : 0;

  return (
    <div className={`score${score.free ? " free" : ""}`}>
      <div className="eyebrow">
        {href ? (
          <Link href={href} className="link">
            Financial Freedom Score
          </Link>
        ) : (
          "Financial Freedom Score"
        )}
      </div>

      <div className="shead">
        <div className="pc">{score.score}%</div>
        <div className="sband">
          <b>{band.label}</b>
          <span>{band.blurb}</span>
        </div>
      </div>

      <div className="track">
        <i style={{ width: `${fill}%` }} />
        {needsMark > 0 && needsMark < 100 ? (
          <span className="mark" style={{ left: `${needsMark}%` }} title="Needs covered" />
        ) : null}
      </div>
      {needsMark > 0 && needsMark < 100 ? (
        <div className="tracknote">
          <span style={{ left: `${needsMark}%` }}>needs covered here</span>
        </div>
      ) : null}

      <div className="figs">
        <div>
          <div className="v">{money(score.passive)}</div>
          <div className="l">Passive income a month</div>
        </div>
        <div>
          <div className="v">{money(score.expenses)}</div>
          <div className="l">
            What you spend a month
            <br />
            {money(score.needs)} needs · {money(score.wants)} wants
          </div>
        </div>
        <div>
          <div className={`v${score.free ? " pos" : ""}`}>
            {score.free ? "Covered" : money(score.gap)}
          </div>
          <div className="l">{score.free ? "Nothing left to cover" : "Still to cover each month"}</div>
        </div>
        <div>
          <div className={`v${score.needsCovered ? " pos" : ""}`}>{score.needsScore}%</div>
          <div className="l">
            Of your needs alone
            {score.needsCovered ? null : (
              <>
                <br />
                {money(score.needsGap)} to go
              </>
            )}
          </div>
        </div>
      </div>

      {compact ? null : (
        <div className="premise">
          Passive income divided by what you spend in a month. The only scoreboard where
          you control both sides: you decide what you spend, and you decide what kind of
          investor you become.
        </div>
      )}
    </div>
  );
}
