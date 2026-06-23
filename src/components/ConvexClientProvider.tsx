"use client";

import { ReactNode, useMemo } from "react";
import { ConvexProvider, ConvexReactClient } from "convex/react";

export default function ConvexClientProvider({
  children,
}: {
  children: ReactNode;
}) {
  const convex = useMemo(() => {
    // Prevent crash if env is missing during build
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;

    if (!url) {
      console.warn("Convex URL is missing");
      return null;
    }

    return new ConvexReactClient(url);
  }, []);

  // If convex is not ready, just render children safely
  if (!convex) {
    return <>{children}</>;
  }

  return (
    <ConvexProvider client={convex}>
      {children}
    </ConvexProvider>
  );
}