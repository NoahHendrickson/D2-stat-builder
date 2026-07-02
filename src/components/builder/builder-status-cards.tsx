import { ArmoryStatus } from "@/components/armory/armory-status";
import { ManifestStatus } from "@/components/manifest/manifest-status";

export function BuilderStatusCards() {
  return (
    <div className="space-y-4 opacity-80">
      <ManifestStatus />
      <ArmoryStatus />
    </div>
  );
}
