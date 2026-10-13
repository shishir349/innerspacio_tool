import { getRepository } from "@/lib/data";
import { requirePageUser } from "@/lib/auth";
import { CatalogueTable } from "@/components/catalogue/catalogue-table";

export const dynamic = "force-dynamic";

export default async function CostCataloguePage() {
  await requirePageUser();
  const repo = await getRepository();
  const items = await repo.listCatalogueItems();

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">Illustrative starting rates, in INR</p>
        <h1 className="editorial-heading text-3xl text-foreground">Cost Catalogue</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          These are illustrative starting rates for development and demos only — not verified
          vendor quotations or current market prices. Review and edit every rate before relying on
          it in a client estimate.
        </p>
      </div>
      <CatalogueTable items={items} />
    </div>
  );
}
