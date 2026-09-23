type Tone = "neutral" | "edited" | "pinned" | "must" | "nice" | "success" | "danger";

const TONE_CLASSES: Record<Tone, string> = {
  neutral: "bg-slate-100 text-slate-600",
  edited: "bg-amber-100 text-amber-800",
  pinned: "bg-violet-100 text-violet-800",
  must: "bg-rose-100 text-rose-700",
  nice: "bg-sky-100 text-sky-700",
  success: "bg-emerald-100 text-emerald-700",
  danger: "bg-red-100 text-red-700",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TONE_CLASSES[tone]}`}>
      {children}
    </span>
  );
}
