import { ThemeToggle } from "@/components/theme-toggle";

export function AppHeader() {
  return (
    <header className="border-border/60 bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky top-0 z-50 border-b backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-2.5 2xl:max-w-[calc(80rem+22rem+2rem)]">
        <h1 className="text-sm font-medium tracking-tight">Stat Builder</h1>
        <ThemeToggle />
      </div>
    </header>
  );
}
