import Image from "next/image";
import { requireStudent } from "@/lib/auth";
import { listPromotions } from "@/lib/portal-promotions";

export default async function PortalPromotions() {
  await requireStudent();
  const promotions = await listPromotions(true);
  if (!promotions.length) return null;

  return (
    <section aria-labelledby="promotions-heading" className="space-y-3">
      <h2 id="promotions-heading" className="px-1 text-lg font-semibold text-ink">Promotions</h2>
      {promotions.map(({ id, title, description, format, imageAlt, link, linkLabel }) => (
        <article key={id} className="s-card overflow-hidden rounded-[1.5rem]">
          {format !== "text" && (
            <div className={`relative bg-[var(--s-soft)] ${format === "photo" ? "aspect-video" : "aspect-[2/1]"}`}>
              <Image
                src={`/api/portal-promotions/${id}`}
                alt={imageAlt}
                fill
                unoptimized
                sizes="(min-width: 1280px) 400px, 100vw"
                className={format === "photo" ? "object-contain" : "object-cover"}
              />
            </div>
          )}
          {(format !== "photo" || link) && (
            <div className="space-y-2 p-4">
              {format !== "photo" && <h3 className="wrap-anywhere text-base font-semibold text-ink">{title}</h3>}
              {description && <p className="wrap-anywhere whitespace-pre-line text-sm text-ink/80">{description}</p>}
              {link && (
                <a href={link} className="inline-block rounded-full bg-[var(--s-dark)] px-4 py-2 text-sm font-semibold text-white">
                  {linkLabel}
                </a>
              )}
            </div>
          )}
        </article>
      ))}
    </section>
  );
}
