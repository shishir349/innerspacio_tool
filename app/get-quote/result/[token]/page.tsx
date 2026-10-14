import type { Metadata } from "next";
import { isSupabaseConfigured } from "@/lib/config";
import { getQuoteResult, resolveLead } from "@/lib/leads/service";
import { QuoteResultView } from "@/components/quote/result-view";

export const metadata: Metadata = {
  title: "Your design & estimate — InnerSpacio",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function QuoteResultPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const lead = isSupabaseConfigured() ? await resolveLead(token) : null;

  if (!lead) {
    // One generic message for every failure (unknown / malformed token).
    return (
      <main className="grid min-h-screen place-items-center bg-background px-4 text-center">
        <p className="max-w-sm text-sm text-muted-foreground">
          This link isn&apos;t available. Please start again or contact InnerSpacio for your estimate.
        </p>
      </main>
    );
  }

  const result = await getQuoteResult(lead);
  return <QuoteResultView result={result} token={token} />;
}
