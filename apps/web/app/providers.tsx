"use client";

import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { onUnauthorized } from "@/lib/api";

function AuthRedirect({ client }: { client: QueryClient }) {
  const router = useRouter();

  useEffect(() => {
    return onUnauthorized(() => {
      client.setQueryData(["me"], null);
      router.replace("/login");
    });
  }, [router, client]);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 5_000 } } })
  );

  return (
    <QueryClientProvider client={client}>
      <AuthRedirect client={client} />
      {children}
    </QueryClientProvider>
  );
}
