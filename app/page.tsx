import Image from "next/image";
import LoginForm from "./components/LoginForm";

const accreditedCourses = [
  "First Aid",
  "Leisure & Health",
  "Age Care & Disability",
  "Food Processing",
];

const nonAccreditedCourses = [
  "Cyber Security",
  "Business",
  "Artificial Intelligence",
  "Mental Health",
];

const meetingSteps = [
  "From the Stella College website, click Current Student.",
  "Scroll down to the Book a Meeting section.",
  "Choose the type of meeting that best suits your needs.",
  "Select a date and time that works for you.",
  "You'll receive a confirmation with all the meeting details.",
];

function Star() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 fill-gold" aria-hidden>
      <path d="m12 2 2.9 6.6 7.1.6-5.4 4.7 1.6 7L12 17.3 5.8 20.9l1.6-7L2 9.2l7.1-.6L12 2Z" />
    </svg>
  );
}

function CourseList({ title, items }: { title: string; items: string[] }) {
  return (
    <section>
      <h2 className="text-lg font-semibold leading-snug text-gold sm:text-xl">
        {title}
      </h2>
      <ul className="mt-4 space-y-3">
        {items.map((item) => (
          <li
            key={item}
            className="flex items-center gap-4 text-base font-semibold text-white sm:text-lg"
          >
            <Star />
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}

const contacts = [
  {
    label: "Phone",
    value: "1800 069 877",
    href: "tel:1800069877",
    icon: (
      <path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1L6.6 10.8Z" />
    ),
  },
  {
    label: "Admin Email",
    value: "admin@stellacollege.edu.au",
    href: "mailto:admin@stellacollege.edu.au",
    icon: (
      <path d="M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm0 2v.4l8 5 8-5V7H4Zm16 2.75-8 5-8-5V17h16V9.75Z" />
    ),
  },
  {
    label: "Website",
    value: "www.stellacollege.edu.au",
    href: "https://www.stellacollege.edu.au",
    icon: (
      <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm6.9 6h-2.95a15.6 15.6 0 0 0-1.38-3.56A8 8 0 0 1 18.9 8ZM12 4.04c.83 1.2 1.48 2.53 1.91 3.96h-3.82c.43-1.43 1.08-2.76 1.91-3.96ZM4.26 14a8.2 8.2 0 0 1 0-4h3.38a16.5 16.5 0 0 0 0 4H4.26Zm.82 2h2.95c.32 1.25.78 2.45 1.38 3.56A8 8 0 0 1 5.08 16Zm2.95-8H5.08a8 8 0 0 1 4.33-3.56A15.6 15.6 0 0 0 8.03 8ZM12 19.96A14.1 14.1 0 0 1 10.09 16h3.82A14.1 14.1 0 0 1 12 19.96ZM14.34 14H9.66a14.7 14.7 0 0 1 0-4h4.68a14.7 14.7 0 0 1 0 4Zm.25 5.56c.6-1.11 1.06-2.31 1.38-3.56h2.95a8 8 0 0 1-4.33 3.56ZM16.36 14a16.5 16.5 0 0 0 0-4h3.38a8.2 8.2 0 0 1 0 4h-3.38Z" />
    ),
  },
];

export default function LoginPage() {
  return (
    <main className="relative isolate flex min-h-dvh flex-1 flex-col overflow-hidden bg-navy">
      {/* Background photo + navy wash */}
      <Image
        src="/login-bg.png"
        alt=""
        fill
        preload
        sizes="100vw"
        className="-z-20 object-cover object-[30%_center] lg:object-left"
      />
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(19,32,77,0.7)_0%,rgba(27,42,94,0.9)_35%,#1b2a5e_60%)] lg:bg-[linear-gradient(90deg,rgba(19,32,77,0.3)_0%,rgba(27,42,94,0.45)_35%,rgba(27,42,94,0.92)_66%,#1b2a5e_80%)]" />

      <div className="mx-auto grid w-full max-w-[1600px] flex-1 grid-cols-1 content-start gap-8 px-4 py-8 sm:px-8 sm:py-10 lg:grid-cols-[1fr_minmax(340px,400px)_1fr] lg:content-stretch lg:gap-8 lg:px-10 xl:gap-14">
        {/* Logo + courses (right on desktop, top on mobile) */}
        <aside className="order-1 flex flex-col items-center lg:order-3 lg:items-end lg:pt-6">
          <Image
            src="/stella-logo.png"
            alt="Stella College logo"
            width={400}
            height={207}
            preload
            className="h-auto w-48 sm:w-56 lg:w-64"
          />
          <div className="mt-10 hidden w-full max-w-xs space-y-10 lg:block">
            <CourseList
              title="We Offer Job-ready Courses in Industries"
              items={accreditedCourses}
            />
            <div>
              <CourseList
                title="Non Accredited Courses"
                items={nonAccreditedCourses}
              />
              <p className="mt-5 pl-8 text-sm font-semibold leading-relaxed text-white/90">
                Current students get an additional 20% discount on non
                accredited courses
              </p>
            </div>
          </div>
        </aside>

        {/* Login card */}
        <div className="order-2 flex min-w-0 items-center justify-center">
          <LoginForm />
        </div>

        {/* Student support (left on desktop) */}
        <section className="order-4 min-w-0 max-w-md self-start rounded-2xl border border-white/10 bg-navy-deep/55 p-5 text-sm leading-relaxed text-white backdrop-blur-md sm:p-6 lg:order-1 lg:mt-6 lg:text-[0.8rem]">
          <h2 className="font-semibold text-gold underline underline-offset-2">
            Student Support – We&apos;re Here to Help
          </h2>
          <p className="mt-2 font-medium">
            At Stella College, you never have to face challenges alone. Whether
            you need help with your studies, assessments, placements, student
            services, or simply have a question, our team is here to support
            you every step of the way. We encourage you to book a meeting
            whenever you need assistance—no question is too small.
          </p>
          <h3 className="mt-5 font-semibold text-gold">How to Book a Meeting</h3>
          <ol className="mt-2 list-inside list-decimal space-y-1 font-medium">
            {meetingSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </section>

        {/* Courses on mobile/tablet */}
        <div className="order-3 grid min-w-0 gap-8 rounded-2xl border border-white/10 bg-white/5 p-5 sm:grid-cols-2 sm:p-6 lg:hidden">
          <CourseList
            title="We Offer Job-ready Courses in Industries"
            items={accreditedCourses}
          />
          <div>
            <CourseList
              title="Non Accredited Courses"
              items={nonAccreditedCourses}
            />
            <p className="mt-4 text-sm font-semibold text-white/90">
              Current students get an additional 20% discount on non accredited
              courses
            </p>
          </div>
        </div>
      </div>

      {/* Contact bar */}
      <footer className="mx-auto w-full max-w-[1600px] px-4 pb-8 sm:px-8 lg:px-10 lg:pb-12">
        <ul className="grid gap-5 border-t border-white/15 pt-6 sm:grid-cols-2 lg:flex lg:flex-wrap lg:gap-x-16">
          {contacts.map((c) => (
            <li key={c.label}>
              <a
                href={c.href}
                target={c.href.startsWith("http") ? "_blank" : undefined}
                rel={c.href.startsWith("http") ? "noopener noreferrer" : undefined}
                className="group flex items-center gap-4"
              >
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full border-2 border-white/90 transition group-hover:border-gold sm:h-14 sm:w-14">
                  <svg viewBox="0 0 24 24" className="h-6 w-6 fill-white transition group-hover:fill-gold sm:h-7 sm:w-7" aria-hidden>
                    {c.icon}
                  </svg>
                </span>
                <span className="min-w-0">
                  <span className="block text-lg font-medium text-gold sm:text-xl">
                    {c.label}
                  </span>
                  <span className="block break-all text-base text-white group-hover:underline sm:text-lg xl:text-xl">
                    {c.value}
                  </span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </footer>
    </main>
  );
}
