"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { MessageCircle, Send } from "lucide-react";
import { api } from "../../../convex/_generated/api";

// One room for every channel: everyone watching live TV talks in the same chat.
// Uses the match chat's Convex functions (same limits and sanitising), keyed by this id.
const ROOM = "iptv-global";
const NAME_KEY = "iptv-chat-username";
const MIN_NAME = 3;
const MAX_NAME = 20;
const MAX_MESSAGE = 200;

// The server only accepts #rrggbb colours
const NAME_COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#14b8a6", "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899"];

function colorFor(name: string) {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return NAME_COLORS[hash % NAME_COLORS.length];
}

function readName() {
  try {
    return localStorage.getItem(NAME_KEY) || "";
  } catch {
    return "";
  }
}

function writeName(name: string) {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    // storage unavailable: the name lasts until the page is closed
  }
}

/**
 * The live TV chat. Fills its parent's height. `dark` is for the fullscreen player,
 * where it sits on black regardless of the site theme.
 */
export default function IptvChat({ dark = false }: { dark?: boolean }) {
  // Without Convex configured there's no ConvexProvider, so the chat hooks can't run
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
  // Only rendered in the browser (the watch page mounts the chat after checking the screen size)
  const [name, setName] = useState(readName);
  const [nameDraft, setNameDraft] = useState(name);
  const [editingName, setEditingName] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);

  const joined = Boolean(name) && !editingName;
  const messages = useQuery(api.messages.getMessages, { matchId: ROOM, username: name || undefined });
  const send = useMutation(api.messages.sendMessage);

  // Follow new messages, unless the viewer scrolled up to read older ones
  useEffect(() => {
    const list = listRef.current;
    if (list && nearBottom.current) list.scrollTop = list.scrollHeight;
  }, [messages?.length, joined]);

  const muted = dark ? "rgba(248, 250, 252, 0.6)" : "var(--text-muted)";
  const fieldStyle = dark
    ? { backgroundColor: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: "#f8fafc" }
    : { backgroundColor: "var(--surface-secondary)", border: "1px solid var(--border-primary)", color: "var(--text-primary)" };

  function join(e: FormEvent) {
    e.preventDefault();
    const trimmed = nameDraft.trim().slice(0, MAX_NAME);
    if (trimmed.length < MIN_NAME) return;
    writeName(trimmed);
    setName(trimmed);
    setEditingName(false);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setError("");
    try {
      await send({ matchId: ROOM, username: name, message: text, color: colorFor(name) });
      setDraft("");
      nearBottom.current = true;
    } catch (err) {
      setError(err instanceof ConvexError ? String(err.data) : "Couldn't send. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <ChatFrame dark={dark}>
      <div className="flex items-center gap-2 border-b px-3 py-2.5" style={{ borderColor: dark ? "rgba(255,255,255,0.12)" : "var(--border-secondary)" }}>
        <MessageCircle className="h-4 w-4 text-red-500" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold leading-tight" style={{ color: dark ? "#f8fafc" : "var(--text-primary)" }}>Live chat</p>
          <p className="truncate text-[11px]" style={{ color: muted }}>Everyone watching, on every channel</p>
        </div>
        {joined && (
          <button
            type="button"
            onClick={() => setEditingName(true)}
            className="max-w-[40%] truncate text-xs font-semibold hover:underline"
            style={{ color: colorFor(name) }}
            title="Change your name"
          >
            {name}
          </button>
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

      <div className="border-t p-2" style={{ borderColor: dark ? "rgba(255,255,255,0.12)" : "var(--border-secondary)" }}>
        {!joined ? (
          <form onSubmit={join} className="flex gap-2">
            <input
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              maxLength={MAX_NAME}
              placeholder="Pick a name to chat"
              aria-label="Your chat name"
              className="h-9 min-w-0 flex-1 rounded-lg px-3 text-sm outline-none focus:ring-2 focus:ring-red-500"
              style={fieldStyle}
            />
            <button
              type="submit"
              disabled={nameDraft.trim().length < MIN_NAME}
              className="h-9 rounded-lg bg-red-600 px-3 text-sm font-semibold text-white disabled:opacity-40"
            >
              Join
            </button>
          </form>
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
        {!joined && nameDraft.trim().length > 0 && nameDraft.trim().length < MIN_NAME && (
          <p className="mt-1.5 text-xs" style={{ color: muted }}>At least {MIN_NAME} characters</p>
        )}
      </div>
    </ChatFrame>
  );
}
