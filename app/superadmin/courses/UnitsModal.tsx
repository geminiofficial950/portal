"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import { ClipboardIcon, CloseIcon, PlusIcon, SearchIcon, TrashIcon } from "../../dashboard/_components/icons";
import type { AssessmentSummary } from "@/lib/assessment-meta";
import type { UnitContentSummary } from "@/lib/unit-content";
import type { CourseDTO, Unit } from "@/lib/courses";
import { addUnitAction, previewUnitRemovalAction, removeUnitAction } from "./actions";

export default function UnitsModal({
  course,
  summaries,
  content,
  onClose,
  onUnitsChange,
  canDelete,
}: {
  canDelete: boolean; // Super Admin only
  course: CourseDTO;
  summaries: Record<string, AssessmentSummary>;
  content: Record<string, UnitContentSummary>;
  onClose: () => void;
  onUnitsChange: (update: (units: Unit[]) => Unit[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState({ code: "", title: "" });
  const [adding, startAdding] = useTransition();
  const [removing, setRemoving] = useState<string | null>(null);

  // Esc closes; lock page scroll behind the dialog
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const q = query.trim().toLowerCase();
  const visible = course.units.filter(
    (u) => !q || u.code.toLowerCase().includes(q) || u.title.toLowerCase().includes(q),
  );

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    startAdding(async () => {
      const res = await addUnitAction(course.code, draft);
      if (!res.ok) return void toast.error(res.error);
      onUnitsChange((units) => [...units, res.unit]);
      setDraft({ code: "", title: "" });
      toast.success(`${res.unit.code} added`);
    });
  };

  const remove = async (unit: Unit) => {
    // affected records first: a unit with any student work or status can't be removed
    const preview = await previewUnitRemovalAction(course.code, unit.code);
    if (!preview.ok) return void toast.error(preview.error);
    const affected = preview.records.filter((r) => r.count);
    if (affected.length) return void toast.error(`${unit.code} has student records (${affected.map((r) => `${r.count} ${r.label}`).join(", ")}), so it can’t be removed.`);
    if (!window.confirm(`Remove ${unit.code} – ${unit.title} from ${course.code}?

No student has work or a status in it. Its overview, resources and modules are deleted.`)) return;
    setRemoving(unit.code);
    try {
      const res = await removeUnitAction(course.code, unit.code);
      if (!res.ok) return void toast.error(res.error);
      onUnitsChange((units) => units.filter((u) => u.code !== unit.code));
      toast.success(`${unit.code} removed`);
    } catch {
      toast.error("Couldn’t remove the unit. Try again.");
    } finally {
      setRemoving(null);
    }
  };

  // Portal out of the page wrapper (its transform animation would trap `fixed` inside it) into the
  // layout root (#portal-root), which carries the theme's text colour and font.
  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex font-dm text-ink items-end justify-center bg-ink/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-6"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="units-title"
        className="animate-fade-up flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[1.75rem] bg-white shadow-2xl sm:max-h-[85dvh] sm:rounded-[1.75rem]"
      >
        <div className="relative bg-plum px-5 pb-5 pt-6 text-white sm:px-7">
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute right-4 top-4 rounded-full p-1.5 text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
          <p className="text-[11px] font-medium uppercase tracking-wide text-peach">
            {course.code}
          </p>
          <h2 id="units-title" className="mt-1 pr-8 text-lg font-medium leading-snug">
            {course.name}
          </h2>
          <p className="mt-1 text-xs text-white/70">
            {course.units.length} units · {course.duration} · {course.category}
          </p>
        </div>

        <div className="border-b border-ink/5 px-5 py-3 sm:px-7">
          <label className="flex items-center gap-2 rounded-full bg-lilac px-4 py-2.5">
            <SearchIcon className="h-4 w-4 text-plum/50" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search units…"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-ink/35"
            />
          </label>
        </div>

        <ol className="soft-scroll min-h-0 flex-1 divide-y divide-ink/5 overflow-y-auto px-5 sm:px-7">
          {visible.map((u) => {
            const n = course.units.indexOf(u) + 1;
            return (
              <li
                key={u.code}
                className={`flex items-center gap-3 py-3 transition ${removing === u.code ? "opacity-40" : ""}`}
              >
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-lilac text-[11px] font-medium text-plum">
                  {n}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-medium text-plum">{u.code}</p>
                  <p className="text-sm leading-snug text-ink">{u.title}</p>
                  {/* What the Super Admin has added so far — students only see the green ones */}
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {(() => {
                      const c = content[`${course.code}/${u.code}`];
                      return (
                        <>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${c?.overviewSnippet ? "bg-emerald-100 text-emerald-700" : "bg-lilac text-ink/40"}`}>
                            Overview
                          </span>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${c?.resources ? "bg-emerald-100 text-emerald-700" : "bg-lilac text-ink/40"}`}>
                            {c?.resources ? `${c.resources} resource${c.resources === 1 ? "" : "s"}` : "Resources"}
                          </span>
                        </>
                      );
                    })()}
                    {(() => {
                      const s = summaries[`${course.code}/${u.code}`];
                      return (
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${s?.modules ? "bg-emerald-100 text-emerald-800" : "bg-lilac text-ink"}`}>
                          {s?.modules ? `${s.modules} module${s.modules === 1 ? "" : "s"} · ${s.marked} marked` : "No modules yet"}
                        </span>
                      );
                    })()}
                  </div>
                </div>
                <Link
                  href={`/superadmin/courses/${encodeURIComponent(course.code)}/${encodeURIComponent(u.code)}`}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-plum px-3 py-1.5 text-[11px] font-medium text-white transition hover:bg-plum-light"
                >
                  <ClipboardIcon className="h-3.5 w-3.5" />
                  Open unit
                </Link>
                {canDelete && (
                  <button
                    onClick={() => remove(u)}
                    disabled={removing !== null}
                    aria-label={`Remove ${u.code}`}
                    className="shrink-0 rounded-full p-2 text-ink transition hover:bg-rose-50 hover:text-rose-600 disabled:cursor-wait"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                )}
              </li>
            );
          })}
          {visible.length === 0 && (
            <li className="py-10 text-center text-sm text-ink/45">
              {course.units.length === 0 ? "No units yet — add the first one below." : "No units match this search."}
            </li>
          )}
        </ol>

        <form
          onSubmit={add}
          className="grid gap-2 border-t border-ink/5 bg-[#faf9fd] px-5 py-4 sm:grid-cols-[9.5rem_1fr_auto] sm:px-7"
        >
          <input
            required
            value={draft.code}
            onChange={(e) => setDraft({ ...draft, code: e.target.value })}
            placeholder="Unit code"
            aria-label="Unit code"
            className="rounded-xl bg-white px-4 py-3 text-sm uppercase outline-none ring-1 ring-ink/5 placeholder:normal-case placeholder:text-ink/35 focus:ring-plum/30"
          />
          <input
            required
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            placeholder="Unit name — e.g. Provide first aid"
            aria-label="Unit name"
            className="rounded-xl bg-white px-4 py-3 text-sm outline-none ring-1 ring-ink/5 placeholder:text-ink/35 focus:ring-plum/30"
          />
          <button
            type="submit"
            disabled={adding}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-plum px-5 py-3 text-sm font-medium text-white transition hover:bg-plum-light disabled:cursor-wait disabled:opacity-60"
          >
            <PlusIcon className="h-4 w-4" />
            {adding ? "Adding…" : "Add unit"}
          </button>
        </form>
      </div>
    </div>,
    document.getElementById("portal-root") ?? document.body,
  );
}
