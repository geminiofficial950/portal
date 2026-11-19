"use client";

import { startTransition, useActionState, useState } from "react";
import type { PromotionFormat, PromotionSummary } from "@/lib/portal-promotions";
import { savePromotionAction } from "./actions";

const inputClass = "mt-1 block w-full rounded-xl border border-ink/20 bg-page px-3 py-2 text-ink";

export default function PromotionForm({ promotion }: { promotion?: PromotionSummary }) {
  const [message, submit, pending] = useActionState(savePromotionAction, "");
  const [format, setFormat] = useState<PromotionFormat>(promotion?.format ?? "text");

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        startTransition(() => submit(data));
      }}
      className="grid gap-4 sm:grid-cols-2"
    >
      <input type="hidden" name="id" value={promotion?.id ?? ""} />
      <label className="text-sm font-semibold">
        Format
        <select name="format" className={inputClass} value={format} onChange={(event) => setFormat(event.target.value as PromotionFormat)}>
          <option value="text">Text banner</option>
          <option value="photo">Photo banner</option>
          <option value="photo-text">Photo and text</option>
        </select>
      </label>
      <label className="text-sm font-semibold">
        Title
        <input className={inputClass} name="title" maxLength={80} defaultValue={promotion?.title} required />
      </label>
      {format !== "photo" && (
        <label className="text-sm font-semibold sm:col-span-2">
          Description
          <textarea className={inputClass} name="description" rows={3} maxLength={300} defaultValue={promotion?.description} required={format === "photo-text"} />
        </label>
      )}
      {format !== "text" && (
        <>
          <label className="text-sm font-semibold">
            {promotion && promotion.format !== "text" ? "Replace photo" : "Photo"} (JPG or PNG, up to 800 KB)
            <input className={inputClass} name="image" type="file" accept="image/png,image/jpeg"
              onChange={(event) => {
                const input = event.currentTarget;
                const file = input.files?.[0];
                input.setCustomValidity(file && file.size > 800 * 1024 ? "Choose an image no larger than 800 KB." : "");
                input.reportValidity();
              }}
              required={!promotion || promotion.format === "text"} />
          </label>
          <label className="text-sm font-semibold">
            Image description
            <input className={inputClass} name="imageAlt" maxLength={160} defaultValue={promotion?.imageAlt} required />
          </label>
        </>
      )}
      <label className="text-sm font-semibold">
        Destination link (optional)
        <input className={inputClass} name="link" type="url" placeholder="https://" maxLength={500} defaultValue={promotion?.link} />
      </label>
      <label className="text-sm font-semibold">
        Button label (optional)
        <input className={inputClass} name="linkLabel" maxLength={40} defaultValue={promotion?.linkLabel} />
      </label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button type="submit" disabled={pending} className="rounded-full bg-plum px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
          {pending ? "Saving..." : promotion ? "Save changes" : "Create draft"}
        </button>
        <p role="status" className="text-sm">{message}</p>
      </div>
    </form>
  );
}
