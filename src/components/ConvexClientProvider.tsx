"use client";

import { ReactNode, useMemo } from "react";
import { ConvexReactClient } from "convex/react";
// Convex plus Google sign-in (the live TV chat); also handles the ?code= on the way back from Google
import { ConvexAuthProvider } from "@convex-dev/auth/react";

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
    <ConvexAuthProvider client={convex}>
      {children}
    </ConvexAuthProvider>
  );
}