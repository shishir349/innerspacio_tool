import type { Metadata } from "next";
import { isSupabaseConfigured } from "@/lib/config";
import { QuoteWizard } from "@/components/quote/wizard";

export const metadata: Metadata = {
  title: "Design your home — InnerSpacio",
  description: "Tell us about your rooms, get an indicative interior estimate and see AI design concepts.",
};

export const dynamic = "force-dynamic";

export default function GetQuotePage() {
  if (!isSupabaseConfigured()) {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-4 text-center">
        <p className="max-w-sm text-[0.95rem] text-muted-foreground">
          This service is temporarily unavailable. Please contact InnerSpacio directly.
        </p>
      </main>
    );
  }
  return <QuoteWizard />;
}
