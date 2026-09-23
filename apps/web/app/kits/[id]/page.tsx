"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { useKit } from "@/lib/queries";
import { Spinner } from "@/components/ui/Spinner";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { GenerationProgress } from "@/components/kits/GenerationProgress";
import { CompanyBriefSection } from "@/components/builder/CompanyBriefSection";
import { RoleSection } from "@/components/builder/RoleSection";
import { QuestionBank } from "@/components/builder/QuestionBank";
import { FlashcardsSection } from "@/components/builder/FlashcardsSection";
import { ScheduleView } from "@/components/builder/ScheduleView";

function KitDetail({ id }: { id: string }) {
  const { data, isPending, isError, refetch } = useKit(id);

  if (isPending) {
    return (
      <div className="flex flex-1 items-center justify-center py-24">
        <Spinner size="lg" className="text-slate-400" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-12">
        <ErrorBanner message="Could not load this kit." onRetry={() => refetch()} />
      </div>
    );
  }

  if (data.status !== "ok" || !data.kit) {
    return <GenerationProgress status={data.status} generation={data.generation} />;
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <Link href="/kits" className="text-sm text-slate-500 hover:text-slate-800">
        ← All kits
      </Link>
      <CompanyBriefSection kitId={id} kit={data.kit} />
      <RoleSection kit={data.kit} />
      <QuestionBank kitId={id} kit={data.kit} />
      <FlashcardsSection kitId={id} kit={data.kit} />
      <ScheduleView kitId={id} kit={data.kit} />
    </div>
  );
}

export default function KitDetailPage() {
  const params = useParams<{ id: string }>();

  return (
    <AuthGuard>
      <KitDetail id={params.id} />
    </AuthGuard>
  );
}
