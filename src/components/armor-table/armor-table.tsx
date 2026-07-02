"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { CaretDown, CaretUp, MagnifyingGlass, X } from "@phosphor-icons/react";
import { useArmory } from "@/lib/armory/use-armory";
import { useManifest } from "@/lib/manifest/use-manifest";
import { availableSets } from "@/lib/armory/sets";
import type { ArmorPiece, ArmorLocation } from "@/lib/armory/normalize";
import { BUNGIE_IMAGE_BASE } from "@/lib/bungie/constants";
import {
  ARMOR_SLOTS,
  CLASS_NAMES,
  SLOT_LABELS,
  STAT_DISPLAY_ORDER,
  STAT_LABELS,
  STAT_ORDER,
  tertiaryStatIndex,
  type StatKey,
} from "@/lib/armory/stats";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const LOCATION_LABELS: Record<ArmorLocation, string> = {
  equipped: "Equipped",
  inventory: "Inventory",
  vault: "Vault",
};

/** Sentinel filter values (real values are stringified hashes/indices/names). */
const ALL = "all";
const NOT_TUNABLE = "none";

interface Row {
  piece: ArmorPiece;
  setName?: string;
  /** Tertiary archetype stat index — Armor 3.0 pieces only. */
  tertiary?: number;
}

type ColumnKey =
  | "name"
  | "class"
  | "slot"
  | "archetype"
  | "tertiary"
  | "tuned"
  | "set"
  | "location";

/** Stat columns are namespaced ("stat-class") so they can't collide with the class column. */
type SortKey = ColumnKey | `stat-${StatKey}`;

interface SortState {
  key: SortKey;
  asc: boolean;
}

const statLabel = (index: number) => STAT_LABELS[STAT_ORDER[index]];

function sortValue(row: Row, key: SortKey): string | number | undefined {
  if (key.startsWith("stat-")) {
    const statKey = key.slice("stat-".length) as StatKey;
    return row.piece.stats[STAT_ORDER.indexOf(statKey)];
  }
  switch (key as ColumnKey) {
    case "name":
      return row.piece.name;
    case "class":
      return CLASS_NAMES[row.piece.classType];
    case "slot":
      return ARMOR_SLOTS.indexOf(row.piece.slot); // game order, not alphabetical
    case "archetype":
      return row.piece.archetype;
    case "tertiary":
      return row.tertiary !== undefined ? statLabel(row.tertiary) : undefined;
    case "tuned":
      return row.piece.tunedStat !== undefined
        ? statLabel(row.piece.tunedStat)
        : undefined;
    case "set":
      return row.setName;
    case "location":
      return LOCATION_LABELS[row.piece.location];
    default: {
      const exhaustive: never = key as never;
      return exhaustive;
    }
  }
}

function compareRows(a: Row, b: Row, sort: SortState): number {
  const va = sortValue(a, sort.key);
  const vb = sortValue(b, sort.key);
  // Missing values ("—") always sort last, regardless of direction.
  if (va === undefined && vb === undefined) return 0;
  if (va === undefined) return 1;
  if (vb === undefined) return -1;
  const cmp =
    typeof va === "number" && typeof vb === "number"
      ? va - vb
      : String(va).localeCompare(String(vb));
  return sort.asc ? cmp : -cmp;
}

interface FilterOption {
  value: string;
  label: string;
}

function FilterSelect({
  ariaLabel,
  value,
  onChange,
  options,
}: {
  ariaLabel: string;
  value: string;
  onChange: (value: string) => void;
  options: FilterOption[];
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v ?? ALL)} items={options}>
      <SelectTrigger aria-label={ariaLabel} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function SortHeader({
  label,
  sortKey,
  sort,
  onSort,
  align = "left",
  title,
}: {
  label: string;
  sortKey: SortKey;
  sort: SortState;
  onSort: (key: SortKey) => void;
  align?: "left" | "right";
  title?: string;
}) {
  const active = sort.key === sortKey;
  return (
    <th className="pb-1.5 font-normal whitespace-nowrap">
      <button
        type="button"
        title={title}
        onClick={() => onSort(sortKey)}
        className={cn(
          "hover:text-foreground inline-flex items-center gap-0.5 transition-colors",
          align === "right" && "w-full justify-end",
          active && "text-foreground",
        )}
      >
        {label}
        {active &&
          (sort.asc ? (
            <CaretUp weight="bold" className="size-3" aria-hidden />
          ) : (
            <CaretDown weight="bold" className="size-3" aria-hidden />
          ))}
      </button>
    </th>
  );
}

/** Stat columns default to descending (high rolls first); text columns to ascending. */
const DESC_FIRST = new Set<SortKey>(STAT_ORDER.map((key) => `stat-${key}` as const));

export function ArmorTable() {
  const { data } = useArmory();
  const manifestStatus = useManifest();
  const manifest =
    manifestStatus.state === "ready" ? manifestStatus.manifest : undefined;

  const [query, setQuery] = useState("");
  const [classFilter, setClassFilter] = useState(ALL);
  const [slotFilter, setSlotFilter] = useState(ALL);
  const [setFilter, setSetFilter] = useState(ALL);
  const [archetypeFilter, setArchetypeFilter] = useState(ALL);
  const [tuningFilter, setTuningFilter] = useState(ALL);
  const [tertiaryFilter, setTertiaryFilter] = useState(ALL);
  const [sort, setSort] = useState<SortState>({ key: "name", asc: true });

  const pieces = data?.pieces;

  const rows = useMemo<Row[]>(() => {
    if (!pieces || !manifest) return [];
    const setNames = new Map(
      availableSets(pieces, manifest).map((s) => [s.setHash, s.name]),
    );
    return pieces.map((piece) => ({
      piece,
      setName: piece.setHash ? setNames.get(piece.setHash) : undefined,
      // The archetype shape (30/25/20) only exists on Armor 3.0 rolls; a tuning
      // socket implies Armor 3.0 even if the archetype plug wasn't resolved.
      tertiary:
        piece.archetype !== undefined || piece.tunedStat !== undefined
          ? tertiaryStatIndex(piece.baseStats)
          : undefined,
    }));
  }, [pieces, manifest]);

  const setOptions = useMemo<FilterOption[]>(() => {
    const seen = new Map<number, string>();
    for (const r of rows) {
      if (r.piece.setHash && r.setName) seen.set(r.piece.setHash, r.setName);
    }
    return [...seen]
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([hash, name]) => ({ value: String(hash), label: name }));
  }, [rows]);

  const archetypeOptions = useMemo<FilterOption[]>(() => {
    const seen = new Set<string>();
    for (const r of rows) if (r.piece.archetype) seen.add(r.piece.archetype);
    return [...seen].sort().map((name) => ({ value: name, label: name }));
  }, [rows]);

  const statOptions: FilterOption[] = STAT_DISPLAY_ORDER.map((key) => ({
    value: String(STAT_ORDER.indexOf(key)),
    label: STAT_LABELS[key],
  }));

  const q = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    const matches = rows.filter(
      (r) =>
        (!q || r.piece.name.toLowerCase().includes(q)) &&
        (classFilter === ALL || r.piece.classType === Number(classFilter)) &&
        (slotFilter === ALL || r.piece.slot === slotFilter) &&
        (setFilter === ALL || String(r.piece.setHash) === setFilter) &&
        (archetypeFilter === ALL || r.piece.archetype === archetypeFilter) &&
        (tuningFilter === ALL ||
          (tuningFilter === NOT_TUNABLE
            ? r.piece.tunedStat === undefined
            : r.piece.tunedStat === Number(tuningFilter))) &&
        (tertiaryFilter === ALL || r.tertiary === Number(tertiaryFilter)),
    );
    return matches.sort((a, b) => compareRows(a, b, sort));
  }, [
    rows,
    q,
    classFilter,
    slotFilter,
    setFilter,
    archetypeFilter,
    tuningFilter,
    tertiaryFilter,
    sort,
  ]);

  const hasFilters =
    q !== "" ||
    classFilter !== ALL ||
    slotFilter !== ALL ||
    setFilter !== ALL ||
    archetypeFilter !== ALL ||
    tuningFilter !== ALL ||
    tertiaryFilter !== ALL;

  const clearFilters = () => {
    setQuery("");
    setClassFilter(ALL);
    setSlotFilter(ALL);
    setSetFilter(ALL);
    setArchetypeFilter(ALL);
    setTuningFilter(ALL);
    setTertiaryFilter(ALL);
  };

  const handleSort = (key: SortKey) =>
    setSort((prev) =>
      prev.key === key
        ? { key, asc: !prev.asc }
        : { key, asc: !DESC_FIRST.has(key) },
    );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <MagnifyingGlass
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2"
            aria-hidden
          />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search armor by name"
            aria-label="Search armor by name"
            className="pl-8"
          />
        </div>
        <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-3 xl:flex xl:w-auto xl:*:w-40">
          <FilterSelect
            ariaLabel="Filter by class"
            value={classFilter}
            onChange={setClassFilter}
            options={[
              { value: ALL, label: "All classes" },
              ...[0, 1, 2].map((c) => ({
                value: String(c),
                label: CLASS_NAMES[c],
              })),
            ]}
          />
          <FilterSelect
            ariaLabel="Filter by armor slot"
            value={slotFilter}
            onChange={setSlotFilter}
            options={[
              { value: ALL, label: "All slots" },
              ...ARMOR_SLOTS.map((s) => ({ value: s, label: SLOT_LABELS[s] })),
            ]}
          />
          <FilterSelect
            ariaLabel="Filter by set bonus"
            value={setFilter}
            onChange={setSetFilter}
            options={[{ value: ALL, label: "All sets" }, ...setOptions]}
          />
          <FilterSelect
            ariaLabel="Filter by archetype"
            value={archetypeFilter}
            onChange={setArchetypeFilter}
            options={[
              { value: ALL, label: "All archetypes" },
              ...archetypeOptions,
            ]}
          />
          <FilterSelect
            ariaLabel="Filter by tuned stat"
            value={tuningFilter}
            onChange={setTuningFilter}
            options={[
              { value: ALL, label: "Any tuning" },
              ...statOptions,
              { value: NOT_TUNABLE, label: "Not tunable" },
            ]}
          />
          <FilterSelect
            ariaLabel="Filter by tertiary stat"
            value={tertiaryFilter}
            onChange={setTertiaryFilter}
            options={[{ value: ALL, label: "Any tertiary" }, ...statOptions]}
          />
        </div>
      </div>

      <div className="text-muted-foreground flex items-center gap-2 text-xs">
        <span className="tabular-nums">
          {filtered.length} of {rows.length} pieces
        </span>
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-1.5 text-xs"
            onClick={clearFilters}
          >
            <X aria-hidden />
            Clear filters
          </Button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted-foreground text-left text-xs">
              <SortHeader label="Name" sortKey="name" sort={sort} onSort={handleSort} />
              <SortHeader label="Class" sortKey="class" sort={sort} onSort={handleSort} />
              <SortHeader label="Slot" sortKey="slot" sort={sort} onSort={handleSort} />
              <SortHeader label="Archetype" sortKey="archetype" sort={sort} onSort={handleSort} />
              <SortHeader label="Tertiary" sortKey="tertiary" sort={sort} onSort={handleSort} />
              <SortHeader label="Tuned" sortKey="tuned" sort={sort} onSort={handleSort} />
              <SortHeader label="Set bonus" sortKey="set" sort={sort} onSort={handleSort} />
              {STAT_DISPLAY_ORDER.map((key) => (
                <SortHeader
                  key={key}
                  label={STAT_LABELS[key].slice(0, 3)}
                  title={STAT_LABELS[key]}
                  sortKey={`stat-${key}`}
                  sort={sort}
                  onSort={handleSort}
                  align="right"
                />
              ))}
              <SortHeader label="Location" sortKey="location" sort={sort} onSort={handleSort} />
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <ArmorRow key={row.piece.instanceId} row={row} />
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="text-muted-foreground border-border/50 border-t py-6 text-center text-sm">
            {rows.length === 0
              ? "No armor pieces loaded yet."
              : "No armor matches your filters."}
          </p>
        )}
      </div>
    </div>
  );
}

function ArmorRow({ row }: { row: Row }) {
  const { piece } = row;
  return (
    <tr className="border-border/50 border-t">
      <td className="max-w-64 py-1.5 pr-3">
        <div className="flex items-center gap-2">
          {piece.icon ? (
            <Image
              src={`${BUNGIE_IMAGE_BASE}${piece.icon}`}
              alt=""
              width={24}
              height={24}
              className="shrink-0 rounded-sm"
            />
          ) : (
            <span className="bg-muted size-6 shrink-0 rounded-sm" aria-hidden />
          )}
          <span className="truncate font-medium">{piece.name}</span>
          {piece.isExotic && (
            <Badge variant="secondary" className="px-1 py-0 text-[10px]">
              Exotic
            </Badge>
          )}
          {piece.isArtifice && (
            <Badge variant="outline" className="px-1 py-0 text-[10px]">
              Artifice
            </Badge>
          )}
        </div>
      </td>
      <td className="py-1.5 pr-3 whitespace-nowrap">
        {CLASS_NAMES[piece.classType] ?? "—"}
      </td>
      <td className="py-1.5 pr-3 whitespace-nowrap">{SLOT_LABELS[piece.slot]}</td>
      <td className="py-1.5 pr-3 whitespace-nowrap">{piece.archetype ?? "—"}</td>
      <td className="py-1.5 pr-3 whitespace-nowrap">
        {row.tertiary !== undefined ? statLabel(row.tertiary) : "—"}
      </td>
      <td className="py-1.5 pr-3 whitespace-nowrap">
        {piece.tunedStat !== undefined ? statLabel(piece.tunedStat) : "—"}
      </td>
      <td className="max-w-40 truncate py-1.5 pr-3">{row.setName ?? "—"}</td>
      {STAT_DISPLAY_ORDER.map((key) => (
        <td key={key} className="py-1.5 pr-3 text-right tabular-nums">
          {piece.stats[STAT_ORDER.indexOf(key)]}
        </td>
      ))}
      <td className="text-muted-foreground py-1.5 whitespace-nowrap">
        {LOCATION_LABELS[piece.location]}
      </td>
    </tr>
  );
}
