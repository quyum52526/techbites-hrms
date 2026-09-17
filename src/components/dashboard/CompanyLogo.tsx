"use client";

import { useState } from "react";
import { clsx } from "clsx";

interface Props {
  name: string;
  logoUrl: string | null;
  className?: string;
}

function initialsFor(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return words.slice(0, 2).map((word) => word[0]).join("").toUpperCase() || "?";
}

/** Company logo with an initials fallback when there is no URL or the image fails to load. */
export default function CompanyLogo({ name, logoUrl, className }: Props) {
  // Tracks which URL failed, so a newly saved URL gets a fresh attempt.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const base = clsx("shrink-0 rounded-md border border-slate-200 bg-slate-50", className ?? "w-8 h-8");

  if (!logoUrl || failedUrl === logoUrl) {
    return (
      <span aria-hidden className={clsx(base, "flex items-center justify-center font-bold text-[10px] text-indigo-700 bg-indigo-50 border-indigo-100")}>
        {initialsFor(name)}
      </span>
    );
  }

  return (
    // Plain <img>: logos can live on arbitrary hosts, which next/image would need whitelisted.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={logoUrl} alt={`${name} logo`} onError={() => setFailedUrl(logoUrl)} className={clsx(base, "object-contain")} />
  );
}
