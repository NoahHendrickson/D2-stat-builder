"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/", label: "Stat Builder" },
  { href: "/armor", label: "Table" },
] as const;

/** Header tab navigation — visually matches the shadcn Tabs list, but route-based. */
export function HeaderNav() {
  const pathname = usePathname();

  return (
    <nav className="border-border text-muted-foreground relative inline-flex w-fit items-center rounded-xl border pb-[3px]">
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex items-center justify-center rounded-lg border-2 border-transparent px-3 py-1 text-sm font-semibold whitespace-nowrap transition-colors outline-none select-none",
              "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
              active
                ? "border-brand bg-background text-foreground shadow-[0_3px_0_0_var(--brand-shadow)]"
                : "text-foreground/60 hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
