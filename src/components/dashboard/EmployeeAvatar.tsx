"use client";

import { useState } from "react";
import { clsx } from "clsx";

interface Props {
  firstName: string;
  lastName: string;
  photoUrl: string | null;
  className?: string;
}

/** Employee photo with an initials fallback when there is no URL or the image fails to load. */
export default function EmployeeAvatar({ firstName, lastName, photoUrl, className }: Props) {
  // Tracks which URL failed, so a newly saved URL gets a fresh attempt.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const base = clsx("shrink-0 rounded-full", className ?? "w-8 h-8 text-xs");

  if (!photoUrl || failedUrl === photoUrl) {
    return (
      <span aria-hidden className={clsx(base, "flex items-center justify-center bg-brand-50 text-brand-600 font-bold")}>
        {firstName[0]}
        {lastName[0]}
      </span>
    );
  }

  return (
    // Plain <img>: photos can live on arbitrary hosts, which next/image would need whitelisted.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={photoUrl}
      alt={`${firstName} ${lastName}`}
      onError={() => setFailedUrl(photoUrl)}
      className={clsx(base, "object-cover border border-slate-200 bg-slate-50")}
    />
  );
}
