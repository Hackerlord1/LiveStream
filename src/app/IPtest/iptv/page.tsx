"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  ChevronDown,
  Clock,
  KeyRound,
  Loader2,
  PlayCircle,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { IPTV_API_URL } from "@/lib/iptv-client";

// The admin diagnostics token is the stream server's DEBUG_TOKEN. Kept in sessionStorage
// so it clears when the tab closes, and sent as a header so it never lands in a URL or log.
const TOKEN_KEY = "bravestream:debug-token";

// MACs must be six colon-separated hex pairs, e.g. 00:1A:79:AA:BB:CC
const MAC_RE = /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/;

interface Account {
  status: string | null;
  isTrial: boolean;
  maxConnections: number | null;
  activeConnections: number | null;
  expiresAt: string | null;
  daysLeft: number | null;
  createdAt: string | null;
}

interface Catalog {
  channels: number | null;
  movies: number | null;
  series: number | null;
  radio: number | null;
}

interface Categories {
  channels: string[] | null;
  movies: string[] | null;
  series: string[] | null;
}

interface MacResult {
  index: number;
  mac: string;
  portal: "ok" | "failed";
  streamLink: "ok" | "failed";
  streamLinkError?: string;
  account?: Account;
  accountError?: string;
  catalog?: Catalog;
  categories?: Categories;
  error?: string;
  blocked?: boolean;
}

interface Meta {
  portalUrl: string;
  apiPath: string;
  total: number;
  checkedAt: string;
}

export default function AdminIptvPage() {
  const [token, setToken] = useState<string | null>(null);
  const [tokenInput, setTokenInput] = useState("");

  const [portalUrl, setPortalUrl] = useState("");
  const [macsText, setMacsText] = useState("");

  const [meta, setMeta] = useState<Meta | null>(null);
  const [results, setResults] = useState<MacResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Confirms the token is valid (and diagnostics enabled) without returning any real data.
  const verifyToken = useCallback(async (t: string) => {
    const res = await fetch(`${IPTV_API_URL}/debug/iptv/config`, { cache: "no-store", headers: { "X-Debug-Token": t } });
    if (res.status === 404) throw new Error("Wrong token, or diagnostics are disabled on the server (no DEBUG_TOKEN set).");
    if (!res.ok) throw new Error(`Server returned ${res.status}`);
  }, []);

  // On mount, pick up a token saved earlier this tab and verify it. Read after mount
  // (not a lazy initializer) so the server and first client render agree.
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = sessionStorage.getItem(TOKEN_KEY);
    } catch {}
    if (saved) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time pickup of a stored token
      setToken(saved);
      verifyToken(saved).catch((err) => setError(err instanceof Error ? err.message : "Couldn't verify token"));
    }
  }, [verifyToken]);

  function saveToken(e: React.FormEvent) {
    e.preventDefault();
    const t = tokenInput.trim();
    if (!t) return;
    setError(null);
    verifyToken(t)
      .then(() => {
        try {
          sessionStorage.setItem(TOKEN_KEY, t);
        } catch {}
        setToken(t);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't verify token"));
  }

  function signOut() {
    abortRef.current?.abort();
    try {
      sessionStorage.removeItem(TOKEN_KEY);
    } catch {}
    setToken(null);
    setResults([]);
    setMeta(null);
    setError(null);
    setTokenInput("");
  }

  const parsedMacs = macsText.split(/[\s,]+/).map((m) => m.trim()).filter(Boolean);
  const invalidMacs = parsedMacs.filter((m) => !MAC_RE.test(m));

  async function runTest() {
    if (!token || parsedMacs.length === 0) return;
    if (invalidMacs.length > 0) {
      setError(`Invalid MAC: ${invalidMacs[0]} — use the format XX:XX:XX:XX:XX:XX`);
      return;
    }
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    setError(null);
    setResults([]);
    setMeta(null);
    try {
      const res = await fetch(`${IPTV_API_URL}/debug/iptv/test`, {
        method: "POST",
        signal: ac.signal,
        headers: { "X-Debug-Token": token, "Content-Type": "application/json" },
        body: JSON.stringify({ portalUrl: portalUrl.trim(), macs: parsedMacs }),
      });
      if (res.status === 404) throw new Error("Wrong token, or diagnostics are disabled on the server.");
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || `Server returned ${res.status}`);
      }
      if (!res.body) throw new Error("Streaming isn't supported by this browser.");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl;
        while ((nl = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line) continue;
          const msg = JSON.parse(line);
          if (msg.type === "meta") setMeta(msg as Meta);
          else if (msg.type === "result") setResults((r) => [...r, msg as MacResult].sort((a, b) => a.index - b.index));
          else if (msg.type === "error") setError(msg.error);
        }
      }
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        setError(err instanceof Error ? err.message : "Test failed");
      }
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <Shell>
        <form onSubmit={saveToken} className="mx-auto mt-10 w-full max-w-sm rounded-2xl p-6" style={card}>
          <div className="mb-4 flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-red-500" />
            <h1 className="text-lg font-bold">Admin access</h1>
          </div>
          <p className="mb-4 text-sm" style={{ color: "var(--text-muted)" }}>
            Enter the diagnostics token (the stream server&apos;s <code>DEBUG_TOKEN</code>).
          </p>
          <input
            type="password"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder="Diagnostics token"
            autoFocus
            className="w-full rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-red-600/40"
            style={inputStyle}
          />
          {error && <p className="mt-3 text-sm" style={{ color: "var(--brand-red)" }}>{error}</p>}
          <button type="submit" className="mt-4 w-full rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700">
            Open diagnostics
          </button>
        </form>
      </Shell>
    );
  }

  const done = results.length;
  const total = meta?.total ?? parsedMacs.length;

  return (
    <Shell wide>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-red-500" />
          <h1 className="text-xl font-bold">IPTV portal tester</h1>
        </div>
        <button type="button" onClick={signOut} className="rounded-xl px-3 py-2 text-sm font-semibold" style={card}>
          Sign out
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        {/* LEFT: the form */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-2xl p-4" style={card}>
            <label className="block text-sm">
              <span className="mb-1 block font-semibold" style={{ color: "var(--text-muted)" }}>Portal URL</span>
              <input value={portalUrl} onChange={(e) => setPortalUrl(e.target.value)} placeholder="http://portal.example.com" className="w-full rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-600/40" style={inputStyle} />
            </label>
            <label className="mt-3 block text-sm">
              <span className="mb-1 block font-semibold" style={{ color: "var(--text-muted)" }}>
                MACs — one per line ({parsedMacs.length})
              </span>
              <textarea
                value={macsText}
                onChange={(e) => setMacsText(e.target.value)}
                rows={8}
                placeholder={"00:1A:79:XX:XX:XX\n00:1A:79:XX:XX:XX"}
                className="w-full rounded-xl px-3 py-2 font-mono text-xs outline-none focus:ring-2 focus:ring-red-600/40"
                style={inputStyle}
              />
            </label>
            {invalidMacs.length > 0 && (
              <p className="mt-2 text-xs" style={{ color: "var(--brand-red)" }}>
                Invalid MAC: {invalidMacs[0]} — use the format XX:XX:XX:XX:XX:XX
              </p>
            )}
            <button
              type="button"
              onClick={runTest}
              disabled={loading || parsedMacs.length === 0 || invalidMacs.length > 0}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
              {loading ? `Testing ${done}/${total}…` : `Test ${parsedMacs.length} MAC${parsedMacs.length === 1 ? "" : "s"}`}
            </button>
            <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
              Each MAC opens a brief portal session.
            </p>
          </div>
        </div>

        {/* RIGHT: results, filling in live */}
        <div className="min-w-0">
          {error && (
            <div className="mb-4 flex items-start gap-2 rounded-2xl p-3 text-sm" style={{ backgroundColor: "var(--error-bg)", color: "var(--error-text)", border: "1px solid var(--brand-red)" }}>
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {meta && (
            <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs" style={{ color: "var(--text-muted)" }}>
              <span className="break-all" style={{ color: "var(--text-primary)" }}>{meta.portalUrl}/{meta.apiPath}</span>
              <span>{done}/{meta.total} tested</span>
              <span>{new Date(meta.checkedAt).toLocaleTimeString()}</span>
            </div>
          )}

          {!meta && !error && !loading && (
            <div className="flex min-h-[40vh] items-center justify-center text-sm" style={{ color: "var(--text-muted)" }}>
              Results appear here as each MAC is tested.
            </div>
          )}

          <div className="space-y-2">
            {results.map((mac) => (
              <MacRow key={mac.mac} mac={mac} />
            ))}
            {loading && done < total && (
              <div className="flex items-center gap-2 px-1 py-2 text-xs" style={{ color: "var(--text-muted)" }}>
                <Loader2 className="h-3.5 w-3.5 animate-spin text-red-500" />
                Testing the rest…
              </div>
            )}
          </div>
        </div>
      </div>
    </Shell>
  );
}

function MacRow({ mac }: { mac: MacResult }) {
  const working = mac.portal === "ok" && mac.streamLink === "ok" && !mac.error;
  const accentColor = mac.blocked ? "#f59e0b" : working ? "var(--border-secondary)" : "var(--brand-red)";
  return (
    <div className="rounded-xl p-3 text-sm" style={{ ...card, borderColor: accentColor }}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {mac.blocked ? (
          <Ban className="h-4 w-4 flex-shrink-0 text-amber-500" />
        ) : working ? (
          <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-green-500" />
        ) : (
          <XCircle className="h-4 w-4 flex-shrink-0 text-red-500" />
        )}
        <span className="break-all font-mono text-xs font-semibold">{mac.mac}</span>
        {mac.blocked && (
          <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide" style={{ backgroundColor: "rgba(245,158,11,0.15)", color: "#f59e0b" }}>
            Blocked
          </span>
        )}
        {mac.account && <AccountLine account={mac.account} />}
      </div>

      {mac.catalog && (mac.catalog.channels != null || mac.catalog.movies != null) && (
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 pl-7 text-xs" style={{ color: "var(--text-muted)" }}>
          <Count label="ch" value={mac.catalog.channels} />
          <Count label="movies" value={mac.catalog.movies} />
          <Count label="series" value={mac.catalog.series} />
          <Count label="radio" value={mac.catalog.radio} />
        </div>
      )}

      {(mac.error || mac.streamLinkError || mac.accountError) && !mac.blocked && (
        <p className="mt-1.5 pl-7 text-xs" style={{ color: "var(--brand-red)" }}>
          {mac.error || mac.streamLinkError || mac.accountError}
        </p>
      )}

      {mac.categories && <CategoriesPanel categories={mac.categories} />}
    </div>
  );
}

function CategoriesPanel({ categories }: { categories: Categories }) {
  const [open, setOpen] = useState(false);
  const groups: { label: string; items: string[] | null }[] = [
    { label: "Live", items: categories.channels },
    { label: "VOD", items: categories.movies },
    { label: "Series", items: categories.series },
  ];
  const total = groups.reduce((n, g) => n + (g.items?.length || 0), 0);
  if (total === 0) return null;

  return (
    <div className="mt-2 pl-7">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 text-xs font-semibold"
        style={{ color: "var(--text-muted)" }}
        aria-expanded={open}
      >
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
        {open ? "Hide" : "Show"} categories ({total})
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          {groups.map((g) =>
            g.items && g.items.length > 0 ? (
              <div key={g.label}>
                <p className="mb-1 text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                  {g.label} ({g.items.length})
                </p>
                <div className="flex flex-wrap gap-1">
                  {g.items.map((name, i) => (
                    <span
                      key={`${name}-${i}`}
                      className="rounded px-1.5 py-0.5 text-[11px]"
                      style={{ backgroundColor: "var(--surface-secondary)", color: "var(--text-secondary)" }}
                    >
                      {name}
                    </span>
                  ))}
                </div>
              </div>
            ) : null,
          )}
        </div>
      )}
    </div>
  );
}

function AccountLine({ account }: { account: Account }) {
  const active = (account.status || "").toLowerCase() === "active";
  const expired = account.daysLeft != null && account.daysLeft < 0;
  const soon = account.daysLeft != null && account.daysLeft >= 0 && account.daysLeft <= 7;
  const expiryColor = expired ? "var(--brand-red)" : soon ? "#f59e0b" : "var(--text-muted)";
  return (
    <span className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
      <span className="font-semibold" style={{ color: active ? "#22c55e" : "var(--brand-red)" }}>
        {account.status || "unknown"}{account.isTrial ? " · trial" : ""}
      </span>
      <span className="flex items-center gap-1" style={{ color: expiryColor }}>
        <Clock className="h-3 w-3" />
        {account.expiresAt ? new Date(account.expiresAt).toLocaleDateString() : "never"}
        {account.daysLeft != null && ` (${expired ? `${Math.abs(account.daysLeft)}d ago` : `${account.daysLeft}d`})`}
      </span>
      <span style={{ color: "var(--text-muted)" }}>{account.activeConnections ?? "?"}/{account.maxConnections ?? "?"} conns</span>
    </span>
  );
}

function Count({ label, value }: { label: string; value: number | null }) {
  if (value == null) return null;
  return (
    <span>
      <span className="font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>{value.toLocaleString()}</span> {label}
    </span>
  );
}

const card: React.CSSProperties = {
  backgroundColor: "var(--surface-primary)",
  border: "1px solid var(--border-secondary)",
  color: "var(--text-primary)",
};

const inputStyle: React.CSSProperties = {
  backgroundColor: "var(--input-bg)",
  border: "1px solid var(--input-border)",
  color: "var(--input-text)",
};

function Shell({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <main className={`mx-auto min-h-screen w-full px-4 py-8 ${wide ? "max-w-6xl" : "max-w-4xl"}`} style={{ color: "var(--text-primary)" }}>
      {children}
    </main>
  );
}
