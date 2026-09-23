"use client";

import Link from "next/link";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { useKits } from "@/lib/queries";
import { KitCard } from "@/components/kits/KitCard";
import { Spinner } from "@/components/ui/Spinner";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";

function KitsDashboard() {
  const { data, isPending, isError, refetch } = useKits();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Your prep kits</h1>
        <Link href="/kits/new">
          <Button>New kit</Button>
        </Link>
      </div>

      {isPending && (
        <div className="flex justify-center py-16">
          <Spinner size="lg" className="text-slate-400" />
        </div>
      )}

      {isError && <ErrorBanner message="Could not load your kits." onRetry={() => refetch()} />}

      {data && data.kits.length === 0 && (
        <EmptyState
          title="No kits yet"
          description="Paste a job description and a company URL to generate your first interview prep kit."
          action={
            <Link href="/kits/new">
              <Button>Create your first kit</Button>
            </Link>
          }
        />
      )}

      {data && data.kits.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.kits.map((kit) => (
            <KitCard key={kit.id} kit={kit} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function KitsPage() {
  return (
    <AuthGuard>
      <KitsDashboard />
    </AuthGuard>
  );
}
