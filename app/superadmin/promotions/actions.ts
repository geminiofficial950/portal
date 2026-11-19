"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { checkUpload } from "@/lib/file-types";
import { PROMOTION_FORMATS, savePromotion, setPromotionActive } from "@/lib/portal-promotions";

function refreshPromotions() {
  revalidatePath("/superadmin/promotions");
  revalidatePath("/admin/promotions");
  revalidatePath("/dashboard");
}

export async function savePromotionAction(_previous: string, form: FormData): Promise<string> {
  await requireAdmin();

  const field = (key: string) => {
    const value = form.get(key);
    return typeof value === "string" ? value.trim() : "";
  };
  const id = field("id");
  const format = PROMOTION_FORMATS.find((option) => option === field("format"));
  if (!format) return "Choose a banner format.";

  const title = field("title");
  const description = format === "photo" ? "" : field("description");
  const imageAlt = format === "text" ? "" : field("imageAlt");
  const link = field("link");
  const linkLabel = field("linkLabel");
  if (!title || title.length > 80) return "Enter a title of up to 80 characters.";
  if (description.length > 300) return "Keep the description under 300 characters.";
  if (format === "photo-text" && !description) return "Enter the banner text.";
  if (format !== "text" && (!imageAlt || imageAlt.length > 160)) return "Describe the image in up to 160 characters.";
  if (link.length > 500 || linkLabel.length > 40 || Boolean(link) !== Boolean(linkLabel)) {
    return "Provide both a valid destination and a button label of up to 40 characters, or leave both blank.";
  }
  if (link) {
    try {
      const url = new URL(link);
      if (url.protocol !== "https:" || url.username || url.password) return "Use an HTTPS link.";
    } catch {
      return "Use an HTTPS link.";
    }
  }

  const file = form.get("image");
  let image: Parameters<typeof savePromotion>[2];
  if (format !== "text" && file instanceof File && file.size > 0) {
    if (file.size > 800 * 1024) return "Choose a JPG or PNG no larger than 800 KB.";
    const bytes = new Uint8Array(await file.arrayBuffer());
    const check = checkUpload(file.name, bytes);
    if (!check.ok || (check.mime !== "image/png" && check.mime !== "image/jpeg")) return "Choose a valid JPG or PNG image.";
    image = { mime: check.mime, bytes };
  }

  const saved = await savePromotion(id, { format, title, description, link, linkLabel, imageAlt }, image);
  if (!saved) return "Choose an image for this format or reload the promotion if it has changed.";
  refreshPromotions();
  return id ? "Changes saved." : "Draft created. Publish it below when ready.";
}

export async function setPromotionActiveAction(id: string, active: boolean) {
  await requireAdmin();
  await setPromotionActive(id, active === true);
  refreshPromotions();
}
