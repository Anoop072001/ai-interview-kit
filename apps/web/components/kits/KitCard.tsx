import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import type { KitSummary } from "@/lib/types";

const STATUS_LABEL: Record<KitSummary["status"], string> = {
  pending: "Queued",
  running: "Generating…",
  ok: "Ready",
  failed: "Failed",
};

export function KitCard({ kit }: { kit: KitSummary }) {
  const isActive = kit.status === "pending" || kit.status === "running";

  return (
    <Link
      href={`/kits/${kit.id}`}
      className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-4 transition-shadow hover:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium text-slate-900">{kit.role ?? "Untitled role"}</p>
          <p className="text-sm text-slate-500">{kit.company ?? kit.companyUrl}</p>
        </div>
        {isActive ? (
          <Badge tone="neutral">
            <Spinner size="sm" className="mr-1 inline" /> {STATUS_LABEL[kit.status]}
          </Badge>
        ) : (
          <Badge tone={kit.status === "ok" ? "success" : "danger"}>{STATUS_LABEL[kit.status]}</Badge>
        )}
      </div>
      <p className="text-xs text-slate-400">
        {kit.daysRequested} day{kit.daysRequested === 1 ? "" : "s"} · created{" "}
        {new Date(kit.createdAt).toLocaleDateString()}
      </p>
    </Link>
  );
}
