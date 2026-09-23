"use client";

import { Button } from "@/components/ui/Button";
import type { PracticeCard } from "@/lib/types";

const CONFIDENCE_LABELS = ["Not at all", "Barely", "Somewhat", "Mostly", "Very"];

export function FlashcardFlip({
  card,
  revealed,
  onReveal,
  onRate,
  rating,
}: {
  card: PracticeCard;
  revealed: boolean;
  onReveal: () => void;
  onRate: (confidence: number) => void;
  rating: boolean;
}) {
  return (
    <div className="flex flex-col gap-6">
      <button
        type="button"
        onClick={onReveal}
        disabled={revealed}
        className="flex min-h-[14rem] flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm transition-shadow hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 disabled:cursor-default"
      >
        <p className="text-lg font-medium text-slate-900">{card.front}</p>
        {revealed ? (
          <p className="mt-2 border-t border-slate-100 pt-4 text-slate-600">{card.back}</p>
        ) : (
          <p className="text-sm text-slate-400">Click to reveal the answer</p>
        )}
      </button>

      {revealed && (
        <div className="flex flex-col items-center gap-2">
          <p className="text-sm text-slate-500">How confident did you feel?</p>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((score) => (
              <Button key={score} variant="secondary" size="sm" disabled={rating} onClick={() => onRate(score)}>
                {score} · {CONFIDENCE_LABELS[score - 1]}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
