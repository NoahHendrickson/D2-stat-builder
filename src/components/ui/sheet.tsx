"use client";

import * as React from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { X } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

function Sheet({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="sheet" {...props} />;
}

function SheetTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

function SheetClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="sheet-close" {...props} />;
}

function SheetPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="sheet-portal" {...props} />;
}

function SheetOverlay({
  className,
  ...props
}: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="sheet-overlay"
      className={cn(
        "fixed inset-0 isolate z-50 bg-black/20 duration-200 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className,
      )}
      {...props}
    />
  );
}

function SheetContent({
  className,
  children,
  side = "bottom",
  showCloseButton = true,
  ...props
}: DialogPrimitive.Popup.Props & {
  side?: "bottom" | "top" | "left" | "right";
  showCloseButton?: boolean;
}) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <DialogPrimitive.Popup
        data-slot="sheet-content"
        className={cn(
          "fixed z-50 flex flex-col bg-popover text-popover-foreground ring-1 ring-foreground/10 duration-200 outline-none data-open:animate-in data-closed:animate-out",
          side === "bottom" &&
            "inset-x-0 bottom-0 max-h-[85dvh] rounded-t-xl pb-[env(safe-area-inset-bottom)] data-open:slide-in-from-bottom data-closed:slide-out-to-bottom",
          side === "top" &&
            "inset-x-0 top-0 max-h-[85dvh] rounded-b-xl pt-[env(safe-area-inset-top)] data-open:slide-in-from-top data-closed:slide-out-to-top",
          side === "left" &&
            "inset-y-0 left-0 h-full w-[min(100%,20rem)] data-open:slide-in-from-left data-closed:slide-out-to-left",
          side === "right" &&
            "inset-y-0 right-0 h-full w-[min(100%,20rem)] data-open:slide-in-from-right data-closed:slide-out-to-right",
          className,
        )}
        {...props}
      >
        {side === "bottom" && (
          <div
            className="mx-auto mt-2 mb-1 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/30"
            aria-hidden
          />
        )}
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="sheet-close"
            render={
              <Button
                variant="ghost"
                className="absolute top-3 right-3"
                size="icon-sm"
              />
            }
          >
            <X weight="bold" className="size-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Popup>
    </SheetPortal>
  );
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col gap-1.5 px-4 pt-2 pb-3", className)}
      {...props}
    />
  );
}

function SheetTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="sheet-title"
      className={cn("text-base leading-none font-medium", className)}
      {...props}
    />
  );
}

function SheetDescription({
  className,
  ...props
}: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

function SheetBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-body"
      className={cn("min-h-0 flex-1 overflow-y-auto px-4 pb-4", className)}
      {...props}
    />
  );
}

export {
  Sheet,
  SheetBody,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetOverlay,
  SheetPortal,
  SheetTitle,
  SheetTrigger,
};
