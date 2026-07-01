import { BuilderPanel } from "@/components/builder/builder-panel";

export default function Home() {
  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-12">
      <header className="mb-8 space-y-2 text-center">
        <h1 className="text-4xl font-semibold tracking-tight">Stat Builder</h1>
        <p className="text-muted-foreground text-lg">
          Set your six Armor 3.0 stat targets — plus set bonuses, fragments, and
          mods — and find exactly which of your armor pieces to equip.
        </p>
      </header>
      <BuilderPanel />
    </main>
  );
}
