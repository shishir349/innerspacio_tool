"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { submitClientFeedbackAction } from "@/lib/actions/presentation-client";
import { Loader2, MessageSquarePlus } from "lucide-react";

export function FeedbackDialog({
  token,
  roomId,
  roomName,
  conceptId,
  conceptTitle,
}: {
  token: string;
  roomId?: string;
  roomName?: string;
  conceptId?: string;
  conceptTitle?: string;
}) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function submit(type: "comment" | "change_request") {
    if (!message.trim()) {
      toast.error("Write a message first.");
      return;
    }
    startTransition(async () => {
      const result = await submitClientFeedbackAction({
        token,
        message,
        roomId,
        conceptId,
        feedbackType: type,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Thank you — your feedback was sent to your designer.");
      setMessage("");
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        onClick={() => setOpen(true)}
        className="gap-2 shadow-lg"
        size="lg"
      >
        <MessageSquarePlus className="size-4" />
        Leave feedback
      </Button>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="editorial-heading text-xl">Share your thoughts</DialogTitle>
          <DialogDescription>
            {conceptTitle
              ? `About "${conceptTitle}" in the ${roomName}.`
              : roomName
                ? `About the ${roomName}.`
                : "About this presentation."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 py-2">
          <Label htmlFor="feedback-message">Your message</Label>
          <Textarea
            id="feedback-message"
            rows={5}
            placeholder="Tell your designer what you love, or what you'd like changed…"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            disabled={isPending}
            onClick={() => submit("change_request")}
            className="gap-2"
          >
            {isPending && <Loader2 className="size-4 animate-spin" />}
            Request changes
          </Button>
          <Button disabled={isPending} onClick={() => submit("comment")} className="gap-2">
            {isPending && <Loader2 className="size-4 animate-spin" />}
            Send feedback
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
