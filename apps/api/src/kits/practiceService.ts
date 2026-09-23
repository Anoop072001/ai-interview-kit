import type { Flashcard } from "@aik/shared";

export interface PracticeAttempt {
  flashcardId: string;
  confidence: number; // 1 (not confident) – 5 (very confident)
  attemptedAt: Date;
}

export interface PracticeCard {
  flashcardId: string;
  front: string;
  back: string;
  attempted: boolean;
  lastConfidence: number | null;
  attemptCount: number;
}

export interface PracticeSession {
  cards: PracticeCard[];
  coveredCount: number;
  totalCount: number;
}

/**
 * Confidence-weighted ordering (Section 7 — a simple confidence-weighted
 * sort is explicitly called out as an acceptable choice over a full
 * spaced-repetition interval). Never-attempted cards are treated as the
 * least confident of all, since "not yet covered" is a stronger signal to
 * practice next than "rated low once" — a full spaced-repetition scheduler
 * would be the natural upgrade path if this needed to get more precise.
 */
export function buildPracticeSession(flashcards: Flashcard[], attempts: PracticeAttempt[]): PracticeSession {
  const byCard = new Map<string, PracticeAttempt[]>();
  for (const attempt of attempts) {
    const list = byCard.get(attempt.flashcardId) ?? [];
    list.push(attempt);
    byCard.set(attempt.flashcardId, list);
  }

  const cards: PracticeCard[] = flashcards.map((f) => {
    const history = (byCard.get(f.id) ?? []).sort(
      (a, b) => b.attemptedAt.getTime() - a.attemptedAt.getTime()
    );
    const last = history[0];
    return {
      flashcardId: f.id,
      front: f.front,
      back: f.back,
      attempted: history.length > 0,
      lastConfidence: last ? last.confidence : null,
      attemptCount: history.length,
    };
  });

  const priority = (c: PracticeCard) => (c.attempted ? c.lastConfidence! : 0);
  cards.sort((a, b) => priority(a) - priority(b));

  return {
    cards,
    coveredCount: cards.filter((c) => c.attempted).length,
    totalCount: cards.length,
  };
}
