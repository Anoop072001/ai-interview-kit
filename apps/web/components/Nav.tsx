"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMe, useLogout } from "@/lib/queries";
import { Button } from "@/components/ui/Button";

export function Nav() {
  const { data } = useMe();
  const logout = useLogout();
  const router = useRouter();

  if (!data?.user) return null;

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/kits" className="font-semibold text-slate-900">
          AI Interview Prep Kit
        </Link>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-slate-500 sm:inline">{data.user.email}</span>
          <Button
            variant="ghost"
            size="sm"
            loading={logout.isPending}
            onClick={() => logout.mutate(undefined, { onSuccess: () => router.replace("/login") })}
          >
            Log out
          </Button>
        </div>
      </div>
    </header>
  );
}
