"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMe } from "@/lib/queries";
import { Spinner } from "@/components/ui/Spinner";

export default function Home() {
  const { data, isPending, isError } = useMe();
  const router = useRouter();

  useEffect(() => {
    if (isPending) return;
    router.replace(isError || !data?.user ? "/login" : "/kits");
  }, [isPending, isError, data, router]);

  return (
    <div className="flex flex-1 items-center justify-center">
      <Spinner size="lg" className="text-slate-400" />
    </div>
  );
}
