"use client";

import { useId, useState, useTransition } from "react";
import { Star } from "lucide-react";
import { clsx } from "clsx";
import { submitEmployeeReview } from "@/app/actions/performance";
import FormField from "@/components/ui/FormField";
import { ActionFeedback, SubmitButton, type ActionResult } from "@/components/ui/FormFeedback";
import { controlClass } from "@/components/ui/styles";

type Metrics = { productivity: number; qualityOfWork: number; collaboration: number };
type Props = { reviewId: string; employeeName: string; values: Metrics };

const METRICS = [
  { key: "productivity", label: "Productivity" },
  { key: "qualityOfWork", label: "Quality" },
  { key: "collaboration", label: "Collaboration" },
] as const;

export default function PerformanceReviewForm({ reviewId, employeeName, values }: Props) {
  const [metrics, setMetrics] = useState(values);
  const [feedback, setFeedback] = useState("");
  const [result, setResult] = useState<ActionResult | null>(null);
  const [isSaving, startSaving] = useTransition();
  const groupId = useId();

  const save = () => {
    setResult(null);
    startSaving(async () => {
      try {
        await submitEmployeeReview(reviewId, { ...metrics, feedback });
        setResult({ ok: true, message: "Review saved" });
      } catch {
        // Production builds hide server error text, so show one actionable message instead.
        setResult({ ok: false, error: "Could not save the review. Please try again." });
      }
    });
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
      aria-label={`Review for ${employeeName}`}
      className="space-y-2 min-w-44"
    >
      {METRICS.map(({ key, label }) => (
        // A group, not a <label>: a label wrapping buttons forwards clicks on its text to the first star.
        <div key={key} role="group" aria-labelledby={`${groupId}-${key}`} className="flex items-center justify-between gap-2 text-[11px] text-slate-600">
          <span id={`${groupId}-${key}`}>{label}</span>
          <span className="flex items-center">
            {[1, 2, 3, 4, 5].map((score) => {
              const filled = score <= metrics[key];
              return (
                <button
                  key={score}
                  type="button"
                  aria-label={`${label}: ${score} of 5`}
                  aria-pressed={score === metrics[key]}
                  onClick={() => setMetrics({ ...metrics, [key]: score })}
                  className="group p-0.5 rounded cursor-pointer transition-colors duration-150 hover:bg-amber-50"
                >
                  <Star
                    aria-hidden
                    className={clsx(
                      "w-3 h-3 transition-colors duration-150",
                      filled ? "fill-amber-400 text-amber-500" : "text-slate-500 group-hover:text-amber-500"
                    )}
                  />
                </button>
              );
            })}
          </span>
        </div>
      ))}
      <FormField label={`Feedback for ${employeeName}`} hideLabel>
        <textarea
          value={feedback}
          onChange={(event) => setFeedback(event.target.value)}
          placeholder="Feedback"
          rows={2}
          className={clsx(controlClass, "text-[11px] resize-none")}
        />
      </FormField>
      <SubmitButton pending={isSaving} className="w-full text-[11px]">
        Submit Review
      </SubmitButton>
      <ActionFeedback state={result} className="text-[11px]" />
    </form>
  );
}
