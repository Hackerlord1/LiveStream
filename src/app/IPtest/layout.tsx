import type { Metadata } from "next";

// Admin tools are token-gated and must never be indexed or followed
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
