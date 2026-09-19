"use client";

import { useActionState, useState } from "react";
import { Eye, EyeOff, Info, Loader2, LogIn } from "lucide-react";
import { clsx } from "clsx";
import { signIn } from "@/app/actions/auth";
import FormField from "@/components/ui/FormField";
import { controlClass, primaryButtonClass } from "@/components/ui/styles";

interface Props {
  /** Dashboard path to return to after signing in; the server only accepts /dashboard paths. */
  next: string | null;
  /** Why the user was sent here, e.g. a deactivated account. */
  notice: string | null;
}

export default function LoginForm({ next, notice }: Props) {
  const [state, action, pending] = useActionState(signIn, null);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={action} className="space-y-4 text-xs" noValidate>
      {next && <input type="hidden" name="next" value={next} />}

      {notice && !state && (
        <p role="status" className="flex items-start gap-2 px-3 py-2 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 font-medium">
          <Info className="w-3.5 h-3.5 mt-px shrink-0" aria-hidden />
          {notice}
        </p>
      )}

      <FormField label="Work email" required>
        {/* Keyed by the returned email so a failed attempt keeps what was typed. */}
        <input
          key={state?.email}
          name="email"
          type="email"
          autoComplete="username"
          defaultValue={state?.email ?? ""}
          autoFocus
          className={controlClass}
        />
      </FormField>

      <div className="space-y-1">
        <label htmlFor="password" className="block text-xs font-medium text-slate-700">
          Password
          <span aria-hidden className="ml-0.5 text-rose-700">
            *
          </span>
        </label>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            aria-invalid={state ? true : undefined}
            aria-describedby={state ? "login-error" : undefined}
            className={clsx(controlClass, "pr-9")}
          />
          <button
            type="button"
            onClick={() => setShowPassword((shown) => !shown)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            className="absolute inset-y-0 right-0 px-2.5 text-slate-500 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 rounded-r-lg"
          >
            {showPassword ? <EyeOff className="w-4 h-4" aria-hidden /> : <Eye className="w-4 h-4" aria-hidden />}
          </button>
        </div>
      </div>

      {state && (
        <p id="login-error" role="alert" className="px-3 py-2 rounded-lg border border-rose-300 bg-rose-50 text-rose-800 font-medium">
          {state.error}
        </p>
      )}

      <button type="submit" disabled={pending} className={clsx(primaryButtonClass, "w-full inline-flex items-center justify-center gap-2")}>
        {pending ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <LogIn className="w-4 h-4" aria-hidden />}
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
