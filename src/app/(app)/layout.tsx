import { redirect } from "next/navigation";
import { Suspense } from "react";
import { currentSession } from "@/lib/auth";
import { Nav } from "@/components/Nav";
import { Drawer } from "@/components/Drawer";
import { allItems, unseenCount } from "@/lib/db/queries";
import { toItemLike } from "@/lib/db/queries";
import { carriedOver, dueForRollover } from "@/lib/domain/rules";
import { rollForwardSlots } from "@/lib/actions/items";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await currentSession();
  if (!session) redirect("/login");

  const items = await allItems(session.householdId);
  const likes = items.map(toItemLike);

  // Next week's tasks roll into this week the moment their week arrives.
  const toRoll = dueForRollover(likes);
  if (toRoll.length) await rollForwardSlots(toRoll.map((item) => item.id));

  const [unseen] = await Promise.all([unseenCount(session.householdId, session.user.id)]);

  return (
    <>
      <Suspense fallback={null}>
        <Nav
          carried={carriedOver(likes).length}
          unseen={unseen}
          userName={session.user.name}
        />
      </Suspense>
      <main className="main">
        <div className="wrap">{children}</div>
      </main>
      <Suspense fallback={null}>
        <Drawer />
      </Suspense>
    </>
  );
}
