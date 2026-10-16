"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { NavLinks } from "@/components/layout/nav-links";
import { Logo } from "@/components/layout/logo";

/** Full-height menu for small screens. */
export function MobileNav({ footer }: { footer?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button
            type="button"
            aria-label="Open menu"
            className="inline-flex size-11 items-center justify-center rounded-full border border-foreground/20 lg:hidden"
          />
        }
      >
        <Menu className="size-5" />
      </DialogTrigger>
      <DialogContent
        showCloseButton={false}
        className="top-0 left-0 h-dvh max-w-none translate-x-0 translate-y-0 content-start gap-8 rounded-none p-6 sm:max-w-none"
      >
        <DialogTitle className="sr-only">Menu</DialogTitle>
        <DialogDescription className="sr-only">Navigate the studio.</DialogDescription>
        <div className="flex items-center justify-between">
          <Logo />
          <button type="button" aria-label="Close menu" onClick={() => setOpen(false)} className="inline-flex size-11 items-center justify-center rounded-full border border-foreground/20">
            <X className="size-5" />
          </button>
        </div>
        <NavLinks orientation="col" onNavigate={() => setOpen(false)} />
        {footer}
      </DialogContent>
    </Dialog>
  );
}
