import { redirect } from "next/navigation";
import { Suspense } from "react";
import { currentSession } from "@/lib/auth";
import { Nav } from "@/components/Nav";
import { Drawer } from "@/components/Drawer";
import { DrawerProvider } from "@/components/DrawerContext";
import { navCounts, unseenCount } from "@/lib/db/queries";
import { rollForwardSlots } from "@/lib/actions/items";
import { today, weekStart } from "@/lib/domain/week";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await currentSession();
  if (!session) redirect("/login");

  // Two cheap counts rather than loading every item on every navigation.
  const [counts, unseen] = await Promise.all([
    navCounts(session.householdId, weekStart(today())),
    unseenCount(session.householdId, session.user.id),
  ]);

  // Next week's tasks roll into this week the moment their week arrives.
  if (counts.rollover.length) await rollForwardSlots(counts.rollover);

  return (
    <DrawerProvider>
      <Suspense fallback={null}>
        <Nav carried={counts.carried} unseen={unseen} userName={session.user.name} />
      </Suspense>
      <main className="main">
        <div className="wrap">{children}</div>
      </main>
      <Drawer />
    </DrawerProvider>
  );
}
