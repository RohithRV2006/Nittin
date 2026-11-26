import type { Metadata } from "next";
import { BomsWorkspace } from "@/components/production/BomsWorkspace";
import { getBomsPageData } from "@/lib/queries/boms";

export const metadata: Metadata = {
  title: "BOM Recipes",
  description: "View product BOM recipes, ingredient ratios, and estimated FIFO costs.",
};

export const dynamic = "force-dynamic";

export default async function AdminBomsPage() {
  const data = await getBomsPageData();
  return <BomsWorkspace data={data} readOnly />;
}
