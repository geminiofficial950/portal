import Link from "next/link";
import { ArrowRightIcon, HeadsetIcon, MailIcon, PhoneIcon } from "./icons";

const contacts = [
  {
    title: "Administration",
    description: "Enrolment, documents & payments",
    value: "admin@stellacollege.edu.au",
    href: "mailto:admin@stellacollege.edu.au",
    icon: MailIcon,
    surface: "bg-[#d6e0fc]",
    accent: "bg-[#334a94]",
  },
  {
    title: "Student support",
    description: "Study & portal assistance",
    value: "support@stellacollege.edu.au",
    href: "mailto:support@stellacollege.edu.au",
    icon: HeadsetIcon,
    surface: "bg-[#ead9f7]",
    accent: "bg-[#693d8d]",
  },
  {
    title: "Call us",
    description: "Speak with our team",
    value: "1800 069 877",
    href: "tel:1800069877",
    icon: PhoneIcon,
    surface: "bg-[#ffcfaa]",
    accent: "bg-[#9b460c]",
  },
];

export default function SupportHub() {
  return (
    <section aria-labelledby="support-hub-heading" className="@container rounded-[1.75rem] bg-[#171d24] p-4 text-white">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
        <div className="flex items-center gap-3">
          <HeadsetIcon className="size-7 shrink-0" />
          <div className="border-l border-white/30 pl-3">
            <h2 id="support-hub-heading" className="text-xl font-bold leading-tight">Stella Support Hub</h2>
            <p className="mt-1 text-sm leading-snug">A little help, whenever you need it.</p>
          </div>
        </div>
        <Link
          href="/dashboard/tickets"
          className="inline-flex items-center gap-2 rounded-full border border-white/60 px-3 py-1.5 text-sm font-bold transition-colors hover:bg-white/15"
        >
          Raise a request
          <ArrowRightIcon className="size-4 -rotate-45" />
        </Link>
      </div>

      <ul className="grid gap-2.5 @[34rem]:grid-cols-3">
        {contacts.map(({ title, description, value, href, icon: Icon, surface, accent }) => (
          <li key={title} className="min-w-0">
            <a href={href} className={`@container group flex h-full flex-col items-start rounded-2xl p-3 text-[#172027] transition-shadow hover:shadow-[inset_0_0_0_2px_#17202740] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${surface}`}>
              <span className="flex w-full items-start justify-between gap-2">
                <Icon className="size-6" />
                <span className={`grid size-7 shrink-0 place-items-center rounded-full text-white ${accent}`}>
                  <ArrowRightIcon className="size-4 -rotate-45" />
                </span>
              </span>
              <h3 className="mt-2 text-lg font-bold leading-tight">{title}</h3>
              <p className="mt-1 text-sm font-semibold leading-snug">{description}</p>
              <span className={`mt-auto max-w-full pt-2 font-bold group-hover:underline ${href.startsWith("tel:") ? "text-2xl leading-tight tabular-nums" : "text-[clamp(1rem,6.6cqi,1.5rem)] leading-tight"}`}>
                {/* an email wraps after "@" (never mid-word); its size follows the card's width, up to the phone number's */}
                {href.startsWith("mailto:") ? (
                  <>
                    {value.split("@")[0]}@<wbr />
                    {value.split("@")[1]}
                  </>
                ) : (
                  value
                )}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
