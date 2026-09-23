"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMe } from "@/lib/queries";
import { Spinner } from "@/components/ui/Spinner";

/** Wraps any page that requires a signed-in user. Auth can only be checked
 * client-side here: the session cookie belongs to the API's own origin, so
 * Next.js server-side middleware on the frontend's domain never sees it. */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { data, isPending, isError } = useMe();
  const router = useRouter();
  const signedOut = isError || (data && !data.user);

  useEffect(() => {
    if (signedOut) router.replace("/login");
  }, [signedOut, router]);

  if (isPending) {
    return (
      <div className="flex flex-1 items-center justify-center py-24">
        <Spinner size="lg" className="text-slate-400" />
      </div>
    );
  }

  if (signedOut) return null;

  return <>{children}</>;
}
