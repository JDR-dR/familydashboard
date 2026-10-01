"use client";

import { useRouter, useSearchParams } from "next/navigation";

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
  const router = useRouter();
  const params = useSearchParams();

  return (
    <div
      className={className}
      role="button"
      tabIndex={0}
      onClick={() => {
        const next = new URLSearchParams(params.toString());
        next.set("item", id);
        router.push(`?${next.toString()}`, { scroll: false });
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          const next = new URLSearchParams(params.toString());
          next.set("item", id);
          router.push(`?${next.toString()}`, { scroll: false });
        }
      }}
    >
      {children}
    </div>
  );
}
