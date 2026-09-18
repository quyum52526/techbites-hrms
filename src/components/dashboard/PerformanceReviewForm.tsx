"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { submitEmployeeReview } from "@/app/actions/performance";

type Props = { reviewId: string; values: { productivity: number; qualityOfWork: number; collaboration: number } };

export default function PerformanceReviewForm({ reviewId, values }: Props) {
  const [metrics, setMetrics] = useState(values);
  const [feedback, setFeedback] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await submitEmployeeReview(reviewId, { ...metrics, feedback });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2 min-w-44">
      {(["productivity", "qualityOfWork", "collaboration"] as const).map((metric) => (
        <label key={metric} className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
          <span>{metric === "qualityOfWork" ? "Quality" : metric[0].toUpperCase() + metric.slice(1)}</span>
          <span className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((score) => (
              <button key={score} type="button" title={`${score} out of 5`} onClick={() => setMetrics({ ...metrics, [metric]: score })}>
                <Star className={`w-3 h-3 ${score <= metrics[metric] ? "fill-amber-400 text-amber-400" : "text-slate-500"}`} />
              </button>
            ))}
          </span>
        </label>
      ))}
      <textarea value={feedback} onChange={(event) => setFeedback(event.target.value)} placeholder="Feedback" rows={2} className="w-full border border-slate-200 rounded-md p-1.5 text-[11px] outline-none focus:ring-2 focus:ring-brand-600" />
      <button type="button" disabled={saving} onClick={save} className="w-full py-1.5 rounded-md bg-brand-600 text-white text-[11px] font-semibold disabled:opacity-50">
        {saving ? "Saving..." : "Submit Review"}
      </button>
    </div>
  );
}