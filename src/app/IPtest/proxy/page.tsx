"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Globe,
  KeyRound,
  Loader2,
  PlayCircle,
  ShieldAlert,
  Square,
  Upload,
  XCircle,
} from "lucide-react";
import { IPTV_API_URL } from "@/lib/iptv-client";

// Same admin token as the IPTV tester (the stream server's DEBUG_TOKEN), per-tab only
const TOKEN_KEY = "bravestream:debug-token";
// MoreLogin imports at most this many proxies at a time
const BATCH_SIZE = 100;
const ROW_HEIGHT = 44;

type Protocol = "auto" | "http" | "https" | "socks5" | "socks4";
type Filter = "working" | "failed" | "all";

interface ProxyResult {
  index: number;
  raw: string;
  ok: boolean;
  protocol?: string;
  exitIp?: string;
  latencyMs?: number;
  export?: string;
  error?: string;
  invalid?: boolean;
  hasAuth?: boolean;
  /** Works, but swaps in its own HTTPS certificate (reads/alters encrypted traffic) */
  intercepted?: boolean;
}

interface Geo {
  country?: string;
  countryCode?: string;
  city?: string;
  isp?: string;
}

interface Meta {
  total: number;
  truncated: boolean;
  maxProxies: number;
  checkedAt: string;
}

export default function ProxyCheckerPage() {
  const [token, setToken] = useState<string | null>(null);
  const [tokenInput, setTokenInput] = useState("");

  const [proxiesText, setProxiesText] = useState("");
  const [protocol, setProtocol] = useState<Protocol>("auto");
  const [timeoutSec, setTimeoutSec] = useState(10);
  const [concurrency, setConcurrency] = useState(200);
  const [lookupGeo, setLookupGeo] = useState(true);

  const [meta, setMeta] = useState<Meta | null>(null);
  const [results, setResults] = useState<ProxyResult[]>([]);
  const [geo, setGeo] = useState<Record<string, Geo>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [finishedAt, setFinishedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const abortRef = useRef<AbortController | null>(null);

  const [filter, setFilter] = useState<Filter>("working");
  const [country, setCountry] = useState("all");
  const [batch, setBatch] = useState(0);
  const [includeIntercepted, setIncludeIntercepted] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const verifyToken = useCallback(async (t: string) => {
    const res = await fetch(`${IPTV_API_URL}/debug/iptv/config`, { cache: "no-store", headers: { "X-Debug-Token": t } });
    if (res.status === 404) throw new Error("Wrong token, or diagnostics are disabled on the server (no DEBUG_TOKEN set).");
    if (!res.ok) throw new Error(`Server returned ${res.status}`);
  }, []);

  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = sessionStorage.getItem(TOKEN_KEY);
    } catch {}
    if (saved) {
      setToken(saved);
      verifyToken(saved).catch((err) => setError(err instanceof Error ? err.message : "Couldn't verify token"));
    }
  }, [verifyToken]);

  // Ticks the elapsed/ETA readout while a run is going
  useEffect(() => {
    if (!loading) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [loading]);

  // Stop the server-side run if the page is closed mid-test
  useEffect(() => () => abortRef.current?.abort(), []);

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

  const lines = useMemo(
    () => proxiesText.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#")),
    [proxiesText],
  );
  const uniqueCount = useMemo(() => new Set(lines).size, [lines]);

  async function loadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const text = await file.text();
    setProxiesText((prev) => (prev.trim() ? `${prev.trimEnd()}\n${text}` : text));
  }

  function stop() {
    abortRef.current?.abort();
    setLoading(false);
    setFinishedAt(Date.now());
  }

  async function runTest() {
    if (!token || lines.length === 0) return;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    setError(null);
    setResults([]);
    setGeo({});
    setMeta(null);
    setBatch(0);
    setCountry("all");
    setStartedAt(Date.now());
    setFinishedAt(null);
    setNow(Date.now());

    // Results arrive hundreds per second; collect them here and push to state a few
    // times a second instead of re-rendering on every line
    const collected: ProxyResult[] = [];
    let dirty = false;
    const flush = setInterval(() => {
      if (dirty) {
        dirty = false;
        setResults(collected.slice());
      }
    }, 300);

    try {
      const res = await fetch(`${IPTV_API_URL}/debug/proxy/test`, {
        method: "POST",
        signal: ac.signal,
        headers: { "X-Debug-Token": token, "Content-Type": "application/json" },
        body: JSON.stringify({ proxies: lines, protocol, timeoutMs: timeoutSec * 1000, concurrency, geo: lookupGeo }),
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
          if (msg.type === "result") {
            collected.push(msg as ProxyResult);
            dirty = true;
          } else if (msg.type === "geo") setGeo((g) => ({ ...g, ...msg.ips }));
          else if (msg.type === "meta") setMeta(msg as Meta);
          else if (msg.type === "error") setError(msg.error);
        }
      }
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        setError(err instanceof Error ? err.message : "Test failed");
      }
    } finally {
      clearInterval(flush);
      setResults(collected.slice());
      setLoading(false);
      setFinishedAt((f) => f ?? Date.now());
    }
  }

  // ---- Derived views ----
  const working = useMemo(() => results.filter((r) => r.ok).sort((a, b) => (a.latencyMs ?? 0) - (b.latencyMs ?? 0)), [results]);
  const failed = useMemo(() => results.filter((r) => !r.ok).sort((a, b) => a.index - b.index), [results]);

  const countries = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of working) {
      const c = (r.exitIp && geo[r.exitIp]?.country) || "Unknown";
      counts.set(c, (counts.get(c) || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [working, geo]);

  const failureReasons = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of failed) counts.set(r.error || "failed", (counts.get(r.error || "failed") || 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [failed]);

  const interceptedCount = useMemo(() => working.filter((r) => r.intercepted).length, [working]);

  // What gets exported: working proxies in the chosen country, fastest first. Proxies that
  // intercept HTTPS stay out unless asked for — they can read logins and cookies.
  const exportable = useMemo(
    () =>
      working.filter(
        (r) =>
          (includeIntercepted || !r.intercepted) &&
          (country === "all" || ((r.exitIp && geo[r.exitIp]?.country) || "Unknown") === country),
      ),
    [working, geo, country, includeIntercepted],
  );
  const batchCount = Math.max(1, Math.ceil(exportable.length / BATCH_SIZE));
  const currentBatch = Math.min(batch, batchCount - 1);
  const batchLines = exportable.slice(currentBatch * BATCH_SIZE, (currentBatch + 1) * BATCH_SIZE).map((r) => r.export || r.raw);

  // "All" shows everything, including intercepting proxies left out of the export
  const visible = filter === "working" ? exportable : filter === "failed" ? failed : [...working, ...failed];

  function flash(msg: string) {
    setNotice(msg);
    setTimeout(() => setNotice((n) => (n === msg ? null : n)), 2500);
  }

  async function copyBatch() {
    if (batchLines.length === 0) return;
    try {
      await navigator.clipboard.writeText(batchLines.join("\n"));
      const from = currentBatch * BATCH_SIZE + 1;
      flash(`Copied ${from}–${from + batchLines.length - 1} — paste into MoreLogin`);
      if (currentBatch < batchCount - 1) setBatch(currentBatch + 1);
    } catch {
      flash("Couldn't copy — use Download instead");
    }
  }

  function saveText(kind: string, text: string) {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${kind}${country === "all" ? "" : `-${country.replace(/\W+/g, "_")}`}-${exportable.length}.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  /** Import-ready list: one proxy per line, nothing else (pastes straight into MoreLogin). */
  function downloadAll() {
    if (exportable.length === 0) return;
    saveText("working-proxies", exportable.map((r) => r.export || r.raw).join("\n") + "\n");
  }

  /** Readable report: each working proxy with its location, exit IP, ISP and speed. */
  function downloadWithLocations() {
    if (exportable.length === 0) return;
    const rows = exportable.map((r) => {
      const g = r.exitIp ? geo[r.exitIp] : undefined;
      const place = g?.country ? `${g.country}${g.countryCode ? ` (${g.countryCode})` : ""}` : "Unknown";
      const cols = [
        r.export || r.raw,
        place,
        g?.city || "-",
        r.exitIp || "-",
        g?.isp || "-",
        r.latencyMs != null ? `${(r.latencyMs / 1000).toFixed(1)}s` : "-",
      ];
      if (r.intercepted) cols.push("WARNING: intercepts HTTPS");
      return cols.join(" | ");
    });
    const header = [
      `# Working proxies — ${new Date().toLocaleString()} — ${exportable.length} prox${exportable.length === 1 ? "y" : "ies"}${country === "all" ? "" : ` in ${country}`}`,
      "# proxy | country | city | exit IP | ISP | speed",
    ];
    saveText("working-proxies-locations", [...header, ...rows].join("\n") + "\n");
  }

  // ---- Virtualized list ----
  const listRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Virtual is not compiler-compatible
  const virtualizer = useVirtualizer({
    count: visible.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

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
            Open proxy checker
          </button>
        </form>
      </Shell>
    );
  }

  const done = results.length;
  const total = meta?.total ?? uniqueCount;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const elapsedSec = startedAt ? Math.max(0, Math.round(((finishedAt ?? now) - startedAt) / 1000)) : 0;
  const rate = elapsedSec > 0 ? done / elapsedSec : 0;
  const etaSec = loading && rate > 0 ? Math.round((total - done) / rate) : null;

  return (
    <Shell wide>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Globe className="h-6 w-6 text-red-500" />
          <h1 className="text-xl font-bold">Proxy checker</h1>
        </div>
        <button type="button" onClick={signOut} className="rounded-xl px-3 py-2 text-sm font-semibold" style={card}>
          Sign out
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        {/* LEFT: the form */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-2xl p-4" style={card}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="font-semibold" style={{ color: "var(--text-muted)" }}>
                Proxies — one per line ({uniqueCount.toLocaleString()}
                {uniqueCount !== lines.length ? `, ${(lines.length - uniqueCount).toLocaleString()} dupes skipped` : ""})
              </span>
              <label className="inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-red-500 hover:underline">
                <Upload className="h-3.5 w-3.5" /> .txt
                <input type="file" accept=".txt,.csv,text/plain" onChange={loadFile} className="hidden" />
              </label>
            </div>
            <textarea
              value={proxiesText}
              onChange={(e) => setProxiesText(e.target.value)}
              rows={10}
              spellCheck={false}
              placeholder={"23.27.93.170:5749\nsocks5://1.2.3.4:1080:user:pass\nhttp://user:pass@1.2.3.4:8080"}
              className="w-full rounded-xl px-3 py-2 font-mono text-xs outline-none focus:ring-2 focus:ring-red-600/40"
              style={inputStyle}
            />

            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <Select label="Protocol" value={protocol} onChange={(v) => setProtocol(v as Protocol)} options={[["auto", "Auto-detect"], ["http", "HTTP"], ["https", "HTTPS"], ["socks5", "SOCKS5"], ["socks4", "SOCKS4"]]} />
              <Select label="Timeout" value={String(timeoutSec)} onChange={(v) => setTimeoutSec(Number(v))} options={[["5", "5 s"], ["10", "10 s"], ["15", "15 s"], ["20", "20 s"]]} />
              <Select label="Parallel" value={String(concurrency)} onChange={(v) => setConcurrency(Number(v))} options={[["50", "50"], ["100", "100"], ["200", "200"], ["300", "300"]]} />
              <label className="flex items-end gap-2 pb-2 text-xs" style={{ color: "var(--text-muted)" }}>
                <input type="checkbox" checked={lookupGeo} onChange={(e) => setLookupGeo(e.target.checked)} className="accent-red-600" />
                Look up country
              </label>
            </div>

            {loading ? (
              <button type="button" onClick={stop} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold" style={card}>
                <Square className="h-4 w-4" /> Stop ({done.toLocaleString()}/{total.toLocaleString()})
              </button>
            ) : (
              <button
                type="button"
                onClick={runTest}
                disabled={lines.length === 0}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                <PlayCircle className="h-4 w-4" /> Test {uniqueCount.toLocaleString()} prox{uniqueCount === 1 ? "y" : "ies"}
              </button>
            )}
            <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
              Each proxy must open an HTTPS tunnel and return its exit IP. Lines without a type get auto-detected, and the export adds it, since MoreLogin assumes SOCKS5 otherwise.
            </p>
          </div>

          {/* Export, in MoreLogin-sized batches */}
          {working.length > 0 && (
            <div className="mt-4 rounded-2xl p-4" style={card}>
              <p className="mb-2 text-sm font-semibold">Export working</p>
              {countries.length > 1 && (
                <Select
                  label="Country"
                  value={country}
                  onChange={(v) => {
                    setCountry(v);
                    setBatch(0);
                  }}
                  options={[["all", `All countries (${working.length})`], ...countries.map(([c, n]) => [c, `${c} (${n})`] as [string, string])]}
                />
              )}
              {interceptedCount > 0 && (
                <label className="mt-3 flex items-start gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
                  <input
                    type="checkbox"
                    checked={includeIntercepted}
                    onChange={(e) => {
                      setIncludeIntercepted(e.target.checked);
                      setBatch(0);
                    }}
                    className="mt-0.5 accent-amber-500"
                  />
                  <span>
                    Include {interceptedCount.toLocaleString()} that <span className="font-semibold text-amber-500">intercept HTTPS</span> (they fake site certificates and can read logins/cookies)
                  </span>
                </label>
              )}
              <div className="mt-3 flex items-center gap-2">
                <button type="button" onClick={() => setBatch(Math.max(0, currentBatch - 1))} disabled={currentBatch === 0} className="rounded-lg p-2 disabled:opacity-40" style={card} aria-label="Previous batch">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button type="button" onClick={copyBatch} disabled={batchLines.length === 0} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60">
                  <Copy className="h-4 w-4" /> Copy batch {currentBatch + 1}/{batchCount}
                </button>
                <button type="button" onClick={() => setBatch(Math.min(batchCount - 1, currentBatch + 1))} disabled={currentBatch >= batchCount - 1} className="rounded-lg p-2 disabled:opacity-40" style={card} aria-label="Next batch">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              <button type="button" onClick={downloadAll} className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold" style={card}>
                <Download className="h-4 w-4" /> Download all {exportable.length.toLocaleString()} (.txt)
              </button>
              <button type="button" onClick={downloadWithLocations} className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold" style={card}>
                <Globe className="h-4 w-4" /> Download with locations (.txt)
              </button>
              {loading && lookupGeo && (
                <p className="mt-2 text-xs" style={{ color: "#f59e0b" }}>
                  Locations are still loading — download after the run finishes for the full list.
                </p>
              )}
              <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
                Fastest first, {BATCH_SIZE} per batch (MoreLogin&apos;s limit). Copying moves to the next batch. &quot;Download all&quot; is import-ready; &quot;with locations&quot; is a readable report (not for importing).
              </p>
              {notice && <p className="mt-2 text-xs font-semibold text-green-500">{notice}</p>}
            </div>
          )}
        </div>

        {/* RIGHT: progress and results */}
        <div className="min-w-0">
          {error && (
            <div className="mb-4 flex items-start gap-2 rounded-2xl p-3 text-sm" style={{ backgroundColor: "var(--error-bg)", color: "var(--error-text)", border: "1px solid var(--brand-red)" }}>
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {meta?.truncated && (
            <p className="mb-3 text-xs" style={{ color: "#f59e0b" }}>
              Only the first {meta.maxProxies.toLocaleString()} proxies are tested per run.
            </p>
          )}

          {!startedAt && !error && (
            <div className="flex min-h-[40vh] items-center justify-center text-sm" style={{ color: "var(--text-muted)" }}>
              Paste or upload proxies, then test. Results appear here live.
            </div>
          )}

          {startedAt && (
            <>
              <div className="mb-3 rounded-2xl p-4" style={card}>
                <div className="mb-2 flex flex-wrap items-baseline gap-x-5 gap-y-1 text-sm">
                  <Stat label="tested" value={`${done.toLocaleString()} / ${total.toLocaleString()}`} />
                  <Stat label="working" value={working.length.toLocaleString()} color="#22c55e" />
                  {interceptedCount > 0 && <Stat label="intercept HTTPS" value={interceptedCount.toLocaleString()} color="#f59e0b" />}
                  <Stat label="failed" value={failed.length.toLocaleString()} color="var(--brand-red)" />
                  <span className="ml-auto flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
                    {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-red-500" />}
                    {formatDuration(elapsedSec)}
                    {rate > 0 && ` · ${rate.toFixed(rate < 10 ? 1 : 0)}/s`}
                    {etaSec != null && ` · ~${formatDuration(etaSec)} left`}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full" style={{ backgroundColor: "var(--surface-secondary)" }}>
                  <div className="h-full bg-red-600 transition-[width] duration-300" style={{ width: `${pct}%` }} />
                </div>
                {failureReasons.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
                    {failureReasons.slice(0, 8).map(([reason, n]) => (
                      <span key={reason} className="rounded px-1.5 py-0.5" style={{ backgroundColor: "var(--surface-secondary)", color: "var(--text-secondary)" }}>
                        {reason} <span className="font-semibold tabular-nums">{n.toLocaleString()}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="mb-2 flex gap-1">
                {(
                  [
                    ["working", `Working (${exportable.length.toLocaleString()}${interceptedCount && !includeIntercepted ? ` + ${interceptedCount.toLocaleString()} hidden` : ""})`],
                    ["failed", `Failed (${failed.length.toLocaleString()})`],
                    ["all", "All"],
                  ] as [Filter, string][]
                ).map(([f, label]) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => {
                      setFilter(f);
                      listRef.current?.scrollTo({ top: 0 });
                    }}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${filter === f ? "bg-red-600 text-white" : ""}`}
                    style={filter === f ? undefined : card}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div ref={listRef} className="h-[65vh] overflow-auto rounded-2xl" style={card}>
                {visible.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm" style={{ color: "var(--text-muted)" }}>
                    {loading ? "Waiting for results…" : "Nothing here."}
                  </div>
                ) : (
                  <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
                    {virtualizer.getVirtualItems().map((v) => {
                      const r = visible[v.index];
                      return (
                        <div key={r.index} style={{ position: "absolute", top: 0, left: 0, right: 0, height: v.size, transform: `translateY(${v.start}px)` }}>
                          <ProxyRow r={r} geo={r.exitIp ? geo[r.exitIp] : undefined} />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </Shell>
  );
}

function ProxyRow({ r, geo }: { r: ProxyResult; geo?: Geo }) {
  return (
    <div className="flex h-full items-center gap-3 border-b px-3 text-xs" style={{ borderColor: "var(--border-secondary)" }}>
      {r.ok && r.intercepted ? (
        <ShieldAlert className="h-4 w-4 flex-shrink-0 text-amber-500" />
      ) : r.ok ? (
        <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-green-500" />
      ) : (
        <XCircle className="h-4 w-4 flex-shrink-0 text-red-500" />
      )}
      <span className="min-w-0 flex-1 truncate font-mono" title={r.raw}>
        {r.raw}
      </span>
      {r.ok ? (
        <>
          {r.intercepted && (
            <span className="hidden rounded px-1.5 py-0.5 text-[10px] font-bold uppercase sm:inline" style={{ backgroundColor: "rgba(245,158,11,0.15)", color: "#f59e0b" }} title="Works, but swaps in its own HTTPS certificates — it can read and change encrypted traffic">
              Intercepts HTTPS
            </span>
          )}
          <span className="hidden rounded px-1.5 py-0.5 text-[10px] font-bold uppercase sm:inline" style={{ backgroundColor: "var(--surface-secondary)", color: "var(--text-secondary)" }}>
            {r.protocol}
          </span>
          <span className="hidden w-28 truncate font-mono md:inline" style={{ color: "var(--text-muted)" }} title={geo?.isp || r.exitIp}>
            {r.exitIp}
          </span>
          <span className="w-28 truncate" style={{ color: "var(--text-muted)" }} title={[geo?.city, geo?.country, geo?.isp].filter(Boolean).join(" · ")}>
            {geo ? `${flag(geo.countryCode)} ${geo.country ?? ""}` : "…"}
          </span>
          <span className="w-14 text-right font-semibold tabular-nums" style={{ color: latencyColor(r.latencyMs) }}>
            {r.latencyMs != null ? `${(r.latencyMs / 1000).toFixed(1)}s` : ""}
          </span>
        </>
      ) : (
        <span className="max-w-[50%] truncate text-right" style={{ color: "var(--brand-red)" }} title={r.error}>
          {r.error}
        </span>
      )}
    </div>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <label className="block text-xs">
      <span className="mb-1 block font-semibold" style={{ color: "var(--text-muted)" }}>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg px-2 py-1.5 text-sm outline-none" style={inputStyle}>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <span>
      <span className="text-lg font-bold tabular-nums" style={{ color: color || "var(--text-primary)" }}>{value}</span>{" "}
      <span className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</span>
    </span>
  );
}

function flag(code?: string) {
  if (!code || code.length !== 2) return "";
  return String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1a5 + c.charCodeAt(0)));
}

function latencyColor(ms?: number) {
  if (ms == null) return "var(--text-muted)";
  if (ms < 1500) return "#22c55e";
  if (ms < 4000) return "#f59e0b";
  return "var(--brand-red)";
}

function formatDuration(sec: number) {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  return m < 60 ? `${m}m ${sec % 60}s` : `${Math.floor(m / 60)}h ${m % 60}m`;
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
