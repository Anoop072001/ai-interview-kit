"use client";

import { useState } from "react";
import { usePracticeSession, useRecordPracticeAttempt } from "@/lib/queries";
import { Spinner } from "@/components/ui/Spinner";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { EmptyState } from "@/components/ui/EmptyState";
import { FlashcardFlip } from "./FlashcardFlip";

export function PracticeSession({ kitId }: { kitId: string }) {
  const { data, isPending, isError, refetch } = usePracticeSession(kitId);
  const recordAttempt = useRecordPracticeAttempt(kitId);
  const [revealed, setRevealed] = useState(false);

  if (isPending) {
    return (
      <div className="flex flex-1 items-center justify-center py-24">
        <Spinner size="lg" className="text-slate-400" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="mx-auto w-full max-w-xl px-4 py-12">
        <ErrorBanner message="Could not load the practice session." onRetry={() => refetch()} />
      </div>
    );
  }

  if (data.cards.length === 0) {
    return (
      <div className="mx-auto w-full max-w-xl px-4 py-12">
        <EmptyState title="No flashcards to practice yet" description="Add or generate flashcards for this kit first." />
      </div>
    );
  }

  const current = data.cards[0];

  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <div>
        <div className="mb-1 flex items-center justify-between text-sm text-slate-500">
          <span>
            {data.coveredCount} / {data.totalCount} covered
          </span>
          <span>{current.attempted ? `Last rated ${current.lastConfidence}/5` : "Not yet practiced"}</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-slate-100">
          <div
            className="h-1.5 rounded-full bg-slate-900 transition-all"
            style={{ width: `${(data.coveredCount / data.totalCount) * 100}%` }}
          />
        </div>
      </div>

      <FlashcardFlip
        key={current.flashcardId}
        card={current}
        revealed={revealed}
        onReveal={() => setRevealed(true)}
        onRate={(confidence) =>
          recordAttempt.mutate(
            { flashcardId: current.flashcardId, confidence },
            { onSuccess: () => setRevealed(false) }
          )
        }
        rating={recordAttempt.isPending}
      />
    </div>
  );
}
