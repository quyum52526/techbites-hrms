"use client";

import { createContext, use, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { trapTabKey, useBackdropClose } from "@/components/ui/Modal";

const DRAWER_ID = "mobile-nav-drawer";
/** Tailwind's `lg` breakpoint: at and above it the desktop sidebar is shown and the drawer is not needed. */
const DESKTOP_QUERY = "(min-width: 64rem)";

const MobileNavContext = createContext<{ open: boolean; setOpen: (open: boolean) => void } | null>(null);

function useMobileNav() {
  const context = use(MobileNavContext);
  if (!context) throw new Error("MobileNav components must be inside <MobileNavProvider>");
  return context;
}

/** Shares drawer state between the TopNav hamburger and the drawer in the sidebar, and closes it on navigation. */
export function MobileNavProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [lastPathname, setLastPathname] = useState(pathname);

  // Any route change (nav link, ⌘K palette, back button) closes the drawer; adjusting state during render avoids an extra effect pass.
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setOpen(false);
  }

  return <MobileNavContext value={{ open, setOpen }}>{children}</MobileNavContext>;
}

export function MobileNavTrigger() {
  const { open, setOpen } = useMobileNav();
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-label="Open navigation"
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-controls={DRAWER_ID}
      className="lg:hidden -ml-1.5 p-2 rounded-lg text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors duration-200"
    >
      <Menu className="w-5 h-5" aria-hidden />
    </button>
  );
}

/** Slide-out navigation below `lg`, on a native modal <dialog>: inert page behind, Esc to close, focus trapped. */
export function MobileNavDrawer({ children }: { children: ReactNode }) {
  const { open, setOpen } = useMobileNav();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const backdropClose = useBackdropClose();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      // Start on the current page's link so keyboard users see where they are.
      (dialog.querySelector<HTMLElement>('[aria-current="page"]') ?? dialog.querySelector<HTMLElement>("[data-autofocus]"))?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  // Rotating a tablet or widening the window past `lg` swaps to the desktop sidebar, so drop the drawer.
  useEffect(() => {
    const query = window.matchMedia(DESKTOP_QUERY);
    const onChange = () => {
      if (query.matches) setOpen(false);
    };
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [setOpen]);

  return (
    <dialog
      ref={dialogRef}
      id={DRAWER_ID}
      aria-label="Navigation"
      onClose={() => setOpen(false)}
      onKeyDown={trapTabKey}
      onPointerDown={backdropClose.onPointerDown}
      onClick={(event) => {
        // Tapping the link for the page you're already on doesn't change the route, so close on any link tap too.
        if (event.target instanceof Element && event.target.closest("a[href]")) event.currentTarget.close();
        else backdropClose.onClick(event);
      }}
      className="dialog-drawer lg:hidden fixed inset-y-0 left-0 right-auto m-0 h-dvh max-h-none w-72 max-w-[85vw] overflow-y-auto border-0 bg-sidebar p-0 shadow-2xl"
    >
      <button
        type="button"
        data-autofocus
        aria-label="Close navigation"
        onClick={() => dialogRef.current?.close()}
        className="absolute right-3 top-4 z-10 p-2 rounded-lg text-slate-300 hover:bg-white/10 hover:text-white transition-colors duration-200"
      >
        <X className="w-5 h-5" aria-hidden />
      </button>
      {children}
    </dialog>
  );
}
