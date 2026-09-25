"use client";

import { useEffect, useState } from "react";
import { usePracticeSession, useRecordPracticeAttempt } from "@/lib/queries";
import { Spinner } from "@/components/ui/Spinner";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { FlashcardFlip } from "./FlashcardFlip";
import type { PracticeCard } from "@/lib/types";

export function PracticeSession({ kitId }: { kitId: string }) {
  const { data, isPending, isError, refetch } = usePracticeSession(kitId);
  const recordAttempt = useRecordPracticeAttempt(kitId);
  const [revealed, setRevealed] = useState(false);

  // A session is a fixed-order pass through the cards, captured once when
  // they're fetched — not the live, continuously-reordered query result.
  // Without this, "order the next session by least confident" (Section 7)
  // becomes a card that never stops reappearing: rate it, the list
  // re-sorts, and if it's still the lowest-confidence card it just comes
  // right back — practice mode never ends. Advancing a local index instead
  // guarantees the session terminates after exactly `queue.length` cards;
  // starting a new session re-fetches and re-snapshots, which is where the
  // updated confidence ordering actually takes effect.
  const [queue, setQueue] = useState<PracticeCard[] | null>(null);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (data && queue === null) setQueue(data.cards);
  }, [data, queue]);

  function startNewSession() {
    setQueue(null);
    setIndex(0);
    setRevealed(false);
    refetch();
  }

  if (isPending || (data && queue === null)) {
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

  const cards = queue!;
  const done = index >= cards.length;

  if (done) {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center">
        <p className="text-xl font-semibold text-slate-900">Session complete</p>
        <p className="text-sm text-slate-500">
          You went through {cards.length} card{cards.length === 1 ? "" : "s"}. {data.coveredCount} / {data.totalCount}{" "}
          have been practiced at least once overall.
        </p>
        <Button onClick={startNewSession}>Start another session</Button>
      </div>
    );
  }

  const current = cards[index];

  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <div>
        <div className="mb-1 flex items-center justify-between text-sm text-slate-500">
          <span>
            Card {index + 1} / {cards.length} this session
          </span>
          <span>{current.attempted ? `Last rated ${current.lastConfidence}/5` : "Not yet practiced"}</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-slate-100">
          <div
            className="h-1.5 rounded-full bg-slate-900 transition-all"
            style={{ width: `${(index / cards.length) * 100}%` }}
          />
        </div>
      </div>

      <FlashcardFlip
        key={current.flashcardId}
        card={current}
        revealed={revealed}
        onReveal={() => setRevealed(true)}
        onRate={(confidence) => {
          recordAttempt.mutate({ flashcardId: current.flashcardId, confidence });
          setRevealed(false);
          setIndex((i) => i + 1);
        }}
        rating={recordAttempt.isPending}
      />
    </div>
  );
}
