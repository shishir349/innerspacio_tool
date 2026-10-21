import { getRepository } from "@/lib/data";
import { requirePageUser } from "@/lib/auth";
import { CatalogueTable } from "@/components/catalogue/catalogue-table";
import { PageHeader } from "@/components/layout/page-header";

export const dynamic = "force-dynamic";

export default async function CostCataloguePage() {
  await requirePageUser();
  const repo = await getRepository();
  const items = await repo.listCatalogueItems();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cost Catalogue"
        description="Illustrative starting rates, in INR, for development and demos only — not verified vendor quotations or current market prices. Review and edit every rate before relying on it in a client estimate."
      />
      <CatalogueTable items={items} />
    </div>
  );
}
