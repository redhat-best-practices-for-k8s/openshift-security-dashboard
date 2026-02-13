"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { kindToRoute } from "./resource-link";

/**
 * Global listener that catches `navigate-to-resource` custom events
 * and navigates to the appropriate page with ?open=name&ns=namespace params.
 * Mount once in the root layout.
 */
export function ResourceNavigator() {
  const router = useRouter();

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as {
        kind: string;
        name: string;
        namespace?: string;
      };
      if (!detail?.kind || !detail?.name) return;

      const route = kindToRoute[detail.kind] || "/";
      const params = new URLSearchParams();
      params.set("open", detail.name);
      if (detail.namespace) params.set("ns", detail.namespace);
      // Also pass kind so pages with mixed resource types can distinguish
      params.set("kind", detail.kind);

      router.push(`${route}?${params.toString()}`);
    };

    window.addEventListener("navigate-to-resource", handler);
    return () => window.removeEventListener("navigate-to-resource", handler);
  }, [router]);

  return null;
}
