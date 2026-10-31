import { EditIcon } from "./icons";

export default function Notification() {
  return (
    <section>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-ink">Notification</h2>
        <a href="#" className="text-xs text-peach hover:underline">
          View all
        </a>
      </div>

      <div className="relative mt-4 overflow-hidden rounded-xl bg-plum p-4 text-white sm:px-4 sm:py-5">
        {/* Decorative rings */}
        <span className="absolute -bottom-10 -right-6 h-24 w-24 rounded-full border border-white/20" />
        <span className="absolute -bottom-6 -right-2 h-16 w-16 rounded-full border border-white/20" />

        <div className="relative flex gap-4">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-white/20">
            <EditIcon className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-medium sm:text-base">
              Your trainer just assigned you a new assessment
            </p>
            <p className="mt-1 text-[11px] text-white/75">29 Oct 2026 - 10.00 AM</p>
            <button className="mt-3 rounded-md bg-peach px-4 py-1.5 text-[11px] font-medium text-white transition hover:brightness-95">
              View Now
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
