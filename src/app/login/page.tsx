import type { Metadata } from "next";
import Image from "next/image";
import LoginForm from "@/components/auth/LoginForm";
import { guestModeEnabled } from "@/lib/guest";

export const metadata: Metadata = { title: "Sign in" };

const reasonMessages: Record<string, string> = {
  deactivated: "Your account has been deactivated. Contact HR if you think this is a mistake.",
  expired: "Your session has ended. Please sign in again.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; reason?: string }> }) {
  const { next, reason } = await searchParams;
  const showDevHint = process.env.NODE_ENV !== "production";

  return (
    <main className="auth-dark relative flex-1 grid place-items-center overflow-hidden bg-[#0d1527] px-4 py-10">
      {/* Soft brand glows behind the card; purely decorative. */}
      <div aria-hidden className="pointer-events-none absolute -top-40 -left-32 h-96 w-96 rounded-full bg-brand-500/15 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-40 -right-32 h-96 w-96 rounded-full bg-accent-500/15 blur-3xl" />

      <div className="relative w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-4 text-center">
          {/* The logo's violet wordmark is unreadable on navy, so it sits on a white plate, as in the sidebar. */}
          <div className="relative h-11 w-[157px] overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-white/10">
            <Image
              src="/tech-bites-hrms-logo.png"
              alt="TechBites HRMS"
              width={2000}
              height={2000}
              priority
              className="absolute max-w-none w-[190px] h-[190px] left-[-9px] top-[-70px]"
            />
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-bold text-slate-50">Sign in</h1>
            <p className="text-xs text-slate-400">Use your work email to access the HR dashboard</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-700/70 bg-[#131d35] p-6 shadow-2xl shadow-black/40">
          <LoginForm next={next ?? null} notice={reason ? (reasonMessages[reason] ?? null) : null} guestAvailable={guestModeEnabled()} />
        </div>

        {showDevHint && (
          <p className="text-center text-[11px] leading-relaxed text-slate-400">
            Development: employees created in the app or by CSV import start with the password{" "}
            <span className="font-mono text-slate-300">Welcome123!</span>
          </p>
        )}
      </div>
    </main>
  );
}
