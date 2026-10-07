"use client";

import { useDrawer } from "@/components/DrawerContext";

/** A row that opens an item in the drawer, for screens with their own layout. */
export function OpenRow({
  id,
  className = "row",
  children,
}: {
  id: string;
  className?: string;
  children: React.ReactNode;
}) {
  const { openItem } = useDrawer();

  return (
    <div
      className={className}
      role="button"
      tabIndex={0}
      onClick={() => openItem(id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openItem(id);
        }
      }}
    >
      {children}
    </div>
  );
}
