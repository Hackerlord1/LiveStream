"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { ConvexError } from "convex/values";
import { MessageCircle, Send } from "lucide-react";
import { api } from "../../../convex/_generated/api";

// One room for every channel: everyone watching live TV talks in the same chat.
// Anyone can read it; posting needs a Google sign-in (the name comes from the account).
const ROOM = "iptv-global";
const MAX_MESSAGE = 200;

// The server only accepts #rrggbb colours
const NAME_COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#14b8a6", "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899"];

function colorFor(name: string) {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return NAME_COLORS[hash % NAME_COLORS.length];
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.3a12 12 0 0 0 0 10.8l4-3.1z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9z" />
    </svg>
  );
}

/**
 * The live TV chat. Fills its parent's height. `dark` is for the fullscreen player,
 * where it sits on black regardless of the site theme.
 */
export default function IptvChat({ dark = false }: { dark?: boolean }) {
  // Without Convex configured there's no provider, so the chat hooks can't run
  if (!process.env.NEXT_PUBLIC_CONVEX_URL) {
    return (
      <ChatFrame dark={dark}>
        <p className="m-auto px-4 text-center text-sm opacity-70">Chat is unavailable right now.</p>
      </ChatFrame>
    );
  }
  return <ChatRoom dark={dark} />;
}

function ChatFrame({ dark, children }: { dark: boolean; children: React.ReactNode }) {
  return (
    <div
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl"
      style={
        dark
          ? { backgroundColor: "rgba(15, 23, 42, 0.94)", color: "#f8fafc" }
          : { backgroundColor: "var(--surface-primary)", border: "1px solid var(--border-secondary)", color: "var(--text-primary)" }
      }
    >
      {children}
    </div>
  );
}

function ChatRoom({ dark }: { dark: boolean }) {
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const { signIn, signOut } = useAuthActions();
  const viewer = useQuery(api.messages.viewer);
  const name = isAuthenticated ? viewer?.name : undefined;

  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);

  const messages = useQuery(api.messages.getMessages, { matchId: ROOM, username: name });
  const send = useMutation(api.messages.sendSignedIn);

  // Follow new messages, unless the viewer scrolled up to read older ones
  useEffect(() => {
    const list = listRef.current;
    if (list && nearBottom.current) list.scrollTop = list.scrollHeight;
  }, [messages?.length, isAuthenticated]);

  const muted = dark ? "rgba(248, 250, 252, 0.6)" : "var(--text-muted)";
  const border = dark ? "rgba(255,255,255,0.12)" : "var(--border-secondary)";
  const fieldStyle = dark
    ? { backgroundColor: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: "#f8fafc" }
    : { backgroundColor: "var(--surface-secondary)", border: "1px solid var(--border-primary)", color: "var(--text-primary)" };

  async function submit(e: FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || sending || !name) return;
    setSending(true);
    setError("");
    try {
      await send({ matchId: ROOM, message: text, color: colorFor(name) });
      setDraft("");
      nearBottom.current = true;
    } catch (err) {
      setError(err instanceof ConvexError ? String(err.data) : "Couldn't send. Please try again.");
    } finally {
      setSending(false);
    }
  }

  function signInWithGoogle() {
    setError("");
    // Back to this same page (and channel) after Google
    signIn("google", { redirectTo: window.location.href }).catch(() => setError("Couldn't start Google sign-in. Please try again."));
  }

  return (
    <ChatFrame dark={dark}>
      <div className="flex items-center gap-2 border-b px-3 py-2.5" style={{ borderColor: border }}>
        <MessageCircle className="h-4 w-4 text-red-500" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold leading-tight" style={{ color: dark ? "#f8fafc" : "var(--text-primary)" }}>Live chat</p>
          <p className="truncate text-[11px]" style={{ color: muted }}>Everyone watching, on every channel</p>
        </div>
        {name && (
          <div className="flex min-w-0 max-w-[45%] flex-col items-end">
            <span className="max-w-full truncate text-xs font-semibold" style={{ color: colorFor(name) }}>{name}</span>
            <button type="button" onClick={() => void signOut()} className="text-[11px] hover:underline" style={{ color: muted }}>
              Sign out
            </button>
          </div>
        )}
      </div>

      <div
        ref={listRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
        }}
        className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain px-3 py-2"
        aria-live="polite"
      >
        {messages === undefined ? (
          <p className="py-6 text-center text-sm" style={{ color: muted }}>Loading chat…</p>
        ) : messages.length === 0 ? (
          <p className="py-6 text-center text-sm" style={{ color: muted }}>No messages yet. Say hello!</p>
        ) : (
          messages.map((m) => (
            <p key={String(m._id)} className="break-words text-sm leading-snug">
              <span className="mr-1.5 font-semibold" style={{ color: m.color || colorFor(m.username) }}>
                {m.isAdmin ? "⭐ " : ""}{m.username}
              </span>
              <span style={m.isSystem ? { color: muted } : undefined}>{m.message}</span>
            </p>
          ))
        )}
      </div>

      <div className="border-t p-2" style={{ borderColor: border }}>
        {authLoading || (isAuthenticated && viewer === undefined) ? (
          <p className="py-2 text-center text-xs" style={{ color: muted }}>Checking sign-in…</p>
        ) : !name ? (
          <button
            type="button"
            onClick={signInWithGoogle}
            className="flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-white text-sm font-semibold text-gray-800 shadow-sm ring-1 ring-black/10 hover:bg-gray-50"
          >
            <GoogleMark /> Sign in with Google to chat
          </button>
        ) : (
          <form onSubmit={submit} className="flex gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={MAX_MESSAGE}
              placeholder="Say something…"
              aria-label="Message"
              className="h-9 min-w-0 flex-1 rounded-lg px-3 text-sm outline-none focus:ring-2 focus:ring-red-500"
              style={fieldStyle}
            />
            <button
              type="submit"
              disabled={!draft.trim() || sending}
              aria-label="Send"
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-red-600 text-white disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        )}
        {error && <p className="mt-1.5 text-xs text-red-500">{error}</p>}
      </div>
    </ChatFrame>
  );
}
