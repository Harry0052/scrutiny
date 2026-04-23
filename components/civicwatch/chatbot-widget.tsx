"use client";

import { Loader2, MessageCircle, Send, X } from "lucide-react";
import { useMemo, useState } from "react";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export function ChatbotWidget({ context }: { context: unknown }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: "Ask about this politician, their records, confidence, or evidence sources.",
    },
  ]);

  const latestContext = useMemo(() => context, [context]);

  const sendMessage = async () => {
    const question = input.trim();
    if (!question || loading) {
      return;
    }

    setInput("");
    setLoading(true);
    setMessages((existing) => [...existing, { role: "user", content: question }]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question,
          context: latestContext,
        }),
      });

      const payload = (await response.json()) as { answer?: string; error?: string };
      if (!response.ok || !payload.answer) {
        throw new Error(payload.error || "Chat failed");
      }
      const answer = payload.answer;

      setMessages((existing) => [...existing, { role: "assistant", content: answer }]);
    } catch (error) {
      setMessages((existing) => [
        ...existing,
        {
          role: "assistant",
          content:
            error instanceof Error
              ? `Chat failed: ${error.message}`
              : "Chat failed. Check OPENAI_API_KEY and try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-50">
      {open ? (
        <div className="w-[min(92vw,380px)] rounded-2xl border border-white/15 bg-slate-950/95 shadow-panel backdrop-blur">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <p className="text-sm font-semibold text-white">CivicWatch Chat</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md border border-white/10 p-1 text-slate-300 hover:bg-slate-900"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="max-h-[52vh] space-y-2 overflow-y-auto px-3 py-3">
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`rounded-xl px-3 py-2 text-sm ${
                  message.role === "assistant"
                    ? "border border-white/10 bg-slate-900/70 text-slate-100"
                    : "ml-8 border border-civic-300/25 bg-civic-700/20 text-civic-50"
                }`}
              >
                {message.content}
              </div>
            ))}
            {loading ? (
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-sm text-slate-300">
                <Loader2 className="h-4 w-4 animate-spin" /> Thinking...
              </div>
            ) : null}
          </div>

          <div className="border-t border-white/10 p-3">
            <div className="flex items-center gap-2">
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void sendMessage();
                  }
                }}
                placeholder="Ask a question"
                className="w-full rounded-lg border border-white/15 bg-slate-900/70 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500"
              />
              <button
                type="button"
                onClick={() => {
                  void sendMessage();
                }}
                disabled={loading || !input.trim()}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-civic-300/35 bg-civic-700/25 text-civic-100 disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-full border border-civic-300/35 bg-civic-700/30 px-4 py-2 text-sm font-semibold text-civic-100 shadow-panel"
        >
          <MessageCircle className="h-4 w-4" /> Ask CivicWatch
        </button>
      )}
    </div>
  );
}
