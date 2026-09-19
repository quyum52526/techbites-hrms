"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import type { Role } from "@prisma/client";
import { Check, ChevronDown, Loader2, LogOut, Users } from "lucide-react";
import { clsx } from "clsx";
import { signOut, switchAccount } from "@/app/actions/auth";
import { roleLabels } from "@/lib/auth-shared";

export type MenuAccount = { id: string; email: string; role: Role; name: string | null };

interface Props {
  user: MenuAccount;
  /** Development only: accounts for one-click switching. null hides the section. */
  switchableAccounts: MenuAccount[] | null;
}

const roleBadgeClass: Record<Role, string> = {
  SUPER_ADMIN: "bg-accent-50 text-accent-700",
  HR_ADMIN: "bg-brand-50 text-brand-700",
  MANAGER: "bg-amber-50 text-amber-800",
  TEAM_LEADER: "bg-emerald-50 text-emerald-700",
  EMPLOYEE: "bg-slate-100 text-slate-700",
};

function RoleBadge({ role }: { role: Role }) {
  return (
    <span className={clsx("inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide whitespace-nowrap", roleBadgeClass[role])}>
      {roleLabels[role]}
    </span>
  );
}

const initialsOf = (account: MenuAccount) =>
  (account.name ?? account.email)
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");

/** Menu rows are forms posting server actions; this shows a spinner on the row while its action runs. */
function PendingIcon({ icon }: { icon: React.ReactNode }) {
  const { pending } = useFormStatus();
  return pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden /> : icon;
}

const itemClass =
  "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-xs transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40";

export default function UserMenu({ user, switchableAccounts }: Props) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Close on a click outside or Esc; Esc returns focus to the trigger.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const otherAccounts = switchableAccounts?.filter((account) => account.id !== user.id) ?? [];

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`Account menu for ${user.name ?? user.email}, ${roleLabels[user.role]}`}
        className="flex items-center gap-2 pl-1 pr-1.5 sm:pr-2 py-1 rounded-full border border-slate-200 hover:bg-slate-50 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
      >
        <span aria-hidden className="grid place-items-center w-7 h-7 rounded-full bg-brand-600 text-white text-[11px] font-bold">
          {initialsOf(user)}
        </span>
        <span className="hidden md:block max-w-32 truncate text-xs font-semibold text-slate-800">{user.name ?? user.email}</span>
        <span className="hidden sm:inline-flex">
          <RoleBadge role={user.role} />
        </span>
        <ChevronDown className={clsx("w-3.5 h-3.5 text-slate-500 transition-transform duration-150", open && "rotate-180")} aria-hidden />
      </button>

      {open && (
        <div
          id={panelId}
          className="absolute right-0 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white shadow-lg p-1.5 z-40"
        >
          <div className="px-3 py-2.5 space-y-1">
            <p className="text-sm font-semibold text-slate-900 truncate">{user.name ?? "No employee profile"}</p>
            <p className="text-xs text-slate-600 truncate">{user.email}</p>
            <RoleBadge role={user.role} />
          </div>

          {switchableAccounts && (
            <div className="border-t border-slate-100 mt-1 pt-1.5">
              <p className="flex items-center gap-1.5 px-3 pb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                <Users className="w-3 h-3" aria-hidden /> Switch account
                <span className="ml-auto normal-case tracking-normal font-medium text-amber-700">Dev only</span>
              </p>
              <ul className="max-h-64 overflow-y-auto">
                <li>
                  <p className={clsx(itemClass, "bg-brand-50/60 text-slate-900")} aria-current="true">
                    <Check className="w-3.5 h-3.5 text-brand-700 shrink-0" aria-hidden />
                    <span className="min-w-0 flex-1 truncate font-medium">{user.name ?? user.email}</span>
                    <RoleBadge role={user.role} />
                  </p>
                </li>
                {otherAccounts.map((account) => (
                  <li key={account.id}>
                    <form action={switchAccount}>
                      <input type="hidden" name="userId" value={account.id} />
                      <button type="submit" className={clsx(itemClass, "hover:bg-slate-50 text-slate-700")} title={account.email}>
                        <PendingIcon icon={<span className="w-3.5 shrink-0" aria-hidden />} />
                        <span className="min-w-0 flex-1 truncate">
                          {account.name ?? account.email}
                          <span className="sr-only"> ({account.email})</span>
                        </span>
                        <RoleBadge role={account.role} />
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="border-t border-slate-100 mt-1 pt-1">
            <form action={signOut}>
              <button type="submit" className={clsx(itemClass, "text-rose-700 font-medium hover:bg-rose-50")}>
                <PendingIcon icon={<LogOut className="w-3.5 h-3.5" aria-hidden />} />
                Sign Out
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
