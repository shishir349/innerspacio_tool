"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  createPresentationLinkAction,
  getClientActivityAction,
  getPresentationLinkStatusAction,
  regeneratePresentationLinkAction,
  revokePresentationLinkAction,
  updateLinkVisibilityAction,
} from "@/lib/actions/presentation-links";
import { PublishEstimateDialog } from "@/components/projects/publish-estimate-dialog";
import { formatDate } from "@/lib/format";
import type { ClientDecision, ClientFeedback, PresentationLink, Project } from "@/lib/types";
import {
  Check,
  Copy,
  Eye,
  Loader2,
  MessageSquare,
  RefreshCw,
  ShieldAlert,
  XCircle,
} from "lucide-react";

export function PresentationLinkPanel({ project }: { project: Project }) {
  const [link, setLink] = useState<PresentationLink | null | undefined>(undefined);
  const [justIssuedUrl, setJustIssuedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [visibleRoomIds, setVisibleRoomIds] = useState<Set<string>>(new Set(project.rooms.map((r) => r.id)));
  const [activity, setActivity] = useState<{ decisions: ClientDecision[]; feedback: ClientFeedback[] }>({
    decisions: [],
    feedback: [],
  });
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    getPresentationLinkStatusAction(project.id).then((result) => {
      if (result.ok) {
        setLink(result.data);
        if (result.data?.visibleRoomIds) {
          setVisibleRoomIds(new Set(result.data.visibleRoomIds));
        }
      }
    });
    getClientActivityAction(project.id).then((result) => {
      if (result.ok) setActivity(result.data);
    });
  }, [project.id]);

  function buildUrl(rawToken: string) {
    if (typeof window === "undefined") return `/present/${rawToken}`;
    return `${window.location.origin}/present/${rawToken}`;
  }

  function create() {
    startTransition(async () => {
      const result = await createPresentationLinkAction(project.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setLink(result.data.link);
      setJustIssuedUrl(buildUrl(result.data.rawToken));
      toast.success("Presentation link created.");
    });
  }

  function regenerate() {
    startTransition(async () => {
      const result = await regeneratePresentationLinkAction(project.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setLink(result.data.link);
      setJustIssuedUrl(buildUrl(result.data.rawToken));
      toast.success("Presentation link regenerated — the old link no longer works.");
    });
  }

  function revoke() {
    if (!link) return;
    startTransition(async () => {
      const result = await revokePresentationLinkAction(link.id, project.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setLink(null);
      setJustIssuedUrl(null);
      toast.success("Presentation link revoked.");
    });
  }

  function copyLink(url: string) {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function toggleRoomVisible(roomId: string) {
    setVisibleRoomIds((prev) => {
      const next = new Set(prev);
      if (next.has(roomId)) next.delete(roomId);
      else next.add(roomId);
      return next;
    });
  }

  function saveVisibility() {
    if (!link) return;
    startTransition(async () => {
      const allVisible = visibleRoomIds.size === project.rooms.length;
      const result = await updateLinkVisibilityAction(link.id, project.id, {
        visibleRoomIds: allVisible ? null : Array.from(visibleRoomIds),
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setLink(result.data);
      toast.success("Visibility updated.");
    });
  }

  function toggleShowLocation(checked: boolean) {
    if (!link) return;
    startTransition(async () => {
      const result = await updateLinkVisibilityAction(link.id, project.id, { showLocation: checked });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setLink(result.data);
    });
  }

  if (link === undefined) {
    return (
      <Card className="border-border/80">
        <CardContent className="flex items-center gap-2 py-6 text-[0.95rem] text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading presentation link…
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/80">
      <CardHeader>
        <CardTitle className="display text-[1.4rem]">Client Presentation Link</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {!link ? (
          <div className="space-y-3">
            <p className="text-[0.95rem] text-muted-foreground">
              No active link. Create one to share this project&apos;s rooms, concepts and estimate
              with your client — they won&apos;t need an account.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={create} disabled={isPending} className="gap-2">
                {isPending && <Loader2 className="size-4 animate-spin" />}
                Create presentation link
              </Button>
              <Button
                variant="outline"
                render={<Link href={`/projects/${project.id}/preview`} target="_blank" />}
                className="gap-2"
              >
                <Eye className="size-3.5" /> Preview client view
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {justIssuedUrl && (
              <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
                <p className="flex items-center gap-1.5 text-[0.85rem] font-medium text-primary">
                  <ShieldAlert className="size-3.5" /> Copy this now — it won&apos;t be shown again
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 overflow-x-auto whitespace-nowrap rounded bg-background px-2 py-1.5 text-[0.85rem]">
                    {justIssuedUrl}
                  </code>
                  <Button size="sm" variant="outline" onClick={() => copyLink(justIssuedUrl)} className="gap-1.5">
                    {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                    {copied ? "Copied" : "Copy"}
                  </Button>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 text-[0.95rem]">
              <Badge className="bg-primary/15 text-primary border-primary/20">Active</Badge>
              <span className="text-muted-foreground">Expires {formatDate(link.expiresAt)}</span>
              {link.lastAccessedAt && (
                <span className="text-muted-foreground">· Last viewed {formatDate(link.lastAccessedAt)}</span>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                render={<Link href={`/projects/${project.id}/preview`} target="_blank" />}
                className="gap-2"
              >
                <Eye className="size-3.5" /> Preview client view
              </Button>
              <Button size="sm" variant="outline" onClick={regenerate} disabled={isPending} className="gap-2">
                <RefreshCw className="size-3.5" /> Regenerate
              </Button>
              <AlertDialog>
                <AlertDialogTrigger
                  render={<Button size="sm" variant="outline" className="gap-2 text-destructive" />}
                >
                  <XCircle className="size-3.5" /> Revoke
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Revoke this presentation link?</AlertDialogTitle>
                    <AlertDialogDescription>
                      The link stops working immediately. The project itself is not affected, and
                      past client feedback/decisions stay on record.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={revoke} className="bg-destructive text-white hover:bg-destructive/90">
                      Revoke
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <Label htmlFor="show-location" className="text-[0.95rem] font-normal">
                Show project location to client
              </Label>
              <Switch id="show-location" checked={link.showLocation} onCheckedChange={toggleShowLocation} />
            </div>

            <div>
              <p className="mb-2 text-[0.95rem] font-medium text-foreground">Rooms visible to client</p>
              <div className="space-y-2">
                {project.rooms.map((room) => (
                  <div key={room.id} className="flex items-center justify-between gap-2">
                    <label className="flex items-center gap-2 text-[0.95rem] text-foreground">
                      <Checkbox
                        checked={visibleRoomIds.has(room.id)}
                        onCheckedChange={() => toggleRoomVisible(room.id)}
                      />
                      {room.name}
                    </label>
                    <PublishEstimateDialog
                      projectId={project.id}
                      roomId={room.id}
                      roomName={room.name}
                      hasLiveEstimate={Boolean(room.estimate)}
                    />
                  </div>
                ))}
              </div>
              <Button size="sm" variant="outline" onClick={saveVisibility} disabled={isPending} className="mt-3 gap-2">
                {isPending && <Loader2 className="size-4 animate-spin" />}
                Save visibility
              </Button>
            </div>
          </div>
        )}

        {(activity.decisions.length > 0 || activity.feedback.length > 0) && (
          <>
            <Separator />
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-[0.95rem] font-medium text-foreground">
                <MessageSquare className="size-3.5" /> Client activity
              </p>
              <div className="max-h-64 space-y-2 overflow-y-auto">
                {activity.feedback.map((f) => (
                  <div key={f.id} className="rounded-lg border border-border/60 p-2.5 text-[0.95rem]">
                    <p className="text-[0.85rem] text-muted-foreground">
                      {f.feedbackType === "change_request" ? "Change request" : "Feedback"} ·{" "}
                      {formatDate(f.createdAt)}
                    </p>
                    <p className="mt-1 text-foreground/90">{f.message}</p>
                  </div>
                ))}
                {activity.decisions.map((d) => (
                  <div key={d.id} className="rounded-lg border border-border/60 p-2.5 text-[0.85rem] text-muted-foreground">
                    {decisionLabel(d.decisionType)} · {formatDate(d.createdAt)}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function decisionLabel(type: ClientDecision["decisionType"]): string {
  switch (type) {
    case "concept_selected":
      return "Client selected a concept";
    case "concept_approved":
      return "Client approved a concept for the next stage";
    case "estimate_accepted":
      return "Client accepted the estimate";
  }
}
