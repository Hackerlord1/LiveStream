"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, RefreshCw, Search, X } from "lucide-react";
import Header from "@/components/Header";
import type { CatalogueStatus } from "@/hooks/use-catalogue";
import { formatCount } from "@/lib/iptv-format";

// ============================================================
// PAGE SHELL
// ============================================================

interface IptvPageProps {
  title: string;
  icon?: ReactNode;
  /** Shown next to the title, e.g. "5,708 channels" */
  subtitle?: string;
  backHref?: string;
  /** Content under the title row (search, filters) */
  toolbar?: ReactNode;
  children: ReactNode;
  /** Fill the viewport and let children manage their own scrolling (virtual grids) */
  fullHeight?: boolean;
}

export function IptvPage({ title, icon, subtitle, backHref = "/iptv", toolbar, children, fullHeight }: IptvPageProps) {
  return (
    <div
      className={fullHeight ? "h-dvh flex flex-col overflow-hidden" : "min-h-screen"}
      style={{ backgroundColor: "var(--neu-bg-page)", color: "var(--text-primary)" }}
    >
      <Header />
      <div className="flex-shrink-0 px-4 pt-4 pb-3 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="flex items-center gap-3">
            <Link
              href={backHref}
              aria-label="Back"
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full transition-colors hover:opacity-80"
              style={{ backgroundColor: "var(--surface-primary)", border: "1px solid var(--border-primary)", color: "var(--text-secondary)" }}
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            {icon && (
              <span
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-white"
                style={{ backgroundColor: "var(--brand-red)" }}
              >
                {icon}
              </span>
            )}
            <div className="min-w-0">
              <h1 className="truncate text-xl font-bold leading-tight sm:text-2xl">{title}</h1>
              {subtitle && (
                <p className="text-xs sm:text-sm" style={{ color: "var(--text-muted)" }}>
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          {toolbar && <div className="mt-4 space-y-3">{toolbar}</div>}
        </div>
      </div>
      <div className={fullHeight ? "flex-1 min-h-0 px-2 pb-4 sm:px-4" : "px-4 pb-10 sm:px-6"}>
        <div className={`mx-auto max-w-7xl ${fullHeight ? "h-full" : ""}`}>{children}</div>
      </div>
    </div>
  );
}

// ============================================================
// SEARCH
// ============================================================

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl py-2.5 pl-10 pr-10 text-sm outline-none transition-shadow focus:ring-2 focus:ring-red-600/40 [&::-webkit-search-cancel-button]:hidden"
        style={{ backgroundColor: "var(--input-bg)", border: "1px solid var(--input-border)", color: "var(--input-text)" }}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute right-2.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full hover:opacity-70"
          style={{ color: "var(--text-muted)" }}
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

// ============================================================
// FILTER CHIPS
// ============================================================

export interface ChipOption {
  id: string;
  label: string;
  count?: number;
}

export function FilterChips({ options, value, onChange }: { options: ChipOption[]; value: string; onChange: (id: string) => void }) {
  return (
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" style={{ scrollbarWidth: "none" }}>
      {options.map((opt) => {
        const active = opt.id === value;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className="flex-shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors"
            style={
              active
                ? { backgroundColor: "var(--brand-red)", color: "#fff", border: "1px solid var(--brand-red)" }
                : { backgroundColor: "var(--surface-primary)", color: "var(--text-secondary)", border: "1px solid var(--border-primary)" }
            }
          >
            {opt.label}
            {opt.count !== undefined && <span className="ml-1.5 opacity-70">{formatCount(opt.count)}</span>}
          </button>
        );
      })}
    </div>
  );
}

// ============================================================
// FIRST-LOAD PROGRESS
// ============================================================

/** Shown only while the server builds a catalogue for the first time. */
export function LoadProgress({ status, noun }: { status: CatalogueStatus | null; noun: string }) {
  if (!status || status.ready) return null;
  const percent = status.total > 0 ? Math.min(100, Math.round((status.loaded / status.total) * 100)) : 0;
  return (
    <div
      className="rounded-xl px-4 py-3"
      style={{ backgroundColor: "var(--info-bg)", color: "var(--info-text)", border: "1px solid var(--border-secondary)" }}
      role="status"
    >
      <div className="flex items-center justify-between gap-3 text-xs font-medium sm:text-sm">
        <span className="flex items-center gap-2">
          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          Loading {noun}… more appear as they arrive
        </span>
        {status.total > 0 && (
          <span className="tabular-nums">
            {formatCount(status.loaded)} / {formatCount(status.total)}
          </span>
        )}
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: "var(--surface-tertiary)" }}>
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${percent}%`, backgroundColor: "var(--info-text)" }} />
      </div>
    </div>
  );
}

// ============================================================
// SKELETONS / EMPTY / ERROR
// ============================================================

export function SkeletonGrid({ variant, count = 18 }: { variant: "poster" | "tile"; count?: number }) {
  return (
    <div
      className={
        variant === "poster"
          ? "grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
          : "grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8"
      }
      aria-hidden
    >
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="animate-pulse overflow-hidden rounded-xl" style={{ backgroundColor: "var(--surface-primary)" }}>
          <div className={variant === "poster" ? "aspect-[2/3]" : "aspect-[4/3]"} style={{ backgroundColor: "var(--surface-tertiary)" }} />
          <div className="space-y-1.5 p-2.5">
            <div className="h-2.5 w-4/5 rounded" style={{ backgroundColor: "var(--surface-tertiary)" }} />
            <div className="h-2 w-1/2 rounded" style={{ backgroundColor: "var(--surface-tertiary)" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ icon, title, message, action }: { icon: ReactNode; title: string; message?: string; action?: ReactNode }) {
  return (
    <div className="flex h-full min-h-[40vh] flex-col items-center justify-center px-6 text-center">
      <div
        className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
        style={{ backgroundColor: "var(--surface-primary)", color: "var(--text-muted)", border: "1px solid var(--border-primary)" }}
      >
        {icon}
      </div>
      <h2 className="text-base font-semibold">{title}</h2>
      {message && (
        <p className="mt-1 max-w-sm text-sm" style={{ color: "var(--text-muted)" }}>
          {message}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function RetryButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
      style={{ backgroundColor: "var(--brand-red)" }}
    >
      <RefreshCw className="h-4 w-4" /> Try again
    </button>
  );
}

// ============================================================
// QUALITY PICKER
// ============================================================

export interface QualityOption {
  value: string;
  label: string;
}

/** Row of quality chips shown under a player. `note` explains the current state (e.g. "Auto · 480p"). */
export function QualityPicker({ options, value, onChange, note }: {
  options: QualityOption[];
  value: string;
  onChange: (value: string) => void;
  note?: string;
}) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
        Quality
      </span>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={active}
            className="rounded-full px-3 py-1 text-xs font-semibold transition-colors"
            style={
              active
                ? { backgroundColor: "var(--brand-red)", color: "#fff", border: "1px solid var(--brand-red)" }
                : { backgroundColor: "var(--surface-primary)", color: "var(--text-secondary)", border: "1px solid var(--border-primary)" }
            }
          >
            {opt.label}
          </button>
        );
      })}
      {note && (
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          {note}
        </span>
      )}
    </div>
  );
}

export function Badge({ children, tone = "dark" }: { children: ReactNode; tone?: "dark" | "red" | "gold" }) {
  const styles = {
    dark: "bg-black/70 text-white",
    red: "bg-red-600 text-white",
    gold: "bg-black/70 text-yellow-400",
  } as const;
  return <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold leading-none backdrop-blur-sm ${styles[tone]}`}>{children}</span>;
}
