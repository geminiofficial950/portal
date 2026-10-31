"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ChatIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  MailIcon,
  PhoneIcon,
  TicketIcon,
} from "../_components/icons";

const faqs = [
  {
    q: "How do I reset my portal password?",
    a: "Use Forgot Password on the login screen. A reset link is sent to your Stella College email within a few minutes.",
  },
  {
    q: "Who do I contact for assessment extensions?",
    a: "Raise an Assessment ticket with your reason and supporting documents, or message your trainer from the Course page.",
  },
  {
    q: "What are support hours?",
    a: "Student Services is available Mon–Fri, 9:00 AM – 5:00 PM AEST. Urgent technical tickets are monitored on weekdays.",
  },
  {
    q: "Can I talk to someone one-to-one?",
    a: "Yes. Raise a ticket or visit Student Services on campus during Mon–Fri, 9:00 AM – 5:00 PM AEST.",
  },
];

export default function SupportPage() {
  const [openFaq, setOpenFaq] = useState(0);

  return (
    <div className="animate-fade-up grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(260px,340px)] lg:gap-10">
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-medium text-ink sm:text-[1.65rem]">Support</h1>
          <p className="mt-1 text-sm text-ink/55">
            We’re here to help with enrolment, assessments, and portal access.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {[
            {
              icon: MailIcon,
              title: "Email",
              value: "support@stellacollege.edu.au",
              href: "mailto:support@stellacollege.edu.au",
            },
            {
              icon: PhoneIcon,
              title: "Phone",
              value: "1300 STELLA",
              href: "tel:1300783552",
            },
            {
              icon: TicketIcon,
              title: "Tickets",
              value: "Create a request",
              href: "/dashboard/tickets",
            },
          ].map(({ icon: Icon, title, value, href }) => (
            <Link
              key={title}
              href={href}
              className="rounded-[1.5rem] bg-lilac/80 p-5 transition hover:bg-lilac"
            >
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-white text-plum">
                <Icon className="h-5 w-5" />
              </span>
              <p className="mt-4 text-sm font-medium text-ink">{title}</p>
              <p className="mt-1 text-xs text-ink/55">{value}</p>
            </Link>
          ))}
        </div>

        <section>
          <h2 className="text-lg font-medium text-ink">Frequently asked</h2>
          <ul className="mt-4 space-y-2 rounded-[2rem] bg-lilac/70 p-3 sm:p-4">
            {faqs.map((faq, i) => {
              const open = openFaq === i;
              return (
                <li key={faq.q}>
                  <button
                    onClick={() => setOpenFaq(open ? -1 : i)}
                    className={`flex w-full items-center justify-between gap-3 rounded-2xl px-5 py-4 text-left transition ${
                      open ? "bg-plum text-white" : "bg-white/70 text-ink hover:bg-white"
                    }`}
                  >
                    <span className="text-sm font-medium">{faq.q}</span>
                    {open ? (
                      <ChevronUpIcon className="h-4 w-4 shrink-0" />
                    ) : (
                      <ChevronDownIcon className="h-4 w-4 shrink-0" />
                    )}
                  </button>
                  {open && (
                    <p className="px-5 pb-4 pt-2 text-xs leading-relaxed text-ink/60">{faq.a}</p>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        <form
          onSubmit={(e) => e.preventDefault()}
          className="rounded-[1.75rem] bg-[#ffe8d6] p-5 sm:p-6"
        >
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/80 text-plum">
              <ChatIcon className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-medium text-ink">Send a message</h2>
              <p className="text-xs text-ink/55">We usually reply within one business day.</p>
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <input
              required
              placeholder="Your name"
              className="rounded-xl bg-white px-4 py-2.5 text-sm text-ink outline-none ring-1 ring-ink/5 placeholder:text-ink/35 focus:ring-plum/30"
            />
            <input
              required
              type="email"
              placeholder="Email"
              className="rounded-xl bg-white px-4 py-2.5 text-sm text-ink outline-none ring-1 ring-ink/5 placeholder:text-ink/35 focus:ring-plum/30"
            />
          </div>
          <textarea
            required
            rows={4}
            placeholder="How can we help?"
            className="mt-3 w-full resize-none rounded-xl bg-white px-4 py-2.5 text-sm text-ink outline-none ring-1 ring-ink/5 placeholder:text-ink/35 focus:ring-plum/30"
          />
          <button
            type="submit"
            className="mt-4 rounded-full bg-plum px-6 py-2.5 text-sm font-medium text-white transition hover:bg-plum-light"
          >
            Send Message
          </button>
        </form>
      </div>

      <aside className="relative overflow-hidden rounded-[1.75rem] bg-plum px-5 pb-8 pt-6 text-white self-start">
        <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full border border-white/15" />
        <div className="absolute -bottom-10 -left-6 h-24 w-24 rounded-full border border-white/10" />

        <div className="relative rounded-2xl bg-[#ffe8d6] p-4 text-ink">
          <p className="text-[11px] font-medium uppercase tracking-wide text-ink/45">Campus help</p>
          <h2 className="mt-1 text-base font-medium">Student Services Desk</h2>
          <p className="mt-1 text-xs text-ink/55">Mon–Fri · 9:00 AM – 5:00 PM</p>
        </div>

        <div className="relative mt-6 space-y-4 text-sm">
          <p className="leading-relaxed text-white/80">
            Need help with enrolment, timetable changes, or assessments? Raise a ticket or
            visit Student Services on campus.
          </p>
          <ul className="space-y-2 text-xs text-white/70">
            <li>· Mon–Fri · 9:00 AM – 5:00 PM</li>
            <li>· Online tickets or on-campus desk</li>
            <li>· Bring your student ID on campus</li>
          </ul>
        </div>

        <Link
          href="/dashboard/tickets"
          className="relative mt-8 flex w-full items-center justify-center gap-2 rounded-full border border-white/25 px-5 py-3 text-sm font-medium text-white transition hover:bg-white/10"
        >
          Open Tickets
        </Link>
      </aside>
    </div>
  );
}
