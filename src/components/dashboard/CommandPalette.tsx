"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Search, CornerDownLeft, UserRound, CalendarClock, Upload, UsersRound, UserX, AlarmClock, type LucideIcon } from "lucide-react";
import { clsx } from "clsx";
import { navItems } from "@/components/dashboard/Sidebar";
import { searchEmployees, type EmployeeSearchHit } from "@/app/actions/search";
import type { SessionRole } from "@/lib/auth-shared";

type Group = "Actions" | "Pages" | "Employees";
type Command = { id: string; group: Group; label: string; hint?: string; href: string; icon: LucideIcon };

const GROUP_ORDER: Group[] = ["Employees", "Actions", "Pages"];

/** Case-insensitive subsequence match, so "lvreq" finds "Leave Requests". Lower score = better. */
function fuzzyScore(text: string, query: string): number | null {
  const haystack = text.toLowerCase();
  const needle = query.toLowerCase().replace(/\s+/g, "");
  if (!needle) return 0;
  const direct = haystack.indexOf(needle);
  if (direct !== -1) return direct;
  let from = 0;
  let gaps = 0;
  for (const char of needle) {
    const at = haystack.indexOf(char, from);
    if (at === -1) return null;
    gaps += at - from;
    from = at + 1;
  }
  return 100 + gaps;
}

const subscribeNoop = () => () => {};
const detectMac = () => /Mac|iPhone|iPad/.test(navigator.platform);

export default function CommandPalette({ role }: { role: SessionRole }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();
  const optionId = (index: number) => `${listboxId}-opt-${index}`;

  const isMac = useSyncExternalStore(subscribeNoop, detectMac, () => false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [hits, setHits] = useState<{ query: string; results: EmployeeSearchHit[] }>({ query: "", results: [] });

  const isGuest = role === "GUEST";
  // Guests search and browse like HR but get no shortcuts that lead to a change (import, apply for leave).
  const isHr = role === "SUPER_ADMIN" || role === "HR_ADMIN" || isGuest;
  // Only roles that see other people's attendance (HR, team leads) get the team-wide shortcuts.
  const canViewAttendance = isHr || role === "TEAM_LEADER" || role === "MANAGER";
  const canApplyLeave = !isGuest && navItems.some((item) => item.href === "/dashboard/leaves" && item.roles.includes(role));
  const trimmed = query.trim();

  const open = () => {
    setQuery("");
    setActive(0);
    dialogRef.current?.showModal();
    inputRef.current?.focus();
  };
  const close = () => dialogRef.current?.close();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        const dialog = dialogRef.current;
        if (!dialog) return;
        if (dialog.open) {
          dialog.close();
        } else {
          setQuery("");
          setActive(0);
          dialog.showModal();
          inputRef.current?.focus();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Debounced, company-scoped employee lookup; results are keyed by query so a slow reply never overwrites a newer one.
  useEffect(() => {
    if (!isHr || trimmed.length < 2) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const results = await searchEmployees(trimmed);
      if (!cancelled) setHits({ query: trimmed, results });
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [trimmed, isHr]);

  const staticCommands: Command[] = [
    ...(isHr
      ? [
          { id: "act-pending", group: "Actions" as const, label: "Review pending leave requests", href: "/dashboard/leaves?status=PENDING", icon: CalendarClock },
          ...(isGuest ? [] : [{ id: "act-punch-import", group: "Actions" as const, label: "Import biometric punch log", href: "/dashboard/attendance", icon: Upload }]),
        ]
      : []),
    ...(canViewAttendance
      ? [
          { id: "act-not-punched", group: "Actions" as const, label: "Who hasn't punched in today", href: "/dashboard/attendance?date=today&filter=not-punched-in", icon: UserX },
          { id: "act-late", group: "Actions" as const, label: "Late arrivals today", href: "/dashboard/attendance?date=today&status=LATE", icon: AlarmClock },
        ]
      : []),
    ...(canApplyLeave
      ? [{ id: "act-apply-leave", group: "Actions" as const, label: "Apply for leave", href: "/dashboard/leaves", icon: CalendarClock }]
      : []),
    ...navItems
      .filter((item) => item.roles.includes(role))
      .map((item) => ({ id: `page-${item.href}`, group: "Pages" as const, label: item.label, hint: "Go to page", href: item.href, icon: item.icon })),
  ];

  const matchedStatic = staticCommands
    .map((command) => ({ command, score: fuzzyScore(command.label, trimmed) }))
    .filter((entry): entry is { command: Command; score: number } => entry.score !== null)
    .sort((a, b) => a.score - b.score)
    .map((entry) => entry.command);

  const employeeCommands: Command[] =
    isHr && trimmed.length >= 2
      ? [
          ...(hits.query === trimmed ? hits.results : []).map((hit) => ({
            id: `emp-${hit.id}`,
            group: "Employees" as const,
            label: hit.name,
            hint: [hit.employeeCode, hit.department].filter(Boolean).join(" · "),
            href: `/dashboard/employees?q=${encodeURIComponent(hit.employeeCode)}`,
            icon: UserRound,
          })),
          {
            id: "emp-search-all",
            group: "Employees" as const,
            label: `Search all employees for “${trimmed}”`,
            href: `/dashboard/employees?q=${encodeURIComponent(trimmed)}`,
            icon: UsersRound,
          },
        ]
      : [];

  const items = GROUP_ORDER.flatMap((group) => [...employeeCommands, ...matchedStatic].filter((c) => c.group === group));
  const activeIndex = items.length === 0 ? -1 : Math.min(active, items.length - 1);

  useEffect(() => {
    if (activeIndex >= 0) document.getElementById(`${listboxId}-opt-${activeIndex}`)?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, listboxId]);

  const run = (command: Command) => {
    close();
    router.push(command.href);
  };

  const onInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive(items.length ? (activeIndex + 1) % items.length : 0);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive(items.length ? (activeIndex - 1 + items.length) % items.length : 0);
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      run(items[activeIndex]);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={open}
        aria-haspopup="dialog"
        aria-keyshortcuts="Meta+K Control+K"
        aria-label="Search employees, pages and actions"
        className="group flex sm:w-full max-w-80 items-center gap-2 rounded-lg border border-control bg-surface-muted p-2 sm:px-3 text-xs text-slate-600 transition-colors duration-200 hover:border-brand-600 hover:bg-white"
      >
        <Search className="w-4 h-4 text-slate-500 group-hover:text-brand-600" aria-hidden />
        {/* Phones get an icon-only trigger; the aria-label keeps its name. */}
        <span aria-hidden className="hidden sm:block flex-1 truncate text-left">Search employees, pages, actions…</span>
        <kbd className="hidden sm:inline-flex items-center rounded border border-slate-300 bg-white px-1.5 py-0.5 font-mono text-[11px] font-semibold text-slate-600">
          {isMac ? "⌘" : "Ctrl"} K
        </kbd>
      </button>

      <dialog
        ref={dialogRef}
        aria-label="Command palette"
        onClick={(event) => {
          if (event.target === dialogRef.current) close();
        }}
        className="m-auto mt-[12vh] w-[calc(100%-2rem)] max-w-xl rounded-xl border border-slate-200 bg-white p-0 shadow-2xl backdrop:bg-slate-900/50 backdrop:backdrop-blur-sm"
      >
        <div className="flex items-center gap-3 border-b border-slate-200 px-4">
          <Search className="w-4 h-4 shrink-0 text-brand-600" aria-hidden />
          <input
            ref={inputRef}
            role="combobox"
            aria-expanded="true"
            aria-controls={listboxId}
            aria-activedescendant={activeIndex >= 0 ? optionId(activeIndex) : undefined}
            aria-autocomplete="list"
            aria-label="Search employees, pages and actions"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            onKeyDown={onInputKeyDown}
            placeholder={isHr ? "Search employees, pages, actions…" : "Jump to a page or action…"}
            className="h-12 flex-1 bg-transparent text-sm text-slate-900 outline-none"
          />
          <kbd className="rounded border border-slate-300 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-slate-600">Esc</kbd>
        </div>

        <ul id={listboxId} role="listbox" aria-label="Results" className="max-h-80 overflow-y-auto p-2">
          {items.length === 0 && (
            <li role="presentation" className="px-3 py-8 text-center text-xs text-slate-600">
              No matches for &ldquo;{trimmed}&rdquo;.
            </li>
          )}
          {items.map((item, index) => {
            const Icon = item.icon;
            const showHeading = index === 0 || items[index - 1].group !== item.group;
            const selected = index === activeIndex;
            return (
              <li key={item.id} role="presentation">
                {showHeading && (
                  <p role="presentation" className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                    {item.group}
                  </p>
                )}
                <div
                  id={optionId(index)}
                  role="option"
                  aria-selected={selected}
                  onMouseMove={() => setActive(index)}
                  onClick={() => run(item)}
                  className={clsx(
                    "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-xs transition-colors duration-100",
                    selected ? "bg-brand-50 text-brand-800" : "text-slate-700"
                  )}
                >
                  <Icon className={clsx("w-4 h-4 shrink-0", selected ? "text-brand-600" : "text-slate-500")} aria-hidden />
                  <span className="flex-1 truncate font-medium">{item.label}</span>
                  {item.hint && <span className="truncate text-[11px] text-slate-600">{item.hint}</span>}
                  {selected && <CornerDownLeft className="w-3.5 h-3.5 shrink-0 text-brand-600" aria-hidden />}
                </div>
              </li>
            );
          })}
        </ul>

        <div className="flex items-center gap-4 border-t border-slate-200 bg-surface-muted px-4 py-2 text-[11px] text-slate-600">
          <span><kbd className="font-mono font-semibold">↑↓</kbd> navigate</span>
          <span><kbd className="font-mono font-semibold">↵</kbd> open</span>
          <span><kbd className="font-mono font-semibold">Esc</kbd> close</span>
        </div>
      </dialog>
    </>
  );
}
