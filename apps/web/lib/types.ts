import type { Kit, Question, Flashcard, QuestionCategory, Requirement } from "@aik/shared";

export type { Kit, Question, Flashcard, QuestionCategory, Requirement };

export interface User {
  id: string;
  email: string;
}

export type KitStatus = "pending" | "running" | "ok" | "failed";

export interface GenerationStep {
  name: string;
  status: "pending" | "running" | "done" | "failed" | "skipped";
  message: string;
  startedAt?: string;
  finishedAt?: string;
}

export interface GenerationState {
  steps: GenerationStep[];
  error: { code: string; message: string } | null;
}

export interface KitSummary {
  id: string;
  status: KitStatus;
  companyUrl: string;
  daysRequested: number;
  company: string | null;
  role: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface KitDetail {
  id: string;
  status: KitStatus;
  companyUrl: string;
  daysRequested: number;
  generation: GenerationState;
  kit: Kit | null;
}

export interface KitStatusResponse {
  id: string;
  status: KitStatus;
  generation: GenerationState;
}

export type RegeneratableSection = QuestionCategory | "company_brief" | "flashcards" | "schedule";

export interface PracticeCard {
  flashcardId: string;
  front: string;
  back: string;
  attempted: boolean;
  lastConfidence: number | null;
  attemptCount: number;
}

export interface PracticeSessionResponse {
  cards: PracticeCard[];
  coveredCount: number;
  totalCount: number;
}

export interface BulkCaseInput {
  jd: string;
  company_url: string;
  days: number;
}

export interface BulkCreateResult {
  index: number;
  id: string | null;
  status: KitStatus | "invalid";
  error?: string;
}
