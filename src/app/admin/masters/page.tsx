import { PageHeader } from "@/components/ui/PageHeader";
import { InlineAlert } from "@/components/ui/InlineAlert";

export default function AdminMastersPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Master Catalog & Factory Settings"
        subtitle="Configure company GST profile, items, customers, suppliers, and staff accounts"
      />
      <InlineAlert variant="info" title="Module Ready for Feature Buildout">
        Dynamic master management (Items, Customers, Suppliers, Users, Company Settings) will be wired here next.
      </InlineAlert>
    </div>
  );
}
