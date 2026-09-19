import type { Metadata } from "next";
import Image from "next/image";
import LoginForm from "@/components/auth/LoginForm";
import { cardClass } from "@/components/ui/styles";

export const metadata: Metadata = { title: "Sign in" };

const reasonMessages: Record<string, string> = {
  deactivated: "Your account has been deactivated. Contact HR if you think this is a mistake.",
  expired: "Your session has ended. Please sign in again.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; reason?: string }> }) {
  const { next, reason } = await searchParams;
  const showDemoAccounts = process.env.NODE_ENV !== "production";

  return (
    <main className="flex-1 grid place-items-center bg-surface-muted px-4 py-10">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <Image src="/tech-bites-hrms-logo.png" alt="TechBites HRMS" width={160} height={48} priority className="h-12 w-auto" />
          <div>
            <h1 className="text-xl font-bold text-slate-900">Sign in</h1>
            <p className="text-xs text-slate-600">Use your work email to access the HR dashboard</p>
          </div>
        </div>

        <div className={`${cardClass} p-6`}>
          <LoginForm next={next ?? null} notice={reason ? (reasonMessages[reason] ?? null) : null} />
        </div>

        {showDemoAccounts && (
          <p className="text-center text-[11px] text-slate-600">
            Development: seeded accounts such as <span className="font-mono">admin@techbites.com</span> use{" "}
            <span className="font-mono">admin123</span>; employees added in the app start with{" "}
            <span className="font-mono">Welcome123!</span>
          </p>
        )}
      </div>
    </main>
  );
}
