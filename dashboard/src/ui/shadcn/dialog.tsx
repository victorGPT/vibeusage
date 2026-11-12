import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import type { ComponentPropsWithoutRef } from "react";

import { cn } from "#src/lib/utils.ts";

// The 2049 boards have no dialog; this is a Card-like panel (card ground, border, rounded-md)
// over a dimmed background. Base UI owns focus trap, Esc, outside click and focus restore.
const Dialog = DialogPrimitive.Root;
const DialogClose = DialogPrimitive.Close;

function DialogContent({ className, children, ...props }: ComponentPropsWithoutRef<typeof DialogPrimitive.Popup>) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs" />
      <DialogPrimitive.Popup
        className={cn(
          "fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-32px)] w-[calc(100%-32px)] max-w-lg -translate-1/2 flex-col gap-6 overflow-y-auto rounded-md border border-border bg-card p-6 text-foreground outline-none",
          className,
        )}
        {...props}
      >
        {children}
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  );
}

function DialogTitle({ className, ...props }: ComponentPropsWithoutRef<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      className={cn("m-0 font-display text-heading-xs/[1.2] font-light text-hero", className)}
      {...props}
    />
  );
}

export { Dialog, DialogClose, DialogContent, DialogTitle };
