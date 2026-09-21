"use client";

import { useId, useState, useTransition } from "react";
import { Star } from "lucide-react";
import { clsx } from "clsx";
import { submitPerformanceReview } from "@/app/actions/performance";
import Modal, { ModalActions } from "@/components/ui/Modal";
import FormField from "@/components/ui/FormField";
import { ActionFeedback, SubmitButton, type ActionResult } from "@/components/ui/FormFeedback";
import { controlClass, primaryButtonClass, secondaryButtonClass } from "@/components/ui/styles";
import { GuestLockedButton, useReadOnly } from "@/components/ui/ReadOnly";

type Metrics = { productivity: number; qualityOfWork: number; collaboration: number };

type Props = {
  cycleId: string;
  employeeId: string;
  employeeName: string;
  designation: string;
  review: (Metrics & { feedback: string | null; reviewerId: string | null; status: string }) | null;
};

const METRICS = [
  { key: "productivity", label: "Productivity" },
  { key: "qualityOfWork", label: "Quality of work" },
  { key: "collaboration", label: "Collaboration" },
] as const;

export default function ReviewModal({ cycleId, employeeId, employeeName, designation, review }: Props) {
  const readOnly = useReadOnly();
  const [open, setOpen] = useState(false);
  const [metrics, setMetrics] = useState<Metrics>({ productivity: review?.productivity ?? 3, qualityOfWork: review?.qualityOfWork ?? 3, collaboration: review?.collaboration ?? 3 });
  const [feedback, setFeedback] = useState(review?.feedback ?? "");
  const [result, setResult] = useState<ActionResult | null>(null);
  const [isSaving, startSaving] = useTransition();
  const groupId = useId();
  const hasReview = Boolean(review && (review.reviewerId || review.status !== "DRAFT"));
  const currentScore = review ? ((review.productivity + review.qualityOfWork + review.collaboration) / 3).toFixed(1) : null;

  const show = () => {
    setMetrics({ productivity: review?.productivity ?? 3, qualityOfWork: review?.qualityOfWork ?? 3, collaboration: review?.collaboration ?? 3 });
    setFeedback(review?.feedback ?? "");
    setResult(null);
    setOpen(true);
  };

  const save = () => {
    if (!feedback.trim()) {
      setResult({ ok: false, error: "Feedback is required" });
      return;
    }
    setResult(null);
    startSaving(async () => {
      try {
        await submitPerformanceReview(cycleId, employeeId, { ...metrics, feedback });
        setOpen(false);
      } catch {
        setResult({ ok: false, error: "Could not save the review. Please try again." });
      }
    });
  };

  if (readOnly) {
    return <GuestLockedButton className={`${primaryButtonClass} whitespace-nowrap text-[11px]`}>{hasReview ? "Edit Rating" : "Review"}</GuestLockedButton>;
  }

  return (
    <>
      <button type="button" onClick={show} className={`${primaryButtonClass} whitespace-nowrap text-[11px]`}>
        {hasReview ? `Edit Rating${currentScore ? ` · ${currentScore}/5` : ""}` : "+ Review"}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} size="lg" title={`Review ${employeeName}`} description={designation} dismissible={!isSaving}>
        <form onSubmit={(event) => { event.preventDefault(); save(); }} className="p-6 space-y-5 text-xs">
          <div className="space-y-3">
            {METRICS.map(({ key, label }) => (
              <div key={key} role="group" aria-labelledby={`${groupId}-${key}`} className="flex items-center justify-between gap-3">
                <span id={`${groupId}-${key}`} className="font-medium text-slate-700">{label}</span>
                <span className="flex items-center" aria-label={`${label}: ${metrics[key]} of 5`}>
                  {[1, 2, 3, 4, 5].map((score) => (
                    <button key={score} type="button" aria-label={`${label}: ${score} of 5`} aria-pressed={score === metrics[key]} onClick={() => setMetrics({ ...metrics, [key]: score })} className="group rounded p-1 hover:bg-amber-50">
                      <Star aria-hidden className={clsx("h-5 w-5", score <= metrics[key] ? "fill-amber-400 text-amber-500" : "text-slate-400 group-hover:text-amber-500")} />
                    </button>
                  ))}
                </span>
              </div>
            ))}
          </div>
          <FormField label="Feedback: strengths, improvements, and comments" required>
            <textarea value={feedback} onChange={(event) => setFeedback(event.target.value)} placeholder="Share strengths, areas for improvement, and additional comments" rows={5} required className={`${controlClass} resize-y`} />
          </FormField>
          <ActionFeedback state={result} />
          <ModalActions>
            <button type="button" onClick={() => setOpen(false)} className={secondaryButtonClass} disabled={isSaving}>Cancel</button>
            <SubmitButton pending={isSaving} className={primaryButtonClass}>Save Rating</SubmitButton>
          </ModalActions>
        </form>
      </Modal>
    </>
  );
}