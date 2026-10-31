"use client";

import { useEffect, useRef, useState } from "react";
import { PaperclipIcon, SendIcon, SmileIcon, UserPlusIcon } from "./icons";

type Message = { id: number; from: string; initials: string; color: string; text: string; time: string; mine?: boolean };

const members = [
  { initials: "JS", color: "bg-sky-400" },
  { initials: "AK", color: "bg-violet-400" },
  { initials: "MR", color: "bg-amber-400" },
];

const initialMessages: Message[] = [
  { id: 1, from: "James", initials: "JS", color: "bg-sky-400", text: "Hey @members, how's the assessment going?", time: "3 minutes ago" },
  { id: 2, from: "You", initials: "ST", color: "bg-peach", text: "I'm preparing for the case study", time: "3 minutes ago", mine: true },
  { id: 3, from: "Aisha", initials: "AK", color: "bg-violet-400", text: "@student, let me know if you need help!", time: "just now" },
];

export default function TeamChat() {
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    setMessages((m) => [
      ...m,
      { id: Date.now(), from: "You", initials: "ST", color: "bg-peach", text, time: "just now", mine: true },
    ]);
    setDraft("");
  };

  return (
    <section id="team-chat" className="flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-medium text-ink">Team Chat</h2>
          <div className="flex -space-x-1.5">
            {members.map((p) => (
              <span
                key={p.initials}
                className={`grid h-7 w-7 place-items-center rounded-full ${p.color} text-[10px] font-bold text-white ring-2 ring-white`}
              >
                {p.initials}
              </span>
            ))}
          </div>
          <span className="text-[10px] text-ink/50">+17</span>
        </div>
        <button className="flex items-center gap-2 rounded-md bg-plum px-3 py-2 text-[11px] text-white transition hover:bg-plum-light">
          <UserPlusIcon className="h-3.5 w-3.5" />
          Invite People
        </button>
      </div>

      <div className="mt-5 flex flex-col rounded-lg bg-lilac/70 p-4 shadow-[0_4px_24px_-8px_rgba(91,63,153,0.15)]">
        <div ref={listRef} className="soft-scroll max-h-72 space-y-4 overflow-y-auto">
          {messages.map((msg) =>
            msg.mine ? (
              <div key={msg.id} className="flex flex-col items-end">
                <p className="max-w-[80%] rounded-md bg-plum/10 px-3 py-2 text-xs text-ink">{msg.text}</p>
                <span className="mt-1 text-[9px] text-ink/40">{msg.time}</span>
              </div>
            ) : (
              <div key={msg.id} className="flex gap-3">
                <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-md ${msg.color} text-[10px] font-bold text-white`}>
                  {msg.initials}
                </span>
                <div>
                  <p className="max-w-[260px] rounded-md bg-white px-3 py-2 text-xs leading-relaxed text-ink shadow-sm">
                    {msg.text}
                  </p>
                  <span className="mt-1 block text-[9px] text-ink/40">{msg.time}</span>
                </div>
              </div>
            ),
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="mt-4 flex items-center gap-3 rounded-md bg-white px-3 py-2 shadow-sm"
        >
          <PaperclipIcon className="h-4 w-4 shrink-0 text-ink/40" />
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Type a message..."
            className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-ink/40"
          />
          <SmileIcon className="h-4 w-4 shrink-0 text-ink/40" />
          <button type="submit" aria-label="Send" className="text-plum transition hover:scale-110">
            <SendIcon className="h-4 w-4" />
          </button>
        </form>
      </div>
    </section>
  );
}
