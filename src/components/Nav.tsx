"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export interface NavLink {
  href: string;
  label: string;
  badge?: number;
}

export interface NavGroup {
  title: string;
  links: NavLink[];
}

export const NAV: NavGroup[] = [
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
    ],
  },
  {
    title: "Investing & deals",
    links: [
      { href: "/deals/property", label: "Property" },
      { href: "/deals/stocks", label: "Stocks" },
      { href: "/deals/business", label: "Business" },
    ],
  },
  {
    title: "Financial",
    links: [
      { href: "/income", label: "Income" },
      { href: "/expenses", label: "Expenses & home" },
      { href: "/projects", label: "Project expenses" },
      { href: "/medical", label: "Medical expenses" },
    ],
  },
  {
    title: "Lifebook",
    links: [
      { href: "/goals", label: "Goals" },
      { href: "/strategy", label: "Strategy" },
      { href: "/experiences", label: "Experiences" },
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
  const badge = (href: string) =>
    href === "/" ? carried : href === "/activity" ? unseen : 0;

  const flat = NAV.flatMap((group) => group.links);

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
                className={pathname === link.href ? "on" : ""}
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
          {flat.map((link) => (
            <Link key={link.href} href={link.href} className={pathname === link.href ? "on" : ""}>
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}

function AddButton() {
  const router = useRouter();
  const params = useSearchParams();
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
    ["Kingdom", [["prayer", "Prayer", "Person or situation"], ["sowing", "Sowing", "Giving"]]],
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
                          const next = new URLSearchParams(params.toString());
                          next.delete("item");
                          next.set("new", kind);
                          router.push(`?${next.toString()}`, { scroll: false });
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
