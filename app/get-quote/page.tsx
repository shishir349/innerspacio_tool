import type { Metadata } from "next";
import { isSupabaseConfigured } from "@/lib/config";
import { QuoteWizard } from "@/components/quote/wizard";
import { QuoteHero } from "@/components/quote/quote-hero";

export const metadata: Metadata = {
  title: "Design your home — InnerSpacio",
  description: "Upload your room photos, see AI design concepts and get an indicative interior estimate.",
};

export const dynamic = "force-dynamic";

export default function GetQuotePage() {
  if (!isSupabaseConfigured()) {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-4 text-center">
        <p className="max-w-sm text-sm text-muted-foreground">
          This service is temporarily unavailable. Please contact InnerSpacio directly.
        </p>
      </main>
    );
  }
  return (
    <>
      <QuoteHero />
      <div id="start" className="scroll-mt-20">
        <QuoteWizard />
      </div>
    </>
  );
}
