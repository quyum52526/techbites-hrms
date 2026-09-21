"use client";

import { useActionState, useState, type FormEvent } from "react";
import { Eye, EyeOff, Info, Loader2, LogIn, ShieldCheck, UserRound } from "lucide-react";
import { clsx } from "clsx";
import { signIn, signInAsGuest } from "@/app/actions/auth";

interface Props {
  /** Dashboard path to return to after signing in; the server only accepts /dashboard paths. */
  next: string | null;
  /** Why the user was sent here, e.g. a deactivated account. */
  notice: string | null;
  /** Whether "Continue as Guest" is offered (guest mode enabled and configured on the server). */
  guestAvailable: boolean;
}

type FieldErrors = { email?: string; password?: string };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const labelClass = "block text-xs font-medium text-slate-300";
const inputClass =
  "w-full rounded-lg border border-slate-700 bg-[#0d1527] px-3 py-2.5 text-sm transition-[border-color,box-shadow] duration-150 hover:border-slate-500 focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/30 aria-invalid:border-rose-400 aria-invalid:focus:ring-rose-400/30 disabled:opacity-60";
const fieldErrorClass = "text-[11px] font-medium text-rose-300";

export default function LoginForm({ next, notice, guestAvailable }: Props) {
  const [state, action, pending] = useActionState(signIn, null);
  const [guestState, guestAction, guestPending] = useActionState(signInAsGuest, null);
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const busy = pending || guestPending;

  // Checked in the browser first so obvious mistakes never reach the server; the server validates again.
  const validate = (event: FormEvent<HTMLFormElement>) => {
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");
    const errors: FieldErrors = {};
    if (!email) errors.email = "Enter your work email";
    else if (!EMAIL_PATTERN.test(email)) errors.email = "Enter a valid email address, e.g. name@company.com";
    if (!password) errors.password = "Enter your password";
    setFieldErrors(errors);
    if (errors.email || errors.password) {
      event.preventDefault();
      event.currentTarget.querySelector<HTMLInputElement>(errors.email ? "#email" : "#password")?.focus();
    }
  };

  const clearError = (field: keyof FieldErrors) => setFieldErrors((current) => (current[field] ? { ...current, [field]: undefined } : current));

  return (
    <div className="space-y-5">
      <form action={action} onSubmit={validate} className="space-y-4" noValidate>
        {next && <input type="hidden" name="next" value={next} />}

        {notice && !state && (
          <p role="status" className="flex items-start gap-2 rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-200">
            <Info className="w-3.5 h-3.5 mt-px shrink-0" aria-hidden />
            {notice}
          </p>
        )}

        <div className="space-y-1.5">
          <label htmlFor="email" className={labelClass}>
            Work Email
          </label>
          {/* Keyed by the returned email so a failed attempt keeps what was typed. */}
          <input
            key={state?.email}
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="username"
            placeholder="name@company.com"
            defaultValue={state?.email ?? ""}
            autoFocus
            disabled={busy}
            onChange={() => clearError("email")}
            aria-invalid={fieldErrors.email ? true : undefined}
            aria-describedby={fieldErrors.email ? "email-error" : undefined}
            className={inputClass}
          />
          {fieldErrors.email && (
            <p id="email-error" className={fieldErrorClass}>
              {fieldErrors.email}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="password" className={labelClass}>
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Enter your password"
              disabled={busy}
              onChange={() => clearError("password")}
              aria-invalid={fieldErrors.password || state ? true : undefined}
              aria-describedby={clsx(fieldErrors.password && "password-error", state && "login-error") || undefined}
              className={clsx(inputClass, "pr-10")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((shown) => !shown)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              className="absolute inset-y-0 right-0 rounded-r-lg px-3 text-slate-400 transition-colors duration-150 hover:text-slate-100"
            >
              {showPassword ? <EyeOff className="w-4 h-4" aria-hidden /> : <Eye className="w-4 h-4" aria-hidden />}
            </button>
          </div>
          {fieldErrors.password && (
            <p id="password-error" className={fieldErrorClass}>
              {fieldErrors.password}
            </p>
          )}
        </div>

        {state && (
          <p id="login-error" role="alert" className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-200">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="bg-brand-gradient w-full inline-flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold text-white shadow-lg shadow-accent-700/25 transition-[filter,box-shadow] duration-150 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <LogIn className="w-4 h-4" aria-hidden />}
          {pending ? "Signing in…" : "Sign In"}
        </button>
      </form>

      {guestAvailable && (
        <>
          <div className="flex items-center gap-3 text-[11px] font-medium uppercase tracking-wider text-slate-500" aria-hidden>
            <span className="h-px flex-1 bg-slate-700" />
            or
            <span className="h-px flex-1 bg-slate-700" />
          </div>

          <form action={guestAction} className="space-y-3">
            <button
              type="submit"
              disabled={busy}
              aria-describedby="guest-help"
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-slate-600 bg-slate-800/40 py-2.5 text-sm font-semibold text-slate-100 transition-colors duration-150 hover:border-slate-500 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {guestPending ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <UserRound className="w-4 h-4" aria-hidden />}
              {guestPending ? "Opening guest session…" : "Continue as Guest (Read-Only)"}
            </button>
            <p id="guest-help" className="flex items-start gap-2 rounded-lg border border-brand-400/20 bg-brand-500/5 px-3 py-2 text-[11px] leading-relaxed text-slate-300">
              <ShieldCheck className="w-3.5 h-3.5 mt-px shrink-0 text-brand-400" aria-hidden />
              <span>
                <strong className="font-semibold text-slate-100">Guest Mode is strictly view-only.</strong> Browse a demo company&rsquo;s
                dashboards, employees, attendance, leave and payroll. Adding, editing, approving and deleting are disabled.
              </span>
            </p>
            {guestState && (
              <p role="alert" className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-200">
                {guestState.error}
              </p>
            )}
          </form>
        </>
      )}
    </div>
  );
}
