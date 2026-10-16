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
        <p className="eyebrow">Illustrative starting rates, in INR</p>
        <h1 className="display display-md mt-4 text-foreground">Cost Catalogue</h1>
        <p className="mt-1 max-w-2xl text-[0.95rem] text-muted-foreground">
          These are illustrative starting rates for development and demos only — not verified
          vendor quotations or current market prices. Review and edit every rate before relying on
          it in a client estimate.
        </p>
      </div>
      <CatalogueTable items={items} />
    </div>
  );
}
