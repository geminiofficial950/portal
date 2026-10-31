"use client";

import { useState } from "react";

type Point = { month: string; year: number; value: number };

// Round the axis up to 4 even steps of 1/2/5 × 10ⁿ
function niceTicks(max: number) {
  const raw = Math.max(max, 4) / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? raw;
  return [0, 1, 2, 3, 4].map((i) => Math.round(i * step));
}

export default function EnrolmentChart({ data }: { data: Point[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const ticks = niceTicks(Math.max(...data.map((d) => d.value)));
  const max = ticks[ticks.length - 1];
  const last = data.length - 1;
  const range = data.length ? `${data[0].month} ${data[0].year} – ${data[last].month} ${data[last].year}` : "";

  return (
    <section className="rounded-[1.75rem] border border-ink/5 bg-white p-5 shadow-[0_12px_40px_-16px_rgba(91,63,153,0.15)] sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium text-ink">New enrolments</h2>
          <p className="mt-0.5 text-xs text-ink/50">Students added per month, {range}</p>
        </div>
        <p className="text-right">
          <span className="block text-2xl font-medium text-ink">{total}</span>
          <span className="text-[11px] text-ink/45">in {data.length} months</span>
        </p>
      </div>

      <div className="relative mt-6 h-52 pl-8" aria-hidden>
        {/* Gridlines + y labels */}
        {ticks.map((t) => (
          <div
            key={t}
            className="absolute inset-x-0 flex items-center gap-2"
            style={{ bottom: `${(t / max) * 100}%`, transform: "translateY(50%)" }}
          >
            <span className="w-6 text-right text-[10px] text-ink/35">{t}</span>
            <span className={`h-px flex-1 ${t === 0 ? "bg-ink/15" : "bg-ink/5"}`} />
          </div>
        ))}

        {/* Bars */}
        <div className="absolute inset-y-0 left-8 right-0 flex items-end gap-[2px] px-2 sm:px-4">
          {data.map((d, i) => (
            <div
              key={`${d.year}-${d.month}`}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              className="relative flex h-full flex-1 cursor-default items-end justify-center"
            >
              {(hover === i || (hover === null && i === last)) && (
                <span
                  className={`absolute z-10 -translate-y-2 whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-[11px] text-white shadow-lg ${
                    i === 0 ? "left-0" : i === last ? "right-0" : ""
                  }`}
                  style={{ bottom: `${(d.value / max) * 100}%` }}
                >
                  {d.month}: <b className="font-medium">{d.value}</b> student{d.value === 1 ? "" : "s"}
                </span>
              )}
              <span
                className={`w-full max-w-10 rounded-t-[4px] transition-colors ${
                  hover === null || hover === i ? "bg-plum" : "bg-plum/35"
                }`}
                style={{ height: `${(d.value / max) * 100}%` }}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-2 flex gap-[2px] pl-8 pr-0">
        <div className="flex flex-1 px-2 sm:px-4">
          {data.map((d) => (
            <span key={`${d.year}-${d.month}`} className="flex-1 text-center text-[11px] text-ink/50">
              {d.month}
            </span>
          ))}
        </div>
      </div>

      {/* Table view for screen readers */}
      <table className="sr-only">
        <caption>New students added per month, {range}</caption>
        <thead>
          <tr>
            <th>Month</th>
            <th>Students</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={`${d.year}-${d.month}`}>
              <td>
                {d.month} {d.year}
              </td>
              <td>{d.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
