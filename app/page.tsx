import { Source_Serif_4 } from "next/font/google";
import Image from "next/image";
import LoginForm from "./components/LoginForm";

const serif = Source_Serif_4({ subsets: ["latin"], weight: ["600", "700"] });

const accreditedCourses = ["First Aid", "Leisure & Health", "Age Care & Disability", "Food Processing"];

const nonAccreditedCourses = ["Cyber Security", "Business", "Artificial Intelligence", "Mental Health"];

const meetingSteps = [
  "From the Stella College website, click Current Student.",
  "Scroll down to the Book a Meeting section.",
  "Choose the type of meeting that best suits your needs.",
  "Select a date and time that works for you.",
  "You'll receive a confirmation with all the meeting details.",
];

const WEBSITE = "https://www.stellacollege.edu.au";

function InfoBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-slate-200 py-5 first:border-t-0 first:pt-0 last:pb-0">
      <h3 className="text-[15px] font-semibold text-navy">{title}</h3>
      <div className="mt-2 text-sm leading-relaxed text-slate-600">{children}</div>
    </section>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-[#f2f3f6] text-ink">
      {/* Utility bar */}
      <div className="bg-navy-deep text-xs text-white/80">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-1 px-4 py-2 sm:px-6">
          <p>RTO 41290</p>
          <p className="flex flex-wrap gap-x-5">
            <a href="tel:1800069877" className="hover:text-white">
              1800 069 877
            </a>
            <a href="mailto:admin@stellacollege.edu.au" className="hover:text-white">
              admin@stellacollege.edu.au
            </a>
          </p>
        </div>
      </div>

      {/* Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-4">
            <Image src="/stella-logo.png" alt="Stella College" width={400} height={207} preload className="h-12 w-auto sm:h-14" />
            <span className="hidden h-10 w-px bg-slate-200 sm:block" />
            <span className={`${serif.className} hidden text-lg font-semibold text-navy sm:block`}>Learning Portal</span>
          </div>
          <a href={WEBSITE} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-navy hover:underline">
            College website
          </a>
        </div>
      </header>

      {/* Banner */}
      <div className="relative isolate overflow-hidden bg-navy">
        <Image src="/login-bg.png" alt="" fill preload sizes="100vw" className="-z-20 object-cover object-[50%_22%]" />
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(19,32,77,0.95)_0%,rgba(19,32,77,0.82)_45%,rgba(19,32,77,0.35)_100%)]" />
        <div className="mx-auto max-w-6xl px-4 py-10 text-white sm:px-6 sm:py-14 lg:pb-28">
          <h1 className={`${serif.className} text-3xl font-semibold sm:text-4xl`}>Stella College Learning Portal</h1>
          <p className="mt-2 max-w-lg text-sm text-white/80 sm:text-base">For enrolled students and trainers of Stella College.</p>
        </div>
      </div>

      {/* Login + information */}
      <main className="relative z-10 mx-auto grid w-full max-w-6xl flex-1 items-start gap-6 px-4 py-6 sm:px-6 lg:-mt-20 lg:grid-cols-[400px_minmax(0,1fr)] lg:gap-8 lg:pb-12">
        <section aria-labelledby="login-heading" className="rounded-md border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 id="login-heading" className={`${serif.className} text-xl font-semibold text-navy`}>
              Log in
            </h2>
          </div>
          <div className="px-6 py-5">
            <LoginForm />
          </div>
          <div className="border-t border-slate-200 bg-slate-50 px-6 py-4 text-xs leading-relaxed text-slate-600">
            <p>
              <span className="font-medium text-slate-700">Students:</span> use your Student ID (for example S1001) or email.
            </p>
            <p className="mt-1">
              <span className="font-medium text-slate-700">Trainers:</span> use your Trainer ID or work email.
            </p>
          </div>
        </section>

        <aside className="rounded-md border border-slate-200 bg-white px-6 py-5 shadow-sm lg:mt-20">
          <h2 className={`${serif.className} text-xl font-semibold text-navy`}>Help &amp; information</h2>
          <div className="mt-4">
            <InfoBlock title="Can’t log in?">
              Your login details are issued by the college when you enrol. If you’ve forgotten your password, email{" "}
              <a href="mailto:admin@stellacollege.edu.au" className="text-royal hover:underline">
                admin@stellacollege.edu.au
              </a>{" "}
              or call{" "}
              <a href="tel:1800069877" className="text-royal hover:underline">
                1800 069 877
              </a>
              .
            </InfoBlock>
            <InfoBlock title="Student support — book a meeting">
              <p>
                Whether you need help with your studies, assessments, placements or have a question, our team is here to help. No question is too
                small.
              </p>
              <ol className="mt-2 list-decimal space-y-0.5 pl-5">
                {meetingSteps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </InfoBlock>
            <InfoBlock title="Our courses">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="font-medium text-slate-700">Job-ready accredited courses</p>
                  <ul className="mt-1 list-disc pl-5">
                    {accreditedCourses.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="font-medium text-slate-700">Non-accredited courses</p>
                  <ul className="mt-1 list-disc pl-5">
                    {nonAccreditedCourses.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-slate-500">Current students get an additional 20% discount on non-accredited courses.</p>
                </div>
              </div>
            </InfoBlock>
          </div>
        </aside>
      </main>

      {/* Footer */}
      <footer className="bg-navy-deep text-sm text-white/75">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:grid-cols-3 sm:px-6">
          <div>
            <p className={`${serif.className} text-base font-semibold text-white`}>Stella College</p>
            <p className="mt-1">RTO 41290</p>
          </div>
          <div>
            <p className="font-medium text-white">Contact</p>
            <p className="mt-1">
              <a href="tel:1800069877" className="hover:text-white">
                1800 069 877
              </a>
            </p>
            <p>
              <a href="mailto:admin@stellacollege.edu.au" className="break-all hover:text-white">
                admin@stellacollege.edu.au
              </a>
            </p>
          </div>
          <div>
            <p className="font-medium text-white">Website</p>
            <p className="mt-1">
              <a href={WEBSITE} target="_blank" rel="noopener noreferrer" className="hover:text-white">
                www.stellacollege.edu.au
              </a>
            </p>
          </div>
        </div>
        <div className="border-t border-white/10">
          <p className="mx-auto max-w-6xl px-4 py-4 text-xs text-white/55 sm:px-6">© Stella College. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
