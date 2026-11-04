import Image from "next/image";
import LoginForm from "./components/LoginForm";

const PHONE = "1800 069 877";
const EMAIL = "admin@stellacollege.edu.au";

function PhoneIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M5 4h3l2 5-2.5 1.5a11 11 0 0 0 6 6L15 14l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />
    </svg>
  );
}

function MailIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  );
}

// Dotted texture used in the page corners
const dots = "bg-[radial-gradient(rgba(255,255,255,0.18)_1.5px,transparent_1.6px)] [background-size:14px_14px]";

// Login: navy page with a pink wave; a card split into a blue photo panel (curved edge) and the sign-in form
export default function LoginPage() {
  return (
    <main className="relative isolate flex min-h-dvh flex-1 items-center justify-center overflow-hidden bg-[#3b4a7b] px-4 py-10 text-ink sm:px-8">
      {/* background: pink wave on the right, dotted corners */}
      <div aria-hidden className="absolute -right-[18%] -top-[10%] -z-10 h-[125%] w-[62%] animate-blob rounded-[45%_0_0_55%/50%_0_0_50%] bg-[#ff6f97]" />
      <div aria-hidden className={`absolute left-6 top-6 -z-10 h-40 w-40 animate-drift ${dots}`} />
      <div aria-hidden className={`absolute bottom-6 right-6 -z-10 h-40 w-40 animate-drift ${dots}`} />

      <div className="relative grid w-full max-w-[1240px] animate-card-in overflow-hidden rounded-[2.25rem] lg:min-h-[660px] bg-[linear-gradient(160deg,#7cc0ff_0%,#5a8cf7_55%,#4a6cf6_100%)] shadow-[0_40px_90px_-30px_rgba(10,16,40,0.7)] lg:grid-cols-2">
        {/* the light corner revealed under the blue panel's rounded bottom-right */}
        <div aria-hidden className="absolute bottom-0 left-1/2 hidden h-28 w-28 -translate-x-full bg-[#eef3fb] lg:block" />

        {/* left: blue panel with the photo */}
        <section
          aria-hidden
          className="relative z-10 hidden flex-col bg-[linear-gradient(160deg,#7cc0ff_0%,#5a8cf7_55%,#4a6cf6_100%)] px-12 pb-10 pt-11 text-white lg:flex lg:rounded-br-[7rem]"
        >
          <div className="flex animate-fade-up items-center [animation-delay:0.3s]">
            <Image src="/stella-logo.png" alt="" width={400} height={207} preload className="h-20 w-auto" />
          </div>

          {/* our photo, shown whole; the brand shapes sit behind it and peek out at the edges */}
          <div className="relative mx-auto mt-8 h-[460px] w-[460px] max-w-full">
            {/* shapes float on their own beats behind the photo */}
            <span aria-hidden className="absolute left-0 top-4 h-7 w-7 animate-float-soft rounded-full bg-[#ff7aa5] [animation-duration:4s]" />
            <span aria-hidden className="absolute -left-6 bottom-14 h-8 w-[230px] -rotate-[38deg] animate-float-soft rounded-full bg-[#fdcf7e] [animation-delay:-2s] [animation-duration:7s]" />
            <span aria-hidden className="absolute -left-2 bottom-2 h-8 w-[150px] -rotate-[38deg] animate-float-soft rounded-full bg-[#ff7aa5] [animation-delay:-4s] [animation-duration:5s]" />
            <span aria-hidden className="absolute -right-6 top-16 h-8 w-[200px] -rotate-[38deg] animate-float-soft rounded-full bg-[#ff9fbd] [animation-delay:-1s] [animation-duration:6s]" />
            <span aria-hidden className="absolute -right-5 bottom-24 h-[190px] w-[95px] animate-float-soft rounded-r-full border-[26px] border-l-0 border-[#8fa6ff]/70 [animation-delay:-3s] [animation-duration:8s]" />
            {/* the photo card: slow 3D sway, colour-shifting glow and a light sweep across it */}
            <div className="absolute inset-[30px] animate-tilt">
              <div className="relative h-full w-full animate-glow overflow-hidden rounded-[2rem]">
                <Image
                  src="/login-hero.png"
                  alt="A Stella College graduate as a nurse, a mother, an aged care support worker, a professional and a graduate"
                  fill
                  preload
                  sizes="400px"
                  className="object-cover"
                />
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-y-0 left-0 w-1/3 animate-shine bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.45),transparent)]"
                />
              </div>
            </div>
          </div>

          <p className="mt-auto pt-10 text-center text-xs font-medium text-white">© Stella College. All rights reserved.</p>
        </section>

        {/* right: sign-in */}
        <section
          aria-labelledby="login-heading"
          className="relative flex flex-col items-center justify-center bg-[#eef3fb] px-5 py-14 sm:px-12 lg:rounded-tl-[7rem]"
        >
          <Image src="/stella-logo.png" alt="Stella College" width={400} height={207} className="mb-6 h-16 w-auto lg:hidden" />

          <div className="w-full max-w-[380px] animate-slide-in [animation-delay:0.25s]">
            <div className="rounded-t-2xl bg-[#f6f6f8] px-9 pb-0 pt-5 shadow-[0_10px_30px_-18px_rgba(59,74,123,0.45)]">
              <h1 id="login-heading" className="inline-block border-b-[3px] border-[#4a6cf6] pb-2.5 text-xl font-semibold text-[#2c3550]">
                Sign In
              </h1>
            </div>
            <div className="-mt-1 rounded-2xl bg-white px-9 pb-8 pt-8 shadow-[0_20px_40px_-20px_rgba(59,74,123,0.45)]">
              <LoginForm />
            </div>
          </div>

          <div className="mt-10 flex animate-fade-up flex-wrap items-center justify-center gap-x-8 gap-y-2 text-sm font-medium text-[#2c3550] [animation-delay:0.6s]">
            <a href="tel:1800069877" className="flex items-center gap-2 hover:text-[#4a6cf6]">
              <PhoneIcon className="h-4 w-4 text-[#4a6cf6]" />
              {PHONE}
            </a>
            <a href={`mailto:${EMAIL}`} className="flex items-center gap-2 hover:text-[#4a6cf6]">
              <MailIcon className="h-4 w-4 text-[#4a6cf6]" />
              {EMAIL}
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}
