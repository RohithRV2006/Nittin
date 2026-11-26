import type { Metadata } from "next";
import { BomsWorkspace } from "@/components/production/BomsWorkspace";
import { getBomsPageData } from "@/lib/queries/boms";

export const metadata: Metadata = {
  title: "Bills of Materials",
  description: "Configure product recipes, expected yield, and tolerance.",
};

export const dynamic = "force-dynamic";

export default async function ProductionBomsPage() {
  const data = await getBomsPageData();
  return <BomsWorkspace data={data} />;
}
