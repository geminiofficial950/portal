import Image from "next/image";
import { requireAdmin } from "@/lib/auth";
import { listPromotions, MAX_VISIBLE_PROMOTIONS } from "@/lib/portal-promotions";
import PromotionForm from "./PromotionForm";
import { setPromotionActiveAction } from "./actions";

const formats = { text: "Text banner", photo: "Photo banner", "photo-text": "Photo and text" };

export default async function PromotionsPage() {
  await requireAdmin();
  const promotions = await listPromotions();
  const visible = new Set(promotions.filter(({ active }) => active).slice(0, MAX_VISIBLE_PROMOTIONS).map(({ id }) => id));

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Promotions</h1>
        <p className="mt-1 text-sm text-ink/75">The four newest published banners appear below Notifications on the student dashboard.</p>
      </div>
      <section className="space-y-4 rounded-3xl border border-ink/10 bg-page p-5">
        <h2 className="text-xl font-semibold">New promotion</h2>
        <PromotionForm />
      </section>
      <section className="space-y-3" aria-label="Saved promotions">
        {promotions.map((promotion) => {
          const status = !promotion.active ? "Unpublished" : visible.has(promotion.id) ? "Showing on dashboard" : "Published, outside the latest four";
          return (
            <article key={promotion.id} className="space-y-3 rounded-3xl border border-ink/10 bg-page p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="wrap-anywhere text-lg font-semibold">{promotion.title}</h2>
                  <p className="text-sm text-ink/75">{formats[promotion.format]} &middot; {status}</p>
                </div>
                <form action={setPromotionActiveAction.bind(null, promotion.id, !promotion.active)}>
                  <button type="submit" className="rounded-full border border-ink/20 px-4 py-2 text-sm font-semibold hover:bg-ink/5">
                    {promotion.active ? "Unpublish" : "Publish"}
                  </button>
                </form>
              </div>
              <details>
                <summary className="cursor-pointer text-sm font-semibold">Edit promotion</summary>
                <div className="mt-4">
                  <PromotionForm promotion={promotion} />
                  {promotion.format !== "text" && (
                    <Image
                      src={`/api/portal-promotions/${promotion.id}`}
                      alt={promotion.imageAlt}
                      width={240}
                      height={135}
                      unoptimized
                      className="mt-4 h-auto max-w-full rounded-xl"
                    />
                  )}
                </div>
              </details>
            </article>
          );
        })}
        {promotions.length === 0 && <p className="text-sm text-ink/75">No promotions yet.</p>}
      </section>
    </div>
  );
}
