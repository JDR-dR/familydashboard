"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Fragment, useState } from "react";
import { useDrawer } from "@/components/DrawerContext";

export interface NavLink {
  href: string;
  label: string;
  badge?: number;
}

export interface NavGroup {
  title: string;
  links: NavLink[];
}

/**
 * The order is the order of the conversation. Where you are going comes first,
 * then the thinking that gets you there, then the week in front of you. Money sits
 * at the bottom in two halves, because income and expenses are two different
 * conversations and reading them as one total hides both.
 */
export const NAV: NavGroup[] = [
  {
    title: "Lifebook",
    links: [
      { href: "/goals", label: "Goals" },
      { href: "/experiences", label: "Experiences" },
    ],
  },
  {
    title: "Strategy",
    links: [
      { href: "/strategy", label: "Strategy" },
      { href: "/quarterly", label: "Quarterly review" },
      { href: "/annual", label: "Annual review" },
    ],
  },
  {
    title: "Execution",
    links: [
      { href: "/", label: "Weekly Drive" },
      { href: "/monthly", label: "Monthly Drive" },
      { href: "/tasks", label: "Tasks" },
      { href: "/activity", label: "Activity" },
      { href: "/decisions", label: "Decisions" },
      { href: "/history", label: "History" },
    ],
  },
  {
    title: "Kingdom",
    links: [
      { href: "/prayer", label: "Prayer" },
      { href: "/sowing", label: "Sowing" },
      { href: "/unbelief", label: "Unbelief" },
    ],
  },
  {
    title: "Investing — assets",
    links: [
      { href: "/deals/business", label: "Business" },
      { href: "/deals/property", label: "Property" },
      { href: "/deals/stocks", label: "Stocks" },
    ],
  },
  {
    title: "Income",
    links: [
      { href: "/freedom", label: "Freedom Score" },
      { href: "/income", label: "Income & cash flow" },
    ],
  },
  {
    title: "Expenses",
    links: [
      { href: "/expenses?view=needs", label: "Needs" },
      { href: "/expenses?view=wants", label: "Wants" },
      { href: "/expenses", label: "All expenses" },
      { href: "/medical", label: "Medical" },
      { href: "/projects", label: "Project expenses" },
    ],
  },
];

export function Nav({
  carried,
  unseen,
  userName,
}: {
  carried: number;
  unseen: number;
  userName: string;
}) {
  const pathname = usePathname();
  const search = useSearchParams();
  const badge = (href: string) =>
    href === "/" ? carried : href === "/activity" ? unseen : 0;

  // Some links differ only by a query string — Needs and Wants are the same page
  // seen two ways — so the current link is matched on path and view together.
  const view = search.get("view") ?? "";
  const current = (href: string) => {
    const [path, query] = href.split("?");
    if (path !== pathname) return false;
    return (new URLSearchParams(query ?? "").get("view") ?? "") === view;
  };

  return (
    <>
      <nav className="nav">
        <div className="brand">
          Family Dashboard
          <small>Our weekly operating system</small>
        </div>
        <AddButton />
        {NAV.map((group) => (
          <div key={group.title}>
            <div className="ngroup">{group.title}</div>
            {group.links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={current(link.href) ? "on" : ""}
              >
                {link.label}
                {badge(link.href) ? <span className="ct">{badge(link.href)}</span> : null}
              </Link>
            ))}
          </div>
        ))}
        <div className="navfoot">
          <div style={{ marginBottom: 8 }}>Signed in as {userName}</div>
          <Link href="/settings">Settings</Link>
          <form action="/api/signout" method="post">
            <button type="submit">Sign out</button>
          </form>
        </div>
      </nav>

      <div className="mbar">
        <div className="top">
          <div className="brand">Family Dashboard</div>
          <AddButton />
        </div>
        <div className="mtabs">
          {NAV.map((group) => (
            <Fragment key={group.title}>
              <span className="g">{group.title}</span>
              {group.links.map((link) => (
                <Link key={link.href} href={link.href} className={current(link.href) ? "on" : ""}>
                  {link.label}
                </Link>
              ))}
            </Fragment>
          ))}
        </div>
      </div>
    </>
  );
}

function AddButton() {
  const { createItem } = useDrawer();
  const [open, setOpen] = useState(false);

  const groups: Array<[string, Array<[string, string, string]>]> = [
    ["Lifebook", [["lifegoal", "Goal", "Something you want to achieve"], ["goal", "Strategy", "How we get there"], ["experience", "Experience", "Holiday, outing or idea"]]],
    ["Execution", [["task", "Task", "Who, what, when, how much"], ["decision", "Decision", "What we agreed"]]],
    ["Investing & deals", [["investment", "Investment", "Opportunity or deal"]]],
    ["Financial", [
      ["income", "Income", "Active or passive money in"],
      ["bill", "Bill", "Regular household bill"],
      ["onceoff", "Once-off expense", "Purchase or repair"],
      ["maintenance", "Maintenance", "Something in the house"],
      ["project", "Project", "A build or renovation"],
      ["projectexp", "Project expense", "A cost inside a project"],
      ["medical", "Medical expense", "Doctor, hospital or claim"],
    ]],
    ["Kingdom", [
      ["prayer", "Prayer", "Person or situation"],
      ["sowing", "Sowing", "Giving"],
      ["unbelief", "Unbelief", "Where it is hard to believe"],
    ]],
  ];

  return (
    <>
      <button className="addbtn" onClick={() => setOpen(true)}>
        + Add
      </button>
      {open ? (
        <>
          <button className="scrim" aria-label="Close" onClick={() => setOpen(false)} />
          <aside className="drawer" role="dialog" aria-modal="true" aria-label="What are you adding?">
            <div className="dh">
              <h2>What are you adding?</h2>
              <button className="x" onClick={() => setOpen(false)} aria-label="Close">
                ×
              </button>
            </div>
            <div className="db">
              {groups.map(([title, kinds]) => (
                <div key={title}>
                  <div className="kgroup">{title}</div>
                  <div className="kinds">
                    {kinds.map(([kind, label, hint]) => (
                      <button
                        key={kind}
                        onClick={() => {
                          setOpen(false);
                          createItem(kind);
                        }}
                      >
                        <b>{label}</b>
                        <span>{hint}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </>
      ) : null}
    </>
  );
}
