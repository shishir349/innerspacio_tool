"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { submitClientDecisionAction } from "@/lib/actions/presentation-client";
import { formatInr } from "@/lib/format";
import type { ClientLinkEstimate } from "@/lib/presentation/client-dto";
import { CheckCircle2, Loader2 } from "lucide-react";

export function EstimateCard({
  token,
  roomId,
  estimate,
  onAccepted,
  readOnly = false,
}: {
  token: string;
  roomId: string;
  estimate: ClientLinkEstimate;
  onAccepted: () => void;
  readOnly?: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  function accept() {
    if (readOnly) return;
    startTransition(async () => {
      const result = await submitClientDecisionAction({
        token,
        decisionType: "estimate_accepted",
        roomId,
        estimateVersionId: estimate.id,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Estimate accepted.");
      onAccepted();
    });
  }

  return (
    <div className="rounded-2xl border border-border bg-secondary/40 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="display text-[1.6rem] text-foreground">{estimate.title}</p>
        <Badge variant="outline" className="text-xs">
          {estimate.displayStatus === "final" ? "Final estimate" : "Preliminary estimate"} · v
          {estimate.versionNumber}
        </Badge>
      </div>

      <ul className="mt-4 space-y-1.5 text-sm text-foreground/90">
        {estimate.lineItems.map((li, i) => (
          <li key={i} className="flex justify-between gap-3">
            <span>{li.name}</span>
            <span className="text-muted-foreground">
              × {li.quantity} {li.unit}
            </span>
          </li>
        ))}
      </ul>

      <Separator className="my-4" />

      <div className="space-y-1 text-sm">
        <div className="flex justify-between text-muted-foreground">
          <span>Subtotal</span>
          <span>{formatInr(estimate.subtotalBeforeGst)}</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>GST ({estimate.gstPercent}%)</span>
          <span>{formatInr(estimate.gstAmount)}</span>
        </div>
        <div className="flex justify-between pt-1 text-lg font-semibold text-foreground">
          <span>Total</span>
          <span>{formatInr(estimate.totalClientEstimate)}</span>
        </div>
      </div>

      {(estimate.inclusions || estimate.exclusions || estimate.assumptions) && (
        <div className="mt-4 space-y-2 text-xs text-muted-foreground">
          {estimate.inclusions && (
            <p>
              <span className="font-medium text-foreground">Inclusions: </span>
              {estimate.inclusions}
            </p>
          )}
          {estimate.exclusions && (
            <p>
              <span className="font-medium text-foreground">Exclusions: </span>
              {estimate.exclusions}
            </p>
          )}
          {estimate.assumptions && (
            <p>
              <span className="font-medium text-foreground">Assumptions: </span>
              {estimate.assumptions}
            </p>
          )}
        </div>
      )}

      <p className="mt-4 text-xs text-muted-foreground">
        Valid for {estimate.validityDays} days from publication (
        {new Date(estimate.publishedAt).toLocaleDateString("en-IN")}).{" "}
        {estimate.displayStatus === "final"
          ? "This is a final estimate for the described scope, still subject to a signed agreement before work begins."
          : "This is a preliminary estimate, not a binding contract — final scope, measurements and pricing will be confirmed after a site visit."}
      </p>

      <Button
        className="mt-4 w-full gap-2 print:hidden sm:w-auto"
        variant={estimate.isAccepted ? "secondary" : "default"}
        disabled={isPending || estimate.isAccepted || readOnly}
        onClick={accept}
      >
        {isPending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : estimate.isAccepted ? (
          <CheckCircle2 className="size-4" />
        ) : null}
        {estimate.isAccepted ? "Accepted" : "Accept this estimate"}
      </Button>
    </div>
  );
}
