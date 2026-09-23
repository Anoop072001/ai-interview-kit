"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { PracticeSession } from "@/components/practice/PracticeSession";

export default function PracticePage() {
  const params = useParams<{ id: string }>();

  return (
    <AuthGuard>
      <div className="flex flex-1 flex-col">
        <div className="mx-auto w-full max-w-xl px-4 pt-6 sm:px-6">
          <Link href={`/kits/${params.id}`} className="text-sm text-slate-500 hover:text-slate-800">
            ← Back to kit
          </Link>
        </div>
        <PracticeSession kitId={params.id} />
      </div>
    </AuthGuard>
  );
}
