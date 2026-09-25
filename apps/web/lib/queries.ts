import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { api } from "./api";
import type {
  User,
  KitSummary,
  KitDetail,
  Question,
  Flashcard,
  QuestionCategory,
  RegeneratableSection,
  PracticeSessionResponse,
  BulkCaseInput,
  BulkCreateResult,
  Kit,
} from "./types";

// --- Auth --------------------------------------------------------------

export function useMe() {
  return useQuery<{ user: User }>({
    queryKey: ["me"],
    queryFn: () => api.get("/auth/me"),
    retry: false,
    staleTime: 60_000,
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { email: string; password: string }) =>
      api.post<{ user: User }>("/auth/login", input),
    onSuccess: (data) => qc.setQueryData(["me"], data),
  });
}

export function useRegister() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { email: string; password: string }) =>
      api.post<{ user: User }>("/auth/register", input),
    onSuccess: (data) => qc.setQueryData(["me"], data),
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post("/auth/logout"),
    onSuccess: () => {
      qc.setQueryData(["me"], null);
      qc.clear();
    },
  });
}

// --- Kits list -----------------------------------------------------------

export function useKits() {
  return useQuery<{ kits: KitSummary[] }>({
    queryKey: ["kits"],
    queryFn: () => api.get("/kits"),
  });
}

export function useCreateKit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { jd: string; companyUrl: string; days: number }) =>
      api.post<{ id: string; status: string }>("/kits", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kits"] }),
  });
}

export function useDeleteKit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/kits/${id}`),
    onMutate: async (id) => {
      const snapshot = qc.getQueryData<{ kits: KitSummary[] }>(["kits"]);
      qc.setQueryData<{ kits: KitSummary[] }>(["kits"], (data) =>
        data ? { kits: data.kits.filter((k) => k.id !== id) } : data
      );
      return { snapshot };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.snapshot) qc.setQueryData(["kits"], ctx.snapshot);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["kits"] }),
  });
}

export function useBulkCreateKits() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (cases: BulkCaseInput[]) => api.post<{ results: BulkCreateResult[] }>("/kits/bulk", { cases }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kits"] }),
  });
}

// --- A single kit, polled while generation is in flight -------------------

const ACTIVE_STATUSES = new Set(["pending", "running"]);

export function useKit(id: string) {
  return useQuery<KitDetail>({
    queryKey: ["kit", id],
    queryFn: () => api.get(`/kits/${id}`),
    refetchInterval: (query) => (query.state.data && ACTIVE_STATUSES.has(query.state.data.status) ? 2000 : false),
  });
}

function patchKit(qc: QueryClient, kitId: string, updater: (kit: Kit) => Kit) {
  qc.setQueryData<KitDetail>(["kit", kitId], (prev) => {
    if (!prev?.kit) return prev;
    return { ...prev, kit: updater(prev.kit) };
  });
}

function rollbackOnError(qc: QueryClient, kitId: string, snapshot: KitDetail | undefined) {
  if (snapshot) qc.setQueryData(["kit", kitId], snapshot);
}

// --- Regenerate one section ------------------------------------------------

export function useRegenerateSection(kitId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (section: RegeneratableSection) =>
      api.post<{ kit: Kit }>(`/kits/${kitId}/regenerate`, { section }),
    onSuccess: (data) => patchKit(qc, kitId, () => data.kit),
  });
}

// --- Company brief ---------------------------------------------------------

export function useEditCompanyBrief(kitId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<Kit["company_brief"]>) =>
      api.patch<{ kit: Kit }>(`/kits/${kitId}/company-brief`, patch),
    onMutate: async (patch) => {
      const snapshot = qc.getQueryData<KitDetail>(["kit", kitId]);
      patchKit(qc, kitId, (kit) => ({ ...kit, company_brief: { ...kit.company_brief, ...patch } }));
      return { snapshot };
    },
    onError: (_err, _vars, ctx) => rollbackOnError(qc, kitId, ctx?.snapshot),
    onSuccess: (data) => patchKit(qc, kitId, () => data.kit),
  });
}

// --- Questions ---------------------------------------------------------

export function useAddQuestion(kitId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      requirement_ids: string[];
      category: QuestionCategory;
      prompt: string;
      answer_outline: string;
      difficulty: number;
    }) => api.post<{ kit: Kit }>(`/kits/${kitId}/questions`, input),
    onSuccess: (data) => patchKit(qc, kitId, () => data.kit),
  });
}

export function useEditQuestion(kitId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Question> }) =>
      api.patch<{ kit: Kit }>(`/kits/${kitId}/questions/${id}`, patch),
    onMutate: async ({ id, patch }) => {
      const snapshot = qc.getQueryData<KitDetail>(["kit", kitId]);
      patchKit(qc, kitId, (kit) => ({
        ...kit,
        questions: kit.questions.map((q) =>
          q.id === id ? { ...q, ...patch, state: q.state === "pinned" ? "pinned" : "edited" } : q
        ),
      }));
      return { snapshot };
    },
    onError: (_err, _vars, ctx) => rollbackOnError(qc, kitId, ctx?.snapshot),
    onSuccess: (data) => patchKit(qc, kitId, () => data.kit),
  });
}

export function useDeleteQuestion(kitId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<{ kit: Kit }>(`/kits/${kitId}/questions/${id}`),
    onMutate: async (id) => {
      const snapshot = qc.getQueryData<KitDetail>(["kit", kitId]);
      patchKit(qc, kitId, (kit) => ({ ...kit, questions: kit.questions.filter((q) => q.id !== id) }));
      return { snapshot };
    },
    onError: (_err, _vars, ctx) => rollbackOnError(qc, kitId, ctx?.snapshot),
    onSuccess: (data) => patchKit(qc, kitId, () => data.kit),
  });
}

export function useReorderQuestions(kitId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ category, orderedIds }: { category: QuestionCategory; orderedIds: string[] }) =>
      api.patch<{ kit: Kit }>(`/kits/${kitId}/questions/order`, { category, orderedIds }),
    onMutate: async ({ category, orderedIds }) => {
      const snapshot = qc.getQueryData<KitDetail>(["kit", kitId]);
      patchKit(qc, kitId, (kit) => {
        const byId = new Map(kit.questions.map((q) => [q.id, q]));
        const queue = [...orderedIds];
        return {
          ...kit,
          questions: kit.questions.map((q) => (q.category === category ? byId.get(queue.shift()!)! : q)),
        };
      });
      return { snapshot };
    },
    onError: (_err, _vars, ctx) => rollbackOnError(qc, kitId, ctx?.snapshot),
    onSuccess: (data) => patchKit(qc, kitId, () => data.kit),
  });
}

// --- Flashcards ----------------------------------------------------------

export function useAddFlashcard(kitId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { front: string; back: string; requirement_ids: string[] }) =>
      api.post<{ kit: Kit }>(`/kits/${kitId}/flashcards`, input),
    onSuccess: (data) => patchKit(qc, kitId, () => data.kit),
  });
}

export function useEditFlashcard(kitId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Flashcard> }) =>
      api.patch<{ kit: Kit }>(`/kits/${kitId}/flashcards/${id}`, patch),
    onMutate: async ({ id, patch }) => {
      const snapshot = qc.getQueryData<KitDetail>(["kit", kitId]);
      patchKit(qc, kitId, (kit) => ({
        ...kit,
        flashcards: kit.flashcards.map((f) =>
          f.id === id ? { ...f, ...patch, state: f.state === "pinned" ? "pinned" : "edited" } : f
        ),
      }));
      return { snapshot };
    },
    onError: (_err, _vars, ctx) => rollbackOnError(qc, kitId, ctx?.snapshot),
    onSuccess: (data) => patchKit(qc, kitId, () => data.kit),
  });
}

export function useDeleteFlashcard(kitId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<{ kit: Kit }>(`/kits/${kitId}/flashcards/${id}`),
    onMutate: async (id) => {
      const snapshot = qc.getQueryData<KitDetail>(["kit", kitId]);
      patchKit(qc, kitId, (kit) => ({ ...kit, flashcards: kit.flashcards.filter((f) => f.id !== id) }));
      return { snapshot };
    },
    onError: (_err, _vars, ctx) => rollbackOnError(qc, kitId, ctx?.snapshot),
    onSuccess: (data) => patchKit(qc, kitId, () => data.kit),
  });
}

// --- Practice mode ---------------------------------------------------------

export function usePracticeSession(kitId: string) {
  return useQuery<PracticeSessionResponse>({
    queryKey: ["practice", kitId],
    queryFn: () => api.get(`/kits/${kitId}/practice/session`),
  });
}

export function useRecordPracticeAttempt(kitId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { flashcardId: string; confidence: number }) =>
      api.post(`/kits/${kitId}/practice/attempts`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["practice", kitId] }),
  });
}
