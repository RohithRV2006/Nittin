import { PageHeader } from "@/components/ui/PageHeader";
import { InlineAlert } from "@/components/ui/InlineAlert";

export default function ProductionBomsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="BOM Recipe Directory & Builder"
        subtitle="Manage standard ingredient ratios, packaging specs, and multi-pack scaling"
      />
      <InlineAlert variant="info" title="Module Ready for Feature Buildout">
        BOM recipe builder and pack-size cloning will be wired here next.
      </InlineAlert>
    </div>
  );
}
